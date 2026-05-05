-- Rename connectors domain → plugins (enum, tables, columns, constraints, policies, indexes).

alter type public.connector_link_status rename to plugin_link_status;

-- Catalog
alter table public.connector_types rename to plugin_types;
alter policy "connector_types_select_authenticated" on public.plugin_types
  rename to "plugin_types_select_authenticated";

-- Per-journal settings
alter table public.journal_connectors rename to journal_plugins;
alter index public.journal_connectors_journal_idx rename to journal_plugins_journal_idx;
alter table public.journal_plugins rename column connector_type_id to plugin_type_id;

alter table public.journal_plugins rename constraint journal_connectors_pkey to journal_plugins_pkey;
alter table public.journal_plugins
  rename constraint journal_connectors_journal_id_connector_type_id_key to journal_plugins_journal_id_plugin_type_id_key;
alter table public.journal_plugins
  rename constraint journal_connectors_connector_type_id_fkey to journal_plugins_plugin_type_id_fkey;

alter policy "journal_connectors_select_member" on public.journal_plugins
  rename to "journal_plugins_select_member";
alter policy "journal_connectors_write_owner" on public.journal_plugins
  rename to "journal_plugins_write_owner";
alter policy "journal_connectors_update_owner" on public.journal_plugins
  rename to "journal_plugins_update_owner";
alter policy "journal_connectors_delete_owner" on public.journal_plugins
  rename to "journal_plugins_delete_owner";

-- Account-wide toggles
alter table public.user_connectors rename to user_plugins;
alter index public.user_connectors_user_idx rename to user_plugins_user_idx;
alter table public.user_plugins rename column connector_type_id to plugin_type_id;

alter table public.user_plugins rename constraint user_connectors_pkey to user_plugins_pkey;
alter table public.user_plugins
  rename constraint user_connectors_user_id_connector_type_id_key to user_plugins_user_id_plugin_type_id_key;
alter table public.user_plugins
  rename constraint user_connectors_connector_type_id_fkey to user_plugins_plugin_type_id_fkey;

alter policy "user_connectors_select_own" on public.user_plugins rename to "user_plugins_select_own";
alter policy "user_connectors_insert_own" on public.user_plugins rename to "user_plugins_insert_own";
alter policy "user_connectors_update_own" on public.user_plugins rename to "user_plugins_update_own";
alter policy "user_connectors_delete_own" on public.user_plugins rename to "user_plugins_delete_own";

-- Ownership transfer must delete plugin rows by new table name
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

  delete from public.journal_plugins where journal_id = p_journal_id;
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
    'Plugins were cleared because integrations are personal to each owner.',
    jsonb_build_object('journal_id', p_journal_id),
    '/journals/' || p_journal_id::text || '/settings'
  );
end;
$$;
