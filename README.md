# RealtyCompass

A 3-step real estate investment idea generator. A visitor answers a few
questions about budget, goals, and risk tolerance, leaves their contact
details, and gets back two or three matched investment categories
(residential, commercial, rental, for-sale/flip, or other) with a stated
reason for each match.

The matching is a deterministic, weighted rules engine (`includes/scoring.php`)
— not a machine-learning model — so it needs no external service and runs on
ordinary shared PHP hosting.

## Requirements

- PHP 8.x
- MySQL 5.7+ or MariaDB
- No Node.js, Composer, or SSH access required

## Deploying to shared hosting

1. **Upload the files.** Copy every file in this project to your host's web
   root (commonly `public_html`) via FTP or the cPanel File Manager.
2. **Create a database.** In cPanel (or your host's equivalent), create a
   MySQL database and a database user with full privileges on it.
3. **Import the schema.** Open phpMyAdmin for that database and import
   `sql/schema.sql`. This creates the `leads` and `submissions` tables.
4. **Configure credentials.** Copy `config.sample.php` to `config.php` and
   fill in your database host/name/user/password and the email address that
   should receive new-lead notifications.
   ```
   cp config.sample.php config.php
   ```
   `config.php` is git-ignored — never commit real credentials.
5. **Set permissions.** Standard PHP file permissions (644 for files, 755
   for directories) are sufficient; no writable directories are needed.
6. **Visit `index.php`.** Walk through the 3-step form once yourself to
   confirm the database insert and the notification email both arrive.

## How it works

```
Step 1 (index.php)        Step 2 (step2.php)         Step 3 (results.php)
Preferences form    →     Contact details       →    Personalized results
                           │
                           ├─→ MySQL: leads + submissions
                           ├─→ Admin email notification
                           └─→ Scoring engine → top 2-3 matches + reasons
```

Answers from step 1 are held in the PHP session; step 2 validates and
persists the lead, fires the admin notification, and runs the scoring
engine; step 3 reads the computed results back out of the session.

## Tuning the matching logic

All scoring rules and weights live in one place: `includes/rc_rules()` in
`includes/scoring.php`. Each entry maps a question/answer pair to point
deltas per category. `includes/rc_reasons()` holds the matching
human-readable explanation shown on the results page. Adjust either without
touching the rest of the app.

## File structure

```
index.php              Step 1 — landing + preferences form
step2.php              Step 2 — contact capture
results.php            Step 3 — scoring + results
includes/
  db.php                 PDO connection
  scoring.php            rules engine
  mailer.php             admin notification email
  validate.php           sanitization, CSRF, spam checks
  header.php / footer.php  shared page chrome
assets/
  style.css
  script.js
sql/
  schema.sql
config.sample.php       copy to config.php and fill in
```

## Shelter and Sense v3 (staging)

The v3 platform lives in [`realestate/`](realestate/README.md) and deploys to `/githubtest2/realestate/`.
