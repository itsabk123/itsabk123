<?php
declare(strict_types=1);
define('SS_EMBED', true);
require __DIR__ . '/bootstrap.php';

use SS\{Db, Tools};

// Only pages with genuine standalone value are listed. Country pages stay out until
// a verified dataset backs them (thin-content guard).
header('Content-Type: application/xml; charset=utf-8');
$urls = [[abs_url('index.php'), null], [abs_url('evaluate.php'), null], [abs_url('tools.php'), null], [abs_url('markets.php'), null], [abs_url('lab.php'), null],
    [abs_url('marketplace.php'), null], [abs_url('insights.php'), null], [abs_url('methodology.php'), null], [abs_url('pricing.php'), null], [abs_url('report.php', ['sample' => 1]), null]];
foreach (array_keys(Tools::all()) as $s) {
    $urls[] = [abs_url('tools.php', ['t' => $s]), null];
}
foreach (Db::all("SELECT slug, updated_at FROM articles WHERE status = 'published'") as $a) {
    $urls[] = [abs_url('insights.php', ['a' => $a['slug']]), $a['updated_at']];
}
foreach (Db::all("SELECT token, updated_at FROM reports WHERE visibility = 'public' ORDER BY updated_at DESC LIMIT 5000") as $r) {
    $urls[] = [abs_url('report.php', ['id' => $r['token']]), $r['updated_at']];
}
foreach (Db::all("SELECT id, updated_at FROM listings WHERE status = 'approved' ORDER BY updated_at DESC LIMIT 5000") as $l) {
    $urls[] = [abs_url('marketplace.php', ['id' => $l['id']]), $l['updated_at']];
}
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as [$loc, $mod]) {
    echo '  <url><loc>' . htmlspecialchars($loc, ENT_XML1) . '</loc>' . ($mod ? '<lastmod>' . substr($mod, 0, 10) . '</lastmod>' : '') . "</url>\n";
}
echo '</urlset>';
