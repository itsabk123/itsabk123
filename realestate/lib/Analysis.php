<?php
declare(strict_types=1);

namespace SS;

/**
 * Orchestrates a complete property evaluation from normalised inputs.
 * Output is a plain array that is stored as JSON (report_versions.result)
 * so a report always shows exactly what was computed, with the model versions.
 */
final class Analysis
{
    public const VERSION = '3.0.0';

    public static function params(array $v): array
    {
        $price = (float) $v['purchase_price'];
        $loan = $v['financing'] === 'mortgage' ? $price * (1 - $v['down_payment_pct'] / 100) : 0.0;
        $acq = $price * (($v['acq_tax_pct'] ?? 0) + ($v['brokerage_pct'] ?? 0)) / 100
            + ($v['legal_fees'] ?? 0) + $v['other_closing'] + ($loan > 0 ? $v['loan_fees'] : 0);
        $fixed = ($v['insurance_annual'] ?? 0) + ($v['property_tax_annual'] ?? 0) + ($v['service_charge_annual'] ?? 0)
            + $v['utilities_annual'] + $v['other_opex_annual'];
        return [
            'price' => $price,
            'acq_costs' => $acq,
            'renovation' => (float) $v['renovation'],
            'loan' => $loan,
            'rate' => $loan > 0 ? ($v['interest_rate_pct'] ?? 0) / 100 : 0.0,
            'term' => (int) $v['loan_term_years'],
            'io' => (int) $v['io_years'],
            'rent_m' => (float) ($v['monthly_rent'] ?? 0),
            'other_m' => (float) $v['other_income_monthly'],
            'vacancy' => $v['vacancy_pct'] / 100,
            'mgmt' => $v['management_pct'] / 100,
            'capex' => $v['capex_reserve_pct'] / 100,
            'fixed_opex' => $fixed,
            'maint' => $price * $v['maintenance_pct_value'] / 100,
            'rent_growth' => $v['rent_growth_pct'] / 100,
            'exp_growth' => $v['expense_growth_pct'] / 100,
            'appreciation' => $v['appreciation_pct'] / 100,
            'hold' => (int) $v['hold_years'],
            'sell_cost' => $v['selling_cost_pct'] / 100,
            'discount' => $v['discount_rate_pct'] / 100,
            'inflation' => $v['inflation_pct'] / 100,
            'opex_mult' => 1.0,
        ];
    }

    /** Named scenarios: explicit, published deltas applied to the base case. */
    public static function scenarioDefs(): array
    {
        return [
            'optimistic' => ['Optimistic', ['rent_m' => 1.05, 'vacancy' => -0.02, 'appreciation' => 0.02, 'rent_growth' => 0.01, 'opex_mult' => 0.95, 'rate' => -0.005]],
            'base' => ['Base case', []],
            'pessimistic' => ['Pessimistic', ['rent_m' => 0.92, 'vacancy' => 0.04, 'appreciation' => -0.02, 'rent_growth' => -0.01, 'opex_mult' => 1.10, 'rate' => 0.01]],
            'severe' => ['Severe downside', ['rent_m' => 0.80, 'vacancy' => 0.10, 'appreciation' => -0.05, 'rent_growth' => -0.02, 'opex_mult' => 1.25, 'rate' => 0.02, 'sell_cost' => 0.02]],
        ];
    }

    public static function applyDelta(array $p, array $d): array
    {
        foreach ($d as $k => $x) {
            if (in_array($k, ['rent_m', 'opex_mult', 'price'], true)) {
                $p[$k] *= $x;
            } elseif ($k === 'rate') {
                $p[$k] = $p['loan'] > 0 ? max(0.0, $p[$k] + $x) : $p[$k];
            } elseif ($k === 'vacancy') {
                $p[$k] = min(0.95, max(0.0, $p[$k] + $x));
            } else {
                $p[$k] += $x;
            }
        }
        if (isset($d['price'])) {
            // A different purchase price changes the loan and value-linked costs proportionally.
            $p['loan'] *= $d['price'];
            $p['maint'] *= $d['price'];
        }
        return $p;
    }

    public static function run(array $v, array $prov): array
    {
        $p = self::params($v);
        $base = Proforma::run($p);
        $target = $v['target_irr_pct'] / 100;

        // Scenarios
        $scen = [];
        foreach (self::scenarioDefs() as $key => [$label, $d]) {
            $r = Proforma::run(self::applyDelta($p, $d), true);
            $scen[$key] = ['label' => $label, 'delta' => $d, 'irr' => $r['irr'], 'npv' => $r['npv'], 'cf1' => $r['cf1'], 'coc' => $r['coc'], 'profit' => $r['total_profit'], 'em' => $r['equity_multiple'], 'dscr' => $r['dscr']];
        }

        // Tornado: one-at-a-time swings on IRR
        $swings = [
            ['Rent ±10%', ['rent_m' => 0.9], ['rent_m' => 1.1]],
            ['Purchase price ±10%', ['price' => 1.1], ['price' => 0.9]],
            ['Price change ±2 pts/yr', ['appreciation' => -0.02], ['appreciation' => 0.02]],
            ['Vacancy ±5 pts', ['vacancy' => 0.05], ['vacancy' => -0.05]],
            ['Operating costs ±15%', ['opex_mult' => 1.15], ['opex_mult' => 0.85]],
            ['Rent growth ±1 pt/yr', ['rent_growth' => -0.01], ['rent_growth' => 0.01]],
            ['Selling costs ±2 pts', ['sell_cost' => 0.02], ['sell_cost' => -0.02]],
        ];
        if ($p['loan'] > 0) {
            $swings[] = ['Interest rate ±1 pt', ['rate' => 0.01], ['rate' => -0.01]];
        }
        $tornado = [];
        foreach ($swings as [$label, $lo, $hi]) {
            $a = self::priceAdj($p, $lo);
            $b = self::priceAdj($p, $hi);
            $tornado[] = ['label' => $label, 'low' => Proforma::run($a, false)['irr'], 'high' => Proforma::run($b, false)['irr']];
        }
        usort($tornado, static fn($x, $y) => abs(($y['high'] ?? -1) - ($y['low'] ?? -1)) <=> abs(($x['high'] ?? -1) - ($x['low'] ?? -1)));

        // Sensitivity matrix: rent change × price change → IRR
        $rentSteps = [-0.2, -0.1, 0.0, 0.1, 0.2];
        $appSteps = [-0.04, -0.02, 0.0, 0.02, 0.04];
        $matrix = [];
        foreach ($appSteps as $as) {
            $row = [];
            foreach ($rentSteps as $rs) {
                $row[] = Proforma::run(self::applyDelta($p, ['rent_m' => 1 + $rs, 'appreciation' => $as]), false)['irr'];
            }
            $matrix[] = $row;
        }
        // Vacancy sensitivity → year-1 monthly cash flow
        $vacSens = [];
        foreach ([0, 0.05, 0.1, 0.15, 0.2, 0.3] as $vac) {
            $q = $p;
            $q['vacancy'] = $vac;
            $r = Proforma::run($q, false);
            $vacSens[] = ['vacancy' => $vac, 'cf_m' => $r['cf1'] / 12, 'irr' => $r['irr']];
        }

        // Bayesian rent + valuation from user comparables
        $askAdj = $v['asking_adjust_pct'] / 100;
        $bayes = Bayes::rent($p['rent_m'], $v['rent_sd_pct'] / 100 ?: 0.15, $v['comps'], $v['area_sqm'], $askAdj);
        $comps = Valuation::comps($v['comps'], $v['area_sqm'], $p['appreciation'], $askAdj);
        $hed = Valuation::hedonic($v['comps'], $v, $p['appreciation'], $askAdj);
        $income = ['available' => false];
        if ($v['market_cap_rate_pct']) {
            $iv = $base['noi1'] / ($v['market_cap_rate_pct'] / 100);
            $income = ['available' => true, 'value' => $iv, 'cap_rate' => $v['market_cap_rate_pct'] / 100];
        }
        $recon = Valuation::reconcile(['comparables' => $comps, 'hedonic' => $hed]);
        $valuation = ['comps' => $comps, 'hedonic' => $hed, 'income' => $income, 'reconciled' => $recon];
        if ($recon) {
            $valuation['asking_gap'] = ($v['asking_price'] - $recon['value']) / $recon['value'];
            $valuation['asking_z'] = ($v['asking_price'] - $recon['value']) / $recon['sd'];
        }

        // Monte Carlo — rent centred on the Bayesian posterior when evidence exists.
        $rentMean = $p['rent_m'];
        $rentSdAbs = $p['rent_m'] * $v['rent_sd_pct'] / 100;
        $rentSource = 'your estimate';
        if (!empty($bayes['available'])) {
            $rentMean = $bayes['posterior']['mean'];
            $rentSdAbs = sqrt($bayes['posterior']['sd'] ** 2 + ($rentMean * $v['rent_sd_pct'] / 100) ** 2 * 0.5);
            $rentSource = 'Bayesian posterior (your estimate updated with ' . $bayes['n'] . ' rental comparable' . ($bayes['n'] > 1 ? 's' : '') . ')';
        }
        $u = [
            'rent_mean' => $rentMean, 'rent_sd_abs' => $rentSdAbs, 'vac_sd' => $v['vacancy_sd_pts'] / 100,
            'app_sd' => $v['appreciation_sd_pts'] / 100, 'rg_sd' => $v['rent_growth_sd_pts'] / 100,
            'opex_sd' => $v['opex_sd_pct'] / 100, 'rate_sd' => $v['rate_sd_pts'] / 100,
        ];
        $fx = null;
        if ($v['investor_currency'] !== '' && $v['investor_currency'] !== $v['currency'] && $v['fx_rate']) {
            $fx = ['rate' => (float) $v['fx_rate'], 'vol' => $v['fx_vol_pct'] / 100];
        }
        $mc = $p['rent_m'] > 0 || $p['appreciation'] != 0
            ? MonteCarlo::run($p, $u, (int) $v['sims'], (int) $v['seed'], $target, $fx) + ['rent_source' => $rentSource, 'u' => $u]
            : null;

        $risk = self::risk($v, $p, $base, $mc, $scen);
        $conf = self::confidence($v, $prov, $comps, $bayes);
        $scores = Scoring::score($v, $base, $mc, $risk, $conf, $valuation);
        $checks = Assistant::checks($v, $prov, $base, $valuation);

        return [
            'engine' => self::VERSION,
            'models' => [Proforma::VERSION, MonteCarlo::VERSION, Bayes::VERSION, Valuation::VERSION, Scoring::VERSION],
            'computed_at' => gmdate('c'),
            'params' => $p,
            'base' => $base,
            'scenarios' => $scen,
            'tornado' => $tornado,
            'matrix' => ['rent' => $rentSteps, 'app' => $appSteps, 'irr' => $matrix],
            'vacancy_sens' => $vacSens,
            'bayes' => $bayes,
            'valuation' => $valuation,
            'mc' => $mc,
            'risk' => $risk,
            'confidence' => $conf,
            'scores' => $scores,
            'checks' => $checks,
            'fx' => $fx,
        ];
    }

    private static function priceAdj(array $p, array $d): array
    {
        return self::applyDelta($p, $d);
    }

    /** Risk register. Quantified where the inputs allow; otherwise explicitly "not assessed". */
    public static function risk(array $v, array $p, array $b, ?array $mc, array $scen): array
    {
        $r = [];
        $lvl = static fn(float $x, float $med, float $high) => $x >= $high ? 'high' : ($x >= $med ? 'medium' : 'low');
        $ltv = $b['ltv'];
        $r[] = ['Leverage', $p['loan'] > 0 ? $lvl($ltv, 0.6, 0.8) : 'low', $p['loan'] > 0 ? sprintf('Loan-to-value %.0f%%.', $ltv * 100) : 'No debt.'];
        if ($b['dscr'] !== null) {
            $r[] = ['Debt service', $b['dscr'] < 1.0 ? 'high' : ($b['dscr'] < 1.25 ? 'medium' : 'low'), sprintf('DSCR %.2f× (NOI ÷ debt payments). Below 1.0× means rent does not cover the loan.', $b['dscr'])];
        }
        if ($b['break_even_occ'] !== null) {
            $be = $b['break_even_occ'];
            $r[] = ['Vacancy', $be > 0.95 ? 'high' : ($be > 0.85 ? 'medium' : 'low'), sprintf('Break-even occupancy %.0f%% — occupancy needed for zero cash flow in year 1.', $be * 100)];
        }
        if ($p['loan'] > 0) {
            $up = self::applyDelta($p, ['rate' => 0.02]);
            $d = Proforma::run($up, false)['cf1'] - $b['cf1'];
            $r[] = ['Interest rate', $v['rate_type'] === 'variable' ? (-$d > 0.25 * max(1.0, abs($b['noi1'])) ? 'high' : 'medium') : 'low',
                sprintf('%s rate. +2 pts would change year-1 cash flow by %s per year.', ucfirst($v['rate_type']), Fmt::money($d, $v['currency']))];
        }
        $tier = Inputs::LIQUIDITY_TIER[$v['property_type']] ?? 3;
        $liq = $tier + ($v['liquidity_need'] === 'high' ? 1 : ($v['liquidity_need'] === 'medium' ? 0.5 : 0));
        $r[] = ['Liquidity', $liq >= 3 ? 'high' : ($liq >= 2 ? 'medium' : 'low'), 'Based on asset class (heuristic tier ' . $tier . ') and your stated liquidity need — not on local sales-volume data.'];
        if ($mc) {
            $r[] = ['Market (simulated)', $mc['p_loss'] > 0.25 ? 'high' : ($mc['p_loss'] > 0.10 ? 'medium' : 'low'),
                sprintf('%.0f%% of simulated paths lose money; 5%% worst-case loss (VaR95) %s.', $mc['p_loss'] * 100, Fmt::money($mc['var95'], $v['currency']))];
        }
        if ($v['investor_currency'] !== '' && $v['investor_currency'] !== $v['currency']) {
            $r[] = ['Currency', 'medium', 'Returns are earned in ' . $v['currency'] . ' but reported in ' . $v['investor_currency'] . '. FX moves can add or remove return.'];
        }
        if ($v['portfolio_share_pct'] !== null) {
            $s = $v['portfolio_share_pct'];
            $r[] = ['Concentration', $s > 50 ? 'high' : ($s > 25 ? 'medium' : 'low'), sprintf('This property would be %.0f%% of your wealth.', $s)];
        }
        if ($v['rent_basis'] === 'agent') {
            $r[] = ['Tenant / income evidence', 'medium', 'Rent is a seller/agent estimate — verify against signed leases or independent comparables.'];
        }
        if ($v['construction_status'] !== 'completed') {
            $r[] = ['Construction / delivery', 'high', 'Off-plan or under construction: completion delay, developer and specification risk apply.'];
        }
        if ($v['tenure'] === 'leasehold' && $v['lease_years_left'] !== null && $v['lease_years_left'] < 80) {
            $r[] = ['Lease length', $v['lease_years_left'] < 60 ? 'high' : 'medium', 'Short remaining leases can reduce value and mortgageability.'];
        }
        $map = [
            'flood_risk' => ['Environmental / climate', 'Flood or climate exposure'],
            'country_risk' => ['Political / country', 'Political and country risk'],
            'new_supply' => ['New supply', 'Competing new supply'],
        ];
        foreach ($map as $k => [$label, $desc]) {
            $val = $v[$k];
            $r[] = [$label, $val === 'unknown' ? 'not_assessed' : $val, $val === 'unknown' ? $desc . ' has not been checked. We do not estimate it without a verified dataset.' : $desc . ' reported as ' . $val . ' by you.'];
        }
        $reg = $v['rent_restrictions'];
        $r[] = ['Regulatory', $reg === 'unknown' ? 'not_assessed' : ($reg === 'significant' ? 'high' : ($reg === 'some' ? 'medium' : 'low')),
            $reg === 'unknown' ? 'Letting rules (licensing, rent controls, STR permits) not yet checked.' : 'Reported letting restrictions: ' . $reg . '.'];
        return array_map(static fn($x) => ['name' => $x[0], 'level' => $x[1], 'note' => $x[2]], $r);
    }

    /**
     * Data confidence with published components (0–100 each):
     *  inputs (35%), comparable evidence (30%), verification (20%), market data (15%).
     */
    public static function confidence(array $v, array $prov, array $comps, array $bayes): array
    {
        $key = ['purchase_price', 'monthly_rent', 'area', 'interest_rate_pct', 'acq_tax_pct', 'legal_fees', 'insurance_annual', 'property_tax_annual', 'service_charge_annual', 'vacancy_pct', 'appreciation_pct', 'maintenance_pct_value', 'management_pct', 'building_age'];
        if ($v['financing'] !== 'mortgage') {
            $key = array_diff($key, ['interest_rate_pct']);
        }
        $user = 0;
        foreach ($key as $k) {
            if (in_array($prov[$k] ?? 'missing', ['user', 'derived'], true)) {
                $user++;
            }
        }
        $inputs = 100 * $user / count($key);
        $nSale = $comps['n'] ?? 0;
        $nTxn = $comps['n_txn'] ?? 0;
        $nRent = $bayes['n'] ?? 0;
        $evidence = min(100, 12 * min($nSale, 6) + 6 * min($nTxn, 4) + 6 * min($nRent, 3));
        $verif = (($v['title_verified'] === 'yes') + ($v['zoning_verified'] === 'yes') + ($v['inspection_done'] === 'yes') + ($v['rent_basis'] === 'current')) * 25;
        $market = 0; // no integrated market dataset in this build
        $total = 0.35 * $inputs + 0.30 * $evidence + 0.20 * $verif + 0.15 * $market;
        return [
            'total' => $total,
            'band' => $total >= 70 ? 'High' : ($total >= 45 ? 'Moderate' : 'Low'),
            'components' => [
                ['Inputs you provided', $inputs, 0.35, sprintf('%d of %d key inputs entered by you (the rest use platform defaults or are missing).', $user, count($key))],
                ['Comparable evidence', $evidence, 0.30, sprintf('%d sale comparable(s) (%d completed transactions) and %d rental comparable(s).', $nSale, $nTxn, $nRent)],
                ['Verification', $verif, 0.20, 'Title check, zoning check, inspection and a signed lease each add 25.'],
                ['Market data', $market, 0.15, 'No licensed market dataset is integrated yet, so this is 0 for every property.'],
            ],
        ];
    }
}
