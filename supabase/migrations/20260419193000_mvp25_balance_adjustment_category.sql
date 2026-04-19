begin;

update public.system_categories
set
  key = 'balance_adjustment',
  default_name_es = 'Ajuste de balance',
  default_name_en = 'Balance adjustment',
  default_expense_behavior = 'variable',
  default_sort_order = 998,
  default_color = null,
  is_active = true,
  is_exceptional = true,
  warning_message_es =
    'Usala para realinear tu balance cuando te falten registros. Para mejores resultados, reservála para casos excepcionales.',
  warning_message_en =
    'Use this to realign your balance when records are missing. For better results, reserve it for exceptional cases.'
where key = 'expense_manual_adjustment'
  and not exists (
    select 1
    from public.system_categories sc
    where sc.key = 'balance_adjustment'
  );

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
  'balance_adjustment',
  'expense',
  'Ajuste de balance',
  'Balance adjustment',
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

update public.system_categories
set is_active = false
where key = 'expense_manual_adjustment';

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
  'system',
  sc.id,
  sc.default_expense_behavior,
  true,
  false,
  true,
  case
    when coalesce(p.preferred_language, 'es') = 'en' then sc.warning_message_en
    else sc.warning_message_es
  end,
  sc.default_sort_order,
  sc.default_color,
  null,
  w.created_by
from public.workspaces w
left join public.profiles p
  on p.id = w.created_by
join public.system_categories sc
  on sc.key = 'balance_adjustment'
where not exists (
  select 1
  from public.categories c
  where c.workspace_id = w.id
    and c.system_category_id = sc.id
);

commit;
