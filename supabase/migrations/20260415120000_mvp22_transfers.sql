-- Migration for MVP 22: Transfers between payment methods
begin;

-- 1. Extend transactions table with transfer fields
alter table public.transactions 
  add column if not exists transfer_group_id uuid,
  add column if not exists direction text check (direction in ('in', 'out'));

-- 2. Update transaction type check to include 'transfer'
-- First, drop the old constraint
alter table public.transactions 
  drop constraint if exists transactions_type_check;

-- Add the new constraint with 'transfer'
alter table public.transactions 
  add constraint transactions_type_check 
  check (type in ('income', 'expense', 'saving', 'transfer'));

-- 3. Update consistent workspace trigger to handle 'transfer'
-- We need to check if category is required for transfers. 
-- According to MVP, every transaction (including transfer) has a category_id.
-- Let's see if we should create a default "Transfer" category or if we should allow category_id to be null for transfers.
-- The docs don't mention a "Transfer" category explicitly, but says "reutilización de infraestructura existente".
-- The existing check requires category type to match transaction type.
-- So we might need to update the trigger to handle the category match for 'transfer'.

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

  -- Update here: for transfers, we don't necessarily need a matching category type 
  -- IF we decide to use a generic category or if we add 'transfer' to category types.
  -- The requirement says type = 'transfer'. Let's check category types too.
  if category_type <> new.type then
    raise exception 'Transaction type must match category type (category: %, transaction: %).', category_type, new.type;
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

  -- Specific checks for transfers
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

  return new;
end;
$$;

-- 4. Update categories type check to include 'transfer'
alter table public.categories
  drop constraint if exists categories_type_check;

alter table public.categories
  add constraint categories_type_check
  check (type in ('income', 'expense', 'saving', 'transfer'));

-- 5. RLS Policies update (if needed)
-- The existing policies use c.type = transactions.type, which should work if we have a transfer category.

commit;
