-- Fix expense delete policy: use trip_id (consistent with view policy)
-- Previously checked member_id which was too restrictive

drop policy if exists "members can delete expenses" on expenses;

create policy "members can delete expenses" on expenses for delete
  using (
    trip_id in (select trip_id from trip_members where user_id = auth.uid())
  );
