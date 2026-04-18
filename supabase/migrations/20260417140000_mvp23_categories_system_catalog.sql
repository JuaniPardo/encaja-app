begin;

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

alter table public.system_categories
  drop constraint if exists system_categories_id_type_unique;

alter table public.system_categories
  add constraint system_categories_id_type_unique unique (id, type);

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

alter table public.categories
  add column if not exists source text,
  add column if not exists system_category_id uuid;

alter table public.categories
  drop constraint if exists categories_system_category_id_type_fkey;

alter table public.categories
  drop constraint if exists categories_system_category_id_fkey;

alter table public.categories
  add constraint categories_system_category_id_type_fkey
  foreign key (system_category_id, type)
  references public.system_categories(id, type)
  on delete restrict;

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

create index if not exists idx_categories_system_category_id
  on public.categories(system_category_id);

create unique index if not exists idx_categories_workspace_system_category_unique
  on public.categories(workspace_id, system_category_id)
  where system_category_id is not null;

create or replace function public.create_workspace_with_defaults(p_workspace_name text)
returns table (
  workspace_id uuid,
  workspace_name text,
  workspace_slug text,
  workspace_role text,
  subscription_plan text,
  subscription_status text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_workspace_name text;
  created_workspace_id uuid;
  created_workspace_slug text;
  current_year integer;
  preferred_language text;
  inserted_categories_count integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'No hay sesión activa para crear un workspace.';
  end if;

  normalized_workspace_name := nullif(trim(p_workspace_name), '');
  if normalized_workspace_name is null then
    raise exception 'El nombre del workspace es obligatorio.';
  end if;

  created_workspace_slug := public.allocate_workspace_slug(normalized_workspace_name);

  insert into public.workspaces (name, slug, created_by)
  values (normalized_workspace_name, created_workspace_slug, current_user_id)
  returning id into created_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (created_workspace_id, current_user_id, 'owner');

  current_year := extract(year from now())::integer;

  insert into public.workspace_settings (
    workspace_id,
    start_year,
    savings_rate_mode,
    deferred_income_enabled,
    deferred_income_day,
    currency_code,
    show_cents
  )
  values (
    created_workspace_id,
    current_year,
    'manual',
    false,
    null,
    'ARS',
    false
  );

  insert into public.subscriptions (workspace_id, plan, status)
  values (created_workspace_id, 'premium', 'active');

  select p.preferred_language
  into preferred_language
  from public.profiles p
  where p.id = current_user_id;

  preferred_language := case
    when preferred_language in ('es', 'en') then preferred_language
    else 'es'
  end;

  insert into public.categories (
    workspace_id,
    name,
    type,
    expense_behavior,
    is_active,
    sort_order,
    color,
    icon,
    created_by,
    source,
    system_category_id
  )
  select
    created_workspace_id,
    case
      when preferred_language = 'en' then sc.default_name_en
      else sc.default_name_es
    end as localized_name,
    sc.type,
    sc.default_expense_behavior,
    sc.is_active,
    sc.default_sort_order,
    sc.default_color,
    null,
    current_user_id,
    'system',
    sc.id
  from public.system_categories sc
  where sc.is_active = true
  order by sc.type, sc.default_sort_order nulls last, sc.default_name_es;

  get diagnostics inserted_categories_count = row_count;
  if coalesce(inserted_categories_count, 0) = 0 then
    raise exception 'No existen categorías del sistema activas para inicializar el workspace.';
  end if;

  return query
  select
    w.id,
    w.name,
    w.slug,
    wm.role,
    s.plan,
    s.status
  from public.workspaces w
  join public.workspace_members wm
    on wm.workspace_id = w.id
   and wm.user_id = current_user_id
  join public.subscriptions s
    on s.workspace_id = w.id
  where w.id = created_workspace_id;
end;
$$;

commit;
