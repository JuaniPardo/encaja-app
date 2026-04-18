begin;

-- Optional legacy backfill:
-- Maps common custom category names to system categories for better historical analytics.
with alias_map(system_key, type, alias) as (
  values
    ('income_salary', 'income', 'sueldo'),
    ('income_salary', 'income', 'salary'),
    ('income_salary', 'income', 'salario'),
    ('income_extra', 'income', 'ingresos extra'),
    ('income_extra', 'income', 'ingreso extra'),
    ('income_extra', 'income', 'extra income'),

    ('expense_rent', 'expense', 'alquiler'),
    ('expense_rent', 'expense', 'rent'),
    ('expense_rent', 'expense', 'renta'),
    ('expense_utilities', 'expense', 'servicios'),
    ('expense_utilities', 'expense', 'utilities'),
    ('expense_utilities', 'expense', 'servicios publicos'),
    ('expense_utilities', 'expense', 'servicios públicos'),
    ('expense_groceries', 'expense', 'alimentos'),
    ('expense_groceries', 'expense', 'groceries'),
    ('expense_groceries', 'expense', 'supermercado'),
    ('expense_transport', 'expense', 'transporte'),
    ('expense_transport', 'expense', 'transport'),
    ('expense_transport', 'expense', 'movilidad'),
    ('expense_subscriptions', 'expense', 'suscripciones'),
    ('expense_subscriptions', 'expense', 'subscriptions'),
    ('expense_subscriptions', 'expense', 'streaming'),

    ('expense_entertainment', 'expense', 'entretenimiento'),
    ('expense_entertainment', 'expense', 'entertainment'),
    ('expense_entertainment', 'expense', 'ocio'),
    ('expense_gifts', 'expense', 'regalos'),
    ('expense_gifts', 'expense', 'gifts'),
    ('expense_travel', 'expense', 'viajes'),
    ('expense_travel', 'expense', 'travel'),
    ('expense_maintenance', 'expense', 'mantenimiento'),
    ('expense_maintenance', 'expense', 'maintenance'),
    ('expense_maintenance', 'expense', 'reparaciones'),
    ('expense_health', 'expense', 'salud'),
    ('expense_health', 'expense', 'health'),
    ('expense_health', 'expense', 'medico'),
    ('expense_health', 'expense', 'médico'),
    ('expense_health', 'expense', 'farmacia'),
    ('expense_education', 'expense', 'educacion'),
    ('expense_education', 'expense', 'educación'),
    ('expense_education', 'expense', 'education'),
    ('expense_education', 'expense', 'cursos'),
    ('expense_insurance', 'expense', 'seguros'),
    ('expense_insurance', 'expense', 'insurance'),
    ('expense_taxes', 'expense', 'impuestos'),
    ('expense_taxes', 'expense', 'taxes'),
    ('expense_other', 'expense', 'otros gastos'),
    ('expense_other', 'expense', 'otros'),
    ('expense_other', 'expense', 'other expenses'),
    ('expense_other', 'expense', 'other'),

    ('saving_monthly', 'saving', 'ahorro mensual'),
    ('saving_monthly', 'saving', 'monthly savings'),
    ('saving_monthly', 'saving', 'ahorro'),
    ('saving_monthly', 'saving', 'savings'),

    ('transfer_internal', 'transfer', 'transferencias internas'),
    ('transfer_internal', 'transfer', 'transferencia interna'),
    ('transfer_internal', 'transfer', 'internal transfers'),
    ('transfer_internal', 'transfer', 'internal transfer')
),
system_targets as (
  select
    sc.id as system_category_id,
    sc.type,
    sc.default_expense_behavior,
    lower(regexp_replace(trim(am.alias), '\s+', ' ', 'g')) as alias_normalized
  from alias_map am
  join public.system_categories sc
    on sc.key = am.system_key
   and sc.type = am.type
),
candidates as (
  select
    c.id as category_id,
    c.workspace_id,
    st.system_category_id,
    st.default_expense_behavior,
    row_number() over (
      partition by c.workspace_id, st.system_category_id
      order by c.created_at asc, c.id asc
    ) as rn
  from public.categories c
  join system_targets st
    on st.type = c.type
   and lower(regexp_replace(trim(c.name), '\s+', ' ', 'g')) = st.alias_normalized
  where c.source = 'custom'
    and c.system_category_id is null
    and not exists (
      select 1
      from public.categories c2
      where c2.workspace_id = c.workspace_id
        and c2.system_category_id = st.system_category_id
    )
)
update public.categories c
set
  source = 'system',
  system_category_id = cand.system_category_id,
  expense_behavior = case
    when c.type = 'expense' then coalesce(c.expense_behavior, cand.default_expense_behavior)
    else null
  end
from candidates cand
where c.id = cand.category_id
  and cand.rn = 1;

commit;
