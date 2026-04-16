create or replace function public.list_linked_workspace_payment_method_balances(
  p_source_workspace_id uuid
)
returns table (
  link_id uuid,
  target_workspace_id uuid,
  target_workspace_name text,
  target_currency_code text,
  visibility_mode text,
  payment_method_id uuid,
  payment_method_name text,
  payment_method_type text,
  payment_method_balance numeric,
  workspace_total_balance numeric
)
language sql
security definer
set search_path = public
as $$
  with linked_workspaces as (
    select
      wl.id as link_id,
      wl.target_workspace_id,
      wl.visibility_mode,
      w.name as target_workspace_name
    from public.workspace_links wl
    join public.workspaces w
      on w.id = wl.target_workspace_id
    where wl.source_workspace_id = p_source_workspace_id
      and wl.is_active = true
  ),
  transaction_impact_by_method as (
    select
      t.payment_method_id,
      round(
        sum(
          case
            when t.type = 'income' then t.amount
            when t.type in ('expense', 'saving') then -t.amount
            when t.type = 'transfer' and t.direction = 'in' then t.amount
            when t.type = 'transfer' and t.direction = 'out' then -t.amount
            else 0
          end
        ),
        2
      ) as transaction_impact
    from public.transactions t
    where t.payment_method_id is not null
    group by t.payment_method_id
  ),
  payment_method_rows as (
    select
      lw.link_id,
      lw.target_workspace_id,
      lw.target_workspace_name,
      coalesce(ws.currency_code, 'ARS') as target_currency_code,
      upper(lw.visibility_mode) as visibility_mode,
      pm.id as payment_method_id,
      pm.name as payment_method_name,
      pm.type::text as payment_method_type,
      round(
        coalesce(pm.current_balance, 0) + coalesce(tim.transaction_impact, 0),
        2
      ) as payment_method_balance
    from linked_workspaces lw
    left join public.workspace_settings ws
      on ws.workspace_id = lw.target_workspace_id
    join public.payment_methods pm
      on pm.workspace_id = lw.target_workspace_id
    left join transaction_impact_by_method tim
      on tim.payment_method_id = pm.id
    where pm.is_active = true
      and pm.include_in_balance = true
  ),
  workspace_totals as (
    select
      pmr.target_workspace_id,
      round(sum(pmr.payment_method_balance), 2) as workspace_total_balance
    from payment_method_rows pmr
    group by pmr.target_workspace_id
  )
select
    pmr.link_id,
    pmr.target_workspace_id,
    pmr.target_workspace_name,
    pmr.target_currency_code,
    pmr.visibility_mode,
    pmr.payment_method_id,
    pmr.payment_method_name,
    pmr.payment_method_type,
    pmr.payment_method_balance,
    wt.workspace_total_balance
from payment_method_rows pmr
         join workspace_totals wt
              on wt.target_workspace_id = pmr.target_workspace_id
order by
    pmr.target_workspace_name,
    pmr.payment_method_name;
$$;