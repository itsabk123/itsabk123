<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Countries, Db, Fmt, Inputs, View};

$page = max(1, (int) ($_GET['page'] ?? 1));
$per = 24;
$total = (int) Db::val("SELECT COUNT(*) FROM reports WHERE visibility = 'public'");
$rows = Db::all("SELECT r.token, r.title, r.country, r.property_type, r.currency, r.views, r.updated_at, u.name, u.brand_name, u.role,
    (SELECT result_json FROM report_versions v WHERE v.report_id = r.id ORDER BY version DESC LIMIT 1) AS rj
    FROM reports r LEFT JOIN users u ON u.id = r.user_id WHERE r.visibility = 'public' ORDER BY r.updated_at DESC LIMIT $per OFFSET " . (($page - 1) * $per));
$page_title = 'Public investment reports';
$page_desc = 'Investment analyses that their authors chose to publish — each with full inputs, assumptions and methodology.';
$canonical = abs_url('reports.php');
track('gallery_view');
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap">
  <p class="eyebrow">Report gallery</p>
  <h1>Public investment reports</h1>
  <p class="lead">Published by their authors, who chose the assumptions. Open any report to see every input and its source, then re-run it with your own.</p>
  <?php if (!$rows): ?><div class="card"><p>No public reports yet. Reports are private by default; owners can publish from the report's sharing panel. Meanwhile, see the <a href="<?= e(url('report.php', ['sample' => 1])) ?>">example report</a>.</p></div><?php endif; ?>
  <div class="grid g3">
  <?php foreach ($rows as $r): $res = json_decode((string) $r['rj'], true); $b = $res['base'] ?? []; ?>
    <a class="card card-link" href="<?= e(url('report.php', ['id' => $r['token']])) ?>">
      <h3><?= e($r['title']) ?></h3>
      <p class="small muted"><?= e(Countries::name($r['country'])) ?> · <?= e(Inputs::PROPERTY_TYPES[$r['property_type']] ?? '') ?> · by <?= e($r['brand_name'] ?: $r['name'] ?: 'guest') ?></p>
      <div class="stats" style="grid-template-columns:1fr 1fr"><?= View::stat('Net yield', Fmt::pct($b['net_yield'] ?? null)) ?><?= View::stat('IRR', Fmt::pct($b['irr'] ?? null)) ?></div>
      <p class="hint"><?= (int) $r['views'] ?> views · updated <?= e(substr($r['updated_at'], 0, 10)) ?></p>
    </a>
  <?php endforeach; ?>
  </div>
  <?= View::pager($page, (int) ceil($total / $per), [], 'reports.php') ?>
</div></section>
<?php require __DIR__ . '/views/footer.php';
