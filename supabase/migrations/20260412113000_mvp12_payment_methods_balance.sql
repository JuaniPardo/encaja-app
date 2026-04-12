begin;

alter table public.payment_methods
  add column if not exists current_balance numeric(14, 2) not null default 0,
  add column if not exists include_in_balance boolean not null default true;

create index if not exists idx_payment_methods_workspace_balance_scope
  on public.payment_methods(workspace_id, is_active, include_in_balance);

commit;
