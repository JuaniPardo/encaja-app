begin;

insert into public.system_categories (
  key,
  type,
  default_name_es,
  default_name_en,
  default_expense_behavior,
  default_sort_order,
  default_color,
  is_active
)
values
  ('income_salary', 'income', 'Sueldo', 'Salary', null, 10, null, true),
  ('income_extra', 'income', 'Ingresos extra', 'Extra income', null, 20, null, true),

  ('expense_rent', 'expense', 'Alquiler', 'Rent', 'fixed', 10, null, true),
  ('expense_utilities', 'expense', 'Servicios', 'Utilities', 'fixed', 20, null, true),
  ('expense_groceries', 'expense', 'Alimentos', 'Groceries', 'variable', 30, null, true),
  ('expense_transport', 'expense', 'Transporte', 'Transport', 'variable', 40, null, true),
  ('expense_subscriptions', 'expense', 'Suscripciones', 'Subscriptions', 'fixed', 50, null, true),
  ('expense_entertainment', 'expense', 'Entretenimiento', 'Entertainment', 'variable', 60, null, true),
  ('expense_gifts', 'expense', 'Regalos', 'Gifts', 'variable', 70, null, true),
  ('expense_travel', 'expense', 'Viajes', 'Travel', 'variable', 80, null, true),
  ('expense_maintenance', 'expense', 'Mantenimiento', 'Maintenance', 'variable', 90, null, true),
  ('expense_health', 'expense', 'Salud', 'Health', 'variable', 100, null, true),
  ('expense_education', 'expense', 'Educación', 'Education', 'variable', 110, null, true),
  ('expense_insurance', 'expense', 'Seguros', 'Insurance', 'fixed', 120, null, true),
  ('expense_taxes', 'expense', 'Impuestos', 'Taxes', 'fixed', 130, null, true),
  ('expense_other', 'expense', 'Otros gastos', 'Other expenses', 'variable', 999, null, true),

  ('saving_monthly', 'saving', 'Ahorro mensual', 'Monthly savings', null, 10, null, true),
  ('transfer_internal', 'transfer', 'Transferencias internas', 'Internal transfers', null, 10, null, true)
on conflict (key) do update
set
  type = excluded.type,
  default_name_es = excluded.default_name_es,
  default_name_en = excluded.default_name_en,
  default_expense_behavior = excluded.default_expense_behavior,
  default_sort_order = excluded.default_sort_order,
  default_color = excluded.default_color,
  is_active = excluded.is_active;

commit;
