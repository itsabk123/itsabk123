# 03 · Product requirements (PRD), journeys & information architecture

## Goal
Maximise **successful, repeatable commercial collaborations** — not registrations.

## Users (one account, many roles)
A `User` owns any number of `Profile`s of type **BRAND, PODCAST, GUEST, INFLUENCER, AGENCY**. Brand/agency profiles belong to an `Organization` with role-based members (OWNER, ADMIN, MANAGER, MEMBER, VIEWER). Creators can grant an agency management rights (consent by the profile owner only). Users switch the "acting as" profile from the dashboard.

## Activation definitions (tracked as `AnalyticsEvent`)
| Type | Activated when |
|---|---|
| Brand | Publishes a campaign **or** sends an invitation/package request |
| Podcast host | Publishes a profile and sends or receives a proposal |
| Guest | Publishes a profile and sends a pitch / application |
| Influencer | Publishes a profile and applies / receives a proposal |

## MVP scope (built) and acceptance criteria
| Capability | Acceptance criterion (tested where marked ✱) |
|---|---|
| Auth: sign-up, login, email verify, reset, sessions, rate limits | Unauthenticated `/app` → 307 to login ✱; verification link from outbox verifies ✱ |
| Multi-role profiles, progressive onboarding, completeness checklist | A user can hold influencer + guest profiles ✱; publishing requires headline/bio, emirate, languages |
| Public profiles with metric sources | Every figure shows Verified / Self-reported / Advertiser-reported / Estimate |
| Discovery (podcasts, influencers, guests, brands, agencies, sponsorship inventory, campaigns) with combinable filters & sorts | Signed-in users see match scores ✱ |
| Explainable matching with configurable weights | Unit tests for scoring, missing data, weights, exclusion ✱ |
| Campaign wizard (6 steps, autosave, compliance step) | Regulated → PENDING_REVIEW; prohibited → rejected ✱(unit) |
| Deals: invitation / application / pitch / package request; counter-offers; history | Counter then accept → AGREED ✱ |
| Generated agreement, hash-bound e-acceptance by both parties | Both sign → CONTRACTED ✱ |
| Payment via provider; only verified webhook marks paid | Forged webhook → 400 ✱; payment → FUNDED, payout HELD, invoice ✱ |
| Inventory limits | Atomic reservation on signing; sold-out cancels deal |
| Deliverables submit/approve/revise (bounded rounds) | Approve → COMPLETED, payout ELIGIBLE ✱ |
| Cancellation & refunds; disputes pause payouts | Dispute → payout ON_HOLD; admin resolves release/split/refund |
| Double-blind reviews, only after completion | Publish when both in, or after N days ✱ |
| Bookings: availability → slots (tz aware), confirm, reschedule, cancel, .ics, reminders | Slot generation unit-tested ✱ |
| Messaging (deal & direct), unread counts, spam holding, block, report | |
| CRM stages auto-updated by deal events | COMPLETED stage after completion ✱ |
| Tracked links with UTM + coupon codes; reported results with source; CPL/CPA | One click per visitor/hour ✱ |
| Notifications (in-app + email outbox) with preferences; saved-search alerts | |
| Admin: overview, liquidity, users, verification, moderation, finance, config, content, audit | Non-admin blocked ✱; payout paid only when eligible ✱ |
| SEO: SSR, sitemap (no thin/demo pages), robots, canonical, JSON-LD, OG | |
| Arabic RTL toggle (chrome + hero), logical CSS properties | |
| Mobile-first | No horizontal overflow at 375px ✱ |

## Core journeys
1. **Brand → creator**: discover → profile (match panel) → request package / propose → negotiate → sign → pay → approve → review → rebook.
2. **Creator → campaign**: opportunities (ranked by fit) → apply with proposal → … → payout.
3. **Guest → host**: podcasts booking guests → pitch (free or sponsored) → host accepts → booking → appearance → review.
4. **Host → brand**: discover brands / sponsorship proposal draft → propose sponsorship.
5. **Agency**: org with brand profiles + represented talent; managers act for both sides; consolidated finance view.

## Information architecture
Public: `/`, `/how-it-works`, `/for/{brands,podcast-hosts,guests,influencers,agencies}`, `/discover/{podcasts,influencers,guests,brands,agencies,sponsorships}`, `/campaigns`, `/campaigns/[slug]`, `/p/[slug]`, `/pricing`, `/success-stories`, `/resources`, `/blog`, `/blog/[slug]`, `/about`, `/contact`, `/faq`, `/signup`, `/login`, `/legal/{terms,privacy,cookies,guidelines,disputes}`.
App: `/app` (feed), `/app/onboarding`, `/app/profiles`, `/app/campaigns`, `/app/opportunities`, `/app/deals`, `/app/messages`, `/app/bookings`, `/app/crm`, `/app/saved`, `/app/analytics`, `/app/finance`, `/app/assistant`, `/app/team`, `/app/notifications`, `/app/settings`.
Admin: `/admin`, `/admin/{liquidity,users,verification,moderation,finance,config,content,audit}`.

## Deliberately not in MVP
Social API sync (needs per-platform app review — only "self-reported" until then), WhatsApp (needs approved BSP + consent), self-serve subscription billing, lead-gen product, white-label PDF reports, full Arabic translation of all app screens.
