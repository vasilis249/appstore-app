
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS formatted_address text;
