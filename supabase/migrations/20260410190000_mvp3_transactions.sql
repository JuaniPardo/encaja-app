begin;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  transaction_date date not null,
  effective_date date,
  type text not null check (type in ('income', 'expense', 'saving')),
  category_id uuid not null references public.categories(id) on delete restrict,
  payment_method_id uuid references public.payment_methods(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  description text,
  notes text,
  is_recurring boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_workspace on public.transactions(workspace_id);
create index if not exists idx_transactions_workspace_date
  on public.transactions(workspace_id, transaction_date desc, created_at desc);
create index if not exists idx_transactions_workspace_type on public.transactions(workspace_id, type);
create index if not exists idx_transactions_category on public.transactions(category_id);
create index if not exists idx_transactions_payment_method on public.transactions(payment_method_id);

create or replace function public.ensure_transaction_workspace_consistency()
returns trigger
language plpgsql
as $$
declare
  category_workspace_id uuid;
  category_type text;
  payment_workspace_id uuid;
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
    raise exception 'Transaction type must match category type.';
  end if;

  if new.payment_method_id is not null then
    select pm.workspace_id
    into payment_workspace_id
    from public.payment_methods pm
    where pm.id = new.payment_method_id;

    if payment_workspace_id is null then
      raise exception 'Payment method not found for transaction.';
    end if;

    if payment_workspace_id <> new.workspace_id then
      raise exception 'Payment method must belong to the same workspace as transaction.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_transactions_workspace_consistency on public.transactions;
create trigger ensure_transactions_workspace_consistency
before insert or update on public.transactions
for each row
execute function public.ensure_transaction_workspace_consistency();

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
before update on public.transactions
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_member" on public.transactions;
create policy "transactions_select_member"
on public.transactions
for select
using (public.is_workspace_member(workspace_id));

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
    transactions.payment_method_id is null
    or exists (
      select 1
      from public.payment_methods pm
      where pm.id = transactions.payment_method_id
        and pm.workspace_id = transactions.workspace_id
    )
  )
);

drop policy if exists "transactions_delete_owner_admin" on public.transactions;
create policy "transactions_delete_owner_admin"
on public.transactions
for delete
using (public.is_workspace_owner_or_admin(workspace_id));

commit;
