begin;

create index if not exists idx_transactions_workspace_effective_date_method
  on public.transactions (workspace_id, effective_date, payment_method_id)
  where effective_date is not null;

create index if not exists idx_transactions_workspace_transaction_date_method
  on public.transactions (workspace_id, transaction_date, payment_method_id);

create index if not exists idx_transactions_workspace_type_direction_method
  on public.transactions (workspace_id, type, direction, payment_method_id);

create index if not exists idx_transactions_workspace_installment_effective
  on public.transactions (workspace_id, installment_purchase_id, effective_date)
  where installment_purchase_id is not null and effective_date is not null;

commit;
