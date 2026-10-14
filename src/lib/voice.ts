import { supabase } from "@/integrations/supabase/client";
import { blobToBase64 } from "@/lib/audio";

export const DM_MAX_MS = 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Thread {
  other_id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  last_at: string;
  last_from_me: boolean;
  last_state: "delivered" | "opened" | "expired";
  unheard: number;
  last_kind: "voice" | "text" | "photo";
  last_body: string | null;
}

/** A DM: a voice (listen once; `duration_ms`), a text (`body`) or a photo (`image_path`, private `dm-photos`). */
export interface VoiceMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  duration_ms: number | null;
  body: string | null;
  image_path: string | null;
  /** Signed URL of the photo (1 h). */
  image_url?: string | null;
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
  // `other` comes from the URL and goes into a PostgREST filter string.
  if (!UUID.test(other)) return [];
  const { data, error } = await supabase
    .from("voice_messages")
    .select("id, sender_id, recipient_id, duration_ms, body, image_path, created_at, opened_at, expired_at")
    .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows: VoiceMessage[] = (data ?? []).reverse();
  const paths = rows.map((m) => m.image_path).filter((p): p is string => !!p);
  if (paths.length) {
    const signed = await supabase.storage.from("dm-photos").createSignedUrls(paths, 3600);
    const url = new Map((signed.data ?? []).map((x) => [x.path, x.signedUrl]));
    for (const m of rows) if (m.image_path) m.image_url = url.get(m.image_path) ?? null;
  }
  return rows;
}

export const DM_TEXT_MAX = 1000;

/** A text and / or a photo (already resized): the photo goes to dm-photos/<me>/…, removed again if sending fails. */
export async function sendDm(me: string, to: string, msg: { text?: string; photo?: Blob }) {
  const bucket = supabase.storage.from("dm-photos");
  const path = msg.photo ? `${me}/${crypto.randomUUID()}.${msg.photo.type === "image/png" ? "png" : "jpg"}` : undefined;
  if (path) {
    const up = await bucket.upload(path, msg.photo!, { contentType: msg.photo!.type || "image/jpeg", upsert: false });
    if (up.error) throw new Error(up.error.message);
  }
  const { error } = await supabase.rpc("send_dm", { p_to: to, p_body: msg.text?.trim() || undefined, p_image: path });
  if (error) {
    if (path) await bucket.remove([path]);
    throw new Error(error.message);
  }
}

/** Opening a conversation marks its texts and photos read. */
export async function readThread(other: string) {
  await supabase.rpc("read_dm_thread", { p_other: other });
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
