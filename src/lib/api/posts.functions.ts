import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { Sport } from "@/lib/sports";
import {
  followStates,
  type Db,
  type GridPost,
  type ProfileListItem,
} from "@/lib/api/social.functions";

// Posts, feed, explore, likes, saves and comments. Every read uses the caller's
// client, so RLS (can_view_profile / can_view_post) decides what is visible.

type PostRow = Database["public"]["Tables"]["posts"]["Row"];

export type PostAuthor = {
  user_id: string;
  username: string;
  full_name: string | null;
  photo_url: string | null;
};

export type FeedPost = {
  id: string;
  kind: "photo" | "match";
  caption: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  media: string[];
  author: PostAuthor;
  venue: { id: string; name: string; sport: Sport } | null;
  liked: boolean;
  saved: boolean;
  isMine: boolean;
};

export type PostComment = {
  id: string;
  body: string;
  created_at: string;
  author: PostAuthor;
  canDelete: boolean;
};

const MEDIA_BUCKET = "social-media";
const SIGNED_URL_TTL = 60 * 60;

async function signedUrls(supabase: Db, paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map();
  const { data } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  const out = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

async function authorsById(supabase: Db, ids: string[]): Promise<Map<string, PostAuthor>> {
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("user_id,username,full_name,photo_url")
    .in("user_id", Array.from(new Set(ids)));
  return new Map((data ?? []).map((p) => [p.user_id, p as PostAuthor]));
}

async function hydrate(supabase: Db, me: string, rows: PostRow[]): Promise<FeedPost[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const venueIds = Array.from(new Set(rows.map((r) => r.venue_id).filter((v): v is string => !!v)));
  const [authors, urls, likes, saves, venues] = await Promise.all([
    authorsById(
      supabase,
      rows.map((r) => r.author_id),
    ),
    signedUrls(
      supabase,
      rows.flatMap((r) => r.media),
    ),
    supabase.from("post_likes").select("post_id").eq("user_id", me).in("post_id", ids),
    supabase.from("post_saves").select("post_id").eq("user_id", me).in("post_id", ids),
    venueIds.length
      ? supabase.from("venues").select("id,name,sport").in("id", venueIds)
      : Promise.resolve({ data: [] as { id: string; name: string; sport: Sport }[] }),
  ]);
  const liked = new Set((likes.data ?? []).map((l) => l.post_id));
  const saved = new Set((saves.data ?? []).map((l) => l.post_id));
  const venueById = new Map((venues.data ?? []).map((v) => [v.id, v as FeedPost["venue"]]));
  return rows
    .filter((r) => authors.has(r.author_id))
    .map((r) => ({
      id: r.id,
      kind: r.kind as FeedPost["kind"],
      caption: r.caption,
      created_at: r.created_at,
      like_count: r.like_count,
      comment_count: r.comment_count,
      media: r.media.map((m) => urls.get(m)).filter((u): u is string => !!u),
      author: authors.get(r.author_id)!,
      venue: r.venue_id ? (venueById.get(r.venue_id) ?? null) : null,
      liked: liked.has(r.id),
      saved: saved.has(r.id),
      isMine: r.author_id === me,
    }));
}

async function toGrid(
  supabase: Db,
  rows: Pick<PostRow, "id" | "kind" | "media" | "like_count" | "comment_count">[],
): Promise<GridPost[]> {
  const urls = await signedUrls(supabase, rows.map((r) => r.media[0]).filter(Boolean) as string[]);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as GridPost["kind"],
    thumb: r.media[0] ? (urls.get(r.media[0]) ?? null) : null,
    mediaCount: r.media.length,
    like_count: r.like_count,
    comment_count: r.comment_count,
  }));
}

const cursorSchema = z.object({ before: z.string().datetime({ offset: true }).optional() });
const postIdSchema = z.object({ postId: z.string().uuid() });

export const listFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(cursorSchema)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.rpc("feed_posts", {
      _before: data.before,
      _limit: 10,
    });
    if (error) throw new Error(error.message);
    const posts = await hydrate(supabase, userId, (rows ?? []) as PostRow[]);
    return {
      posts,
      nextCursor: rows && rows.length === 10 ? rows[rows.length - 1].created_at : null,
    };
  });

export const listExplore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(cursorSchema)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("explore_posts", {
      _before: data.before,
      _limit: 30,
    });
    if (error) throw new Error(error.message);
    return {
      posts: await toGrid(supabase, rows ?? []),
      nextCursor: rows && rows.length === 30 ? rows[rows.length - 1].created_at : null,
    };
  });

/** Small thumbnails for posts referenced by notifications (RLS decides visibility). */
export const getPostThumbs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).max(100) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!data.ids.length) return {} as Record<string, string | null>;
    const { data: rows, error } = await supabase
      .from("posts")
      .select("id, kind, media, like_count, comment_count")
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    const grid = await toGrid(supabase, rows ?? []);
    return Object.fromEntries(grid.map((g) => [g.id, g.thumb])) as Record<string, string | null>;
  });

export const listSavedPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: saves } = await supabase
      .from("post_saves")
      .select("post_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(90);
    const ids = (saves ?? []).map((s) => s.post_id);
    if (!ids.length) return [];
    const { data: rows } = await supabase
      .from("posts")
      .select("id,kind,media,like_count,comment_count")
      .in("id", ids);
    const byId = new Map((rows ?? []).map((r) => [r.id, r]));
    return toGrid(
      supabase,
      ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r),
    );
  });

export const getPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(postIdSchema)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", data.postId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("post_not_found");
    const [post] = await hydrate(supabase, userId, [row]);
    if (!post) throw new Error("post_not_found");
    return post;
  });

export const listComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(postIdSchema)
  .handler(async ({ data, context }): Promise<PostComment[]> => {
    const { supabase, userId } = context;
    const [{ data: rows, error }, { data: post }] = await Promise.all([
      supabase
        .from("post_comments")
        .select("id,body,created_at,author_id")
        .eq("post_id", data.postId)
        .order("created_at", { ascending: true })
        .limit(300),
      supabase.from("posts").select("author_id").eq("id", data.postId).maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    const authors = await authorsById(
      supabase,
      (rows ?? []).map((r) => r.author_id),
    );
    const postIsMine = post?.author_id === userId;
    return (rows ?? [])
      .filter((r) => authors.has(r.author_id))
      .map((r) => ({
        id: r.id,
        body: r.body,
        created_at: r.created_at,
        author: authors.get(r.author_id)!,
        canDelete: postIsMine || r.author_id === userId,
      }));
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ postId: z.string().uuid(), body: z.string().trim().min(1).max(1000) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("post_comments")
      .insert({ post_id: data.postId, author_id: context.userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ commentId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("post_comments")
      .delete()
      .eq("id", data.commentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ postId: z.string().uuid(), on: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = data.on
      ? await supabase
          .from("post_likes")
          .upsert({ post_id: data.postId, user_id: userId }, { ignoreDuplicates: true })
      : await supabase.from("post_likes").delete().eq("post_id", data.postId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ postId: z.string().uuid(), on: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = data.on
      ? await supabase
          .from("post_saves")
          .upsert({ post_id: data.postId, user_id: userId }, { ignoreDuplicates: true })
      : await supabase.from("post_saves").delete().eq("post_id", data.postId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLikers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(postIdSchema)
  .handler(async ({ data, context }): Promise<ProfileListItem[]> => {
    const { supabase, userId } = context;
    const { data: likes } = await supabase
      .from("post_likes")
      .select("user_id")
      .eq("post_id", data.postId)
      .order("created_at", { ascending: false })
      .limit(300);
    const ids = (likes ?? []).map((l) => l.user_id);
    const [authors, states] = await Promise.all([
      authorsById(supabase, ids),
      followStates(supabase, userId, ids),
    ]);
    return ids
      .map((id) => authors.get(id))
      .filter((a): a is PostAuthor => !!a)
      .map((a) => ({
        ...a,
        following: a.user_id === userId ? "none" : (states.get(a.user_id) ?? "none"),
      }));
  });

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      media: z.array(z.string().min(1).max(300)).max(5),
      caption: z.string().trim().max(2200).nullable(),
      venueId: z.string().uuid().nullable(),
      bookingId: z.string().uuid().nullable(),
      openGameId: z.string().uuid().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const isMatch = !!(data.bookingId || data.openGameId);
    if (!isMatch && data.media.length === 0) throw new Error("media_required");
    const { error } = await supabase.from("posts").insert({
      id: data.id,
      author_id: userId,
      kind: isMatch ? "match" : "photo",
      caption: data.caption || null,
      media: data.media,
      venue_id: data.venueId,
      booking_id: data.bookingId,
      open_game_id: data.openGameId,
    });
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(postIdSchema)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("posts")
      .select("media")
      .eq("id", data.postId)
      .maybeSingle();
    const { error } = await supabase.from("posts").delete().eq("id", data.postId);
    if (error) throw new Error(error.message);
    if (row?.media.length) await supabase.storage.from(MEDIA_BUCKET).remove(row.media);
    return { ok: true };
  });

export type RecentMatch = {
  key: string;
  bookingId: string | null;
  openGameId: string | null;
  venueId: string;
  venueName: string;
  sport: Sport;
  date: string;
  start_time: string;
};

/** Games I played in the last 30 days, to tag a post as a match post. */
export const listMyRecentMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecentMatch[]> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: bookings }, { data: joined }] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("id,venue_id,date,start_time,courts(sport),venues(name)")
        .eq("player_id", userId)
        .in("status", ["confirmed", "completed"])
        .gte("date", since)
        .lte("date", today)
        .order("date", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("open_game_players")
        .select("open_games(id,venue_id,sport,date,start_time,venues(name))")
        .eq("player_id", userId)
        .limit(40),
    ]);
    type Joined = {
      id: string;
      venue_id: string;
      sport: Sport;
      date: string;
      start_time: string;
      venues: { name: string } | null;
    };
    const fromBookings: RecentMatch[] = (bookings ?? []).map((b) => {
      const court = b.courts as unknown as { sport: Sport } | null;
      const venue = b.venues as unknown as { name: string } | null;
      return {
        key: `b:${b.id}`,
        bookingId: b.id,
        openGameId: null,
        venueId: b.venue_id,
        venueName: venue?.name ?? "",
        sport: court?.sport ?? "padel",
        date: b.date,
        start_time: b.start_time,
      };
    });
    const fromGames: RecentMatch[] = (joined ?? [])
      .map((j) => j.open_games as unknown as Joined | null)
      .filter((g): g is Joined => !!g && g.date >= since && g.date <= today)
      .map((g) => ({
        key: `g:${g.id}`,
        bookingId: null,
        openGameId: g.id,
        venueId: g.venue_id,
        venueName: g.venues?.name ?? "",
        sport: g.sport,
        date: g.date,
        start_time: g.start_time,
      }));
    return [...fromBookings, ...fromGames].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);
  });

export const reportContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetType: z.enum(["post", "comment", "story", "profile"]),
      targetId: z.string().uuid(),
      reason: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("content_reports").insert({
      reporter_id: context.userId,
      target_type: data.targetType,
      target_id: data.targetId,
      reason: data.reason || null,
    });
    // Reporting the same thing twice is fine.
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true };
  });
