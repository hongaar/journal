-- Plugin-owned payloads keyed by entity (trace today; extend entity_type later).

create table public.plugin_entity_data (
  id uuid primary key default gen_random_uuid (),
  journal_id uuid not null references public.journals (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  plugin_type_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now (),
  constraint plugin_entity_data_entity_type_chk check (entity_type = 'trace'),
  constraint plugin_entity_data_unique_entity_plugin unique (entity_type, entity_id, plugin_type_id)
);

create index plugin_entity_data_journal_idx on public.plugin_entity_data (journal_id);
create index plugin_entity_data_lookup_idx on public.plugin_entity_data (entity_type, entity_id);

comment on table public.plugin_entity_data is
  'JSON payloads plugins attach to entities (e.g. trace-scoped Spotify stats).';

create or replace function public.plugin_entity_data_align_trace_journal()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  j_id uuid;
begin
  if new.entity_type = 'trace' then
    select t.journal_id into j_id from public.traces t where t.id = new.entity_id;
    if j_id is null then
      raise exception 'Trace not found for plugin_entity_data';
    end if;
    new.journal_id := j_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger plugin_entity_data_before_insert
  before insert on public.plugin_entity_data
  for each row execute function public.plugin_entity_data_align_trace_journal();

create trigger plugin_entity_data_before_update
  before update on public.plugin_entity_data
  for each row execute function public.plugin_entity_data_align_trace_journal();

create or replace function public.plugin_entity_data_delete_when_trace_deleted()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.plugin_entity_data
  where entity_type = 'trace' and entity_id = old.id;
  return old;
end;
$$;

create trigger traces_after_delete_plugin_entity_data
  after delete on public.traces
  for each row execute function public.plugin_entity_data_delete_when_trace_deleted();

alter table public.plugin_entity_data enable row level security;

create policy "plugin_entity_data_select_member"
  on public.plugin_entity_data for select
  to authenticated
  using (public.is_journal_member(journal_id));

create policy "plugin_entity_data_insert_member"
  on public.plugin_entity_data for insert
  to authenticated
  with check (public.is_journal_member(journal_id));

create policy "plugin_entity_data_update_member"
  on public.plugin_entity_data for update
  to authenticated
  using (public.is_journal_member(journal_id))
  with check (public.is_journal_member(journal_id));

create policy "plugin_entity_data_delete_member"
  on public.plugin_entity_data for delete
  to authenticated
  using (public.is_journal_member(journal_id));
