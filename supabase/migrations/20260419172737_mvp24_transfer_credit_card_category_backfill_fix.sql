begin;

create temporary table tmp_workspaces_missing_new_credit_card_payment (
  workspace_id uuid primary key
) on commit drop;

insert into tmp_workspaces_missing_new_credit_card_payment (workspace_id)
select legacy.workspace_id
from public.categories legacy
join public.system_categories legacy_sc
  on legacy_sc.id = legacy.system_category_id
 and legacy_sc.key = 'transfer_card_payment'
where not exists (
  select 1
  from public.categories c
  join public.system_categories new_sc
    on new_sc.id = c.system_category_id
   and new_sc.key = 'credit_card_payment'
  where c.workspace_id = legacy.workspace_id
);

update public.categories c
set is_active = false
from public.system_categories legacy_sc
join tmp_workspaces_missing_new_credit_card_payment wm
  on true
where c.workspace_id = wm.workspace_id
  and legacy_sc.id = c.system_category_id
  and legacy_sc.key = 'transfer_card_payment';

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
  wm.workspace_id,
  case
    when exists (
      select 1
      from public.categories c
      where c.workspace_id = wm.workspace_id
        and lower(c.name) = lower(
          case
            when coalesce(p.preferred_language, 'es') = 'en' then new_sc.default_name_en
            else new_sc.default_name_es
          end
        )
    ) then
      case
        when coalesce(p.preferred_language, 'es') = 'en' then new_sc.default_name_en || ' (system)'
        else new_sc.default_name_es || ' (sistema)'
      end
    else
      case
        when coalesce(p.preferred_language, 'es') = 'en' then new_sc.default_name_en
        else new_sc.default_name_es
      end
  end as localized_name,
  new_sc.type,
  'system' as source,
  new_sc.id as system_category_id,
  new_sc.default_expense_behavior,
  true as is_active,
  false as is_editable,
  false as is_exceptional,
  null as warning_message,
  new_sc.default_sort_order,
  new_sc.default_color,
  null as icon,
  w.created_by
from tmp_workspaces_missing_new_credit_card_payment wm
join public.workspaces w
  on w.id = wm.workspace_id
left join public.profiles p
  on p.id = w.created_by
join public.system_categories new_sc
  on new_sc.key = 'credit_card_payment'
where not exists (
  select 1
  from public.categories c
  where c.workspace_id = wm.workspace_id
    and c.system_category_id = new_sc.id
)
on conflict do nothing;

commit;
