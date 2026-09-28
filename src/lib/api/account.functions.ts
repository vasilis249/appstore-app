import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently deletes the signed-in user's account (App Store guideline 5.1.1(v)).
 *
 * Deleting the auth user cascades to profiles, roles, friendships, chats
 * membership, reviews, contact info, etc. (see FKs to auth.users). Before that:
 *   - future bookings are cancelled, so they stop blocking courts
 *     (bookings.player_id is SET NULL on delete);
 *   - venues the user owns are hidden (approved = false) instead of staying
 *     public without an owner (venues.owner_id is SET NULL on delete);
 *   - notifications and avatar files, which have no FK, are removed.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const today = new Date().toISOString().slice(0, 10);
    const { error: cancelErr } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("player_id", userId)
      .gte("date", today)
      .in("status", ["pending", "confirmed"]);
    if (cancelErr) throw new Error(cancelErr.message);

    const { error: venuesErr } = await supabaseAdmin
      .from("venues")
      .update({ approved: false })
      .eq("owner_id", userId);
    if (venuesErr) throw new Error(venuesErr.message);

    await supabaseAdmin.from("notifications").delete().eq("user_id", userId);

    const { data: files } = await supabaseAdmin.storage.from("avatars").list(userId);
    if (files?.length) {
      await supabaseAdmin.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
    }

    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteErr) throw new Error(deleteErr.message);

    return { ok: true };
  });
