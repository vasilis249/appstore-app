import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlayerLevel = "beginner" | "intermediate" | "advanced" | null;

export type FriendshipStatus = "none" | "pending_outgoing" | "pending_incoming" | "friends";

export type PlayerSearchRow = {
  id: string; // user_id
  username: string;
  follow_status: "none" | "pending" | "accepted";
  full_name: string | null;
  level: PlayerLevel;
  rating: number | null;
  photo_url: string | null;
  friendship_status: FriendshipStatus;
};

export type FriendRow = {
  user_id: string;
  full_name: string | null;
  level: PlayerLevel;
  rating: number | null;
  photo_url: string | null;
  since: string; // accepted/created at
};

export type FriendRequestRow = {
  request_id: string;
  user_id: string; // the other user (requester for incoming, addressee for outgoing)
  full_name: string | null;
  level: PlayerLevel;
  rating: number | null;
  photo_url: string | null;
  created_at: string;
};

export type BlockedRow = {
  user_id: string;
  full_name: string | null;
  photo_url: string | null;
};

export type CommunityStatus = {
  discoverable: boolean;
};

/* -------------------- helpers (server-only) -------------------- */

async function loadProfilesByUserIds(supabase: any, ids: string[]) {
  if (ids.length === 0) return new Map<string, any>();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,full_name,level,rating,photo_url")
    .in("user_id", ids);
  if (error) throw new Error(error.message);
  const map = new Map<string, any>();
  for (const p of data ?? []) map.set(p.user_id, p);
  return map;
}

/* -------------------- status / consent -------------------- */

export const getCommunityStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("discoverable")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { discoverable: !!data?.discoverable } as CommunityStatus;
  });

export const setDiscoverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ discoverable: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ discoverable: data.discoverable })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- search -------------------- */

async function followStatusMap(
  supabase: { from: (t: "follows") => any },
  me: string,
  ids: string[],
): Promise<Map<string, "pending" | "accepted">> {
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from("follows")
    .select("following_id,status")
    .eq("follower_id", me)
    .in("following_id", ids);
  return new Map(
    ((data ?? []) as { following_id: string; status: "pending" | "accepted" }[]).map((r) => [
      r.following_id,
      r.status,
    ]),
  );
}

export const searchPlayers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ q: z.string() }))
  .handler(async ({ data, context }): Promise<PlayerSearchRow[]> => {
    const { supabase, userId } = context;
    const q = data.q.trim();
    if (q.length < 2) return [];

    // Blocks in either direction (uses RLS-allowed view of own blocks; for blocks
    // BY others, use the admin client to know to exclude them).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: blockedByMe }, { data: blockingMe }] = await Promise.all([
      supabaseAdmin.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
      supabaseAdmin.from("user_blocks").select("blocker_id").eq("blocked_id", userId),
    ]);
    const excluded = new Set<string>([userId]);
    for (const r of blockedByMe ?? []) excluded.add(r.blocked_id);
    for (const r of blockingMe ?? []) excluded.add(r.blocker_id);

    const escaped = q.replace(/[\\%_,]/g, (m) => "\\" + m);
    const cols = "user_id,username,full_name,level,rating,photo_url";
    const [byName, byHandle] = await Promise.all([
      supabase
        .from("profiles")
        .select(cols)
        .eq("discoverable", true)
        .ilike("full_name", `%${escaped}%`)
        .limit(40),
      supabase
        .from("profiles")
        .select(cols)
        .eq("discoverable", true)
        .ilike("username", `%${escaped.replace(/^@/, "")}%`)
        .limit(40),
    ]);
    if (byName.error) throw new Error(byName.error.message);
    const seen = new Set<string>();
    const rows = [...(byHandle.data ?? []), ...(byName.data ?? [])].filter((p) =>
      seen.has(p.user_id) ? false : (seen.add(p.user_id), true),
    );

    const candidates = rows.filter((p) => !excluded.has(p.user_id)).slice(0, 20);
    if (candidates.length === 0) return [];

    const ids = candidates.map((c) => c.user_id);
    const { data: friendships } = await supabase
      .from("friendships")
      .select("requester_id,addressee_id,status")
      .or(
        `and(requester_id.eq.${userId},addressee_id.in.(${ids.join(",")})),` +
          `and(addressee_id.eq.${userId},requester_id.in.(${ids.join(",")}))`,
      );

    const statusByUser = new Map<string, FriendshipStatus>();
    for (const f of friendships ?? []) {
      const other = f.requester_id === userId ? f.addressee_id : f.requester_id;
      if (f.status === "accepted") statusByUser.set(other, "friends");
      else if (f.requester_id === userId) statusByUser.set(other, "pending_outgoing");
      else statusByUser.set(other, "pending_incoming");
    }

    const follows = await followStatusMap(supabase, userId, ids);
    return candidates.map((p) => ({
      id: p.user_id,
      username: p.username,
      follow_status: follows.get(p.user_id) ?? "none",
      full_name: p.full_name,
      level: (p.level as PlayerLevel) ?? null,
      rating: p.rating != null ? Number(p.rating) : null,
      photo_url: p.photo_url,
      friendship_status: statusByUser.get(p.user_id) ?? "none",
    }));
  });

export const suggestedPlayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlayerSearchRow[]> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Caller's profile (for ranking by level/rating proximity)
    const { data: me } = await supabase
      .from("profiles")
      .select("level,rating")
      .eq("user_id", userId)
      .maybeSingle();

    // Exclude self, anyone blocked in either direction, and anyone I already
    // follow (or asked to follow).
    const [{ data: blockedByMe }, { data: blockingMe }, { data: following }] = await Promise.all([
      supabaseAdmin.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
      supabaseAdmin.from("user_blocks").select("blocker_id").eq("blocked_id", userId),
      supabase.from("follows").select("following_id").eq("follower_id", userId),
    ]);

    const excluded = new Set<string>([userId]);
    for (const r of blockedByMe ?? []) excluded.add(r.blocked_id);
    for (const r of blockingMe ?? []) excluded.add(r.blocker_id);
    for (const r of following ?? []) excluded.add(r.following_id);

    const { data: rows, error } = await supabase
      .from("profiles")
      .select("user_id,username,full_name,level,rating,photo_url")
      .eq("discoverable", true)
      .limit(100);
    if (error) throw new Error(error.message);

    const candidates = (rows ?? []).filter((p: any) => !excluded.has(p.user_id));

    const myLevel = (me?.level as PlayerLevel) ?? null;
    const myRating = me?.rating != null ? Number(me.rating) : null;
    candidates.sort((a: any, b: any) => {
      const aSame = myLevel && a.level === myLevel ? 0 : 1;
      const bSame = myLevel && b.level === myLevel ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;
      if (myRating != null) {
        const ar = a.rating != null ? Math.abs(Number(a.rating) - myRating) : 999;
        const br = b.rating != null ? Math.abs(Number(b.rating) - myRating) : 999;
        if (ar !== br) return ar - br;
      }
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });

    const top = candidates.slice(0, 12);
    const follows = await followStatusMap(
      supabase,
      userId,
      top.map((p: any) => p.user_id),
    );
    return top.map((p: any) => ({
      id: p.user_id,
      username: p.username,
      follow_status: follows.get(p.user_id) ?? "none",
      full_name: p.full_name,
      level: (p.level as PlayerLevel) ?? null,
      rating: p.rating != null ? Number(p.rating) : null,
      photo_url: p.photo_url,
      friendship_status: "none" as FriendshipStatus,
    }));
  });

/* -------------------- requests -------------------- */

export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("invalid_target");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Anti-abuse: cap friend requests per user per day
    const FRIEND_REQUEST_DAILY_LIMIT = 30;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabaseAdmin
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("requester_id", userId)
      .gte("created_at", since);
    if ((recentCount ?? 0) >= FRIEND_REQUEST_DAILY_LIMIT) {
      throw new Error("rate_limited");
    }

    const { data: blocks } = await supabaseAdmin
      .from("user_blocks")
      .select("blocker_id,blocked_id")
      .or(
        `and(blocker_id.eq.${userId},blocked_id.eq.${data.userId}),` +
          `and(blocker_id.eq.${data.userId},blocked_id.eq.${userId})`,
      );
    if (blocks && blocks.length > 0) throw new Error("blocked");

    const { data: existing } = await supabase
      .from("friendships")
      .select("id,status")
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${data.userId}),` +
          `and(requester_id.eq.${data.userId},addressee_id.eq.${userId})`,
      )
      .maybeSingle();
    if (existing) {
      // Idempotent: surface as a status instead of a 500 so the UI can toast cleanly.
      return {
        ok: true as const,
        status:
          existing.status === "accepted"
            ? ("already_friends" as const)
            : ("request_exists" as const),
      };
    }

    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: userId, addressee_id: data.userId, status: "pending" });
    if (error) throw new Error(error.message);
    return { ok: true as const, status: "sent" as const };
  });

export const respondFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ requestId: z.string().uuid(), accept: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: e1 } = await supabase
      .from("friendships")
      .select("id,addressee_id,status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!row || row.addressee_id !== userId) throw new Error("not_found");
    if (row.status !== "pending") throw new Error("invalid_state");

    if (data.accept) {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", data.requestId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("friendships").delete().eq("id", data.requestId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("friendships")
      .delete()
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${data.userId}),` +
          `and(requester_id.eq.${data.userId},addressee_id.eq.${userId})`,
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- blocks -------------------- */

export const blockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("invalid_target");
    // remove any friendship first
    await supabase
      .from("friendships")
      .delete()
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${data.userId}),` +
          `and(requester_id.eq.${data.userId},addressee_id.eq.${userId})`,
      );
    const { error } = await supabase
      .from("user_blocks")
      .upsert({ blocker_id: userId, blocked_id: data.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- lists -------------------- */

export const listFriends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FriendRow[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("friendships")
      .select("requester_id,addressee_id,responded_at,created_at,status")
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const otherIds = rows.map((r: any) =>
      r.requester_id === userId ? r.addressee_id : r.requester_id,
    );
    const profiles = await loadProfilesByUserIds(supabase, otherIds);
    return rows.map((r: any) => {
      const other = r.requester_id === userId ? r.addressee_id : r.requester_id;
      const p = profiles.get(other);
      return {
        user_id: other,
        full_name: p?.full_name ?? null,
        level: (p?.level as PlayerLevel) ?? null,
        rating: p?.rating != null ? Number(p.rating) : null,
        photo_url: p?.photo_url ?? null,
        since: r.responded_at ?? r.created_at,
      };
    });
  });

export const listIncomingRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FriendRequestRow[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("friendships")
      .select("id,requester_id,created_at")
      .eq("status", "pending")
      .eq("addressee_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const profiles = await loadProfilesByUserIds(
      supabase,
      rows.map((r: any) => r.requester_id),
    );
    return rows.map((r: any) => {
      const p = profiles.get(r.requester_id);
      return {
        request_id: r.id,
        user_id: r.requester_id,
        full_name: p?.full_name ?? null,
        level: (p?.level as PlayerLevel) ?? null,
        rating: p?.rating != null ? Number(p.rating) : null,
        photo_url: p?.photo_url ?? null,
        created_at: r.created_at,
      };
    });
  });

export const listOutgoingRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FriendRequestRow[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("friendships")
      .select("id,addressee_id,created_at")
      .eq("status", "pending")
      .eq("requester_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const profiles = await loadProfilesByUserIds(
      supabase,
      rows.map((r: any) => r.addressee_id),
    );
    return rows.map((r: any) => {
      const p = profiles.get(r.addressee_id);
      return {
        request_id: r.id,
        user_id: r.addressee_id,
        full_name: p?.full_name ?? null,
        level: (p?.level as PlayerLevel) ?? null,
        rating: p?.rating != null ? Number(p.rating) : null,
        photo_url: p?.photo_url ?? null,
        created_at: r.created_at,
      };
    });
  });

export const listBlockedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BlockedRow[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_blocks")
      .select("blocked_id,created_at")
      .eq("blocker_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const profiles = await loadProfilesByUserIds(
      supabase,
      rows.map((r: any) => r.blocked_id),
    );
    return rows.map((r: any) => {
      const p = profiles.get(r.blocked_id);
      return {
        user_id: r.blocked_id,
        full_name: p?.full_name ?? null,
        photo_url: p?.photo_url ?? null,
      };
    });
  });

/* ============================================================
 * Messaging (Phase 2b)
 * ============================================================ */

export type ConversationType = "direct" | "group";

export type ConversationListItem = {
  id: string;
  type: ConversationType;
  title: string | null;
  other_user_id: string | null; // for direct
  other_full_name: string | null;
  other_photo_url: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  last_message_deleted: boolean;
  unread_count: number;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

const MESSAGE_MAX = 2000;

async function assertFriendsAndNotBlocked(admin: any, a: string, b: string): Promise<void> {
  const { data: blocks } = await admin
    .from("user_blocks")
    .select("blocker_id,blocked_id")
    .or(
      `and(blocker_id.eq.${a},blocked_id.eq.${b}),` + `and(blocker_id.eq.${b},blocked_id.eq.${a})`,
    );
  if (blocks && blocks.length > 0) throw new Error("blocked");

  const { data: fr } = await admin
    .from("friendships")
    .select("status")
    .or(
      `and(requester_id.eq.${a},addressee_id.eq.${b}),` +
        `and(requester_id.eq.${b},addressee_id.eq.${a})`,
    )
    .maybeSingle();
  if (!fr || fr.status !== "accepted") throw new Error("not_friends");
}

export const getOrCreateDirectConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ otherUserId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { userId } = context;
    if (data.otherUserId === userId) throw new Error("invalid_target");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertFriendsAndNotBlocked(supabaseAdmin, userId, data.otherUserId);

    // find existing direct conversation with exactly these two members
    const { data: mine } = await supabaseAdmin
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userId);
    const mineIds = (mine ?? []).map((r: any) => r.conversation_id);
    if (mineIds.length > 0) {
      const { data: theirs } = await supabaseAdmin
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", data.otherUserId)
        .in("conversation_id", mineIds);
      const shared = (theirs ?? []).map((r: any) => r.conversation_id);
      if (shared.length > 0) {
        const { data: convs } = await supabaseAdmin
          .from("conversations")
          .select("id,type")
          .in("id", shared)
          .eq("type", "direct");
        for (const c of convs ?? []) {
          const { count } = await supabaseAdmin
            .from("conversation_members")
            .select("user_id", { count: "exact", head: true })
            .eq("conversation_id", c.id);
          if (count === 2) return { id: c.id };
        }
      }
    }

    const { data: conv, error: e1 } = await supabaseAdmin
      .from("conversations")
      .insert({ type: "direct", created_by: userId })
      .select("id")
      .single();
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabaseAdmin.from("conversation_members").insert([
      { conversation_id: conv.id, user_id: userId, role: "admin" },
      { conversation_id: conv.id, user_id: data.otherUserId, role: "member" },
    ]);
    if (e2) throw new Error(e2.message);
    return { id: conv.id };
  });

export const createGroupConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      title: z.string().trim().min(1).max(80),
      memberIds: z.array(z.string().uuid()).min(1).max(50),
    }),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { userId } = context;
    const uniq = Array.from(new Set(data.memberIds.filter((m) => m !== userId)));
    if (uniq.length === 0) throw new Error("invalid_members");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const m of uniq) {
      await assertFriendsAndNotBlocked(supabaseAdmin, userId, m);
    }
    const { data: conv, error: e1 } = await supabaseAdmin
      .from("conversations")
      .insert({ type: "group", title: data.title, created_by: userId })
      .select("id")
      .single();
    if (e1) throw new Error(e1.message);
    const rows = [
      { conversation_id: conv.id, user_id: userId, role: "admin" },
      ...uniq.map((u) => ({ conversation_id: conv.id, user_id: u, role: "member" })),
    ];
    const { error: e2 } = await supabaseAdmin.from("conversation_members").insert(rows);
    if (e2) throw new Error(e2.message);
    return { id: conv.id };
  });

export const addGroupMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversationId: z.string().uuid(), userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.userId === userId) throw new Error("invalid_target");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id,type")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv || conv.type !== "group") throw new Error("not_found");
    const { data: me } = await supabaseAdmin
      .from("conversation_members")
      .select("role")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!me || me.role !== "admin") throw new Error("forbidden");
    // Cap group size
    const GROUP_MAX_MEMBERS = 50;
    const { count: cur } = await supabaseAdmin
      .from("conversation_members")
      .select("user_id", { count: "exact", head: true })
      .eq("conversation_id", data.conversationId);
    if ((cur ?? 0) >= GROUP_MAX_MEMBERS) throw new Error("group_full");
    // Group adds: only require that neither party has blocked the other.
    // Friendship is not required — admins can add any platform user.
    const { data: blocks } = await supabaseAdmin
      .from("user_blocks")
      .select("blocker_id,blocked_id")
      .or(
        `and(blocker_id.eq.${userId},blocked_id.eq.${data.userId}),` +
          `and(blocker_id.eq.${data.userId},blocked_id.eq.${userId})`,
      );
    if (blocks && blocks.length > 0) throw new Error("blocked");
    // Target must be a real, discoverable platform user.
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("discoverable")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!target || !target.discoverable) throw new Error("not_found");
    const { error } = await supabaseAdmin
      .from("conversation_members")
      .upsert({ conversation_id: data.conversationId, user_id: data.userId, role: "member" });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaveConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversationId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("conversation_members")
      .delete()
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeGroupMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversationId: z.string().uuid(), userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.userId === userId) throw new Error("invalid_target");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id,type")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv || conv.type !== "group") throw new Error("not_found");
    const { data: me } = await supabaseAdmin
      .from("conversation_members")
      .select("role")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!me || me.role !== "admin") throw new Error("forbidden");
    const { error } = await supabaseAdmin
      .from("conversation_members")
      .delete()
      .eq("conversation_id", data.conversationId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type GroupAddableUser = {
  user_id: string;
  full_name: string | null;
  photo_url: string | null;
};

export const searchGroupAddableUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversationId: z.string().uuid(), q: z.string() }))
  .handler(async ({ data, context }): Promise<GroupAddableUser[]> => {
    const { userId } = context;
    const q = data.q.trim();
    if (q.length < 2) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Caller must be an admin of the group.
    const { data: me } = await supabaseAdmin
      .from("conversation_members")
      .select("role")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!me || me.role !== "admin") throw new Error("forbidden");

    const [{ data: existing }, { data: blockedByMe }, { data: blockingMe }] = await Promise.all([
      supabaseAdmin
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", data.conversationId),
      supabaseAdmin.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
      supabaseAdmin.from("user_blocks").select("blocker_id").eq("blocked_id", userId),
    ]);
    const excluded = new Set<string>([userId]);
    for (const r of existing ?? []) excluded.add((r as any).user_id);
    for (const r of blockedByMe ?? []) excluded.add((r as any).blocked_id);
    for (const r of blockingMe ?? []) excluded.add((r as any).blocker_id);

    const escaped = q.replace(/[\\%_,]/g, (m) => "\\" + m);
    // Project only display name + avatar — GDPR data minimization.
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id,full_name,photo_url")
      .eq("discoverable", true)
      .ilike("full_name", `%${escaped}%`)
      .limit(40);
    if (error) throw new Error(error.message);
    return (rows ?? [])
      .filter((p: any) => !excluded.has(p.user_id))
      .slice(0, 20)
      .map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        photo_url: p.photo_url,
      }));
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConversationListItem[]> => {
    const { supabase, userId } = context;
    const { data: mem, error: e1 } = await supabase
      .from("conversation_members")
      .select("conversation_id,last_read_at")
      .eq("user_id", userId);
    if (e1) throw new Error(e1.message);
    const ids = (mem ?? []).map((m: any) => m.conversation_id);
    if (ids.length === 0) return [];
    const lastReadById = new Map<string, string | null>();
    for (const m of mem ?? []) lastReadById.set(m.conversation_id, m.last_read_at);

    const { data: convs, error: e2 } = await supabase
      .from("conversations")
      .select("id,type,title,created_at")
      .in("id", ids);
    if (e2) throw new Error(e2.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // other members for direct conversations
    const { data: allMembers } = await supabaseAdmin
      .from("conversation_members")
      .select("conversation_id,user_id")
      .in("conversation_id", ids);
    const otherByConv = new Map<string, string | null>();
    for (const c of convs ?? []) otherByConv.set(c.id, null);
    for (const c of convs ?? []) {
      if (c.type !== "direct") continue;
      const other = (allMembers ?? []).find(
        (m: any) => m.conversation_id === c.id && m.user_id !== userId,
      );
      otherByConv.set(c.id, other?.user_id ?? null);
    }
    const otherUserIds = Array.from(otherByConv.values()).filter(Boolean) as string[];
    const otherProfiles = await loadProfilesByUserIds(supabaseAdmin, otherUserIds);

    // last messages
    const lastByConv = new Map<string, any>();
    for (const id of ids) {
      const { data: lm } = await supabase
        .from("messages")
        .select("body,created_at,deleted_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lm) lastByConv.set(id, lm);
    }

    // unread counts
    const unreadByConv = new Map<string, number>();
    for (const id of ids) {
      const lr = lastReadById.get(id);
      let q = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", id)
        .is("deleted_at", null)
        .neq("sender_id", userId);
      if (lr) q = q.gt("created_at", lr);
      const { count } = await q;
      unreadByConv.set(id, count ?? 0);
    }

    const out: ConversationListItem[] = (convs ?? []).map((c: any) => {
      const lm = lastByConv.get(c.id);
      const other = otherByConv.get(c.id);
      const p = other ? otherProfiles.get(other) : null;
      return {
        id: c.id,
        type: c.type as ConversationType,
        title: c.title ?? null,
        other_user_id: other ?? null,
        other_full_name: p?.full_name ?? null,
        other_photo_url: p?.photo_url ?? null,
        last_message_body: lm ? (lm.deleted_at ? null : lm.body) : null,
        last_message_at: lm?.created_at ?? null,
        last_message_deleted: !!lm?.deleted_at,
        unread_count: unreadByConv.get(c.id) ?? 0,
      };
    });
    out.sort((a, b) => {
      const ta = a.last_message_at ? Date.parse(a.last_message_at) : 0;
      const tb = b.last_message_at ? Date.parse(b.last_message_at) : 0;
      return tb - ta;
    });
    return out;
  });

export type ConversationDetail = {
  id: string;
  type: ConversationType;
  title: string | null;
  members: { user_id: string; full_name: string | null; photo_url: string | null; role: string }[];
  my_role: string;
};

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversationId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<ConversationDetail> => {
    const { supabase, userId } = context;
    const { data: conv, error: e1 } = await supabase
      .from("conversations")
      .select("id,type,title")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!conv) throw new Error("not_found");
    const { data: members, error: e2 } = await supabase
      .from("conversation_members")
      .select("user_id,role")
      .eq("conversation_id", data.conversationId);
    if (e2) throw new Error(e2.message);
    const me = (members ?? []).find((m: any) => m.user_id === userId);
    if (!me) throw new Error("forbidden");
    const profiles = await loadProfilesByUserIds(
      supabase,
      (members ?? []).map((m: any) => m.user_id),
    );
    return {
      id: conv.id,
      type: conv.type as ConversationType,
      title: conv.title ?? null,
      my_role: me.role,
      members: (members ?? []).map((m: any) => {
        const p = profiles.get(m.user_id);
        return {
          user_id: m.user_id,
          full_name: p?.full_name ?? null,
          photo_url: p?.photo_url ?? null,
          role: m.role,
        };
      }),
    };
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      conversationId: z.string().uuid(),
      before: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
  )
  .handler(async ({ data, context }): Promise<MessageRow[]> => {
    const { supabase } = context;
    let q = supabase
      .from("messages")
      .select("id,conversation_id,sender_id,body,created_at,deleted_at")
      .eq("conversation_id", data.conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).reverse() as MessageRow[];
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      conversationId: z.string().uuid(),
      body: z.string().trim().min(1).max(MESSAGE_MAX),
    }),
  )
  .handler(async ({ data, context }): Promise<MessageRow> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Anti-abuse: cap messages per user per minute
    const MESSAGES_PER_MINUTE = 20;
    const sinceMin = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: recentMsgs } = await supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", userId)
      .gte("created_at", sinceMin);
    if ((recentMsgs ?? 0) >= MESSAGES_PER_MINUTE) {
      throw new Error("rate_limited");
    }

    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id,type")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv) throw new Error("not_found");

    const { data: members } = await supabaseAdmin
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", data.conversationId);
    const memberIds = (members ?? []).map((m: any) => m.user_id);
    if (!memberIds.includes(userId)) throw new Error("forbidden");

    if (conv.type === "direct") {
      const other = memberIds.find((m: string) => m !== userId);
      if (!other) throw new Error("not_found");
      await assertFriendsAndNotBlocked(supabaseAdmin, userId, other);
    }

    const { data: msg, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: data.conversationId,
        sender_id: userId,
        body: data.body,
      })
      .select("id,conversation_id,sender_id,body,created_at,deleted_at")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId);

    return msg as MessageRow;
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversationId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      messageId: z.string().uuid(),
      reason: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: msg } = await supabaseAdmin
      .from("messages")
      .select("id,conversation_id,sender_id")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!msg) throw new Error("not_found");
    const { error } = await supabase.from("message_reports").insert({
      reporter_id: userId,
      message_id: msg.id,
      conversation_id: msg.conversation_id,
      reported_user_id: msg.sender_id,
      reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reportConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      conversationId: z.string().uuid(),
      reason: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("message_reports").insert({
      reporter_id: userId,
      conversation_id: data.conversationId,
      reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
