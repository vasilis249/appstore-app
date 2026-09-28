
-- Reviews: viewable only by authenticated users
DROP POLICY IF EXISTS "Reviews viewable" ON public.reviews;
CREATE POLICY "Reviews viewable by authenticated"
ON public.reviews FOR SELECT TO authenticated USING (true);

-- Open game players: viewable only by authenticated users
DROP POLICY IF EXISTS "Players viewable" ON public.open_game_players;
CREATE POLICY "Players viewable by authenticated"
ON public.open_game_players FOR SELECT TO authenticated USING (true);

-- Bookings INSERT policy: remove the clause that blocks owners (non-admin)
-- from booking as players for themselves.
DROP POLICY IF EXISTS "Players create bookings" ON public.bookings;
CREATE POLICY "Players create bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
  (EXISTS (SELECT 1 FROM public.venues v WHERE v.id = bookings.venue_id AND v.owner_id = auth.uid()))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    auth.uid() = player_id
    AND customer_name IS NULL
    AND customer_phone IS NULL
  )
);

-- Realtime: enable RLS and restrict channel subscriptions to authenticated users.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated can use realtime"
ON realtime.messages FOR SELECT TO authenticated USING (true);
