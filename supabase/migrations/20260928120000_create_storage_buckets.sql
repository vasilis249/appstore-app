-- Storage buckets used by the app. Earlier migrations only created the
-- storage.objects policies; the buckets themselves were created by hand in the
-- original project, so a fresh project needs them here.
-- Both buckets are public-read (policies "Avatars public read" and
-- "Public can view venue photos"); writes stay restricted by those policies.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('venue-photos', 'venue-photos', true, 8 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
