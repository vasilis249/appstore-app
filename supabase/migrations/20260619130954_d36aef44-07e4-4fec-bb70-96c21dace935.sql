-- 1) Equipment offered by a venue
CREATE TABLE public.venue_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.venue_equipment TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.venue_equipment TO authenticated;
GRANT ALL ON public.venue_equipment TO service_role;

ALTER TABLE public.venue_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read equipment of approved venues"
ON public.venue_equipment FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.approved = true)
);

CREATE POLICY "Owners can read own venue equipment"
ON public.venue_equipment FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid())
);

CREATE POLICY "Owners insert own venue equipment"
ON public.venue_equipment FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid())
);

CREATE POLICY "Owners update own venue equipment"
ON public.venue_equipment FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid())
);

CREATE POLICY "Owners delete own venue equipment"
ON public.venue_equipment FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid())
);

CREATE TRIGGER update_venue_equipment_updated_at
BEFORE UPDATE ON public.venue_equipment
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_venue_equipment_venue ON public.venue_equipment(venue_id);

-- 2) Equipment chosen per booking (price snapshot = owner-set price at booking time)
CREATE TABLE public.booking_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES public.venue_equipment(id) ON DELETE SET NULL,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.booking_equipment TO authenticated;
GRANT ALL ON public.booking_equipment TO service_role;

ALTER TABLE public.booking_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players read own booking equipment"
ON public.booking_equipment FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
      AND (
        b.player_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.venues v
          WHERE v.id = b.venue_id AND v.owner_id = auth.uid()
        )
      )
  )
);

CREATE INDEX idx_booking_equipment_booking ON public.booking_equipment(booking_id);