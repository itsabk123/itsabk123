# 08 · Deployment & maintenance

## Requirements
Node 20+ (tested on 22), PostgreSQL 14+ (tested 16).

## Local
```bash
cp .env.example .env              # set DATABASE_URL, APP_SECRET
npm install
npx prisma migrate deploy
npm run db:seed:demo              # or db:seed for no demo data
npm run dev                       # http://localhost:3000
```
Admin: `ADMIN_EMAIL`/`ADMIN_PASSWORD` env at seed time (local default admin@example.com / change-me-admin-123). Demo users: `demo.*@demo.test` / `demo-password-123`.

## Recommended low-cost production
- **Hosting:** Vercel (or any Node host / Docker). Set root directory to `socmedplatform/`.
- **Database:** managed Postgres (Neon, Supabase, RDS) close to users; enable automated backups + PITR.
- **Env:** `DATABASE_URL`, `APP_URL`, `APP_SECRET` (32+ random bytes), `CRON_SECRET`, `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, optional `ANTHROPIC_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (first seed only).
- **Build:** `npm run build` (runs `prisma generate`); release step `npm run db:deploy && npm run db:seed` (seed is idempotent and never loads demo data in production).
- **Webhook:** point the provider to `https://<host>/api/webhooks/payments/stripe` (events: `checkout.session.completed`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`).
- **Cron:** call `/api/jobs` every 15–60 min with `Authorization: Bearer $CRON_SECRET` (Vercel Cron: add to `vercel.json`).
- **Storage:** local disk is for single-node only — implement the S3/R2 driver in `lib/storage.ts` before multi-instance deploys.
- **Monitoring:** `/api/health` uptime check; add Sentry (errors) and PostHog/GA4 (consented analytics) when needed.

## Maintenance
- Schema changes: edit `prisma/schema.prisma` → `npx prisma migrate dev --name x` → commit migration.
- Commercial settings, plans, promotions, match weights: Admin → Pricing & config (audit-logged).
- Weekly: review Trust & safety queue, Verification queue, Finance payouts, Marketplace health.
- Monthly: compare match score vs outcomes; re-tune weights; review permit-expiry and doc-expiry counts; restore-test a backup.
- Dependencies: `npm outdated` monthly; patch security advisories promptly.
