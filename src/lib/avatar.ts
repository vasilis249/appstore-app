import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_AVATAR_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  // Validate content — client-side is UX, but it blocks obvious mistakes before
  // the upload. Storage RLS + bucket config are the real enforcement.
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Η εικόνα είναι πολύ μεγάλη (μέγιστο 5MB).");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const typeOk = file.type ? ALLOWED_AVATAR_TYPES.includes(file.type) : false;
  const extOk = ALLOWED_AVATAR_EXTS.includes(ext);
  if (!typeOk && !extOk) {
    throw new Error("Μη έγκυρος τύπος αρχείου. Επίτρεψε μόνο εικόνες (JPG, PNG, WEBP, GIF).");
  }
  // Re-encode as JPEG on the device: smaller upload and no EXIF (e.g. GPS location).
  const body = await compressImage(file, 800);
  const isJpeg = body.type === "image/jpeg";
  const path = `${userId}/avatar-${Date.now()}.${isJpeg ? "jpg" : ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, body, {
    upsert: false,
    contentType: isJpeg ? "image/jpeg" : file.type || "image/jpeg",
  });
  if (error) throw error;
  // Public bucket: files are served by URL, the bucket itself can't be listed.
  const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const { error: upErr } = await supabase.from("profiles").update({ photo_url: url }).eq("user_id", userId);
  if (upErr) throw upErr;
  return url;
}
