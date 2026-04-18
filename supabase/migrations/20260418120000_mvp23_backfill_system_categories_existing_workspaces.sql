begin;

-- Ensure MVP23 columns exist in case an environment is partially migrated.
alter table public.categories
  add column if not exists source text,
  add column if not exists system_category_id uuid;

update public.categories
set source = 'custom'
where source is null;

alter table public.categories
  alter column source set default 'custom',
  alter column source set not null;

-- 1) Map existing custom categories to system catalog when name/type match exactly (ES/EN).
update public.categories c
set
  source = 'system',
  system_category_id = sc.id,
  expense_behavior = case
    when c.type = 'expense' then coalesce(c.expense_behavior, sc.default_expense_behavior)
    else null
  end,
  sort_order = coalesce(c.sort_order, sc.default_sort_order),
  color = coalesce(c.color, sc.default_color)
from public.system_categories sc
where c.system_category_id is null
  and c.source = 'custom'
  and c.type = sc.type
  and lower(trim(c.name)) in (lower(trim(sc.default_name_es)), lower(trim(sc.default_name_en)))
  and not exists (
    select 1
    from public.categories c2
    where c2.workspace_id = c.workspace_id
      and c2.system_category_id = sc.id
      and c2.id <> c.id
  );

-- 2) Insert missing system categories for existing workspaces.
insert into public.categories (
  workspace_id,
  name,
  type,
  source,
  system_category_id,
  expense_behavior,
  is_active,
  sort_order,
  color,
  icon,
  created_by
)
select
  w.id as workspace_id,
  case
    when coalesce(p.preferred_language, 'es') = 'en' then sc.default_name_en
    else sc.default_name_es
  end as name,
  sc.type,
  'system' as source,
  sc.id as system_category_id,
  sc.default_expense_behavior,
  sc.is_active,
  sc.default_sort_order,
  sc.default_color,
  null as icon,
  w.created_by
from public.workspaces w
left join public.profiles p
  on p.id = w.created_by
cross join public.system_categories sc
where sc.is_active = true
  and not exists (
    select 1
    from public.categories c
    where c.workspace_id = w.id
      and c.system_category_id = sc.id
  )
on conflict do nothing;

commit;
