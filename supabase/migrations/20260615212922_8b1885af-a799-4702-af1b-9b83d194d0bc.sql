
-- 1. Profile locale
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'el';

-- 2. Translations cache
CREATE TABLE IF NOT EXISTS public.translations_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_hash text NOT NULL,
  source_lang text NOT NULL,
  target_lang text NOT NULL,
  source_text text NOT NULL,
  translated_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_hash, source_lang, target_lang)
);

GRANT SELECT ON public.translations_cache TO anon, authenticated;
GRANT ALL ON public.translations_cache TO service_role;
ALTER TABLE public.translations_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Translations cache public read" ON public.translations_cache FOR SELECT USING (true);

-- 3. Block owners (not admins) from creating bookings as a player or joining open games
DROP POLICY IF EXISTS "Players create bookings" ON public.bookings;
CREATE POLICY "Players create bookings" ON public.bookings
FOR INSERT TO authenticated WITH CHECK (
  (
    auth.uid() = player_id
    AND NOT (
      public.has_role(auth.uid(), 'owner') AND NOT public.has_role(auth.uid(), 'admin')
    )
  )
  OR EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid())
);

-- open_game_players join restriction
DROP POLICY IF EXISTS "Players join open games" ON public.open_game_players;
CREATE POLICY "Players join open games" ON public.open_game_players
FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = player_id
  AND NOT (
    public.has_role(auth.uid(), 'owner') AND NOT public.has_role(auth.uid(), 'admin')
  )
);
