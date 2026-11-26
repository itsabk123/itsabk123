# 06 — UI/UX design system

Source of truth: `assets/app.css` (tokens at `:root`), components rendered by `lib/View.php` and
`lib/Charts.php`.

## Principles
Institutional research terminal × simple consumer fintech. Calm, high-contrast, generous whitespace,
numbers first, explanations one click away. Mobile-first; every page verified at 375 px with no
horizontal scroll.

## Tokens
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #f7f4ee warm off-white | #121614 | Page |
| `--surface` | #ffffff | #1a1f1c | Cards |
| `--brand` | #1f3a2e deep forest | #8fc2a4 | Primary actions, headings accents |
| `--accent` | #b5895a | #d4ac7f | Eyebrows, brand "and" |
| `--pos / --neg / --warn / --info / --na` | green / red / amber / blue / grey | lighter variants | Financial meaning |

Dark mode follows the OS, and embeds can force `data-theme="light|dark"`.

**Colour is never the only signal:** stats show ▲/▼ glyphs, risk levels use ● ▲ ■ ○ shapes + words,
provenance badges carry text, charts have `aria-label`, `<title>` tooltips and a data table nearby.

## Type
System sans for UI and numbers (tabular figures); serif (Iowan/Palatino/Georgia) for H1 and verdicts
to signal "research". No web-font download (performance, privacy).

## Components
Buttons (primary, ghost, sm, link, danger; min 44 px touch target) · Stat card (label, value, note,
tone) · Badge (pos/neg/warn/info) · Provenance badge · Risk level · Callout (warn/info) · Flash ·
Card / card-link · Tabs · Tables in horizontally scrollable wrappers · Collapsible fieldsets (`details`)
· Sticky form bar · Pager · Heat-map table · FAQ accordion.

## Charts (inline SVG, no JS)
Bars (sign-coloured), histogram with P5/P50/P95 + target, tornado, lines with interval band, waterfall,
radar, stacked cost bar. All read CSS variables so they adapt to dark mode and print.

## Navigation
Home · Evaluate Property · Explore Markets · Investment Tools · Marketplace · Insights · Pricing ·
Log in / Sign up. Collapses to a Menu button below 1120 px.

## Print / PDF
Print stylesheet removes chrome, TOC and controls; sections avoid page breaks — "Download PDF /
print" uses the browser's Save-as-PDF.
