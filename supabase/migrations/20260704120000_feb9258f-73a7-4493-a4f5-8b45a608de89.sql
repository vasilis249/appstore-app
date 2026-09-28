-- ═══════════════════════════════════════════════════════════════════════════
-- Change #1 — Owner-facing player profile with privacy-gated contact phone
--
-- Why a NEW table for the phone instead of a column on public.profiles:
--   public.profiles has `SELECT USING (true)` granted to anon + authenticated,
--   so ANY column added there is world-readable via PostgREST. A phone number
--   must never live behind that policy. bookings.customer_phone is unrelated:
--   it is the owner-entered phone for offline/phone bookings, and players are
--   RLS-forced to keep it NULL on their own bookings.
--
-- Privacy rule (strict): an owner may read a player's phone ONLY while that
-- player has an ACTIVE booking at one of the owner's venues, where active is:
--   status = 'confirmed' AND (date + start_time) is in the future
--   (Europe/Athens local time — same convention as create_whole_booking).
-- `status = 'confirmed'` already excludes 'completed'/'cancelled'/'pending'
-- because booking_status is a single-valued enum. Enforcement is entirely
-- server-side in the SECURITY DEFINER RPC below; when the condition fails the
-- phone is NULL inside the database result and the API layer strips the key,
-- so it is never transmitted to the client.
--
-- Revert: DROP FUNCTION public.get_owner_player_profile(uuid);
--         DROP TABLE public.player_contact_info;
-- (No existing objects are modified — fully non-destructive.)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Private, player-managed contact details
CREATE TABLE public.player_contact_info (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT CHECK (phone IS NULL OR char_length(btrim(phone)) BETWEEN 6 AND 40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No anon grant on purpose: this table is never publicly readable.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_contact_info TO authenticated;
GRANT ALL ON public.player_contact_info TO service_role;

ALTER TABLE public.player_contact_info ENABLE ROW LEVEL SECURITY;

-- Players manage ONLY their own row. There is intentionally NO owner/admin
-- SELECT policy — owner access happens exclusively through the RPC below.
CREATE POLICY "Users read own contact info"
ON public.player_contact_info FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own contact info"
ON public.player_contact_info FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own contact info"
ON public.player_contact_info FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own contact info"
ON public.player_contact_info FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER trg_player_contact_info_updated
BEFORE UPDATE ON public.player_contact_info
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Owner-facing player profile RPC
--    Reads the EXISTING rating system (profiles.rating, maintained by
--    trg_recalc_rating from public.reviews) and the EXISTING level field
--    (profiles.level). Creates nothing new for either.
CREATE OR REPLACE FUNCTION public.get_owner_player_profile(_player_id UUID)
RETURNS TABLE (
  player_id UUID,
  full_name TEXT,
  photo_url TEXT,
  rating NUMERIC,
  level public.player_level,
  phone TEXT,
  has_active_booking BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_authorized BOOLEAN;
  v_active BOOLEAN;
BEGIN
  IF v_caller IS NULL THEN
    RETURN; -- not authenticated → empty result (no existence oracle)
  END IF;

  v_is_admin := public.has_role(v_caller, 'admin');

  -- Authorization: the caller owns at least one venue where this player has
  -- ever booked (any status), or is an admin. Otherwise return empty rather
  -- than raising, so the RPC does not confirm whether the player exists.
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.venues v ON v.id = b.venue_id
    WHERE b.player_id = _player_id
      AND v.owner_id = v_caller
  ) OR v_is_admin INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN;
  END IF;

  -- Strict phone-visibility condition. Deliberately scoped to venues the
  -- caller PERSONALLY owns (no admin shortcut): "active booking at THIS
  -- owner's venue" has no meaning for an admin who owns none.
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.venues v ON v.id = b.venue_id
    WHERE b.player_id = _player_id
      AND v.owner_id = v_caller
      AND b.status = 'confirmed'
      AND (b.date + b.start_time) > (now() AT TIME ZONE 'Europe/Athens')
  ) INTO v_active;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    p.photo_url,
    p.rating,
    p.level,
    CASE WHEN v_active THEN pci.phone ELSE NULL END,
    v_active
  FROM public.profiles p
  LEFT JOIN public.player_contact_info pci ON pci.user_id = p.user_id
  WHERE p.user_id = _player_id;
END;
$$;

COMMENT ON FUNCTION public.get_owner_player_profile(UUID) IS
  'Owner-scoped player profile. Phone is returned ONLY while the player has a confirmed, future booking at a venue the caller owns; otherwise NULL. Empty result when the caller is not authorized for this player.';

-- Same execution-privilege convention as the rest of the schema.
REVOKE EXECUTE ON FUNCTION public.get_owner_player_profile(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_owner_player_profile(UUID) TO authenticated;
