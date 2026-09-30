import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { isNativeApp } from "@/lib/native";
import { cancelDailyPrompts, onDailyPromptTap, syncDailyPrompts } from "@/lib/prompt-notifications";

/**
 * Keeps the next 30 daily prompts scheduled on the device while signed in: on start,
 * whenever the app comes back to the foreground and when the language changes.
 * Signing out clears them.
 */
export function DailyPromptScheduler() {
  const { user, loading } = useAuth();
  const { i18n } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp() || loading) return;
    if (!user) {
      void cancelDailyPrompts();
      return;
    }
    void syncDailyPrompts();
    let remove: (() => void) | undefined;
    void import("@capacitor/app").then(async ({ App }) => {
      const h = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void syncDailyPrompts();
      });
      remove = () => void h.remove();
    });
    return () => remove?.();
  }, [user, loading, i18n.language]);

  useEffect(() => {
    let off: (() => void) | undefined;
    // history.push: routes may carry a query (/map?u=…).
    void onDailyPromptTap((route) => router.history.push(route)).then((f) => (off = f));
    return () => off?.();
  }, [router]);

  return null;
}
