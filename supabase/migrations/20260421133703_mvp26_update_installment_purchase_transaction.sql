begin;

drop function if exists public.update_installment_purchase_transaction(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  integer,
  date,
  date,
  text,
  text
);

create or replace function public.update_installment_purchase_transaction(
  p_installment_purchase_id uuid,
  p_workspace_id uuid,
  p_payment_method_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_installments_count integer,
  p_transaction_date date,
  p_effective_date date default null,
  p_description text default null,
  p_notes text default null
)
returns table (
  installment_purchase_id uuid,
  generated_installments integer,
  first_installment_period date,
  last_installment_period date
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_amount numeric(14, 2);
  total_cents bigint;
  base_cents bigint;
  remainder_cents bigint;
  installment_index integer;
  installment_cents bigint;
  installment_amount numeric(14, 2);
  distributed_total numeric(14, 2) := 0;
  computed_first_period date;
  computed_last_period date;
  payment_method_record record;
  category_record record;
  existing_purchase record;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'No authenticated user found.';
  end if;

  if p_installment_purchase_id is null then
    raise exception 'Installment purchase id is required.';
  end if;

  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Current user is not a member of this workspace.';
  end if;

  if p_installments_count is null or p_installments_count < 2 then
    raise exception 'Installment count must be at least 2.';
  end if;

  if p_installments_count > 120 then
    raise exception 'Installment count cannot be greater than 120.';
  end if;

  if p_transaction_date is null then
    raise exception 'Transaction date is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Installment purchase amount must be greater than zero.';
  end if;

  normalized_amount := round(p_amount::numeric, 2);
  if normalized_amount <= 0 then
    raise exception 'Installment purchase amount must be greater than zero.';
  end if;

  select ip.id, ip.workspace_id, ip.payment_method_id, ip.category_id
  into existing_purchase
  from public.installment_purchases ip
  where ip.id = p_installment_purchase_id
    and ip.workspace_id = p_workspace_id
  for update;

  if existing_purchase.id is null then
    raise exception 'Installment purchase not found in workspace.';
  end if;

  select pm.id, pm.type, pm.is_active
  into payment_method_record
  from public.payment_methods pm
  where pm.id = p_payment_method_id
    and pm.workspace_id = p_workspace_id;

  if payment_method_record.id is null then
    raise exception 'Payment method not found in workspace.';
  end if;

  if payment_method_record.type <> 'credit_card' then
    raise exception 'Installment purchases require a credit card payment method.';
  end if;

  if payment_method_record.is_active is not true
     and payment_method_record.id <> existing_purchase.payment_method_id then
    raise exception 'Payment method must be active.';
  end if;

  select c.id, c.type, c.is_active
  into category_record
  from public.categories c
  where c.id = p_category_id
    and c.workspace_id = p_workspace_id;

  if category_record.id is null then
    raise exception 'Category not found in workspace.';
  end if;

  if category_record.type <> 'expense' then
    raise exception 'Installment purchases require an expense category.';
  end if;

  if category_record.is_active is not true
     and category_record.id <> existing_purchase.category_id then
    raise exception 'Category must be active.';
  end if;

  computed_first_period :=
    date_trunc('month', coalesce(p_effective_date, p_transaction_date)::timestamp)::date;

  computed_last_period :=
    (computed_first_period + make_interval(months => p_installments_count - 1))::date;

  update public.installment_purchases
  set
    payment_method_id = p_payment_method_id,
    category_id = p_category_id,
    purchase_date = p_transaction_date,
    effective_date = p_effective_date,
    first_installment_date = computed_first_period,
    total_amount = normalized_amount,
    installments_count = p_installments_count::smallint,
    description = nullif(trim(p_description), ''),
    notes = nullif(trim(p_notes), ''),
    updated_at = timezone('utc', now())
  where id = p_installment_purchase_id
    and workspace_id = p_workspace_id;

  delete from public.transactions
  where workspace_id = p_workspace_id
    and installment_purchase_id = p_installment_purchase_id;

  total_cents := round(normalized_amount * 100)::bigint;
  base_cents := total_cents / p_installments_count;
  remainder_cents := total_cents % p_installments_count;

  for installment_index in 1..p_installments_count loop
    installment_cents := base_cents;
    if installment_index <= remainder_cents then
      installment_cents := installment_cents + 1;
    end if;

    installment_amount := (installment_cents::numeric / 100)::numeric(14, 2);
    distributed_total := round(distributed_total + installment_amount, 2);

    insert into public.transactions (
      workspace_id,
      transaction_date,
      effective_date,
      type,
      category_id,
      payment_method_id,
      amount,
      description,
      notes,
      is_recurring,
      installment_purchase_id,
      installment_number,
      installment_count,
      created_by
    )
    values (
      p_workspace_id,
      p_transaction_date,
      (computed_first_period + make_interval(months => installment_index - 1))::date,
      'expense',
      p_category_id,
      p_payment_method_id,
      installment_amount,
      nullif(trim(p_description), ''),
      nullif(trim(p_notes), ''),
      false,
      p_installment_purchase_id,
      installment_index::smallint,
      p_installments_count::smallint,
      current_user_id
    );
  end loop;

  if distributed_total <> normalized_amount then
    raise exception 'Installment distribution mismatch. Expected %, got %.',
      normalized_amount, distributed_total;
  end if;

  installment_purchase_id := p_installment_purchase_id;
  generated_installments := p_installments_count;
  first_installment_period := computed_first_period;
  last_installment_period := computed_last_period;

  return next;
end;
$$;

commit;
