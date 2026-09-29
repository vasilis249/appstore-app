import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently deletes the signed-in user's account (App Store guideline 5.1.1(v)).
 * Stored files have no FK to auth.users, so they are removed first; deleting the
 * auth user then cascades to every row that references it.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: files } = await supabaseAdmin.storage.from("avatars").list(userId);
    if (files?.length) {
      await supabaseAdmin.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
