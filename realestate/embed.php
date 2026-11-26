<?php
declare(strict_types=1);

/**
 * Embeddable widgets (calculators or a public report preview), framed by third-party sites.
 * Framing is allowed from any origin here only. Attribution is shown unless the
 * referring partner's plan permits unbranded embeds.
 */
define('SS_EMBED', true);
require __DIR__ . '/bootstrap.php';

use SS\{Auth, Charts, Db, Fmt, Tools, View};

header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors *; form-action 'self'; base-uri 'self'; object-src 'none'");

$ref = current_ref() ?? (isset($_GET['ref']) ? strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $_GET['ref'])) : null);
$partner = $ref ? Db::one('SELECT id, plan, brand_name FROM users WHERE ref_code = ?', [$ref]) : null;
$unbranded = $partner && (Auth::ENTITLEMENTS[$partner['plan']]['unbranded_embed'] ?? false) && !empty($_GET['nobrand']);
$theme = in_array($_GET['theme'] ?? '', ['light', 'dark'], true) ? $_GET['theme'] : 'auto';
$attrUrl = abs_url('index.php', ['ref' => $ref]);
$page_title = 'Calculator';
$noindex = true;
?><!doctype html>
<html lang="en"<?= $theme !== 'auto' ? ' data-theme="' . e($theme) . '"' : '' ?>>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Shelter and Sense widget</title><link rel="stylesheet" href="<?= e(url('assets/app.css')) ?>?v=<?= e(SS_VERSION) ?>"></head>
<body class="embed">
<main>
<?php
if (!empty($_GET['report'])) {
    $r = Db::one("SELECT r.*, (SELECT result_json FROM report_versions v WHERE v.report_id = r.id ORDER BY version DESC LIMIT 1) AS rj FROM reports r WHERE token = ? AND visibility IN ('public','unlisted')", [(string) $_GET['report']]);
    if (!$r) {
        echo '<p>This report is not available.</p>';
    } else {
        $res = json_decode($r['rj'], true);
        $b = $res['base'];
        track('embed_view', ['kind' => 'report']);
        echo '<h2 style="font-size:1.1rem">' . e($r['title']) . '</h2><div class="stats">'
            . View::stat('Net yield', Fmt::pct($b['net_yield'])) . View::stat('Cash flow / mo', Fmt::money($b['monthly_cf1'], $r['currency']))
            . View::stat('IRR', Fmt::pct($b['irr'])) . ($res['mc'] ? View::stat('P(loss)', Fmt::pct($res['mc']['p_loss'], 0)) : '') . '</div>';
        if ($res['mc']) {
            echo Charts::histogram($res['mc']['hist'], $res['mc']['irr_q'], null, 'Simulated IRR distribution');
        }
        echo '<p><a class="btn btn-sm" target="_blank" rel="noopener" href="' . e(abs_url('report.php', ['id' => $r['token'], 'ref' => $ref])) . '">Open full report</a></p>';
    }
} else {
    $tools = Tools::all();
    $slug = (string) ($_GET['t'] ?? 'rental-yield-calculator');
    $tool = $tools[$slug] ?? null;
    if (!$tool) {
        echo '<p>Unknown calculator.</p>';
    } else {
        $vals = Tools::values($tool, $_GET);
        $out = Tools::compute($slug, $vals);
        track('embed_view', ['kind' => 'tool', 't' => $slug]);
        echo '<h2 style="font-size:1.1rem">' . e($tool['title']) . '</h2>';
        echo '<form method="get" action="' . e(url('embed.php')) . '"><input type="hidden" name="t" value="' . e($slug) . '">' . ($ref ? '<input type="hidden" name="ref" value="' . e($ref) . '">' : '') . '<div class="fgrid">';
        foreach ($tool['fields'] as $f) {
            [$k, $label, $type] = $f;
            $id = 'e_' . $k;
            if ($type === 'textarea') {
                echo '</div><div class="field"><label for="' . $id . '">' . e($label) . '</label><textarea id="' . $id . '" name="' . e($k) . '">' . e($vals[$k]) . '</textarea></div><div class="fgrid">';
            } else {
                echo '<div class="field"><label for="' . $id . '">' . e($label) . '</label><div class="inwrap' . ($type === 'percent' ? ' has-unit' : '') . '"><input id="' . $id . '" type="text" inputmode="decimal" name="' . e($k) . '" value="' . e($vals[$k] ?? '') . '">' . ($type === 'percent' ? '<span class="unit">%</span>' : '') . '</div></div>';
            }
        }
        echo '</div><button class="btn btn-sm">Calculate</button></form><div class="stats" style="margin-top:12px">';
        foreach ($out['results'] as [$l, $val, $note]) {
            echo View::stat($l, (string) $val, (string) $note);
        }
        echo '</div>';
    }
}
if (!$unbranded) {
    echo '<p class="embed-attr">Powered by <a href="' . e($attrUrl) . '" target="_blank" rel="noopener">Shelter and Sense</a> · Estimates only, not financial advice.</p>';
}
?>
</main>
<script src="<?= e(url('assets/app.js')) ?>?v=<?= e(SS_VERSION) ?>"></script>
</body></html>
