<?php
declare(strict_types=1);

// Loads the pure calculation engine (no database, no session) — used by the
// web app, the JSON API, cron and the test suite alike.
foreach (['Stats', 'Finance', 'Countries', 'Inputs', 'Models', 'Scoring', 'Assistant', 'Analysis', 'Tools', 'Registry'] as $f) {
    require_once __DIR__ . '/' . $f . '.php';
}
