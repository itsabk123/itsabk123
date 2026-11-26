# 04 · Technical architecture, data model & API

## Decisions
| Area | Choice | Why |
|---|---|---|
| Shape | **Modular monolith** (Next.js App Router) | One deployable, shared types, cheap; modules split by folder (`lib/*`) and can be extracted later |
| UI | React 19 server components, Tailwind, no client framework beyond 3 tiny client components | Fast, SEO-friendly, works without JS (forms are plain `<form action>`) |
| Mutations | Server Actions (built-in origin check = CSRF protection) | Less API surface; typed |
| DB | PostgreSQL + Prisma, migrations in `prisma/migrations` | Relational integrity, arrays for tags, JSON where flexible |
| Search | Postgres filters (ILIKE / array `has`) + in-process explainable ranking over a ≤400 prefiltered set | Adequate for hundreds–low thousands of profiles. Add `pg_trgm`/tsvector, then Meilisearch/Typesense when p95 search > 300 ms |
| Payments | Provider adapter (`lib/payments`): sandbox + Stripe Checkout | Swap providers without touching deal logic |
| Files | Private storage adapter with HMAC-signed, 5-min URLs; magic-byte sniffing; 5 MB cap | Swap local disk → S3/R2 |
| AI | Optional Claude API (`claude-opus-5-5`, low effort, server-side fallbacks) with deterministic templates when unset | Drafts only; never auto-publishes; never invents numbers |
| Jobs | Idempotent `runJobs()` behind `POST /api/jobs` (Bearer `CRON_SECRET`) | Works with Vercel Cron or any scheduler |
| Rate limits | Postgres fixed-window buckets | Works across serverless instances; move to Redis at scale |

## Module map
`lib/auth` sessions & roles · `lib/access` tenant isolation (owner / org manager / representing agency) · `lib/matching` pure scoring · `lib/match-data` DB→candidate · `lib/discovery` filters/sorts · `lib/deals` + `deal-machine` + `deal-roles` lifecycle · `lib/fees` · `lib/contract` · `lib/payments/*` · `lib/compliance` · `lib/fraud` · `lib/liquidity` · `lib/time` slots/timezones · `lib/notify` in-app + email outbox · `lib/jobs` · `lib/storage` · `lib/ai` · `lib/config` admin-editable settings.

## Data model (see `prisma/schema.prisma` for keys, uniques and indexes)
Identity: User, Session, AuthToken, RateLimitBucket · Orgs: Organization, OrganizationMember · Profiles: Profile (+ BrandDetails, PodcastDetails, GuestDetails, InfluencerDetails, AgencyDetails), SocialAccount, MetricRecord, AudienceSlice, Offering, AvailabilityRule · Campaigns: Campaign, CampaignDeliverable · Collaboration: Deal, Proposal, DealEvent, Deliverable, Contract, Booking · Comms: Conversation, ConversationParticipant, Message, Block, CrmContact, Notification, NotificationPreference, EmailOutbox · Discovery: SavedProfile, SavedSearch, MatchFeedback · Money: Payment, WebhookEvent, Payout, Invoice, Refund, Plan, Subscription, Promotion, Referral · Measurement: TrackingLink, ClickEvent, CampaignMetric, AnalyticsEvent · Trust: Review, Dispute, VerificationDocument, ComplianceRecord, Report, FraudFlag, AuditLog · CMS/config: Post, ContactMessage, PlatformConfig, TaxonomyTerm.

**Mapping to the requested entity list:** CampaignApplications / CollaborationInvitations / Proposals / Negotiations are unified as `Deal` (with `origin`) + versioned `Proposal`s — one pipeline, one state machine. Ratings live on `Review.rating`. Commissions are fields on `Payment`; Transactions = `Payment` + `Refund` + `Payout`. Permissions are role enums checked in `lib/auth` / `lib/access`.

Money is integer **fils**. Times are UTC; display defaults to Asia/Dubai.

## Deal state machine
PROPOSED → NEGOTIATING ↔ … → AGREED → CONTRACTED → (FUNDED if paid) → IN_PROGRESS → DELIVERED → COMPLETED; side exits DECLINED, CANCELLED, DISPUTED. Enforced by `assertTransition` + optimistic `where: { status }` on update.

## Permission matrix (summary)
| Action | Who |
|---|---|
| Edit profile / act in deals | Owner; org OWNER/ADMIN/MANAGER; manager of representing agency |
| Read-only in deals | org MEMBER/VIEWER |
| Accept proposal | The party that did **not** author the active proposal |
| Pay | Payer of the agreed proposal, verified email |
| Submit deliverable | Payee side · Approve: payer (or brand/podcast on unpaid deals) |
| Grant agency management | Profile owner only |
| Verify/suspend/moderate | MODERATOR+ · Payouts: FINANCE+ · Config/plans: ADMIN+ · Platform roles: SUPERADMIN |

## HTTP endpoints (everything else is server actions)
| Route | Purpose |
|---|---|
| `POST /api/webhooks/payments/[provider]` | Signature-verified, idempotent payment events |
| `GET /api/files?key&exp&sig` | Signed private file access |
| `GET /api/bookings/[id]/ics` | Calendar export (participants only) |
| `GET /r/[slug]` | Tracked redirect (deduped clicks, bots ignored) |
| `POST/GET /api/jobs` | Scheduled jobs (Bearer CRON_SECRET) |
| `GET /api/account/export` | Personal data export |
| `GET /api/health` | DB health |
| `/sitemap.xml`, `/robots.txt` | SEO |

## Scaling path
Hundreds of users: single region (UAE/EU), one Postgres. → Thousands: connection pooling (PgBouncer/Prisma Accelerate), Redis for rate limits/cache, search index, S3/R2 + CDN images, queue (e.g. pg-boss) for jobs/emails. → Tens of thousands: read replicas, extract payments/notifications modules.
