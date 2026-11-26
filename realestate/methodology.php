<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Analysis, Countries, Inputs, Registry, Scoring, View, Fmt};

$page_title = 'Methodology, model registry & limitations';
$page_desc = 'How every number in a Shelter and Sense report is calculated: formulas, models, assumptions, validation, scoring curves and limitations.';
$canonical = abs_url('methodology.php');
track('methodology_view');
require __DIR__ . '/views/header.php';
$statusB = static fn($s) => View::badge($s, ['operational' => 'pos', 'user-data' => 'info', 'planned' => ''][$s] ?? '');
?>
<section><div class="wrap">
  <p class="eyebrow">Methodology</p>
  <h1>How the numbers are made</h1>
  <p class="lead">Every calculation is deterministic code with published formulas and an automated test suite. Nothing marked "planned" is ever shown as a result.</p>

  <h2>Model registry</h2>
  <div class="tablewrap"><table><thead><tr><th>Model</th><th>Version</th><th>Status</th><th>Purpose</th><th>Assumptions</th><th>Limitations</th><th>Training data</th><th>Validation</th></tr></thead><tbody>
  <?php foreach (Registry::models() as $m): ?><tr><th scope="row"><?= e($m[0]) ?></th><td class="mono"><?= e($m[1]) ?></td><td><?= $statusB($m[2]) ?></td><td><?= e($m[3]) ?></td><td><?= e($m[4]) ?></td><td><?= e($m[5]) ?></td><td><?= e($m[6]) ?></td><td><?= e($m[7]) ?></td></tr><?php endforeach; ?>
  </tbody></table></div>
  <p class="hint">Status: operational = used in every report; user-data = runs only when you supply the data; planned = not implemented.</p>

  <div class="grid g2" style="margin-top:28px;align-items:start">
    <div>
      <h2>Core formulas</h2>
      <dl class="kv small">
        <dt>Gross rent (yr t)</dt><dd>monthly rent × 12 × (1 + rent growth)^(t−1)</dd>
        <dt>NOI</dt><dd>rent × (1 − vacancy) + other income − management − fixed costs × (1 + cost growth)^(t−1)</dd>
        <dt>Cash flow</dt><dd>NOI − debt service − capex reserve</dd>
        <dt>Gross yield</dt><dd>year-1 gross rent ÷ price</dd>
        <dt>Net yield</dt><dd>year-1 NOI ÷ (price + acquisition costs + renovation)</dd>
        <dt>Cap rate</dt><dd>year-1 NOI ÷ price</dd>
        <dt>Cash-on-cash</dt><dd>year-1 cash flow ÷ equity invested</dd>
        <dt>DSCR</dt><dd>year-1 NOI ÷ year-1 debt service</dd>
        <dt>Break-even occupancy</dt><dd>(fixed costs + debt service − other income) ÷ (gross rent × (1 − management − capex))</dd>
        <dt>Exit</dt><dd>price × (1 + price change)^H − selling costs − loan balance</dd>
        <dt>IRR</dt><dd>rate r solving Σ CFₜ/(1+r)ᵗ = 0, CF₀ = −equity</dd>
        <dt>Real IRR</dt><dd>(1 + IRR) ÷ (1 + inflation) − 1</dd>
        <dt>VaR / CVaR 95%</dt><dd>−P5 of simulated total profit / −mean of profits ≤ P5</dd>
      </dl>
      <h2 style="margin-top:20px">Scenario definitions</h2>
      <ul class="small"><?php foreach (Analysis::scenarioDefs() as [$l, $d]): ?><li><strong><?= e($l) ?></strong>: <?= $d ? e(json_encode($d)) : 'your inputs' ?></li><?php endforeach; ?></ul>
      <p class="hint">rent_m and opex_mult are multipliers; other values are additive (decimal points).</p>
    </div>
    <div>
      <h2>Scoring curves</h2>
      <p class="small">Each metric maps to 0–100 by linear interpolation between these anchor points (metric value → score):</p>
      <?= View::table(['Metric', 'Anchors'], array_map(static fn($k, $pts) => [$k, implode('  ·  ', array_map(static fn($p) => (in_array($k, ['dscr'], true) ? $p[0] . '×' : Fmt::pct($p[0], 0)) . '→' . $p[1], $pts))], array_keys(Scoring::CURVES), Scoring::CURVES)) ?>
      <h3 style="margin-top:14px">Objective weights</h3>
      <?= View::table(['Objective', 'Income', 'Return', 'Resilience', 'Value'], array_map(static fn($k, $w) => [Inputs::OBJECTIVES[$k] ?? $k, Fmt::pct($w['income'], 0), Fmt::pct($w['return'], 0), Fmt::pct($w['resilience'], 0), Fmt::pct($w['value'], 0)], array_keys(Scoring::WEIGHTS), Scoring::WEIGHTS)) ?>
      <h3 style="margin-top:14px">Hard constraints (caps)</h3>
      <ul class="small"><li>DSCR &lt; 1.0× → max 40</li><li>Negative base IRR → max 30</li><li>Equity above your budget → max 35</li><li>Income objective with negative cash flow → max 45</li><li>Conservative tolerance with P(loss) &gt; 20% → max 45</li></ul>
      <p class="small">Bands: ≥70 strong fit · 50–69 moderate · 35–49 weak · &lt;35 poor. Market conditions and data reliability are rated separately and never blended into the fit.</p>
    </div>
  </div>

  <h2 style="margin-top:28px">Data provenance & integrity</h2>
  <div class="grid g2">
    <div class="card small"><p>Every input in a report is labelled as <?= View::prov('user') ?>, <?= View::prov('default') ?>, <?= View::prov('derived') ?> or <?= View::prov('missing') ?>. Comparables are labelled as completed transactions, asking prices, signed leases or advertised rents, each with the source you recorded.</p>
    <p>Defaults are generic placeholders documented next to each field (for example 5% vacancy, 1% of value maintenance). They are not local statistics.</p></div>
    <div class="card small"><p><strong>What we never do:</strong> invent comparables, rents, transaction records or market statistics; show a model result we have not implemented; let sponsored listings or affiliate relationships change a calculation or score; present simulated outcomes as historical performance.</p></div>
  </div>
  <h2 style="margin-top:28px">Country coverage</h2>
  <p>See the <a href="<?= e(url('markets.php')) ?>">coverage matrix</a> for operational, partial and unavailable capabilities across <?= count(Countries::LIST) - 1 ?> listed countries.</p>
  <div class="callout"><p>Shelter and Sense provides analytical decision support only. It is not regulated financial, investment, tax, legal or valuation advice and does not guarantee any outcome.</p></div>
</div></section>
<?php require __DIR__ . '/views/footer.php';
