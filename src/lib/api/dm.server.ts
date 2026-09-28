// Server-only DM helpers (use the service-role client; callers do the authz).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export async function assertNotBlocked(admin: Admin, a: string, b: string): Promise<void> {
  const { data } = await admin
    .from("user_blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .limit(1);
  if (data?.length) throw new Error("blocked");
}

/** True when `follower` follows `target` (accepted). Such messages skip "Requests". */
export async function follows(admin: Admin, follower: string, target: string): Promise<boolean> {
  const { data } = await admin
    .from("follows")
    .select("status")
    .eq("follower_id", follower)
    .eq("following_id", target)
    .maybeSingle();
  return data?.status === "accepted";
}

/**
 * Existing 1:1 conversation between `me` and `other`, or a new one. The other
 * person gets it as a request unless they already follow `me`.
 */
export async function ensureDirectConversation(
  admin: Admin,
  me: string,
  other: string,
): Promise<string> {
  if (me === other) throw new Error("invalid_target");
  await assertNotBlocked(admin, me, other);

  const { data: target } = await admin
    .from("profiles")
    .select("user_id,disabled")
    .eq("user_id", other)
    .maybeSingle();
  if (!target || target.disabled) throw new Error("not_found");

  const { data: mine } = await admin
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", me);
  const mineIds = (mine ?? []).map((r) => r.conversation_id);
  if (mineIds.length) {
    const { data: shared } = await admin
      .from("conversation_members")
      .select("conversation_id, conversations!inner(type)")
      .eq("user_id", other)
      .eq("conversations.type", "direct")
      .in("conversation_id", mineIds);
    for (const s of shared ?? []) {
      const { count } = await admin
        .from("conversation_members")
        .select("user_id", { count: "exact", head: true })
        .eq("conversation_id", s.conversation_id);
      if (count === 2) return s.conversation_id;
    }
  }

  const { data: conv, error: e1 } = await admin
    .from("conversations")
    .insert({ type: "direct", created_by: me })
    .select("id")
    .single();
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await admin.from("conversation_members").insert([
    { conversation_id: conv.id, user_id: me, role: "admin", accepted: true },
    {
      conversation_id: conv.id,
      user_id: other,
      role: "member",
      accepted: await follows(admin, other, me),
    },
  ]);
  if (e2) throw new Error(e2.message);
  return conv.id;
}
