import { supabase } from "@/integrations/supabase/client";

const ONE_YEAR = 60 * 60 * 24 * 365;
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
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage.from("avatars").createSignedUrl(path, ONE_YEAR);
  if (sErr || !data) throw sErr ?? new Error("signed url failed");
  const { error: upErr } = await supabase.from("profiles").update({ photo_url: data.signedUrl }).eq("user_id", userId);
  if (upErr) throw upErr;
  return data.signedUrl;
}
