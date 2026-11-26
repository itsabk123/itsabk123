# 05 — Growth, SEO/AEO/GEO, referrals, analytics

## 1. Growth strategy (organic-first)

Distribution is built into the product; paid acquisition is optional, not the engine.

| Loop | Mechanism in v3 | Metric |
|---|---|---|
| Investor | Free tool → full evaluation → share (unlisted/public, OG tags, embed preview) → new visitors | Reports shared per activated user |
| Agent | Listing backed by a report → investors discover → consented leads → more agents list | Leads per listing; listing-to-enquiry rate |
| Seller | Investor-ready report → publish → enquiries | Enquiries per listing |
| Creator | Embeds/links with `ref` → visitors use tools → sign-ups → attribution dashboard | Activated referred users |
| Data | Verified comps & outcomes (future) → better-calibrated models | Comp count, valuation error |

The data loop is **not** assumed to work automatically: user-entered comps are labelled by evidence
type and source; dedupe and verification (admin) are prerequisites before they ever train a model.

Progressive conversion (no deceptive withholding): tools give full results → CTA to full evaluation
(pre-filled) → guest report works fully → account only needed to keep/share/track.

## 2. SEO / AEO / GEO

Implemented:
- 16 indexable calculator pages with unique title, meta description, canonical, `WebApplication`,
  `FAQPage` and `BreadcrumbList` JSON-LD, formula explanation, FAQs, related-tool links.
- `Article` JSON-LD on guides; `FAQPage` + `WebApplication` on home; `ItemList` on tools hub.
- `sitemap.php` lists only pages with standalone value (tools, guides, public reports, approved listings).
- **Thin-content guard:** country pages are `noindex` and excluded from the sitemap until a verified
  dataset backs them. Programmatic city/neighbourhood pages are intentionally not generated.
- Staging is globally `noindex` (`SS_NOINDEX`) to avoid indexing test content; flip for production.

AEO/GEO (answer & generative engines): pages state definitions and formulas in plain sentences near
the top (quotable), methodology is public and versioned, every claim about limits is explicit — the
properties that make content citable by AI answer engines. Next: add `Dataset` schema once licensed
data exists; publish original, sourced market analyses; build author/expert pages for E-E-A-T.

Search-intent map (first wave): "rental yield calculator", "cap rate calculator", "IRR calculator real
estate", "buy vs rent calculator", "mortgage calculator [country]", "rental yield in [city]" (only
after data), "how to value an investment property".

## 3. Referral & affiliate specification

| Rule | Implementation |
|---|---|
| Code | 8-char unique `ref_code` per user |
| Capture | `?ref=CODE` on any page → first-party cookie 30 days; **first referral wins** |
| Click counting | One per (code, keyed IP hash, day) in `referral_clicks` |
| Self-referral | Ignored (owner's own session) |
| Attribution | `users.referred_by` at sign-up; events carry `ref_code` (evaluations, embed views) |
| Activation | Referred user completes ≥ 1 evaluation |
| Fraud | Daily spike detection (>200 clicks/code/day) in cron + admin; super admin can void attribution |
| Payouts | **Off.** Require partner agreement (rate, window, threshold, tax forms) and payment provider |
| Disclosure | Partners must disclose; site labels sponsored/affiliate content |

## 4. Analytics event specification (first-party, `events` table)

Each row: `name, user_id?, session_hash (salted), ref_code?, props JSON, created_at`. No raw IPs, no
third-party trackers.

| Event | When | Props |
|---|---|---|
| page_home, tools_index, markets_index, market_view, methodology_view, pricing_view, gallery_view, marketplace_view, article_view | Page views of key pages | c, a |
| tool_view / tool_compute | Calculator opened with example / with user values | t |
| evaluate_view, evaluate_edit_view | Evaluation form shown | — |
| **evaluation_completed** (activation) | Report computed | country, type, ms, guest |
| report_updated | New version | v |
| report_visibility | Sharing changed | to |
| report_view_shared | Non-owner view | r |
| signup, login | Account events | role, referred, mfa |
| portfolio_add, watch_add, listing_created, listing_view, enquiry_sent | Marketplace/portfolio actions | listing, manual |
| embed_view | Widget rendered | kind, t |
| lab_run | Market Lab analysis | mode |
| api_tool, api_evaluate | API usage | t |
| dashboard_view | Dashboard tab | tab |

Funnel in admin: tool_view → tool_compute → evaluate_view → evaluation_completed → signup →
report_visibility → enquiry_sent. Baseline targets are set only after real traffic is observed.

## 5. CRO test backlog
1. CTA copy on tools ("Run a full evaluation with these numbers" vs "See the risks").
2. Sign-up prompt placement on the report (top banner vs after Monte Carlo section).
3. Pre-filled example values vs empty tool forms (activation rate).
4. Example report on home above vs below the fold.
5. Pricing presentation once prices exist (monthly vs annual default).
