import { supabase } from "@/integrations/supabase/client";

/** A saved walkie transmission (kept 24 h). */
export interface WalkieItem {
  id: string;
  sender_id: string;
  duration_ms: number;
  created_at: string;
}

export const walkieKeys = {
  all: ["walkie"] as const,
  history: (peer: string) => ["walkie", "history", peer] as const,
};

export async function walkieHistory(peer: string): Promise<WalkieItem[]> {
  const { data, error } = await supabase.rpc("walkie_history", { p_other: peer, p_limit: 50 });
  if (error) throw new Error(error.message);
  return (data ?? []) as WalkieItem[];
}

export async function walkieAudio(id: string): Promise<{ mime: string; audio_b64: string }> {
  const { data, error } = await supabase.rpc("walkie_audio", { p_id: id });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  if (!row) throw new Error("not_available");
  return row;
}
