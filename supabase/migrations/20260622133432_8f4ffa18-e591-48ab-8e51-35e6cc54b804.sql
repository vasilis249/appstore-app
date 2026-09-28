REVOKE EXECUTE ON FUNCTION public.create_slot_booking(uuid, date, time without time zone, numeric, integer, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_slot_booking(uuid, date, time without time zone, numeric, integer, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_whole_booking(uuid, date, time without time zone, numeric, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_whole_booking(uuid, date, time without time zone, numeric, uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.create_slot_booking(uuid, date, time without time zone, numeric, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_whole_booking(uuid, date, time without time zone, numeric, uuid) TO authenticated;