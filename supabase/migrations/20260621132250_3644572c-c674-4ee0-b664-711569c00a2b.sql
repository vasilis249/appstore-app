CREATE OR REPLACE FUNCTION public.join_open_game(_open_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _max int;
  _count int;
BEGIN
  IF _user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_open_game_id::text, 0));
  SELECT og.max_players INTO _max FROM public.open_games og WHERE og.id = _open_game_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF EXISTS (SELECT 1 FROM public.open_games WHERE id = _open_game_id AND host_id = _user)
     OR EXISTS (SELECT 1 FROM public.open_game_players WHERE open_game_id = _open_game_id AND player_id = _user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_joined');
  END IF;
  SELECT COUNT(*) INTO _count FROM public.open_game_players WHERE open_game_id = _open_game_id;
  IF (1 + _count) >= _max THEN
    RETURN jsonb_build_object('ok', false, 'error', 'full');
  END IF;
  INSERT INTO public.open_game_players (open_game_id, player_id) VALUES (_open_game_id, _user);
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.join_open_game(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_open_game(uuid) TO authenticated;