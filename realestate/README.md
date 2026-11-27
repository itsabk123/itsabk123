# Shelter and Sense — v3 staging

Global real estate investment intelligence platform: property evaluation with transparent
cash-flow/DCF analysis, comparable & hedonic valuation, Bayesian rent checks, Monte Carlo risk,
scenarios, explainable scoring, free embeddable calculators, a moderated marketplace with consented
leads, referrals, portfolio tracking, an admin control centre and a JSON API.

Target URL: `https://rundemlabs.com/githubtest2/realestate/` (works at any sub-path).
Documentation for all 30 deliverables: [`docs/README.md`](docs/README.md).

## Requirements
- PHP 8.1+ with `pdo_sqlite` (default) or `pdo_mysql`, `mbstring`, `fileinfo`
- Apache with `.htaccess` (recommended) — no Composer, Node or build step

## Run locally with Docker Desktop
From the `realestate/` folder:
```
docker compose up -d --build
docker exec shelterandsense php cron.php create-admin you@example.com 'a-strong-password'
```
Open http://localhost:8090 (change `8090` in `docker-compose.yml` if that port is taken).
The database and uploads live in the `shelterandsense-data` volume, so they survive rebuilds.
After pulling new code, run `docker compose up -d --build` again. Run the scheduled jobs with
`docker exec shelterandsense php cron.php`.

Without Docker (PHP 8.1+ installed): `php -S localhost:8090` from inside `realestate/`, then open
http://localhost:8090. PHP's built-in server ignores `.htaccess`, so use it for local testing only.

## Deploy to shared hosting
1. Put this `realestate/` folder at `public_html/githubtest2/realestate/` (FTP, cPanel File
   Manager, or cPanel Git™ Version Control pulling branch `claude/focused-ptolemy-fbvt58`).
2. Make `realestate/data/` writable by PHP (755/775 depending on host). The SQLite database and
   uploads live there and are blocked from the web by `data/.htaccess`.
3. Optional: `cp config.sample.php config.php` and set `SS_APP_SECRET` (random, keep stable),
   `SS_SITE_URL`, `SS_NOTIFY_EMAIL`, or switch to MySQL.
4. Create the first super admin — either over SSH:
   `php cron.php create-admin you@example.com 'a-strong-password'`
   or without SSH: set `SS_SETUP_KEY` in `config.php`, open `install.php`, then remove the key.
5. cPanel → Cron Jobs, hourly: `php /home/USER/public_html/githubtest2/realestate/cron.php`
6. Smoke test: `…/realestate/api.php?r=v1/health` → `{"status":"ok",…}`; then
   `…/realestate/data/` and `…/realestate/config.php` must return **403**.

Staging is `noindex` and shows a staging banner. For production set `SS_ENVIRONMENT=production`
and `SS_NOINDEX=false` **after** the release gates in `docs/07-qa.md` pass.

## Tests
```
php tests/run.php    # 123 engine tests (independent benchmarks)
php tests/http.php   # 129 end-to-end journey tests on a throwaway DB
```

## Layout
```
index.php evaluate.php report.php tools.php embed.php lab.php markets.php marketplace.php
listing-edit.php reports.php insights.php methodology.php pricing.php partners.php developers.php
dashboard.php account.php admin.php login.php register.php forgot.php reset.php logout.php
api.php sitemap.php download.php install.php cron.php privacy.php terms.php
lib/      engine (Stats, Finance, Inputs, Models, Analysis, Scoring, Assistant, Tools, Registry,
          Countries) + platform (Db, App, View, Charts, Content)
views/    header & footer      assets/  css, js, embed loader, icon
data/     SQLite + uploads (web-denied)      tests/  test suites      docs/  deliverables
```

## Not in this build (by design or blocked)
Payments/payouts, licensed market data feeds, ML AVM, OCR, server-side PDF, QR codes, multilingual
UI, LLM assistant. See `docs/08-roadmap.md`. The product shows "unavailable"/"not assessed" rather
than inventing any of these.
