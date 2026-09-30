// Invite links: /i/<code>. Whoever signs up through yours follows you and you them (friends at once).
import { supabase } from "@/integrations/supabase/client";

const KEY = "courtsie:invite";
export const inviteKeys = { mine: ["invite", "mine"] as const };

export async function myInvite(): Promise<{ code: string; joined: number }> {
  const { data, error } = await supabase.rpc("my_invite");
  if (error) throw new Error(error.message);
  return (data ?? [])[0] as { code: string; joined: number };
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/i/${code}`;
}

/** Remember the code from the invite page until the visitor has an account. */
export function rememberInvite(code: string) {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* private mode */
  }
}

/** Claim a remembered invite (once; drop it whatever happens). */
export async function claimRememberedInvite(): Promise<{ status: string; inviter_username: string | null } | null> {
  let code: string | null = null;
  try {
    code = localStorage.getItem(KEY);
    if (code) localStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!code) return null;
  const { data, error } = await supabase.rpc("claim_invite", { p_code: code });
  if (error) return null;
  return ((data ?? [])[0] as { status: string; inviter_username: string | null }) ?? null;
}
