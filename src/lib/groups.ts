import { supabase } from "@/integrations/supabase/client";

export type GroupPrivacy = "public" | "private";
export type GroupRole = "owner" | "admin" | "member";

export interface GroupDetail {
  id: string;
  name: string;
  description: string;
  section_id: string;
  privacy: GroupPrivacy;
  members_count: number;
  posts_count: number;
  created_at: string;
  my_role: GroupRole | null;
  /** A pending join of yours: your request, or someone's invite. */
  my_pending: "request" | "invite" | null;
  invited_by_name: string | null;
  pending_requests: number;
}

export interface MyGroup {
  id: string;
  name: string;
  section_id: string;
  privacy: GroupPrivacy;
  members_count: number;
  posts_count: number;
  last_post_at: string | null;
  my_role: GroupRole;
  pending_requests: number;
}

export interface GroupCard {
  id: string;
  name: string;
  description: string;
  section_id: string;
  privacy: GroupPrivacy;
  members_count: number;
  posts_count: number;
  my_role: GroupRole | null;
  my_pending: "request" | "invite" | null;
}

export interface GroupInvite {
  id: string;
  name: string;
  section_id: string;
  privacy: GroupPrivacy;
  members_count: number;
  invited_by_name: string;
  invited_by_username: string;
  created_at: string;
}

export interface GroupMember {
  user_id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  role: GroupRole;
  joined_at: string;
}

export interface GroupRequest {
  user_id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  created_at: string;
}

export const groupKeys = {
  all: ["groups"] as const,
  mine: ["groups", "mine"] as const,
  invites: ["groups", "invites"] as const,
  discover: (q: string, section?: string) => ["groups", "discover", q, section ?? ""] as const,
  detail: (id: string) => ["groups", "detail", id] as const,
  members: (id: string) => ["groups", "members", id] as const,
  requests: (id: string) => ["groups", "requests", id] as const,
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function myGroups(): Promise<MyGroup[]> {
  const { data, error } = await supabase.rpc("my_groups");
  fail(error);
  return (data ?? []) as MyGroup[];
}

export async function myGroupInvites(): Promise<GroupInvite[]> {
  const { data, error } = await supabase.rpc("my_group_invites");
  fail(error);
  return (data ?? []) as GroupInvite[];
}

export async function discoverGroups(query: string, section?: string): Promise<GroupCard[]> {
  const { data, error } = await supabase.rpc("discover_groups", { p_query: query || undefined, p_section: section, p_limit: 40 });
  fail(error);
  return (data ?? []) as GroupCard[];
}

export async function groupDetail(id: string): Promise<GroupDetail | null> {
  const { data, error } = await supabase.rpc("group_detail", { p_group: id });
  fail(error);
  return ((data ?? [])[0] as GroupDetail | undefined) ?? null;
}

export async function groupMembers(id: string): Promise<GroupMember[]> {
  const { data, error } = await supabase.rpc("group_members_list", { p_group: id, p_limit: 300 });
  fail(error);
  return (data ?? []) as GroupMember[];
}

export async function groupRequests(id: string): Promise<GroupRequest[]> {
  const { data, error } = await supabase.rpc("group_requests_list", { p_group: id });
  fail(error);
  return (data ?? []) as GroupRequest[];
}

export async function createGroup(g: { name: string; description: string; section: string; privacy: GroupPrivacy }): Promise<string> {
  const { data, error } = await supabase.rpc("create_group", {
    p_name: g.name.trim(),
    p_description: g.description.trim(),
    p_section: g.section,
    p_privacy: g.privacy,
  });
  fail(error);
  return data as string;
}

export async function updateGroup(id: string, g: { name: string; description: string; section: string; privacy: GroupPrivacy }) {
  fail(
    (
      await supabase.rpc("update_group", {
        p_group: id,
        p_name: g.name.trim(),
        p_description: g.description.trim(),
        p_section: g.section,
        p_privacy: g.privacy,
      })
    ).error,
  );
}

export async function deleteGroup(id: string) {
  fail((await supabase.rpc("delete_group", { p_group: id })).error);
}

/** 'joined' (public group or an invite) or 'requested' (private group). */
export async function joinGroup(id: string): Promise<"joined" | "requested"> {
  const { data, error } = await supabase.rpc("join_group", { p_group: id });
  fail(error);
  return data as "joined" | "requested";
}

/** Leave, cancel your request or decline an invite. */
export async function leaveGroup(id: string) {
  fail((await supabase.rpc("leave_group", { p_group: id })).error);
}

export async function inviteToGroup(id: string, userId: string) {
  fail((await supabase.rpc("invite_to_group", { p_group: id, p_user: userId })).error);
}

export async function respondRequest(id: string, userId: string, accept: boolean) {
  fail((await supabase.rpc("respond_group_request", { p_group: id, p_user: userId, p_accept: accept })).error);
}

export async function setGroupRole(id: string, userId: string, role: GroupRole) {
  fail((await supabase.rpc("set_group_role", { p_group: id, p_user: userId, p_role: role })).error);
}

export async function removeMember(id: string, userId: string) {
  fail((await supabase.rpc("remove_group_member", { p_group: id, p_user: userId })).error);
}
