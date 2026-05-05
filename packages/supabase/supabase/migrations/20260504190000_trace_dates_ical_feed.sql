-- Traces: date-only start + optional inclusive end (for iCalendar and UI).
alter table public.traces add column date date;
alter table public.traces add column end_date date;

update public.traces
set date = (visited_at at time zone 'UTC')::date;

alter table public.traces
  alter column date set default (timezone('UTC', now()))::date,
  alter column date set not null;

alter table public.traces
  add constraint traces_end_date_gte_date
  check (end_date is null or end_date >= date);

drop index if exists public.traces_journal_visited_idx;

alter table public.traces drop column visited_at;

create index if not exists traces_journal_date_idx
  on public.traces (journal_id, date desc);

comment on column public.traces.date is 'Start calendar day (UTC date) for the trace.';
comment on column public.traces.end_date is 'Optional inclusive end calendar day; must be >= date.';

-- Opaque token for unguessable public iCalendar URLs (resolved in Edge Function).
create table public.journal_ical_feed_tokens (
  journal_id uuid primary key references public.journals (id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

create index journal_ical_feed_tokens_token_idx on public.journal_ical_feed_tokens (token);

alter table public.journal_ical_feed_tokens enable row level security;

create policy "journal_ical_feed_tokens_select_member"
  on public.journal_ical_feed_tokens for select
  to authenticated
  using (public.is_journal_member(journal_id));

create policy "journal_ical_feed_tokens_insert_member"
  on public.journal_ical_feed_tokens for insert
  to authenticated
  with check (public.is_journal_member(journal_id));

create policy "journal_ical_feed_tokens_update_member"
  on public.journal_ical_feed_tokens for update
  to authenticated
  using (public.is_journal_member(journal_id))
  with check (public.is_journal_member(journal_id));

create policy "journal_ical_feed_tokens_delete_member"
  on public.journal_ical_feed_tokens for delete
  to authenticated
  using (public.is_journal_member(journal_id));

update public.connector_types
set description = 'Publish this journal''s traces as a subscribe-only iCalendar (.ics) feed.'
where id = 'ical';
