
-- Player contact info (self-only phone storage)
CREATE TABLE public.player_contact_info (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_contact_info TO authenticated;
GRANT ALL ON public.player_contact_info TO service_role;

ALTER TABLE public.player_contact_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own contact select" ON public.player_contact_info
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own contact insert" ON public.player_contact_info
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own contact update" ON public.player_contact_info
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own contact delete" ON public.player_contact_info
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_player_contact_info_updated_at
  BEFORE UPDATE ON public.player_contact_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Owner-facing player profile RPC.
-- Returns one row with profile info + phone ONLY IF the caller owns a venue
-- where the player has a confirmed booking whose start (Europe/Athens) is in
-- the future. Otherwise phone is NULL. Empty result if caller is neither an
-- admin nor an owner of any venue the player has ever booked.
CREATE OR REPLACE FUNCTION public.get_owner_player_profile(_player_id uuid)
RETURNS TABLE (
  player_id uuid,
  full_name text,
  photo_url text,
  rating numeric,
  level text,
  has_active_booking boolean,
  phone text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _is_admin boolean := public.has_role(_caller, 'admin');
  _authorized boolean;
  _has_active boolean;
BEGIN
  IF _caller IS NULL THEN
    RETURN;
  END IF;

  -- Caller must be admin OR own a venue this player has ever booked.
  SELECT _is_admin OR EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.venues v ON v.id = b.venue_id
    WHERE b.player_id = _player_id
      AND v.owner_id = _caller
  ) INTO _authorized;

  IF NOT _authorized THEN
    RETURN;
  END IF;

  -- Active = confirmed AND (date + start_time) in the future, Europe/Athens.
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.venues v ON v.id = b.venue_id
    WHERE b.player_id = _player_id
      AND b.status = 'confirmed'
      AND (_is_admin OR v.owner_id = _caller)
      AND ((b.date + b.start_time) AT TIME ZONE 'Europe/Athens') > now()
  ) INTO _has_active;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    p.photo_url,
    p.rating,
    p.level::text,
    _has_active,
    CASE WHEN _has_active THEN pci.phone ELSE NULL END
  FROM public.profiles p
  LEFT JOIN public.player_contact_info pci ON pci.user_id = p.user_id
  WHERE p.user_id = _player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_owner_player_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_player_profile(uuid) TO authenticated;
