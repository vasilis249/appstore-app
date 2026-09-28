
ALTER FUNCTION public.create_slot_booking(uuid, date, time, numeric, int) SECURITY INVOKER;
ALTER FUNCTION public.create_whole_booking(uuid, date, time, numeric) SECURITY INVOKER;
