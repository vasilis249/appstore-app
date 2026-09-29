import { supabase } from "@/integrations/supabase/client";

export const POST_MAX_MS = 120_000;
export const TITLE_MAX = 100;

export type FeedScope = "all" | "following" | "section" | "topic" | "author" | "replies" | "one";

/** One row of feed_posts(). Plain reposts have no audio; the original is in orig_*. */
export interface FeedRow {
  post_id: string;
  created_at: string;
  author_id: string;
  author_username: string;
  author_name: string;
  author_avatar: string | null;
  section_id: string;
  topic_id: string | null;
  topic_title: string | null;
  reply_to: string | null;
  repost_of: string | null;
  title: string | null;
  audio_path: string | null;
  duration_ms: number | null;
  likes_count: number;
  replies_count: number;
  reposts_count: number;
  listens_count: number;
  liked: boolean;
  reposted: boolean;
  is_mine: boolean;
  orig_author_username: string | null;
  orig_author_name: string | null;
  orig_author_avatar: string | null;
  orig_title: string | null;
  orig_audio_path: string | null;
  orig_duration_ms: number | null;
  orig_created_at: string | null;
  orig_author_id: string | null;
  orig_likes_count: number | null;
  orig_replies_count: number | null;
  orig_reposts_count: number | null;
  orig_listens_count: number | null;
}

/** What a card shows: the post itself, or — for a plain repost — the original, credited to the reposter. */
export interface PostView {
  id: string;
  authorId: string;
  username: string;
  name: string;
  avatar: string | null;
  createdAt: string;
  sectionId: string;
  topicId: string | null;
  topicTitle: string | null;
  replyTo: string | null;
  title: string | null;
  path: string;
  durationMs: number;
  likes: number;
  replies: number;
  reposts: number;
  listens: number;
  liked: boolean;
  reposted: boolean;
  repostedBy: { name: string; mine: boolean } | null;
  quote: { id: string; name: string; username: string; title: string | null; durationMs: number } | null;
  /** The feed row (for delete / menus). */
  row: FeedRow;
}

export function toView(row: FeedRow): PostView | null {
  if (row.audio_path && row.duration_ms) {
    return {
      id: row.post_id, authorId: row.author_id, username: row.author_username, name: row.author_name || row.author_username,
      avatar: row.author_avatar, createdAt: row.created_at, sectionId: row.section_id, topicId: row.topic_id,
      topicTitle: row.topic_title, replyTo: row.reply_to, title: row.title, path: row.audio_path, durationMs: row.duration_ms,
      likes: row.likes_count, replies: row.replies_count, reposts: row.reposts_count, listens: row.listens_count,
      liked: row.liked, reposted: row.reposted, repostedBy: null,
      quote: row.repost_of && row.orig_author_username
        ? { id: row.repost_of, name: row.orig_author_name || row.orig_author_username, username: row.orig_author_username,
            title: row.orig_title, durationMs: row.orig_duration_ms ?? 0 }
        : null,
      row,
    };
  }
  if (row.repost_of && row.orig_audio_path && row.orig_duration_ms && row.orig_author_id && row.orig_author_username) {
    return {
      id: row.repost_of, authorId: row.orig_author_id, username: row.orig_author_username,
      name: row.orig_author_name || row.orig_author_username, avatar: row.orig_author_avatar,
      createdAt: row.orig_created_at ?? row.created_at, sectionId: row.section_id, topicId: null, topicTitle: null,
      replyTo: null, title: row.orig_title, path: row.orig_audio_path, durationMs: row.orig_duration_ms,
      likes: row.orig_likes_count ?? 0, replies: row.orig_replies_count ?? 0, reposts: row.orig_reposts_count ?? 0,
      listens: row.orig_listens_count ?? 0, liked: row.liked, reposted: row.reposted,
      repostedBy: { name: row.author_name || row.author_username, mine: row.is_mine }, quote: null, row,
    };
  }
  return null;
}

export interface FeedParams {
  scope: FeedScope;
  section?: string;
  topic?: string;
  author?: string;
  parent?: string;
}

export interface Section {
  id: string;
  position: number;
  name_el: string;
  name_en: string;
  icon: string;
}

export interface Topic {
  id: string;
  section_id: string;
  kind: "topic" | "news" | "daily";
  title: string;
  summary?: string | null;
  source_name: string | null;
  source_url: string | null;
  created_at: string;
  posts_count: number;
  recent_posts?: number;
}

export const postKeys = {
  all: ["posts"] as const,
  feed: (p: FeedParams) => ["posts", "feed", p] as const,
  sections: ["sections"] as const,
  trending: (section?: string) => ["posts", "trending", section ?? "all"] as const,
  topic: (id: string) => ["posts", "topic", id] as const,
};

const PAGE = 20;

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function fetchFeed(p: FeedParams, before?: string): Promise<FeedRow[]> {
  const { data, error } = await supabase.rpc("feed_posts", {
    p_scope: p.scope,
    p_section: p.section,
    p_topic: p.topic,
    p_author: p.author,
    p_parent: p.parent,
    p_before: before,
    p_limit: PAGE,
  });
  fail(error);
  return (data ?? []) as FeedRow[];
}

/** Cursor for useInfiniteQuery: the last row's time when the page was full. */
export function nextCursor(page: FeedRow[]): string | undefined {
  return page.length === PAGE ? page[page.length - 1].created_at : undefined;
}

export async function listSections(): Promise<Section[]> {
  const { data, error } = await supabase.from("sections").select("*").order("position");
  fail(error);
  return data ?? [];
}

export async function trendingTopics(section?: string, limit = 10): Promise<Topic[]> {
  const { data, error } = await supabase.rpc("trending_topics", { p_section: section, p_limit: limit });
  fail(error);
  return (data ?? []) as Topic[];
}

export async function getTopic(id: string): Promise<Topic | null> {
  const { data, error } = await supabase
    .from("topics")
    .select("id, section_id, kind, title, summary, source_name, source_url, created_at, posts_count")
    .eq("id", id)
    .maybeSingle();
  fail(error);
  return data as Topic | null;
}

export function voiceUrl(path: string): string {
  return supabase.storage.from("voices").getPublicUrl(path).data.publicUrl;
}

const EXT: Record<string, string> = { "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/mpeg": "mp3", "audio/webm": "webm", "audio/ogg": "ogg" };

/** Upload to voices/<uid>/… then create the post; the file is removed if that fails. */
export async function createPost(
  uid: string,
  clip: { blob: Blob; mime: string; durationMs: number },
  opts: { section?: string; topic?: string; replyTo?: string; quoteOf?: string; title?: string },
): Promise<string> {
  const path = `${uid}/${crypto.randomUUID()}.${EXT[clip.mime] ?? "m4a"}`;
  const bucket = supabase.storage.from("voices");
  const up = await bucket.upload(path, clip.blob, { contentType: clip.mime, upsert: false });
  fail(up.error);
  const { data, error } = await supabase.rpc("create_post", {
    p_section: opts.section,
    p_topic: opts.topic,
    p_reply_to: opts.replyTo,
    p_repost_of: opts.quoteOf,
    p_title: opts.title?.trim() || undefined,
    p_path: path,
    p_mime: clip.mime,
    p_duration_ms: Math.min(POST_MAX_MS, Math.max(1000, Math.round(clip.durationMs))),
  });
  if (error) {
    await bucket.remove([path]);
    throw new Error(error.message);
  }
  return data as string;
}

export async function repost(postId: string) {
  fail((await supabase.rpc("create_post", { p_repost_of: postId })).error);
}
export async function unrepost(postId: string) {
  fail((await supabase.rpc("unrepost", { p_post: postId })).error);
}
export async function setLiked(postId: string, liked: boolean) {
  fail((await supabase.rpc(liked ? "like_post" : "unlike_post", { p_post: postId })).error);
}
export async function recordListen(postId: string) {
  await supabase.rpc("record_listen", { p_post: postId });
}
export async function deletePost(row: Pick<FeedRow, "post_id" | "audio_path">) {
  fail((await supabase.from("posts").delete().eq("id", row.post_id)).error);
  if (row.audio_path) await supabase.storage.from("voices").remove([row.audio_path]);
}
