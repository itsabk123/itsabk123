<?php
declare(strict_types=1);

namespace SS;

/**
 * Explainable multi-criteria scoring.
 *
 * Each dimension maps a metric to 0–100 through a published piecewise-linear
 * curve. Dimensions are combined with objective-specific weights, then
 * "gates" cap the overall fit when a hard constraint fails (e.g. negative
 * DSCR, budget exceeded) — so a single fatal weakness cannot be averaged away.
 * Data confidence is reported alongside, never blended in.
 */
final class Scoring
{
    public const VERSION = 'mcda-1.0.0';

    /** Linear interpolation through [x, score] anchor points. */
    public static function curve(?float $x, array $pts): ?float
    {
        if ($x === null || is_nan($x)) {
            return null;
        }
        if ($x <= $pts[0][0]) {
            return (float) $pts[0][1];
        }
        for ($i = 1, $n = count($pts); $i < $n; $i++) {
            if ($x <= $pts[$i][0]) {
                [$x0, $y0] = $pts[$i - 1];
                [$x1, $y1] = $pts[$i];
                return $y0 + ($y1 - $y0) * ($x - $x0) / ($x1 - $x0);
            }
        }
        return (float) end($pts)[1];
    }

    public const CURVES = [
        'irr' => [[-0.05, 0], [0.0, 15], [0.05, 45], [0.08, 65], [0.12, 85], [0.18, 100]],
        'coc' => [[-0.05, 0], [0.0, 25], [0.04, 55], [0.08, 80], [0.12, 100]],
        'net_yield' => [[0.0, 0], [0.02, 25], [0.04, 50], [0.06, 75], [0.08, 100]],
        'dscr' => [[0.8, 0], [1.0, 30], [1.25, 65], [1.5, 85], [2.0, 100]],
        'p_loss' => [[0.0, 100], [0.05, 85], [0.15, 60], [0.30, 30], [0.5, 0]],
        'break_even' => [[0.5, 100], [0.7, 85], [0.85, 60], [0.95, 30], [1.05, 0]],
        'value_gap' => [[-0.15, 100], [-0.05, 80], [0.0, 65], [0.05, 45], [0.15, 15], [0.3, 0]],
    ];

    /** Objective weights over dimensions (each row sums to 1). */
    public const WEIGHTS = [
        'cash_flow' => ['income' => 0.40, 'return' => 0.20, 'resilience' => 0.30, 'value' => 0.10],
        'retirement' => ['income' => 0.40, 'return' => 0.15, 'resilience' => 0.35, 'value' => 0.10],
        'str_income' => ['income' => 0.40, 'return' => 0.25, 'resilience' => 0.25, 'value' => 0.10],
        'commercial_yield' => ['income' => 0.40, 'return' => 0.20, 'resilience' => 0.30, 'value' => 0.10],
        'appreciation' => ['income' => 0.10, 'return' => 0.45, 'resilience' => 0.20, 'value' => 0.25],
        'flip' => ['income' => 0.05, 'return' => 0.40, 'resilience' => 0.20, 'value' => 0.35],
        'land_bank' => ['income' => 0.05, 'return' => 0.40, 'resilience' => 0.25, 'value' => 0.30],
        'development' => ['income' => 0.05, 'return' => 0.45, 'resilience' => 0.25, 'value' => 0.25],
        'wealth' => ['income' => 0.25, 'return' => 0.35, 'resilience' => 0.25, 'value' => 0.15],
        'diversification' => ['income' => 0.25, 'return' => 0.25, 'resilience' => 0.35, 'value' => 0.15],
    ];

    public static function score(array $v, array $b, ?array $mc, array $risk, array $conf, array $val, ?array $customWeights = null): array
    {
        $dims = [];
        $income = array_filter([
            self::curve($b['coc'], self::CURVES['coc']),
            self::curve($b['net_yield'], self::CURVES['net_yield']),
        ], static fn($x) => $x !== null);
        $dims['income'] = ['Income', $income ? array_sum($income) / count($income) : null, 'Average of cash-on-cash and net-yield curves.'];
        $dims['return'] = ['Total return', self::curve($b['irr'], self::CURVES['irr']), 'Base-case IRR on the published curve.'];
        $res = array_filter([
            $mc ? self::curve($mc['p_loss'], self::CURVES['p_loss']) : null,
            $b['dscr'] !== null ? self::curve($b['dscr'], self::CURVES['dscr']) : null,
            self::curve($b['break_even_occ'], self::CURVES['break_even']),
        ], static fn($x) => $x !== null);
        $dims['resilience'] = ['Resilience', $res ? array_sum($res) / count($res) : null, 'Probability of loss, debt cover and break-even occupancy.'];
        $gap = $val['asking_gap'] ?? null;
        $dims['value'] = ['Price vs evidence', $gap === null ? null : self::curve($gap, self::CURVES['value_gap']), $gap === null ? 'Not rated — needs comparables.' : 'Asking price vs reconciled comparable value.'];

        $w = $customWeights ?? (self::WEIGHTS[$v['objective']] ?? self::WEIGHTS['wealth']);
        // Re-normalise over dimensions that could be rated (never treat "unrated" as a score).
        $sum = 0.0;
        $tot = 0.0;
        foreach ($dims as $k => $d) {
            if ($d[1] !== null) {
                $sum += $w[$k] * $d[1];
                $tot += $w[$k];
            }
        }
        $raw = $tot > 0 ? $sum / $tot : null;
        $gates = [];
        $cap = 100.0;
        if ($b['dscr'] !== null && $b['dscr'] < 1.0) {
            $gates[] = 'Rent does not cover debt payments (DSCR < 1.0×): fit capped at 40.';
            $cap = min($cap, 40);
        }
        if ($b['irr'] !== null && $b['irr'] < 0) {
            $gates[] = 'Base-case IRR is negative: fit capped at 30.';
            $cap = min($cap, 30);
        }
        if ($v['budget'] !== null && $b['equity0'] > $v['budget'] * 1.0001) {
            $gates[] = 'Required equity exceeds your stated budget: fit capped at 35.';
            $cap = min($cap, 35);
        }
        if (in_array($v['objective'], ['cash_flow', 'retirement', 'str_income', 'commercial_yield'], true) && $b['cf1'] < 0) {
            $gates[] = 'Your objective is income but year-1 cash flow is negative: fit capped at 45.';
            $cap = min($cap, 45);
        }
        if ($v['risk_tolerance'] === 'conservative' && $mc && $mc['p_loss'] > 0.2) {
            $gates[] = 'Conservative risk tolerance but >20% of simulations lose money: fit capped at 45.';
            $cap = min($cap, 45);
        }
        if ($v['liquidity_need'] === 'high' && $v['hold_years'] > 3) {
            $gates[] = 'High liquidity need with a multi-year hold: property is an illiquid asset.';
        }
        $overall = $raw === null ? null : min($raw, $cap);
        $band = $overall === null ? 'Insufficient data' : ($overall >= 70 ? 'Strong fit' : ($overall >= 50 ? 'Moderate fit' : ($overall >= 35 ? 'Weak fit' : 'Poor fit')));
        $highRisks = count(array_filter($risk, static fn($r) => $r['level'] === 'high'));
        $notAssessed = count(array_filter($risk, static fn($r) => $r['level'] === 'not_assessed'));
        return [
            'version' => self::VERSION,
            'dimensions' => $dims,
            'weights' => $w,
            'raw' => $raw,
            'overall' => $overall,
            'band' => $band,
            'gates' => $gates,
            'objective' => $v['objective'],
            'risk_rating' => $highRisks >= 3 ? 'Elevated' : ($highRisks >= 1 ? 'Moderate' : 'Contained'),
            'risk_high' => $highRisks,
            'risk_not_assessed' => $notAssessed,
            'market_rating' => 'Not rated — no verified market dataset integrated',
            'data_rating' => $conf['band'],
        ];
    }
}
