begin;

-- Normalize legacy payment method types before tightening the domain.
update public.payment_methods
set type = case
  when type = 'bank_transfer' then 'debit_card'
  when type = 'other' then 'cash'
  else type
end
where type in ('bank_transfer', 'other');

alter table public.payment_methods
  drop constraint if exists payment_methods_type_check;

alter table public.payment_methods
  add constraint payment_methods_type_check
  check (type in ('cash', 'debit_card', 'credit_card'));

-- Canonical transfer system categories.
insert into public.system_categories (
  key,
  type,
  default_name_es,
  default_name_en,
  default_expense_behavior,
  default_sort_order,
  default_color,
  is_active,
  is_exceptional,
  warning_message_es,
  warning_message_en
)
values
  ('transfer', 'transfer', 'Transferencia', 'Transfer', null, 10, null, true, false, null, null),
  (
    'credit_card_payment',
    'transfer',
    'Pago de tarjeta',
    'Credit card payment',
    null,
    20,
    null,
    true,
    false,
    null,
    null
  ),
  (
    'cash_withdrawal',
    'transfer',
    'Extracción',
    'Cash withdrawal',
    null,
    30,
    null,
    true,
    false,
    null,
    null
  ),
  (
    'cash_deposit',
    'transfer',
    'Depósito',
    'Cash deposit',
    null,
    40,
    null,
    true,
    false,
    null,
    null
  )
on conflict (key) do update
set
  type = excluded.type,
  default_name_es = excluded.default_name_es,
  default_name_en = excluded.default_name_en,
  default_expense_behavior = excluded.default_expense_behavior,
  default_sort_order = excluded.default_sort_order,
  default_color = excluded.default_color,
  is_active = excluded.is_active,
  is_exceptional = excluded.is_exceptional,
  warning_message_es = excluded.warning_message_es,
  warning_message_en = excluded.warning_message_en;

-- Ensure every workspace has category instances for the canonical transfer keys.
insert into public.categories (
  workspace_id,
  name,
  type,
  source,
  system_category_id,
  expense_behavior,
  is_active,
  is_editable,
  is_exceptional,
  warning_message,
  sort_order,
  color,
  icon,
  created_by
)
select
  w.id,
  case
    when coalesce(p.preferred_language, 'es') = 'en' then sc.default_name_en
    else sc.default_name_es
  end as localized_name,
  sc.type,
  'system' as source,
  sc.id as system_category_id,
  sc.default_expense_behavior,
  sc.is_active,
  false as is_editable,
  false as is_exceptional,
  null as warning_message,
  sc.default_sort_order,
  sc.default_color,
  null as icon,
  w.created_by
from public.workspaces w
left join public.profiles p
  on p.id = w.created_by
join public.system_categories sc
  on sc.key in ('transfer', 'credit_card_payment', 'cash_withdrawal', 'cash_deposit')
where not exists (
  select 1
  from public.categories c
  where c.workspace_id = w.id
    and c.system_category_id = sc.id
)
on conflict do nothing;

-- Move legacy transfer category usage to canonical category keys.
with legacy_mapping as (
  select 'transfer_internal'::text as legacy_key, 'transfer'::text as canonical_key
  union all
  select 'transfer_card_payment'::text as legacy_key, 'credit_card_payment'::text as canonical_key
),
workspace_mapping as (
  select
    legacy_category.id as legacy_category_id,
    canonical_category.id as canonical_category_id
  from legacy_mapping lm
  join public.system_categories legacy_sc
    on legacy_sc.key = lm.legacy_key
  join public.system_categories canonical_sc
    on canonical_sc.key = lm.canonical_key
  join public.categories legacy_category
    on legacy_category.system_category_id = legacy_sc.id
   and legacy_category.source = 'system'
  join public.categories canonical_category
    on canonical_category.workspace_id = legacy_category.workspace_id
   and canonical_category.system_category_id = canonical_sc.id
   and canonical_category.source = 'system'
  where legacy_category.id <> canonical_category.id
),
moved_transactions as (
  update public.transactions t
  set category_id = wm.canonical_category_id
  from workspace_mapping wm
  where t.category_id = wm.legacy_category_id
  returning t.id
),
moved_budget_items as (
  update public.budget_items bi
  set category_id = wm.canonical_category_id
  from workspace_mapping wm
  where bi.category_id = wm.legacy_category_id
  returning bi.id
)
select 1;

-- Keep legacy system keys for auditability but disable them.
update public.categories c
set is_active = false
from public.system_categories sc
where c.system_category_id = sc.id
  and sc.key in ('transfer_internal', 'transfer_card_payment')
  and c.is_active = true;

update public.system_categories
set is_active = false
where key in ('transfer_internal', 'transfer_card_payment');

create or replace function public.resolve_transfer_system_category_key(
  p_from_type text,
  p_to_type text
)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_from_type not in ('cash', 'debit_card', 'credit_card')
     or p_to_type not in ('cash', 'debit_card', 'credit_card') then
    raise exception 'Unsupported payment method type for transfer resolution.';
  end if;

  if p_from_type = 'credit_card' then
    raise exception 'Invalid transfer: credit card cannot be source.';
  end if;

  if p_from_type = 'debit_card' and p_to_type = 'cash' then
    return 'cash_withdrawal';
  end if;

  if p_from_type = 'cash' and p_to_type = 'debit_card' then
    return 'cash_deposit';
  end if;

  if (p_from_type = 'cash' or p_from_type = 'debit_card') and p_to_type = 'credit_card' then
    return 'credit_card_payment';
  end if;

  return 'transfer';
end;
$$;

create or replace function public.create_transfer_transaction(
  p_workspace_id uuid,
  p_from_payment_method_id uuid,
  p_to_payment_method_id uuid,
  p_amount numeric,
  p_transaction_date date,
  p_effective_date date default null,
  p_description text default null,
  p_notes text default null
)
returns table (
  out_transaction_id uuid,
  in_transaction_id uuid,
  transfer_group_id uuid,
  resolved_category_id uuid,
  resolved_system_key text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid;
  from_method record;
  to_method record;
  computed_category_id uuid;
  computed_system_key text;
  generated_transfer_group_id uuid;
  normalized_amount numeric(14, 2);
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'No authenticated user found.';
  end if;

  if p_from_payment_method_id = p_to_payment_method_id then
    raise exception 'Source and destination payment methods must be different.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero.';
  end if;

  normalized_amount := round(p_amount::numeric, 2);
  if normalized_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero.';
  end if;

  select pm.id, pm.type, pm.is_active
  into from_method
  from public.payment_methods pm
  where pm.id = p_from_payment_method_id
    and pm.workspace_id = p_workspace_id;

  if from_method.id is null then
    raise exception 'Source payment method not found in workspace.';
  end if;

  if from_method.is_active is not true then
    raise exception 'Source payment method must be active.';
  end if;

  select pm.id, pm.type, pm.is_active
  into to_method
  from public.payment_methods pm
  where pm.id = p_to_payment_method_id
    and pm.workspace_id = p_workspace_id;

  if to_method.id is null then
    raise exception 'Destination payment method not found in workspace.';
  end if;

  if to_method.is_active is not true then
    raise exception 'Destination payment method must be active.';
  end if;

  computed_system_key := public.resolve_transfer_system_category_key(from_method.type, to_method.type);

  select c.id
  into computed_category_id
  from public.categories c
  join public.system_categories sc
    on sc.id = c.system_category_id
  where c.workspace_id = p_workspace_id
    and c.type = 'transfer'
    and c.source = 'system'
    and c.is_active = true
    and sc.key = computed_system_key
  limit 1;

  if computed_category_id is null then
    raise exception 'Transfer category % is not configured for this workspace.', computed_system_key;
  end if;

  generated_transfer_group_id := gen_random_uuid();

  insert into public.transactions (
    workspace_id,
    transaction_date,
    effective_date,
    type,
    transfer_group_id,
    direction,
    category_id,
    payment_method_id,
    amount,
    description,
    notes,
    is_recurring,
    created_by
  )
  values (
    p_workspace_id,
    p_transaction_date,
    p_effective_date,
    'transfer',
    generated_transfer_group_id,
    'out',
    computed_category_id,
    p_from_payment_method_id,
    normalized_amount,
    nullif(trim(p_description), ''),
    nullif(trim(p_notes), ''),
    false,
    current_user_id
  )
  returning id into out_transaction_id;

  insert into public.transactions (
    workspace_id,
    transaction_date,
    effective_date,
    type,
    transfer_group_id,
    direction,
    category_id,
    payment_method_id,
    amount,
    description,
    notes,
    is_recurring,
    created_by
  )
  values (
    p_workspace_id,
    p_transaction_date,
    p_effective_date,
    'transfer',
    generated_transfer_group_id,
    'in',
    computed_category_id,
    p_to_payment_method_id,
    normalized_amount,
    nullif(trim(p_description), ''),
    nullif(trim(p_notes), ''),
    false,
    current_user_id
  )
  returning id into in_transaction_id;

  transfer_group_id := generated_transfer_group_id;
  resolved_category_id := computed_category_id;
  resolved_system_key := computed_system_key;

  return next;
end;
$$;

commit;
