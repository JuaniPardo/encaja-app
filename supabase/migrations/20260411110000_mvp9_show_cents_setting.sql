begin;

alter table public.workspace_settings
add column if not exists show_cents boolean not null default false;

commit;
