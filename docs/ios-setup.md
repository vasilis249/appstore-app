# Hosting + iOS app setup (Capacitor)

Architecture: the web app (TanStack Start + server functions) runs as a Cloudflare Worker.
The iOS app is a Capacitor shell that loads that URL (`server.url`) and adds native features.
Web changes ship with `bun run deploy` — no App Store update needed unless native code/config changes.

Where config lives (all git-ignored):
| What | Where |
|---|---|
| Public Supabase URL + publishable key for the browser bundle | `.env` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (build time) |
| Server secrets (service_role, DeepL, Maps) | Cloudflare secrets (`wrangler secret put`) — never in `.env` for builds you ship |
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
npx wrangler secret put GOOGLE_MAPS_API_KEY   # optional: maps
npx wrangler secret put DEEPL_API_KEY         # optional: translations
```
`SUPABASE_URL` / `SUPABASE_PROJECT_ID` are plain vars in `wrangler.jsonc`.
Then put the printed URL into `.env` as `CAP_SERVER_URL`, and in Supabase →
Authentication → URL Configuration set Site URL = that URL, Redirect URLs = `<that URL>/**` and
`courtsie://**` (auth emails requested from the app come back into the app through this scheme).
Google Maps key: restrict HTTP referrers to `<that URL>/*`.

## 3. Open the iOS project
```bash
bun run ios:sync    # after any change to capacitor.config.ts, .env CAP_* values or plugins
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

## Dev tip: test unreleased web changes on the phone
Run `bun run dev` (listens on all interfaces, port 8080), set `CAP_SERVER_URL=http://<your-mac-LAN-IP>:8080` in `.env`,
`bun run ios:sync`, run from Xcode. Switch back to the workers.dev URL before any release build.
