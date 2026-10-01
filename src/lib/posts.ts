import { supabase } from "@/integrations/supabase/client";
import { sweepVoiceFilesLater } from "@/lib/api/voice-files.functions";

export const POST_MAX_MS = 120_000;
export const TITLE_MAX = 100;

export type FeedScope =
  | "foryou" | "all" | "following" | "section" | "topic" | "author" | "author_replies" | "replies" | "one" | "ids"
  | "group" | "groups" | "news" | "personal" | "loose" | "campus";

/** One row of feed_posts(). Plain reposts have no audio; the original is in orig_*. */
export interface FeedRow {
  post_id: string;
  created_at: string;
  author_id: string;
  author_username: string;
  author_name: string;
  author_avatar: string | null;
  /** null = a personal voice (not filed under news). */
  section_id: string | null;
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
  reply_to_username: string | null;
  group_id: string | null;
  group_name: string | null;
  /** A voice its author deleted after others answered it: kept (no author, no audio) so the thread reads on. */
  deleted: boolean;
  /** A quote whose original was deleted. */
  orig_deleted: boolean;
  /** Set on campus voices (heard only by that university's students). */
  university_id: string | null;
  author_university_id: string | null;
  author_department_id: string | null;
}

/** What a card shows: the post itself, or — for a plain repost — the original, credited to the reposter. */
export interface PostView {
  id: string;
  authorId: string;
  username: string;
  name: string;
  avatar: string | null;
  createdAt: string;
  sectionId: string | null;
  topicId: string | null;
  topicTitle: string | null;
  replyTo: string | null;
  replyToUsername: string | null;
  /** Voices inside a group show the group instead of the section. */
  groupId: string | null;
  groupName: string | null;
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
  quote: { id: string; name: string; username: string; title: string | null; durationMs: number; deleted: boolean } | null;
  /** "This voice was deleted" (only inside a conversation). */
  deleted: boolean;
  /** Campus voice: the university it belongs to. */
  campus: string | null;
  /** The author's university / school (badge). */
  authorSchool: { university: string | null; department: string | null };
  /** The feed row (for delete / menus). */
  row: FeedRow;
}

export function toView(row: FeedRow): PostView | null {
  if (row.deleted) {
    return {
      id: row.post_id, authorId: "", username: "", name: "", avatar: null, createdAt: row.created_at,
      sectionId: row.section_id, topicId: null, topicTitle: null, replyTo: row.reply_to, replyToUsername: null,
      groupId: row.group_id, groupName: row.group_name, title: null, path: "", durationMs: 0, likes: 0,
      replies: row.replies_count, reposts: 0, listens: 0, liked: false, reposted: false, repostedBy: null, quote: null,
      deleted: true, campus: row.university_id, authorSchool: { university: null, department: null }, row,
    };
  }
  if (row.audio_path && row.duration_ms) {
    return {
      id: row.post_id, authorId: row.author_id, username: row.author_username, name: row.author_name || row.author_username,
      avatar: row.author_avatar, createdAt: row.created_at, sectionId: row.section_id, topicId: row.topic_id,
      topicTitle: row.topic_title, replyTo: row.reply_to, replyToUsername: row.reply_to_username,
      groupId: row.group_id, groupName: row.group_name, title: row.title, path: row.audio_path, durationMs: row.duration_ms,
      likes: row.likes_count, replies: row.replies_count, reposts: row.reposts_count, listens: row.listens_count,
      liked: row.liked, reposted: row.reposted, repostedBy: null,
      quote: row.repost_of && row.orig_deleted
        ? { id: row.repost_of, name: "", username: "", title: null, durationMs: 0, deleted: true }
        : row.repost_of && row.orig_author_username
          ? { id: row.repost_of, name: row.orig_author_name || row.orig_author_username, username: row.orig_author_username,
              title: row.orig_title, durationMs: row.orig_duration_ms ?? 0, deleted: false }
          : null,
      deleted: false,
      campus: row.university_id,
      authorSchool: { university: row.author_university_id, department: row.author_department_id },
      row,
    };
  }
  if (row.repost_of && row.orig_audio_path && row.orig_duration_ms && row.orig_author_id && row.orig_author_username) {
    return {
      id: row.repost_of, authorId: row.orig_author_id, username: row.orig_author_username,
      name: row.orig_author_name || row.orig_author_username, avatar: row.orig_author_avatar,
      createdAt: row.orig_created_at ?? row.created_at, sectionId: row.section_id, topicId: null, topicTitle: null,
      replyTo: null, replyToUsername: null, groupId: null, groupName: null, title: row.orig_title, path: row.orig_audio_path, durationMs: row.orig_duration_ms,
      likes: row.orig_likes_count ?? 0, replies: row.orig_replies_count ?? 0, reposts: row.orig_reposts_count ?? 0,
      listens: row.orig_listens_count ?? 0, liked: row.liked, reposted: row.reposted,
      repostedBy: { name: row.author_name || row.author_username, mine: row.is_mine }, quote: null, deleted: false,
      campus: null, authorSchool: { university: null, department: null }, row,
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
  ids?: string[];
  group?: string;
}

export interface Section {
  id: string;
  position: number;
  name_el: string;
  name_en: string;
  icon: string;
  kind: "news" | "campus";
  hidden: boolean;
}

export interface Topic {
  id: string;
  section_id: string;
  kind: "topic" | "news" | "daily";
  title: string;
  summary?: string | null;
  source_name: string | null;
  source_url: string | null;
  image_url?: string | null;
  created_at: string;
  posts_count: number;
  recent_posts?: number;
}

/** A headline card on Home → News: cover photo, title, who spoke. */
export interface NewsTopic extends Topic {
  image_url: string | null;
  last_post_at: string | null;
  speakers_count: number;
  speakers: { name: string; avatar_path: string | null }[];
  /** campus_topics only: the campus's topic of the day. */
  is_daily?: boolean;
}

export const postKeys = {
  all: ["posts"] as const,
  feed: (p: FeedParams) => ["posts", "feed", p] as const,
  sections: ["sections"] as const,
  trending: (section?: string) => ["posts", "trending", section ?? "all"] as const,
  topic: (id: string) => ["posts", "topic", id] as const,
  news: (section?: string) => ["posts", "news", section ?? "all"] as const,
  campusTopics: (section?: string) => ["posts", "campus-topics", section ?? "all"] as const,
};

const PAGE = 20;

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** `cursor` = the last row's time, or — for the ranked "foryou" feed — how many rows are loaded. */
export async function fetchFeed(p: FeedParams, cursor?: string | number): Promise<FeedRow[]> {
  const { data, error } = await supabase.rpc("feed_posts", {
    p_scope: p.scope,
    p_section: p.section,
    p_topic: p.topic,
    p_author: p.author,
    p_parent: p.parent,
    p_ids: p.ids,
    p_group: p.group,
    p_before: typeof cursor === "string" ? cursor : undefined,
    p_offset: typeof cursor === "number" ? cursor : undefined,
    p_limit: PAGE,
  });
  fail(error);
  return (data ?? []) as FeedRow[];
}

/** Cursor for useInfiniteQuery: none after a short page; offset for the ranked feeds, else the last row's time. */
export function nextCursor(scope: FeedScope, page: FeedRow[], pages: FeedRow[][]): string | number | undefined {
  if (page.length < PAGE) return undefined;
  return scope === "foryou" || scope === "news" ? pages.reduce((n, pg) => n + pg.length, 0) : page[page.length - 1].created_at;
}

/** The reply chain above a post, root first. */
export async function fetchAncestors(postId: string): Promise<FeedRow[]> {
  const { data: ids, error } = await supabase.rpc("post_ancestors", { p_post: postId });
  fail(error);
  if (!ids?.length) return [];
  return fetchFeed({ scope: "ids", ids: ids as string[] });
}

export async function listSections(): Promise<Section[]> {
  const { data, error } = await supabase.from("sections").select("*").order("position");
  fail(error);
  return (data ?? []) as Section[];
}

export async function trendingTopics(section?: string, limit = 10): Promise<Topic[]> {
  const { data, error } = await supabase.rpc("trending_topics", { p_section: section, p_limit: limit });
  fail(error);
  return (data ?? []) as Topic[];
}

export const NEWS_PAGE = 15;

export async function newsTopics(section: string | undefined, offset: number): Promise<NewsTopic[]> {
  const { data, error } = await supabase.rpc("news_topics", { p_section: section, p_limit: NEWS_PAGE, p_offset: offset });
  fail(error);
  return (data ?? []) as unknown as NewsTopic[];
}

/** Your campus's topics (its topic of the day first). */
export async function campusTopics(section: string | undefined, limit = 5): Promise<NewsTopic[]> {
  const { data, error } = await supabase.rpc("campus_topics", { p_section: section, p_limit: limit });
  fail(error);
  return (data ?? []) as unknown as NewsTopic[];
}

export async function getTopic(id: string): Promise<Topic | null> {
  const { data, error } = await supabase
    .from("topics")
    .select("id, section_id, kind, title, summary, source_name, source_url, image_url, created_at, posts_count")
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
  opts: { section?: string; topic?: string; replyTo?: string; quoteOf?: string; title?: string; group?: string; campus?: boolean },
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
    p_group: opts.group,
    p_campus: opts.campus || undefined,
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
/**
 * Delete your voice. One that others answered or quoted stays as "deleted" so their voices keep their place;
 * the audio goes either way.
 */
export async function deletePost(row: Pick<FeedRow, "post_id" | "audio_path">) {
  fail((await supabase.rpc("delete_post", { p_post: row.post_id })).error);
  if (row.audio_path) await supabase.storage.from("voices").remove([row.audio_path]);
  sweepVoiceFilesLater(); // and anything else left behind (e.g. a deleted group's voices)
}
