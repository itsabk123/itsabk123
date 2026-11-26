<?php
declare(strict_types=1);

namespace SS;

/**
 * Numerical and statistical primitives. Pure functions, no I/O, so every
 * routine here is covered by tests/run.php against known reference values.
 */
final class Rng
{
    private int $state;

    /** Seeded xorshift32 generator: identical seed => identical simulation. */
    public function __construct(int $seed)
    {
        $this->state = ($seed & 0xFFFFFFFF) ?: 0x9E3779B9;
    }

    public function uniform(): float
    {
        $x = $this->state;
        $x ^= ($x << 13) & 0xFFFFFFFF;
        $x ^= ($x >> 17);
        $x ^= ($x << 5) & 0xFFFFFFFF;
        $this->state = $x & 0xFFFFFFFF;
        // (0,1) open interval so log() in Box-Muller is safe.
        return ($this->state + 0.5) / 4294967296.0;
    }

    private ?float $spare = null;

    public function normal(float $mean = 0.0, float $sd = 1.0): float
    {
        if ($this->spare !== null) {
            $z = $this->spare;
            $this->spare = null;
            return $mean + $sd * $z;
        }
        $u1 = $this->uniform();
        $u2 = $this->uniform();
        $r = sqrt(-2.0 * log($u1));
        $this->spare = $r * sin(2.0 * M_PI * $u2);
        return $mean + $sd * $r * cos(2.0 * M_PI * $u2);
    }
}

final class Stats
{
    public static function mean(array $x): float
    {
        return count($x) ? array_sum($x) / count($x) : NAN;
    }

    /** Sample standard deviation (n-1). */
    public static function sd(array $x): float
    {
        $n = count($x);
        if ($n < 2) {
            return NAN;
        }
        $m = self::mean($x);
        $s = 0.0;
        foreach ($x as $v) {
            $s += ($v - $m) ** 2;
        }
        return sqrt($s / ($n - 1));
    }

    /** Linear-interpolated quantile (type 7, same as R/NumPy default). Input need not be sorted. */
    public static function quantile(array $x, float $p): float
    {
        $n = count($x);
        if ($n === 0) {
            return NAN;
        }
        sort($x);
        $h = ($n - 1) * $p;
        $lo = (int) floor($h);
        $hi = min($lo + 1, $n - 1);
        return $x[$lo] + ($h - $lo) * ($x[$hi] - $x[$lo]);
    }

    public static function quantilesSorted(array $sorted, array $ps): array
    {
        $n = count($sorted);
        $out = [];
        foreach ($ps as $p) {
            $h = ($n - 1) * $p;
            $lo = (int) floor($h);
            $hi = min($lo + 1, $n - 1);
            $out[(string) $p] = $sorted[$lo] + ($h - $lo) * ($sorted[$hi] - $sorted[$lo]);
        }
        return $out;
    }

    public static function weightedMean(array $x, array $w): float
    {
        $sw = array_sum($w);
        if ($sw <= 0) {
            return NAN;
        }
        $s = 0.0;
        foreach ($x as $i => $v) {
            $s += $v * $w[$i];
        }
        return $s / $sw;
    }

    /** Weighted SD using reliability weights (unbiased with effective n). */
    public static function weightedSd(array $x, array $w): float
    {
        $sw = array_sum($w);
        $sw2 = 0.0;
        foreach ($w as $wi) {
            $sw2 += $wi * $wi;
        }
        $denom = $sw - $sw2 / $sw;
        if ($denom <= 0) {
            return NAN;
        }
        $m = self::weightedMean($x, $w);
        $s = 0.0;
        foreach ($x as $i => $v) {
            $s += $w[$i] * ($v - $m) ** 2;
        }
        return sqrt($s / $denom);
    }

    /** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf, |err| < 1.5e-7). */
    public static function normCdf(float $z): float
    {
        $t = 1.0 / (1.0 + 0.3275911 * abs($z) / M_SQRT2);
        $y = 1.0 - ((((1.061405429 * $t - 1.453152027) * $t + 1.421413741) * $t - 0.284496736) * $t + 0.254829592) * $t * exp(-($z * $z) / 2.0);
        return $z >= 0 ? 0.5 * (1.0 + $y) : 0.5 * (1.0 - $y);
    }

    /** Inverse standard normal (Acklam's rational approximation, rel. err ~1e-9). */
    public static function normInv(float $p): float
    {
        if ($p <= 0.0 || $p >= 1.0) {
            throw new \InvalidArgumentException('p must be in (0,1)');
        }
        $a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
        $b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
        $c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
        $d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
        $pl = 0.02425;
        if ($p < $pl) {
            $q = sqrt(-2 * log($p));
            return ((((($c[0] * $q + $c[1]) * $q + $c[2]) * $q + $c[3]) * $q + $c[4]) * $q + $c[5]) / (((($d[0] * $q + $d[1]) * $q + $d[2]) * $q + $d[3]) * $q + 1);
        }
        if ($p > 1 - $pl) {
            $q = sqrt(-2 * log(1 - $p));
            return -((((($c[0] * $q + $c[1]) * $q + $c[2]) * $q + $c[3]) * $q + $c[4]) * $q + $c[5]) / (((($d[0] * $q + $d[1]) * $q + $d[2]) * $q + $d[3]) * $q + 1);
        }
        $q = $p - 0.5;
        $r = $q * $q;
        return ((((($a[0] * $r + $a[1]) * $r + $a[2]) * $r + $a[3]) * $r + $a[4]) * $r + $a[5]) * $q / ((((($b[0] * $r + $b[1]) * $r + $b[2]) * $r + $b[3]) * $r + $b[4]) * $r + 1);
    }

    public static function logGamma(float $x): float
    {
        $g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
        $y = $x;
        $tmp = $x + 5.5;
        $tmp -= ($x + 0.5) * log($tmp);
        $ser = 1.000000000190015;
        foreach ($g as $c) {
            $ser += $c / ++$y;
        }
        return -$tmp + log(2.5066282746310005 * $ser / $x);
    }

    /** Regularized incomplete beta I_x(a,b) via Lentz continued fraction. */
    public static function betaInc(float $x, float $a, float $b): float
    {
        if ($x <= 0) {
            return 0.0;
        }
        if ($x >= 1) {
            return 1.0;
        }
        $bt = exp(self::logGamma($a + $b) - self::logGamma($a) - self::logGamma($b) + $a * log($x) + $b * log(1 - $x));
        if ($x < ($a + 1) / ($a + $b + 2)) {
            return $bt * self::betaCf($x, $a, $b) / $a;
        }
        return 1.0 - $bt * self::betaCf(1 - $x, $b, $a) / $b;
    }

    private static function betaCf(float $x, float $a, float $b): float
    {
        $tiny = 1e-30;
        $qab = $a + $b;
        $qap = $a + 1;
        $qam = $a - 1;
        $c = 1.0;
        $d = 1.0 - $qab * $x / $qap;
        $d = abs($d) < $tiny ? $tiny : $d;
        $d = 1.0 / $d;
        $h = $d;
        for ($m = 1; $m <= 300; $m++) {
            $m2 = 2 * $m;
            $aa = $m * ($b - $m) * $x / (($qam + $m2) * ($a + $m2));
            $d = 1.0 + $aa * $d;
            $d = abs($d) < $tiny ? $tiny : $d;
            $c = 1.0 + $aa / $c;
            $c = abs($c) < $tiny ? $tiny : $c;
            $d = 1.0 / $d;
            $h *= $d * $c;
            $aa = -($a + $m) * ($qab + $m) * $x / (($a + $m2) * ($qap + $m2));
            $d = 1.0 + $aa * $d;
            $d = abs($d) < $tiny ? $tiny : $d;
            $c = 1.0 + $aa / $c;
            $c = abs($c) < $tiny ? $tiny : $c;
            $d = 1.0 / $d;
            $del = $d * $c;
            $h *= $del;
            if (abs($del - 1.0) < 3e-12) {
                break;
            }
        }
        return $h;
    }

    /** Two-sided p-value for a t statistic with df degrees of freedom. */
    public static function tPValue(float $t, float $df): float
    {
        if ($df <= 0) {
            return NAN;
        }
        return self::betaInc($df / ($df + $t * $t), $df / 2, 0.5);
    }

    /** Lower regularized gamma P(a,x). */
    public static function gammaP(float $a, float $x): float
    {
        if ($x <= 0) {
            return 0.0;
        }
        $gln = self::logGamma($a);
        if ($x < $a + 1) {
            $ap = $a;
            $sum = $del = 1.0 / $a;
            for ($n = 0; $n < 500; $n++) {
                $ap++;
                $del *= $x / $ap;
                $sum += $del;
                if (abs($del) < abs($sum) * 1e-14) {
                    break;
                }
            }
            return $sum * exp(-$x + $a * log($x) - $gln);
        }
        $b = $x + 1 - $a;
        $c = 1e300;
        $d = 1 / $b;
        $h = $d;
        for ($i = 1; $i < 500; $i++) {
            $an = -$i * ($i - $a);
            $b += 2;
            $d = $an * $d + $b;
            $d = abs($d) < 1e-300 ? 1e-300 : $d;
            $c = $b + $an / $c;
            $c = abs($c) < 1e-300 ? 1e-300 : $c;
            $d = 1 / $d;
            $del = $d * $c;
            $h *= $del;
            if (abs($del - 1) < 1e-14) {
                break;
            }
        }
        return 1.0 - exp(-$x + $a * log($x) - $gln) * $h;
    }

    public static function chi2PValue(float $stat, float $df): float
    {
        return 1.0 - self::gammaP($df / 2, $stat / 2);
    }

    // ---- small dense linear algebra --------------------------------------

    public static function transpose(array $m): array
    {
        return array_map(null, ...$m) ?: [];
    }

    /** Gauss–Jordan inverse with partial pivoting; returns null when singular. */
    public static function inverse(array $a): ?array
    {
        $n = count($a);
        $aug = [];
        for ($i = 0; $i < $n; $i++) {
            $aug[$i] = array_merge(array_values($a[$i]), array_fill(0, $n, 0.0));
            $aug[$i][$n + $i] = 1.0;
        }
        for ($col = 0; $col < $n; $col++) {
            $piv = $col;
            for ($r = $col + 1; $r < $n; $r++) {
                if (abs($aug[$r][$col]) > abs($aug[$piv][$col])) {
                    $piv = $r;
                }
            }
            if (abs($aug[$piv][$col]) < 1e-12) {
                return null;
            }
            [$aug[$col], $aug[$piv]] = [$aug[$piv], $aug[$col]];
            $p = $aug[$col][$col];
            for ($k = 0; $k < 2 * $n; $k++) {
                $aug[$col][$k] /= $p;
            }
            for ($r = 0; $r < $n; $r++) {
                if ($r === $col) {
                    continue;
                }
                $f = $aug[$r][$col];
                if ($f == 0.0) {
                    continue;
                }
                for ($k = 0; $k < 2 * $n; $k++) {
                    $aug[$r][$k] -= $f * $aug[$col][$k];
                }
            }
        }
        $inv = [];
        for ($i = 0; $i < $n; $i++) {
            $inv[$i] = array_slice($aug[$i], $n);
        }
        return $inv;
    }

    public static function matmul(array $a, array $b): array
    {
        $out = [];
        $bt = self::transpose($b);
        if (count($b) === 1) {
            $bt = array_map(static fn($v) => [$v], $b[0]);
        }
        foreach ($a as $i => $row) {
            foreach ($bt as $j => $col) {
                $s = 0.0;
                foreach ($row as $k => $v) {
                    $s += $v * $col[$k];
                }
                $out[$i][$j] = $s;
            }
        }
        return $out;
    }

    /**
     * Ordinary least squares (optionally ridge-penalised, intercept unpenalised)
     * with classical and HC1 robust standard errors.
     *
     * @param float[][] $X rows of regressors WITHOUT the intercept column
     * @param float[]   $y
     */
    public static function ols(array $X, array $y, float $lambda = 0.0): ?array
    {
        $n = count($y);
        if ($n === 0) {
            return null;
        }
        $Xd = [];
        foreach ($X as $i => $row) {
            $Xd[$i] = array_merge([1.0], array_map('floatval', array_values($row)));
        }
        $k = count($Xd[0]);
        if ($n <= $k) {
            return null;
        }
        $Xt = self::transpose($Xd);
        $XtX = self::matmul($Xt, $Xd);
        for ($j = 1; $j < $k; $j++) {
            $XtX[$j][$j] += $lambda;
        }
        $inv = self::inverse($XtX);
        if ($inv === null) {
            return null;
        }
        $Xty = [];
        foreach ($Xt as $j => $col) {
            $s = 0.0;
            foreach ($col as $i => $v) {
                $s += $v * $y[$i];
            }
            $Xty[$j] = $s;
        }
        $beta = [];
        for ($j = 0; $j < $k; $j++) {
            $s = 0.0;
            for ($m = 0; $m < $k; $m++) {
                $s += $inv[$j][$m] * $Xty[$m];
            }
            $beta[$j] = $s;
        }
        $fitted = [];
        $resid = [];
        $ssr = 0.0;
        $ym = self::mean($y);
        $sst = 0.0;
        foreach ($Xd as $i => $row) {
            $f = 0.0;
            foreach ($row as $j => $v) {
                $f += $v * $beta[$j];
            }
            $fitted[$i] = $f;
            $resid[$i] = $y[$i] - $f;
            $ssr += $resid[$i] ** 2;
            $sst += ($y[$i] - $ym) ** 2;
        }
        $df = $n - $k;
        $sigma2 = $ssr / $df;
        $se = [];
        $tstat = [];
        $pval = [];
        // HC1 robust covariance: (X'X)^-1 X' diag(e^2) X (X'X)^-1 * n/(n-k)
        $meat = array_fill(0, $k, array_fill(0, $k, 0.0));
        foreach ($Xd as $i => $row) {
            $e2 = $resid[$i] ** 2;
            for ($a = 0; $a < $k; $a++) {
                for ($b = 0; $b < $k; $b++) {
                    $meat[$a][$b] += $row[$a] * $row[$b] * $e2;
                }
            }
        }
        $robust = self::matmul(self::matmul($inv, $meat), $inv);
        $robustSe = [];
        for ($j = 0; $j < $k; $j++) {
            $se[$j] = sqrt(max(0.0, $sigma2 * $inv[$j][$j]));
            $robustSe[$j] = sqrt(max(0.0, $robust[$j][$j] * $n / $df));
            $tstat[$j] = $se[$j] > 0 ? $beta[$j] / $se[$j] : NAN;
            $pval[$j] = is_nan($tstat[$j]) ? NAN : self::tPValue($tstat[$j], $df);
        }
        $r2 = $sst > 0 ? 1 - $ssr / $sst : NAN;
        return [
            'beta' => $beta,
            'se' => $se,
            'robust_se' => $robustSe,
            't' => $tstat,
            'p' => $pval,
            'r2' => $r2,
            'adj_r2' => $sst > 0 ? 1 - (1 - $r2) * ($n - 1) / $df : NAN,
            'sigma' => sqrt($sigma2),
            'n' => $n,
            'k' => $k,
            'df' => $df,
            'fitted' => $fitted,
            'resid' => $resid,
            'xtx_inv' => $inv,
        ];
    }

    /** Durbin–Watson statistic on residuals (≈2 means no first-order autocorrelation). */
    public static function durbinWatson(array $resid): float
    {
        $num = 0.0;
        $den = 0.0;
        $n = count($resid);
        for ($i = 0; $i < $n; $i++) {
            $den += $resid[$i] ** 2;
            if ($i > 0) {
                $num += ($resid[$i] - $resid[$i - 1]) ** 2;
            }
        }
        return $den > 0 ? $num / $den : NAN;
    }

    /** Breusch–Pagan (Koenker n·R²) test: regress e² on X. */
    public static function breuschPagan(array $X, array $resid): ?array
    {
        $e2 = array_map(static fn($e) => $e * $e, $resid);
        $aux = self::ols($X, $e2);
        if ($aux === null) {
            return null;
        }
        $stat = $aux['n'] * max(0.0, $aux['r2']);
        $df = $aux['k'] - 1;
        return ['stat' => $stat, 'df' => $df, 'p' => self::chi2PValue($stat, $df)];
    }

    /** Variance inflation factor for each regressor column. */
    public static function vif(array $X): array
    {
        $k = count($X[0] ?? []);
        $out = [];
        for ($j = 0; $j < $k; $j++) {
            if ($k === 1) {
                $out[$j] = 1.0;
                continue;
            }
            $yj = array_map(static fn($r) => (float) $r[$j], $X);
            $Xo = array_map(static function ($r) use ($j) {
                $r = array_values($r);
                array_splice($r, $j, 1);
                return $r;
            }, $X);
            $fit = self::ols($Xo, $yj);
            $out[$j] = ($fit === null || $fit['r2'] >= 1) ? INF : 1 / (1 - $fit['r2']);
        }
        return $out;
    }
}
