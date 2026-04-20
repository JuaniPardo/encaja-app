begin;

drop policy if exists "payment_methods_delete_owner" on public.payment_methods;
drop policy if exists "payment_methods_delete_owner_admin" on public.payment_methods;
drop policy if exists "payment_methods_delete_member" on public.payment_methods;

create policy "payment_methods_delete_owner"
on public.payment_methods
for delete
using (
  public.is_workspace_owner(workspace_id)
  and not exists (
    select 1
    from public.transactions t
    where t.workspace_id = payment_methods.workspace_id
      and t.payment_method_id = payment_methods.id
  )
);

commit;
