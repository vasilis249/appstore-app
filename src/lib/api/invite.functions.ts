import { createServerFn } from "@tanstack/react-start";

/** Who invites, for the public invite page (name, photo, school); nothing if the code is unknown. */
export const invitePreview = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const code = typeof (d as { code?: unknown })?.code === "string" ? (d as { code: string }).code.toLowerCase() : "";
    if (!/^[a-z0-9]{8}$/.test(code)) throw new Error("not_found");
    return { code };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("invite_preview", { p_code: data.code });
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0] as
      | { full_name: string; username: string; avatar_path: string | null; university_id: string | null; department_id: string | null }
      | undefined;
    if (!row) return null;
    // The visitor has no account yet (can't read universities): send the school label along.
    let school = "";
    if (row.university_id) {
      const [u, d] = await Promise.all([
        supabaseAdmin.from("universities").select("short_el").eq("id", row.university_id).maybeSingle(),
        row.department_id
          ? supabaseAdmin.from("departments").select("short_el").eq("id", row.department_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      school = [u.data?.short_el, d.data?.short_el].filter(Boolean).join(" · ");
    }
    return { name: row.full_name || row.username, avatar_path: row.avatar_path, school };
  });
