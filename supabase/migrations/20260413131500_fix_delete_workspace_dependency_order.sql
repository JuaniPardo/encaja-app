begin;

create or replace function public.delete_workspace(p_workspace_id uuid)
returns table (
  deleted_workspace_id uuid,
  deleted_workspace_slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  accessible_workspace_count integer;
  v_target_workspace_id uuid;
  v_target_workspace_slug text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'No hay sesión activa para eliminar un workspace.';
  end if;

  select w.id, w.slug
  into v_target_workspace_id, v_target_workspace_slug
  from public.workspaces w
  join public.workspace_members wm
    on wm.workspace_id = w.id
   and wm.user_id = current_user_id
   and wm.role = 'owner'
  where w.id = p_workspace_id
  limit 1;

  if v_target_workspace_id is null then
    raise exception 'Solo el owner puede eliminar este workspace.';
  end if;

  select count(*)
  into accessible_workspace_count
  from public.workspace_members wm
  where wm.user_id = current_user_id
    and wm.workspace_id <> v_target_workspace_id;

  if accessible_workspace_count < 1 then
    raise exception 'Necesitás al menos un workspace activo.';
  end if;

  -- Borrado explícito de dependencias con FKs RESTRICT para evitar conflictos
  -- durante el cascade del workspace.
  delete from public.transactions t
  where t.workspace_id = v_target_workspace_id;

  delete from public.budget_items bi
  using public.budget_periods bp
  where bi.budget_period_id = bp.id
    and bp.workspace_id = v_target_workspace_id;

  -- Defensa adicional por si existiera alguna inconsistencia histórica.
  delete from public.budget_items bi
  using public.categories c
  where bi.category_id = c.id
    and c.workspace_id = v_target_workspace_id;

  -- Limpieza explícita de vínculos para evitar bloqueos por RLS/policies.
  delete from public.workspace_links wl
  where wl.source_workspace_id = v_target_workspace_id
     or wl.target_workspace_id = v_target_workspace_id;

  delete from public.workspaces w
  where w.id = v_target_workspace_id;

  if not found then
    raise exception 'No pudimos eliminar el workspace.';
  end if;

  return query
  select v_target_workspace_id, v_target_workspace_slug;
end;
$$;

revoke all on function public.delete_workspace(uuid) from public;
grant execute on function public.delete_workspace(uuid) to authenticated;

commit;
