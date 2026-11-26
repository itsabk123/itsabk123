<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Auth, Charts, Tools, View};

$tools = Tools::all();
$slug = (string) ($_GET['t'] ?? '');

function tool_form(string $slug, array $tool, array $vals, string $action, array $hidden = []): string
{
    $h = '<form method="get" action="' . e($action) . '" class="card"><input type="hidden" name="t" value="' . e($slug) . '">';
    foreach ($hidden as $k => $hv) {
        $h .= '<input type="hidden" name="' . e($k) . '" value="' . e($hv) . '">';
    }
    $h .= '<div class="fgrid">';
    foreach ($tool['fields'] as $f) {
        [$k, $label, $type, $def] = $f;
        $hint = $f[4] ?? '';
        $id = 'tf_' . $k;
        $val = $vals[$k];
        if ($type === 'textarea') {
            $h .= '</div><div class="field"><label for="' . $id . '">' . e($label) . '</label><textarea id="' . $id . '" name="' . e($k) . '" rows="6">' . e($val) . '</textarea></div><div class="fgrid">';
            continue;
        }
        $unit = $type === 'percent' ? '<span class="unit">%</span>' : '';
        $h .= '<div class="field"><label for="' . $id . '">' . e($label) . '</label><div class="inwrap' . ($unit ? ' has-unit' : '') . '"><input id="' . $id . '" type="text" inputmode="decimal" name="' . e($k) . '" value="' . e($val ?? '') . '">' . $unit . '</div>' . ($hint ? '<p class="hint">' . e($hint) . '</p>' : '') . '</div>';
    }
    return $h . '</div><button class="btn" type="submit">Calculate</button></form>';
}

function tool_results(array $out): string
{
    $h = '<div class="stats">';
    foreach ($out['results'] as [$l, $val, $note]) {
        $h .= View::stat($l, (string) $val, (string) $note);
    }
    $h .= '</div>';
    if (!empty($out['mc'])) {
        $h .= '<div class="card" style="margin-top:12px">' . Charts::histogram($out['mc']['hist'], $out['mc']['irr_q'], 0.08, 'Simulated IRR distribution') . '</div>';
    }
    if (!empty($out['table'])) {
        $h .= '<div style="margin-top:12px">' . View::table($out['table']['head'], $out['table']['rows']) . '</div>';
    }
    return $h;
}

if ($slug === '' || !isset($tools[$slug])) {
    if ($slug !== '') {
        http_response_code(404);
    }
    $page_title = 'Free real estate investment calculators';
    $page_desc = 'Free rental yield, ROI, mortgage, cash flow, cap rate, IRR/NPV, buy-vs-rent, affordability, risk and valuation calculators. No sign-up.';
    $canonical = abs_url('tools.php');
    $jsonld = [['@context' => 'https://schema.org', '@type' => 'ItemList', 'itemListElement' => array_values(array_map(static fn($s, $i) => ['@type' => 'ListItem', 'position' => $i + 1, 'url' => abs_url('tools.php', ['t' => $s]), 'name' => $tools[$s]['title']], array_keys($tools), array_keys(array_keys($tools))))]];
    track('tools_index');
    require __DIR__ . '/views/header.php';
    ?>
    <section><div class="wrap">
      <p class="eyebrow">Investment tools</p>
      <h1>Free real estate calculators</h1>
      <p class="lead">Every calculator gives a full result immediately, without registration, and uses the same tested engine as our full reports. Pre-filled numbers are examples — replace them with yours.</p>
      <div class="grid g3" style="margin-top:20px">
        <?php foreach ($tools as $s => $t): ?>
        <a class="card card-link" href="<?= e(url('tools.php', ['t' => $s])) ?>"><h3><?= e($t['title']) ?></h3><p class="muted small"><?= e($t['summary']) ?></p></a>
        <?php endforeach; ?>
      </div>
      <div class="callout callout-info" style="margin-top:24px"><p>Want these on your website? Every calculator can be embedded with one line of code. <a href="<?= e(url('developers.php')) ?>">Get embed codes</a>.</p></div>
    </div></section>
    <?php
    require __DIR__ . '/views/footer.php';
    exit;
}

$tool = $tools[$slug];
$touched = count(array_intersect_key($_GET, array_flip(array_column($tool['fields'], 0)))) > 0;
$vals = Tools::values($tool, $_GET);
$out = Tools::compute($slug, $vals);
track($touched ? 'tool_compute' : 'tool_view', ['t' => $slug]);

$prefill = array_filter([
    'asking_price' => $vals['price'] ?? null, 'monthly_rent' => $vals['rent'] ?? null,
    'interest_rate_pct' => $vals['rate'] ?? null, 'down_payment_pct' => $vals['down'] ?? null,
], static fn($x) => $x !== null && !is_array($x));

$page_title = $tool['title'];
$page_desc = $tool['summary'] . ' Free, instant, no sign-up — with the formula shown.';
$canonical = abs_url('tools.php', ['t' => $slug]);
$jsonld = [
    ['@context' => 'https://schema.org', '@type' => 'WebApplication', 'name' => $tool['title'], 'url' => $canonical, 'applicationCategory' => 'FinanceApplication', 'operatingSystem' => 'Web', 'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'USD']],
    ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => [['@type' => 'ListItem', 'position' => 1, 'name' => 'Tools', 'item' => abs_url('tools.php')], ['@type' => 'ListItem', 'position' => 2, 'name' => $tool['title'], 'item' => $canonical]]],
    ['@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => array_map(static fn($q) => ['@type' => 'Question', 'name' => $q[0], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $q[1]]], $tool['faq'])],
];
$ref = Auth::user()['ref_code'] ?? '';
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap">
  <nav class="small muted" aria-label="Breadcrumb"><a href="<?= e(url('tools.php')) ?>">Tools</a> › <?= e($tool['title']) ?></nav>
  <h1><?= e($tool['title']) ?></h1>
  <p class="lead"><?= e($tool['summary']) ?></p>
  <div class="grid g2" style="align-items:start">
    <div><?= tool_form($slug, $tool, $vals, url('tools.php')) ?></div>
    <div class="tool-out" aria-live="polite">
      <?php if (!$touched): ?><p class="small"><?= View::badge('Example values', 'warn') ?> Replace them with your numbers and press Calculate.</p><?php endif; ?>
      <?= tool_results($out) ?>
      <div class="card">
        <h3>Go deeper</h3>
        <p class="small muted">A full evaluation adds fair-value evidence, 10+ year cash flows, Monte Carlo risk, scenarios and a due-diligence checklist.</p>
        <a class="btn btn-sm" href="<?= e(url('evaluate.php', $prefill)) ?>">Run a full evaluation<?= $prefill ? ' with these numbers' : '' ?></a>
        <?php if (!Auth::user()): ?><p class="hint" style="margin-top:8px"><a href="<?= e(url('register.php')) ?>">Create a free account</a> to save results and get alerts.</p><?php endif; ?>
      </div>
    </div>
  </div>
  <div class="grid g2" style="margin-top:28px; align-items:start">
    <div>
      <h2>How it is calculated</h2>
      <p><?= e($tool['formula']) ?></p>
      <h2>Questions</h2>
      <div class="faq"><?php foreach ($tool['faq'] as [$q, $a]): ?><details open><summary><?= e($q) ?></summary><p><?= e($a) ?></p></details><?php endforeach; ?></div>
      <p class="hint">Results are estimates for information only, not financial advice.</p>
    </div>
    <div>
      <h2>Related tools</h2>
      <ul class="list-plain"><?php foreach ($tool['related'] as $r): if (!isset($tools[$r])) continue; ?><li><a href="<?= e(url('tools.php', ['t' => $r])) ?>"><?= e($tools[$r]['title']) ?></a></li><?php endforeach; ?></ul>
      <h2 style="margin-top:20px">Embed this calculator</h2>
      <label for="emb1">iframe</label>
      <textarea id="emb1" class="embedcode" readonly><iframe src="<?= e(abs_url('embed.php', ['t' => $slug, 'ref' => $ref ?: null])) ?>" width="100%" height="560" style="border:0" loading="lazy" title="<?= e($tool['title']) ?>"></iframe></textarea>
      <button class="btn btn-sm btn-ghost" type="button" data-copy="#emb1">Copy</button>
      <label for="emb2" style="margin-top:10px">JavaScript (auto-resizing)</label>
      <textarea id="emb2" class="embedcode" readonly><div data-ss-widget="<?= e($slug) ?>"<?= $ref ? ' data-ref="' . e($ref) . '"' : '' ?>></div>
<script async src="<?= e(abs_url('assets/embed.js')) ?>"></script></textarea>
      <button class="btn btn-sm btn-ghost" type="button" data-copy="#emb2">Copy</button>
      <?php if (!$ref): ?><p class="hint"><a href="<?= e(url('register.php', ['role' => 'creator'])) ?>">Sign up</a> to get embed codes with your referral attribution.</p><?php endif; ?>
    </div>
  </div>
</div></section>
<?php require __DIR__ . '/views/footer.php';
