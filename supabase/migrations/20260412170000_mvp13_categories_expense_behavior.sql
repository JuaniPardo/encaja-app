begin;

alter table public.categories
  add column if not exists expense_behavior text;

update public.categories
set expense_behavior = 'variable'
where type = 'expense'
  and expense_behavior is null;

update public.categories
set expense_behavior = null
where type in ('income', 'saving');

alter table public.categories
  drop constraint if exists categories_expense_behavior_check;

alter table public.categories
  add constraint categories_expense_behavior_check check (
    (type = 'expense' and expense_behavior in ('fixed', 'variable'))
    or (type in ('income', 'saving') and expense_behavior is null)
  );

create index if not exists idx_categories_workspace_expense_behavior
  on public.categories(workspace_id, type, expense_behavior);

commit;
