DROP TRIGGER IF EXISTS bookings_notify_owner ON public.bookings;
DROP FUNCTION IF EXISTS public.notify_owner_on_online_booking();