begin;

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
  on conflict do nothing
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

commit;
