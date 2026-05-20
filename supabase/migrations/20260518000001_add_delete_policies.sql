-- Add DELETE policies for expenses and trips tables
-- Previously missing — RLS was blocking all deletes without returning an error

create policy "owner can delete trips" on trips for delete
  using (owner_id = auth.uid());

create policy "members can delete expenses" on expenses for delete
  using (
    -- Any member of the trip can delete expenses
    trip_id in (select trip_id from trip_members where user_id = auth.uid())
  );
