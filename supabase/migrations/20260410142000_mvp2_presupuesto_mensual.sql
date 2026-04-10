begin;

create table if not exists public.budget_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  year integer not null check (year between 2000 and 2200),
  month smallint not null check (month between 1 and 12),
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, year, month)
);

create table if not exists public.budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_period_id uuid not null references public.budget_periods(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  amount numeric(14, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_period_id, category_id)
);

create index if not exists idx_budget_periods_workspace on public.budget_periods(workspace_id);
create index if not exists idx_budget_items_period on public.budget_items(budget_period_id);
create index if not exists idx_budget_items_category on public.budget_items(category_id);

create or replace function public.budget_item_belongs_to_period_workspace()
returns trigger
language plpgsql
as $$
declare
  period_workspace_id uuid;
  category_workspace_id uuid;
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

  return new;
end;
$$;

create trigger ensure_budget_item_workspace_match
before insert or update on public.budget_items
for each row
execute function public.budget_item_belongs_to_period_workspace();

create trigger set_budget_periods_updated_at
before update on public.budget_periods
for each row
execute function public.set_current_timestamp_updated_at();

create trigger set_budget_items_updated_at
before update on public.budget_items
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.budget_periods enable row level security;
alter table public.budget_items enable row level security;

create policy "budget_periods_select_member"
on public.budget_periods
for select
using (public.is_workspace_member(workspace_id));

create policy "budget_periods_insert_owner_admin"
on public.budget_periods
for insert
with check (
  public.is_workspace_owner_or_admin(workspace_id)
  and created_by = auth.uid()
);

create policy "budget_periods_update_owner_admin"
on public.budget_periods
for update
using (public.is_workspace_owner_or_admin(workspace_id))
with check (public.is_workspace_owner_or_admin(workspace_id));

create policy "budget_items_select_member"
on public.budget_items
for select
using (
  exists (
    select 1
    from public.budget_periods bp
    where bp.id = budget_period_id
      and public.is_workspace_member(bp.workspace_id)
  )
);

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
);

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
);

drop policy if exists "budget_items_delete_owner_admin" on public.budget_items;
create policy "budget_items_delete_owner_admin"
on public.budget_items
for delete
using (
  exists (
    select 1
    from public.budget_periods bp
    where bp.id = budget_period_id
      and public.is_workspace_owner_or_admin(bp.workspace_id)
  )
);

commit;
