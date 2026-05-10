-- When a trace moves to another journal, reclaim slug within the destination journal.
-- Storage paths and app logic still update journal_id separately; this avoids (journal_id, slug) conflicts.

create or replace function public.traces_set_slug()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.slug is null or trim(new.slug) = '' then
      new.slug := public.trace_claim_slug(new.journal_id, new.id, coalesce(new.title, ''));
    else
      new.slug := public.trace_claim_slug(new.journal_id, new.id, new.slug);
    end if;
  elsif tg_op = 'UPDATE' then
    if new.journal_id is distinct from old.journal_id then
      new.slug := public.trace_claim_slug(new.journal_id, new.id, coalesce(new.title, ''));
    elsif new.slug is null or trim(new.slug) = '' then
      new.slug := public.trace_claim_slug(new.journal_id, new.id, coalesce(new.title, ''));
    else
      new.slug := public.trace_claim_slug(new.journal_id, new.id, new.slug);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists traces_set_slug_before_upd on public.traces;

create trigger traces_set_slug_before_upd
  before update of slug, journal_id on public.traces
  for each row execute function public.traces_set_slug();
