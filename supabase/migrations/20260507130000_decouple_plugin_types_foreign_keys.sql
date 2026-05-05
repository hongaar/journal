-- Allow plugin packages to define ids without per-plugin schema migrations.
-- Keeping plugin_type_id as text removes the need to seed plugin_types for every package.

alter table public.journal_plugins
  drop constraint if exists journal_plugins_plugin_type_id_fkey;

alter table public.user_plugins
  drop constraint if exists user_plugins_plugin_type_id_fkey;

alter table public.plugin_oauth_pending
  drop constraint if exists plugin_oauth_pending_plugin_type_id_fkey;

alter table public.user_plugin_oauth_tokens
  drop constraint if exists user_plugin_oauth_tokens_plugin_type_id_fkey;
