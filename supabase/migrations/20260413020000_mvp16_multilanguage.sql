begin;

alter table public.profiles
  add column if not exists preferred_language text;

update public.profiles
set preferred_language = lower(preferred_language)
where preferred_language is not null;

update public.profiles
set preferred_language = null
where preferred_language is not null
  and preferred_language not in ('es', 'en');

alter table public.profiles
  drop constraint if exists profiles_preferred_language_check;

alter table public.profiles
  add constraint profiles_preferred_language_check
  check (preferred_language is null or preferred_language in ('es', 'en'));

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
  preferred_language text;
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

  select p.preferred_language
  into preferred_language
  from public.profiles p
  where p.id = current_user_id;

  preferred_language := case
    when preferred_language in ('es', 'en') then preferred_language
    else 'es'
  end;

  if preferred_language = 'en' then
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
      (created_workspace_id, 'Salary', 'income', null, true, 10, null, null, current_user_id),
      (created_workspace_id, 'Extra income', 'income', null, true, 20, null, null, current_user_id),
      (created_workspace_id, 'Rent', 'expense', 'fixed', true, 10, null, null, current_user_id),
      (created_workspace_id, 'Utilities', 'expense', 'fixed', true, 20, null, null, current_user_id),
      (created_workspace_id, 'Groceries', 'expense', 'variable', true, 30, null, null, current_user_id),
      (created_workspace_id, 'Transport', 'expense', 'variable', true, 40, null, null, current_user_id),
      (created_workspace_id, 'Monthly savings', 'saving', null, true, 10, null, null, current_user_id);
  else
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
  end if;

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

commit;
