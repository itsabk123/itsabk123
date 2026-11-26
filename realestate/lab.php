<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Charts, Fmt, Forecast, Rng, Stats, View};

$mode = ($_REQUEST['mode'] ?? 'forecast') === 'regression' ? 'regression' : 'forecast';

/** Synthetic demo data — generated, clearly labelled, never presented as market data. */
function demo_series(): string
{
    $r = new Rng(2026);
    $v = 100.0;
    $out = [];
    for ($i = 0; $i < 48; $i++) {
        $v *= 1 + 0.004 + 0.01 * sin($i / 6) + 0.006 * $r->normal();
        $out[] = sprintf('%d-%02d,%.2f', 2022 + intdiv($i, 12), $i % 12 + 1, $v);
    }
    return implode("\n", $out);
}

function demo_regression(): string
{
    $r = new Rng(7);
    $lines = ['price_index,mortgage_rate,income_growth,new_supply'];
    for ($i = 0; $i < 40; $i++) {
        $rate = 3 + 2 * sin($i / 7) + 0.3 * $r->normal();
        $inc = 2 + 0.8 * $r->normal();
        $sup = 5 + 1.5 * $r->normal();
        $y = 120 - 4 * $rate + 3 * $inc - 1.2 * $sup + 2.5 * $r->normal();
        $lines[] = sprintf('%.2f,%.2f,%.2f,%.2f', $y, $rate, $inc, $sup);
    }
    return implode("\n", $lines);
}

$input = (string) ($_POST['data'] ?? '');
$isDemo = false;
if ($input === '' && !is_post()) {
    $input = $mode === 'forecast' ? demo_series() : demo_regression();
    $isDemo = true;
}
$input = mb_substr($input, 0, 60000);
$h = max(1, min(36, (int) ($_POST['h'] ?? 12)));
$err = null;
$fc = null;
$bt = null;
$reg = null;
$labels = [];
$y = [];

if (is_post()) {
    csrf_check();
    if (!rate_limit('lab:' . ip_hash(), 60, 3600)) {
        render_error(429, 'Too many analyses. Please wait a little.');
    }
    track('lab_run', ['mode' => $mode]);
}

if ($mode === 'forecast') {
    foreach (preg_split('/\r?\n/', trim($input)) as $line) {
        $parts = array_map('trim', str_getcsv($line));
        $val = end($parts);
        $val = str_replace(',', '', (string) $val);
        if (!is_numeric($val)) {
            continue;
        }
        $labels[] = count($parts) > 1 ? mb_substr($parts[0], 0, 12) : (string) (count($y) + 1);
        $y[] = (float) $val;
    }
    $y = array_slice($y, -600);
    $labels = array_slice($labels, -600);
    if (count($y) < 8) {
        $err = 'Enter at least 8 numeric observations (one per line, optionally "date,value").';
    } else {
        $fc = Forecast::holt($y, $h);
        $bt = Forecast::backtest($y);
    }
} else {
    $rows = array_values(array_filter(array_map(static fn($l) => array_map('trim', str_getcsv($l)), preg_split('/\r?\n/', trim($input))), static fn($r) => count($r) > 1));
    $head = $rows ? array_shift($rows) : [];
    if ($head && is_numeric($head[0])) {
        array_unshift($rows, $head);
        $head = array_map(static fn($i) => $i === 0 ? 'y' : 'x' . $i, array_keys($head));
    }
    $k = count($head);
    $Y = [];
    $X = [];
    foreach (array_slice($rows, 0, 2000) as $r) {
        if (count($r) !== $k || array_filter($r, static fn($c) => !is_numeric($c))) {
            continue;
        }
        $Y[] = (float) $r[0];
        $X[] = array_map('floatval', array_slice($r, 1));
    }
    if ($k < 2 || count($Y) < $k + 5) {
        $err = 'Need a header row (dependent variable first) and at least ' . max(7, $k + 5) . ' complete numeric rows.';
    } else {
        $fit = Stats::ols($X, $Y);
        if (!$fit) {
            $err = 'Regressors are perfectly collinear — remove a duplicated or constant column.';
        } else {
            $reg = ['head' => $head, 'fit' => $fit, 'vif' => Stats::vif($X), 'bp' => Stats::breuschPagan($X, $fit['resid']), 'dw' => Stats::durbinWatson($fit['resid']), 'n' => count($Y)];
        }
    }
}

$page_title = 'Market Lab — forecasting & regression on your data';
$page_desc = 'Forecast a price or rent series with a backtested damped-trend model, or run an econometric regression with robust errors and diagnostics — on data you supply.';
$canonical = abs_url('lab.php');
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap">
  <p class="eyebrow">Market Lab</p>
  <h1>Analyse a market series you trust</h1>
  <p class="lead">We have not integrated licensed market datasets yet, so the Lab runs on data you paste — for example an official house-price index or rent series from your statistics agency. Your data is processed for this request only and not stored.</p>
  <nav class="tabs"><a href="<?= e(url('lab.php')) ?>"<?= $mode === 'forecast' ? ' aria-current="page"' : '' ?>>Time-series forecast</a><a href="<?= e(url('lab.php', ['mode' => 'regression'])) ?>"<?= $mode === 'regression' ? ' aria-current="page"' : '' ?>>Regression & diagnostics</a></nav>
  <div class="grid g2" style="align-items:start">
    <form method="post" action="<?= e(url('lab.php')) ?>" class="card"><?= csrf_field() ?><input type="hidden" name="mode" value="<?= $mode ?>">
      <?php if ($isDemo): ?><p><?= View::badge('Synthetic demo data — randomly generated, not a real market', 'warn') ?></p><?php endif; ?>
      <div class="field"><label for="data"><?= $mode === 'forecast' ? 'Series — one observation per line: date,value (oldest first)' : 'CSV with header — dependent variable in the first column' ?></label><textarea id="data" name="data" rows="14"><?= e($input) ?></textarea></div>
      <?php if ($mode === 'forecast'): ?><div class="field"><label for="h">Periods to forecast</label><input id="h" name="h" value="<?= (int) $h ?>" inputmode="numeric"></div><?php endif; ?>
      <button class="btn">Run</button>
      <p class="hint">Record your data source when you use results. Limit 60 KB.</p>
    </form>
    <div>
      <?php if ($err): ?><div class="flash flash-err"><?= e($err) ?></div><?php endif; ?>
      <?php if ($fc):
          $n = count($y);
          $allLabels = array_merge($labels, array_map(static fn($f) => '+' . $f['h'], $fc['forecast']));
          $hist = array_merge($y, array_fill(0, $h, null));
          $fcast = array_merge(array_fill(0, $n - 1, null), [$y[$n - 1]], array_column($fc['forecast'], 'point'));
          $lo = array_merge(array_fill(0, $n - 1, null), [$y[$n - 1]], array_column($fc['forecast'], 'lo80'));
          $hi = array_merge(array_fill(0, $n - 1, null), [$y[$n - 1]], array_column($fc['forecast'], 'hi80'));
          ?>
        <div class="card">
          <h2>Forecast (damped Holt)</h2>
          <?= Charts::lines($allLabels, [['name' => 'Observed', 'values' => $hist], ['name' => 'Forecast', 'values' => $fcast, 'dashed' => true]], 'Observed series with forecast and 80% interval', static fn($v) => Fmt::num($v, 0), [$lo, $hi]) ?>
          <p class="small">α=<?= $fc['params']['alpha'] ?>, β=<?= $fc['params']['beta'] ?>, φ=<?= $fc['params']['phi'] ?> (grid-searched on one-step errors). Shaded band ≈ 80% interval from residual spread; it widens with horizon and understates uncertainty under structural breaks.</p>
          <?= View::table(['Horizon', 'Point', '80% low', '80% high'], array_map(static fn($f) => ['+' . $f['h'], Fmt::num($f['point']), Fmt::num($f['lo80']), Fmt::num($f['hi80'])], array_slice($fc['forecast'], 0, 12))) ?>
        </div>
        <div class="card" style="margin-top:12px">
          <h2>Backtest</h2>
          <?php if ($bt): ?>
          <?= View::table(['Model', 'MAE', 'MAPE'], [['Damped Holt', Fmt::num($bt['holt']['mae']), Fmt::pct($bt['holt']['mape'], 2)], ['Naive (last value)', Fmt::num($bt['naive']['mae']), Fmt::pct($bt['naive']['mape'], 2)], ['Drift', Fmt::num($bt['drift']['mae']), Fmt::pct($bt['drift']['mape'], 2)]]) ?>
          <p class="small">Rolling one-step-ahead test on the last <?= (int) $bt['holdout_n'] ?> observations, each forecast made only with data available at the time.</p>
          <?= $bt['beats_naive'] ? '<p>' . View::badge('Beats the naive baseline', 'pos') . '</p>' : '<div class="callout"><p><strong>The model does not beat a naive "no change" forecast</strong> on this series. Treat the forecast as no more informative than the last observed value.</p></div>' ?>
          <?php else: ?><p class="muted">Need at least 12 observations to backtest. Without a backtest, treat the forecast as illustrative only.</p><?php endif; ?>
        </div>
      <?php endif; ?>
      <?php if ($reg): $fit = $reg['fit']; ?>
        <div class="card">
          <h2>OLS regression: <?= e($reg['head'][0]) ?></h2>
          <p class="small">n = <?= (int) $reg['n'] ?> · R² = <?= Fmt::num($fit['r2'], 3) ?> · adjusted R² = <?= Fmt::num($fit['adj_r2'], 3) ?> · residual SE = <?= Fmt::num($fit['sigma'], 3) ?></p>
          <?php $rowsT = [['Intercept', Fmt::num($fit['beta'][0], 4), Fmt::num($fit['se'][0], 4), Fmt::num($fit['robust_se'][0], 4), Fmt::num($fit['p'][0], 4), '—']];
          foreach (array_slice($reg['head'], 1) as $i => $name) {
              $rowsT[] = [$name, Fmt::num($fit['beta'][$i + 1], 4), Fmt::num($fit['se'][$i + 1], 4), Fmt::num($fit['robust_se'][$i + 1], 4), Fmt::num($fit['p'][$i + 1], 4), is_finite($reg['vif'][$i]) ? Fmt::num($reg['vif'][$i], 2) : '∞'];
          } ?>
          <?= View::table(['Term', 'Coefficient', 'SE', 'Robust SE (HC1)', 'p-value', 'VIF'], $rowsT) ?>
          <h3 style="margin-top:12px">Diagnostics</h3>
          <ul class="small">
            <li><strong>Multicollinearity:</strong> <?= max(array_map(static fn($v) => is_finite($v) ? $v : 1e9, $reg['vif'] ?: [1])) > 10 ? 'VIF above 10 — coefficients are unstable; consider dropping a correlated variable.' : 'All VIF ≤ 10.' ?></li>
            <li><strong>Heteroskedasticity (Breusch–Pagan):</strong> <?= $reg['bp'] ? 'LM = ' . Fmt::num($reg['bp']['stat'], 2) . ', p = ' . Fmt::num($reg['bp']['p'], 3) . ($reg['bp']['p'] < 0.05 ? ' — evidence of heteroskedasticity; rely on the robust SEs.' : ' — no strong evidence.') : 'not computed' ?></li>
            <li><strong>Autocorrelation (Durbin–Watson):</strong> <?= Fmt::num($reg['dw'], 2) ?><?= $reg['dw'] < 1.5 ? ' — positive autocorrelation likely (common in time series); SEs are understated.' : ($reg['dw'] > 2.5 ? ' — negative autocorrelation possible.' : ' — no strong first-order autocorrelation.') ?></li>
            <li><strong>Structural breaks:</strong> not tested automatically. Split the sample around known policy or rate regime changes and compare coefficients.</li>
          </ul>
          <div class="callout"><p>Regression coefficients describe associations in your data. They are not causal effects without a research design that supports causality.</p></div>
        </div>
      <?php endif; ?>
    </div>
  </div>
</div></section>
<?php require __DIR__ . '/views/footer.php';
