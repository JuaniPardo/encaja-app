begin;

create table if not exists public.workspace_links (
  id uuid primary key default gen_random_uuid(),
  source_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  target_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  visibility_mode text not null default 'summary_only' check (visibility_mode in ('summary_only')),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_workspace_id <> target_workspace_id)
);

create index if not exists idx_workspace_links_source on public.workspace_links(source_workspace_id);
create index if not exists idx_workspace_links_target on public.workspace_links(target_workspace_id);
create unique index if not exists idx_workspace_links_active_pair_unique
  on public.workspace_links(source_workspace_id, target_workspace_id)
  where is_active = true;

create or replace function public.validate_workspace_link_currency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  source_currency text;
  target_currency text;
begin
  select ws.currency_code
  into source_currency
  from public.workspace_settings ws
  where ws.workspace_id = new.source_workspace_id;

  if source_currency is null then
    raise exception 'El workspace origen no tiene moneda configurada.';
  end if;

  select ws.currency_code
  into target_currency
  from public.workspace_settings ws
  where ws.workspace_id = new.target_workspace_id;

  if target_currency is null then
    raise exception 'El workspace destino no tiene moneda configurada.';
  end if;

  if source_currency <> target_currency then
    raise exception 'Solo podés vincular workspaces con la misma moneda.';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_workspace_currency_drift_with_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.currency_code = old.currency_code then
    return new;
  end if;

  if exists (
    select 1
    from public.workspace_links wl
    join public.workspace_settings opposite_settings
      on (
        opposite_settings.workspace_id = wl.target_workspace_id
        and wl.source_workspace_id = new.workspace_id
      )
      or (
        opposite_settings.workspace_id = wl.source_workspace_id
        and wl.target_workspace_id = new.workspace_id
      )
    where wl.is_active = true
      and opposite_settings.currency_code <> new.currency_code
  ) then
    raise exception 'No podés cambiar la moneda mientras existan vínculos activos incompatibles.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_workspace_link_currency on public.workspace_links;
create trigger validate_workspace_link_currency
before insert or update of source_workspace_id, target_workspace_id, is_active
on public.workspace_links
for each row
when (new.is_active = true)
execute function public.validate_workspace_link_currency();

drop trigger if exists prevent_workspace_currency_drift_with_links on public.workspace_settings;
create trigger prevent_workspace_currency_drift_with_links
before update of currency_code
on public.workspace_settings
for each row
execute function public.prevent_workspace_currency_drift_with_links();

drop trigger if exists set_workspace_links_updated_at on public.workspace_links;
create trigger set_workspace_links_updated_at
before update on public.workspace_links
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.workspace_links enable row level security;

drop policy if exists "workspace_links_select_source_member" on public.workspace_links;
create policy "workspace_links_select_source_member"
on public.workspace_links
for select
using (public.is_workspace_member(source_workspace_id));

drop policy if exists "workspace_links_insert_source_owner" on public.workspace_links;
create policy "workspace_links_insert_source_owner"
on public.workspace_links
for insert
with check (
  created_by = auth.uid()
  and public.is_workspace_owner(source_workspace_id)
  and public.is_workspace_member(target_workspace_id)
);

drop policy if exists "workspace_links_update_source_owner" on public.workspace_links;
create policy "workspace_links_update_source_owner"
on public.workspace_links
for update
using (public.is_workspace_owner(source_workspace_id))
with check (
  public.is_workspace_owner(source_workspace_id)
  and public.is_workspace_member(target_workspace_id)
);

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create or replace function app_private.list_workspace_links_internal(
  p_source_workspace_id uuid,
  p_actor_user_id uuid
)
returns table (
  link_id uuid,
  source_workspace_id uuid,
  target_workspace_id uuid,
  target_workspace_name text,
  target_workspace_slug text,
  target_currency_code text,
  visibility_mode text,
  is_active boolean,
  has_target_access boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if p_actor_user_id is null then
    raise exception 'No hay sesión activa para listar vínculos.';
  end if;

  if p_actor_user_id <> auth.uid() then
    raise exception 'Actor inválido para listar vínculos.';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_source_workspace_id
      and wm.user_id = p_actor_user_id
  ) then
    raise exception 'No tenés acceso al workspace origen.';
  end if;

  return query
  select
    wl.id as link_id,
    wl.source_workspace_id,
    wl.target_workspace_id,
    case
      when target_membership.user_id is not null then target_workspace.name
      else null
    end as target_workspace_name,
    case
      when target_membership.user_id is not null then target_workspace.slug
      else null
    end as target_workspace_slug,
    case
      when target_membership.user_id is not null then target_settings.currency_code
      else null
    end as target_currency_code,
    wl.visibility_mode,
    wl.is_active,
    (target_membership.user_id is not null) as has_target_access,
    wl.created_by,
    wl.created_at,
    wl.updated_at
  from public.workspace_links wl
  left join public.workspace_members target_membership
    on target_membership.workspace_id = wl.target_workspace_id
   and target_membership.user_id = p_actor_user_id
  left join public.workspaces target_workspace
    on target_workspace.id = wl.target_workspace_id
   and target_membership.user_id is not null
  left join public.workspace_settings target_settings
    on target_settings.workspace_id = wl.target_workspace_id
   and target_membership.user_id is not null
  where wl.source_workspace_id = p_source_workspace_id
  order by wl.is_active desc, wl.created_at desc;
end;
$$;

create or replace function app_private.create_workspace_link_internal(
  p_source_workspace_id uuid,
  p_target_workspace_id uuid,
  p_visibility_mode text,
  p_actor_user_id uuid
)
returns table (
  link_id uuid,
  source_workspace_id uuid,
  target_workspace_id uuid,
  target_workspace_name text,
  target_workspace_slug text,
  target_currency_code text,
  visibility_mode text,
  is_active boolean,
  has_target_access boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  normalized_visibility text;
  existing_active_link public.workspace_links%rowtype;
  existing_inactive_link public.workspace_links%rowtype;
  resulting_link public.workspace_links%rowtype;
begin
  if p_actor_user_id is null then
    raise exception 'No hay sesión activa para crear vínculos.';
  end if;

  if p_actor_user_id <> auth.uid() then
    raise exception 'Actor inválido para crear vínculos.';
  end if;

  if p_source_workspace_id = p_target_workspace_id then
    raise exception 'No podés vincular un workspace consigo mismo.';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_source_workspace_id
      and wm.user_id = p_actor_user_id
      and wm.role = 'owner'
  ) then
    raise exception 'Solo el owner puede crear vínculos desde este workspace.';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_target_workspace_id
      and wm.user_id = p_actor_user_id
  ) then
    raise exception 'Necesitás acceso válido al workspace destino.';
  end if;

  normalized_visibility := lower(trim(coalesce(p_visibility_mode, 'summary_only')));
  if normalized_visibility = '' then
    normalized_visibility := 'summary_only';
  end if;

  if normalized_visibility <> 'summary_only' then
    raise exception 'Solo está disponible el modo summary_only en esta etapa.';
  end if;

  select *
  into existing_active_link
  from public.workspace_links wl
  where wl.source_workspace_id = p_source_workspace_id
    and wl.target_workspace_id = p_target_workspace_id
    and wl.is_active = true
  limit 1;

  if existing_active_link.id is not null then
    raise exception 'Ya existe un vínculo activo para ese workspace destino.';
  end if;

  select *
  into existing_inactive_link
  from public.workspace_links wl
  where wl.source_workspace_id = p_source_workspace_id
    and wl.target_workspace_id = p_target_workspace_id
    and wl.is_active = false
  order by wl.updated_at desc
  limit 1;

  if existing_inactive_link.id is not null then
    update public.workspace_links wl
    set
      visibility_mode = normalized_visibility,
      is_active = true,
      updated_at = now()
    where wl.id = existing_inactive_link.id
    returning * into resulting_link;
  else
    insert into public.workspace_links (
      source_workspace_id,
      target_workspace_id,
      visibility_mode,
      is_active,
      created_by
    )
    values (
      p_source_workspace_id,
      p_target_workspace_id,
      normalized_visibility,
      true,
      p_actor_user_id
    )
    returning * into resulting_link;
  end if;

  return query
  select
    resulting_link.id as link_id,
    resulting_link.source_workspace_id,
    resulting_link.target_workspace_id,
    target_workspace.name as target_workspace_name,
    target_workspace.slug as target_workspace_slug,
    target_settings.currency_code as target_currency_code,
    resulting_link.visibility_mode,
    resulting_link.is_active,
    true as has_target_access,
    resulting_link.created_by,
    resulting_link.created_at,
    resulting_link.updated_at
  from public.workspaces target_workspace
  join public.workspace_settings target_settings
    on target_settings.workspace_id = target_workspace.id
  where target_workspace.id = resulting_link.target_workspace_id;
end;
$$;

create or replace function app_private.deactivate_workspace_link_internal(
  p_source_workspace_id uuid,
  p_link_id uuid,
  p_actor_user_id uuid
)
returns table (
  link_id uuid,
  source_workspace_id uuid,
  target_workspace_id uuid,
  target_workspace_name text,
  target_workspace_slug text,
  target_currency_code text,
  visibility_mode text,
  is_active boolean,
  has_target_access boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  resulting_link public.workspace_links%rowtype;
begin
  if p_actor_user_id is null then
    raise exception 'No hay sesión activa para desactivar vínculos.';
  end if;

  if p_actor_user_id <> auth.uid() then
    raise exception 'Actor inválido para desactivar vínculos.';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_source_workspace_id
      and wm.user_id = p_actor_user_id
      and wm.role = 'owner'
  ) then
    raise exception 'Solo el owner puede desactivar vínculos.';
  end if;

  update public.workspace_links wl
  set
    is_active = false,
    updated_at = now()
  where wl.id = p_link_id
    and wl.source_workspace_id = p_source_workspace_id
    and wl.is_active = true
  returning * into resulting_link;

  if resulting_link.id is null then
    raise exception 'No encontramos un vínculo activo para desactivar.';
  end if;

  return query
  select
    resulting_link.id as link_id,
    resulting_link.source_workspace_id,
    resulting_link.target_workspace_id,
    case
      when target_membership.user_id is not null then target_workspace.name
      else null
    end as target_workspace_name,
    case
      when target_membership.user_id is not null then target_workspace.slug
      else null
    end as target_workspace_slug,
    case
      when target_membership.user_id is not null then target_settings.currency_code
      else null
    end as target_currency_code,
    resulting_link.visibility_mode,
    resulting_link.is_active,
    (target_membership.user_id is not null) as has_target_access,
    resulting_link.created_by,
    resulting_link.created_at,
    resulting_link.updated_at
  from public.workspaces target_workspace
  left join public.workspace_members target_membership
    on target_membership.workspace_id = resulting_link.target_workspace_id
   and target_membership.user_id = p_actor_user_id
  left join public.workspace_settings target_settings
    on target_settings.workspace_id = resulting_link.target_workspace_id
   and target_membership.user_id is not null
  where target_workspace.id = resulting_link.target_workspace_id;
end;
$$;

create or replace function app_private.list_linked_workspace_summaries_internal(
  p_source_workspace_id uuid,
  p_year integer,
  p_month integer,
  p_actor_user_id uuid
)
returns table (
  link_id uuid,
  source_workspace_id uuid,
  target_workspace_id uuid,
  target_workspace_name text,
  target_workspace_slug text,
  target_currency_code text,
  visibility_mode text,
  period_year integer,
  period_month integer,
  income_total numeric,
  expense_total numeric,
  saving_total numeric,
  balance_total numeric
)
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  period_start date;
  period_end date;
begin
  if p_actor_user_id is null then
    raise exception 'No hay sesión activa para listar resúmenes vinculados.';
  end if;

  if p_actor_user_id <> auth.uid() then
    raise exception 'Actor inválido para listar resúmenes vinculados.';
  end if;

  if p_year < 2000 or p_year > 2200 then
    raise exception 'El año solicitado es inválido.';
  end if;

  if p_month < 1 or p_month > 12 then
    raise exception 'El mes solicitado es inválido.';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_source_workspace_id
      and wm.user_id = p_actor_user_id
  ) then
    raise exception 'No tenés acceso al workspace origen.';
  end if;

  period_start := make_date(p_year, p_month, 1);
  period_end := (period_start + interval '1 month')::date;

  return query
  with linked_targets as (
    select
      wl.id as link_id,
      wl.source_workspace_id,
      wl.target_workspace_id,
      wl.visibility_mode
    from public.workspace_links wl
    join public.workspace_members target_membership
      on target_membership.workspace_id = wl.target_workspace_id
     and target_membership.user_id = p_actor_user_id
    where wl.source_workspace_id = p_source_workspace_id
      and wl.is_active = true
      and wl.visibility_mode = 'summary_only'
  ),
  totals as (
    select
      lt.link_id,
      coalesce(sum(case when tr.type = 'income' then tr.amount else 0 end), 0)::numeric as income_total,
      coalesce(sum(case when tr.type = 'expense' then tr.amount else 0 end), 0)::numeric as expense_total,
      coalesce(sum(case when tr.type = 'saving' then tr.amount else 0 end), 0)::numeric as saving_total
    from linked_targets lt
    left join public.transactions tr
      on tr.workspace_id = lt.target_workspace_id
     and coalesce(tr.effective_date, tr.transaction_date) >= period_start
     and coalesce(tr.effective_date, tr.transaction_date) < period_end
    group by lt.link_id
  )
  select
    lt.link_id,
    lt.source_workspace_id,
    lt.target_workspace_id,
    w.name as target_workspace_name,
    w.slug as target_workspace_slug,
    ws.currency_code as target_currency_code,
    lt.visibility_mode,
    p_year as period_year,
    p_month as period_month,
    t.income_total,
    t.expense_total,
    t.saving_total,
    (t.income_total - t.expense_total - t.saving_total)::numeric as balance_total
  from linked_targets lt
  join totals t
    on t.link_id = lt.link_id
  join public.workspaces w
    on w.id = lt.target_workspace_id
  join public.workspace_settings ws
    on ws.workspace_id = lt.target_workspace_id
  order by lower(w.name), lt.link_id;
end;
$$;

revoke all on function app_private.list_workspace_links_internal(uuid, uuid) from public;
grant execute on function app_private.list_workspace_links_internal(uuid, uuid) to authenticated;

revoke all on function app_private.create_workspace_link_internal(uuid, uuid, text, uuid) from public;
grant execute on function app_private.create_workspace_link_internal(uuid, uuid, text, uuid) to authenticated;

revoke all on function app_private.deactivate_workspace_link_internal(uuid, uuid, uuid) from public;
grant execute on function app_private.deactivate_workspace_link_internal(uuid, uuid, uuid) to authenticated;

revoke all on function app_private.list_linked_workspace_summaries_internal(uuid, integer, integer, uuid) from public;
grant execute on function app_private.list_linked_workspace_summaries_internal(uuid, integer, integer, uuid) to authenticated;

create or replace function public.list_workspace_links(p_source_workspace_id uuid)
returns table (
  link_id uuid,
  source_workspace_id uuid,
  target_workspace_id uuid,
  target_workspace_name text,
  target_workspace_slug text,
  target_currency_code text,
  visibility_mode text,
  is_active boolean,
  has_target_access boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
set search_path = public, app_private
as $$
  select *
  from app_private.list_workspace_links_internal(p_source_workspace_id, auth.uid());
$$;

create or replace function public.create_workspace_link(
  p_source_workspace_id uuid,
  p_target_workspace_id uuid,
  p_visibility_mode text default 'summary_only'
)
returns table (
  link_id uuid,
  source_workspace_id uuid,
  target_workspace_id uuid,
  target_workspace_name text,
  target_workspace_slug text,
  target_currency_code text,
  visibility_mode text,
  is_active boolean,
  has_target_access boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
set search_path = public, app_private
as $$
  select *
  from app_private.create_workspace_link_internal(
    p_source_workspace_id,
    p_target_workspace_id,
    p_visibility_mode,
    auth.uid()
  );
$$;

create or replace function public.deactivate_workspace_link(
  p_source_workspace_id uuid,
  p_link_id uuid
)
returns table (
  link_id uuid,
  source_workspace_id uuid,
  target_workspace_id uuid,
  target_workspace_name text,
  target_workspace_slug text,
  target_currency_code text,
  visibility_mode text,
  is_active boolean,
  has_target_access boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
set search_path = public, app_private
as $$
  select *
  from app_private.deactivate_workspace_link_internal(
    p_source_workspace_id,
    p_link_id,
    auth.uid()
  );
$$;

create or replace function public.list_linked_workspace_summaries(
  p_source_workspace_id uuid,
  p_year integer,
  p_month integer
)
returns table (
  link_id uuid,
  source_workspace_id uuid,
  target_workspace_id uuid,
  target_workspace_name text,
  target_workspace_slug text,
  target_currency_code text,
  visibility_mode text,
  period_year integer,
  period_month integer,
  income_total numeric,
  expense_total numeric,
  saving_total numeric,
  balance_total numeric
)
language sql
security invoker
set search_path = public, app_private
as $$
  select *
  from app_private.list_linked_workspace_summaries_internal(
    p_source_workspace_id,
    p_year,
    p_month,
    auth.uid()
  );
$$;

revoke all on function public.list_workspace_links(uuid) from public;
grant execute on function public.list_workspace_links(uuid) to authenticated;

revoke all on function public.create_workspace_link(uuid, uuid, text) from public;
grant execute on function public.create_workspace_link(uuid, uuid, text) to authenticated;

revoke all on function public.deactivate_workspace_link(uuid, uuid) from public;
grant execute on function public.deactivate_workspace_link(uuid, uuid) to authenticated;

revoke all on function public.list_linked_workspace_summaries(uuid, integer, integer) from public;
grant execute on function public.list_linked_workspace_summaries(uuid, integer, integer) to authenticated;

commit;
