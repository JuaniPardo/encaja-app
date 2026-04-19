begin;

alter table public.workspaces
  add column if not exists is_demo boolean not null default false;

create unique index if not exists idx_workspaces_single_demo_per_creator
  on public.workspaces(created_by)
  where is_demo = true;

create or replace function public.create_workspace_with_defaults(
  p_workspace_name text,
  p_is_demo boolean default false
)
returns table (
  workspace_id uuid,
  workspace_name text,
  workspace_slug text,
  workspace_is_demo boolean,
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
  inserted_categories_count integer;
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

  insert into public.workspaces (name, slug, created_by, is_demo)
  values (
    normalized_workspace_name,
    created_workspace_slug,
    current_user_id,
    coalesce(p_is_demo, false)
  )
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

  insert into public.categories (
    workspace_id,
    name,
    type,
    expense_behavior,
    is_active,
    is_editable,
    is_exceptional,
    warning_message,
    sort_order,
    color,
    icon,
    created_by,
    source,
    system_category_id
  )
  select
    created_workspace_id,
    case
      when preferred_language = 'en' then sc.default_name_en
      else sc.default_name_es
    end as localized_name,
    sc.type,
    sc.default_expense_behavior,
    sc.is_active,
    false as is_editable,
    coalesce(sc.is_exceptional, false),
    case
      when coalesce(sc.is_exceptional, false) = true then
        case
          when preferred_language = 'en' then sc.warning_message_en
          else sc.warning_message_es
        end
      else null
    end as warning_message,
    sc.default_sort_order,
    sc.default_color,
    null,
    current_user_id,
    'system',
    sc.id
  from public.system_categories sc
  where sc.is_active = true
  order by sc.type, sc.default_sort_order nulls last, sc.default_name_es;

  get diagnostics inserted_categories_count = row_count;
  if coalesce(inserted_categories_count, 0) = 0 then
    raise exception 'No existen categorías del sistema activas para inicializar el workspace.';
  end if;

  return query
  select
    w.id,
    w.name,
    w.slug,
    w.is_demo,
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
