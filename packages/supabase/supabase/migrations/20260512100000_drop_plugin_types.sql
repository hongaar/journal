-- `plugin_types` was the legacy catalog (`connector_types`). Application/plugin ids are
-- defined in code (`pluginManifest.id`). FKs from journal_plugins, user_plugins, and OAuth
-- tables were dropped in 20260507130000_decouple_plugin_types_foreign_keys.sql.
-- Remove the last dependency (`photos.source_plugin_id`) and drop the catalog table.

alter table public.photos
  drop constraint if exists photos_source_plugin_id_fkey;

drop table if exists public.plugin_types;

comment on column public.photos.source_plugin_id is
  'Plugin id string that supplied metadata or import for this photo (matches pluginManifest.id in app code; no DB catalog).';
