# Design

Visual system of the Avocate Harvest Escrow web app. Tokens defined here are the single
source of truth: `web/tailwind.config.ts` and `web/src/app/globals.css` implement them and
must change together with this file.

The look follows Avocate's portal: emerald on a light mint background, frosted cards, quiet
typography, and every on-chain step shown to the user as it happens.

## Colour

| Token | Hex | Use |
|---|---|---|
| `brand` | `#009E63` | Primary accent: active navigation, icons, large text, progress |
| `brand-dark` | `#007A4D` | Primary button fill; text and links in the brand colour |
| `brand-deep` | `#00653F` | Hover state of primary buttons |
| `brand-light` | `#4FD1A5` | Background glow only |
| `ink` | `#0B1F17` | Body text |
| `mist` | `#E8F5EF` | Page background; tiles inside a card |
| `surface` | `#F8FCFA` | Cards, dialogs, inputs: a white tinted toward the brand, never pure white |
| `highlight` | `#D4F1E4` | The one highlighted card per screen (`.card-highlight`): the figure or action to watch |
| `pending` / `pending-tint` | `#92400E` / `#FEF3C7` | Pending state |
| `released` / `released-tint` | `#065F46` / `#D1FAE5` | Released state |
| `danger` (+ `strong`, `tint`, `soft`, `line`) | `#BE123C` … | Errors, refunded state, destructive actions |

Text opacity steps on `ink`: 100% body, 70% secondary and muted. 70% is the floor: lighter
text fails contrast on `mist`. Use alpha on `ink` rather than new greys.

Trade states:

| State | Badge |
|---|---|
| Pending | `bg-pending-tint text-pending` |
| Funded | `bg-brand/10 text-brand-dark` |
| Released | `bg-released-tint text-released` |
| Refunded | `bg-danger-tint text-danger-strong` |
| Cancelled | `bg-ink/10 text-ink/80` |

Errors: `border-danger-line bg-danger-soft text-danger`. Every colour is a named token in
`web/tailwind.config.ts`; components never use Tailwind's raw palette.

### Contrast (WCAG 2.1, measured)

| Pair | Ratio | AA normal text (4.5:1) |
|---|---|---|
| `ink` on `mist` | 15.33:1 | pass |
| `brand-dark` on `mist` | 4.82:1 | pass |
| white on `brand-dark` | 5.40:1 | pass |
| white on `brand-deep` | 7.16:1 | pass |
| `ink/70` on `mist` | 6.06:1 | pass |
| `ink/60` on `mist` | 4.36:1 | **fails** |
| white on `brand` | 3.46:1 | **fails** (large text only) |
| `ink/40` on white | 2.52:1 | **fails** |

Hence primary buttons are filled with `brand-dark` (not `brand`), and `ink/70` is the lightest
text. `brand` is kept for accents, icons and large text.

## Background

Flat `mist`. No gradients, glows or blur anywhere: depth comes from a tinted surface on the
mint page, not from effects. Numbers use tabular figures app-wide so amounts line up.

## Typography

System sans stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto`) for
everything, plus Barlow Condensed (served by the app through `next/font`) for the product
name only. Weights:
700 for the app title, 600 for headings and figures, 500 for buttons and labels, 400 for
body. Hierarchy comes from weight and colour, not italics.

| Role | Classes |
|---|---|
| App title | "AVOCATE" in capitals, `text-2xl font-bold` in `ink`; "Harvest Escrow" in Barlow Condensed light (`font-condensed font-light`) in `brand-dark` |
| Section title | `text-lg font-semibold` |
| Label / eyebrow | `.label`: `text-xs font-medium uppercase tracking-wide text-ink/70` |
| Addresses and hashes | `font-mono`, shortened `ABCDEF…UVWXYZ`, linked to the explorer |

## Components

| Class | Definition |
|---|---|
| `.card` | `rounded-3xl border border-ink/[0.06] bg-surface`: solid, one containment layer |
| `.btn-brand` | primary action, `bg-brand-dark hover:bg-brand-deep rounded-xl px-4 py-2.5 font-medium text-white`, disabled at 50% opacity |
| `.btn-ghost` | secondary action, `rounded-xl border border-brand/30 bg-white/60 text-brand-dark` |
| `.input` | `rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm`, focus ring `brand/20` |
| `.figure-xl` | Headline figures: Barlow Condensed, 48–60 px, light; the unit (USDC) beside it, smaller and muted |
| `Ring` | Two-part progress ring in SVG (`brand-dark` arc on `surface` track) with its share in the centre and a legend beside it |

Radii: `rounded-xl` for controls and tiles, `rounded-2xl` for cards and dialogs, `rounded-full`
for state badges only.

## Layout and patterns

- **Bento screens** (pool, admin, overview): a 6-column grid of solid cards with one
  `.card-highlight` piece carrying the headline figure; secondary cards hold actions and lists.
- Page container `mx-auto max-w-5xl px-4 py-10`; single column on mobile, `lg:grid-cols-5`
  (2 + 3) where a form sits next to the trade it creates.
- **Header**: the app title as text on the left (the Avocate logo is used only on the landing
  page, never inside the app); language switcher and wallet button on the right; role
  navigation underneath as pills (active pill `bg-brand-dark text-white`).
- **Role intro**: every role page opens with the role's name as the page title and one
  sentence on what it can do, as plain text (no box, so it never competes with the highlight).
- **Transaction dialog**: every on-chain action opens a modal listing each step as it
  happens (build, simulate, sign, submit, confirmed), with a link to the explorer at the
  end. Nothing on-chain happens silently.
- **History**: the actions taken in this browser, newest first, each linked to its
  transaction.
- Money is shown in USDC with 2 decimals in the UI; amounts in base units (7 decimals) never
  appear on screen.

## Landing page

English only, at `/`; the app starts at `/overview`. Left-aligned hero with live numbers
read from the contracts, then problem and answer, the five steps of a trade, the anti-fraud
rules and a FAQ (also published as FAQPage structured data). The product name is set in
text everywhere, landing included, as in the app header: no logo image. A dark strip at the very top states the beta: testnet only, no real
money.

"Built on" shows the Stellar, USDC and OpenZeppelin logos exactly as published by their
owners (never recoloured), each with a one-line caption, plus the HackMeridian 2026 Lisbon
logo. The footer carries the trademark and non-affiliation notices their brand policies ask
for. An animated isometric figure of the trade flow is planned for a later pass.

## Language

The app opens in English and can switch to Spanish or Portuguese. Copy is short, concrete
and in the user's terms (price, advance, delivery), never in contract terms (`bps`, `i128`).

## Accessibility

- Text contrast at least 4.5:1 (see table above).
- Every interactive element reachable by keyboard, with a visible focus ring.
- Layouts checked at 320, 375, 414 and 768 px wide, with no horizontal scroll.
- State is never conveyed by colour alone: badges carry the state name.
