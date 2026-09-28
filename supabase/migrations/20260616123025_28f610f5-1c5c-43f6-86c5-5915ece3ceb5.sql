-- Fix storage RLS for venue-photos bucket.
-- The previous policies compared the VENUE's name column (v.name) instead of the storage object's name,
-- so every INSERT/UPDATE/DELETE failed with "new row violates row-level security policy".
DROP POLICY IF EXISTS "Owners upload venue photos" ON storage.objects;
DROP POLICY IF EXISTS "Owners update venue photos" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete venue photos" ON storage.objects;

CREATE POLICY "Owners upload venue photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'venue-photos'
  AND EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id::text = (storage.foldername(storage.objects.name))[1]
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE POLICY "Owners update venue photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'venue-photos'
  AND EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id::text = (storage.foldername(storage.objects.name))[1]
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE POLICY "Owners delete venue photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'venue-photos'
  AND EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id::text = (storage.foldername(storage.objects.name))[1]
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);
