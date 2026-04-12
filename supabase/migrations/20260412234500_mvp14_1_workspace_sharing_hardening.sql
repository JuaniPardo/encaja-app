begin;

update public.profiles
set email = lower(trim(email))
where email <> lower(trim(email));

do $$
begin
  if exists (
    select 1
    from public.profiles p
    where trim(p.email) = ''
  ) then
    raise exception 'Cada profile debe tener un email válido y no vacío.';
  end if;

  if exists (
    select 1
    from (
      select lower(trim(p.email)) as normalized_email
      from public.profiles p
      group by 1
      having count(*) > 1
    ) duplicated_emails
  ) then
    raise exception 'No pudimos endurecer email: existen emails duplicados en profiles.';
  end if;
end;
$$;

create or replace function public.normalize_profile_email()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(coalesce(new.email, '')));

  if new.email = '' then
    raise exception 'El email es obligatorio.';
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_profiles_email on public.profiles;
create trigger normalize_profiles_email
before insert or update on public.profiles
for each row
execute function public.normalize_profile_email();

create unique index if not exists idx_profiles_email_lower_unique
  on public.profiles ((lower(email)));

update public.workspace_members
set role = 'member'
where role = 'admin';

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.workspace_members'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
  loop
    execute format('alter table public.workspace_members drop constraint %I', constraint_name);
  end loop;
end;
$$;

alter table public.workspace_members
add constraint workspace_members_role_check
check (role in ('owner', 'member'));

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
      and wm.role = 'owner'
  );
$$;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create or replace function app_private.list_workspace_members_internal(
  p_workspace_id uuid,
  p_actor_user_id uuid
)
returns table (
  member_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if p_actor_user_id is null then
    raise exception 'No hay sesión activa para listar miembros.';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_actor_user_id
  ) then
    raise exception 'No tenés acceso a este workspace.';
  end if;

  return query
  select
    wm.id as member_id,
    wm.user_id,
    p.email,
    p.full_name,
    wm.role,
    wm.created_at as joined_at
  from public.workspace_members wm
  join public.profiles p on p.id = wm.user_id
  where wm.workspace_id = p_workspace_id
  order by
    case wm.role when 'owner' then 0 else 1 end,
    lower(coalesce(p.full_name, p.email)),
    wm.created_at;
end;
$$;

create or replace function app_private.invite_workspace_member_by_email_internal(
  p_workspace_id uuid,
  p_email text,
  p_actor_user_id uuid
)
returns table (
  member_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  joined_at timestamptz,
  was_created boolean
)
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  normalized_email text;
  invited_profile public.profiles%rowtype;
  existing_member public.workspace_members%rowtype;
  inserted_member public.workspace_members%rowtype;
begin
  if p_actor_user_id is null then
    raise exception 'No hay sesión activa para invitar miembros.';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_actor_user_id
      and wm.role = 'owner'
  ) then
    raise exception 'Solo el owner puede invitar miembros.';
  end if;

  normalized_email := lower(trim(coalesce(p_email, '')));
  if normalized_email = '' then
    raise exception 'El email es obligatorio.';
  end if;

  select *
  into invited_profile
  from public.profiles p
  where p.email = normalized_email;

  if invited_profile.id is null then
    raise exception 'No encontramos ese email. La persona debe registrarse primero.';
  end if;

  if invited_profile.id = p_actor_user_id then
    raise exception 'No podés invitarte a vos mismo.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (p_workspace_id, invited_profile.id, 'member')
  on conflict (workspace_id, user_id) do nothing
  returning *
  into inserted_member;

  if inserted_member.id is null then
    select *
    into existing_member
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = invited_profile.id;

    return query
    select
      existing_member.id,
      existing_member.user_id,
      invited_profile.email,
      invited_profile.full_name,
      existing_member.role,
      existing_member.created_at,
      false;
    return;
  end if;

  return query
  select
    inserted_member.id,
    inserted_member.user_id,
    invited_profile.email,
    invited_profile.full_name,
    inserted_member.role,
    inserted_member.created_at,
    true;
end;
$$;

create or replace function app_private.remove_workspace_member_internal(
  p_workspace_id uuid,
  p_member_user_id uuid,
  p_actor_user_id uuid
)
returns table (
  member_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text
)
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  target_member public.workspace_members%rowtype;
  target_profile public.profiles%rowtype;
  removed_member public.workspace_members%rowtype;
begin
  if p_actor_user_id is null then
    raise exception 'No hay sesión activa para remover miembros.';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_actor_user_id
      and wm.role = 'owner'
  ) then
    raise exception 'Solo el owner puede remover miembros.';
  end if;

  if p_member_user_id = p_actor_user_id then
    raise exception 'No podés remover tu propia membresía.';
  end if;

  select *
  into target_member
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = p_member_user_id;

  if target_member.id is null then
    raise exception 'No encontramos ese miembro en este workspace.';
  end if;

  if target_member.role = 'owner' then
    raise exception 'No podés remover al owner del workspace.';
  end if;

  select *
  into target_profile
  from public.profiles p
  where p.id = target_member.user_id;

  delete from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = p_member_user_id
    and wm.role = 'member'
  returning *
  into removed_member;

  if removed_member.id is null then
    raise exception 'No pudimos remover al miembro.';
  end if;

  return query
  select
    removed_member.id,
    removed_member.user_id,
    target_profile.email,
    target_profile.full_name,
    removed_member.role;
end;
$$;

revoke all on function app_private.list_workspace_members_internal(uuid, uuid) from public;
grant execute on function app_private.list_workspace_members_internal(uuid, uuid) to authenticated;

revoke all on function app_private.invite_workspace_member_by_email_internal(uuid, text, uuid) from public;
grant execute on function app_private.invite_workspace_member_by_email_internal(uuid, text, uuid) to authenticated;

revoke all on function app_private.remove_workspace_member_internal(uuid, uuid, uuid) from public;
grant execute on function app_private.remove_workspace_member_internal(uuid, uuid, uuid) to authenticated;

create or replace function public.list_workspace_members(p_workspace_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  joined_at timestamptz
)
language sql
security invoker
set search_path = public, app_private
as $$
  select *
  from app_private.list_workspace_members_internal(p_workspace_id, auth.uid());
$$;

create or replace function public.invite_workspace_member_by_email(
  p_workspace_id uuid,
  p_email text
)
returns table (
  member_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  joined_at timestamptz,
  was_created boolean
)
language sql
security invoker
set search_path = public, app_private
as $$
  select *
  from app_private.invite_workspace_member_by_email_internal(p_workspace_id, p_email, auth.uid());
$$;

create or replace function public.remove_workspace_member(
  p_workspace_id uuid,
  p_member_user_id uuid
)
returns table (
  member_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text
)
language sql
security invoker
set search_path = public, app_private
as $$
  select *
  from app_private.remove_workspace_member_internal(p_workspace_id, p_member_user_id, auth.uid());
$$;

revoke all on function public.list_workspace_members(uuid) from public;
grant execute on function public.list_workspace_members(uuid) to authenticated;

revoke all on function public.invite_workspace_member_by_email(uuid, text) from public;
grant execute on function public.invite_workspace_member_by_email(uuid, text) to authenticated;

revoke all on function public.remove_workspace_member(uuid, uuid) from public;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;

drop policy if exists "categories_insert_member" on public.categories;
drop policy if exists "categories_insert_owner_admin" on public.categories;
drop policy if exists "categories_insert_owner" on public.categories;
create policy "categories_insert_owner"
on public.categories
for insert
with check (
  public.is_workspace_owner(workspace_id)
  and created_by = auth.uid()
);

drop policy if exists "categories_update_member" on public.categories;
drop policy if exists "categories_update_owner_admin" on public.categories;
drop policy if exists "categories_update_owner" on public.categories;
create policy "categories_update_owner"
on public.categories
for update
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

drop policy if exists "payment_methods_insert_member" on public.payment_methods;
drop policy if exists "payment_methods_insert_owner_admin" on public.payment_methods;
drop policy if exists "payment_methods_insert_owner" on public.payment_methods;
create policy "payment_methods_insert_owner"
on public.payment_methods
for insert
with check (
  public.is_workspace_owner(workspace_id)
  and created_by = auth.uid()
);

drop policy if exists "payment_methods_update_member" on public.payment_methods;
drop policy if exists "payment_methods_update_owner_admin" on public.payment_methods;
drop policy if exists "payment_methods_update_owner" on public.payment_methods;
create policy "payment_methods_update_owner"
on public.payment_methods
for update
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

drop policy if exists "budget_periods_insert_member" on public.budget_periods;
drop policy if exists "budget_periods_insert_owner_admin" on public.budget_periods;
drop policy if exists "budget_periods_insert_owner" on public.budget_periods;
create policy "budget_periods_insert_owner"
on public.budget_periods
for insert
with check (
  public.is_workspace_owner(workspace_id)
  and created_by = auth.uid()
);

drop policy if exists "budget_periods_update_member" on public.budget_periods;
drop policy if exists "budget_periods_update_owner_admin" on public.budget_periods;
drop policy if exists "budget_periods_update_owner" on public.budget_periods;
create policy "budget_periods_update_owner"
on public.budget_periods
for update
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

drop policy if exists "budget_items_insert_member" on public.budget_items;
drop policy if exists "budget_items_insert_owner_admin" on public.budget_items;
drop policy if exists "budget_items_insert_owner" on public.budget_items;
create policy "budget_items_insert_owner"
on public.budget_items
for insert
with check (
  exists (
    select 1
    from public.budget_periods bp
    join public.categories c on c.id = category_id
    where bp.id = budget_period_id
      and bp.workspace_id = c.workspace_id
      and public.is_workspace_owner(bp.workspace_id)
  )
);

drop policy if exists "budget_items_update_member" on public.budget_items;
drop policy if exists "budget_items_update_owner_admin" on public.budget_items;
drop policy if exists "budget_items_update_owner" on public.budget_items;
create policy "budget_items_update_owner"
on public.budget_items
for update
using (
  exists (
    select 1
    from public.budget_periods bp
    where bp.id = budget_period_id
      and public.is_workspace_owner(bp.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.budget_periods bp
    join public.categories c on c.id = category_id
    where bp.id = budget_period_id
      and bp.workspace_id = c.workspace_id
      and public.is_workspace_owner(bp.workspace_id)
  )
);

drop policy if exists "budget_items_delete_member" on public.budget_items;
drop policy if exists "budget_items_delete_owner_admin" on public.budget_items;
drop policy if exists "budget_items_delete_owner" on public.budget_items;
create policy "budget_items_delete_owner"
on public.budget_items
for delete
using (
  exists (
    select 1
    from public.budget_periods bp
    where bp.id = budget_period_id
      and public.is_workspace_owner(bp.workspace_id)
  )
);

commit;
