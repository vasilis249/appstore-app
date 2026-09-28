DROP POLICY IF EXISTS "Players create bookings" ON public.bookings;
CREATE POLICY "Players create bookings" ON public.bookings
FOR INSERT TO authenticated
WITH CHECK (
  ((auth.uid() = player_id) AND NOT (has_role(auth.uid(),'owner'::app_role) AND NOT has_role(auth.uid(),'admin'::app_role)))
  OR EXISTS (SELECT 1 FROM venues v WHERE v.id = bookings.venue_id AND v.owner_id = auth.uid())
  OR has_role(auth.uid(),'admin'::app_role)
);