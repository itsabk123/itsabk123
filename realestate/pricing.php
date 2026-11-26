<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Auth, Settings};

$page_title = 'Pricing';
$page_desc = 'Free calculators and evaluations. Pro, Professional and Enterprise plans for higher limits, branded reports, lead tools and API access.';
$canonical = abs_url('pricing.php');
track('pricing_view');
$E = Auth::ENTITLEMENTS;
$plans = [
    ['free', 'Free', 'For trying it out and occasional evaluations', 'Free', ['All ' . count(\SS\Tools::all()) . ' calculators', 'Full evaluation reports', $E['free']['reports'] . ' saved reports', 'Monte Carlo up to ' . number_format($E['free']['sims']) . ' runs', 'Share & embed with attribution', 'Portfolio & watchlist']],
    ['pro', 'Pro', 'For active investors', 'Launch price to be tested', [number_format($E['pro']['reports']) . ' saved reports', 'Monte Carlo up to ' . number_format($E['pro']['sims']) . ' runs', $E['pro']['docs'] . ' private documents', 'Everything in Free']],
    ['professional', 'Professional', 'For agents, brokers & creators', 'Launch price to be tested', ['Branded client reports', 'Lead inbox & listing analytics', 'Unbranded embeds', number_format($E['professional']['reports']) . ' saved reports', 'Everything in Pro']],
    ['enterprise', 'Enterprise', 'For teams, portals & institutions', 'Contact us', ['JSON API access', 'Bulk analysis', 'White-label tools', 'Custom data integrations (licensed)', 'Dedicated support']],
];
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap">
  <p class="eyebrow">Pricing</p>
  <h1>Start free. Upgrade when the work is real.</h1>
  <p class="lead">Every calculator and full evaluations are free without registration. Paid plans raise limits and add professional tools — they never change how a property is analysed or scored.</p>
  <?php if (!Settings::on('payments_enabled')): ?><div class="callout"><p><strong>Staging build:</strong> online payment is not enabled and paid prices are not yet set. Paid plans can be assigned by an administrator for testing.</p></div><?php endif; ?>
  <div class="grid g4" style="margin-top:18px">
    <?php foreach ($plans as [$k, $name, $who, $price, $feat]): ?>
    <div class="card">
      <h2><?= e($name) ?></h2><p class="muted small"><?= e($who) ?></p>
      <p class="price"><?= e($price) ?></p>
      <ul class="plan-feat"><?php foreach ($feat as $f): ?><li><?= e($f) ?></li><?php endforeach; ?></ul>
      <?php if ($k === 'free'): ?><a class="btn btn-ghost" href="<?= e(url(Auth::user() ? 'evaluate.php' : 'register.php')) ?>"><?= Auth::user() ? 'Evaluate a property' : 'Create free account' ?></a>
      <?php else: ?><a class="btn btn-ghost" href="mailto:<?= e(cfg('NOTIFY_EMAIL') ?: 'hello@shelterandsense.com') ?>?subject=<?= rawurlencode($name . ' plan') ?>">Register interest</a><?php endif; ?>
    </div>
    <?php endforeach; ?>
  </div>
  <div class="grid g2" style="margin-top:28px">
    <div><h2>Pay-per-report</h2><p class="muted">Planned: one-off purchase of a full professional PDF report without a subscription. Not available in this build.</p></div>
    <div><h2>Our independence</h2><p class="muted">Sponsored listings, advertising and affiliate partners are labelled and can never alter calculations, scores, rankings in reports, or methodology.</p></div>
  </div>
</div></section>
<?php require __DIR__ . '/views/footer.php';
