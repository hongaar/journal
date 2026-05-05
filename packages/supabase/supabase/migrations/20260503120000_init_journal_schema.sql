-- Journal app: profiles, journals, members, traces, tags, photos, connectors + RLS + storage bucket.

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type public.journal_member_role as enum ('owner', 'editor', 'viewer');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.connector_link_status as enum ('disabled', 'pending', 'error', 'connected');
exception
  when duplicate_object then null;
end $$;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  default_journal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Journals
create table public.journals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  is_personal boolean not null default false,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index journals_created_by_idx on public.journals (created_by_user_id);

-- Journal members (must exist before is_journal_member(), which references this table)
create table public.journal_members (
  journal_id uuid not null references public.journals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.journal_member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (journal_id, user_id)
);

create index journal_members_user_idx on public.journal_members (user_id);

-- Bypasses RLS on journal_members to avoid recursive policy checks.
create or replace function public.is_journal_member(p_journal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.journal_members jm
    where jm.journal_id = p_journal_id
      and jm.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_journal_member(uuid) from public;
grant execute on function public.is_journal_member(uuid) to authenticated, service_role;

alter table public.journals enable row level security;

create policy "journals_select_member"
  on public.journals for select
  to authenticated
  using (public.is_journal_member(id));

create policy "journals_insert_self_created"
  on public.journals for insert
  to authenticated
  with check (created_by_user_id = (select auth.uid()));

create policy "journals_update_owner"
  on public.journals for update
  to authenticated
  using (
    exists (
      select 1 from public.journal_members jm
      where jm.journal_id = journals.id
        and jm.user_id = (select auth.uid())
        and jm.role = 'owner'::public.journal_member_role
    )
  )
  with check (
    exists (
      select 1 from public.journal_members jm
      where jm.journal_id = journals.id
        and jm.user_id = (select auth.uid())
        and jm.role = 'owner'::public.journal_member_role
    )
  );

alter table public.journal_members enable row level security;

create policy "journal_members_select_member"
  on public.journal_members for select
  to authenticated
  using (public.is_journal_member(journal_id));

-- Add yourself when you created the journal, or when already a member (future invites).
create policy "journal_members_insert_self"
  on public.journal_members for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.journals j
      where j.id = journal_members.journal_id
        and j.created_by_user_id = (select auth.uid())
    )
  );

create policy "journal_members_delete_self"
  on public.journal_members for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- FK from profiles.default_journal_id after journals exist
alter table public.profiles
  add constraint profiles_default_journal_fk
  foreign key (default_journal_id) references public.journals (id) on delete set null;

-- Traces
create table public.traces (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals (id) on delete cascade,
  title text,
  description text,
  lat double precision not null,
  lng double precision not null,
  visited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index traces_journal_idx on public.traces (journal_id);
create index traces_journal_visited_idx on public.traces (journal_id, visited_at desc);

alter table public.traces enable row level security;

create policy "traces_select_member"
  on public.traces for select
  to authenticated
  using (public.is_journal_member(journal_id));

create policy "traces_insert_member"
  on public.traces for insert
  to authenticated
  with check (public.is_journal_member(journal_id));

create policy "traces_update_member"
  on public.traces for update
  to authenticated
  using (public.is_journal_member(journal_id))
  with check (public.is_journal_member(journal_id));

create policy "traces_delete_member"
  on public.traces for delete
  to authenticated
  using (public.is_journal_member(journal_id));

-- Tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals (id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  icon_emoji text not null default '📍',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journal_id, name)
);

create index tags_journal_idx on public.tags (journal_id);

alter table public.tags enable row level security;

create policy "tags_select_member"
  on public.tags for select
  to authenticated
  using (public.is_journal_member(journal_id));

create policy "tags_write_member"
  on public.tags for insert
  to authenticated
  with check (public.is_journal_member(journal_id));

create policy "tags_update_member"
  on public.tags for update
  to authenticated
  using (public.is_journal_member(journal_id))
  with check (public.is_journal_member(journal_id));

create policy "tags_delete_member"
  on public.tags for delete
  to authenticated
  using (public.is_journal_member(journal_id));

-- Trace tags
create table public.trace_tags (
  trace_id uuid not null references public.traces (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (trace_id, tag_id)
);

alter table public.trace_tags enable row level security;

create or replace function public.trace_journal_id(p_trace_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select journal_id from public.traces where id = p_trace_id;
$$;

create policy "trace_tags_select_member"
  on public.trace_tags for select
  to authenticated
  using (public.is_journal_member(public.trace_journal_id(trace_id)));

create policy "trace_tags_write_member"
  on public.trace_tags for insert
  to authenticated
  with check (
    public.is_journal_member(public.trace_journal_id(trace_id))
    and exists (
      select 1 from public.tags t
      where t.id = tag_id and t.journal_id = public.trace_journal_id(trace_id)
    )
  );

create policy "trace_tags_delete_member"
  on public.trace_tags for delete
  to authenticated
  using (public.is_journal_member(public.trace_journal_id(trace_id)));

-- Photos
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals (id) on delete cascade,
  trace_id uuid not null references public.traces (id) on delete cascade,
  storage_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index photos_trace_idx on public.photos (trace_id);

create or replace function public.photos_set_journal_from_trace()
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
  return new;
end;
$$;

create trigger photos_set_journal_before_insert
  before insert on public.photos
  for each row execute function public.photos_set_journal_from_trace();

create trigger photos_set_journal_before_update
  before update of trace_id on public.photos
  for each row execute function public.photos_set_journal_from_trace();

alter table public.photos enable row level security;

create policy "photos_select_member"
  on public.photos for select
  to authenticated
  using (public.is_journal_member(journal_id));

create policy "photos_write_member"
  on public.photos for insert
  to authenticated
  with check (public.is_journal_member(journal_id));

create policy "photos_update_member"
  on public.photos for update
  to authenticated
  using (public.is_journal_member(journal_id))
  with check (public.is_journal_member(journal_id));

create policy "photos_delete_member"
  on public.photos for delete
  to authenticated
  using (public.is_journal_member(journal_id));

-- Connector catalog
create table public.connector_types (
  id text primary key,
  display_name text not null,
  description text
);

alter table public.connector_types enable row level security;

create policy "connector_types_select_authenticated"
  on public.connector_types for select
  to authenticated
  using (true);

insert into public.connector_types (id, display_name, description) values
  ('google_maps', 'Google Maps', 'Sync traces with Google Maps (coming soon).'),
  ('osmand', 'OsmAnd', 'Sync traces with OsmAnd (coming soon).'),
  ('google_photos', 'Google Photos', 'Link photos from Google Photos (coming soon).'),
  ('immich', 'Immich', 'Link photos from Immich (coming soon).')
on conflict (id) do nothing;

-- Per-journal connector settings
create table public.journal_connectors (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals (id) on delete cascade,
  connector_type_id text not null references public.connector_types (id) on delete restrict,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  status public.connector_link_status not null default 'disabled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journal_id, connector_type_id)
);

create index journal_connectors_journal_idx on public.journal_connectors (journal_id);

alter table public.journal_connectors enable row level security;

create policy "journal_connectors_select_member"
  on public.journal_connectors for select
  to authenticated
  using (public.is_journal_member(journal_id));

create policy "journal_connectors_write_member"
  on public.journal_connectors for insert
  to authenticated
  with check (public.is_journal_member(journal_id));

create policy "journal_connectors_update_member"
  on public.journal_connectors for update
  to authenticated
  using (public.is_journal_member(journal_id))
  with check (public.is_journal_member(journal_id));

create policy "journal_connectors_delete_member"
  on public.journal_connectors for delete
  to authenticated
  using (public.is_journal_member(journal_id));

-- Bootstrap new auth user: profile + personal journal + membership + default_journal
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_journal_id uuid;
  display text;
begin
  display := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Traveler');

  insert into public.profiles (id, display_name)
  values (new.id, display);

  insert into public.journals (name, is_personal, created_by_user_id)
  values ('My journal', true, new.id)
  returning id into new_journal_id;

  insert into public.journal_members (journal_id, user_id, role)
  values (new_journal_id, new.id, 'owner');

  update public.profiles
  set default_journal_id = new_journal_id
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage: private bucket for trace photos
insert into storage.buckets (id, name, public)
values ('trace-photos', 'trace-photos', false)
on conflict (id) do nothing;

create policy "trace_photos_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'trace-photos'
    and public.is_journal_member((storage.foldername(name))[1]::uuid)
  );

create policy "trace_photos_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'trace-photos'
    and owner = (select auth.uid())
    and public.is_journal_member((storage.foldername(name))[1]::uuid)
  );

create policy "trace_photos_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'trace-photos'
    and owner = (select auth.uid())
    and public.is_journal_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'trace-photos'
    and owner = (select auth.uid())
  );

create policy "trace_photos_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'trace-photos'
    and owner = (select auth.uid())
    and public.is_journal_member((storage.foldername(name))[1]::uuid)
  );
