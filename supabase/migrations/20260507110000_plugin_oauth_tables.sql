-- OAuth PKCE pending state (Edge uses service role; no user-facing RLS).
create table public.plugin_oauth_pending (
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plugin_type_id text not null references public.plugin_types (id) on delete restrict,
  code_verifier text not null,
  redirect_after text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index plugin_oauth_pending_expires_idx on public.plugin_oauth_pending (expires_at);

alter table public.plugin_oauth_pending enable row level security;

-- Encrypted OAuth tokens: never expose to PostgREST roles; Edge functions use service role.
create table public.user_plugin_oauth_tokens (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  plugin_type_id text not null references public.plugin_types (id) on delete restrict,
  provider text not null,
  refresh_token_ciphertext bytea not null,
  access_token_ciphertext bytea,
  access_token_expires_at timestamptz,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  revoked_at timestamptz,
  unique (user_id, plugin_type_id)
);

create index user_plugin_oauth_tokens_user_idx on public.user_plugin_oauth_tokens (user_id);

alter table public.user_plugin_oauth_tokens enable row level security;

revoke all on public.plugin_oauth_pending from anon, authenticated;
revoke all on public.user_plugin_oauth_tokens from anon, authenticated;

grant select, insert, update, delete on public.plugin_oauth_pending to service_role;
grant select, insert, update, delete on public.user_plugin_oauth_tokens to service_role;
