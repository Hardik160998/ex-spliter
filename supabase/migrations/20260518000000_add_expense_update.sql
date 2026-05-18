-- Enable update on expenses table
create policy "members can update expenses" on expenses for update
  using (
    -- The owner of the trip can update any expense
    (trip_id in (select id from trips where owner_id = auth.uid()))
    or
    -- The member who paid the expense can update it
    (member_id in (select id from trip_members where user_id = auth.uid()))
  );
