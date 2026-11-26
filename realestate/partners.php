<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Auth, Tools};

$page_title = 'Creators, affiliates & referral partners';
$page_desc = 'Embed free investment calculators, publish analysis and track referrals transparently.';
$canonical = abs_url('partners.php');
$u = Auth::user();
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap">
  <p class="eyebrow">Partners</p>
  <h1>Give your audience better tools</h1>
  <p class="lead">Real estate creators, educators, newsletter writers and agents can embed our calculators, share public reports and track every visitor they send — with transparent, fraud-resistant attribution.</p>
  <div class="grid g3" style="margin-top:18px">
    <div class="card"><h3>1. Get your link</h3><p class="small muted">Every account has a referral code. Add <span class="mono">?ref=CODE</span> to any page, calculator or report link.</p></div>
    <div class="card"><h3>2. Embed tools</h3><p class="small muted"><?= count(Tools::all()) ?> calculators as one-line embeds, each carrying your code. Public reports can be embedded as live previews.</p></div>
    <div class="card"><h3>3. Track results</h3><p class="small muted">See unique clicks, embed views, evaluations, sign-ups, activated users and paid upgrades in your dashboard.</p></div>
  </div>
  <div class="grid g2" style="margin-top:24px;align-items:start">
    <div class="card"><h2>Attribution rules</h2><ul class="small">
      <li>First-party cookie, 30 days, first referral wins.</li>
      <li>One click counted per visitor per day (keyed hash, no raw IPs stored).</li>
      <li>Self-referrals are ignored.</li>
      <li>Activation = the referred user completes an evaluation.</li>
      <li>Admins can review suspicious patterns and reverse fraudulent attribution.</li>
    </ul></div>
    <div class="card"><h2>Commissions & disclosure</h2><p class="small">Commission rates and payouts are <strong>not active</strong> in this staging build. They will be set in a written partner agreement (rates, attribution window, payout threshold, tax forms) before any earnings accrue.</p>
      <p class="small">Partners must clearly disclose referral relationships to their audience in line with local advertising rules. Shelter and Sense labels affiliate and sponsored content on its own pages.</p></div>
  </div>
  <p style="margin-top:20px"><?= $u ? '<a class="btn" href="' . e(url('dashboard.php', ['tab' => 'referrals'])) . '">Open your referral dashboard</a>' : '<a class="btn" href="' . e(url('register.php', ['role' => 'creator'])) . '">Join as a creator</a>' ?> <a class="btn btn-ghost" href="<?= e(url('developers.php')) ?>">Embed codes & API</a></p>
</div></section>
<?php require __DIR__ . '/views/footer.php';
