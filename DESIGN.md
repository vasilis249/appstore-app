# Speak — "Quiet" design system

**Decision (product owner, 2026-10-01):** approved from the mockups (artifact "Speak — νέο design για φοιτητές").
Quiet, professional, student-first: ink on white (or black), a grey scale, ONE indigo accent, the voice always at the
centre, iOS large titles, hairlines instead of boxes, and motion that explains what happened. Light / dark follow
the iPhone.

**Status: reference, not a rule** (user decision 2026-10-01) — it documents the current look so new screens stay
consistent; the agent plugins in CLAUDE.md take priority. Tokens live in ONE file: `src/design-system.css`.

## 1. Colour

| Role | Light | Dark | Tailwind |
|---|---|---|---|
| Canvas | `#ffffff` | `#0a0a0b` | `bg-background` |
| Ink (text, play buttons, primary action) | `#0b0b0c` | `#ededef` | `text-foreground`, `bg-primary` |
| Secondary text | `#6b6b75` | `#9b9ba5` | `text-muted-foreground` |
| Surface (voice tile, inputs, chips, secondary buttons, cards) | `#f4f4f5` | `#17171a` | `bg-card`, `bg-secondary` |
| Popover / sheet / mini player | `#ffffff` | `#1d1d21` | `bg-popover`, `bg-sheet` |
| Hairline | `#eaeaec` | `#242428` | `border-border` |
| Unplayed waveform bars | `#cdcdd3` | `#3a3a41` | `bg-wave` |
| Accent — labels, links, Follow, unread dots, unheard ring | `#3346d3` | `#8f9bff` | `text-link`, `bg-link` |
| Live — recording, talking, likes, badges | `#e5484d` | `#ff6b70` | `bg-live`, `text-live` |
| Here / online | `#2f9e57` | `#4cc27a` | `bg-success` |

Rules: ink carries the UI; indigo only for labels, links, Follow and "new"; red only for live audio, likes and
counts. No gradients (the rotating "playing" arc is the one exception), no coloured rings, no shadows except on
floating things (mini player, sheets, toasts).

## 2. Type (SF Pro on iPhone, Greek included; numbers tabular)

| Token | Size / weight | Use |
|---|---|---|
| `text-hero` | 30 / 700, −0.03em | large titles of tab roots (Campus, Ειδήσεις, Αναζήτηση) |
| `text-display` | 24 / 650 | big titles in content |
| 22 / 650 | | lead headline, focused voice title |
| `text-tagline` | 20 / 650 | sheet titles |
| `text-body` | 16 / 400–500 | voice titles (500), reading |
| `text-callout` | 15 | names (600), rows, tabs |
| `text-caption` | 13 | meta (school · time), counts |
| `text-fine` | 12 / 600 | indigo place labels (ΕΜΠ · Εξεταστική) |

## 3. Shape & spacing
Radii 10 (buttons, chips-as-rects), 14 (voice tile, inputs, CTAs), 20 (cards, lead news card, sheets), full
(avatars, chips, play buttons). Gutter 16. Rows ≥ 44 pt. Content sits on the canvas separated by hairlines; boxes
only for the voice tile and lead cards.

## 4. Motion (iOS springs `cubic-bezier(.32,.72,0,1)`; everything off with Reduce Motion)
| What | How | Where |
|---|---|---|
| Tabs | 450 ms spring line under the active tab; light haptic | Home feeds, profile tabs, tab-bar dot |
| Press | scale .96, 220 ms | every button / link |
| Like | heart pops (420 ms), number rolls in (`.animate-tick`); light haptic | PostCard |
| Voice playing | played bars turn ink, all bars breathe (`.wave-live`) | PostCard, post page |
| Lists | rise in, +40 ms per row (`.stagger`) | feeds, rows, profile |
| Mini player | springs up from below (`.animate-slide-up`), thin ink progress line | above the tab bar |
| Recording | red circle → rounded square (`.ease-spring`), pulse ring (`.animate-rec-pulse`), ring fills to 2:00; medium haptic | composer, tab-bar voice key |
| Navigation | push / pop slide with 30 % parallax, tabs cross-fade (View Transitions) | router |
| Loading | shimmer skeletons | everywhere |

Haptics: `src/lib/haptics.ts` (`@capacitor/haptics`; needs a native rebuild, older builds skip it).

## 5. Components
- **Tab bar** (`BottomNav`): flat frosted bar with a hairline, five line icons (Home, Map, the ink voice key — tap =
  compose, hold = push to talk —, Search, Profile avatar); active = ink + heavier stroke + a gliding dot.
- **Header** (`AppHeader`): `large` = iOS large title on the left with a small grey `kicker` above (Home: "ΕΜΠ ·
  1.204 φοιτητές"); otherwise a centred 17/600 title with a thin back chevron. Home's right: bell + messages.
- **Home**: large title · `FeedTabs` (ΕΜΠ · Ακολουθείς · Ομάδες · Ειδήσεις) · recent voices (avatars with a thin indigo
  ring until heard) · chips · feed. "Πες κάτι…" rows are grey fields with an indigo voice mark.
- **Voice post** (`PostCard`): avatar 36 · name over "school · time" · ⋯; indigo place line; title 16/500; the voice
  tile (surface, ink round play, waveform, duration); 💬 ⟲ ♥ ✈ in grey with counts, 🎧 listens on the right.
  `focus` (post page): 22 px title, big player.
- **News** (`NewsCard`): topic of the day = lead card (photo if any, indigo label, 22 px headline, who spoke, ink
  "Πες τη γνώμη σου"); other headlines = typographic rows with an optional small photo.
- **Profile**: photo 80 + counts, name, indigo school badge, grey buttons, groups as rounded tiles, text tabs,
  voices as compact rows.
- **Buttons**: primary = ink rounded rect (`bg-primary rounded-xl`), Follow = indigo (`bg-link`), secondary = grey
  surface; chips = pills (`rounded-full`, selected = ink).

## 6. Don't
Emoji as icons · gradients / coloured rings · more than one ink button per screen · indigo for anything but labels,
links, Follow and "new" · shadows on content · uppercase labels.
