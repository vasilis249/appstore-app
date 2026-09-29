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

    // Every bucket keeps a user's files under "<userId>/"; daily posts grow by one a day.
    for (const bucket of ["avatars", "daily-posts", "voices"]) {
      for (;;) {
        const { data: files, error } = await supabaseAdmin.storage.from(bucket).list(userId, { limit: 1000 });
        if (error) throw new Error(error.message);
        if (!files?.length) break;
        const { error: rmError } = await supabaseAdmin.storage
          .from(bucket)
          .remove(files.map((f) => `${userId}/${f.name}`));
        if (rmError) throw new Error(rmError.message);
      }
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
