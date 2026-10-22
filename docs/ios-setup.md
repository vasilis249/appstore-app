# Hosting + iOS app setup (Capacitor) — Speak

Architecture: the web app (TanStack Start + server functions) runs as a Cloudflare Worker.
The iOS app is a Capacitor shell that loads that URL (`server.url`) and adds native features.
Web changes ship with `bun run deploy` — no App Store update needed unless native code/config changes.

Where config lives (all git-ignored):
| What | Where |
|---|---|
| Public Supabase URL + publishable key for the browser bundle | `.env` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (build time) |
| Server secret (service_role) | Cloudflare secrets (`wrangler secret put`) — never in `.env` for builds you ship |
| Web app URL + bundle ID for the iOS shell | `.env` → `CAP_SERVER_URL`, `CAP_APP_ID` |

## 1. One-time prerequisites (Mac)
- Xcode (App Store) — open it once and accept the license / install iOS simulator.
- Node 22+ and Bun (`curl -fsSL https://bun.sh/install | bash`).
- Free Cloudflare account. Apple ID (free is enough for your own iPhone; the $99/yr
  Apple Developer Program is needed for TestFlight/App Store).

```bash
git clone https://github.com/vasilis249/appstore-app.git && cd appstore-app
git checkout claude/exciting-noether-q756ri
bun install
cp .env.example .env   # fill VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY; CAP_* after step 2
```

## 2. Deploy the web app to Cloudflare
```bash
npx wrangler login
bun run deploy                     # prints https://courtsie.<your-subdomain>.workers.dev
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```
`SUPABASE_URL` / `SUPABASE_PROJECT_ID` are plain vars in `wrangler.jsonc`.
Then put the printed URL into `.env` as `CAP_SERVER_URL`, and in Supabase →
Authentication → URL Configuration set Site URL = that URL, Redirect URLs = `<that URL>/**` and
`courtsie://**` (auth emails requested from the app come back into the app through this scheme).

## 3. Open the iOS project
```bash
bun install         # after pulling: picks up new plugins (e.g. background location)
bun run ios:sync    # after any change to capacitor.config.ts, .env CAP_* values or plugins
                    # (also patches plugins whose Swift package pins an older Capacitor, and makes the location plugin
                    #  ask for temporary Precise Location when it is off: scripts/patch-native-plugins.mjs)
bun run ios:open    # opens ios/App/App.xcodeproj in Xcode
```

## 4. Xcode steps (by hand)
1. Left sidebar: click **App** (blue icon) → target **App** → tab **Signing & Capabilities**.
2. Tick **Automatically manage signing**, pick your **Team** (Add Account… with your Apple ID if empty).
3. **Bundle Identifier**: `gr.innera.courtsie` (or your own; keep it equal to `CAP_APP_ID`). It must be
   globally unique — if Xcode complains, change it in both places and re-run `bun run ios:sync`.
4. **Simulator**: top bar device menu → e.g. *iPhone 16* → press ▶ (⌘R).
5. **Your iPhone**: connect via USB (or same Wi-Fi after first pairing), tap *Trust* on the phone,
   enable Settings → Privacy & Security → **Developer Mode** (phone restarts), select the phone in
   the device menu → ▶. With a free Apple ID: Settings → General → VPN & Device Management →
   trust your developer certificate; the install expires after 7 days.
6. **Live map (location)**: Info.plist already has the location texts and `UIBackgroundModes` → `location` (with
   `audio`); in *Signing & Capabilities* you should see **Background Modes** with *Audio* and *Location updates*
   ticked (add the capability if Xcode doesn't show it). On the phone: Speak → Profile → ⚙︎ → Τοποθεσία → choose a
   mode → allow location → later iOS asks to "Change to Always Allow" (or Settings → Speak → Location → Always).
   The blue location pill in the status bar while it runs in the background is expected.

## 5. Push notifications (APNs)

The app registers the iPhone for pushes (`@capacitor/push-notifications`, `App/App.entitlements` with `aps-environment`,
token callbacks in `AppDelegate.swift`); the server sends them from the Supabase Edge Function `push`
(`supabase/functions/push`), which the database calls for every new notification / DM (`private.push_dispatch`).

One-time, by hand:
1. Xcode → target App → Signing & Capabilities: check that **Push Notifications** is listed (the entitlements file adds it;
   if Xcode shows a signing error, press **+ Capability → Push Notifications**).
2. developer.apple.com → Certificates, IDs & Profiles → **Keys → +** → name «Speak push», tick **Apple Push
   Notifications service (APNs)** → Configure → Environment **Sandbox & Production** (a Sandbox-only key gets
   `BadEnvironmentKeyInToken` from TestFlight / App Store builds) → Continue → Register → **Download** the `.p8` (only once!). Note the **Key ID** and
   your **Team ID** (top right of the page).
3. Supabase dashboard → Edge Functions → **Secrets**: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (the whole
   `.p8` text, BEGIN/END lines included). `PUSH_SECRET` and `private.push_config` are already set.
4. New build (the plugin is native): `bun install`, `bun run ios:sync`, Archive → TestFlight.

Check: allow notifications in the app (Notifications screen → «Ενεργοποίηση», or «Το δίνω» on a course), then have the
demo friend send a message. Xcode builds use the APNs sandbox, TestFlight / App Store production; the function tries
production first and then the sandbox.

## Dev tip: test unreleased web changes on the phone
Run `bun run dev` (listens on all interfaces, port 8080), set `CAP_SERVER_URL=http://<your-mac-LAN-IP>:8080` in `.env`,
`bun run ios:sync`, run from Xcode. Switch back to the workers.dev URL before any release build.
