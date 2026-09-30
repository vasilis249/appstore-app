import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { friendKeys } from "@/lib/friends";
import { STUDENT_COLUMNS, type StudentFields } from "@/lib/campus";

export interface MyProfile extends StudentFields {
  id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
}

export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: friendKeys.me,
    enabled: !!user,
    queryFn: async (): Promise<MyProfile> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`id, username, full_name, avatar_path, ${STUDENT_COLUMNS}`)
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
