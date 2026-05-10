-- External links attached to a trace (with display metadata: title + favicon).

create table public.trace_links (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals (id) on delete cascade,
  trace_id uuid not null references public.traces (id) on delete cascade,
  url text not null,
  title text,
  favicon_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trace_links_trace_idx on public.trace_links (trace_id);
create index trace_links_journal_idx on public.trace_links (journal_id);

alter table public.trace_links
  add constraint trace_links_url_scheme_chk
  check (url ~* '^https?://');

-- Auto-populate journal_id from the parent trace (mirrors `photos` pattern).
create or replace function public.trace_links_set_journal_from_trace()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  j_id uuid;
begin
  select t.journal_id into j_id from public.traces t where t.id = new.trace_id;
  if j_id is null then
    raise exception 'Trace not found';
  end if;
  new.journal_id := j_id;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trace_links_set_journal_before_insert
  before insert on public.trace_links
  for each row execute function public.trace_links_set_journal_from_trace();

create trigger trace_links_set_journal_before_update
  before update on public.trace_links
  for each row execute function public.trace_links_set_journal_from_trace();

alter table public.trace_links enable row level security;

create policy "trace_links_select_member"
  on public.trace_links for select
  to authenticated
  using (public.is_journal_member(journal_id));

create policy "trace_links_insert_member"
  on public.trace_links for insert
  to authenticated
  with check (public.is_journal_member(journal_id));

create policy "trace_links_update_member"
  on public.trace_links for update
  to authenticated
  using (public.is_journal_member(journal_id))
  with check (public.is_journal_member(journal_id));

create policy "trace_links_delete_member"
  on public.trace_links for delete
  to authenticated
  using (public.is_journal_member(journal_id));

comment on table public.trace_links is
  'External URLs attached to a trace, with optional auto-imported title and favicon.';
comment on column public.trace_links.title is
  'Page title fetched from the URL when added (best-effort, may be edited).';
comment on column public.trace_links.favicon_url is
  'Resolved favicon URL discovered when the link was added.';
