import { supabase } from "@/integrations/supabase/client";

export const POST_MAX_MS = 90_000;

export interface Today {
  moment: string;
  prompt_at: string;
  next_prompt_at: string;
  my_post_id: string | null;
  unlocked: boolean;
}

export interface FeedPost {
  post_id: string;
  user_id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  created_at: string;
  duration_ms: number;
  late: boolean;
  /** null while the feed is locked (you haven't posted in the current moment). */
  audio_path: string | null;
  is_mine: boolean;
}

export const dailyKeys = {
  all: ["daily"] as const,
  today: ["daily", "today"] as const,
  feed: ["daily", "feed"] as const,
};

export async function getToday(): Promise<Today> {
  const { data, error } = await supabase.rpc("today");
  if (error) throw new Error(error.message);
  return (data ?? [])[0] as Today;
}

export async function getFeed(): Promise<FeedPost[]> {
  const { data, error } = await supabase.rpc("feed");
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedPost[];
}

const EXT: Record<string, string> = { "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/mpeg": "mp3", "audio/webm": "webm", "audio/ogg": "ogg" };

/** Upload the clip to daily-posts/<uid>/…, then publish it (the file is removed if publishing fails). */
export async function publishDaily(uid: string, clip: { blob: Blob; mime: string; durationMs: number }) {
  const path = `${uid}/${Date.now()}.${EXT[clip.mime] ?? "m4a"}`;
  const bucket = supabase.storage.from("daily-posts");
  const up = await bucket.upload(path, clip.blob, { contentType: clip.mime, upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { error } = await supabase.rpc("publish_daily_post", {
    p_path: path,
    p_mime: clip.mime,
    p_duration_ms: Math.max(1000, Math.round(clip.durationMs)),
  });
  if (error) {
    await bucket.remove([path]);
    throw new Error(error.message);
  }
}

export async function deleteDaily(post: { post_id: string; audio_path: string | null }) {
  const { error } = await supabase.from("daily_posts").delete().eq("id", post.post_id);
  if (error) throw new Error(error.message);
  if (post.audio_path) await supabase.storage.from("daily-posts").remove([post.audio_path]);
}

/** Download a post's audio (the storage policy decides whether you may). */
export async function fetchPostAudio(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from("daily-posts").createSignedUrl(path, 120);
  if (error || !data) throw new Error(error?.message ?? "not_found");
  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error("not_found");
  return res.blob();
}
