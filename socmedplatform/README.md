# Majlis — UAE creator, podcast & brand collaboration marketplace

A working multi-sided marketplace where **brands, podcast hosts, podcast guests, influencers and agencies** discover each other, agree terms, sign, pay, deliver, measure and review — with UAE specifics built in (seven emirates, AED/VAT, Asia/Dubai time, Arabic RTL, UAE Media Council advertiser-permit workflow).

"Majlis" is a working name — change it with `NEXT_PUBLIC_SITE_NAME`.

**Stack:** Next.js 15 (App Router, server actions) · React 19 · TypeScript · Tailwind · PostgreSQL + Prisma · Vitest + Playwright.

## Quick start

**Running it on a machine that already runs other things? Follow [LOCAL_SETUP.md](LOCAL_SETUP.md).** It uses isolated ports (app 3107, database 55432) and its own Docker container.

```bash
cp .env.example .env
npm run db:up                 # isolated Postgres container on 127.0.0.1:55432
npm install
npm run setup                 # migrations + super-admin + labelled demo profiles
npm run dev                   # http://localhost:3107
```
- Admin: `admin@example.com` / `change-me-admin-123` (local only — set `ADMIN_EMAIL`/`ADMIN_PASSWORD`)
- Demo users: `demo.brand1@demo.test`, `demo.inf1@demo.test`, `demo.hostfin@demo.test`, `demo.guest2@demo.test`… password `demo-password-123`
- Payments default to a **sandbox** provider (no real money); set `PAYMENT_PROVIDER=stripe` for live.

## Tests
```bash
npm test                       # 26 unit tests
npm run build && npm start     # then, with ALLOW_SANDBOX_PAYMENTS=1 in .env:
npm run test:e2e               # 21-step end-to-end business flow
```

## What's inside
Discovery with explainable match scores · campaign wizard with compliance review · unified deal pipeline (invite / apply / pitch / package request) with counter-offers · generated agreements with e-acceptance · provider-verified payments, held payouts, refunds, disputes · deliverable approval · bookings with timezone-aware slots and .ics · messaging, CRM, saved searches & alerts · tracked links & sourced metrics · double-blind reviews · teams, agencies & consent-based talent management · admin console (KPIs, marketplace health, verification, moderation, finance, pricing config, CMS, audit).

See [`docs/`](docs/README.md) for research, business model, PRD, architecture, security, testing, deployment and launch plan.

## Honest limitations
Legal pages and the agreement template are drafts for UAE counsel review · social-platform API verification isn't connected (metrics are labelled self-reported) · subscriptions are activated manually · file storage driver is local-disk (swap for S3/R2 before multi-instance) · Arabic covers navigation and marketing copy, not every app screen.
