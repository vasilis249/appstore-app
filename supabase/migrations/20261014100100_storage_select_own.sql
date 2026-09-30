-- Storage removes need a SELECT policy as well as DELETE (the Storage API reads the rows it deletes). There was
-- none on `voices` / `avatars`, so removing your own file (a deleted voice, the old profile photo, an upload whose
-- post failed) silently did nothing. Users may now see — only — the files in their own folder. Both buckets stay
-- public by URL; this doesn't make them listable by others.
CREATE POLICY voices_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voices' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
