import { supabase } from "@/integrations/supabase/client";
import { authRedirectUrl, isNativeApp } from "@/lib/native";

export type OAuthProvider = "google" | "apple";

/**
 * Which social logins are switched on in Supabase (Auth → Providers). The buttons only show for these,
 * so a provider can be enabled later without shipping a new build.
 */
export async function enabledProviders(): Promise<Record<OAuthProvider, boolean>> {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    const s = (await res.json()) as { external?: Partial<Record<OAuthProvider, boolean>> };
    return { google: !!s.external?.google, apple: !!s.external?.apple };
  } catch {
    return { google: false, apple: false };
  }
}

/**
 * Web: a normal redirect. iOS app: Google refuses sign-in inside an embedded web view, so the provider page
 * opens in Safari (SFSafariViewController); Supabase then redirects to courtsie://app/auth?…&code=…, which
 * initNativeShell() turns back into this origin (the PKCE code is exchanged on load) and closes Safari.
 */
export async function signInWithProvider(provider: OAuthProvider) {
  const redirectTo = authRedirectUrl("/auth?welcome=1");
  if (!isNativeApp()) {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) throw error;
    return;
  }
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw error;
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: data.url, presentationStyle: "popover" });
}
