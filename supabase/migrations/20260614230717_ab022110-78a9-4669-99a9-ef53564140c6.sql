
-- Lock down the trigger helper: only the database/postgres calls it via trigger
REVOKE EXECUTE ON FUNCTION public.notify_owner_on_online_booking() FROM PUBLIC, anon, authenticated;

-- Storage RLS for venue-photos bucket
CREATE POLICY "Public can view venue photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'venue-photos');

CREATE POLICY "Owners upload venue photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'venue-photos'
  AND EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id::text = split_part(name, '/', 1)
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
);

CREATE POLICY "Owners delete venue photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'venue-photos'
  AND EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id::text = split_part(name, '/', 1)
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
);

CREATE POLICY "Owners update venue photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'venue-photos'
  AND EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id::text = split_part(name, '/', 1)
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
);
