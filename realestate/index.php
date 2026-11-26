<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Analysis, Content, Fmt, Inputs, Tools, View, Countries};

[$sv, $sp] = Inputs::normalise(Content::sampleInputs());
$sv['sims'] = 600;
$sample = Analysis::run($sv, $sp);
$sb = $sample['base'];
track('page_home');

$page_title = 'Shelter and Sense';
$canonical = abs_url('index.php');
$faq = [
    ['Is Shelter and Sense a valuation or financial adviser?', 'No. It is an analytical decision-support tool. Reports are indicative and do not replace a regulated valuation, legal due diligence, tax advice or personal financial advice.'],
    ['Where does the market data come from?', 'In this version, from you: the comparables, rents and costs you enter, each labelled with its source. We have not yet integrated licensed transaction or listing feeds, and we never display invented market statistics. The coverage page lists candidate official sources per country.'],
    ['Do I need an account?', 'No. Every calculator and a full evaluation work without signing up. An account lets you save reports, track a portfolio, share reports and get alerts.'],
    ['Which countries are supported?', 'The financial engine works in any currency and country with your inputs. Country-specific taxes, rules and market data are not encoded yet — see the coverage matrix for exactly what is operational.'],
    ['How are the scores calculated?', 'Each dimension uses a published curve, weights depend on your objective, and hard constraints (for example rent not covering the loan) cap the result. Every report shows the full calculation. Data confidence is shown separately and never blended in.'],
];
$jsonld = [
    ['@context' => 'https://schema.org', '@type' => 'WebApplication', 'name' => 'Shelter and Sense', 'url' => abs_url('index.php'), 'applicationCategory' => 'FinanceApplication', 'operatingSystem' => 'Web', 'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'USD']],
    ['@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => array_map(static fn($q) => ['@type' => 'Question', 'name' => $q[0], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $q[1]]], $faq)],
];
require __DIR__ . '/views/header.php';
$tools = Tools::all();
?>
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <p class="eyebrow">Real estate investment intelligence</p>
      <h1>Make smarter property decisions with data, probability and clear assumptions.</h1>
      <p class="lead">Evaluate any property in any currency: fair-value evidence, cash flow, IRR and NPV, thousands of simulated outcomes, and a risk register — with every assumption, source and limitation in plain view.</p>
      <div class="btn-row">
        <a class="btn" href="<?= e(url('evaluate.php')) ?>">Evaluate a property</a>
        <a class="btn btn-ghost" href="<?= e(url('tools.php')) ?>">Explore free tools</a>
      </div>
      <p class="small muted" style="margin-top:12px">No sign-up needed. Not financial advice.</p>
    </div>
    <div class="preview" aria-label="Example evaluation preview">
      <div class="section-head"><strong>Example evaluation</strong><?= View::badge('Hypothetical property', 'warn') ?></div>
      <p class="small muted">2-bed apartment, USD 310,000, 25% deposit at 5.5%, rent USD 1,850/month, 10-year hold.</p>
      <div class="stats">
        <?= View::stat('Net yield', Fmt::pct($sb['net_yield'])) ?>
        <?= View::stat('Cash flow / mo', Fmt::money($sb['monthly_cf1'], 'USD'), 'Year 1', View::tone($sb['monthly_cf1'])) ?>
        <?= View::stat('Base-case IRR', Fmt::pct($sb['irr'])) ?>
        <?= View::stat('P(loss)', Fmt::pct($sample['mc']['p_loss'], 0), $sample['mc']['n'] . ' simulations') ?>
      </div>
      <?= \SS\Charts::histogram($sample['mc']['hist'], $sample['mc']['irr_q'], 0.08, 'Distribution of simulated IRR for the example property') ?>
      <p class="small"><a href="<?= e(url('report.php', ['sample' => 1])) ?>">See the full example report →</a></p>
    </div>
  </div>
</section>

<section class="band-alt">
  <div class="wrap">
    <div class="section-head"><div><h2>Ten questions every report answers</h2><p class="muted">Each with its method, assumptions, confidence and limits.</p></div></div>
    <div class="grid g3">
      <?php foreach ([
          ['Is the asking price reasonable?', 'Comparable-sales and hedonic regression on evidence you supply, reconciled by precision — or an honest "insufficient evidence".'],
          ['What will it really earn?', 'Gross and net yield, year-by-year cash flow, cash-on-cash and DSCR, after every cost line.'],
          ['What could it return?', 'IRR, MIRR, NPV and equity multiple over your holding period, in nominal and real terms.'],
          ['How likely is my target?', 'Monte Carlo simulation of rent, vacancy, costs, price growth and rates — reproducible with a seed.'],
          ['What if things go wrong?', 'Optimistic, base, pessimistic and severe scenarios, tornado sensitivities and VaR/CVaR.'],
          ['What should I check next?', 'Missing inputs, inconsistencies, a tailored due-diligence checklist and questions for the seller.'],
      ] as [$t, $d]): ?>
      <div class="card"><h3><?= e($t) ?></h3><p class="muted small"><?= e($d) ?></p></div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="section-head"><div><h2>Free investment calculators</h2><p class="muted">Instant results, no registration. Each uses the same engine as full reports.</p></div><a class="btn btn-ghost btn-sm" href="<?= e(url('tools.php')) ?>">All <?= count($tools) ?> tools</a></div>
    <div class="grid g4">
      <?php foreach (array_slice($tools, 0, 8, true) as $slug => $t): ?>
      <a class="card card-link" href="<?= e(url('tools.php', ['t' => $slug])) ?>"><h3><?= e($t['title']) ?></h3><p class="muted small"><?= e($t['summary']) ?></p></a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="band-alt">
  <div class="wrap">
    <div class="section-head"><div><h2>Science, not marketing terms</h2><p class="muted">Only models that are implemented, tested and documented are shown as operational.</p></div><a class="btn btn-ghost btn-sm" href="<?= e(url('methodology.php')) ?>">Model registry</a></div>
    <div class="grid g4">
      <?php foreach ([
          ['Discounted cash flow', 'IRR, MIRR, NPV, equity multiple, real returns.'],
          ['Monte Carlo', 'Correlated price & rent paths, convergence checks, VaR/CVaR.'],
          ['Bayesian updating', 'Your rent estimate updated by rental evidence, with credible intervals and prior sensitivity.'],
          ['Hedonic regression', 'Log-linear model on your comparables with leave-one-out error.'],
          ['Comparable analysis', 'Recency, distance, size and evidence-type weights.'],
          ['Time-series forecasting', 'Damped Holt with a mandatory backtest against naive baselines.'],
          ['Econometric regression', 'OLS with robust errors, VIF, Breusch–Pagan and Durbin–Watson.'],
          ['Multi-criteria scoring', 'Objective-specific weights with hard constraint gates.'],
      ] as [$t, $d]): ?>
      <div class="card"><h3><?= e($t) ?></h3><p class="muted small"><?= e($d) ?></p></div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <h2>Built for everyone on both sides of a deal</h2>
    <div class="grid g4">
      <?php foreach ([
          ['Investors', 'Evaluate, compare, simulate and track a portfolio. Share reports with partners.', 'register.php', ['role' => 'investor']],
          ['Sellers', 'Show investors the numbers: an investor-ready report, a listing and qualified enquiries.', 'register.php', ['role' => 'seller']],
          ['Agents & brokers', 'Branded reports, listings, a lead inbox and embeddable calculators for your site.', 'register.php', ['role' => 'agent']],
          ['Creators', 'Embed tools, publish analysis and track referrals from your audience.', 'partners.php', []],
      ] as [$t, $d, $href, $q]): ?>
      <a class="card card-link" href="<?= e(url($href, $q)) ?>"><h3><?= e($t) ?></h3><p class="muted small"><?= e($d) ?></p></a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="band-alt">
  <div class="wrap grid g2">
    <div>
      <h2>Trust by design</h2>
      <ul class="list-plain small">
        <li><strong>Every input labelled</strong> — yours, a platform default, derived, or missing.</li>
        <li><strong>No invented data</strong> — no fake comparables, statistics, testimonials or logos. Where evidence is missing, the report says so.</li>
        <li><strong>Reproducible</strong> — engine and model versions, simulation seed and timestamp on every report.</li>
        <li><strong>Independent scores</strong> — sponsored listings and affiliates never change calculations or scores.</li>
        <li><strong>Private by default</strong> — reports are private until you choose to share them.</li>
      </ul>
    </div>
    <div>
      <h2>Supported today</h2>
      <p class="muted small">Calculations work for <?= count(Countries::LIST) - 1 ?> listed countries (and any other) in their local currency and area unit. Market data feeds are not yet integrated — see exactly what is operational, partial or unavailable.</p>
      <p><a class="btn btn-ghost btn-sm" href="<?= e(url('markets.php')) ?>">View the coverage matrix</a></p>
      <p class="muted small">Property types: <?= e(implode(', ', array_slice(Inputs::PROPERTY_TYPES, 0, 15))) ?>.</p>
    </div>
  </div>
</section>

<section>
  <div class="wrap narrow">
    <h2>Pricing</h2>
    <p class="muted">Calculators and core evaluations are free. Pro, Professional and Enterprise plans add higher limits, branding, lead tools and API access. Online payment is not enabled on this staging build.</p>
    <p><a class="btn btn-ghost" href="<?= e(url('pricing.php')) ?>">Compare plans</a></p>
    <h2 style="margin-top:28px">Frequently asked questions</h2>
    <div class="faq">
      <?php foreach ($faq as [$q, $a]): ?>
      <details><summary><?= e($q) ?></summary><p><?= e($a) ?></p></details>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="band-alt">
  <div class="wrap narrow" style="text-align:center">
    <h2>Have a property in mind?</h2>
    <p class="muted">A full evaluation takes about five minutes with the numbers you have. You can skip anything you don't know — the report will tell you what is missing.</p>
    <a class="btn" href="<?= e(url('evaluate.php')) ?>">Evaluate a property</a>
  </div>
</section>
<?php require __DIR__ . '/views/footer.php';
