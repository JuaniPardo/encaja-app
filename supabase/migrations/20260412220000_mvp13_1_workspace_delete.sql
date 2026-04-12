begin;

create or replace function public.delete_workspace(p_workspace_id uuid)
returns table (
  deleted_workspace_id uuid,
  deleted_workspace_slug text
)
language plpgsql
security invoker
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
    raise exception 'No hay sesión activa para eliminar un workspace.';
  end if;

  select w.id, w.slug
  into target_workspace_id, target_workspace_slug
  from public.workspaces w
  join public.workspace_members wm
    on wm.workspace_id = w.id
   and wm.user_id = current_user_id
   and wm.role = 'owner'
  where w.id = p_workspace_id
  limit 1;

  if target_workspace_id is null then
    raise exception 'Solo el owner puede eliminar este workspace.';
  end if;

  select count(*)
  into accessible_workspace_count
  from public.workspace_members wm
  where wm.user_id = current_user_id;

  if accessible_workspace_count <= 1 then
    raise exception 'Necesitás al menos un workspace activo.';
  end if;

  delete from public.workspaces w
  where w.id = target_workspace_id;

  if not found then
    raise exception 'No pudimos eliminar el workspace.';
  end if;

  return query
  select target_workspace_id, target_workspace_slug;
end;
$$;

drop policy if exists "workspaces_delete_owner_admin" on public.workspaces;
drop policy if exists "workspaces_delete_owner" on public.workspaces;
create policy "workspaces_delete_owner"
on public.workspaces
for delete
using (public.is_workspace_owner(id));

commit;
