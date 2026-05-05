-- Sharing: invitations, member management, ownership transfer (clears connectors).
-- Notifications (in-app), profile notification preferences.
-- Tighten RLS: viewers read-only; only owners manage connectors.

-- ---------------------------------------------------------------------------
-- Helpers: edit capability + journal owner check (invoker-safe, no recursion)
-- ---------------------------------------------------------------------------

create or replace function public.journal_member_can_edit(p_journal_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.journal_members jm
    where jm.journal_id = p_journal_id
      and jm.user_id = (select auth.uid())
      and jm.role in ('owner'::public.journal_member_role, 'editor'::public.journal_member_role)
  );
$$;

create or replace function public.is_journal_owner(p_journal_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.journal_members jm
    where jm.journal_id = p_journal_id
      and jm.user_id = (select auth.uid())
      and jm.role = 'owner'::public.journal_member_role
  );
$$;

revoke all on function public.journal_member_can_edit(uuid) from public;
grant execute on function public.journal_member_can_edit(uuid) to authenticated;

revoke all on function public.is_journal_owner(uuid) from public;
grant execute on function public.is_journal_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tighten write policies: contributors (editor) and owners edit content
-- ---------------------------------------------------------------------------

drop policy if exists "traces_insert_member" on public.traces;
create policy "traces_insert_member"
  on public.traces for insert
  to authenticated
  with check (public.journal_member_can_edit(journal_id));

drop policy if exists "traces_update_member" on public.traces;
create policy "traces_update_member"
  on public.traces for update
  to authenticated
  using (public.journal_member_can_edit(journal_id))
  with check (public.journal_member_can_edit(journal_id));

drop policy if exists "traces_delete_member" on public.traces;
create policy "traces_delete_member"
  on public.traces for delete
  to authenticated
  using (public.journal_member_can_edit(journal_id));

drop policy if exists "tags_write_member" on public.tags;
create policy "tags_write_member"
  on public.tags for insert
  to authenticated
  with check (public.journal_member_can_edit(journal_id));

drop policy if exists "tags_update_member" on public.tags;
create policy "tags_update_member"
  on public.tags for update
  to authenticated
  using (public.journal_member_can_edit(journal_id))
  with check (public.journal_member_can_edit(journal_id));

drop policy if exists "tags_delete_member" on public.tags;
create policy "tags_delete_member"
  on public.tags for delete
  to authenticated
  using (public.journal_member_can_edit(journal_id));

drop policy if exists "trace_tags_write_member" on public.trace_tags;
create policy "trace_tags_write_member"
  on public.trace_tags for insert
  to authenticated
  with check (public.journal_member_can_edit(public.trace_journal_id(trace_id)));

drop policy if exists "trace_tags_delete_member" on public.trace_tags;
create policy "trace_tags_delete_member"
  on public.trace_tags for delete
  to authenticated
  using (public.journal_member_can_edit(public.trace_journal_id(trace_id)));

drop policy if exists "photos_write_member" on public.photos;
create policy "photos_write_member"
  on public.photos for insert
  to authenticated
  with check (public.journal_member_can_edit(journal_id));

drop policy if exists "photos_update_member" on public.photos;
create policy "photos_update_member"
  on public.photos for update
  to authenticated
  using (public.journal_member_can_edit(journal_id))
  with check (public.journal_member_can_edit(journal_id));

drop policy if exists "photos_delete_member" on public.photos;
create policy "photos_delete_member"
  on public.photos for delete
  to authenticated
  using (public.journal_member_can_edit(journal_id));

-- Connectors: owner only (per-user tokens; not shared)
drop policy if exists "journal_connectors_write_member" on public.journal_connectors;
create policy "journal_connectors_write_owner"
  on public.journal_connectors for insert
  to authenticated
  with check (public.is_journal_owner(journal_id));

drop policy if exists "journal_connectors_update_member" on public.journal_connectors;
create policy "journal_connectors_update_owner"
  on public.journal_connectors for update
  to authenticated
  using (public.is_journal_owner(journal_id))
  with check (public.is_journal_owner(journal_id));

drop policy if exists "journal_connectors_delete_member" on public.journal_connectors;
create policy "journal_connectors_delete_owner"
  on public.journal_connectors for delete
  to authenticated
  using (public.is_journal_owner(journal_id));

-- ---------------------------------------------------------------------------
-- Profiles: coworker display + notification prefs
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists notification_email_enabled boolean not null default true,
  add column if not exists notification_push_enabled boolean not null default false;

drop policy if exists "profiles_select_coworkers" on public.profiles;
create policy "profiles_select_coworkers"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.journal_members jm1
      inner join public.journal_members jm2
        on jm1.journal_id = jm2.journal_id
      where jm1.user_id = (select auth.uid())
        and jm2.user_id = profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- Invitations + notifications
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.journal_invitation_status as enum ('pending', 'accepted', 'declined', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_type as enum (
    'journal_invitation',
    'journal_invitation_accepted',
    'journal_ownership_received'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.journal_invitations (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals (id) on delete cascade,
  invitee_email text not null,
  invited_role public.journal_member_role not null,
  invited_by_user_id uuid not null references auth.users (id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  status public.journal_invitation_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint journal_invitations_role_check check (invited_role in ('viewer', 'editor')),
  constraint journal_invitations_email_nonempty check (length(trim(invitee_email)) > 0)
);

create unique index if not exists journal_invitations_one_pending_per_email
  on public.journal_invitations (journal_id, lower(trim(invitee_email)))
  where status = 'pending';

create index if not exists journal_invitations_token_idx on public.journal_invitations (token);

alter table public.journal_invitations enable row level security;

create policy "journal_invitations_select_owner_or_invitee"
  on public.journal_invitations for select
  to authenticated
  using (
    public.is_journal_owner(journal_id)
    or (
      status = 'pending'
      and lower(trim(invitee_email)) = lower(trim(coalesce((select auth.jwt())->>'email', '')))
    )
  );

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  action_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER RPCs
-- ---------------------------------------------------------------------------

create or replace function public.invite_journal_member(
  p_journal_id uuid,
  p_invitee_email text,
  p_invited_role public.journal_member_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(trim(p_invitee_email));
  v_invitee_user_id uuid;
  v_journal_name text;
  v_inv_id uuid;
  v_token uuid;
  v_inviter_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_invited_role not in ('viewer', 'editor') then
    raise exception 'Role must be reader (viewer) or contributor (editor)';
  end if;

  if not public.is_journal_owner(p_journal_id) then
    raise exception 'Only the journal owner can invite people';
  end if;

  if v_email = lower(trim(coalesce((select auth.jwt())->>'email', ''))) then
    raise exception 'You cannot invite yourself';
  end if;

  select display_name into v_inviter_name from public.profiles where id = v_uid;
  select name into v_journal_name from public.journals where id = p_journal_id;

  select au.id
  into v_invitee_user_id
  from auth.users au
  where lower(trim(au.email::text)) = v_email
  limit 1;

  if v_invitee_user_id is not null then
    if exists (
      select 1 from public.journal_members jm
      where jm.journal_id = p_journal_id and jm.user_id = v_invitee_user_id
    ) then
      raise exception 'That user is already a member of this journal';
    end if;
  end if;

  if exists (
    select 1 from public.journal_invitations ji
    where ji.journal_id = p_journal_id
      and ji.status = 'pending'
      and lower(trim(ji.invitee_email)) = v_email
  ) then
    raise exception 'An invitation is already pending for this email';
  end if;

  insert into public.journal_invitations (
    journal_id, invitee_email, invited_role, invited_by_user_id
  )
  values (p_journal_id, v_email, p_invited_role, v_uid)
  returning id, token into v_inv_id, v_token;

  if v_invitee_user_id is not null then
    insert into public.notifications (
      user_id, type, title, body, payload, action_path
    )
    values (
      v_invitee_user_id,
      'journal_invitation'::public.notification_type,
      'Curolia journal invitation',
      format(
        '%s invited you to "%s" as %s.',
        coalesce(v_inviter_name, 'Someone'),
        coalesce(v_journal_name, 'a journal'),
        case p_invited_role
          when 'viewer'::public.journal_member_role then 'a reader'
          else 'a contributor'
        end
      ),
      jsonb_build_object(
        'invitation_id', v_inv_id,
        'journal_id', p_journal_id,
        'token', v_token::text,
        'role', p_invited_role::text
      ),
      '/invitations?token=' || v_token::text
    );
  end if;

  return v_inv_id;
end;
$$;

revoke all on function public.invite_journal_member(uuid, text, public.journal_member_role) from public;
grant execute on function public.invite_journal_member(uuid, text, public.journal_member_role) to authenticated;

create or replace function public.accept_journal_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(trim(coalesce((select auth.jwt())->>'email', '')));
  v_row public.journal_invitations%rowtype;
  v_journal_name text;
  v_acceptor_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.journal_invitations
  where token = p_token
    and status = 'pending'
    and expires_at > now()
  for update;

  if v_row.id is null then
    raise exception 'Invitation not found or no longer valid';
  end if;

  if lower(trim(v_row.invitee_email)) <> v_email then
    raise exception 'This invitation was sent to a different email address';
  end if;

  if exists (
    select 1 from public.journal_members jm
    where jm.journal_id = v_row.journal_id and jm.user_id = v_uid
  ) then
    update public.journal_invitations
    set status = 'accepted'
    where id = v_row.id;
    return v_row.journal_id;
  end if;

  insert into public.journal_members (journal_id, user_id, role)
  values (v_row.journal_id, v_uid, v_row.invited_role);

  update public.journal_invitations
  set status = 'accepted'
  where id = v_row.id;

  update public.notifications
  set read_at = now()
  where user_id = v_uid
    and type = 'journal_invitation'
    and (payload->>'token') = p_token::text
    and read_at is null;

  select name into v_journal_name from public.journals where id = v_row.journal_id;
  select display_name into v_acceptor_name from public.profiles where id = v_uid;

  insert into public.notifications (
    user_id, type, title, body, payload, action_path
  )
  values (
    v_row.invited_by_user_id,
    'journal_invitation_accepted'::public.notification_type,
    'Curolia: invitation accepted',
    format(
      '%s joined "%s".',
      coalesce(v_acceptor_name, v_email),
      coalesce(v_journal_name, 'your journal')
    ),
    jsonb_build_object('journal_id', v_row.journal_id, 'user_id', v_uid::text),
    '/journals/' || v_row.journal_id::text || '/settings'
  );

  return v_row.journal_id;
end;
$$;

revoke all on function public.accept_journal_invitation(uuid) from public;
grant execute on function public.accept_journal_invitation(uuid) to authenticated;

create or replace function public.decline_journal_invitation(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(trim(coalesce((select auth.jwt())->>'email', '')));
  v_row public.journal_invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.journal_invitations
  where token = p_token
    and status = 'pending'
  for update;

  if v_row.id is null then
    raise exception 'Invitation not found';
  end if;

  if lower(trim(v_row.invitee_email)) <> v_email then
    raise exception 'This invitation was sent to a different email address';
  end if;

  update public.journal_invitations
  set status = 'declined'
  where id = v_row.id;

  update public.notifications
  set read_at = now()
  where user_id = v_uid
    and type = 'journal_invitation'
    and (payload->>'token') = p_token::text
    and read_at is null;
end;
$$;

revoke all on function public.decline_journal_invitation(uuid) from public;
grant execute on function public.decline_journal_invitation(uuid) to authenticated;

create or replace function public.cancel_journal_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.journal_invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.journal_invitations
  where id = p_invitation_id
    and status = 'pending'
  for update;

  if v_row.id is null then
    raise exception 'Invitation not found';
  end if;

  if not public.is_journal_owner(v_row.journal_id) then
    raise exception 'Only the journal owner can cancel invitations';
  end if;

  update public.journal_invitations
  set status = 'cancelled'
  where id = p_invitation_id;

  delete from public.notifications
  where type = 'journal_invitation'
    and (payload->>'invitation_id') = p_invitation_id::text;
end;
$$;

revoke all on function public.cancel_journal_invitation(uuid) from public;
grant execute on function public.cancel_journal_invitation(uuid) to authenticated;

create or replace function public.remove_journal_member(p_journal_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.journal_member_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_journal_owner(p_journal_id) then
    raise exception 'Only the journal owner can remove members';
  end if;

  if p_user_id = v_uid then
    raise exception 'Use transfer ownership before leaving as owner';
  end if;

  select jm.role into v_role
  from public.journal_members jm
  where jm.journal_id = p_journal_id and jm.user_id = p_user_id;

  if v_role is null then
    raise exception 'User is not a member of this journal';
  end if;

  if v_role = 'owner'::public.journal_member_role then
    raise exception 'Cannot remove another owner';
  end if;

  delete from public.journal_members
  where journal_id = p_journal_id and user_id = p_user_id;
end;
$$;

revoke all on function public.remove_journal_member(uuid, uuid) from public;
grant execute on function public.remove_journal_member(uuid, uuid) to authenticated;

create or replace function public.update_journal_member_role(
  p_journal_id uuid,
  p_user_id uuid,
  p_role public.journal_member_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_current public.journal_member_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_journal_owner(p_journal_id) then
    raise exception 'Only the journal owner can change roles';
  end if;

  if p_role = 'owner'::public.journal_member_role then
    raise exception 'Use transfer ownership to assign owner';
  end if;

  select jm.role into v_current
  from public.journal_members jm
  where jm.journal_id = p_journal_id and jm.user_id = p_user_id;

  if v_current is null then
    raise exception 'User is not a member of this journal';
  end if;

  if v_current = 'owner'::public.journal_member_role then
    raise exception 'Cannot change owner role here';
  end if;

  update public.journal_members
  set role = p_role
  where journal_id = p_journal_id and user_id = p_user_id;
end;
$$;

revoke all on function public.update_journal_member_role(uuid, uuid, public.journal_member_role) from public;
grant execute on function public.update_journal_member_role(uuid, uuid, public.journal_member_role) to authenticated;

create or replace function public.transfer_journal_ownership(
  p_journal_id uuid,
  p_new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_new_role public.journal_member_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_journal_owner(p_journal_id) then
    raise exception 'Only the current owner can transfer ownership';
  end if;

  if p_new_owner_user_id = v_uid then
    raise exception 'You are already the owner';
  end if;

  select jm.role into v_new_role
  from public.journal_members jm
  where jm.journal_id = p_journal_id and jm.user_id = p_new_owner_user_id;

  if v_new_role is null then
    raise exception 'The new owner must already be a member of this journal';
  end if;

  if v_new_role = 'owner'::public.journal_member_role then
    raise exception 'Target user is already an owner';
  end if;

  -- Connectors cannot be shared: remove all connector rows for this journal.
  delete from public.journal_connectors where journal_id = p_journal_id;
  delete from public.journal_ical_feed_tokens where journal_id = p_journal_id;

  update public.journal_members
  set role = 'editor'::public.journal_member_role
  where journal_id = p_journal_id and user_id = v_uid;

  update public.journal_members
  set role = 'owner'::public.journal_member_role
  where journal_id = p_journal_id and user_id = p_new_owner_user_id;

  update public.journals
  set created_by_user_id = p_new_owner_user_id,
      updated_at = now()
  where id = p_journal_id;

  insert into public.notifications (
    user_id, type, title, body, payload, action_path
  )
  values (
    p_new_owner_user_id,
    'journal_ownership_received'::public.notification_type,
    'Curolia: you are now the journal owner',
    'Connectors were cleared because integrations are personal to each owner.',
    jsonb_build_object('journal_id', p_journal_id),
    '/journals/' || p_journal_id::text || '/settings'
  );
end;
$$;

revoke all on function public.transfer_journal_ownership(uuid, uuid) from public;
grant execute on function public.transfer_journal_ownership(uuid, uuid) to authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.notifications
  set read_at = now()
  where id = p_notification_id
    and user_id = v_uid
    and read_at is null;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_notification_read_by_token(p_invitation_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.notifications
  set read_at = now()
  where user_id = v_uid
    and read_at is null
    and type = 'journal_invitation'
    and (payload->>'token') = p_invitation_token::text;
end;
$$;

revoke all on function public.mark_notification_read_by_token(uuid) from public;
grant execute on function public.mark_notification_read_by_token(uuid) to authenticated;

-- iCal feed tokens: owner-only writes (read stays any member for shared subscribe links)
drop policy if exists "journal_ical_feed_tokens_insert_member" on public.journal_ical_feed_tokens;
create policy "journal_ical_feed_tokens_insert_owner"
  on public.journal_ical_feed_tokens for insert
  to authenticated
  with check (public.is_journal_owner(journal_id));

drop policy if exists "journal_ical_feed_tokens_update_member" on public.journal_ical_feed_tokens;
create policy "journal_ical_feed_tokens_update_owner"
  on public.journal_ical_feed_tokens for update
  to authenticated
  using (public.is_journal_owner(journal_id))
  with check (public.is_journal_owner(journal_id));

drop policy if exists "journal_ical_feed_tokens_delete_member" on public.journal_ical_feed_tokens;
create policy "journal_ical_feed_tokens_delete_owner"
  on public.journal_ical_feed_tokens for delete
  to authenticated
  using (public.is_journal_owner(journal_id));
