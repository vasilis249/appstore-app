import { supabase } from "@/integrations/supabase/client";

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
  topics: ["admin", "topics"] as const,
  feeds: ["admin", "feeds"] as const,
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
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

export async function createTopic(t: { section: string; title: string; summary?: string; sourceUrl?: string; dailyDate?: string }) {
  const { error } = await supabase.rpc("admin_create_topic", {
    p_section: t.section,
    p_title: t.title,
    p_summary: t.summary || undefined,
    p_source_url: t.sourceUrl || undefined,
    p_daily_date: t.dailyDate || undefined,
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
