
ALTER TABLE public.open_games
  ADD COLUMN IF NOT EXISTS booking_id UUID UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_open_games_booking_id ON public.open_games(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_venue_date ON public.bookings(venue_id, date);
