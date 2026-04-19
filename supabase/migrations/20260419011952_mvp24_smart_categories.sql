begin;

-- 1) Extend system category contract with exceptional metadata.
alter table public.system_categories
  add column if not exists is_exceptional boolean not null default false,
  add column if not exists warning_message_es text,
  add column if not exists warning_message_en text;

alter table public.system_categories
  drop constraint if exists system_categories_warning_message_presence_check;

alter table public.system_categories
  add constraint system_categories_warning_message_presence_check
  check (
    (is_exceptional = false and warning_message_es is null and warning_message_en is null)
    or (
      is_exceptional = true
      and warning_message_es is not null
      and btrim(warning_message_es) <> ''
      and warning_message_en is not null
      and btrim(warning_message_en) <> ''
    )
  );

-- 2) Extend workspace category instances with editability + warning fields.
alter table public.categories
  add column if not exists is_editable boolean not null default true,
  add column if not exists is_exceptional boolean not null default false,
  add column if not exists warning_message text;

-- Seed first exceptional category.
insert into public.system_categories (
  key,
  type,
  default_name_es,
  default_name_en,
  default_expense_behavior,
  default_sort_order,
  default_color,
  is_active,
  is_exceptional,
  warning_message_es,
  warning_message_en
)
values (
  'expense_manual_adjustment',
  'expense',
  'Ajuste manual',
  'Manual adjustment',
  'variable',
  998,
  null,
  true,
  true,
  'Usala para realinear tu balance cuando te falten registros. Para mejores resultados, reservála para casos excepcionales.',
  'Use this to realign your balance when records are missing. For better results, reserve it for exceptional cases.'
)
on conflict (key) do update
set
  type = excluded.type,
  default_name_es = excluded.default_name_es,
  default_name_en = excluded.default_name_en,
  default_expense_behavior = excluded.default_expense_behavior,
  default_sort_order = excluded.default_sort_order,
  default_color = excluded.default_color,
  is_active = excluded.is_active,
  is_exceptional = excluded.is_exceptional,
  warning_message_es = excluded.warning_message_es,
  warning_message_en = excluded.warning_message_en;

-- Backfill category contract fields with canonical system metadata.
update public.categories
set
  is_editable = true,
  is_exceptional = false,
  warning_message = null
where source = 'custom';

update public.categories c
set
  name = case
    when coalesce(
      (
        select p.preferred_language
        from public.profiles p
        where p.id = c.created_by
      ),
      'es'
    ) = 'en' then sc.default_name_en
    else sc.default_name_es
  end,
  is_editable = false,
  is_exceptional = coalesce(sc.is_exceptional, false),
  warning_message = case
    when coalesce(sc.is_exceptional, false) = true then
      case
        when coalesce(
          (
            select p.preferred_language
            from public.profiles p
            where p.id = c.created_by
          ),
          'es'
        ) = 'en' then sc.warning_message_en
        else sc.warning_message_es
      end
    else null
  end
from public.system_categories sc
where c.source = 'system'
  and c.system_category_id = sc.id;

-- Insert missing exceptional system category instance in existing workspaces.
insert into public.categories (
  workspace_id,
  name,
  type,
  source,
  system_category_id,
  expense_behavior,
  is_active,
  is_editable,
  is_exceptional,
  warning_message,
  sort_order,
  color,
  icon,
  created_by
)
select
  w.id,
  case
    when coalesce(p.preferred_language, 'es') = 'en' then sc.default_name_en
    else sc.default_name_es
  end as localized_name,
  sc.type,
  'system' as source,
  sc.id as system_category_id,
  sc.default_expense_behavior,
  sc.is_active,
  false as is_editable,
  sc.is_exceptional,
  case
    when coalesce(p.preferred_language, 'es') = 'en' then sc.warning_message_en
    else sc.warning_message_es
  end as warning_message,
  sc.default_sort_order,
  sc.default_color,
  null as icon,
  w.created_by
from public.workspaces w
left join public.profiles p
  on p.id = w.created_by
join public.system_categories sc
  on sc.key = 'expense_manual_adjustment'
where not exists (
  select 1
  from public.categories c
  where c.workspace_id = w.id
    and c.system_category_id = sc.id
);

alter table public.categories
  drop constraint if exists categories_source_editable_consistency_check;

alter table public.categories
  add constraint categories_source_editable_consistency_check
  check (
    (source = 'system' and is_editable = false)
    or (source = 'custom' and is_editable = true)
  );

alter table public.categories
  drop constraint if exists categories_custom_exceptional_forbidden_check;

alter table public.categories
  add constraint categories_custom_exceptional_forbidden_check
  check (source = 'system' or is_exceptional = false);

alter table public.categories
  drop constraint if exists categories_exceptional_warning_consistency_check;

alter table public.categories
  add constraint categories_exceptional_warning_consistency_check
  check (
    (is_exceptional = false and warning_message is null)
    or (
      is_exceptional = true
      and warning_message is not null
      and btrim(warning_message) <> ''
    )
  );

create or replace function public.enforce_category_semantic_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_editable = false then
    if new.name is distinct from old.name then
      raise exception 'System category name is immutable.';
    end if;

    if new.type is distinct from old.type then
      raise exception 'System category type is immutable.';
    end if;

    if new.source is distinct from old.source then
      raise exception 'System category source is immutable.';
    end if;

    if new.system_category_id is distinct from old.system_category_id then
      raise exception 'System category semantic key is immutable.';
    end if;

    if new.is_editable is distinct from old.is_editable then
      raise exception 'System category editability is immutable.';
    end if;

    if new.is_exceptional is distinct from old.is_exceptional then
      raise exception 'System category exceptional behavior is immutable.';
    end if;

    if new.warning_message is distinct from old.warning_message then
      raise exception 'System category warning message is immutable.';
    end if;

    if old.is_exceptional = true and new.is_active = false then
      raise exception 'Exceptional system categories must remain active.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_category_semantic_immutability on public.categories;
create trigger enforce_category_semantic_immutability
before update on public.categories
for each row
execute function public.enforce_category_semantic_immutability();

-- Ensure future workspaces inherit smart-category metadata from the system catalog.
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
