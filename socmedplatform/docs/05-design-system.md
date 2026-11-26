# 05 · Design system

Minimal, editorial-meets-enterprise. Defined in `tailwind.config.ts` (tokens) and `src/app/globals.css` (component classes).

**Colour tokens:** `ink` #0F1B2D (midnight navy — text, primary buttons) · `paper` #FAF8F4 (warm off-white background) · `charcoal` #2B2F36 · `muted` #6B6F76 · `line` #E6E1D8 · `gold` #A8844E (eyebrows, accents only) · `accent` #2F55D4 (restrained blue: verified, links of state) · semantic `ok`/`warn`/`bad`.

**Type:** serif display (Iowan/Charter/Georgia → Noto Naskh Arabic) for headings; system sans for UI. Scale: `.h1` 3xl→5xl, `.h2` 2xl→3xl, `.h3` base semibold, `.eyebrow` xs uppercase tracked, `.lead`.

**Components:** `.btn-primary/secondary/ghost/danger/sm` (pill, min 40px tap target) · `.input` (42px min) · `.check` (pill checkbox chips) · `.card`, `.card-pad` · `.badge(-gold|-ok|-warn|-bad|-accent)` · `.table` · `.stat-label/.stat-value`. React: `PageHeader`, `Empty`, `Stat`, `Field`, `Checks`, `Select`, `Flash`, `Tabs`, `SourceTag` (metric provenance), `Avatar`, `ScoreRing`, `ProfileCard`, `CampaignCard`, `ChoiceButton`, `DraftButton`, `Autosave`.

**States:** empty states always give a next action; errors/success via `Flash` (`?err=` / `?ok=`); loading via server rendering; disabled buttons at 50%.

**Layout:** `max-w-page` (72rem) with 16–24px gutters; dashboards use a 248px sidebar ≥1024px, collapsible menu on mobile. Logical properties (`ms-`, `me-`, `end-`) so RTL works.

**Rules:** no neon, no glassmorphism, no decorative animation; paid placement always labelled; demo data always badged.
