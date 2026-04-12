begin;

with base_slug as (
  select
    id,
    created_at,
    lower(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            coalesce(nullif(trim(slug), ''), trim(name)),
            '[^a-z0-9\s-]',
            '',
            'g'
          ),
          '\s+',
          '-',
          'g'
        ),
        '-+',
        '-',
        'g'
      )
    ) as raw_slug
  from public.workspaces
),
normalized_slug as (
  select
    id,
    created_at,
    coalesce(nullif(trim(both '-' from raw_slug), ''), 'workspace') as slug_base
  from base_slug
),
ranked_slug as (
  select
    id,
    slug_base,
    row_number() over (partition by slug_base order by created_at, id) as slug_rank
  from normalized_slug
)
update public.workspaces as workspaces
set slug = case
  when ranked_slug.slug_rank = 1 then ranked_slug.slug_base
  else ranked_slug.slug_base || '-' || left(workspaces.id::text, 8)
end
from ranked_slug
where ranked_slug.id = workspaces.id;

alter table public.workspaces
  alter column slug set not null;

create unique index if not exists idx_workspaces_slug_unique
  on public.workspaces(slug);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  plan text not null check (plan in ('free', 'pro', 'premium')),
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_workspace on public.subscriptions(workspace_id);

insert into public.subscriptions (workspace_id, plan, status)
select workspaces.id, 'premium', 'active'
from public.workspaces as workspaces
on conflict (workspace_id) do nothing;

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_member" on public.subscriptions;
create policy "subscriptions_select_member"
on public.subscriptions
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "subscriptions_insert_owner_admin" on public.subscriptions;
create policy "subscriptions_insert_owner_admin"
on public.subscriptions
for insert
with check (public.is_workspace_owner_or_admin(workspace_id));

drop policy if exists "subscriptions_update_owner_admin" on public.subscriptions;
create policy "subscriptions_update_owner_admin"
on public.subscriptions
for update
using (public.is_workspace_owner_or_admin(workspace_id))
with check (public.is_workspace_owner_or_admin(workspace_id));

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_current_timestamp_updated_at();

commit;
