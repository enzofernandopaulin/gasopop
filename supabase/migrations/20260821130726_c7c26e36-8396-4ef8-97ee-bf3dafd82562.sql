REVOKE ALL ON FUNCTION public.award_points(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_points(uuid, integer) TO service_role;