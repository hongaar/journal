-- Broadcast notification row changes to subscribed clients (filtered by RLS + Realtime filter).
alter publication supabase_realtime add table public.notifications;
