import { supabase } from "@/integrations/supabase/client";
import { sweepVoiceFilesLater } from "@/lib/api/voice-files.functions";

export interface AdminTopic {
  id: string;
  section_id: string;
  kind: "topic" | "news" | "daily";
  title: string;
  source_name: string | null;
  source_url: string | null;
  daily_date: string | null;
  pinned: boolean;
  hidden: boolean;
  posts_count: number;
  created_at: string;
  /** A campus topic (only that university's students see it). */
  university_id: string | null;
}

export interface AdminFeed {
  id: number;
  section_id: string;
  name: string;
  url: string;
  enabled: boolean;
  last_fetched_at: string | null;
  last_added: number | null;
  last_error: string | null;
}

export const adminKeys = {
  isAdmin: ["admin", "me"] as const,
  staff: ["admin", "staff"] as const,
  moderators: (uni: string) => ["admin", "moderators", uni] as const,
  campuses: ["admin", "campuses"] as const,
  topics: ["admin", "topics"] as const,
  feeds: ["admin", "feeds"] as const,
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Admin (everything) and/or the campus you moderate (reports on its voices: hide / dismiss). */
export interface StaffRole {
  is_admin: boolean;
  moderates: string | null;
}
export async function myStaffRole(): Promise<StaffRole> {
  const { data, error } = await supabase.rpc("my_staff_role");
  fail(error);
  return ((data ?? [])[0] as StaffRole | undefined) ?? { is_admin: false, moderates: null };
}

export async function campusModerators(university: string) {
  const { data, error } = await supabase.rpc("admin_campus_moderators", { p_university: university });
  fail(error);
  return (data ?? []) as { user_id: string; username: string; full_name: string; avatar_path: string | null }[];
}
export async function setCampusModerator(username: string, university: string, on: boolean) {
  fail((await supabase.rpc("admin_set_campus_moderator", { p_username: username, p_university: university, p_on: on })).error);
}
/** Every open campus: verified students, the threshold to open, open or not, how many moderators. */
export interface AdminCampus {
  university_id: string;
  students: number;
  min_students: number;
  is_open: boolean;
  moderators: number;
}
export async function adminCampuses(): Promise<AdminCampus[]> {
  const { data, error } = await supabase.rpc("admin_campuses");
  fail(error);
  return (data ?? []) as AdminCampus[];
}
export async function setCampusThreshold(university: string, minStudents: number) {
  fail((await supabase.rpc("admin_set_campus", { p_university: university, p_min_students: minStudents })).error);
}

export async function amIAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("am_i_admin");
  fail(error);
  return !!data;
}

export async function adminTopics(): Promise<AdminTopic[]> {
  const { data, error } = await supabase.rpc("admin_topics", { p_limit: 150 });
  fail(error);
  return (data ?? []) as AdminTopic[];
}

export async function adminFeeds(): Promise<AdminFeed[]> {
  const { data, error } = await supabase.rpc("admin_feeds");
  fail(error);
  return (data ?? []) as AdminFeed[];
}

export async function createTopic(t: {
  section: string;
  title: string;
  summary?: string;
  sourceUrl?: string;
  dailyDate?: string;
  university?: string;
}) {
  const { error } = await supabase.rpc("admin_create_topic", {
    p_section: t.section,
    p_title: t.title,
    p_summary: t.summary || undefined,
    p_source_url: t.sourceUrl || undefined,
    p_daily_date: t.dailyDate || undefined,
    p_university: t.university || undefined,
  });
  fail(error);
}

export async function updateTopic(id: string, patch: { hidden?: boolean; pinned?: boolean }) {
  fail((await supabase.rpc("admin_update_topic", { p_topic: id, p_hidden: patch.hidden, p_pinned: patch.pinned })).error);
}

export async function setFeed(id: number, enabled: boolean) {
  fail((await supabase.rpc("admin_set_feed", { p_feed: id, p_enabled: enabled })).error);
}

export async function refreshNews(): Promise<number> {
  const { data, error } = await supabase.rpc("admin_refresh_news");
  fail(error);
  return (data as number) ?? 0;
}

export type ReportAction = "dismiss" | "hide_post" | "disable_user" | "delete_group";

export interface AdminReport {
  id: string;
  kind: "user" | "voice_message" | "post" | "group";
  reason: string;
  created_at: string;
  resolved_at: string | null;
  action: ReportAction | null;
  reporter_username: string | null;
  target_user_id: string;
  target_username: string;
  target_name: string;
  target_avatar: string | null;
  target_disabled: boolean;
  target_is_admin: boolean;
  target_id: string | null;
  post_title: string | null;
  post_audio_path: string | null;
  post_duration_ms: number | null;
  post_hidden: boolean | null;
  post_exists: boolean;
  reports_on_target: number;
  group_name: string | null;
  group_exists: boolean;
}

export const reportKeys = {
  all: ["admin", "reports"] as const,
  list: (open: boolean) => ["admin", "reports", open] as const,
  openCount: ["admin", "reports", "count"] as const,
};

export async function adminReports(open: boolean): Promise<AdminReport[]> {
  const { data, error } = await supabase.rpc("admin_reports", { p_open: open, p_limit: 150 });
  fail(error);
  return (data ?? []) as AdminReport[];
}

export async function openReportsCount(): Promise<number> {
  const { data, error } = await supabase.rpc("admin_open_reports");
  fail(error);
  return (data as number) ?? 0;
}

/** Returns how many open reports the action closed. */
export async function resolveReport(id: string, action: ReportAction): Promise<number> {
  const { data, error } = await supabase.rpc("admin_resolve_report", { p_report: id, p_action: action });
  fail(error);
  if (action === "delete_group") sweepVoiceFilesLater();
  return (data as number) ?? 0;
}

export async function setPostHidden(postId: string, hidden: boolean) {
  fail((await supabase.rpc("admin_set_post_hidden", { p_post: postId, p_hidden: hidden })).error);
}

export async function setUserDisabled(userId: string, disabled: boolean) {
  fail((await supabase.rpc("admin_set_user_disabled", { p_user: userId, p_disabled: disabled })).error);
}
