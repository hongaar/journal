-- Per-user global connector settings (enable/disable, OAuth tokens, API keys in config).
-- Journal-specific options remain in `journal_connectors.config`.

create table public.user_connectors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connector_type_id text not null references public.connector_types (id) on delete restrict,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  status public.connector_link_status not null default 'disabled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, connector_type_id)
);

create index user_connectors_user_idx on public.user_connectors (user_id);

alter table public.user_connectors enable row level security;

create policy "user_connectors_select_own"
  on public.user_connectors for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_connectors_insert_own"
  on public.user_connectors for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_connectors_update_own"
  on public.user_connectors for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_connectors_delete_own"
  on public.user_connectors for delete
  to authenticated
  using (user_id = auth.uid());

-- Journal owners who had a connector enabled on any journal: enable globally.
insert into public.user_connectors (user_id, connector_type_id, enabled, config, status, updated_at)
select distinct jm.user_id,
  jc.connector_type_id,
  true,
  '{}'::jsonb,
  jc.status,
  now()
from public.journal_connectors jc
join public.journal_members jm
  on jm.journal_id = jc.journal_id
 and jm.role = 'owner'::public.journal_member_role
where jc.enabled = true
on conflict (user_id, connector_type_id) do update set
  enabled = public.user_connectors.enabled or excluded.enabled,
  updated_at = now();
