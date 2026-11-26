<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Countries, Db, View};

$c = strtoupper((string) ($_GET['c'] ?? ''));
$caps = Countries::capabilities();
$statusBadge = static fn($s) => View::badge(ucfirst($s), ['operational' => 'pos', 'partial' => 'warn', 'unavailable' => 'neg'][$s] ?? '');

if ($c && isset(Countries::LIST[$c])) {
    [$name, $ccy, $unit, $region, $sources] = Countries::LIST[$c];
    $nReports = (int) Db::val("SELECT COUNT(*) FROM reports WHERE country = ? AND visibility = 'public'", [$c]);
    $nListings = (int) Db::val("SELECT COUNT(*) FROM listings WHERE country = ? AND status = 'approved'", [$c]);
    $page_title = 'Property investment in ' . $name . ' — data coverage';
    $page_desc = 'What Shelter and Sense can and cannot analyse for ' . $name . ' today, and the official data sources identified for integration.';
    $canonical = abs_url('markets.php', ['c' => $c]);
    // Thin-content guard: country pages stay noindex until a verified market dataset backs them.
    $noindex = true;
    track('market_view', ['c' => $c]);
    require __DIR__ . '/views/header.php';
    ?>
    <section><div class="wrap narrow">
      <nav class="small muted" aria-label="Breadcrumb"><a href="<?= e(url('markets.php')) ?>">Markets</a> › <?= e($name) ?></nav>
      <h1><?= e($name) ?></h1>
      <p class="lead">Currency <?= e($ccy) ?> · default area unit <?= $unit === 'sqft' ? 'ft²' : 'm²' ?> · <?= e($region) ?></p>
      <div class="callout"><p><strong>No market statistics shown.</strong> We have not yet integrated a verified, licensed price, rent or vacancy dataset for <?= e($name) ?>, so this page does not display market figures. You can still run complete evaluations with your own inputs and comparables.</p></div>
      <h2>Capabilities</h2>
      <?= '<div class="tablewrap"><table><thead><tr><th>Capability</th><th>Status</th><th>Note</th></tr></thead><tbody>' . implode('', array_map(static fn($r) => '<tr><th scope="row">' . e($r[0]) . '</th><td>' . $statusBadge($r[1]) . '</td><td>' . e($r[2]) . '</td></tr>', $caps)) . '</tbody></table></div>' ?>
      <h2 style="margin-top:20px">Candidate official sources (not yet integrated)</h2>
      <?php if ($sources): ?><ul><?php foreach ($sources as $s): ?><li><?= e($s) ?></li><?php endforeach; ?></ul><?php else: ?><p class="muted">None identified yet.</p><?php endif; ?>
      <p class="hint">Licence terms, update frequency, granularity and API availability must be verified before ingestion. Listing here is not a claim about any source's accuracy.</p>
      <h2>On the platform</h2>
      <p><?= $nReports ?> public report(s) · <?= $nListings ?> approved listing(s). <a href="<?= e(url('marketplace.php', ['country' => $c])) ?>">Browse listings</a> · <a href="<?= e(url('evaluate.php', ['country' => $c, 'currency' => $ccy, 'area_unit' => $unit])) ?>">Evaluate a property in <?= e($name) ?></a></p>
    </div></section>
    <?php
    require __DIR__ . '/views/footer.php';
    exit;
}

$page_title = 'Explore markets — global coverage matrix';
$page_desc = 'Country-by-country coverage: which analytical capabilities are operational, partial or unavailable, and which official data sources are candidates for integration.';
$canonical = abs_url('markets.php');
track('markets_index');
require __DIR__ . '/views/header.php';
$regions = [];
foreach (Countries::LIST as $iso => $row) {
    $regions[$row[3]][$iso] = $row;
}
?>
<section><div class="wrap">
  <p class="eyebrow">Explore markets</p>
  <h1>Global coverage, stated honestly</h1>
  <p class="lead">The financial engine works in any country and currency. Market data does not yet: we would rather show "unavailable" than an invented statistic. This matrix is the same for every listed country in this build.</p>
  <h2>Capability matrix</h2>
  <?= '<div class="tablewrap"><table><thead><tr><th>Capability</th><th>Status (all countries)</th><th>Note</th></tr></thead><tbody>' . implode('', array_map(static fn($r) => '<tr><th scope="row">' . e($r[0]) . '</th><td>' . $statusBadge($r[1]) . '</td><td>' . e($r[2]) . '</td></tr>', $caps)) . '</tbody></table></div>' ?>
  <h2 style="margin-top:24px">Countries</h2>
  <div class="grid g3">
    <?php foreach ($regions as $region => $list): ?>
    <div class="card"><h3><?= e($region) ?></h3><ul class="list-plain small"><?php foreach ($list as $iso => $row): ?><li><a href="<?= e(url('markets.php', ['c' => $iso])) ?>"><?= e($row[0]) ?></a> <span class="muted"><?= e($row[1]) ?> · <?= count($row[4]) ?> candidate source<?= count($row[4]) === 1 ? '' : 's' ?></span></li><?php endforeach; ?></ul></div>
    <?php endforeach; ?>
  </div>
  <h2 style="margin-top:24px">Global data source register</h2>
  <?= View::table(['Source', 'Data', 'Granularity', 'Licence (to verify)', 'Status'], Countries::GLOBAL_SOURCES) ?>
  <p class="hint">Have a series from a source you trust? Analyse it now in the <a href="<?= e(url('lab.php')) ?>">Market Lab</a>.</p>
</div></section>
<?php require __DIR__ . '/views/footer.php';
