import { supabase } from "@/integrations/supabase/client";

/** The daily prompt ("moment"): same time for everyone, used for the reminder and the in-app notice. */
export interface Today {
  moment: string;
  prompt_at: string;
  next_prompt_at: string;
  my_post_id: string | null;
  unlocked: boolean;
}

export const dailyKeys = {
  all: ["daily"] as const,
  today: ["daily", "today"] as const,
};

export async function getToday(): Promise<Today> {
  const { data, error } = await supabase.rpc("today");
  if (error) throw new Error(error.message);
  return (data ?? [])[0] as Today;
}
