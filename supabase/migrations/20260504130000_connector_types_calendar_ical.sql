-- Calendar-oriented connector stubs
insert into public.connector_types (id, display_name, description) values
  (
    'google_calendar',
    'Google Calendar',
    'Show traces on Google Calendar (coming soon).'
  ),
  (
    'ical',
    'iCalendar',
    'Publish traces as iCalendar (.ics) files (coming soon).'
  )
on conflict (id) do nothing;
