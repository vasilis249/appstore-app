import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/api/social.functions";

// Instagram-style inbox: Primary vs Requests, shared posts and story replies.
// Reads use the caller's client (RLS: members only); membership changes go
// through the service-role client after explicit checks.

export type Person = {
  user_id: string;
  username: string;
  full_name: string | null;
  photo_url: string | null;
};

export type InboxItem = {
  id: string;
  type: "direct" | "group";
  title: string | null;
  accepted: boolean;
  lastBody: string | null;
  lastKind: "text" | "post" | "story";
  lastFromMe: boolean;
  lastAt: string;
  unread: number;
  /** Direct: the other person. Group: up to two other members for the avatar stack. */
  people: Person[];
};

export type SharedPost = {
  id: string;
  thumb: string | null;
  caption: string | null;
  author: Person | null;
};

export type DmMessage = {
  id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
  /** undefined = no post; null = post deleted or not visible to you. */
  post?: SharedPost | null;
  /** undefined = no story; null = story expired or not visible to you. */
  story?: { id: string; url: string } | null;
};

export type Thread = {
  id: string;
  type: "direct" | "group";
  title: string | null;
  accepted: boolean;
  myRole: string;
  members: (Person & { role: string; last_read_at: string | null })[];
};

const BUCKET = "social-media";

async function peopleById(db: Db, ids: string[]): Promise<Map<string, Person>> {
  if (!ids.length) return new Map();
  const { data } = await db
    .from("profiles")
    .select("user_id,username,full_name,photo_url")
    .in("user_id", Array.from(new Set(ids)));
  return new Map((data ?? []).map((p) => [p.user_id, p as Person]));
}

export const listInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InboxItem[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.rpc("my_inbox");
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    if (!list.length) return [];

    const { data: members } = await supabase
      .from("conversation_members")
      .select("conversation_id,user_id")
      .in(
        "conversation_id",
        list.map((r) => r.id),
      )
      .neq("user_id", userId);
    const people = await peopleById(
      supabase,
      (members ?? []).map((m) => m.user_id),
    );
    const byConv = new Map<string, Person[]>();
    for (const m of members ?? []) {
      const p = people.get(m.user_id);
      if (!p) continue;
      const arr = byConv.get(m.conversation_id) ?? [];
      if (arr.length < 2) arr.push(p);
      byConv.set(m.conversation_id, arr);
    }

    return list.map((r) => ({
      id: r.id,
      type: r.type as InboxItem["type"],
      title: r.title,
      accepted: r.accepted,
      lastBody: r.last_body,
      lastKind: r.last_kind as InboxItem["lastKind"],
      lastFromMe: r.last_sender_id === userId,
      lastAt: r.last_at,
      unread: Number(r.unread),
      people: byConv.get(r.id) ?? [],
    }));
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversationId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<Thread> => {
    const { supabase, userId } = context;
    const [{ data: conv }, { data: members }] = await Promise.all([
      supabase
        .from("conversations")
        .select("id,type,title")
        .eq("id", data.conversationId)
        .maybeSingle(),
      supabase
        .from("conversation_members")
        .select("user_id,role,accepted,last_read_at")
        .eq("conversation_id", data.conversationId),
    ]);
    const me = (members ?? []).find((m) => m.user_id === userId);
    if (!conv || !me) throw new Error("not_found");
    const people = await peopleById(
      supabase,
      (members ?? []).map((m) => m.user_id),
    );
    return {
      id: conv.id,
      type: conv.type as Thread["type"],
      title: conv.title,
      accepted: me.accepted,
      myRole: me.role,
      members: (members ?? [])
        .filter((m) => m.user_id !== userId && people.has(m.user_id))
        .map((m) => ({ ...people.get(m.user_id)!, role: m.role, last_read_at: m.last_read_at })),
    };
  });

export const listThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      conversationId: z.string().uuid(),
      before: z.string().datetime({ offset: true }).optional(),
    }),
  )
  .handler(async ({ data, context }): Promise<{ messages: DmMessage[]; hasMore: boolean }> => {
    const { supabase } = context;
    const LIMIT = 40;
    let q = supabase
      .from("messages")
      .select("id,sender_id,body,created_at,post_id,story_id")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []).reverse();

    const postIds = Array.from(new Set(list.map((m) => m.post_id).filter(Boolean))) as string[];
    const storyIds = Array.from(new Set(list.map((m) => m.story_id).filter(Boolean))) as string[];
    const [{ data: posts }, { data: stories }] = await Promise.all([
      postIds.length
        ? supabase.from("posts").select("id,author_id,caption,media").in("id", postIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              author_id: string;
              caption: string | null;
              media: string[];
            }[],
          }),
      storyIds.length
        ? supabase.from("stories").select("id,media_path").in("id", storyIds)
        : Promise.resolve({ data: [] as { id: string; media_path: string }[] }),
    ]);
    const paths = [
      ...(posts ?? []).map((p) => p.media[0]).filter(Boolean),
      ...(stories ?? []).map((s) => s.media_path),
    ];
    const [authors, signed] = await Promise.all([
      peopleById(
        supabase,
        (posts ?? []).map((p) => p.author_id),
      ),
      paths.length
        ? supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
        : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    ]);
    const url = new Map<string, string>();
    for (const s of signed.data ?? []) if (s.path && s.signedUrl) url.set(s.path, s.signedUrl);
    const postById = new Map(
      (posts ?? []).map((p) => [
        p.id,
        {
          id: p.id,
          thumb: p.media[0] ? (url.get(p.media[0]) ?? null) : null,
          caption: p.caption,
          author: authors.get(p.author_id) ?? null,
        } satisfies SharedPost,
      ]),
    );
    const storyById = new Map(
      (stories ?? []).map((s) => [
        s.id,
        url.has(s.media_path) ? { id: s.id, url: url.get(s.media_path)! } : null,
      ]),
    );

    return {
      hasMore: (rows ?? []).length === LIMIT,
      messages: list.map((m) => ({
        id: m.id,
        sender_id: m.sender_id,
        body: m.body,
        created_at: m.created_at,
        ...(m.post_id !== null || m.body === ""
          ? { post: m.post_id ? (postById.get(m.post_id) ?? null) : null }
          : {}),
        ...(m.story_id !== null ? { story: storyById.get(m.story_id) ?? null } : {}),
      })),
    };
  });

const bodySchema = z.string().trim().max(2000);

export const sendDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversationId: z.string().uuid(), body: bodySchema.min(1) }))
  .handler(async ({ data, context }) => {
    // The messages_guard trigger enforces membership, blocks and the rate limit.
    const { error } = await context.supabase.from("messages").insert({
      conversation_id: data.conversationId,
      sender_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Opens (or creates) the 1:1 conversation with a user; used by the profile "Message" button. */
export const openDirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureDirectConversation } = await import("@/lib/api/dm.server");
    return { id: await ensureDirectConversation(supabaseAdmin, context.userId, data.userId) };
  });

/** Send a post to up to 10 people (1:1) and/or existing conversations, with an optional note. */
export const sharePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      postId: z.string().uuid(),
      userIds: z.array(z.string().uuid()).max(10).default([]),
      conversationIds: z.array(z.string().uuid()).max(10).default([]),
      note: bodySchema.optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureDirectConversation } = await import("@/lib/api/dm.server");
    const convs = new Set(data.conversationIds);
    for (const u of data.userIds)
      convs.add(await ensureDirectConversation(supabaseAdmin, userId, u));
    if (convs.size > 10) throw new Error("too_many_recipients");
    for (const c of convs) {
      const { error } = await supabase
        .from("messages")
        .insert({ conversation_id: c, sender_id: userId, body: "", post_id: data.postId });
      if (error) throw new Error(error.message);
      if (data.note) {
        const { error: e2 } = await supabase
          .from("messages")
          .insert({ conversation_id: c, sender_id: userId, body: data.note });
        if (e2) throw new Error(e2.message);
      }
    }
    return { sent: convs.size };
  });

/** Reply to someone's story: lands in your 1:1 conversation with the author. */
export const replyToStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ storyId: z.string().uuid(), body: bodySchema.min(1) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: story } = await supabase
      .from("stories")
      .select("author_id")
      .eq("id", data.storyId)
      .maybeSingle();
    if (!story) throw new Error("not_found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureDirectConversation } = await import("@/lib/api/dm.server");
    const conversationId = await ensureDirectConversation(supabaseAdmin, userId, story.author_id);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      body: data.body,
      story_id: data.storyId,
    });
    if (error) throw new Error(error.message);
    return { conversationId };
  });

/** Accept a message request (moves the thread to Primary). */
export const acceptRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversationId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("conversation_members")
      .update({ accepted: true, last_read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversationId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete a conversation from your inbox (leave it). Used for declining requests too. */
export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversationId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("conversation_members")
      .delete()
      .eq("conversation_id", data.conversationId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** People to send a post to: recent 1:1 chats first, then people you follow; or search. */
export const shareTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ q: z.string().trim().max(50).optional() }))
  .handler(async ({ data, context }): Promise<Person[]> => {
    const { supabase, userId } = context;
    const q = data.q?.toLowerCase().replace(/[\\%_,()]/g, "") ?? "";
    if (q.length >= 2) {
      const { data: rows } = await supabase
        .from("profiles")
        .select("user_id,username,full_name,photo_url")
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .neq("user_id", userId)
        .eq("disabled", false)
        .limit(20);
      return (rows ?? []) as Person[];
    }
    const [{ data: inbox }, { data: following }] = await Promise.all([
      supabase.rpc("my_inbox"),
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId)
        .eq("status", "accepted")
        .order("accepted_at", { ascending: false })
        .limit(30),
    ]);
    const directIds = (inbox ?? [])
      .filter((c) => c.type === "direct" && c.accepted)
      .map((c) => c.id);
    const { data: peers } = directIds.length
      ? await supabase
          .from("conversation_members")
          .select("conversation_id,user_id")
          .in("conversation_id", directIds)
          .neq("user_id", userId)
      : { data: [] };
    const order = new Map(directIds.map((id, i) => [id, i]));
    const recent = (peers ?? [])
      .sort((a, b) => (order.get(a.conversation_id) ?? 0) - (order.get(b.conversation_id) ?? 0))
      .map((p) => p.user_id);
    const ids = Array.from(
      new Set([...recent, ...(following ?? []).map((f) => f.following_id)]),
    ).slice(0, 30);
    const people = await peopleById(supabase, ids);
    return ids.map((id) => people.get(id)).filter(Boolean) as Person[];
  });
