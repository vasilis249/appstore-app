
-- 1) has_role -> SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2) conversation_members write policies
CREATE POLICY "Creator can add members"
ON public.conversation_members
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  )
);

CREATE POLICY "Members can leave"
ON public.conversation_members
FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Members update own membership"
ON public.conversation_members
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3) Remove redundant INSERT policy on open_game_players
DROP POLICY IF EXISTS "Player joins self" ON public.open_game_players;

-- 4) Revoke EXECUTE on SECURITY DEFINER functions from anon / public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_open_game(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_friendship() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_open_game_join() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_owner_on_venue_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_player_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_booking_cancelled_open_game() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_games_played() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_open_game(uuid) TO authenticated;
