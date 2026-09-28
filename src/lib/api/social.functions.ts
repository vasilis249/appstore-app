import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Sport } from "@/lib/sports";

export type Db = SupabaseClient<Database>;

// Instagram-style profiles and follows. Reads go through the caller's Supabase
// client, so RLS (can_view_profile) decides what is visible. Only public
// aggregate counts use the service role, like follower counts on Instagram.

export type FollowState = "none" | "pending" | "accepted";

export type ProfileSummary = {
  user_id: string;
  username: string;
  full_name: string | null;
  photo_url: string | null;
  bio: string | null;
  level: string | null;
  rating: number | null;
  is_private: boolean;
};

export type ProfilePage = {
  profile: ProfileSummary;
  counts: { posts: number; followers: number; following: number; matches: number };
  matchesBySport: { sport: Sport; matches: number }[];
  relation: {
    isMe: boolean;
    following: FollowState;
    followsMe: boolean;
    canView: boolean;
  };
  pendingRequests: number;
};

export type ProfileListItem = Pick<
  ProfileSummary,
  "user_id" | "username" | "full_name" | "photo_url"
> & {
  following: FollowState;
};

export type GridPost = {
  id: string;
  kind: "photo" | "match";
  thumb: string | null;
  mediaCount: number;
  like_count: number;
  comment_count: number;
};

const PROFILE_COLS = "user_id,username,full_name,photo_url,bio,level,rating,is_private";
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._]{3,30}$/, "username_invalid");

export async function followStates(
  supabase: Db,
  me: string,
  ids: string[],
): Promise<Map<string, FollowState>> {
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from("follows")
    .select("following_id,status")
    .eq("follower_id", me)
    .in("following_id", ids);
  return new Map(
    ((data ?? []) as { following_id: string; status: FollowState }[]).map((r) => [
      r.following_id,
      r.status,
    ]),
  );
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ username: z.string().min(1).max(40) }))
  .handler(async ({ data, context }): Promise<ProfilePage> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const handle = data.username === "me" ? null : data.username.toLowerCase();

    let query = supabase.from("profiles").select(PROFILE_COLS).eq("disabled", false);
    query = handle ? query.eq("username", handle) : query.eq("user_id", userId);
    const { data: profile, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("profile_not_found");
    const id = profile.user_id;
    const isMe = id === userId;

    const [
      { data: canView },
      { data: stats },
      { count: posts },
      { count: followers },
      { count: following },
      { data: mine },
      { data: theirs },
      { count: pending },
    ] = await Promise.all([
      supabase.rpc("can_view_profile", { _viewer: userId, _target: id }),
      supabase.rpc("player_match_stats", { _user: id }),
      supabaseAdmin.from("posts").select("id", { count: "exact", head: true }).eq("author_id", id),
      supabaseAdmin
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", id)
        .eq("status", "accepted"),
      supabaseAdmin
        .from("follows")
        .select("following_id", { count: "exact", head: true })
        .eq("follower_id", id)
        .eq("status", "accepted"),
      supabase
        .from("follows")
        .select("status")
        .eq("follower_id", userId)
        .eq("following_id", id)
        .maybeSingle(),
      supabase
        .from("follows")
        .select("status")
        .eq("follower_id", id)
        .eq("following_id", userId)
        .eq("status", "accepted")
        .maybeSingle(),
      isMe
        ? supabase
            .from("follows")
            .select("follower_id", { count: "exact", head: true })
            .eq("following_id", userId)
            .eq("status", "pending")
        : Promise.resolve({ count: 0 }),
    ]);

    const bySport = ((stats ?? []) as { sport: Sport; matches: number }[])
      .map((s) => ({ sport: s.sport, matches: Number(s.matches) }))
      .sort((a, b) => b.matches - a.matches);

    return {
      profile: profile as ProfileSummary,
      counts: {
        posts: posts ?? 0,
        followers: followers ?? 0,
        following: following ?? 0,
        matches: bySport.reduce((n, s) => n + s.matches, 0),
      },
      matchesBySport: bySport,
      relation: {
        isMe,
        following: isMe ? "none" : ((mine?.status as FollowState | undefined) ?? "none"),
        followsMe: !!theirs,
        canView: !!canView,
      },
      pendingRequests: pending ?? 0,
    };
  });

export const listProfilePosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<GridPost[]> => {
    const { supabase } = context;
    // RLS returns nothing for a private profile the caller can't see.
    const { data: rows, error } = await supabase
      .from("posts")
      .select("id,kind,media,like_count,comment_count")
      .eq("author_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    const posts = rows ?? [];
    const firstPaths = posts.map((p) => p.media[0]).filter(Boolean) as string[];
    const signed = firstPaths.length
      ? ((await supabase.storage.from("social-media").createSignedUrls(firstPaths, 3600)).data ??
        [])
      : [];
    const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));
    return posts.map((p) => ({
      id: p.id,
      kind: p.kind as GridPost["kind"],
      thumb: p.media[0] ? (urlByPath.get(p.media[0]) ?? null) : null,
      mediaCount: p.media.length,
      like_count: p.like_count,
      comment_count: p.comment_count,
    }));
  });

async function listFollowSide(
  supabase: Db,
  me: string,
  userId: string,
  side: "followers" | "following",
): Promise<ProfileListItem[]> {
  const matchCol = side === "followers" ? "following_id" : "follower_id";
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id,following_id")
    .eq(matchCol, userId)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => (side === "followers" ? r.follower_id : r.following_id));
  if (!ids.length) return [];
  const [{ data: profs }, states] = await Promise.all([
    supabase.from("profiles").select("user_id,username,full_name,photo_url").in("user_id", ids),
    followStates(supabase, me, ids),
  ]);
  const byId = new Map(((profs ?? []) as ProfileListItem[]).map((p) => [p.user_id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is ProfileListItem => !!p)
    .map((p) => ({
      ...p,
      following: p.user_id === me ? "none" : (states.get(p.user_id) ?? "none"),
    }));
}

export const listFollowers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) =>
    listFollowSide(context.supabase, context.userId, data.userId, "followers"),
  );

export const listFollowing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) =>
    listFollowSide(context.supabase, context.userId, data.userId, "following"),
  );

export const listFollowRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileListItem[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((r) => r.follower_id);
    if (!ids.length) return [];
    const [{ data: profs }, states] = await Promise.all([
      supabase.from("profiles").select("user_id,username,full_name,photo_url").in("user_id", ids),
      followStates(supabase, userId, ids),
    ]);
    return ((profs ?? []) as ProfileListItem[]).map((p) => ({
      ...p,
      following: states.get(p.user_id) ?? "none",
    }));
  });

const targetSchema = z.object({ userId: z.string().uuid() });

export const followUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(targetSchema)
  .handler(async ({ data, context }) => {
    const { data: status, error } = await context.supabase.rpc("follow_user", {
      _target: data.userId,
    });
    if (error) throw new Error(error.message);
    return { status: status as FollowState };
  });

export const unfollowUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(targetSchema)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("unfollow_user", { _target: data.userId });
    if (error) throw new Error(error.message);
    return { status: "none" as FollowState };
  });

export const acceptFollowRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(targetSchema)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("accept_follow_request", {
      _follower: data.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Rejects a pending request or removes an existing follower. */
export const removeFollower = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(targetSchema)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("remove_follower", { _follower: data.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSocialProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      username: usernameSchema,
      bio: z.string().trim().max(150).nullable(),
      is_private: z.boolean(),
      discoverable: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: taken } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("username", data.username)
      .neq("user_id", userId)
      .maybeSingle();
    if (taken) throw new Error("username_taken");
    const { error } = await supabase
      .from("profiles")
      .update({
        username: data.username,
        bio: data.bio || null,
        is_private: data.is_private,
        discoverable: data.discoverable,
      })
      .eq("user_id", userId);
    if (error) throw new Error(error.code === "23505" ? "username_taken" : error.message);
    return { ok: true, username: data.username };
  });
