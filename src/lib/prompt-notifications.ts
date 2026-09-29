// The daily prompt as iOS local notifications (free: no APNs). Every device asks the
// server for the same schedule (prompt_schedule) and keeps the next 30 prompts
// scheduled, so everyone is notified at the same time. No-ops outside the app.
import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/native";

const PREF_KEY = "courtsie:dailyPrompt"; // "off" = the user turned it off in Settings
const DAYS = 30;

export type PromptPermission = "granted" | "denied" | "prompt" | "unsupported";

async function plugin() {
  return (await import("@capacitor/local-notifications")).LocalNotifications;
}

/** Notification ids are the moment as a number (2026-10-01 → 20261001). */
const idFor = (moment: string) => Number(moment.replaceAll("-", ""));
const isOurs = (id: number) => id >= 20_000_000 && id < 30_000_000;

export function dailyPromptOn(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setDailyPromptOn(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

export async function promptPermission(): Promise<PromptPermission> {
  if (!isNativeApp()) return "unsupported";
  const { display } = await (await plugin()).checkPermissions();
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "prompt";
}

/** Shows the iOS permission dialog (only the first time). */
export async function requestPromptPermission(): Promise<PromptPermission> {
  if (!isNativeApp()) return "unsupported";
  const { display } = await (await plugin()).requestPermissions();
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "prompt";
}

export async function cancelDailyPrompts() {
  if (!isNativeApp()) return;
  const ln = await plugin();
  const { notifications } = await ln.getPending();
  const ours = notifications.filter((n) => isOurs(n.id));
  if (ours.length) await ln.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
}

/** Replace the scheduled prompts with the next 30 from the server (if allowed and turned on). */
export async function syncDailyPrompts() {
  if (!isNativeApp()) return;
  await cancelDailyPrompts();
  if (!dailyPromptOn() || (await promptPermission()) !== "granted") return;
  const { data, error } = await supabase.rpc("prompt_schedule", { p_days: DAYS });
  if (error || !data) return;
  const soon = Date.now() + 5_000;
  const notifications = data
    .filter((r) => new Date(r.prompt_at).getTime() > soon)
    .map((r) => ({
      id: idFor(r.moment),
      title: i18n.t("prompt.title"),
      body: i18n.t("prompt.body"),
      schedule: { at: new Date(r.prompt_at), allowWhileIdle: true },
      extra: { route: "/record" },
    }));
  if (notifications.length) await (await plugin()).schedule({ notifications });
}

/** Tapping a prompt notification opens the recorder. */
export async function onDailyPromptTap(open: (route: string) => void) {
  if (!isNativeApp()) return () => {};
  const handle = await (await plugin()).addListener("localNotificationActionPerformed", (e) => {
    open((e.notification.extra as { route?: string } | undefined)?.route ?? "/record");
  });
  return () => void handle.remove();
}
