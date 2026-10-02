import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/hooks/use-my-profile";

/**
 * Speak is for verified students (and admins): true / false, or undefined while it isn't known yet. A verified
 * profile is enough; otherwise the server decides (am_i_student = private.is_student: admins, the gate flag).
 */
export function useIsStudent(): boolean | undefined {
  const me = useMyProfile();
  const verified = !!me.data?.university_id;
  const q = useQuery({
    queryKey: ["am_i_student", me.data?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("am_i_student");
      if (error) throw error;
      return !!data;
    },
    enabled: !!me.data && !verified,
  });
  if (!me.data) return undefined;
  if (verified) return true;
  return q.isFetched ? !!q.data : undefined;
}
