# Speak — Social design system

**Decision (product owner, 2026-10-01):** Speak looks and moves like today's Instagram — a white (light) or black
(dark) canvas, the system font, grey fills, one blue for actions, round avatars with story rings, a floating tab
capsule, and quick springy motion. It is *our* app: own wordmark and mark (the 11-bar voice icon), own ring
gradient, no Instagram logo, glyphs or names. Light / dark follow the iPhone.

**Status: reference, not a rule** (user decision 2026-10-01) — it documents the current look so new screens stay
consistent; the agent plugins in CLAUDE.md (Ponytail, agent-skills, Graphify) take priority. Tokens live in ONE file:
`src/design-system.css`; screens use the Tailwind names below.

## 1. Colour

| Role | Light | Dark | Tailwind |
|---|---|---|---|
| Canvas | `#ffffff` | `#000000` | `bg-background` |
| Ink | `#000000` | `#f5f5f5` | `text-foreground` |
| Secondary text | `#737373` | `#a8a8a8` | `text-muted-foreground` |
| Fill (buttons, chips, inputs, search) | `#efefef` | `#262626` | `bg-secondary` |
| Soft surface (voice tile, cards) | `#f7f7f7` | `#121212` | `bg-card` |
| Popover / menu / note bubble | `#ffffff` | `#262626` | `bg-popover` |
| Sheet / its grouped rows | `#ffffff` / `#f2f2f2` | `#262626` / `#363636` | `bg-sheet` / `bg-group` |
| Hairline | `#dbdbdb` | `#262626` | `border-border` |
| Action (Follow, primary buttons, unread dot, ✓) | `#0095f6` | `#0095f6` | `bg-primary`, `text-primary` |
| Link text | `#0095f6` | `#4cb5f9` | `text-link` |
| Like / live / recording / badges | `#ff3040` | `#ff3040` | `text-live`, `bg-live` |
| Here / online / friend | `#2bc24a` | `#3ad35b` | `bg-success`, `text-success` |
| Tab capsule / its pill | `rgb(242 242 242/.86)` / `rgb(0 0 0/.08)` | `rgb(38 38 38/.86)` / `rgb(255 255 255/.12)` | `bg-nav`, `bg-nav-active` |
| Story ring | `#ff7a1a → #ff2e74 → #8a3ffc` (45°) | same | `.story-ring` |

Rules: black/white carry the UI; blue only for the one primary action and links; red only for likes, live audio and
counts; secondary buttons are grey fills, never outlines. Cards are rare — most content sits on the canvas separated
by hairlines.

## 2. Type (system font: SF Pro on iPhone, Greek included)

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `text-hero` | 28 / 1.15 | 700 | rare big numbers / titles |
| `text-display` | 24 / 1.2 | 700 | page titles inside content |
| `text-tagline` | 20 / 1.25 | 700 | sheet / section titles |
| `text-body` | 16 / 1.4 | 400 | default text |
| `text-callout` | 15 / 1.35 | 400–600 | names, list rows |
| `text-caption` | 13 / 1.35 | 400–600 | meta, chips |
| `text-fine` | 12 / 1.3 | 400–600 | under avatars, labels |

Headers: centred bold 17–22px (Home's feed title 22/800 with ⌄; profile = username 20/800). Names bold, meta grey,
counts bold numbers over regular labels (profile). No uppercase labels, no letter-spaced caps.

## 3. Shape & spacing
Radii: 6 (tiny), 8 (`rounded-lg` buttons, chips), 12 (`rounded-xl` inputs, cards), 16 (`rounded-2xl`/`3xl` voice
tiles, sheets), full (avatars, capsule, pills). Gutter 16px. Rows ≥ 44px, icons 24–26px with 44px hit areas.
Avatars: 26 (tab), 32–40 (rows/posts), 56 (messages), 66 + ring (stories), 76 (notes), 86 (profile).

## 4. Motion (Instagram-like: quick, springy, meaningful — `prefers-reduced-motion` turns it off)
| What | How | Where |
|---|---|---|
| Press | `scale(.94)` in 80 ms, back in 200 ms | every button / link |
| Tab pill | glides between tabs, 420 ms `cubic-bezier(.34,1.4,.5,1)` | `.nav-pill` (BottomNav) |
| Page change | push = slide in from the right / back = slide out (340 ms iOS curve); tabs cross-fade | View Transitions, types from `router.tsx` |
| Like | heart pops (420 ms overshoot) | `.animate-like-pop` |
| Double-tap a voice | big heart bursts and floats up (900 ms) + like | `.animate-heart-burst` (PostCard) |
| Story ring | spins while that person's voices play | `.story-ring.spin` |
| Lists | rise in with a 40 ms stagger (max 240 ms) | `.stagger` |
| Loading | shimmer skeletons | `.skeleton` |
| Sheets / menus | vaul spring / Radix zoom-fade | Drawer, DropdownMenu |
| Recording | voice bars breathe, red | `VoiceIcon live` |

## 5. Components
- **Tab capsule** (`BottomNav`): floating, `bg-nav` + blur + `shadow-float`, five icons, no labels: Home (house,
  filled when active), Map, the voice mark (tap = compose, hold = push-to-talk from any screen), Search, Profile
  (avatar, ring when active). Active = the gliding grey pill. Hidden in conversations, walkie, composer, auth.
- **Header** (`AppHeader`): canvas-coloured, sticky, no hairline. Left "+" (record) or black back chevron; centre
  title; right 44px icons. Home: `+` · feed switcher «Για σένα ⌄» (Campus / Ακολουθείς / Ομάδες / Ειδήσεις) · ♥
  (notifications) · ✈ (messages); red count badges with a canvas border.
- **Stories** (`StoriesRow`): you first (+ badge), then people you follow who spoke in 24 h; ring until heard; tap
  plays their voices back to back.
- **Voice post** (`PostCard`): avatar 40 · bold name · school · time · ⋯; section/topic line; title; the voice tile
  (`bg-card`, ring hairline, black round ▶, waveform, duration/listens); actions ♥ 💬 ⟲ ✈ with counts.
- **Profile** (`ProfileView`): photo 86 (+), name, counts row, school; buttons Edit / Share / find people (theirs:
  Follow (blue) / Message / walkie); groups as round highlights; icon tabs (voices grid 3×, replies list).
- **Messages**: username title + compose; search field; walkie friends with note bubbles (live / new / channel) and
  green "here" dots; «Μηνύματα» + «Walkie-talkie»; rows avatar 56, bold + blue dot when unheard.
- **Buttons**: primary `bg-primary` (Follow, main CTA) `rounded-lg` h-9/h-11; secondary `bg-secondary`; text
  buttons in `text-link`. **Chips**: `rounded-lg` `bg-secondary`, selected `bg-foreground text-background`.
- **Segmented** (`components/segmented.tsx`): only for settings-like choices (who may talk, admin queues).
- **Sheets**: `bg-sheet`, 16px top radius, grabber, grouped rows `bg-group`.
- **Map**: OpenFreeMap `liberty` / `dark`; you = photo with blue ring; friends green; floating round controls.

## 6. Don't
Emoji as icons · outlines for secondary buttons · more than one blue button per screen · uppercase labels ·
decorative gradients (the story ring is the only one) · shadows on content (only floating chrome) · copying
Instagram's logo, glyph shapes or wording.
