-- Allow trip members to delete expenses
create policy "members can delete expenses" on expenses for delete
  using (
    trip_id in (select trip_id from trip_members where user_id = auth.uid())
  );

-- Allow trip owner to delete the trip
create policy "owner can delete trips" on trips for delete
  using (owner_id = auth.uid());

-- Allow deleting trip members (owner or self)
create policy "owner can delete trip_members" on trip_members for delete
  using (
    user_id = auth.uid()
    or (trip_id in (select id from trips where owner_id = auth.uid()))
  );
