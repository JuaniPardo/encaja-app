begin;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
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

create or replace function public.normalize_workspace_slug(raw_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(
        both '-' from regexp_replace(
          regexp_replace(
            regexp_replace(lower(coalesce(raw_name, '')), '[^a-z0-9\s-]', '', 'g'),
            '\s+',
            '-',
            'g'
          ),
          '-+',
          '-',
          'g'
        )
      ),
      ''
    ),
    'workspace'
  );
$$;

create or replace function public.allocate_workspace_slug(workspace_name text)
returns text
language plpgsql
as $$
declare
  base_slug text;
  candidate_slug text;
  attempts integer := 0;
begin
  base_slug := public.normalize_workspace_slug(workspace_name);
  candidate_slug := base_slug;

  while exists (
    select 1
    from public.workspaces w
    where w.slug = candidate_slug
  ) loop
    attempts := attempts + 1;
    candidate_slug := base_slug || '-' || left(gen_random_uuid()::text, 8);

    if attempts > 64 then
      raise exception 'No pudimos asignar un slug único para el workspace.';
    end if;
  end loop;

  return candidate_slug;
end;
$$;

update public.workspaces w
set slug = public.allocate_workspace_slug(
  coalesce(
    nullif(trim(w.slug), ''),
    nullif(trim(w.name), ''),
    'workspace'
  )
)
where w.slug is null
   or trim(w.slug) = ''
   or w.slug <> public.normalize_workspace_slug(w.slug);

create or replace function public.create_workspace_with_defaults(p_workspace_name text)
returns table (
  workspace_id uuid,
  workspace_name text,
  workspace_slug text,
  workspace_role text,
  subscription_plan text,
  subscription_status text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_workspace_name text;
  created_workspace_id uuid;
  created_workspace_slug text;
  current_year integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'No hay sesión activa para crear un workspace.';
  end if;

  normalized_workspace_name := nullif(trim(p_workspace_name), '');
  if normalized_workspace_name is null then
    raise exception 'El nombre del workspace es obligatorio.';
  end if;

  created_workspace_slug := public.allocate_workspace_slug(normalized_workspace_name);

  insert into public.workspaces (name, slug, created_by)
  values (normalized_workspace_name, created_workspace_slug, current_user_id)
  returning id into created_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (created_workspace_id, current_user_id, 'owner');

  current_year := extract(year from now())::integer;

  insert into public.workspace_settings (
    workspace_id,
    start_year,
    savings_rate_mode,
    deferred_income_enabled,
    deferred_income_day,
    currency_code,
    show_cents
  )
  values (
    created_workspace_id,
    current_year,
    'manual',
    false,
    null,
    'ARS',
    false
  );

  insert into public.subscriptions (workspace_id, plan, status)
  values (created_workspace_id, 'premium', 'active');

  insert into public.categories (
    workspace_id,
    name,
    type,
    expense_behavior,
    is_active,
    sort_order,
    color,
    icon,
    created_by
  )
  values
    (created_workspace_id, 'Sueldo', 'income', null, true, 10, null, null, current_user_id),
    (created_workspace_id, 'Ingresos extra', 'income', null, true, 20, null, null, current_user_id),
    (created_workspace_id, 'Alquiler', 'expense', 'fixed', true, 10, null, null, current_user_id),
    (created_workspace_id, 'Servicios', 'expense', 'fixed', true, 20, null, null, current_user_id),
    (created_workspace_id, 'Alimentos', 'expense', 'variable', true, 30, null, null, current_user_id),
    (created_workspace_id, 'Transporte', 'expense', 'variable', true, 40, null, null, current_user_id),
    (created_workspace_id, 'Ahorro mensual', 'saving', null, true, 10, null, null, current_user_id);

  return query
  select
    w.id,
    w.name,
    w.slug,
    wm.role,
    s.plan,
    s.status
  from public.workspaces w
  join public.workspace_members wm
    on wm.workspace_id = w.id
   and wm.user_id = current_user_id
  join public.subscriptions s
    on s.workspace_id = w.id
  where w.id = created_workspace_id;
end;
$$;

drop policy if exists "workspaces_update_owner_admin" on public.workspaces;
create policy "workspaces_update_owner"
on public.workspaces
for update
using (public.is_workspace_owner(id))
with check (public.is_workspace_owner(id));

drop policy if exists "workspace_settings_insert_owner_admin" on public.workspace_settings;
create policy "workspace_settings_insert_owner"
on public.workspace_settings
for insert
with check (public.is_workspace_owner(workspace_id));

drop policy if exists "workspace_settings_update_owner_admin" on public.workspace_settings;
create policy "workspace_settings_update_owner"
on public.workspace_settings
for update
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

drop policy if exists "subscriptions_insert_owner_admin" on public.subscriptions;
create policy "subscriptions_insert_owner"
on public.subscriptions
for insert
with check (public.is_workspace_owner(workspace_id));

drop policy if exists "subscriptions_update_owner_admin" on public.subscriptions;
create policy "subscriptions_update_owner"
on public.subscriptions
for update
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

commit;
