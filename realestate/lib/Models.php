<?php
declare(strict_types=1);

namespace SS;

/**
 * Cash-flow projection used by every other model (base case, scenarios,
 * sensitivity, Monte Carlo). One implementation => one set of tests.
 */
final class Proforma
{
    public const VERSION = 'proforma-1.0.0';

    /**
     * @param array $p decimals: price, acq_costs, renovation, loan, rate, term, io, rent_m, other_m,
     *                 vacancy, mgmt, capex, fixed_opex, maint, rent_growth, exp_growth, appreciation,
     *                 hold, sell_cost, discount, inflation, opex_mult
     */
    public static function run(array $p, bool $withRows = true): array
    {
        $H = max(1, (int) $p['hold']);
        $loan = max(0.0, $p['loan']);
        $amort = $loan > 0 ? Finance::amortisationByYear($p['rate'], (int) $p['term'], $loan, (int) $p['io'], max($H, 1)) : [];
        $equity0 = $p['price'] - $loan + $p['acq_costs'] + $p['renovation'];
        $opexMult = $p['opex_mult'] ?? 1.0;
        $cfs = [-$equity0];
        $rows = [];
        $first = null;
        $minCf = INF;
        for ($y = 1; $y <= $H; $y++) {
            $g = (1 + $p['rent_growth']) ** ($y - 1);
            $e = (1 + $p['exp_growth']) ** ($y - 1);
            $gpr = $p['rent_m'] * 12 * $g;
            $vacLoss = $gpr * $p['vacancy'];
            $collected = $gpr - $vacLoss;
            $other = $p['other_m'] * 12 * $g;
            $egi = $collected + $other;
            $mgmt = $collected * $p['mgmt'];
            $fixed = ($p['fixed_opex'] + $p['maint']) * $e * $opexMult;
            $opex = $mgmt + $fixed;
            $noi = $egi - $opex;
            $capex = $collected * $p['capex'];
            $ds = $amort[$y - 1]['payment'] ?? 0.0;
            $interest = $amort[$y - 1]['interest'] ?? 0.0;
            $cf = $noi - $ds - $capex;
            $minCf = min($minCf, $cf);
            $row = compact('y', 'gpr', 'vacLoss', 'other', 'egi', 'mgmt', 'fixed', 'opex', 'noi', 'capex', 'ds', 'interest', 'cf');
            $row['balance'] = $amort[$y - 1]['balance'] ?? 0.0;
            $row['value'] = $p['price'] * (1 + $p['appreciation']) ** $y;
            if ($first === null) {
                $first = $row;
            }
            $cfs[] = $cf;
            if ($withRows) {
                $rows[] = $row;
            }
        }
        $exitValue = $p['price'] * (1 + $p['appreciation']) ** $H;
        $sellCosts = $exitValue * $p['sell_cost'];
        $exitBalance = $amort[$H - 1]['balance'] ?? 0.0;
        $netSale = $exitValue - $sellCosts - $exitBalance;
        $cfs[$H] += $netSale;

        $totalProfit = array_sum($cfs);
        $irr = Finance::irr($cfs);
        $out = [
            'cfs' => $cfs,
            'equity0' => $equity0,
            'loan' => $loan,
            'gpr1' => $first['gpr'],
            'noi1' => $first['noi'],
            'cf1' => $first['cf'],
            'ds1' => $first['ds'],
            'min_cf' => $minCf,
            'exit_value' => $exitValue,
            'sell_costs' => $sellCosts,
            'exit_balance' => $exitBalance,
            'net_sale' => $netSale,
            'total_profit' => $totalProfit,
            'irr' => $irr,
        ];
        if (!$withRows) {
            return $out;
        }
        $totalCost = $p['price'] + $p['acq_costs'] + $p['renovation'];
        $nonMgmtShare = 1 - $p['mgmt'] - $p['capex'];
        $beOcc = ($first['gpr'] > 0 && $nonMgmtShare > 0)
            ? ($first['fixed'] + $first['ds'] - $first['other']) / ($first['gpr'] * $nonMgmtShare)
            : null;
        $roi = $equity0 > 0 ? $totalProfit / $equity0 : null;
        $out += [
            'rows' => $rows,
            'total_cost' => $totalCost,
            'gross_yield' => $p['price'] > 0 ? $first['gpr'] / $p['price'] : null,
            'net_yield' => $totalCost > 0 ? $first['noi'] / $totalCost : null,
            'cap_rate' => $p['price'] > 0 ? $first['noi'] / $p['price'] : null,
            'coc' => $equity0 > 0 ? $first['cf'] / $equity0 : null,
            'dscr' => $first['ds'] > 0 ? $first['noi'] / $first['ds'] : null,
            'ltv' => $p['price'] > 0 ? $loan / $p['price'] : 0.0,
            'break_even_occ' => $beOcc,
            'roi_total' => $roi,
            'roi_annualised' => ($roi !== null && $roi > -1) ? (1 + $roi) ** (1 / $H) - 1 : null,
            'npv' => Finance::npv($p['discount'], $cfs),
            'mirr' => Finance::mirr($cfs, $p['rate'] > 0 ? $p['rate'] : $p['discount'], $p['discount']),
            'equity_multiple' => Finance::equityMultiple($cfs),
            'real_irr' => $irr === null ? null : Finance::realRate($irr, $p['inflation']),
            'monthly_cf1' => $first['cf'] / 12,
            'payment_monthly' => $first['ds'] / 12,
            'amort' => $amort,
        ];
        return $out;
    }
}

final class MonteCarlo
{
    public const VERSION = 'montecarlo-1.1.0';
    public const RHO_RENT_PRICE = 0.5;

    /**
     * Simulate outcomes. Each path draws per-path AVERAGE annual rates (price change,
     * rent growth) with correlation RHO, a first-year rent level, vacancy, an opex
     * multiplier and (for variable loans) a rate shift. Optional FX path for a
     * reporting currency. Deterministic for a given seed.
     */
    public static function run(array $base, array $u, int $n, int $seed, float $target, ?array $fx = null): array
    {
        $rng = new Rng($seed);
        $profits = [];
        $irrs = [];
        $fxIrrs = [];
        $cf1 = [];
        $undefined = 0;
        $hitTarget = 0;
        $negYear = 0;
        $checkpoints = [];
        $marks = [(int) ($n / 4), (int) ($n / 2), $n];
        $rho = self::RHO_RENT_PRICE;
        for ($i = 1; $i <= $n; $i++) {
            $p = $base;
            $zc = $rng->normal();
            $z1 = $rng->normal();
            $z2 = $rng->normal();
            $p['appreciation'] = $base['appreciation'] + $u['app_sd'] * $zc;
            $p['rent_growth'] = $base['rent_growth'] + $u['rg_sd'] * ($rho * $zc + sqrt(1 - $rho * $rho) * $z1);
            $p['rent_m'] = max(0.0, $u['rent_mean'] + $u['rent_sd_abs'] * $z2);
            $p['vacancy'] = min(0.95, max(0.0, $base['vacancy'] + $u['vac_sd'] * $rng->normal()));
            $p['opex_mult'] = exp($u['opex_sd'] * $rng->normal() - 0.5 * $u['opex_sd'] ** 2);
            if ($u['rate_sd'] > 0 && $base['loan'] > 0) {
                $p['rate'] = max(0.0, $base['rate'] + $u['rate_sd'] * $rng->normal());
            }
            $r = Proforma::run($p, false);
            $profits[] = $r['total_profit'];
            $cf1[] = $r['cf1'] / 12;
            if ($r['min_cf'] < 0) {
                $negYear++;
            }
            if ($r['irr'] === null) {
                $undefined++;
                // All flows non-positive => total loss of equity at minimum; treat as -100% for ranking.
                $irrs[] = $r['total_profit'] >= 0 ? 0.0 : -1.0;
            } else {
                $irrs[] = $r['irr'];
            }
            if (end($irrs) >= $target) {
                $hitTarget++;
            }
            if ($fx !== null) {
                $zf = $rng->normal();
                $conv = [];
                foreach ($r['cfs'] as $t => $c) {
                    $m = $t === 0 ? 1.0 : exp(-0.5 * $fx['vol'] ** 2 * $t + $fx['vol'] * sqrt($t) * $zf);
                    $conv[] = $c * $fx['rate'] * $m;
                }
                $fi = Finance::irr($conv);
                $fxIrrs[] = $fi ?? (array_sum($conv) >= 0 ? 0.0 : -1.0);
            }
            if (in_array($i, $marks, true)) {
                $checkpoints[] = ['n' => $i, 'p_target' => $hitTarget / $i, 'mean_irr' => Stats::mean($irrs)];
            }
        }
        sort($irrs);
        sort($profits);
        $qs = [0.05, 0.25, 0.5, 0.75, 0.95];
        $irrQ = Stats::quantilesSorted($irrs, $qs);
        $profQ = Stats::quantilesSorted($profits, $qs);
        $q05 = $profQ['0.05'];
        $tail = array_filter($profits, static fn($v) => $v <= $q05);
        $losses = count(array_filter($profits, static fn($v) => $v < 0));
        $pLoss = $losses / $n;
        $out = [
            'version' => self::VERSION,
            'n' => $n,
            'seed' => $seed,
            'irr_q' => $irrQ,
            'irr_mean' => Stats::mean($irrs),
            'profit_q' => $profQ,
            'profit_mean' => Stats::mean($profits),
            'profit_se' => Stats::sd($profits) / sqrt($n),
            'p_loss' => $pLoss,
            'p_loss_se' => sqrt(max($pLoss * (1 - $pLoss), 1e-12) / $n),
            'p_target' => $hitTarget / $n,
            'p_negative_year' => $negYear / $n,
            'irr_undefined' => $undefined,
            'var95' => max(0.0, -$q05),
            'cvar95' => max(0.0, -Stats::mean($tail)),
            'cf1_q' => Stats::quantilesSorted((static function ($a) { sort($a); return $a; })($cf1), $qs),
            'hist' => self::histogram($irrs, 24),
            'checkpoints' => $checkpoints,
            'target' => $target,
        ];
        if ($fx !== null) {
            sort($fxIrrs);
            $out['fx_irr_q'] = Stats::quantilesSorted($fxIrrs, $qs);
        }
        return $out;
    }

    public static function histogram(array $sorted, int $bins): array
    {
        $lo = Stats::quantilesSorted($sorted, [0.01])['0.01'];
        $hi = Stats::quantilesSorted($sorted, [0.99])['0.99'];
        if ($hi <= $lo) {
            $hi = $lo + 0.01;
        }
        $w = ($hi - $lo) / $bins;
        $counts = array_fill(0, $bins, 0);
        foreach ($sorted as $v) {
            $b = (int) floor(($v - $lo) / $w);
            $b = max(0, min($bins - 1, $b));
            $counts[$b]++;
        }
        return ['lo' => $lo, 'hi' => $hi, 'width' => $w, 'counts' => $counts];
    }
}

final class Bayes
{
    public const VERSION = 'bayes-normal-normal-1.0.0';

    /**
     * Conjugate normal–normal update of an unknown mean with known observation sd.
     * Returns posterior mean/sd and a 90% credible interval.
     */
    public static function normalNormal(float $mu0, float $sd0, array $obs, float $obsSd): array
    {
        $n = count($obs);
        $prec0 = 1 / ($sd0 ** 2);
        if ($n === 0 || $obsSd <= 0) {
            return ['mean' => $mu0, 'sd' => $sd0, 'lo90' => $mu0 - 1.645 * $sd0, 'hi90' => $mu0 + 1.645 * $sd0, 'n' => 0, 'weight_on_data' => 0.0];
        }
        $precD = $n / ($obsSd ** 2);
        $xbar = Stats::mean($obs);
        $post = ($mu0 * $prec0 + $xbar * $precD) / ($prec0 + $precD);
        $sd = sqrt(1 / ($prec0 + $precD));
        return [
            'mean' => $post, 'sd' => $sd, 'lo90' => $post - 1.645 * $sd, 'hi90' => $post + 1.645 * $sd,
            'n' => $n, 'xbar' => $xbar, 'weight_on_data' => $precD / ($prec0 + $precD),
        ];
    }

    /** Rent update from rental comparables; returns null-safe structure with prior sensitivity. */
    public static function rent(float $prior, float $priorSdPct, array $comps, ?float $subjectSqm, float $askAdj): array
    {
        $obs = [];
        $used = [];
        foreach ($comps as $c) {
            if (!str_starts_with($c['kind'], 'rent')) {
                continue;
            }
            $r = $c['price'];
            if ($subjectSqm && $c['area_sqm']) {
                $r = $r / $c['area_sqm'] * $subjectSqm;
            }
            if ($c['kind'] === 'rent_ask') {
                $r *= (1 - $askAdj);
            }
            $obs[] = $r;
            $used[] = $c + ['adjusted' => $r];
        }
        $n = count($obs);
        $sd0 = max(1e-6, $prior * $priorSdPct);
        if ($n === 0) {
            return ['available' => false, 'n' => 0, 'prior' => $prior, 'prior_sd' => $sd0];
        }
        $assumedObsSd = $n < 3;
        $obsSd = $assumedObsSd ? 0.15 * Stats::mean($obs) : Stats::sd($obs);
        $obsSd = max($obsSd, 0.02 * Stats::mean($obs));
        $post = self::normalNormal($prior, $sd0, $obs, $obsSd);
        $sens = [];
        foreach ([0.5, 1.0, 2.0] as $m) {
            $sens[(string) $m] = self::normalNormal($prior, $sd0 * $m, $obs, $obsSd)['mean'];
        }
        return [
            'available' => true, 'version' => self::VERSION, 'prior' => $prior, 'prior_sd' => $sd0,
            'obs_sd' => $obsSd, 'obs_sd_assumed' => $assumedObsSd, 'posterior' => $post, 'n' => $n,
            'comps' => $used, 'sensitivity' => $sens,
        ];
    }
}

final class Valuation
{
    public const VERSION = 'valuation-comps-hedonic-1.0.0';
    public const MIN_COMPS = 3;
    public const MIN_HEDONIC = 8;

    /** Comparable weights are heuristic and published in the methodology page. */
    public static function compWeight(array $c, ?float $subjectSqm): float
    {
        $rec = $c['months_ago'] === null ? 0.5 : exp(-$c['months_ago'] / 12);
        $dist = $c['distance_km'] === null ? 0.5 : 1 / (1 + $c['distance_km']);
        $size = ($subjectSqm && $c['area_sqm']) ? exp(-2 * abs(log($c['area_sqm'] / $subjectSqm))) : 0.5;
        $kind = $c['kind'] === 'sale_txn' ? 1.0 : 0.6;
        $cond = 1 - 0.3 * abs($c['condition']);
        return $rec * $dist * $size * $kind * $cond;
    }

    public static function adjustedPrice(array $c, float $appreciation, float $askAdj): float
    {
        $p = $c['price'];
        if ($c['kind'] === 'sale_ask') {
            $p *= (1 - $askAdj);
        } elseif ($c['months_ago'] !== null) {
            // Bring a past transaction to today using the user's own price-change assumption.
            $p *= (1 + $appreciation) ** ($c['months_ago'] / 12);
        }
        return $p;
    }

    public static function comps(array $comps, ?float $subjectSqm, float $appreciation, float $askAdj): array
    {
        $sales = array_values(array_filter($comps, static fn($c) => str_starts_with($c['kind'], 'sale')));
        $n = count($sales);
        $txn = count(array_filter($sales, static fn($c) => $c['kind'] === 'sale_txn'));
        if ($n < self::MIN_COMPS || !$subjectSqm) {
            return ['available' => false, 'n' => $n, 'n_txn' => $txn,
                'reason' => !$subjectSqm ? 'Enter the property\'s area to compare price per unit area.' : 'At least ' . self::MIN_COMPS . ' sale comparables with area are needed.'];
        }
        $ppsm = [];
        $w = [];
        $rows = [];
        foreach ($sales as $c) {
            if (!$c['area_sqm']) {
                continue;
            }
            $adj = self::adjustedPrice($c, $appreciation, $askAdj);
            $ppsm[] = $adj / $c['area_sqm'];
            $w[] = self::compWeight($c, $subjectSqm);
            $rows[] = $c + ['adjusted' => $adj, 'ppsm' => $adj / $c['area_sqm'], 'weight' => end($w)];
        }
        if (count($ppsm) < self::MIN_COMPS) {
            return ['available' => false, 'n' => $n, 'n_txn' => $txn, 'reason' => 'At least ' . self::MIN_COMPS . ' sale comparables with area are needed.'];
        }
        $sw = array_sum($w);
        foreach ($rows as &$r) {
            $r['weight_share'] = $r['weight'] / $sw;
        }
        unset($r);
        $m = Stats::weightedMean($ppsm, $w);
        $sd = Stats::weightedSd($ppsm, $w);
        $sw2 = array_sum(array_map(static fn($x) => $x * $x, $w));
        $nEff = $sw * $sw / $sw2;
        $value = $m * $subjectSqm;
        $sdVal = (is_nan($sd) ? 0.15 * $m : $sd) * $subjectSqm;
        return [
            'available' => true, 'n' => count($rows), 'n_txn' => $txn, 'n_eff' => $nEff,
            'ppsm' => $m, 'value' => $value, 'sd' => $sdVal,
            'lo' => $value - 1.2816 * $sdVal, 'hi' => $value + 1.2816 * $sdVal,
            'rows' => $rows,
        ];
    }

    /** Log-linear hedonic regression on the user's sale comparables. */
    public static function hedonic(array $comps, array $subject, float $appreciation, float $askAdj): array
    {
        $sales = array_values(array_filter($comps, static fn($c) => str_starts_with($c['kind'], 'sale') && $c['area_sqm']));
        $n = count($sales);
        if ($n < self::MIN_HEDONIC || empty($subject['area_sqm'])) {
            return ['available' => false, 'n' => $n, 'reason' => 'Needs at least ' . self::MIN_HEDONIC . ' sale comparables with area.'];
        }
        $cands = [
            'ln_area' => ['label' => 'ln(area)', 'get' => static fn($c) => log($c['area_sqm']), 'subj' => log($subject['area_sqm'])],
            'bedrooms' => ['label' => 'Bedrooms', 'get' => static fn($c) => $c['bedrooms'], 'subj' => $subject['bedrooms']],
            'age' => ['label' => 'Building age', 'get' => static fn($c) => $c['age'], 'subj' => $subject['building_age']],
            'condition' => ['label' => 'Relative condition', 'get' => static fn($c) => $c['condition'], 'subj' => 0.0],
            'asking' => ['label' => 'Asking (vs transaction)', 'get' => static fn($c) => $c['kind'] === 'sale_ask' ? 1 : 0, 'subj' => 0.0],
        ];
        $use = [];
        foreach ($cands as $k => $def) {
            if ($def['subj'] === null) {
                continue;
            }
            $vals = array_map($def['get'], $sales);
            if (in_array(null, $vals, true)) {
                continue;
            }
            if (Stats::sd(array_map('floatval', $vals)) < 1e-9) {
                continue;
            }
            $use[$k] = $def;
        }
        // Keep the model small relative to n (rule of thumb: ≥ 4 obs per parameter).
        $maxK = max(1, intdiv($n, 4));
        $use = array_slice($use, 0, $maxK, true);
        $y = [];
        $X = [];
        foreach ($sales as $c) {
            $y[] = log(self::adjustedPrice($c, $appreciation, $askAdj));
            $X[] = array_values(array_map(static fn($d) => (float) ($d['get'])($c), $use));
        }
        // Standardise for a numerically stable, scale-free ridge penalty.
        $k = count($use);
        $mu = [];
        $sg = [];
        for ($j = 0; $j < $k; $j++) {
            $col = array_column($X, $j);
            $mu[$j] = Stats::mean($col);
            $sg[$j] = Stats::sd($col) ?: 1.0;
        }
        $Z = array_map(static function ($r) use ($mu, $sg) {
            return array_map(static fn($v, $j) => ($v - $mu[$j]) / $sg[$j], $r, array_keys($r));
        }, $X);
        $lambda = $n >= 3 * ($k + 1) ? 0.0 : 1.0;
        $fit = Stats::ols($Z, $y, $lambda);
        if ($fit === null) {
            return ['available' => false, 'n' => $n, 'reason' => 'Comparables are too similar to estimate a regression (singular design).'];
        }
        $zs = [1.0];
        $j = 0;
        foreach ($use as $def) {
            $zs[] = ((float) $def['subj'] - $mu[$j]) / $sg[$j];
            $j++;
        }
        $yhat = 0.0;
        foreach ($zs as $i => $v) {
            $yhat += $v * $fit['beta'][$i];
        }
        $lev = 0.0;
        foreach ($zs as $a => $va) {
            foreach ($zs as $b => $vb) {
                $lev += $va * $fit['xtx_inv'][$a][$b] * $vb;
            }
        }
        $sePred = $fit['sigma'] * sqrt(1 + $lev);
        // Leave-one-out cross-validation (out-of-sample error).
        $ape = [];
        for ($i = 0; $i < $n; $i++) {
            $Zi = $Z;
            $yi = $y;
            array_splice($Zi, $i, 1);
            array_splice($yi, $i, 1);
            $f = Stats::ols($Zi, $yi, $lambda);
            if ($f === null) {
                continue;
            }
            $pred = $f['beta'][0];
            foreach ($Z[$i] as $jj => $v) {
                $pred += $v * $f['beta'][$jj + 1];
            }
            $ape[] = abs(exp($pred) - exp($y[$i])) / exp($y[$i]);
        }
        $coef = [];
        $j = 1;
        foreach ($use as $key => $def) {
            $coef[] = ['term' => $def['label'], 'beta_std' => $fit['beta'][$j], 'beta_raw' => $fit['beta'][$j] / $sg[$j - 1], 'p' => $fit['p'][$j]];
            $j++;
        }
        $value = exp($yhat + 0.5 * $fit['sigma'] ** 2);
        return [
            'available' => true, 'version' => self::VERSION, 'n' => $n, 'k' => $k, 'lambda' => $lambda,
            'r2' => $fit['r2'], 'adj_r2' => $fit['adj_r2'], 'sigma' => $fit['sigma'],
            'value' => $value, 'lo' => exp($yhat - 1.2816 * $sePred), 'hi' => exp($yhat + 1.2816 * $sePred),
            'sd' => $value * $sePred, 'loocv_mape' => $ape ? Stats::mean($ape) : null, 'coef' => $coef,
        ];
    }

    /** Inverse-variance reconciliation of independent indications. */
    public static function reconcile(array $indications): ?array
    {
        $num = 0.0;
        $den = 0.0;
        $used = [];
        foreach ($indications as $name => $ind) {
            if (empty($ind['available']) || empty($ind['sd']) || $ind['sd'] <= 0) {
                continue;
            }
            $w = 1 / ($ind['sd'] ** 2);
            $num += $w * $ind['value'];
            $den += $w;
            $used[$name] = $w;
        }
        if ($den <= 0) {
            return null;
        }
        $sum = array_sum($used);
        return [
            'value' => $num / $den,
            'sd' => sqrt(1 / $den),
            'weights' => array_map(static fn($w) => $w / $sum, $used),
        ];
    }
}

/** Univariate forecasting with mandatory out-of-sample backtest vs. naive baselines. */
final class Forecast
{
    public const VERSION = 'holt-damped-1.0.0';

    public static function holtFit(array $y, float $a, float $b, float $phi): array
    {
        $l = $y[0];
        $t = count($y) > 1 ? $y[1] - $y[0] : 0.0;
        $sse = 0.0;
        $res = [];
        for ($i = 1, $n = count($y); $i < $n; $i++) {
            $f = $l + $phi * $t;
            $e = $y[$i] - $f;
            $res[] = $e;
            $sse += $e * $e;
            $lPrev = $l;
            $l = $a * $y[$i] + (1 - $a) * ($lPrev + $phi * $t);
            $t = $b * ($l - $lPrev) + (1 - $b) * $phi * $t;
        }
        return ['l' => $l, 't' => $t, 'sse' => $sse, 'res' => $res];
    }

    public static function holt(array $y, int $h): array
    {
        $best = null;
        foreach ([0.1, 0.2, 0.3, 0.5, 0.7, 0.9] as $a) {
            foreach ([0.01, 0.05, 0.1, 0.2, 0.4] as $b) {
                foreach ([0.8, 0.9, 0.95, 0.98, 1.0] as $phi) {
                    $f = self::holtFit($y, $a, $b, $phi);
                    if ($best === null || $f['sse'] < $best['sse']) {
                        $best = $f + ['a' => $a, 'b' => $b, 'phi' => $phi];
                    }
                }
            }
        }
        $sigma = count($best['res']) > 1 ? Stats::sd($best['res']) : 0.0;
        $fc = [];
        $cum = 0.0;
        for ($k = 1; $k <= $h; $k++) {
            $cum += $best['phi'] ** $k;
            $point = $best['l'] + $cum * $best['t'];
            // Approximate interval widening (random-walk-like growth of variance).
            $w = 1.2816 * $sigma * sqrt($k);
            $fc[] = ['h' => $k, 'point' => $point, 'lo80' => $point - $w, 'hi80' => $point + $w];
        }
        return ['params' => ['alpha' => $best['a'], 'beta' => $best['b'], 'phi' => $best['phi']], 'sigma' => $sigma, 'forecast' => $fc];
    }

    /** Rolling-origin one-step backtest on the last ~25% of the series. */
    public static function backtest(array $y): ?array
    {
        $n = count($y);
        if ($n < 12) {
            return null;
        }
        $start = max(8, (int) floor($n * 0.75));
        $err = ['holt' => [], 'naive' => [], 'drift' => []];
        for ($i = $start; $i < $n; $i++) {
            $train = array_slice($y, 0, $i);
            $actual = $y[$i];
            $h = self::holt($train, 1)['forecast'][0]['point'];
            $naive = end($train);
            $drift = $naive + ($naive - $train[0]) / (count($train) - 1);
            foreach (['holt' => $h, 'naive' => $naive, 'drift' => $drift] as $m => $p) {
                $err[$m][] = ['ae' => abs($actual - $p), 'ape' => $actual != 0 ? abs($actual - $p) / abs($actual) : null];
            }
        }
        $out = [];
        foreach ($err as $m => $rows) {
            $ape = array_filter(array_column($rows, 'ape'), static fn($v) => $v !== null);
            $out[$m] = ['mae' => Stats::mean(array_column($rows, 'ae')), 'mape' => $ape ? Stats::mean($ape) : null];
        }
        $out['holdout_n'] = $n - $start;
        $out['beats_naive'] = $out['holt']['mae'] < $out['naive']['mae'];
        return $out;
    }
}
