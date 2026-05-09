-- URL-safe trace slugs, unique within each journal (same shape as tags.slug).

create or replace function public.trace_claim_slug(
  p_journal_id uuid,
  p_trace_id uuid,
  p_desired text
)
returns text
language plpgsql
set search_path = public
as $$
declare
  base text;
  candidate text;
  suffix int := 0;
begin
  base := public.slugify_text(p_desired);
  if base is null or length(base) = 0 then
    base := 'trace';
  end if;
  base := substring(base from 1 for 120);

  candidate := base;
  loop
    exit when not exists (
      select 1
      from public.traces tr
      where tr.journal_id = p_journal_id
        and tr.slug = candidate
        and (
          p_trace_id is null
          or tr.id is distinct from p_trace_id
        )
    );

    suffix := suffix + 1;
    candidate := substring(base from 1 for 118) || '-' || suffix::text;
  end loop;

  return candidate;
end;
$$;

revoke all on function public.trace_claim_slug(uuid, uuid, text) from public;
grant execute on function public.trace_claim_slug(uuid, uuid, text)
  to authenticated, service_role;

alter table public.traces
  add column if not exists slug text;

update public.traces t
set slug = public.trace_claim_slug(t.journal_id, t.id, coalesce(t.title, ''))
where t.slug is null or trim(t.slug) = '';

alter table public.traces
  alter column slug set not null;

drop index if exists traces_journal_slug_key;

create unique index traces_journal_slug_key
  on public.traces (journal_id, slug);

alter table public.traces
  add constraint traces_slug_format_chk
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

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
    -- Title edits do not rewrite slug (stable URLs). Only `slug` changes re-claim.
    if new.slug is null or trim(new.slug) = '' then
      new.slug := public.trace_claim_slug(new.journal_id, new.id, coalesce(new.title, ''));
    else
      new.slug := public.trace_claim_slug(new.journal_id, new.id, new.slug);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists traces_set_slug_before_ins on public.traces;

create trigger traces_set_slug_before_ins
  before insert on public.traces
  for each row execute function public.traces_set_slug();

drop trigger if exists traces_set_slug_before_upd on public.traces;

create trigger traces_set_slug_before_upd
  before update of slug on public.traces
  for each row execute function public.traces_set_slug();
