import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { friendKeys } from "@/lib/friends";
import { voiceKeys } from "@/lib/voice";
import { dailyKeys, getToday } from "@/lib/daily";

/**
 * One realtime channel for the signed-in user (RLS limits events to their own rows),
 * plus a timer that refreshes the feed when the next daily prompt fires (new moment →
 * the feed locks again until you post).
 */
export function RealtimeSync() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = useQuery({ queryKey: dailyKeys.today, queryFn: getToday, enabled: !!user });
  const next = today.data?.next_prompt_at;
  useEffect(() => {
    if (!next) return;
    const ms = new Date(next).getTime() - Date.now() + 1000;
    if (ms > 2 ** 31 - 1) return;
    const id = setTimeout(() => void qc.invalidateQueries({ queryKey: dailyKeys.all }), Math.max(0, ms));
    return () => clearTimeout(id);
  }, [next, qc]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`sync-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        void qc.invalidateQueries({ queryKey: friendKeys.all });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_messages" }, () => {
        void qc.invalidateQueries({ queryKey: voiceKeys.all });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_posts" }, () => {
        void qc.invalidateQueries({ queryKey: dailyKeys.all });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc]);
  return null;
}
