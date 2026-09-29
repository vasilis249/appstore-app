import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { friendKeys } from "@/lib/friends";
import { voiceKeys } from "@/lib/voice";
import { dailyKeys, getToday } from "@/lib/daily";
import { notificationKeys } from "@/lib/notifications";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

/**
 * One realtime channel for the signed-in user (RLS limits events to their own rows),
 * plus a timer that refreshes the feed when the next daily prompt fires (new moment →
 * the feed locks again until you post).
 */
export function RealtimeSync() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const { t } = useTranslation();
  const today = useQuery({ queryKey: dailyKeys.today, queryFn: getToday, enabled: !!user });
  const next = today.data?.next_prompt_at;
  // Fire once per prompt, even if the device clock runs ahead of the server's.
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (!next || fired.current === next) return;
    const ms = new Date(next).getTime() - Date.now() + 1000;
    if (ms > 2 ** 31 - 1) return;
    if (ms <= 0) {
      // Already past on this device (clock ahead of the server): just refresh shortly, no notice.
      fired.current = next;
      const id = setTimeout(() => void qc.invalidateQueries({ queryKey: dailyKeys.all }), 5_000);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      fired.current = next;
      void qc.invalidateQueries({ queryKey: dailyKeys.all });
      // In the app the local notification also fires; this covers the open screen.
      toast(t("prompt.title"), {
        description: t("prompt.body"),
        duration: 15_000,
        action: { label: t("posts.giveYourTake"), onClick: () => void router.navigate({ to: "/" }) },
      });
    }, ms);
    return () => clearTimeout(id);
  }, [next, qc, router, t]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        void qc.invalidateQueries({ queryKey: notificationKeys.all });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc]);
  return null;
}
