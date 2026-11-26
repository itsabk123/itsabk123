<?php
declare(strict_types=1);

namespace SS;

/**
 * Deterministic property-finance functions. Rates are decimals (0.06 = 6%).
 * Every function is independently tested in tests/run.php.
 */
final class Finance
{
    /** Level periodic payment for a fully amortising loan. Zero-rate safe. */
    public static function pmt(float $ratePerPeriod, int $periods, float $principal): float
    {
        if ($periods <= 0 || $principal <= 0) {
            return 0.0;
        }
        if (abs($ratePerPeriod) < 1e-12) {
            return $principal / $periods;
        }
        $f = (1 + $ratePerPeriod) ** $periods;
        return $principal * $ratePerPeriod * $f / ($f - 1);
    }

    /** Outstanding balance after $paid payments. */
    public static function balance(float $ratePerPeriod, int $periods, float $principal, int $paid): float
    {
        if ($principal <= 0) {
            return 0.0;
        }
        if ($paid >= $periods) {
            return 0.0;
        }
        if (abs($ratePerPeriod) < 1e-12) {
            return $principal * (1 - $paid / $periods);
        }
        $p = self::pmt($ratePerPeriod, $periods, $principal);
        $f = (1 + $ratePerPeriod) ** $paid;
        return max(0.0, $principal * $f - $p * ($f - 1) / $ratePerPeriod);
    }

    /**
     * Annual amortisation summary for a monthly-pay loan.
     * Interest-only for the first $ioYears, then amortising over the remaining term.
     *
     * @return array<int, array{year:int, payment:float, interest:float, principal:float, balance:float}>
     */
    public static function amortisationByYear(float $annualRate, int $termYears, float $principal, int $ioYears = 0, ?int $years = null): array
    {
        $r = $annualRate / 12;
        $years = $years ?? $termYears;
        $amortMonths = max(1, ($termYears - $ioYears) * 12);
        $pay = self::pmt($r, $amortMonths, $principal);
        $bal = $principal;
        $out = [];
        $month = 0;
        for ($y = 1; $y <= $years; $y++) {
            $int = 0.0;
            $prin = 0.0;
            $paid = 0.0;
            for ($m = 0; $m < 12; $m++) {
                $month++;
                if ($bal <= 1e-9 || $month > $termYears * 12) {
                    continue;
                }
                $i = $bal * $r;
                if ($month <= $ioYears * 12) {
                    $p = 0.0;
                    $pmt = $i;
                } else {
                    $pmt = min($pay, $bal + $i);
                    $p = $pmt - $i;
                }
                $bal -= $p;
                $int += $i;
                $prin += $p;
                $paid += $pmt;
            }
            $out[] = ['year' => $y, 'payment' => $paid, 'interest' => $int, 'principal' => $prin, 'balance' => max(0.0, $bal)];
        }
        return $out;
    }

    /** NPV where $cf[0] occurs today (undiscounted) and $cf[t] at end of period t. */
    public static function npv(float $rate, array $cf): float
    {
        $v = 0.0;
        foreach (array_values($cf) as $t => $c) {
            $v += $c / ((1 + $rate) ** $t);
        }
        return $v;
    }

    /**
     * IRR by Newton–Raphson with a bracketing bisection fallback.
     * Returns null when no sign change exists (IRR undefined) or no root in [-99.99%, 1000%].
     */
    public static function irr(array $cf, float $guess = 0.1): ?float
    {
        $cf = array_values($cf);
        $hasPos = false;
        $hasNeg = false;
        foreach ($cf as $c) {
            if ($c > 0) {
                $hasPos = true;
            } elseif ($c < 0) {
                $hasNeg = true;
            }
        }
        if (!$hasPos || !$hasNeg) {
            return null;
        }
        $r = $guess;
        for ($i = 0; $i < 50; $i++) {
            $f = 0.0;
            $d = 0.0;
            foreach ($cf as $t => $c) {
                $den = (1 + $r) ** $t;
                $f += $c / $den;
                $d -= $t * $c / ($den * (1 + $r));
            }
            if (abs($f) < 1e-9) {
                return $r;
            }
            if ($d == 0.0) {
                break;
            }
            $next = $r - $f / $d;
            if (!is_finite($next) || $next <= -0.9999) {
                break;
            }
            if (abs($next - $r) < 1e-12) {
                return $next;
            }
            $r = $next;
        }
        // Bisection fallback over a wide bracket.
        $lo = -0.9999;
        $hi = 10.0;
        $flo = self::npv($lo, $cf);
        $fhi = self::npv($hi, $cf);
        if ($flo * $fhi > 0) {
            return null;
        }
        for ($i = 0; $i < 200; $i++) {
            $mid = ($lo + $hi) / 2;
            $fm = self::npv($mid, $cf);
            if (abs($fm) < 1e-9 || ($hi - $lo) < 1e-12) {
                return $mid;
            }
            if ($flo * $fm < 0) {
                $hi = $mid;
            } else {
                $lo = $mid;
                $flo = $fm;
            }
        }
        return ($lo + $hi) / 2;
    }

    /** Modified IRR: negatives discounted at finance rate, positives compounded at reinvestment rate. */
    public static function mirr(array $cf, float $financeRate, float $reinvestRate): ?float
    {
        $cf = array_values($cf);
        $n = count($cf) - 1;
        if ($n < 1) {
            return null;
        }
        $pvNeg = 0.0;
        $fvPos = 0.0;
        foreach ($cf as $t => $c) {
            if ($c < 0) {
                $pvNeg += $c / ((1 + $financeRate) ** $t);
            } else {
                $fvPos += $c * ((1 + $reinvestRate) ** ($n - $t));
            }
        }
        if ($pvNeg >= 0 || $fvPos <= 0) {
            return null;
        }
        return ($fvPos / -$pvNeg) ** (1 / $n) - 1;
    }

    /** Total cash returned / total cash invested. */
    public static function equityMultiple(array $cf): ?float
    {
        $in = 0.0;
        $out = 0.0;
        foreach ($cf as $c) {
            if ($c < 0) {
                $in += -$c;
            } else {
                $out += $c;
            }
        }
        return $in > 0 ? $out / $in : null;
    }

    /** Real (inflation-adjusted) rate via Fisher: (1+n)/(1+i) - 1. */
    public static function realRate(float $nominal, float $inflation): float
    {
        return (1 + $nominal) / (1 + $inflation) - 1;
    }

    /** Compound annual growth rate. */
    public static function cagr(float $start, float $end, float $years): ?float
    {
        if ($start <= 0 || $end <= 0 || $years <= 0) {
            return null;
        }
        return ($end / $start) ** (1 / $years) - 1;
    }

    /** Maximum loan principal serviceable by a monthly payment. */
    public static function principalFromPayment(float $annualRate, int $termYears, float $monthlyPayment): float
    {
        $n = $termYears * 12;
        $r = $annualRate / 12;
        if ($n <= 0 || $monthlyPayment <= 0) {
            return 0.0;
        }
        if (abs($r) < 1e-12) {
            return $monthlyPayment * $n;
        }
        return $monthlyPayment * (1 - (1 + $r) ** -$n) / $r;
    }
}
