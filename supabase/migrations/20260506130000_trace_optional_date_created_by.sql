-- Optional trace start date + creator (profiles FK for joins / RLS).

alter table public.traces alter column date drop default;
alter table public.traces alter column date drop not null;

alter table public.traces drop constraint if exists traces_end_date_gte_date;

alter table public.traces
  add constraint traces_end_date_requires_start_and_gte
  check (
    end_date is null
    or (date is not null and end_date >= date)
  );

comment on column public.traces.date is 'Optional start calendar day (UTC) for the trace.';

alter table public.traces
  add column created_by_user_id uuid references public.profiles (id) on delete set null;

comment on column public.traces.created_by_user_id is 'Profile of the user who created this trace row.';

create or replace function public.traces_set_creator_on_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.created_by_user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists traces_set_creator_bi on public.traces;
create trigger traces_set_creator_bi
  before insert on public.traces
  for each row
  execute function public.traces_set_creator_on_insert();
