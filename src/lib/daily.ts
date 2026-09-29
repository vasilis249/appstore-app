import { supabase } from "@/integrations/supabase/client";

/** The daily prompt ("moment"): same time for everyone, used for the reminder and the in-app notice. */
export interface Today {
  moment: string;
  prompt_at: string;
  next_prompt_at: string;
  /** The day's topic: the admin's pick, otherwise today's most discussed fresh topic. */
  topic_id: string | null;
  topic_title: string | null;
  topic_section: string | null;
  topic_is_pick: boolean;
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
