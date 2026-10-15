import { createServerFn } from "@tanstack/react-start";

export interface PostTeaser {
  name: string;
  school: string;
  text: string | null;
  durationMs: number | null;
  photos: number;
  likes: number;
  replies: number;
}

/**
 * The public page of a shared post: a teaser only (first name, school, text, counts — never the voice or photos);
 * null when it can't be shown (group post, deleted, hidden, unknown).
 */
export const postPreview = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => ({ id: typeof (d as { id?: unknown })?.id === "string" ? (d as { id: string }).id : "" }))
  .handler(async ({ data }): Promise<PostTeaser | null> => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id)) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("post_preview", { p_post: data.id });
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0];
    if (!row) return null;
    const [u, d] = await Promise.all([
      row.university_id ? supabaseAdmin.from("universities").select("short_el").eq("id", row.university_id).maybeSingle() : Promise.resolve({ data: null }),
      row.department_id ? supabaseAdmin.from("departments").select("short_el").eq("id", row.department_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return {
      name: row.first_name,
      school: [d.data?.short_el, u.data?.short_el].filter(Boolean).join(" · "),
      text: row.text,
      durationMs: row.duration_ms,
      photos: row.photos,
      likes: row.likes,
      replies: row.replies,
    };
  });
