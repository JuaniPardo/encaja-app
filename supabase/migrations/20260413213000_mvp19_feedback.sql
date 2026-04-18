begin;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  type text not null check (type in ('bug', 'suggestion', 'question', 'other')),
  message text not null,
  route text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'closed')),
  created_at timestamptz not null default now(),
  check (char_length(trim(message)) > 0)
);

create index if not exists idx_feedback_workspace_created_at
  on public.feedback (workspace_id, created_at desc);

create index if not exists idx_feedback_user_created_at
  on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_workspace_member" on public.feedback;
create policy "feedback_insert_workspace_member"
on public.feedback
for insert
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and (workspace_id is null or public.is_workspace_member(workspace_id))
);

commit;
