-- Trace photo provenance for imported cloud library items (e.g. Google Photos).
alter table public.photos
  add column source_plugin_id text references public.plugin_types (id) on delete set null;

alter table public.photos add column external_ref jsonb;

alter table public.photos add column captured_at timestamptz;

comment on column public.photos.source_plugin_id is 'Plugin that supplied metadata or import for this photo.';
comment on column public.photos.external_ref is 'Non-secret metadata (provider ids, product URLs for deep links).';
comment on column public.photos.captured_at is 'Capture time from source library when known.';
