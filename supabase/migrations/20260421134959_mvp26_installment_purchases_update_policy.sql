begin;

drop policy if exists "installment_purchases_update_member" on public.installment_purchases;
create policy "installment_purchases_update_member"
on public.installment_purchases
for update
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.payment_methods pm
    where pm.id = installment_purchases.payment_method_id
      and pm.workspace_id = installment_purchases.workspace_id
      and pm.type = 'credit_card'
  )
  and exists (
    select 1
    from public.categories c
    where c.id = installment_purchases.category_id
      and c.workspace_id = installment_purchases.workspace_id
      and c.type = 'expense'
  )
);

commit;
