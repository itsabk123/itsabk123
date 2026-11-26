<?php
declare(strict_types=1);

namespace SS;

/**
 * Deterministic analysis assistant. It reads the inputs and the computed
 * results and produces: missing-information prompts, consistency warnings,
 * strengths/weaknesses, a due-diligence checklist and next steps.
 * It never changes a number and never invents data — it only points at
 * what the user has (or has not) told us.
 */
final class Assistant
{
    public static function checks(array $v, array $prov, array $b, array $val): array
    {
        $missing = [];
        $warn = [];
        $cur = $v['currency'];
        $schema = Inputs::schema();
        $important = [
            'acq_tax_pct' => 'Acquisition / transfer taxes can be a large upfront cost in many countries.',
            'legal_fees' => 'Legal and registration fees are not included.',
            'insurance_annual' => 'Insurance cost is not included.',
            'property_tax_annual' => 'Recurring property tax is not included (enter 0 if none applies).',
            'service_charge_annual' => 'Service / HOA charges are not included (enter 0 if none).',
            'area' => 'Without the area we cannot compare price per m² or run the comparable valuation.',
            'building_age' => 'Building age helps judge maintenance and the hedonic model.',
            'market_cap_rate_pct' => 'A market cap rate enables an income-approach valuation.',
            'budget' => 'With your budget we can check affordability.',
        ];
        foreach ($important as $k => $why) {
            if (($prov[$k] ?? '') === 'missing') {
                $missing[] = ['field' => $k, 'label' => $schema[$k]['label'], 'why' => $why];
            }
        }
        foreach ($prov as $k => $p) {
            if ($p === 'default' && !empty($schema[$k]['assumption'])) {
                $missing[] = ['field' => $k, 'label' => $schema[$k]['label'], 'why' => 'Using platform default (' . self::fmtDefault($schema[$k]) . '). ' . $schema[$k]['assumption'], 'default' => true];
            }
        }
        if (empty($v['comps'])) {
            $missing[] = ['field' => 'comps', 'label' => 'Comparable properties', 'why' => 'No comparables entered, so we cannot estimate fair value or test your rent estimate against evidence.'];
        }

        if ($b['gross_yield'] !== null && $b['gross_yield'] > 0.15 && $v['rental_mode'] === 'long_term') {
            $warn[] = sprintf('Gross yield of %.1f%% is unusually high for a long-term let. Double-check the rent and price (monthly vs annual?).', $b['gross_yield'] * 100);
        }
        if ($b['gross_yield'] !== null && $b['gross_yield'] > 0 && $b['gross_yield'] < 0.015) {
            $warn[] = sprintf('Gross yield of %.1f%% is very low. Is the rent monthly?', $b['gross_yield'] * 100);
        }
        if ($v['purchase_price'] > $v['asking_price'] * 1.0001) {
            $warn[] = 'Your purchase price is above the asking price.';
        }
        if ($v['appreciation_pct'] > 8) {
            $warn[] = 'An assumed price growth above 8% a year compounds quickly — make sure it is evidence-based, not extrapolated from a boom.';
        }
        if ($v['financing'] === 'mortgage' && $v['interest_rate_pct'] !== null && $v['interest_rate_pct'] < 0.5) {
            $warn[] = 'Interest rate below 0.5% — confirm this is an annual rate.';
        }
        if ($v['vacancy_pct'] == 0 && $v['rental_mode'] === 'long_term') {
            $warn[] = 'Zero vacancy assumes the property is never empty between tenants.';
        }
        if ($v['management_pct'] == 0 && $v['rental_mode'] === 'short_term') {
            $warn[] = 'Short-term lets usually need active management — 0% management fee assumes you will do it yourself.';
        }
        $rec = $val['reconciled'] ?? null;
        if ($rec && abs($val['asking_gap']) > 0.25) {
            $warn[] = sprintf('Asking price differs from the comparable evidence by %+.0f%%. Check that comparables are truly similar.', $val['asking_gap'] * 100);
        }
        if (!empty($val['hedonic']['available']) && !empty($val['comps']['available'])) {
            $d = abs($val['hedonic']['value'] - $val['comps']['value']) / $val['comps']['value'];
            if ($d > 0.2) {
                $warn[] = sprintf('The regression and comparable approaches disagree by %.0f%% — treat both valuations with caution.', $d * 100);
            }
        }
        if ($v['lease_years_left'] !== null && $v['tenure'] !== 'leasehold') {
            $warn[] = 'You entered leasehold years but tenure is not set to leasehold.';
        }

        $strengths = [];
        $weak = [];
        if ($b['cf1'] > 0) {
            $strengths[] = 'Positive year-1 cash flow of ' . Fmt::money($b['cf1'] / 12, $cur) . ' a month.';
        } else {
            $weak[] = 'Negative year-1 cash flow (' . Fmt::money($b['cf1'] / 12, $cur) . ' a month) — you would fund the shortfall.';
        }
        if ($b['dscr'] !== null) {
            if ($b['dscr'] >= 1.25) {
                $strengths[] = sprintf('Comfortable debt cover (DSCR %.2f×).', $b['dscr']);
            } elseif ($b['dscr'] < 1.0) {
                $weak[] = sprintf('Rent does not cover the loan (DSCR %.2f×).', $b['dscr']);
            }
        }
        if ($b['irr'] !== null && $b['irr'] >= $v['target_irr_pct'] / 100) {
            $strengths[] = sprintf('Base-case IRR %.1f%% meets your %.1f%% target.', $b['irr'] * 100, $v['target_irr_pct']);
        } elseif ($b['irr'] !== null) {
            $weak[] = sprintf('Base-case IRR %.1f%% is below your %.1f%% target.', $b['irr'] * 100, $v['target_irr_pct']);
        }
        if ($b['npv'] > 0) {
            $strengths[] = 'Positive NPV at your ' . $v['discount_rate_pct'] . '% discount rate.';
        } else {
            $weak[] = 'Negative NPV at your ' . $v['discount_rate_pct'] . '% discount rate — returns are below your required return.';
        }
        if ($rec) {
            if ($val['asking_gap'] < -0.03) {
                $strengths[] = sprintf('Asking price is %.0f%% below the comparable evidence.', -$val['asking_gap'] * 100);
            } elseif ($val['asking_gap'] > 0.05) {
                $weak[] = sprintf('Asking price is %.0f%% above the comparable evidence — room to negotiate?', $val['asking_gap'] * 100);
            }
        }
        if ($b['break_even_occ'] !== null && $b['break_even_occ'] > 0.9) {
            $weak[] = sprintf('Little margin for empty months: break-even occupancy is %.0f%%.', $b['break_even_occ'] * 100);
        }

        return [
            'missing' => $missing,
            'warnings' => $warn,
            'strengths' => $strengths,
            'weaknesses' => $weak,
            'checklist' => self::checklist($v),
            'next_steps' => self::nextSteps($v, $missing, $val),
            'questions' => self::questions($v, $prov),
        ];
    }

    private static function fmtDefault(array $def): string
    {
        $d = $def['default'];
        return $def['type'] === 'percent' ? $d . '%' : (string) $d;
    }

    public static function checklist(array $v): array
    {
        $c = [
            ['Title & ownership', 'Have a qualified local lawyer confirm title, encumbrances, liens and the seller\'s right to sell.', $v['title_verified'] === 'yes'],
            ['Permitted use & zoning', 'Confirm the intended use (and any short-term letting) is permitted.', $v['zoning_verified'] === 'yes'],
            ['Physical condition', 'Commission an independent survey / inspection; price any defects into renovation costs.', $v['inspection_done'] === 'yes'],
            ['Rent evidence', 'Obtain signed leases, payment history, or at least three independent rental comparables.', $v['rent_basis'] === 'current'],
            ['Taxes on purchase, holding and sale', 'Confirm stamp/transfer duty, property tax, rental income tax and capital gains tax for your buyer status with a tax adviser.', false],
            ['Financing terms', 'Get a written offer: rate, fees, reset terms, early-repayment penalties.', false],
            ['Service charges & building health', 'Request service-charge history, sinking-fund balance and planned major works.', false],
            ['Insurance', 'Get a quote covering building, landlord liability and loss of rent.', false],
            ['Environmental & climate', 'Check official flood maps and any environmental reports for the site.', $v['flood_risk'] !== 'unknown'],
            ['Exit plan', 'Understand how long similar properties take to sell and who the buyers are.', false],
        ];
        if ($v['construction_status'] !== 'completed') {
            $c[] = ['Developer & escrow', 'Verify developer track record, escrow/project-account protection and completion guarantees.', false];
        }
        if ($v['tenure'] === 'leasehold') {
            $c[] = ['Lease terms', 'Review ground rent, lease length and extension costs.', false];
        }
        if ($v['investor_currency'] !== '' && $v['investor_currency'] !== $v['currency']) {
            $c[] = ['Foreign ownership & FX', 'Confirm foreign-buyer rules, repatriation of rent and sale proceeds, and FX hedging options.', false];
        }
        if ($v['rental_mode'] === 'short_term') {
            $c[] = ['Short-term letting licence', 'Check holiday-let licensing, night caps and building rules.', false];
        }
        return array_map(static fn($x) => ['item' => $x[0], 'detail' => $x[1], 'done' => (bool) $x[2]], $c);
    }

    private static function nextSteps(array $v, array $missing, array $val): array
    {
        $s = [];
        $hard = array_filter($missing, static fn($m) => empty($m['default']));
        if ($hard) {
            $s[] = 'Fill in the ' . count($hard) . ' missing input(s) listed below and re-run the report.';
        }
        if (empty($val['comps']['available'])) {
            $s[] = 'Add at least three recent sale comparables (completed transactions where possible) to get an indicative value.';
        }
        $s[] = 'Replace the platform default assumptions with local figures from your agent, lender and tax adviser.';
        $s[] = 'Work through the due-diligence checklist before making a binding offer.';
        return $s;
    }

    private static function questions(array $v, array $prov): array
    {
        $q = [];
        if ($v['rent_basis'] !== 'current') {
            $q[] = 'Is the property currently tenanted? If so, what does the lease say about rent and renewal?';
        }
        if ($prov['service_charge_annual'] === 'missing' && in_array($v['property_type'], ['apartment', 'townhouse', 'mixed_use'], true)) {
            $q[] = 'What are the annual service charges, and how have they changed over the last three years?';
        }
        if ($v['building_age'] === null) {
            $q[] = 'When was the building completed, and when were major systems last replaced?';
        }
        if ($v['financing'] === 'mortgage' && $v['rate_type'] === 'variable') {
            $q[] = 'How often can the rate reset, and is there a cap?';
        }
        return $q;
    }
}

final class Fmt
{
    public static function money(?float $x, string $cur, int $dp = 0): string
    {
        if ($x === null || is_nan($x)) {
            return '—';
        }
        $neg = $x < 0 ? '−' : '';
        return $neg . $cur . ' ' . number_format(abs($x), $dp);
    }

    public static function pct(?float $x, int $dp = 1, bool $sign = false): string
    {
        if ($x === null || is_nan($x) || !is_finite($x)) {
            return '—';
        }
        $s = number_format($x * 100, $dp) . '%';
        if ($x < 0) {
            return '−' . ltrim($s, '-');
        }
        return ($sign ? '+' : '') . $s;
    }

    public static function num(?float $x, int $dp = 2): string
    {
        return ($x === null || is_nan($x)) ? '—' : number_format($x, $dp);
    }

    public static function short(?float $x, string $cur = ''): string
    {
        if ($x === null) {
            return '—';
        }
        $a = abs($x);
        $s = $a >= 1e9 ? number_format($a / 1e9, 1) . 'B' : ($a >= 1e6 ? number_format($a / 1e6, 1) . 'M' : ($a >= 1e4 ? number_format($a / 1e3, 0) . 'k' : number_format($a, 0)));
        return ($x < 0 ? '−' : '') . ($cur ? $cur . ' ' : '') . $s;
    }
}
