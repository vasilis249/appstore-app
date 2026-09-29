import { supabase } from "@/integrations/supabase/client";
import { blobToBase64 } from "@/lib/audio";

export const DM_MAX_MS = 60_000;

export interface Thread {
  other_id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  last_at: string;
  last_from_me: boolean;
  last_state: "delivered" | "opened" | "expired";
  unheard: number;
}

export interface VoiceMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  duration_ms: number;
  created_at: string;
  opened_at: string | null;
  expired_at: string | null;
}

export const voiceKeys = {
  all: ["voice"] as const,
  threads: ["voice", "threads"] as const,
  thread: (otherId: string) => ["voice", "thread", otherId] as const,
};

export async function listThreads(): Promise<Thread[]> {
  const { data, error } = await supabase.rpc("my_threads");
  if (error) throw new Error(error.message);
  return (data ?? []) as Thread[];
}

/** Latest 50 messages with one person, oldest first. */
export async function listThread(me: string, other: string): Promise<VoiceMessage[]> {
  const { data, error } = await supabase
    .from("voice_messages")
    .select("id, sender_id, recipient_id, duration_ms, created_at, opened_at, expired_at")
    .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).reverse();
}

export async function sendVoice(to: string, clip: { blob: Blob; mime: string; durationMs: number }) {
  const { error } = await supabase.rpc("send_voice_message", {
    p_to: to,
    p_audio_b64: await blobToBase64(clip.blob),
    p_mime: clip.mime,
    p_duration_ms: Math.max(300, Math.round(clip.durationMs)),
  });
  if (error) throw new Error(error.message);
}

/** Listen once: the server returns the audio and deletes it. */
export async function consumeVoice(id: string): Promise<{ mime: string; audio_b64: string; duration_ms: number }> {
  const { data, error } = await supabase.rpc("consume_voice_message", { p_id: id });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  if (!row) throw new Error("not_available");
  return row;
}
