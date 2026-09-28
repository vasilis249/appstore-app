
-- 1) Court pricing zones
CREATE TABLE public.court_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Ζώνη',
  start_hour smallint NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour smallint NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
  price_per_hour numeric(8,2) NOT NULL CHECK (price_per_hour >= 0),
  days_mask smallint NOT NULL DEFAULT 127, -- bitmask: bit 0=Mon … bit 6=Sun, 127 = all days
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_hour > start_hour)
);
GRANT SELECT ON public.court_pricing TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.court_pricing TO authenticated;
GRANT ALL ON public.court_pricing TO service_role;
ALTER TABLE public.court_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pricing readable by all" ON public.court_pricing FOR SELECT USING (true);
CREATE POLICY "Owners manage pricing" ON public.court_pricing FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.courts c
    JOIN public.venues v ON v.id = c.venue_id
    WHERE c.id = court_pricing.court_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.courts c
    JOIN public.venues v ON v.id = c.venue_id
    WHERE c.id = court_pricing.court_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ));

CREATE TRIGGER court_pricing_updated_at BEFORE UPDATE ON public.court_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Venue opening hours
CREATE TABLE public.venue_hours (
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon … 6=Sun
  is_open boolean NOT NULL DEFAULT true,
  open_time time NOT NULL DEFAULT '08:00',
  close_time time NOT NULL DEFAULT '23:00',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venue_id, day_of_week)
);
GRANT SELECT ON public.venue_hours TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.venue_hours TO authenticated;
GRANT ALL ON public.venue_hours TO service_role;
ALTER TABLE public.venue_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hours readable by all" ON public.venue_hours FOR SELECT USING (true);
CREATE POLICY "Owners manage hours" ON public.venue_hours FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.venues v WHERE v.id = venue_hours.venue_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.venues v WHERE v.id = venue_hours.venue_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ));

-- 3) Venue photos
CREATE TABLE public.venue_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.venue_photos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.venue_photos TO authenticated;
GRANT ALL ON public.venue_photos TO service_role;
ALTER TABLE public.venue_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photos readable by all" ON public.venue_photos FOR SELECT USING (true);
CREATE POLICY "Owners manage photos" ON public.venue_photos FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.venues v WHERE v.id = venue_photos.venue_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.venues v WHERE v.id = venue_photos.venue_id
      AND (v.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ));

-- 4) Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users mark own notifications read" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 5) Trigger to notify owner on new online booking
CREATE OR REPLACE FUNCTION public.notify_owner_on_online_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_name text;
  v_player_name text;
BEGIN
  IF NEW.type <> 'online' THEN
    RETURN NEW;
  END IF;

  SELECT v.owner_id, v.name INTO v_owner, v_name
  FROM public.venues v WHERE v.id = NEW.venue_id;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.full_name INTO v_player_name
  FROM public.profiles p WHERE p.user_id = NEW.player_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_owner,
    'booking_online',
    'Νέα online κράτηση',
    COALESCE(v_player_name, 'Παίκτης') || ' · ' || to_char(NEW.date,'DD/MM') || ' ' || to_char(NEW.start_time,'HH24:MI') || ' · ' || v_name,
    jsonb_build_object(
      'booking_id', NEW.id,
      'venue_id', NEW.venue_id,
      'date', NEW.date,
      'start_time', NEW.start_time
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_notify_owner
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_online_booking();
