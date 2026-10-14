import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Removes audio / photos in `voices` that no post points at any more (and DM photos no message points at) (a deleted group's voices, leftovers of deleted
 * voices or accounts, an upload whose post was never made). SQL can't delete storage objects, so the database
 * lists them (`orphan_voice_files`: service role only, files younger than an hour are left alone) and this removes
 * them through the Storage API. Any signed-in user may trigger it: it only ever touches unreferenced files.
 */
export const sweepVoiceFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("orphan_voice_files", { p_limit: 200 });
    if (error) throw new Error(error.message);
    const names = (data ?? []) as string[];
    if (names.length) {
      const { error: rmError } = await supabaseAdmin.storage.from("voices").remove(names);
      if (rmError) throw new Error(rmError.message);
    }
    // DM photos no message points at any more (90-day clean-up, failed sends)
    const dm = await supabaseAdmin.rpc("orphan_dm_photos", { p_limit: 200 });
    if (dm.error) throw new Error(dm.error.message);
    const photos = (dm.data ?? []) as string[];
    if (photos.length) {
      const { error: rmError } = await supabaseAdmin.storage.from("dm-photos").remove(photos);
      if (rmError) throw new Error(rmError.message);
    }
    return { removed: names.length + photos.length };
  });

/** Fire and forget, after something that can leave audio behind (deleting a voice, a group, …). */
export function sweepVoiceFilesLater() {
  void sweepVoiceFiles().catch(() => {});
}
