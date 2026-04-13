begin;

alter function public.set_current_timestamp_updated_at()
  set search_path = '';

alter function public.is_workspace_member(uuid)
  set search_path = '';

alter function public.budget_item_belongs_to_period_workspace()
  set search_path = '';

alter function public.ensure_transaction_workspace_consistency()
  set search_path = '';

alter function public.is_workspace_owner(uuid)
  set search_path = '';

alter function public.normalize_workspace_slug(text)
  set search_path = '';

alter function public.allocate_workspace_slug(text)
  set search_path = '';

alter function public.normalize_profile_email()
  set search_path = '';

alter function public.is_workspace_owner_or_admin(uuid)
  set search_path = '';

commit;
