# 06 · Security, privacy & compliance

## Implemented controls
- **Auth:** bcrypt (cost 12); 10+ char passwords with letters+digits; DB sessions with SHA-256 hashed tokens in httpOnly, SameSite=Lax, Secure cookies; 30-day expiry; sign-out-everywhere; password reset invalidates all sessions; constant-time login path for unknown emails.
- **Rate limiting** (Postgres buckets): login per IP & per email, sign-up, resets, contact form, messages, new conversations, reports, AI drafts.
- **Authorization:** every action re-checks access server-side (`canActFor`, deal party checks, platform roles). Tenant isolation tested end-to-end.
- **CSRF:** Server Actions' origin checking + SameSite cookies. **XSS:** React escaping; Markdown renderer emits no raw HTML; JSON-LD from server data only; CSP header. **SQLi:** Prisma parameterisation (one raw query is static).
- **Headers:** CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- **Uploads:** magic-byte type sniffing (PDF/PNG/JPG/WEBP), 5 MB cap, random keys, stored outside `/public`, 5-minute HMAC-signed URLs, served with `nosniff` + `no-store`. Hook point for malware scanning.
- **Payments:** only signature-verified, idempotent provider events mark payments paid; Stripe signatures checked with 5-min tolerance; forged webhook test. Payouts can be marked paid only when the deal is COMPLETED with no open dispute. No card data touches our servers.
- **Audit log** for logins, profile/campaign changes, contracts, payments, refunds, payouts, moderation, config.
- **Spam/fraud:** heuristic flags for engagement outliers, duplicate bios, spammy messages (held, not delivered) → human review only.

## Privacy (UAE PDPL-oriented — confirm with counsel)
Data minimisation (nationality optional and never used in matching); consent for marketing; notification preferences; self-serve **data export** and **account deletion** (anonymises profile + identity, retains financial records); private/members-only profile visibility; indexing opt-out; business contact shown only by choice and only to signed-in users.

## Compliance workflow
- Advertiser permit fields + display, document verification, expiry reminders; regulated campaign categories → PENDING_REVIEW with checklist; prohibited categories (default tobacco, gambling) rejected; audit trail of decisions.
- Contracts and legal pages are **drafts** clearly labelled for review by UAE counsel; platform never presents generated agreements as legal advice and never calls held funds "escrow".

## Before launch (must do)
UAE counsel review of terms, privacy, agreement template, collection-agent payment model and VAT treatment; confirm merchant-of-record and any licensing for holding funds; penetration test; set strong `APP_SECRET`, `CRON_SECRET`; turn off sandbox payments; configure TRN.
