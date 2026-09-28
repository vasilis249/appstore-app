ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_cancelled_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    NEW.cancelled_at := now();
  ELSIF NEW.status <> 'cancelled' THEN
    NEW.cancelled_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_set_cancelled_at ON public.bookings;
CREATE TRIGGER bookings_set_cancelled_at
BEFORE UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.set_cancelled_at();

-- Backfill historical cancelled rows with updated_at as best estimate
UPDATE public.bookings SET cancelled_at = updated_at WHERE status = 'cancelled' AND cancelled_at IS NULL;