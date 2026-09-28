import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin moderation of posts, comments, stories and profiles (content_reports).
// Reports on the same item are grouped into one card.

type Ctx = {
  supabase: {
    rpc: (
      fn: "has_role",
      a: { _user_id: string; _role: "admin" },
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  userId: string;
};

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

const BUCKET = "social-media";
const targetType = z.enum(["post", "comment", "story", "profile"]);

export type ContentReportGroup = {
  targetType: z.infer<typeof targetType>;
  targetId: string;
  count: number;
  reasons: string[];
  lastAt: string;
  status: "open" | "resolved" | "dismissed";
  /** Owner of the content (or the reported profile). */
  author: { user_id: string; username: string; full_name: string | null; disabled: boolean } | null;
  preview: { text: string | null; image: string | null; postId: string | null } | null;
};

export const listContentReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ status: z.enum(["open", "all"]) }))
  .handler(async ({ data, context }): Promise<ContentReportGroup[]> => {
    await assertAdmin(context);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    let q = admin
      .from("content_reports")
      .select("target_type,target_id,reason,status,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status === "open") q = q.eq("status", "open");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const groups = new Map<string, ContentReportGroup>();
    for (const r of rows ?? []) {
      const key = `${r.target_type}:${r.target_id}`;
      const g = groups.get(key);
      if (g) {
        g.count += 1;
        if (r.reason) g.reasons.push(r.reason);
        if (r.status === "open") g.status = "open";
      } else {
        groups.set(key, {
          targetType: r.target_type as ContentReportGroup["targetType"],
          targetId: r.target_id,
          count: 1,
          reasons: r.reason ? [r.reason] : [],
          lastAt: r.created_at,
          status: r.status as ContentReportGroup["status"],
          author: null,
          preview: null,
        });
      }
    }
    const list = Array.from(groups.values());
    const ids = (t: string) => list.filter((g) => g.targetType === t).map((g) => g.targetId);

    const [posts, comments, stories] = await Promise.all([
      ids("post").length
        ? admin.from("posts").select("id,author_id,caption,media").in("id", ids("post"))
        : Promise.resolve({
            data: [] as {
              id: string;
              author_id: string;
              caption: string | null;
              media: string[];
            }[],
          }),
      ids("comment").length
        ? admin.from("post_comments").select("id,author_id,body,post_id").in("id", ids("comment"))
        : Promise.resolve({
            data: [] as { id: string; author_id: string; body: string; post_id: string }[],
          }),
      ids("story").length
        ? admin.from("stories").select("id,author_id,caption,media_path").in("id", ids("story"))
        : Promise.resolve({
            data: [] as {
              id: string;
              author_id: string;
              caption: string | null;
              media_path: string;
            }[],
          }),
    ]);
    const paths = [
      ...(posts.data ?? []).map((p) => p.media[0]).filter(Boolean),
      ...(stories.data ?? []).map((s) => s.media_path),
    ];
    const { data: signed } = paths.length
      ? await admin.storage.from(BUCKET).createSignedUrls(paths, 3600)
      : { data: [] };
    const url = new Map(
      (signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path!, s.signedUrl]),
    );

    const ownerOf = new Map<string, string>();
    const previewOf = new Map<string, ContentReportGroup["preview"]>();
    for (const p of posts.data ?? []) {
      ownerOf.set(`post:${p.id}`, p.author_id);
      previewOf.set(`post:${p.id}`, {
        text: p.caption,
        image: url.get(p.media[0]) ?? null,
        postId: p.id,
      });
    }
    for (const c of comments.data ?? []) {
      ownerOf.set(`comment:${c.id}`, c.author_id);
      previewOf.set(`comment:${c.id}`, { text: c.body, image: null, postId: c.post_id });
    }
    for (const s of stories.data ?? []) {
      ownerOf.set(`story:${s.id}`, s.author_id);
      previewOf.set(`story:${s.id}`, {
        text: s.caption,
        image: url.get(s.media_path) ?? null,
        postId: null,
      });
    }
    for (const id of ids("profile")) ownerOf.set(`profile:${id}`, id);

    const owners = Array.from(new Set(ownerOf.values()));
    const { data: profs } = owners.length
      ? await admin
          .from("profiles")
          .select("user_id,username,full_name,disabled,bio")
          .in("user_id", owners)
      : { data: [] };
    const profById = new Map((profs ?? []).map((p) => [p.user_id, p]));

    for (const g of list) {
      const key = `${g.targetType}:${g.targetId}`;
      const owner = ownerOf.get(key);
      const p = owner ? profById.get(owner) : undefined;
      g.author = p
        ? { user_id: p.user_id, username: p.username, full_name: p.full_name, disabled: p.disabled }
        : null;
      g.preview =
        g.targetType === "profile"
          ? p
            ? { text: p.bio, image: null, postId: null }
            : null
          : (previewOf.get(key) ?? null);
    }
    return list.sort(
      (a, b) =>
        (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) ||
        b.lastAt.localeCompare(a.lastAt),
    );
  });

/**
 * Close every report on one item. "remove" deletes the post/comment/story (and its
 * files); for a profile it disables the account. "dismiss" keeps the content.
 */
export const resolveContentReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ targetType, targetId: z.string().uuid(), action: z.enum(["remove", "dismiss"]) }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    if (data.action === "remove") {
      if (data.targetType === "post") {
        const { data: p } = await admin
          .from("posts")
          .select("media")
          .eq("id", data.targetId)
          .maybeSingle();
        await admin.from("posts").delete().eq("id", data.targetId);
        if (p?.media.length) await admin.storage.from(BUCKET).remove(p.media);
      } else if (data.targetType === "comment") {
        await admin.from("post_comments").delete().eq("id", data.targetId);
      } else if (data.targetType === "story") {
        const { data: s } = await admin
          .from("stories")
          .select("media_path")
          .eq("id", data.targetId)
          .maybeSingle();
        await admin.from("stories").delete().eq("id", data.targetId);
        if (s) await admin.storage.from(BUCKET).remove([s.media_path]);
      } else {
        if (data.targetId === context.userId)
          throw new Error("Δεν μπορείς να απενεργοποιήσεις τον εαυτό σου");
        await admin.from("profiles").update({ disabled: true }).eq("user_id", data.targetId);
        await admin.auth.admin.updateUserById(data.targetId, { ban_duration: "876000h" } as never);
      }
    }

    const { error } = await admin
      .from("content_reports")
      .update({
        status: data.action === "remove" ? "resolved" : "dismissed",
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("target_type", data.targetType)
      .eq("target_id", data.targetId)
      .eq("status", "open");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
