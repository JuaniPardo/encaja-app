begin;

create table if not exists public.installment_purchases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  purchase_date date not null,
  effective_date date,
  first_installment_date date not null,
  total_amount numeric(14, 2) not null check (total_amount > 0),
  installments_count smallint not null check (installments_count >= 2 and installments_count <= 120),
  description text,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_installment_purchases_workspace
  on public.installment_purchases(workspace_id);
create index if not exists idx_installment_purchases_workspace_method
  on public.installment_purchases(workspace_id, payment_method_id);
create index if not exists idx_installment_purchases_workspace_category
  on public.installment_purchases(workspace_id, category_id);
create index if not exists idx_installment_purchases_first_installment
  on public.installment_purchases(first_installment_date);

drop trigger if exists set_installment_purchases_updated_at on public.installment_purchases;
create trigger set_installment_purchases_updated_at
before update on public.installment_purchases
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.installment_purchases enable row level security;

drop policy if exists "installment_purchases_select_member" on public.installment_purchases;
create policy "installment_purchases_select_member"
on public.installment_purchases
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "installment_purchases_insert_member" on public.installment_purchases;
create policy "installment_purchases_insert_member"
on public.installment_purchases
for insert
with check (
  public.is_workspace_member(workspace_id)
  and created_by = auth.uid()
  and exists (
    select 1
    from public.payment_methods pm
    where pm.id = installment_purchases.payment_method_id
      and pm.workspace_id = installment_purchases.workspace_id
      and pm.type = 'credit_card'
      and pm.is_active = true
  )
  and exists (
    select 1
    from public.categories c
    where c.id = installment_purchases.category_id
      and c.workspace_id = installment_purchases.workspace_id
      and c.type = 'expense'
      and c.is_active = true
  )
);

drop policy if exists "installment_purchases_delete_member" on public.installment_purchases;
create policy "installment_purchases_delete_member"
on public.installment_purchases
for delete
using (public.is_workspace_member(workspace_id));

alter table public.transactions
  add column if not exists installment_purchase_id uuid references public.installment_purchases(id) on delete cascade,
  add column if not exists installment_number smallint,
  add column if not exists installment_count smallint;

create index if not exists idx_transactions_workspace_installment_purchase
  on public.transactions(workspace_id, installment_purchase_id);
create index if not exists idx_transactions_payment_method_installment
  on public.transactions(payment_method_id, installment_purchase_id);
create unique index if not exists idx_transactions_installment_purchase_number
  on public.transactions(installment_purchase_id, installment_number)
  where installment_purchase_id is not null;

alter table public.transactions
  drop constraint if exists transactions_installment_consistency_check;

alter table public.transactions
  add constraint transactions_installment_consistency_check
  check (
    (
      installment_purchase_id is null
      and installment_number is null
      and installment_count is null
    )
    or (
      installment_purchase_id is not null
      and installment_number is not null
      and installment_count is not null
      and installment_count >= 2
      and installment_number >= 1
      and installment_number <= installment_count
    )
  );

create or replace function public.ensure_transaction_workspace_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  category_workspace_id uuid;
  category_type text;
  payment_workspace_id uuid;
  payment_type text;
  purchase_workspace_id uuid;
  purchase_category_id uuid;
  purchase_payment_method_id uuid;
  purchase_date date;
  purchase_first_installment_date date;
  purchase_installments_count smallint;
  expected_effective_date date;
begin
  select c.workspace_id, c.type
  into category_workspace_id, category_type
  from public.categories c
  where c.id = new.category_id;

  if category_workspace_id is null then
    raise exception 'Category not found for transaction.';
  end if;

  if category_workspace_id <> new.workspace_id then
    raise exception 'Category must belong to the same workspace as transaction.';
  end if;

  if category_type <> new.type then
    raise exception 'Transaction type must match category type (category: %, transaction: %).', category_type, new.type;
  end if;

  if new.payment_method_id is not null then
    select pm.workspace_id, pm.type
    into payment_workspace_id, payment_type
    from public.payment_methods pm
    where pm.id = new.payment_method_id;

    if payment_workspace_id is null then
      raise exception 'Payment method not found for transaction.';
    end if;

    if payment_workspace_id <> new.workspace_id then
      raise exception 'Payment method must belong to the same workspace as transaction.';
    end if;
  end if;

  if new.type = 'transfer' then
    if new.transfer_group_id is null then
      raise exception 'Transfer must have a transfer_group_id.';
    end if;
    if new.direction is null then
      raise exception 'Transfer must have a direction (in/out).';
    end if;
    if new.payment_method_id is null then
      raise exception 'Transfer must have a payment_method_id.';
    end if;
  end if;

  if new.installment_purchase_id is null then
    if new.installment_number is not null or new.installment_count is not null then
      raise exception 'Installment metadata requires installment_purchase_id.';
    end if;
    return new;
  end if;

  if new.installment_number is null or new.installment_count is null then
    raise exception 'Installment metadata is incomplete.';
  end if;

  if new.installment_count < 2 then
    raise exception 'Installment count must be at least 2.';
  end if;

  if new.installment_number < 1 or new.installment_number > new.installment_count then
    raise exception 'Installment number must be within installment count.';
  end if;

  if new.type <> 'expense' then
    raise exception 'Installments are only supported for expense transactions.';
  end if;

  if new.payment_method_id is null then
    raise exception 'Installment transaction requires payment method.';
  end if;

  if payment_type <> 'credit_card' then
    raise exception 'Installment transaction payment method must be credit_card.';
  end if;

  select
    ip.workspace_id,
    ip.category_id,
    ip.payment_method_id,
    ip.purchase_date,
    ip.first_installment_date,
    ip.installments_count
  into
    purchase_workspace_id,
    purchase_category_id,
    purchase_payment_method_id,
    purchase_date,
    purchase_first_installment_date,
    purchase_installments_count
  from public.installment_purchases ip
  where ip.id = new.installment_purchase_id;

  if purchase_workspace_id is null then
    raise exception 'Installment purchase not found for transaction.';
  end if;

  if purchase_workspace_id <> new.workspace_id then
    raise exception 'Installment purchase must belong to the same workspace as transaction.';
  end if;

  if purchase_category_id <> new.category_id then
    raise exception 'Installment transaction category must match parent installment purchase.';
  end if;

  if purchase_payment_method_id <> new.payment_method_id then
    raise exception 'Installment transaction payment method must match parent installment purchase.';
  end if;

  if purchase_installments_count <> new.installment_count then
    raise exception 'Installment transaction count must match parent installment purchase.';
  end if;

  if new.transaction_date <> purchase_date then
    raise exception 'Installment transaction_date must match purchase_date.';
  end if;

  expected_effective_date :=
    (purchase_first_installment_date + make_interval(months => new.installment_number - 1))::date;

  if new.effective_date is distinct from expected_effective_date then
    raise exception 'Installment effective_date must match computed monthly period.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_installment_purchase_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_purchase_id uuid;
  expected_count smallint;
  expected_total numeric(14, 2);
  actual_count integer;
  actual_total numeric(14, 2);
  distinct_installments integer;
  min_installment_number smallint;
  max_installment_number smallint;
begin
  if tg_op = 'INSERT' then
    target_purchase_id := new.installment_purchase_id;
  elsif tg_op = 'UPDATE' then
    target_purchase_id := coalesce(new.installment_purchase_id, old.installment_purchase_id);
  else
    target_purchase_id := old.installment_purchase_id;
  end if;

  if target_purchase_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- During parent delete cascades, child rows are removed by FK and consistency checks are not needed.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  select ip.installments_count, ip.total_amount
  into expected_count, expected_total
  from public.installment_purchases ip
  where ip.id = target_purchase_id;

  if expected_count is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select
    count(*)::int,
    coalesce(round(sum(t.amount), 2), 0)::numeric(14, 2),
    count(distinct t.installment_number)::int,
    min(t.installment_number),
    max(t.installment_number)
  into
    actual_count,
    actual_total,
    distinct_installments,
    min_installment_number,
    max_installment_number
  from public.transactions t
  where t.installment_purchase_id = target_purchase_id;

  if actual_count <> expected_count then
    raise exception 'Installment purchase % must have exactly % rows, found %.',
      target_purchase_id, expected_count, actual_count;
  end if;

  if distinct_installments <> expected_count
     or min_installment_number <> 1
     or max_installment_number <> expected_count then
    raise exception 'Installment purchase % has invalid installment number distribution.',
      target_purchase_id;
  end if;

  if actual_total <> expected_total then
    raise exception 'Installment purchase % total mismatch. Expected %, got %.',
      target_purchase_id, expected_total, actual_total;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_installment_purchase_integrity on public.transactions;
create constraint trigger ensure_installment_purchase_integrity
after insert or update or delete on public.transactions
deferrable initially deferred
for each row
execute function public.validate_installment_purchase_integrity();

drop function if exists public.create_installment_purchase_transaction(
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

create or replace function public.create_installment_purchase_transaction(
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
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'No authenticated user found.';
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

  select pm.id, pm.type, pm.is_active
  into payment_method_record
  from public.payment_methods pm
  where pm.id = p_payment_method_id
    and pm.workspace_id = p_workspace_id;

  if payment_method_record.id is null then
    raise exception 'Payment method not found in workspace.';
  end if;

  if payment_method_record.is_active is not true then
    raise exception 'Payment method must be active.';
  end if;

  if payment_method_record.type <> 'credit_card' then
    raise exception 'Installment purchases require a credit card payment method.';
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

  if category_record.is_active is not true then
    raise exception 'Category must be active.';
  end if;

  computed_first_period :=
    date_trunc('month', coalesce(p_effective_date, p_transaction_date)::timestamp)::date;

  computed_last_period :=
    (computed_first_period + make_interval(months => p_installments_count - 1))::date;

  insert into public.installment_purchases (
    workspace_id,
    payment_method_id,
    category_id,
    purchase_date,
    effective_date,
    first_installment_date,
    total_amount,
    installments_count,
    description,
    notes,
    created_by
  )
  values (
    p_workspace_id,
    p_payment_method_id,
    p_category_id,
    p_transaction_date,
    p_effective_date,
    computed_first_period,
    normalized_amount,
    p_installments_count::smallint,
    nullif(trim(p_description), ''),
    nullif(trim(p_notes), ''),
    current_user_id
  )
  returning id into installment_purchase_id;

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
      installment_purchase_id,
      installment_index::smallint,
      p_installments_count::smallint,
      current_user_id
    );
  end loop;

  if distributed_total <> normalized_amount then
    raise exception 'Installment distribution mismatch. Expected %, got %.',
      normalized_amount, distributed_total;
  end if;

  generated_installments := p_installments_count;
  first_installment_period := computed_first_period;
  last_installment_period := computed_last_period;

  return next;
end;
$$;

commit;
