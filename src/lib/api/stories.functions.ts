import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { followStates, type ProfileListItem } from "@/lib/api/social.functions";

// 24h stories. RLS only returns active stories of people the caller may see.

export type TrayItem = {
  user_id: string;
  username: string;
  full_name: string | null;
  photo_url: string | null;
  has_unseen: boolean;
  isMe: boolean;
};

export type Story = {
  id: string;
  url: string;
  caption: string | null;
  created_at: string;
  seen: boolean;
  viewCount: number | null; // only for your own stories
};

const BUCKET = "social-media";

export const getStoryTray = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: TrayItem[]; meHasStory: boolean }> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.rpc("story_tray");
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.author_id);
    const { data: profs } = ids.length
      ? await supabase
          .from("profiles")
          .select("user_id,username,full_name,photo_url")
          .in("user_id", ids)
      : { data: [] };
    const byId = new Map((profs ?? []).map((p) => [p.user_id, p]));
    const items = (rows ?? [])
      .filter((r) => byId.has(r.author_id))
      .map((r) => ({
        ...byId.get(r.author_id)!,
        has_unseen: r.has_unseen,
        isMe: r.author_id === userId,
      }));
    return { items, meHasStory: items.some((i) => i.isMe) };
  });

export const listUserStories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<Story[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("stories")
      .select("id,media_path,caption,created_at")
      .eq("author_id", data.userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    if (!list.length) return [];
    const ids = list.map((s) => s.id);
    const [{ data: signed }, { data: views }] = await Promise.all([
      supabase.storage.from(BUCKET).createSignedUrls(
        list.map((s) => s.media_path),
        3600,
      ),
      supabase.from("story_views").select("story_id,viewer_id").in("story_id", ids),
    ]);
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    const isMine = data.userId === userId;
    return list
      .map((s) => ({
        id: s.id,
        url: urlByPath.get(s.media_path) ?? "",
        caption: s.caption,
        created_at: s.created_at,
        seen: isMine || (views ?? []).some((v) => v.story_id === s.id && v.viewer_id === userId),
        viewCount: isMine
          ? (views ?? []).filter((v) => v.story_id === s.id && v.viewer_id !== userId).length
          : null,
      }))
      .filter((s) => s.url);
  });

export const markStoryViewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ storyId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("story_views")
      .upsert({ story_id: data.storyId, viewer_id: context.userId }, { ignoreDuplicates: true });
    return { ok: true };
  });

export const listStoryViewers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ storyId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<ProfileListItem[]> => {
    const { supabase, userId } = context;
    // RLS: only the story's author sees who viewed it.
    const { data: views } = await supabase
      .from("story_views")
      .select("viewer_id")
      .eq("story_id", data.storyId)
      .neq("viewer_id", userId)
      .order("viewed_at", { ascending: false });
    const ids = (views ?? []).map((v) => v.viewer_id);
    if (!ids.length) return [];
    const [{ data: profs }, states] = await Promise.all([
      supabase.from("profiles").select("user_id,username,full_name,photo_url").in("user_id", ids),
      followStates(supabase, userId, ids),
    ]);
    return (profs ?? []).map((p) => ({ ...p, following: states.get(p.user_id) ?? "none" }));
  });

export const createStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      mediaPath: z.string().min(1).max(300),
      caption: z.string().trim().max(200).nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("stories").insert({
      author_id: context.userId,
      media_path: data.mediaPath,
      caption: data.caption || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ storyId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("stories")
      .select("media_path")
      .eq("id", data.storyId)
      .maybeSingle();
    const { error } = await supabase.from("stories").delete().eq("id", data.storyId);
    if (error) throw new Error(error.message);
    if (row) await supabase.storage.from(BUCKET).remove([row.media_path]);
    return { ok: true };
  });
