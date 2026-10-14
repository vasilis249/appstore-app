# Speak — "Glass" design system

**Decision (product owner, 2026-10-14):** approved from the mockups (canvas artifact "Speak — Glass design",
https://claude.ai/artifact/GqSaC9Rha6s3j3LRpSDC8U). Glass over the campus: content (text, photos, voices, the map)
stays opaque and calm on a cool mist ground; only the navigation layer floating over it is glass, like iOS 26. One
memorable element: the voice drop beside the tab bar, which turns into a red recording capsule. Light / dark follow
the iPhone.

**Status: reference, not a rule** (user decision 2026-10-01) — it documents the current look so new screens stay
consistent; the agent plugins in CLAUDE.md take priority. Tokens live in ONE file: `src/design-system.css`.

## 1. Colour

| Role | Light | Dark | Tailwind |
|---|---|---|---|
| Ground (Mist) | `#eef0f4` | `#07080b` | `bg-background` |
| Ink (text, play buttons, primary action, active feed pill) | `#0e1116` | `#f1f2f5` | `text-foreground`, `bg-primary` |
| Secondary text | `#5b6170` | `#9ca2ae` | `text-muted-foreground` |
| Cards (voice tile, news cards, rows) | `#ffffff` | `#16181f` | `bg-card` |
| Fields, chips, secondary buttons | `#e3e6ec` | `#16181f` | `bg-secondary` |
| Hairline | `#dce0e7` | `#1e2129` | `border-border` |
| Unplayed waveform bars | `#c3c8d2` | `#3a3e4a` | `bg-wave` |
| Signal — labels, links, Follow, unread, the voice drop | `#2e4bff` | `#8d9bff` | `text-link`, `bg-link` |
| Live — recording, talking, likes, badges | `#ff3b30` | `#ff5a50` | `bg-live`, `text-live` |
| Here / online | `#1f9d57` | `#4cd98a` | `bg-success` |

## 2. Glass (`glass` utility)
Frost `blur(22px) saturate(180%)` + translucent fill (`--glass`: white 58 % / `#1e212a` 50 %) + a rim brighter than
the fill + an inner top highlight + a soft float shadow. `scroll-edge` = the blur that fades content as it passes under
floating top controls. With "Reduce transparency" glass becomes solid (`--glass-solid`).
**Where:** tab-bar capsule, voice drop, Home's feed switch, round header buttons (back, bell, messages), mini player,
recording capsule, map controls and sheets, photo remove buttons. **Never** on cards / posts (content stays opaque) and
never more than a handful per screen (each one re-blurs what's behind it).

## 3. Type — Commissioner (Kostas Bartsokas, SIL OFL; self-hosted woff2, Greek + Latin, 400–700)

| Token | Size / weight | Use |
|---|---|---|
| `text-hero` | 30 / 700, −0.03em | large titles of tab roots (Campus, Αναζήτηση) |
| `text-display` | 24 / 650 | big titles in content |
| `text-tagline` | 20 | composer text, focused post text, sheet titles |
| `text-body` | 16 / 400 | post text, reading |
| `text-callout` | 15 | names (600), rows |
| `text-caption` | 13 | meta (school · time), counts, feed switch |
| `text-fine` | 12 / 600 | blue place labels (🎓 Εξεταστική) |

## 4. Shape & spacing
Radii 10 / 14 / 16–20 (cards, photos 16, sheets) / full (glass controls, chips, avatars, play buttons). Gutter 16.
Touch targets ≥ 44 pt (post actions 36 pt high, full width of their label).

## 5. Motion (iOS springs `cubic-bezier(.32,.72,0,1)`; everything off with Reduce Motion)
Tab pill glides to the active tab · press scale .96 · like pop + rolling number · playing bars breathe · lists rise in
(`.stagger`) · mini player / recording capsule spring up (`.animate-slide-up`) · the voice drop swells red with a pulse
ring while held (`.animate-rec-pulse`) · push / pop slides with parallax, tabs cross-fade. Haptics: `src/lib/haptics.ts`.

## 6. Components
- **Tab bar** (`BottomNav`): floating glass capsule (Home, Map, Search, Profile avatar; a soft pill glides to the
  active one) + the separate glass **voice drop** (`NavRecordButton`: tap = compose, hold = push to talk anywhere).
- **Header** (`AppHeader`): `large` = large title with a grey kicker (scrolls away; Home: bell on the right);
  otherwise a sticky centred title over a scroll edge with a round glass back button.
- **Home**: large title · sticky glass **feed switch** (Campus · Ακολουθείς · Ομάδες · Ειδήσεις, active = ink pill) with
  the messages button · chips · feed.
- **Post** (`PostCard`, like X): avatar · "name school · time" · ⋯; blue place line; text (≤ 280, full); 1–4 photos
  (one wide, two side by side, three = tall + two, 2×2); a slim white voice pill when it has a voice; 💬 ⟲ ♥ ✈ + 🎧.
- **Composer** (`/record`): back + ink Publish pill; avatar + big text field; photo previews (remove on glass); "Πού
  ανήκει" chips; bottom = glass toolbar (photos, camera, 280 ring) + voice drop → red capsule while recording → voice
  chip (play, "Ξανά").

## 7. Don't
Glass on content · gradient washes / colour blobs behind glass · emoji as icons · more than one ink button per screen ·
blue for anything but labels, links, Follow, "new" and the voice drop · uppercase labels.
