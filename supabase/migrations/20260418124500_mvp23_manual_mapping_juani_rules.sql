begin;

-- Manual mapping rules confirmed by product:
-- Mercado -> expense_groceries
-- Tarjeta -> expense_other
-- Salidas -> expense_entertainment
-- Pago de Tarjeta / Transferencia -> transfer_internal
with mapping_aliases(type, system_key, alias_normalized) as (
  values
    ('expense', 'expense_groceries', 'mercado'),
    ('expense', 'expense_other', 'tarjeta'),
    ('expense', 'expense_entertainment', 'salidas'),
    ('transfer', 'transfer_internal', 'pago de tarjeta'),
    ('transfer', 'transfer_internal', 'transferencia')
),
candidate_categories as (
  select
    c.workspace_id,
    c.id as custom_category_id,
    c.type as custom_type,
    c.name as custom_name,
    c.is_active as custom_is_active,
    c.created_by as custom_created_by,
    cs.id as system_category_instance_id
  from public.categories c
  join mapping_aliases ma
    on ma.type = c.type
   and ma.alias_normalized = lower(regexp_replace(trim(c.name), '\s+', ' ', 'g'))
  join public.system_categories sc
    on sc.key = ma.system_key
   and sc.type = ma.type
  join public.categories cs
    on cs.workspace_id = c.workspace_id
   and cs.system_category_id = sc.id
  where c.source = 'custom'
    and c.system_category_id is null
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
