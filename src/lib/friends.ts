import { supabase } from "@/integrations/supabase/client";

export type Relation = "friends" | "incoming" | "outgoing" | "none";

export interface Person {
  id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  relation: Relation;
}

export const friendKeys = {
  all: ["friends"] as const,
  list: ["friends", "list"] as const,
  search: (q: string) => ["friends", "search", q] as const,
  me: ["profile", "me"] as const,
  blocked: ["friends", "blocked"] as const,
};

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export async function listFriends(): Promise<Person[]> {
  return unwrap(await supabase.rpc("my_friends")) as Person[];
}

export async function searchUsers(q: string): Promise<Person[]> {
  return unwrap(await supabase.rpc("search_users", { p_query: q })) as Person[];
}

export async function sendFriendRequest(id: string): Promise<Relation> {
  return unwrap(await supabase.rpc("send_friend_request", { p_user: id })) as Relation;
}

export async function acceptFriendRequest(id: string) {
  unwrap(await supabase.rpc("accept_friend_request", { p_user: id }));
}

/** Decline an incoming request, cancel an outgoing one, or unfriend. */
export async function removeFriend(id: string) {
  unwrap(await supabase.rpc("remove_friend", { p_user: id }));
}

export async function blockUser(id: string) {
  unwrap(await supabase.rpc("block_user", { p_user: id }));
}

export type ReportKind = "user" | "daily_post" | "voice_message";
export const REPORT_REASONS = ["spam", "harassment", "hate", "sexual", "violence", "other"] as const;

export async function reportContent(kind: ReportKind, target: string, reason: string) {
  unwrap(await supabase.rpc("report_content", { p_kind: kind, p_target: target, p_reason: reason }));
}

export async function unblockUser(id: string) {
  unwrap(await supabase.rpc("unblock_user", { p_user: id }));
}

export async function listBlocked(): Promise<Pick<Person, "id" | "username" | "full_name" | "avatar_path">[]> {
  return unwrap(await supabase.rpc("my_blocked")) ?? [];
}

/** Maps the RPC error codes raised in the database to i18n keys. */
export function rpcErrorKey(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("rate_limited")) return "rpcErrors.rateLimited";
  if (msg.includes("profiles_username_key") || msg.includes("duplicate key")) return "rpcErrors.usernameTaken";
  if (msg.includes("profiles_username_check")) return "rpcErrors.usernameFormat";
  if (msg.includes("not_allowed") || msg.includes("not_friends")) return "rpcErrors.notAllowed";
  if (msg.includes("not_found") || msg.includes("not_available")) return "rpcErrors.notFound";
  return "errors.generic";
}
