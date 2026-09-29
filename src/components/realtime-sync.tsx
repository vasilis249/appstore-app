import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { friendKeys } from "@/lib/friends";
import { voiceKeys } from "@/lib/voice";
import { dailyKeys } from "@/lib/daily";

/** One realtime channel for the signed-in user; RLS limits events to their own rows. */
export function RealtimeSync() {
  const { user } = useAuth();
  const qc = useQueryClient();
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
