begin;

-- Additional manual legacy mapping rules:
-- Alarma -> expense_insurance
-- Celulares -> expense_subscriptions
-- Empleada -> expense_maintenance
-- Hogar -> expense_maintenance
-- Instagram -> expense_subscriptions
-- Internet y Streaming -> expense_subscriptions
-- Pedidos -> expense_deliveries
-- Psicólogo -> expense_health
-- Shopping -> expense_entertainment
-- Varios -> expense_other
-- Alquiler Kiosko -> income_extra
-- Zurich -> saving_monthly
with mapping_aliases(type, system_key, alias_normalized) as (
  values
    ('expense', 'expense_insurance', 'alarma'),
    ('expense', 'expense_subscriptions', 'celulares'),
    ('expense', 'expense_maintenance', 'empleada'),
    ('expense', 'expense_maintenance', 'hogar'),
    ('expense', 'expense_subscriptions', 'instagram'),
    ('expense', 'expense_subscriptions', 'internet y streaming'),
    ('expense', 'expense_deliveries', 'pedidos'),
    ('expense', 'expense_health', 'psicologo'),
    ('expense', 'expense_health', 'psicólogo'),
    ('expense', 'expense_entertainment', 'shopping'),
    ('expense', 'expense_other', 'varios'),
    ('income', 'income_extra', 'alquiler kiosko'),
    ('saving', 'saving_monthly', 'zurich')
),
candidate_categories as (
  select
    c.workspace_id,
    c.id as custom_category_id,
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
upserted_budget_items as (
  insert into public.budget_items (
    id,
    budget_period_id,
    category_id,
    amount,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    src.budget_period_id,
    src.target_category_id,
    src.amount_total,
    now(),
    now()
  from (
    select
      bi.budget_period_id,
      cc.system_category_instance_id as target_category_id,
      sum(bi.amount)::numeric(14, 2) as amount_total
    from public.budget_items bi
    join candidate_categories cc
      on cc.custom_category_id = bi.category_id
    group by bi.budget_period_id, cc.system_category_instance_id
  ) src
  on conflict (budget_period_id, category_id) do update
  set
    amount = public.budget_items.amount + excluded.amount,
    updated_at = now()
  returning id
),
deleted_source_budget_items as (
  delete from public.budget_items source
  using candidate_categories cc
  where source.category_id = cc.custom_category_id
  returning source.id
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
