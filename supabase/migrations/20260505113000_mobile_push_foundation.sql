-- Mobile push foundation:
-- - device token registry
-- - outbox for queued sends
-- - RPC for native token upsert
-- - invitation-notification enqueue trigger

do $$ begin
  create type public.push_delivery_status as enum ('pending', 'sent', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  provider text not null default 'fcm',
  device_id text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_select_own" on public.push_tokens;
create policy "push_tokens_select_own"
  on public.push_tokens for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "push_tokens_insert_own" on public.push_tokens;
create policy "push_tokens_insert_own"
  on public.push_tokens for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "push_tokens_update_own" on public.push_tokens;
create policy "push_tokens_update_own"
  on public.push_tokens for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "push_tokens_delete_own" on public.push_tokens;
create policy "push_tokens_delete_own"
  on public.push_tokens for delete
  to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.push_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_id uuid not null references public.notifications (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  provider text not null default 'fcm',
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  status public.push_delivery_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, token)
);

create index if not exists push_outbox_status_idx
  on public.push_notification_outbox (status, created_at);

create index if not exists push_outbox_user_idx
  on public.push_notification_outbox (user_id, created_at desc);

alter table public.push_notification_outbox enable row level security;

drop policy if exists "push_outbox_select_own" on public.push_notification_outbox;
create policy "push_outbox_select_own"
  on public.push_notification_outbox for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.register_push_token(
  p_token text,
  p_platform text,
  p_provider text default 'fcm',
  p_device_id text default null
)
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

  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'Push token is required';
  end if;

  if p_platform not in ('ios', 'android') then
    raise exception 'Platform must be ios or android';
  end if;

  insert into public.push_tokens (user_id, token, platform, provider, device_id, last_seen_at, updated_at)
  values (v_uid, trim(p_token), p_platform, coalesce(nullif(trim(p_provider), ''), 'fcm'), nullif(trim(p_device_id), ''), now(), now())
  on conflict (token)
  do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    provider = excluded.provider,
    device_id = excluded.device_id,
    last_seen_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text, text, text) from public;
grant execute on function public.register_push_token(text, text, text, text) to authenticated;

create or replace function public.enqueue_journal_invitation_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type <> 'journal_invitation'::public.notification_type then
    return new;
  end if;

  insert into public.push_notification_outbox (
    user_id,
    notification_id,
    token,
    platform,
    provider,
    title,
    body,
    payload,
    status
  )
  select
    new.user_id,
    new.id,
    pt.token,
    pt.platform,
    pt.provider,
    new.title,
    coalesce(new.body, ''),
    jsonb_build_object(
      'notification_id', new.id::text,
      'type', new.type::text,
      'action_path', coalesce(new.action_path, ''),
      'payload', new.payload
    ),
    'pending'::public.push_delivery_status
  from public.push_tokens pt
  inner join public.profiles p on p.id = new.user_id
  where pt.user_id = new.user_id
    and p.notification_push_enabled = true;

  return new;
end;
$$;

drop trigger if exists notifications_enqueue_journal_invitation_push on public.notifications;
create trigger notifications_enqueue_journal_invitation_push
after insert on public.notifications
for each row
execute function public.enqueue_journal_invitation_push();
