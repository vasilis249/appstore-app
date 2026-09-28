DROP FUNCTION IF EXISTS public.create_slot_booking(uuid, date, time without time zone, numeric, integer);
DROP FUNCTION IF EXISTS public.create_whole_booking(uuid, date, time without time zone, numeric);

GRANT EXECUTE ON FUNCTION public.create_slot_booking(uuid, date, time without time zone, numeric, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_whole_booking(uuid, date, time without time zone, numeric, uuid) TO authenticated;