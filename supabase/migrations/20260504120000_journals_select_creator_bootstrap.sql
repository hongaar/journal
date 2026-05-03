-- Client creates journal then journal_members in two requests. SELECT on journals was
-- members-only, so (1) insert().select() could not return the row and (2) the
-- journal_members insert policy's EXISTS subquery on journals saw no row under RLS.
-- Allow the creator to read a journal until at least one membership row exists.

drop policy if exists "journals_select_member" on public.journals;

create policy "journals_select_member"
  on public.journals for select
  to authenticated
  using (
    public.is_journal_member(id)
    or (
      created_by_user_id = (select auth.uid())
      and not exists (
        select 1
        from public.journal_members jm
        where jm.journal_id = journals.id
      )
    )
  );
