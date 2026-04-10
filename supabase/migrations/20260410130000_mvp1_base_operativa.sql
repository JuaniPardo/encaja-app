begin;

create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.workspace_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  start_year integer not null,
  savings_rate_mode text not null check (savings_rate_mode in ('manual', 'percentage')),
  deferred_income_enabled boolean not null default false,
  deferred_income_day smallint,
  currency_code text not null default 'ARS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (deferred_income_enabled = false and deferred_income_day is null)
    or
    (deferred_income_enabled = true and deferred_income_day between 1 and 31)
  )
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense', 'saving')),
  is_active boolean not null default true,
  sort_order integer,
  color text,
  icon text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'debit_card', 'credit_card', 'bank_transfer', 'other')),
  is_active boolean not null default true,
  closing_day smallint,
  due_day smallint,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closing_day is null or closing_day between 1 and 31),
  check (due_day is null or due_day between 1 and 31)
);

create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_categories_workspace on public.categories(workspace_id);
create index if not exists idx_payment_methods_workspace on public.payment_methods(workspace_id);
create index if not exists idx_workspace_settings_workspace on public.workspace_settings(workspace_id);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_current_timestamp_updated_at();

create trigger set_workspaces_updated_at
before update on public.workspaces
for each row
execute function public.set_current_timestamp_updated_at();

create trigger set_workspace_settings_updated_at
before update on public.workspace_settings
for each row
execute function public.set_current_timestamp_updated_at();

create trigger set_categories_updated_at
before update on public.categories
for each row
execute function public.set_current_timestamp_updated_at();

create trigger set_payment_methods_updated_at
before update on public.payment_methods
for each row
execute function public.set_current_timestamp_updated_at();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner_or_admin(target_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.categories enable row level security;
alter table public.payment_methods enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "workspaces_select_member"
on public.workspaces
for select
using (created_by = auth.uid() or public.is_workspace_member(id));

create policy "workspaces_insert_creator"
on public.workspaces
for insert
with check (created_by = auth.uid());

create policy "workspaces_update_owner_admin"
on public.workspaces
for update
using (public.is_workspace_owner_or_admin(id))
with check (public.is_workspace_owner_or_admin(id));

create policy "workspace_members_select_own"
on public.workspace_members
for select
using (user_id = auth.uid());

create policy "workspace_members_insert_creator_owner"
on public.workspace_members
for insert
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1
    from public.workspaces w
    where w.id = workspace_id
      and w.created_by = auth.uid()
  )
);

create policy "workspace_settings_select_member"
on public.workspace_settings
for select
using (public.is_workspace_member(workspace_id));

create policy "workspace_settings_insert_owner_admin"
on public.workspace_settings
for insert
with check (public.is_workspace_owner_or_admin(workspace_id));

create policy "workspace_settings_update_owner_admin"
on public.workspace_settings
for update
using (public.is_workspace_owner_or_admin(workspace_id))
with check (public.is_workspace_owner_or_admin(workspace_id));

create policy "categories_select_member"
on public.categories
for select
using (public.is_workspace_member(workspace_id));

create policy "categories_insert_owner_admin"
on public.categories
for insert
with check (
  public.is_workspace_owner_or_admin(workspace_id)
  and created_by = auth.uid()
);

create policy "categories_update_owner_admin"
on public.categories
for update
using (public.is_workspace_owner_or_admin(workspace_id))
with check (public.is_workspace_owner_or_admin(workspace_id));

create policy "payment_methods_select_member"
on public.payment_methods
for select
using (public.is_workspace_member(workspace_id));

create policy "payment_methods_insert_owner_admin"
on public.payment_methods
for insert
with check (
  public.is_workspace_owner_or_admin(workspace_id)
  and created_by = auth.uid()
);

create policy "payment_methods_update_owner_admin"
on public.payment_methods
for update
using (public.is_workspace_owner_or_admin(workspace_id))
with check (public.is_workspace_owner_or_admin(workspace_id));

commit;
