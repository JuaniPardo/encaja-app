begin;

-- Repair manual legacy mappings in sequential statements.
-- This avoids same-statement visibility issues when moving references
-- and deleting now-orphaned custom categories.

create temporary table tmp_mvp23_manual_mapping (
  type text not null,
  system_key text not null,
  alias_normalized text not null
) on commit drop;

insert into tmp_mvp23_manual_mapping (type, system_key, alias_normalized)
values
  ('expense', 'expense_groceries', 'mercado'),
  ('expense', 'expense_other', 'tarjeta'),
  ('expense', 'expense_entertainment', 'salidas'),
  ('transfer', 'transfer_internal', 'pago de tarjeta'),
  ('transfer', 'transfer_internal', 'transferencia'),
  ('expense', 'expense_deliveries', 'pedidos'),
  ('expense', 'expense_deliveries', 'delivery'),
  ('expense', 'expense_deliveries', 'deliveries'),
  ('expense', 'expense_deliveries', 'rappi'),
  ('expense', 'expense_deliveries', 'uber eats'),
  ('expense', 'expense_insurance', 'alarma'),
  ('expense', 'expense_subscriptions', 'celulares'),
  ('expense', 'expense_maintenance', 'empleada'),
  ('expense', 'expense_maintenance', 'hogar'),
  ('expense', 'expense_subscriptions', 'instagram'),
  ('expense', 'expense_subscriptions', 'internet y streaming'),
  ('expense', 'expense_health', 'psicologo'),
  ('expense', 'expense_health', 'psicólogo'),
  ('expense', 'expense_entertainment', 'shopping'),
  ('expense', 'expense_other', 'varios'),
  ('income', 'income_extra', 'alquiler kiosko'),
  ('saving', 'saving_monthly', 'zurich');

-- 1) Move transactions from matching custom categories to system categories.
with candidate_categories as (
  select distinct on (c.id)
    c.workspace_id,
    c.id as custom_category_id,
    cs.id as system_category_instance_id
  from public.categories c
  join tmp_mvp23_manual_mapping mm
    on mm.type = c.type
   and mm.alias_normalized = lower(regexp_replace(trim(c.name), '\s+', ' ', 'g'))
  join public.system_categories sc
    on sc.key = mm.system_key
   and sc.type = mm.type
  join public.categories cs
    on cs.workspace_id = c.workspace_id
   and cs.system_category_id = sc.id
  where c.source = 'custom'
    and c.system_category_id is null
  order by c.id, cs.id
)
update public.transactions t
set category_id = cc.system_category_instance_id
from candidate_categories cc
where t.category_id = cc.custom_category_id;

-- 2) Merge budget items into target system categories (handles unique collisions).
with candidate_categories as (
  select distinct on (c.id)
    c.workspace_id,
    c.id as custom_category_id,
    cs.id as system_category_instance_id
  from public.categories c
  join tmp_mvp23_manual_mapping mm
    on mm.type = c.type
   and mm.alias_normalized = lower(regexp_replace(trim(c.name), '\s+', ' ', 'g'))
  join public.system_categories sc
    on sc.key = mm.system_key
   and sc.type = mm.type
  join public.categories cs
    on cs.workspace_id = c.workspace_id
   and cs.system_category_id = sc.id
  where c.source = 'custom'
    and c.system_category_id is null
  order by c.id, cs.id
),
aggregated_budget as (
  select
    bi.budget_period_id,
    cc.system_category_instance_id as target_category_id,
    sum(bi.amount)::numeric(14, 2) as amount_total
  from public.budget_items bi
  join candidate_categories cc
    on cc.custom_category_id = bi.category_id
  group by bi.budget_period_id, cc.system_category_instance_id
)
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
  ab.budget_period_id,
  ab.target_category_id,
  ab.amount_total,
  now(),
  now()
from aggregated_budget ab
on conflict (budget_period_id, category_id) do update
set
  amount = public.budget_items.amount + excluded.amount,
  updated_at = now();

-- 3) Remove old budget items for mapped custom categories.
with candidate_categories as (
  select distinct on (c.id)
    c.id as custom_category_id
  from public.categories c
  join tmp_mvp23_manual_mapping mm
    on mm.type = c.type
   and mm.alias_normalized = lower(regexp_replace(trim(c.name), '\s+', ' ', 'g'))
  where c.source = 'custom'
    and c.system_category_id is null
  order by c.id
)
delete from public.budget_items bi
using candidate_categories cc
where bi.category_id = cc.custom_category_id;

-- 4) Delete now-unreferenced custom categories for mapped aliases.
with candidate_categories as (
  select distinct on (c.id)
    c.id as custom_category_id
  from public.categories c
  join tmp_mvp23_manual_mapping mm
    on mm.type = c.type
   and mm.alias_normalized = lower(regexp_replace(trim(c.name), '\s+', ' ', 'g'))
  where c.source = 'custom'
    and c.system_category_id is null
  order by c.id
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
