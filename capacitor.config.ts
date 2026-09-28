import type { CapacitorConfig } from "@capacitor/cli";

// The iOS app is a native shell around the hosted web app (TanStack Start on
// Cloudflare), because the server functions need a server. The shell only
// needs the web app URL; Supabase keys live in the web host's env, never here.
//
// CAP_SERVER_URL comes from the git-ignored .env (see .env.example).
// `npx cap sync ios` copies the result into ios/App/App/capacitor.config.json
// (also git-ignored).
try {
  process.loadEnvFile(".env");
} catch {
  // No .env — fall back to the real environment.
}

const serverUrl = process.env.CAP_SERVER_URL;
if (!serverUrl) {
  throw new Error("Set CAP_SERVER_URL in .env (e.g. https://courtsie.<you>.workers.dev)");
}

const config: CapacitorConfig = {
  appId: process.env.CAP_APP_ID ?? "gr.innera.courtsie",
  appName: "Courtsie",
  // Local fallback bundle; the app normally loads server.url.
  webDir: "capacitor/www",
  server: {
    url: serverUrl,
    // Plain http only for a dev server on your LAN (e.g. http://192.168.1.10:8080).
    cleartext: serverUrl.startsWith("http://"),
  },
  ios: {
    contentInset: "automatic",
    scheme: "Courtsie",
  },
};

export default config;
