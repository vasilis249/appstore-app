
-- 1 & 2: Stop broadcasting bookings (which contain customer_phone/customer_name) via Realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.bookings;

-- 3: Prevent players from spoofing customer_name/customer_phone on their own bookings
DROP POLICY IF EXISTS "Players create bookings" ON public.bookings;
CREATE POLICY "Players create bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
  -- Venue owner or admin: may create any booking (including phone bookings with customer info)
  (EXISTS (SELECT 1 FROM public.venues v WHERE v.id = bookings.venue_id AND v.owner_id = auth.uid()))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  -- Regular player: must book for themselves AND cannot set customer_name/customer_phone
  OR (
    auth.uid() = player_id
    AND customer_name IS NULL
    AND customer_phone IS NULL
    AND NOT (
      public.has_role(auth.uid(), 'owner'::public.app_role)
      AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  )
);

-- 4: court_pricing owner-manage policy → authenticated only
DROP POLICY IF EXISTS "Owners manage pricing" ON public.court_pricing;
CREATE POLICY "Owners manage pricing"
ON public.court_pricing
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courts c
    JOIN public.venues v ON v.id = c.venue_id
    WHERE c.id = court_pricing.court_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.courts c
    JOIN public.venues v ON v.id = c.venue_id
    WHERE c.id = court_pricing.court_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

-- 5: venue_photos owner-manage policy → authenticated only
DROP POLICY IF EXISTS "Owners manage photos" ON public.venue_photos;
CREATE POLICY "Owners manage photos"
ON public.venue_photos
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id = venue_photos.venue_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id = venue_photos.venue_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

-- 6: Profiles must not be enumerable by anonymous visitors
DROP POLICY IF EXISTS "Profiles viewable" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  disabled = false
  OR auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
