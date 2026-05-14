begin;

create table if not exists public.category_subcategories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  sort_order integer,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

create index if not exists idx_category_subcategories_workspace
  on public.category_subcategories(workspace_id);
create index if not exists idx_category_subcategories_category
  on public.category_subcategories(category_id);

create or replace function public.ensure_category_subcategory_workspace_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  category_workspace_id uuid;
begin
  select c.workspace_id
  into category_workspace_id
  from public.categories c
  where c.id = new.category_id;

  if category_workspace_id is null then
    raise exception 'Category not found for subcategory.';
  end if;

  if category_workspace_id <> new.workspace_id then
    raise exception 'Subcategory must belong to the same workspace as category.';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_category_subcategory_workspace_match on public.category_subcategories;
create trigger ensure_category_subcategory_workspace_match
before insert or update on public.category_subcategories
for each row
execute function public.ensure_category_subcategory_workspace_consistency();

drop trigger if exists set_category_subcategories_updated_at on public.category_subcategories;
create trigger set_category_subcategories_updated_at
before update on public.category_subcategories
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.category_subcategories enable row level security;

drop policy if exists "category_subcategories_select_member" on public.category_subcategories;
create policy "category_subcategories_select_member"
on public.category_subcategories
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "category_subcategories_insert_owner_admin" on public.category_subcategories;
create policy "category_subcategories_insert_owner_admin"
on public.category_subcategories
for insert
with check (
  public.is_workspace_owner_or_admin(workspace_id)
  and created_by = auth.uid()
  and exists (
    select 1
    from public.categories c
    where c.id = category_subcategories.category_id
      and c.workspace_id = category_subcategories.workspace_id
  )
);

drop policy if exists "category_subcategories_update_owner_admin" on public.category_subcategories;
create policy "category_subcategories_update_owner_admin"
on public.category_subcategories
for update
using (public.is_workspace_owner_or_admin(workspace_id))
with check (
  public.is_workspace_owner_or_admin(workspace_id)
  and exists (
    select 1
    from public.categories c
    where c.id = category_subcategories.category_id
      and c.workspace_id = category_subcategories.workspace_id
  )
);

drop policy if exists "category_subcategories_delete_owner_admin" on public.category_subcategories;
create policy "category_subcategories_delete_owner_admin"
on public.category_subcategories
for delete
using (public.is_workspace_owner_or_admin(workspace_id));

alter table public.budget_items
  add column if not exists subcategory_id uuid references public.category_subcategories(id) on delete restrict;

create index if not exists idx_budget_items_subcategory
  on public.budget_items(subcategory_id);

alter table public.transactions
  add column if not exists subcategory_id uuid references public.category_subcategories(id) on delete restrict;

create index if not exists idx_transactions_subcategory
  on public.transactions(subcategory_id);
create index if not exists idx_transactions_workspace_subcategory
  on public.transactions(workspace_id, subcategory_id);

alter table public.installment_purchases
  add column if not exists subcategory_id uuid references public.category_subcategories(id) on delete restrict;

create index if not exists idx_installment_purchases_workspace_subcategory
  on public.installment_purchases(workspace_id, subcategory_id);

alter table public.budget_items
  drop constraint if exists budget_items_budget_period_id_category_id_key;

alter table public.budget_items
  add column if not exists line_key text generated always as (
    category_id::text || ':' || coalesce(subcategory_id::text, 'root')
  ) stored;

drop index if exists idx_budget_items_period_line_key;
create unique index idx_budget_items_period_line_key
  on public.budget_items(budget_period_id, line_key);

create or replace function public.budget_item_belongs_to_period_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  period_workspace_id uuid;
  category_workspace_id uuid;
  subcategory_workspace_id uuid;
  subcategory_category_id uuid;
begin
  select bp.workspace_id
  into period_workspace_id
  from public.budget_periods bp
  where bp.id = new.budget_period_id;

  if period_workspace_id is null then
    raise exception 'Budget period not found for item.';
  end if;

  select c.workspace_id
  into category_workspace_id
  from public.categories c
  where c.id = new.category_id;

  if category_workspace_id is null then
    raise exception 'Category not found for budget item.';
  end if;

  if period_workspace_id <> category_workspace_id then
    raise exception 'Category and budget period must belong to the same workspace.';
  end if;

  if new.subcategory_id is null then
    return new;
  end if;

  select cs.workspace_id, cs.category_id
  into subcategory_workspace_id, subcategory_category_id
  from public.category_subcategories cs
  where cs.id = new.subcategory_id;

  if subcategory_workspace_id is null then
    raise exception 'Subcategory not found for budget item.';
  end if;

  if subcategory_workspace_id <> period_workspace_id then
    raise exception 'Subcategory and budget period must belong to the same workspace.';
  end if;

  if subcategory_category_id <> new.category_id then
    raise exception 'Subcategory must belong to selected category.';
  end if;

  return new;
end;
$$;

drop policy if exists "budget_items_insert_owner_admin" on public.budget_items;
create policy "budget_items_insert_owner_admin"
on public.budget_items
for insert
with check (
  exists (
    select 1
    from public.budget_periods bp
    join public.categories c on c.id = category_id
    where bp.id = budget_period_id
      and bp.workspace_id = c.workspace_id
      and public.is_workspace_owner_or_admin(bp.workspace_id)
  )
  and (
    subcategory_id is null
    or exists (
      select 1
      from public.budget_periods bp
      join public.category_subcategories cs on cs.id = subcategory_id
      where bp.id = budget_period_id
        and cs.workspace_id = bp.workspace_id
        and cs.category_id = category_id
    )
  )
);

drop policy if exists "budget_items_update_owner_admin" on public.budget_items;
create policy "budget_items_update_owner_admin"
on public.budget_items
for update
using (
  exists (
    select 1
    from public.budget_periods bp
    where bp.id = budget_period_id
      and public.is_workspace_owner_or_admin(bp.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.budget_periods bp
    join public.categories c on c.id = category_id
    where bp.id = budget_period_id
      and bp.workspace_id = c.workspace_id
      and public.is_workspace_owner_or_admin(bp.workspace_id)
  )
  and (
    subcategory_id is null
    or exists (
      select 1
      from public.budget_periods bp
      join public.category_subcategories cs on cs.id = subcategory_id
      where bp.id = budget_period_id
        and cs.workspace_id = bp.workspace_id
        and cs.category_id = category_id
    )
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
  subcategory_workspace_id uuid;
  subcategory_category_id uuid;
  payment_workspace_id uuid;
  payment_type text;
  purchase_workspace_id uuid;
  purchase_category_id uuid;
  purchase_subcategory_id uuid;
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

  if new.subcategory_id is not null then
    select cs.workspace_id, cs.category_id
    into subcategory_workspace_id, subcategory_category_id
    from public.category_subcategories cs
    where cs.id = new.subcategory_id;

    if subcategory_workspace_id is null then
      raise exception 'Subcategory not found for transaction.';
    end if;

    if subcategory_workspace_id <> new.workspace_id then
      raise exception 'Subcategory must belong to the same workspace as transaction.';
    end if;

    if subcategory_category_id <> new.category_id then
      raise exception 'Subcategory must belong to selected category.';
    end if;
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
    ip.subcategory_id,
    ip.payment_method_id,
    ip.purchase_date,
    ip.first_installment_date,
    ip.installments_count
  into
    purchase_workspace_id,
    purchase_category_id,
    purchase_subcategory_id,
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

  if purchase_subcategory_id is distinct from new.subcategory_id then
    raise exception 'Installment transaction subcategory must match parent installment purchase.';
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

drop policy if exists "transactions_insert_owner_admin" on public.transactions;
create policy "transactions_insert_owner_admin"
on public.transactions
for insert
with check (
  public.is_workspace_owner_or_admin(workspace_id)
  and created_by = auth.uid()
  and exists (
    select 1
    from public.categories c
    where c.id = transactions.category_id
      and c.workspace_id = transactions.workspace_id
      and c.type = transactions.type
  )
  and (
    transactions.subcategory_id is null
    or exists (
      select 1
      from public.category_subcategories cs
      where cs.id = transactions.subcategory_id
        and cs.workspace_id = transactions.workspace_id
        and cs.category_id = transactions.category_id
    )
  )
  and (
    transactions.payment_method_id is null
    or exists (
      select 1
      from public.payment_methods pm
      where pm.id = transactions.payment_method_id
        and pm.workspace_id = transactions.workspace_id
    )
  )
);

drop policy if exists "transactions_update_owner_admin" on public.transactions;
create policy "transactions_update_owner_admin"
on public.transactions
for update
using (public.is_workspace_owner_or_admin(workspace_id))
with check (
  public.is_workspace_owner_or_admin(workspace_id)
  and exists (
    select 1
    from public.categories c
    where c.id = transactions.category_id
      and c.workspace_id = transactions.workspace_id
      and c.type = transactions.type
  )
  and (
    transactions.subcategory_id is null
    or exists (
      select 1
      from public.category_subcategories cs
      where cs.id = transactions.subcategory_id
        and cs.workspace_id = transactions.workspace_id
        and cs.category_id = transactions.category_id
    )
  )
  and (
    transactions.payment_method_id is null
    or exists (
      select 1
      from public.payment_methods pm
      where pm.id = transactions.payment_method_id
        and pm.workspace_id = transactions.workspace_id
    )
  )
);

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
  and (
    installment_purchases.subcategory_id is null
    or exists (
      select 1
      from public.category_subcategories cs
      where cs.id = installment_purchases.subcategory_id
        and cs.workspace_id = installment_purchases.workspace_id
        and cs.category_id = installment_purchases.category_id
        and cs.is_active = true
    )
  )
);

drop policy if exists "installment_purchases_update_member" on public.installment_purchases;
create policy "installment_purchases_update_member"
on public.installment_purchases
for update
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.payment_methods pm
    where pm.id = installment_purchases.payment_method_id
      and pm.workspace_id = installment_purchases.workspace_id
      and pm.type = 'credit_card'
  )
  and exists (
    select 1
    from public.categories c
    where c.id = installment_purchases.category_id
      and c.workspace_id = installment_purchases.workspace_id
      and c.type = 'expense'
  )
  and (
    installment_purchases.subcategory_id is null
    or exists (
      select 1
      from public.category_subcategories cs
      where cs.id = installment_purchases.subcategory_id
        and cs.workspace_id = installment_purchases.workspace_id
        and cs.category_id = installment_purchases.category_id
    )
  )
);

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
  p_subcategory_id uuid default null,
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
  subcategory_record record;
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

  if p_subcategory_id is not null then
    select cs.id, cs.category_id, cs.is_active
    into subcategory_record
    from public.category_subcategories cs
    where cs.id = p_subcategory_id
      and cs.workspace_id = p_workspace_id;

    if subcategory_record.id is null then
      raise exception 'Subcategory not found in workspace.';
    end if;

    if subcategory_record.category_id <> p_category_id then
      raise exception 'Subcategory must belong to selected category.';
    end if;

    if subcategory_record.is_active is not true then
      raise exception 'Subcategory must be active.';
    end if;
  end if;

  computed_first_period :=
    date_trunc('month', coalesce(p_effective_date, p_transaction_date)::timestamp)::date;

  computed_last_period :=
    (computed_first_period + make_interval(months => p_installments_count - 1))::date;

  insert into public.installment_purchases (
    workspace_id,
    payment_method_id,
    category_id,
    subcategory_id,
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
    p_subcategory_id,
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
      subcategory_id,
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
      p_subcategory_id,
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
  p_subcategory_id uuid default null,
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
  subcategory_record record;
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

  select ip.id, ip.workspace_id, ip.payment_method_id, ip.category_id, ip.subcategory_id
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

  if p_subcategory_id is not null then
    select cs.id, cs.category_id, cs.is_active
    into subcategory_record
    from public.category_subcategories cs
    where cs.id = p_subcategory_id
      and cs.workspace_id = p_workspace_id;

    if subcategory_record.id is null then
      raise exception 'Subcategory not found in workspace.';
    end if;

    if subcategory_record.category_id <> p_category_id then
      raise exception 'Subcategory must belong to selected category.';
    end if;

    if subcategory_record.is_active is not true
       and subcategory_record.id is distinct from existing_purchase.subcategory_id then
      raise exception 'Subcategory must be active.';
    end if;
  end if;

  computed_first_period :=
    date_trunc('month', coalesce(p_effective_date, p_transaction_date)::timestamp)::date;

  computed_last_period :=
    (computed_first_period + make_interval(months => p_installments_count - 1))::date;

  update public.installment_purchases
  set
    payment_method_id = p_payment_method_id,
    category_id = p_category_id,
    subcategory_id = p_subcategory_id,
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

  delete from public.transactions t
  where t.workspace_id = p_workspace_id
    and t.installment_purchase_id = p_installment_purchase_id;

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
      subcategory_id,
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
      p_subcategory_id,
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
