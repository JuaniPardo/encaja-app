begin;

create or replace function public.leave_workspace(p_workspace_id uuid)
returns table (
  left_workspace_id uuid,
  left_workspace_slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  accessible_workspace_count integer;
  target_workspace_id uuid;
  target_workspace_slug text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'No hay sesión activa para abandonar un workspace.';
  end if;

  select wm.workspace_id, w.slug
  into target_workspace_id, target_workspace_slug
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.workspace_id = p_workspace_id
    and wm.user_id = current_user_id
    and wm.role <> 'owner'
  limit 1;

  if target_workspace_id is null then
    raise exception 'No sos miembro de este workspace o sos el owner y no podés abandonarlo.';
  end if;

  select count(*)
  into accessible_workspace_count
  from public.workspace_members wm
  where wm.user_id = current_user_id
    and wm.workspace_id <> target_workspace_id;

  if accessible_workspace_count < 1 then
    raise exception 'Necesitás al menos un workspace activo.';
  end if;

  delete from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = current_user_id;

  if not found then
    raise exception 'No pudimos procesar tu salida del workspace.';
  end if;

  return query
  select target_workspace_id, target_workspace_slug;
end;
$$;

revoke all on function public.leave_workspace(uuid) from public;
grant execute on function public.leave_workspace(uuid) to authenticated;

commit;
