
-- 1) bookings UPDATE: add WITH CHECK preventing players from injecting customer_name/customer_phone
DROP POLICY IF EXISTS "Owners/players update bookings" ON public.bookings;
CREATE POLICY "Owners/players update bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = player_id)
  OR EXISTS (SELECT 1 FROM public.venues v WHERE v.id = bookings.venue_id AND v.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.venues v WHERE v.id = bookings.venue_id AND v.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    auth.uid() = player_id
    AND customer_name IS NULL
    AND customer_phone IS NULL
  )
);

-- 2) booking_equipment: add owner/admin write policies (SELECT policy already exists)
CREATE POLICY "Owners manage booking equipment - insert"
ON public.booking_equipment
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.venues v ON v.id = b.venue_id
    WHERE b.id = booking_equipment.booking_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Owners manage booking equipment - update"
ON public.booking_equipment
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.venues v ON v.id = b.venue_id
    WHERE b.id = booking_equipment.booking_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.venues v ON v.id = b.venue_id
    WHERE b.id = booking_equipment.booking_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Owners manage booking equipment - delete"
ON public.booking_equipment
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.venues v ON v.id = b.venue_id
    WHERE b.id = booking_equipment.booking_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

-- 3) realtime.messages: restrict user-scoped topics (those ending in ':<uuid>') to the matching user
-- Skipped where realtime.messages isn't ours to change (hosted Supabase).
DO $realtime$
BEGIN
  DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
  CREATE POLICY "Authenticated can use realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    (realtime.topic() !~ ':[0-9a-fA-F-]{36}$')
    OR (right(realtime.topic(), 36) = auth.uid()::text)
  );
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_function THEN
  RAISE NOTICE 'realtime.messages policy skipped: %', SQLERRM;
END $realtime$;
