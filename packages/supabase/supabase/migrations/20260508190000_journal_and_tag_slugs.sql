-- Readable URL segments: journals and tags get stable slug columns (globally unique
-- journals, per-journal unique tags).

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.slugify_text(p_raw text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from regexp_replace(
      lower(trim(regexp_replace(coalesce(p_raw, ''), '[^a-zA-Z0-9]+', '-', 'g'))),
      '-+',
      '-',
      'g'
    )),
    ''
  );
$$;

revoke all on function public.slugify_text(text) from public;
grant execute on function public.slugify_text(text) to authenticated, service_role;

-- Globally unique journal slug; p_journal_id excludes the current row (NULL on insert OK).
create or replace function public.journal_claim_slug(
  p_journal_id uuid,
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
    base := 'journal';
  end if;
  base := substring(base from 1 for 120);

  candidate := base;
  loop
    exit when not exists (
      select 1
      from public.journals j
      where j.slug = candidate
        and (
          p_journal_id is null
          or j.id is distinct from p_journal_id
        )
    );

    suffix := suffix + 1;
    candidate := substring(base from 1 for 118) || '-' || suffix::text;
  end loop;

  return candidate;
end;
$$;

revoke all on function public.journal_claim_slug(uuid, text) from public;
grant execute on function public.journal_claim_slug(uuid, text)
  to authenticated, service_role;

create or replace function public.tag_claim_slug(
  p_journal_id uuid,
  p_tag_id uuid,
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
    base := 'tag';
  end if;
  base := substring(base from 1 for 120);

  candidate := base;
  loop
    exit when not exists (
      select 1
      from public.tags t
      where t.journal_id = p_journal_id
        and t.slug = candidate
        and (
          p_tag_id is null
          or t.id is distinct from p_tag_id
        )
    );

    suffix := suffix + 1;
    candidate := substring(base from 1 for 118) || '-' || suffix::text;
  end loop;

  return candidate;
end;
$$;

revoke all on function public.tag_claim_slug(uuid, uuid, text) from public;
grant execute on function public.tag_claim_slug(uuid, uuid, text)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Journals: backfill slug, defaults, triggers
-- -----------------------------------------------------------------------------

update public.journals j
set slug = public.journal_claim_slug(j.id, j.name)
where j.slug is null or trim(j.slug) = '';

alter table public.journals alter column slug set not null;

create or replace function public.journals_set_slug()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.slug is null or trim(new.slug) = '' then
      new.slug := public.journal_claim_slug(new.id, new.name);
    else
      new.slug := public.journal_claim_slug(new.id, new.slug);
    end if;
  elsif tg_op = 'UPDATE' then
    if new.slug is null or trim(new.slug) = '' then
      new.slug := public.journal_claim_slug(new.id, new.name);
    else
      new.slug := public.journal_claim_slug(new.id, new.slug);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists journals_set_slug_before_ins on public.journals;

create trigger journals_set_slug_before_ins
  before insert on public.journals
  for each row execute function public.journals_set_slug();

drop trigger if exists journals_set_slug_before_upd on public.journals;

create trigger journals_set_slug_before_upd
  before update of slug on public.journals
  for each row execute function public.journals_set_slug();

-- -----------------------------------------------------------------------------
-- Tags: slug column + backfill + triggers
-- -----------------------------------------------------------------------------

alter table public.tags
  add column if not exists slug text;

update public.tags t
set slug = public.tag_claim_slug(t.journal_id, t.id, t.name)
where t.slug is null or trim(t.slug) = '';

alter table public.tags
  alter column slug set not null;

drop index if exists tags_journal_slug_key;

create unique index tags_journal_slug_key
  on public.tags (journal_id, slug);

alter table public.tags
  add constraint tags_slug_format_chk
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

create or replace function public.tags_set_slug()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.slug is null or trim(new.slug) = '' then
      new.slug := public.tag_claim_slug(new.journal_id, new.id, new.name);
    else
      new.slug := public.tag_claim_slug(new.journal_id, new.id, new.slug);
    end if;
  elsif tg_op = 'UPDATE' then
    if new.name is distinct from old.name then
      new.slug := public.tag_claim_slug(new.journal_id, new.id, new.name);
    elsif new.slug is distinct from old.slug then
      if new.slug is null or trim(new.slug) = '' then
        new.slug := public.tag_claim_slug(new.journal_id, new.id, new.name);
      else
        new.slug := public.tag_claim_slug(new.journal_id, new.id, new.slug);
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tags_set_slug_before_ins on public.tags;

create trigger tags_set_slug_before_ins
  before insert on public.tags
  for each row execute function public.tags_set_slug();

drop trigger if exists tags_set_slug_before_upd on public.tags;

create trigger tags_set_slug_before_upd
  before update of name, slug on public.tags
  for each row execute function public.tags_set_slug();
