begin;

-- Preflight: ensure system catalog exists in environments that skipped base MVP23 migration.
create table if not exists public.system_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  type text not null check (type in ('income', 'expense', 'saving', 'transfer')),
  default_name_es text not null,
  default_name_en text not null,
  default_expense_behavior text,
  default_sort_order integer,
  default_color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_categories_default_expense_behavior_check check (
    (type = 'expense' and default_expense_behavior in ('fixed', 'variable'))
    or (type in ('income', 'saving', 'transfer') and default_expense_behavior is null)
  )
);

drop trigger if exists set_system_categories_updated_at on public.system_categories;
create trigger set_system_categories_updated_at
before update on public.system_categories
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.system_categories enable row level security;

drop policy if exists "system_categories_select_authenticated" on public.system_categories;
create policy "system_categories_select_authenticated"
on public.system_categories
for select
using (auth.uid() is not null);

insert into public.system_categories (
  key,
  type,
  default_name_es,
  default_name_en,
  default_expense_behavior,
  default_sort_order,
  default_color,
  is_active
)
values
  ('income_salary', 'income', 'Sueldo', 'Salary', null, 10, null, true),
  ('income_extra', 'income', 'Ingresos extra', 'Extra income', null, 20, null, true),
  ('expense_rent', 'expense', 'Alquiler', 'Rent', 'fixed', 10, null, true),
  ('expense_utilities', 'expense', 'Servicios', 'Utilities', 'fixed', 20, null, true),
  ('expense_groceries', 'expense', 'Alimentos', 'Groceries', 'variable', 30, null, true),
  ('expense_transport', 'expense', 'Transporte', 'Transport', 'variable', 40, null, true),
  ('saving_monthly', 'saving', 'Ahorro mensual', 'Monthly savings', null, 10, null, true),
  ('transfer_internal', 'transfer', 'Transferencias internas', 'Internal transfers', null, 10, null, true)
on conflict (key) do update
set
  type = excluded.type,
  default_name_es = excluded.default_name_es,
  default_name_en = excluded.default_name_en,
  default_expense_behavior = excluded.default_expense_behavior,
  default_sort_order = excluded.default_sort_order,
  default_color = excluded.default_color,
  is_active = excluded.is_active;

-- Preflight: make sure MVP23 columns exist before normalization.
alter table public.categories
  add column if not exists source text,
  add column if not exists system_category_id uuid;

-- 1) Normalize potentially inconsistent existing rows before enforcing constraints.
update public.categories c
set
  source = case
    when c.system_category_id is null then 'custom'
    else 'system'
  end
where c.source is null
   or (c.source = 'system' and c.system_category_id is null)
   or (c.source = 'custom' and c.system_category_id is not null);

-- If mapped system category type does not match local category type, keep it as custom.
update public.categories c
set
  source = 'custom',
  system_category_id = null
from public.system_categories sc
where c.system_category_id = sc.id
  and c.type <> sc.type;

-- Deduplicate any repeated system category instances inside the same workspace.
with duplicated as (
  select
    id,
    row_number() over (
      partition by workspace_id, system_category_id
      order by created_at asc, id asc
    ) as rn
  from public.categories
  where system_category_id is not null
)
update public.categories c
set
  source = 'custom',
  system_category_id = null
from duplicated d
where c.id = d.id
  and d.rn > 1;

-- 2) Reinforce source/system_category_id integrity rules.
update public.categories
set source = 'custom'
where source is null;

alter table public.categories
  alter column source set default 'custom',
  alter column source set not null;

alter table public.categories
  drop constraint if exists categories_source_check;

alter table public.categories
  add constraint categories_source_check
  check (source in ('system', 'custom'));

alter table public.categories
  drop constraint if exists categories_source_system_category_consistency_check;

alter table public.categories
  add constraint categories_source_system_category_consistency_check
  check (
    (source = 'system' and system_category_id is not null)
    or (source = 'custom' and system_category_id is null)
  );

create unique index if not exists idx_categories_workspace_system_category_unique
  on public.categories(workspace_id, system_category_id)
  where system_category_id is not null;

-- 3) Simplify FK to single-column reference and enforce type alignment by trigger.
alter table public.categories
  drop constraint if exists categories_system_category_id_type_fkey;

alter table public.categories
  drop constraint if exists categories_system_category_id_fkey;

alter table public.system_categories
  drop constraint if exists system_categories_id_type_unique;

alter table public.categories
  add constraint categories_system_category_id_fkey
  foreign key (system_category_id)
  references public.system_categories(id)
  on delete restrict;

create or replace function public.ensure_category_system_type_alignment()
returns trigger
language plpgsql
set search_path = public
as '
declare
  v_system_type text;
begin
  if new.system_category_id is null then
    return new;
  end if;

  select sc.type
  into v_system_type
  from public.system_categories sc
  where sc.id = new.system_category_id;

  if v_system_type is null then
    raise exception ''System category not found.'';
  end if;

  if new.type <> v_system_type then
    raise exception
      ''Category type must match system category type (category: %, system: %).'',
      new.type,
      v_system_type;
  end if;

  return new;
end;
';

drop trigger if exists ensure_category_system_type_alignment on public.categories;
create trigger ensure_category_system_type_alignment
before insert or update of system_category_id, type
on public.categories
for each row
execute function public.ensure_category_system_type_alignment();

-- 4) Extend base system catalog with high-value defaults for semantic coverage.
insert into public.system_categories (
  key,
  type,
  default_name_es,
  default_name_en,
  default_expense_behavior,
  default_sort_order,
  default_color,
  is_active
)
values
  ('expense_subscriptions', 'expense', 'Suscripciones', 'Subscriptions', 'fixed', 50, null, true),
  ('expense_other', 'expense', 'Otros gastos', 'Other expenses', 'variable', 999, null, true)
on conflict (key) do update
set
  type = excluded.type,
  default_name_es = excluded.default_name_es,
  default_name_en = excluded.default_name_en,
  default_expense_behavior = excluded.default_expense_behavior,
  default_sort_order = excluded.default_sort_order,
  default_color = excluded.default_color,
  is_active = excluded.is_active;

commit;
