begin;

-- 1) Add deliveries to system catalog.
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
  ('expense_deliveries', 'expense', 'Delivery', 'Deliveries', 'variable', 45, null, true)
on conflict (key) do update
set
  type = excluded.type,
  default_name_es = excluded.default_name_es,
  default_name_en = excluded.default_name_en,
  default_expense_behavior = excluded.default_expense_behavior,
  default_sort_order = excluded.default_sort_order,
  default_color = excluded.default_color,
  is_active = excluded.is_active;

-- 2) Ensure existing workspaces have an instance in categories.
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
join public.system_categories sc
  on sc.key = 'expense_deliveries'
where not exists (
  select 1
  from public.categories c
  where c.workspace_id = w.id
    and c.system_category_id = sc.id
)
on conflict do nothing;

-- 3) Optional legacy mapping for common delivery aliases.
with alias_map(alias_normalized) as (
  values
    ('pedidos'),
    ('delivery'),
    ('deliveries'),
    ('rappi'),
    ('uber eats')
),
candidate_categories as (
  select
    c.workspace_id,
    c.id as custom_category_id,
    cs.id as system_category_instance_id
  from public.categories c
  join alias_map am
    on lower(regexp_replace(trim(c.name), '\s+', ' ', 'g')) = am.alias_normalized
  join public.system_categories sc
    on sc.key = 'expense_deliveries'
   and sc.type = 'expense'
  join public.categories cs
    on cs.workspace_id = c.workspace_id
   and cs.system_category_id = sc.id
  where c.source = 'custom'
    and c.system_category_id is null
    and c.type = 'expense'
),
moved_transactions as (
  update public.transactions t
  set category_id = cc.system_category_instance_id
  from candidate_categories cc
  where t.category_id = cc.custom_category_id
  returning t.id
),
moved_budget_items as (
  update public.budget_items bi
  set category_id = cc.system_category_instance_id
  from candidate_categories cc
  where bi.category_id = cc.custom_category_id
  returning bi.id
)
delete from public.categories c
using candidate_categories cc
where c.id = cc.custom_category_id
  and not exists (
    select 1
    from public.transactions t
    where t.category_id = c.id
  )
  and not exists (
    select 1
    from public.budget_items bi
    where bi.category_id = c.id
  );

commit;
