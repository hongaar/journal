-- Human-friendly place text from reverse geocoding (stored for search + display).
alter table public.traces add column if not exists location_label text;

comment on column public.traces.location_label is
  'Friendly place description (e.g. address, city, country) from geocoding; optional.';
