-- Last editor attribution (separate from creator).

alter table public.traces
  add column modified_by_user_id uuid references public.profiles (id) on delete set null;

comment on column public.traces.modified_by_user_id is 'Profile of the user who last updated this trace.';

create or replace function public.traces_set_modifier_on_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.modified_by_user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists traces_set_modifier_bu on public.traces;
create trigger traces_set_modifier_bu
  before update on public.traces
  for each row
  execute function public.traces_set_modifier_on_update();
