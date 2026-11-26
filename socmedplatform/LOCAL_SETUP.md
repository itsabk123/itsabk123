# Run Majlis locally (without disturbing anything else)

Everything is isolated by default:

| Thing | Majlis uses | Why it won't clash |
|---|---|---|
| App | **http://localhost:3107** | Avoids the usual 3000/3001/5173/8080 |
| Database | Docker container **`majlis-db`** on **127.0.0.1:55432** | Separate container, its own volume `majlis_pgdata`, not the default 5432, only reachable from your machine |
| Data / files | `socmedplatform/storage/` and the Docker volume | Nothing written outside this folder |
| Cookies | Named `mj_session`, `mj_profile`, `mj_locale` | Browsers share localhost cookies across ports; these names are prefixed so they won't overwrite other apps' cookies |

## You need
- **Node.js 20+** (`node -v`)
- **Docker Desktop** (or Docker Engine), *or* an existing Postgres you can create a new database in
- Git

## Steps (macOS / Linux / Windows WSL or Git Bash)

```bash
# 1. Get the code
git clone https://github.com/itsabk123/itsabk123.git majlis
cd majlis
git checkout claude/uae-creator-marketplace-riirey
cd socmedplatform

# 2. Check the ports are free (prints ✓ / ✗ for 3107 and 55432)
node scripts/check-ports.mjs

# 3. Config
cp .env.example .env        # defaults already match the isolated setup

# 4. Start the isolated database (first run downloads postgres:16-alpine)
npm run db:up               # = docker compose up -d --wait

# 5. Install, create tables, load labelled demo data
npm install
npm run setup               # = prisma migrate deploy + seed (admin + demo profiles)

# 6. Run
npm run dev                 # → http://localhost:3107
```

On Windows PowerShell, use `copy .env.example .env` in step 3. Everything else is the same.

## Log in
| Role | Email | Password |
|---|---|---|
| Super-admin | `admin@example.com` | `change-me-admin-123` |
| Brand | `demo.brand1@demo.test` | `demo-password-123` |
| Influencer | `demo.inf1@demo.test` | `demo-password-123` |
| Podcast host | `demo.hostfin@demo.test` | `demo-password-123` |
| Guest | `demo.guest2@demo.test` | `demo-password-123` |

Tip: use a second browser or a private window to be logged in as two parties at once (for example, a brand and a creator negotiating a deal).

- **Payments** use the built-in sandbox: the "Pay" button opens a fake checkout with *Simulate success / decline*. No real money, no keys needed.
- **Emails** aren't sent. They're stored in the database, and you can read them in **Admin → Audit & system → Recent emails**. That's where verification links for new sign-ups appear.

## If a port is already taken
- **App port:** run `npm run dev -- -p 3207`, and set `APP_URL="http://localhost:3207"` in `.env`.
- **Database port:** change `55432` in **both** `docker-compose.yml` and `DATABASE_URL` in `.env`.

## Using your own Postgres instead of Docker
Create a **new, empty** database (don't reuse another app's), then point `.env` at it:
```bash
createdb majlis_local
# .env
DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/majlis_local"
```
Then run steps 5–6. The migrations only touch that database.

## Day-to-day
| Command | What it does |
|---|---|
| `npm run dev` | Start the app (stop it with Ctrl+C) |
| `npm run db:stop` | Stop the database container (data is kept) |
| `npm run db:up` | Start it again |
| `npm run db:reset` | Wipe **this app's** database and reseed demo data |
| `npm test` | Unit tests |
| `npm run build && npm start` then `npm run test:e2e` | Full browser test (needs `ALLOW_SANDBOX_PAYMENTS="1"` in `.env`, because `npm start` runs in production mode) |

## Remove everything
```bash
docker compose down -v      # removes the majlis-db container AND its volume (only this app's data)
```
Then delete the folder.
