import { supabase } from "@/integrations/supabase/client";

export interface AppNotification {
  id: number;
  kind: "follow" | "like" | "reply" | "repost" | "report" | "group_invite" | "group_request" | "group_accepted" | "group_joined" | "invite_joined" | "walkie" | "nearby" | "file_thanks" | "files_helped" | "course_file" | "course_question" | "answer_helpful";
  created_at: string;
  read_at: string | null;
  post_id: string | null;
  actor: { id: string; username: string; full_name: string; avatar_path: string | null } | null;
  post: { title: string | null } | null;
  group_id: string | null;
  group: { name: string } | null;
  course_id: string | null;
  /** files_helped: classmates this week; course_file: new files since you last looked */
  count: number | null;
  course: { name: string } | null;
  file: { title: string } | null;
}

export const notificationKeys = {
  all: ["notifications"] as const,
  list: ["notifications", "list"] as const,
  unread: ["notifications", "unread"] as const,
};

export async function listNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, kind, created_at, read_at, post_id, group_id, course_id, count, group:groups(name), course:courses(name), file:course_files(title), actor:profiles!notifications_actor_id_fkey(id, username, full_name, avatar_path), post:posts(title)",
    )
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AppNotification[];
}

export async function unreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markAllRead() {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) throw new Error(error.message);
}
