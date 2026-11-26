<?php
// Copy to config.php and edit. config.php is git-ignored — never commit real credentials.
// With no config.php the app runs on SQLite in data/ (fine for staging).

// --- Database -------------------------------------------------------------
// define('SS_DB_DRIVER', 'mysql');           // 'sqlite' (default) or 'mysql'
// define('SS_DB_HOST', 'localhost');
// define('SS_DB_NAME', 'your_db');
// define('SS_DB_USER', 'your_user');
// define('SS_DB_PASS', 'your_password');
// define('SS_DB_PATH', __DIR__ . '/data/shelterandsense.sqlite');

// --- Site -------------------------------------------------------------------
// define('SS_SITE_URL', 'https://rundemlabs.com/githubtest2/realestate'); // used for canonical/share links
define('SS_APP_SECRET', 'replace-with-64-random-hex-characters');          // keys IP hashes; change once, keep stable
// define('SS_ENVIRONMENT', 'staging');      // 'production' hides the staging banner
// define('SS_NOINDEX', true);               // keep staging out of search engines
// define('SS_NOTIFY_EMAIL', 'you@example.com');
// define('SS_MAIL_FROM', 'no-reply@example.com');

// --- One-time admin setup via install.php -----------------------------------
// define('SS_SETUP_KEY', 'a-long-random-string');  // remove after creating the first admin
