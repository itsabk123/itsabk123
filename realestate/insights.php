<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Db, Md, View};

$disc = ['editorial' => ['Editorial', ''], 'sponsored' => ['Sponsored', 'warn'], 'affiliate' => ['Contains affiliate links', 'warn']];
$slug = (string) ($_GET['a'] ?? '');
if ($slug !== '') {
    $a = Db::one("SELECT * FROM articles WHERE slug = ? AND status = 'published'", [$slug]);
    if (!$a) {
        render_error(404, 'Article not found.');
    }
    $page_title = $a['title'];
    $page_desc = $a['summary'];
    $canonical = abs_url('insights.php', ['a' => $slug]);
    $og = ['title' => $a['title'], 'description' => $a['summary'], 'type' => 'article'];
    $jsonld = [['@context' => 'https://schema.org', '@type' => 'Article', 'headline' => $a['title'], 'description' => $a['summary'], 'datePublished' => str_replace(' ', 'T', $a['published_at']) . 'Z', 'dateModified' => str_replace(' ', 'T', $a['updated_at']) . 'Z', 'publisher' => ['@type' => 'Organization', 'name' => 'Shelter and Sense'], 'mainEntityOfPage' => $canonical]];
    track('article_view', ['a' => $slug]);
    require __DIR__ . '/views/header.php';
    ?>
    <section><div class="wrap article">
      <nav class="small muted" aria-label="Breadcrumb"><a href="<?= e(url('insights.php')) ?>">Insights</a> › Guide</nav>
      <h1><?= e($a['title']) ?></h1>
      <p class="rep-meta"><?= View::badge($disc[$a['disclosure']][0] ?? 'Editorial', $disc[$a['disclosure']][1] ?? '') ?> <span>Updated <?= e(substr($a['updated_at'], 0, 10)) ?></span></p>
      <p class="lead"><?= e($a['summary']) ?></p>
      <?= Md::render($a['body']) ?>
      <div class="callout callout-info"><p>Put it into practice: <a href="<?= e(url('evaluate.php')) ?>">evaluate a property</a> or try the <a href="<?= e(url('tools.php')) ?>">free calculators</a>.</p></div>
    </div></section>
    <?php
    require __DIR__ . '/views/footer.php';
    exit;
}
$rows = Db::all("SELECT slug, title, summary, disclosure, updated_at FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 100");
$page_title = 'Insights — guides for property investors';
$page_desc = 'Plain-language guides on yields, returns, risk, comparables and due diligence.';
$canonical = abs_url('insights.php');
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap">
  <p class="eyebrow">Insights</p>
  <h1>Guides for property investors</h1>
  <p class="lead">Explanations of the methods behind the numbers. Editorial content is labelled separately from sponsored content and affiliate links.</p>
  <div class="grid g2">
    <?php foreach ($rows as $a): ?>
    <a class="card card-link" href="<?= e(url('insights.php', ['a' => $a['slug']])) ?>"><?= $a['disclosure'] !== 'editorial' ? View::badge($disc[$a['disclosure']][0], 'warn') : '' ?><h3><?= e($a['title']) ?></h3><p class="muted small"><?= e($a['summary']) ?></p></a>
    <?php endforeach; ?>
  </div>
</div></section>
<?php require __DIR__ . '/views/footer.php';
