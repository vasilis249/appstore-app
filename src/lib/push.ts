// APNs pushes in the iOS app: the device token goes to the server (register_push_token), a tap opens the route the
// server put in the push. No-ops on the web and in app builds made before the plugin was added.
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/native";

const TOKEN_KEY = "courtsie:pushToken";

/** Wrapped: a Capacitor plugin proxy must never be the value of a promise (see prompt-notifications.ts). */
async function plugin() {
  return { pn: (await import("@capacitor/push-notifications")).PushNotifications };
}

export const pushAvailable = () => isNativeApp() && Capacitor.isPluginAvailable("PushNotifications");

const stored = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export async function pushPermission(): Promise<"granted" | "denied" | "prompt" | "unsupported"> {
  if (!pushAvailable()) return "unsupported";
  const { receive } = await (await plugin()).pn.checkPermissions();
  return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt";
}

/** Registers this device for pushes; `ask` shows the iOS dialog when it was never answered. */
export async function enablePush(ask: boolean): Promise<boolean> {
  if (!pushAvailable()) return false;
  const { pn } = await plugin();
  let { receive } = await pn.checkPermissions();
  if (ask && receive !== "granted" && receive !== "denied") receive = (await pn.requestPermissions()).receive;
  if (receive !== "granted") return false;
  await pn.register();
  return true;
}

/** Token → server (in the app's language); tap → onOpen(route). Returns the cleanup. */
export async function listenPush(lang: string, onOpen: (route: string) => void): Promise<() => void> {
  if (!pushAvailable()) return () => {};
  const { pn } = await plugin();
  const reg = await pn.addListener("registration", ({ value }) => {
    const token = value.toLowerCase();
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
    // the query builder only runs once it is awaited / then-ed
    void supabase.rpc("register_push_token", { p_token: token, p_lang: lang.startsWith("en") ? "en" : "el" }).then(() => {});
  });
  const tap = await pn.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const route = (notification.data as { route?: unknown } | undefined)?.route;
    if (typeof route === "string" && route.startsWith("/")) onOpen(route);
  });
  return () => {
    void reg.remove();
    void tap.remove();
  };
}

/** Before signing out: this device stops getting this account's pushes. */
export async function forgetPushToken() {
  const token = stored();
  if (token) await supabase.rpc("unregister_push_token", { p_token: token });
}

/** Phone notifications per category (the in-app list keeps everything). */
export type PushCategory = "messages" | "replies" | "courses" | "reactions" | "people" | "groups";
export const pushSettingsKey = ["push", "settings"] as const;
export async function pushSettings(): Promise<{ category: PushCategory; push: boolean }[]> {
  const { data, error } = await supabase.rpc("my_push_settings");
  if (error) throw new Error(error.message);
  return (data ?? []) as { category: PushCategory; push: boolean }[];
}
export async function setPushSetting(category: PushCategory, on: boolean) {
  const { error } = await supabase.rpc("set_push_setting", { p_category: category, p_on: on });
  if (error) throw new Error(error.message);
}
