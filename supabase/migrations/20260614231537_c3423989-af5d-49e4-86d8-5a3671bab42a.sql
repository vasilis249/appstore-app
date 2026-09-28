
-- 1) Link reviews to open games
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS open_game_id uuid REFERENCES public.open_games(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS reviews_open_game_idx ON public.reviews(open_game_id);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_unique_per_game ON public.reviews(reviewer_id, target_player_id, open_game_id) WHERE open_game_id IS NOT NULL;

-- 2) Increment games_played when joining an open game
CREATE OR REPLACE FUNCTION public.increment_games_played()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.profiles SET games_played = games_played + 1 WHERE user_id = NEW.player_id;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_increment_games_played ON public.open_game_players;
CREATE TRIGGER trg_increment_games_played AFTER INSERT ON public.open_game_players
  FOR EACH ROW EXECUTE FUNCTION public.increment_games_played();

-- 3) Recalculate avg rating
CREATE OR REPLACE FUNCTION public.recalc_player_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tgt uuid; v_avg numeric;
BEGIN
  tgt := COALESCE(NEW.target_player_id, OLD.target_player_id);
  SELECT AVG(rating)::numeric(3,2) INTO v_avg FROM public.reviews WHERE target_player_id = tgt;
  UPDATE public.profiles SET rating = v_avg WHERE user_id = tgt;
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_recalc_rating ON public.reviews;
CREATE TRIGGER trg_recalc_rating AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recalc_player_rating();

-- 4) Storage policies for avatars bucket (path: {user_id}/...)
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
