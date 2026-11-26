# Shelter and Sense v3 — documentation index

This folder holds the written deliverables requested in the master product prompt. Where a
deliverable is *implemented in code*, the document points to the code as the source of truth.

**Honesty notes that apply to every document**

- No live web research was possible from the build environment (outbound access to
  shelterandsense.com, rundemlabs.com and competitor sites was blocked by the network policy).
  Competitor and data-source facts come from general knowledge and are marked **"verify"**.
- No market data, testimonials, customer numbers or growth figures were invented. Where data is
  missing the product says "unavailable", and so do these documents.

| # | Deliverable | Where |
|---|---|---|
| 1 | Product requirements document | [02-product.md](02-product.md) §1 |
| 2 | Competitor research report | [01-research.md](01-research.md) §3 |
| 3 | Top 20 module assessment | [01-research.md](01-research.md) §4 |
| 4 | Feature prioritisation matrix | [01-research.md](01-research.md) §5 |
| 5 | User journey maps | [02-product.md](02-product.md) §3 |
| 6 | Role & permission matrix | [02-product.md](02-product.md) §4 (code: `lib/App.php` `Auth::PERMS`) |
| 7 | Information architecture | [02-product.md](02-product.md) §5 |
| 8 | Database schema | [03-architecture.md](03-architecture.md) §4 (code: `lib/Db.php`) |
| 9 | Entity relationship diagram | [03-architecture.md](03-architecture.md) §4 |
| 10 | Technical architecture diagram | [03-architecture.md](03-architecture.md) §2 |
| 11 | API specification | [03-architecture.md](03-architecture.md) §5 (live: `developers.php`) |
| 12 | Financial calculation specification | [04-models-data.md](04-models-data.md) §1 (live: `methodology.php`) |
| 13 | Scientific model specification | [04-models-data.md](04-models-data.md) §2 (code: `lib/Registry.php`) |
| 14 | Data source & licensing register | [04-models-data.md](04-models-data.md) §3 |
| 15 | Country coverage matrix | [04-models-data.md](04-models-data.md) §4 (live: `markets.php`) |
| 16 | Monetisation strategy | [02-product.md](02-product.md) §6 |
| 17 | Pricing architecture | [02-product.md](02-product.md) §7 |
| 18 | Growth marketing strategy | [05-growth.md](05-growth.md) §1 |
| 19 | SEO / AEO / GEO strategy | [05-growth.md](05-growth.md) §2 |
| 20 | Referral & affiliate specification | [05-growth.md](05-growth.md) §3 |
| 21 | UI/UX design system | [06-design-system.md](06-design-system.md) |
| 22 | Responsive page designs | Implemented; screenshots verified at 1280 px and 375 px — [07-qa.md](07-qa.md) §4 |
| 23 | Admin & super-admin dashboard | `admin.php`; described in [02-product.md](02-product.md) §8 |
| 24 | Analytics event specification | [05-growth.md](05-growth.md) §4 |
| 25 | Security & privacy specification | [03-architecture.md](03-architecture.md) §6 |
| 26 | QA/QC test plan & report | [07-qa.md](07-qa.md) |
| 27 | Deployment plan | [03-architecture.md](03-architecture.md) §7 and `/realestate/README.md` |
| 28 | Production monitoring plan | [03-architecture.md](03-architecture.md) §8 |
| 29 | Implementation roadmap | [08-roadmap.md](08-roadmap.md) |
| 30 | Post-launch optimisation strategy | [08-roadmap.md](08-roadmap.md) §3 |
