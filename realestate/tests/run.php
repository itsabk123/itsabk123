<?php
declare(strict_types=1);

/**
 * Test runner (no Composer needed):  php tests/run.php
 * Benchmarks were computed independently (Python, closed-form or textbook values),
 * not by this code.
 */

use SS\{Finance, Stats, Rng, Proforma, MonteCarlo, Bayes, Valuation, Forecast, Inputs, Analysis, Scoring, Tools};

require __DIR__ . '/../lib/engine.php';

$pass = 0;
$fail = 0;
$failures = [];

function near($a, $b, float $tol = 1e-6): bool
{
    if ($a === null || $b === null) {
        return $a === $b;
    }
    return abs($a - $b) <= $tol * max(1.0, abs($b));
}

function check(string $name, bool $ok, string $detail = ''): void
{
    global $pass, $fail, $failures;
    if ($ok) {
        $pass++;
    } else {
        $fail++;
        $failures[] = $name . ($detail ? " — $detail" : '');
    }
}

// ---------------- Finance ----------------
check('pmt 200k 6% 30y', near(Finance::pmt(0.005, 360, 200000), 1199.1010503055138, 1e-9));
check('pmt zero rate', near(Finance::pmt(0.0, 120, 12000), 100.0));
check('pmt zero principal', Finance::pmt(0.01, 12, 0) === 0.0);
check('balance after 12', near(Finance::balance(0.005, 360, 200000, 12), 197543.9765754465, 1e-9));
check('balance paid off', Finance::balance(0.005, 360, 200000, 360) === 0.0);
check('balance zero rate', near(Finance::balance(0.0, 100, 1000, 25), 750.0));
$am = Finance::amortisationByYear(0.06, 30, 200000);
check('amort y1 balance', near($am[0]['balance'], 197543.9765754465, 1e-7));
check('amort y1 payment', near($am[0]['payment'], 12 * 1199.1010503055138, 1e-9));
check('amort final balance 0', near(end($am)['balance'], 0.0, 1e-6));
check('amort principal sums to loan', near(array_sum(array_column($am, 'principal')), 200000, 1e-7));
$io = Finance::amortisationByYear(0.06, 30, 200000, 5, 6);
check('interest-only year payment', near($io[0]['payment'], 12000.0) && near($io[4]['balance'], 200000.0));
check('post-IO amortises', $io[5]['balance'] < 200000);
check('irr simple', near(Finance::irr([-100, 110]), 0.10, 1e-9));
check('irr textbook', near(Finance::irr([-1000, 300, 400, 500]), 0.08896339469335002, 1e-8));
check('irr undefined (no sign change)', Finance::irr([100, 50]) === null && Finance::irr([-100, -5]) === null);
check('irr negative', near(Finance::irr([-100, 50]), -0.5, 1e-8));
check('irr high-guess fallback', near(Finance::irr([-100, 300]), 2.0, 1e-7));
check('npv', near(Finance::npv(0.1, [-1000, 300, 400, 500]), -21.03681442524436, 1e-9));
check('npv zero at irr', near(Finance::npv(0.1, [-100, 110]), 0.0));
check('mirr', near(Finance::mirr([-1000, 300, 400, 500], 0.1, 0.12), 0.09815669244631553, 1e-9));
check('equity multiple', near(Finance::equityMultiple([-100, 10, 10, 120]), 1.4));
check('real rate fisher', near(Finance::realRate(0.07, 0.03), 1.07 / 1.03 - 1));
check('cagr', near(Finance::cagr(100, 200, 10), 2 ** 0.1 - 1));
check('principal from payment inverse of pmt', near(Finance::principalFromPayment(0.06, 30, 1199.1010503055138), 200000, 1e-8));
check('principal from payment zero rate', near(Finance::principalFromPayment(0.0, 10, 100), 12000));

// ---------------- Stats ----------------
check('normCdf 1.96', near(Stats::normCdf(1.96), 0.9750021048517796, 2e-7));
check('normCdf symmetric', near(Stats::normCdf(-1.0) + Stats::normCdf(1.0), 1.0, 1e-9));
check('normInv', near(Stats::normInv(0.975), 1.959963984540054, 1e-8));
check('t p-value t=2 df=10', near(Stats::tPValue(2.0, 10), 0.07338803477, 1e-6));
check('chi2 p 3.8415 df1', near(Stats::chi2PValue(3.841458820694124, 1), 0.05, 1e-6));
check('quantile type7', near(Stats::quantile([1, 2, 3, 4], 0.5), 2.5) && near(Stats::quantile([1, 2, 3, 4], 0.25), 1.75));
check('sd sample', near(Stats::sd([2, 4, 4, 4, 5, 5, 7, 9]), 2.138089935299395, 1e-9));
$X = [];
$y = [];
for ($i = 0; $i < 20; $i++) {
    $x1 = $i;
    $x2 = ($i * 7) % 5;
    $X[] = [$x1, $x2];
    $y[] = 2 + 3 * $x1 - $x2;
}
$fit = Stats::ols($X, $y);
check('ols exact recovery', near($fit['beta'][0], 2, 1e-8) && near($fit['beta'][1], 3, 1e-8) && near($fit['beta'][2], -1, 1e-8));
check('ols r2 = 1', near($fit['r2'], 1.0, 1e-9));
$inv = Stats::inverse([[4, 7], [2, 6]]);
check('matrix inverse', near($inv[0][0], 0.6) && near($inv[0][1], -0.7) && near($inv[1][0], -0.2) && near($inv[1][1], 0.4));
check('singular matrix', Stats::inverse([[1, 2], [2, 4]]) === null);
check('durbin-watson alternating ~4', Stats::durbinWatson([1, -1, 1, -1, 1, -1]) > 3);
$vif = Stats::vif([[1, 2.1], [2, 3.9], [3, 6.2], [4, 7.8], [5, 10.1]]);
check('vif detects collinearity', $vif[0] > 10);

// RNG reproducibility
$a = new Rng(123);
$b = new Rng(123);
$same = true;
for ($i = 0; $i < 100; $i++) {
    $same = $same && $a->normal() === $b->normal();
}
check('rng seeded reproducible', $same);
$r = new Rng(7);
$z = [];
for ($i = 0; $i < 20000; $i++) {
    $z[] = $r->normal();
}
check('rng normal mean≈0 sd≈1', abs(Stats::mean($z)) < 0.03 && abs(Stats::sd($z) - 1) < 0.03);

// ---------------- Proforma ----------------
$p = ['price' => 100000, 'acq_costs' => 0, 'renovation' => 0, 'loan' => 0, 'rate' => 0, 'term' => 25, 'io' => 0, 'rent_m' => 1000, 'other_m' => 0,
    'vacancy' => 0, 'mgmt' => 0, 'capex' => 0, 'fixed_opex' => 0, 'maint' => 0, 'rent_growth' => 0, 'exp_growth' => 0, 'appreciation' => 0,
    'hold' => 1, 'sell_cost' => 0, 'discount' => 0.12, 'inflation' => 0, 'opex_mult' => 1.0];
$pf = Proforma::run($p);
check('proforma cash 1y irr = 12%', near($pf['irr'], 0.12, 1e-9));
check('proforma gross yield', near($pf['gross_yield'], 0.12));
check('proforma npv at irr = 0', near($pf['npv'], 0.0, 1e-6));
check('proforma coc', near($pf['coc'], 0.12));
check('proforma no debt dscr null', $pf['dscr'] === null);
$p2 = $p;
$p2['vacancy'] = 0.1;
$p2['mgmt'] = 0.1;
$p2['fixed_opex'] = 1000;
$p2['loan'] = 50000;
$p2['rate'] = 0.06;
$p2['term'] = 30;
$p2['hold'] = 5;
$p2['appreciation'] = 0.03;
$p2['sell_cost'] = 0.05;
$pf2 = Proforma::run($p2);
$ds = 12 * Finance::pmt(0.005, 360, 50000);
$noi = 12000 * 0.9 - 12000 * 0.9 * 0.1 - 1000;
check('proforma noi', near($pf2['noi1'], $noi));
check('proforma debt service', near($pf2['ds1'], $ds, 1e-9));
check('proforma cf', near($pf2['cf1'], $noi - $ds));
check('proforma exit', near($pf2['exit_value'], 100000 * 1.03 ** 5) && near($pf2['exit_balance'], Finance::balance(0.005, 360, 50000, 60), 1e-7));
check('proforma equity', near($pf2['equity0'], 50000));
check('proforma break-even occupancy', near($pf2['break_even_occ'], (1000 + $ds) / (12000 * 0.9)));
$manual = array_merge([-50000], array_fill(0, 5, $noi - $ds));
$manual[5] += 100000 * 1.03 ** 5 * 0.95 - Finance::balance(0.005, 360, 50000, 60);
check('proforma irr matches manual flows', near($pf2['irr'], Finance::irr($manual), 1e-9));
$neg = $p2;
$neg['rent_m'] = 200;
check('negative cash flow handled', Proforma::run($neg)['cf1'] < 0);
$zero = $p2;
$zero['rate'] = 0.0;
check('zero-interest loan', near(Proforma::run($zero)['ds1'], 50000 / 30));

// ---------------- Monte Carlo ----------------
$u0 = ['rent_mean' => 1000, 'rent_sd_abs' => 0, 'vac_sd' => 0, 'app_sd' => 0, 'rg_sd' => 0, 'opex_sd' => 0, 'rate_sd' => 0];
$mc0 = MonteCarlo::run($p2, $u0, 500, 1, 0.05);
check('MC degenerate = deterministic', near($mc0['irr_q']['0.05'], $pf2['irr'], 1e-9) && near($mc0['irr_q']['0.95'], $pf2['irr'], 1e-9));
$u1 = ['rent_mean' => 1000, 'rent_sd_abs' => 100, 'vac_sd' => 0.03, 'app_sd' => 0.04, 'rg_sd' => 0.015, 'opex_sd' => 0.1, 'rate_sd' => 0.01];
$m1 = MonteCarlo::run($p2, $u1, 2000, 99, 0.05);
$m2 = MonteCarlo::run($p2, $u1, 2000, 99, 0.05);
check('MC reproducible with seed', $m1['irr_q'] === $m2['irr_q'] && $m1['p_loss'] === $m2['p_loss']);
$m3 = MonteCarlo::run($p2, $u1, 2000, 12345, 0.05);
check('MC converges across seeds (median IRR within 1pt)', abs($m1['irr_q']['0.5'] - $m3['irr_q']['0.5']) < 0.01);
check('MC percentiles ordered', $m1['irr_q']['0.05'] <= $m1['irr_q']['0.25'] && $m1['irr_q']['0.25'] <= $m1['irr_q']['0.5'] && $m1['irr_q']['0.5'] <= $m1['irr_q']['0.95']);
check('MC CVaR >= VaR', $m1['cvar95'] >= $m1['var95'] - 1e-9);
check('MC median near deterministic', abs($m1['irr_q']['0.5'] - $pf2['irr']) < 0.02);
check('MC histogram sums to n', array_sum($m1['hist']['counts']) === 2000);

// ---------------- Bayes ----------------
$bn = Bayes::normalNormal(1000, 100, [1200, 1200, 1200, 1200], 200);
check('bayes posterior mean', near($bn['mean'], 1100));
check('bayes posterior sd', near($bn['sd'], sqrt(1 / 2e-4)));
check('bayes no data = prior', near(Bayes::normalNormal(1000, 100, [], 50)['mean'], 1000));
$br = Bayes::rent(1000, 0.15, [['kind' => 'rent_contract', 'price' => 1200, 'area_sqm' => 100], ['kind' => 'rent_contract', 'price' => 1100, 'area_sqm' => 100], ['kind' => 'rent_ask', 'price' => 1300, 'area_sqm' => 100], ['kind' => 'sale_txn', 'price' => 9, 'area_sqm' => 1]], 100.0, 0.0);
check('bayes rent ignores sale comps', $br['n'] === 3);
check('bayes rent posterior between prior and data', $br['posterior']['mean'] > 1000 && $br['posterior']['mean'] < 1200);
check('bayes prior sensitivity monotone', $br['sensitivity']['0.5'] < $br['sensitivity']['1'] && $br['sensitivity']['1'] < $br['sensitivity']['2']);

// ---------------- Valuation ----------------
$mk = static fn($price, $area, $m = 0, $d = 0.5, $kind = 'sale_txn', $bed = null, $age = null, $cond = 0) => ['kind' => $kind, 'price' => $price, 'area_sqm' => $area, 'months_ago' => $m, 'distance_km' => $d, 'condition' => $cond, 'bedrooms' => $bed, 'age' => $age];
$cs = [$mk(400000, 100), $mk(400000, 100), $mk(400000, 100)];
$cv = Valuation::comps($cs, 100.0, 0.0, 0.0);
check('comps identical → exact', near($cv['value'], 400000));
check('comps insufficient', !Valuation::comps([$mk(1, 1)], 100.0, 0, 0)['available']);
check('comps need area', !Valuation::comps($cs, null, 0, 0)['available']);
$ask = Valuation::adjustedPrice($mk(100000, 50, 0, 0, 'sale_ask'), 0.0, 0.1);
check('asking discount applied', near($ask, 90000));
check('time adjustment', near(Valuation::adjustedPrice($mk(100000, 50, 12), 0.05, 0), 105000));
// Hedonic: generate data from known log-linear model with mild noise.
$hr = new Rng(5);
$hc = [];
for ($i = 0; $i < 20; $i++) {
    $area = 60 + 5 * $i;
    $age = ($i * 3) % 25;
    $price = exp(log(5000) + 1.0 * log($area) - 0.01 * $age + 0.02 * $hr->normal());
    $hc[] = $mk($price, $area, 0, 0.5 + ($i % 3) * 0.1, 'sale_txn', null, $age);
}
$hv = Valuation::hedonic($hc, ['area_sqm' => 100.0, 'bedrooms' => null, 'building_age' => 10], 0.0, 0.0);
$truth = exp(log(5000) + log(100) - 0.1);
check('hedonic available', $hv['available']);
check('hedonic recovers value within 3%', $hv['available'] && abs($hv['value'] - $truth) / $truth < 0.03, $hv['available'] ? (string) $hv['value'] : $hv['reason']);
check('hedonic LOOCV error small', $hv['available'] && $hv['loocv_mape'] < 0.05);
check('reconcile inverse variance', near(Valuation::reconcile(['a' => ['available' => true, 'value' => 100, 'sd' => 10], 'b' => ['available' => true, 'value' => 200, 'sd' => 10]])['value'], 150));

// ---------------- Forecast ----------------
$lin = [];
for ($i = 0; $i < 30; $i++) {
    $lin[] = 100 + 2 * $i;
}
$h = Forecast::holt($lin, 3);
check('holt linear continuation', near($h['forecast'][0]['point'], 160, 0.02));
$bt = Forecast::backtest($lin);
check('holt beats naive on trend', $bt !== null && $bt['beats_naive']);
check('backtest needs data', Forecast::backtest([1, 2, 3]) === null);

// ---------------- Scoring ----------------
check('curve interpolation', near(Scoring::curve(0.06, Scoring::CURVES['irr']), 45 + 20 * (0.01 / 0.03)));
check('curve clamps', Scoring::curve(-1, Scoring::CURVES['irr']) === 0.0 && Scoring::curve(5, Scoring::CURVES['irr']) === 100.0);
foreach (Scoring::WEIGHTS as $k => $w) {
    check("weights sum to 1 ($k)", near(array_sum($w), 1.0));
}

// ---------------- Inputs + full analysis ----------------
$raw = ['country' => 'AE', 'currency' => 'AED', 'asking_price' => '1,500,000', 'area' => '1200', 'area_unit' => 'sqft', 'interest_rate_pct' => '4.5', 'monthly_rent' => '8500',
    'comps' => [['kind' => 'sale_txn', 'price' => '1450000', 'area' => '1150', 'months_ago' => '3', 'distance_km' => '0.5'], ['kind' => 'sale_txn', 'price' => '1520000', 'area' => '1250', 'months_ago' => '6', 'distance_km' => '0.8'], ['kind' => 'sale_ask', 'price' => '1600000', 'area' => '1200', 'months_ago' => '1', 'distance_km' => '0.3'], ['kind' => 'rent_ask', 'price' => '9000', 'area' => '1200']]];
[$v, $prov, $err] = Inputs::normalise($raw);
check('inputs no errors', $err === [], json_encode($err));
check('sqft converted', near($v['area_sqm'], 1200 * 0.09290304));
check('purchase price derived', $v['purchase_price'] == 1500000 && $prov['purchase_price'] === 'derived');
check('provenance default tagged', $prov['vacancy_pct'] === 'default' && $prov['monthly_rent'] === 'user');
check('comps parsed', count($v['comps']) === 4);
[, , $err2] = Inputs::normalise(['country' => 'AE', 'currency' => 'AED']);
check('required errors', isset($err2['asking_price']) && isset($err2['interest_rate_pct']) && isset($err2['monthly_rent']));
[$vs] = Inputs::normalise(['country' => 'ES', 'currency' => 'EUR', 'asking_price' => 300000, 'financing' => 'cash', 'rental_mode' => 'short_term', 'nightly_rate' => 100, 'str_occupancy_pct' => 60]);
check('STR monthly derived', near($vs['monthly_rent'], 100 * 365 / 12 * 0.6 * 0.85));
$t0 = microtime(true);
$res = Analysis::run($v, $prov);
$dt = microtime(true) - $t0;
check('analysis runs', isset($res['base']['irr'], $res['mc']['irr_q'], $res['scores']['band']));
check('analysis comps available', $res['valuation']['comps']['available']);
check('analysis bayes available', $res['bayes']['available']);
check('analysis scenarios ordered', $res['scenarios']['severe']['irr'] < $res['scenarios']['base']['irr'] && $res['scenarios']['base']['irr'] < $res['scenarios']['optimistic']['irr']);
check('analysis json-serialisable', json_encode($res) !== false, json_last_error_msg());
check('analysis under 5s (2000 sims)', $dt < 5, sprintf('%.2fs', $dt));
check('market rating never fabricated', str_starts_with($res['scores']['market_rating'], 'Not rated'));
check('confidence market component zero', $res['confidence']['components'][3][1] == 0);

// ---------------- Tools ----------------
foreach (Tools::all() as $slug => $tool) {
    $vals = Tools::values($tool, []);
    $out = Tools::compute($slug, $vals);
    check("tool $slug computes", !empty($out['results']));
}
$ry = Tools::compute('rental-yield-calculator', ['price' => 200000, 'rent' => 1000, 'costs' => 0, 'vacancy' => 0, 'buy_costs' => 0]);
check('tool rental yield 6%', $ry['results'][0][1] === '6.0%');

echo "\n$pass passed, $fail failed\n";
foreach ($failures as $f) {
    echo "  ✗ $f\n";
}
exit($fail ? 1 : 0);
