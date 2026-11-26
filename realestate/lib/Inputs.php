<?php
declare(strict_types=1);

namespace SS;

/**
 * Single source of truth for every evaluation input: the form, server-side
 * validation, the API, defaults and provenance all read this schema.
 *
 * A "default" is a platform ASSUMPTION, never market data. Any value that
 * falls back to a default is tagged provenance=default and surfaced in the
 * report so the user can replace it with local figures.
 */
final class Inputs
{
    public const PROPERTY_TYPES = [
        'apartment' => 'Apartment / condo', 'house' => 'House / villa', 'townhouse' => 'Townhouse',
        'multifamily' => 'Multifamily (2+ units)', 'student' => 'Student accommodation', 'senior' => 'Senior living',
        'short_term' => 'Short-term rental unit', 'office' => 'Office', 'retail' => 'Retail', 'industrial' => 'Industrial',
        'warehouse' => 'Warehouse / logistics', 'hospitality' => 'Hospitality', 'mixed_use' => 'Mixed-use',
        'land' => 'Land', 'agricultural' => 'Agricultural', 'other' => 'Other',
    ];

    /** Rough liquidity tier by asset class — a qualitative heuristic, documented as such. */
    public const LIQUIDITY_TIER = [
        'apartment' => 1, 'house' => 1, 'townhouse' => 1, 'short_term' => 2, 'multifamily' => 2, 'student' => 2,
        'senior' => 3, 'office' => 2, 'retail' => 2, 'industrial' => 2, 'warehouse' => 2, 'hospitality' => 3,
        'mixed_use' => 2, 'land' => 3, 'agricultural' => 3, 'other' => 3,
    ];

    public const OBJECTIVES = [
        'cash_flow' => 'Monthly cash flow', 'appreciation' => 'Capital appreciation', 'wealth' => 'Long-term wealth',
        'retirement' => 'Retirement income', 'diversification' => 'Portfolio diversification', 'development' => 'Development',
        'flip' => 'Flipping', 'str_income' => 'Short-term rental income', 'commercial_yield' => 'Commercial yield',
        'land_bank' => 'Land banking',
    ];

    public const TRI = ['unknown' => 'Unknown / not checked', 'low' => 'Low', 'medium' => 'Medium', 'high' => 'High'];

    public static function schema(): array
    {
        $tri = self::TRI;
        $f = [];
        // A. Identity
        $f['country'] = ['A', 'select', 'Country', null, ['options' => Countries::options(), 'required' => true]];
        $f['city'] = ['A', 'text', 'City', '', ['max' => 80]];
        $f['district'] = ['A', 'text', 'District / neighbourhood', '', ['max' => 80]];
        $f['address'] = ['A', 'text', 'Street or approximate location', '', ['max' => 160, 'help' => 'Optional. Not shown on public reports.', 'private' => true]];
        $f['lat'] = ['A', 'number', 'Latitude', null, ['min' => -90, 'max' => 90, 'private' => true]];
        $f['lng'] = ['A', 'number', 'Longitude', null, ['min' => -180, 'max' => 180, 'private' => true]];
        $f['property_type'] = ['A', 'select', 'Property type', 'apartment', ['options' => self::PROPERTY_TYPES, 'required' => true]];
        $f['subtype'] = ['A', 'text', 'Subtype / description', '', ['max' => 80]];
        $f['project_name'] = ['A', 'text', 'Development / project name', '', ['max' => 120]];
        $f['construction_status'] = ['A', 'select', 'Construction status', 'completed', ['options' => ['completed' => 'Completed', 'under_construction' => 'Under construction', 'off_plan' => 'Off-plan']]];

        // B. Characteristics
        $f['currency'] = ['B', 'select', 'Property currency', null, ['options' => Countries::currencyOptions(), 'required' => true]];
        $f['asking_price'] = ['B', 'money', 'Asking price', null, ['min' => 1, 'required' => true]];
        $f['purchase_price'] = ['B', 'money', 'Expected purchase price', null, ['min' => 1, 'help' => 'Leave blank to use the asking price.']];
        $f['area'] = ['B', 'number', 'Built-up / internal area', null, ['min' => 1]];
        $f['area_unit'] = ['B', 'select', 'Area unit', 'sqm', ['options' => ['sqm' => 'm²', 'sqft' => 'ft²']]];
        $f['plot_area'] = ['B', 'number', 'Plot area (same unit)', null, ['min' => 0]];
        $f['bedrooms'] = ['B', 'int', 'Bedrooms', null, ['min' => 0, 'max' => 200]];
        $f['bathrooms'] = ['B', 'int', 'Bathrooms', null, ['min' => 0, 'max' => 200]];
        $f['building_age'] = ['B', 'int', 'Building age (years)', null, ['min' => 0, 'max' => 500]];
        $f['condition'] = ['B', 'select', 'Condition', 'good', ['options' => ['new' => 'New', 'good' => 'Good', 'fair' => 'Fair', 'renovation' => 'Needs renovation']]];
        $f['furnishing'] = ['B', 'select', 'Furnishing', 'unfurnished', ['options' => ['unfurnished' => 'Unfurnished', 'part' => 'Part-furnished', 'furnished' => 'Furnished']]];
        $f['parking'] = ['B', 'int', 'Parking spaces', null, ['min' => 0, 'max' => 1000]];
        $f['tenure'] = ['B', 'select', 'Title / tenure', 'unknown', ['options' => ['unknown' => 'Unknown', 'freehold' => 'Freehold', 'leasehold' => 'Leasehold', 'usufruct' => 'Usufruct / right of use', 'other' => 'Other']]];
        $f['lease_years_left'] = ['B', 'int', 'Leasehold years remaining', null, ['min' => 0, 'max' => 999]];

        // C. Financing & costs
        $f['financing'] = ['C', 'select', 'Financing', 'mortgage', ['options' => ['mortgage' => 'Mortgage / loan', 'cash' => 'All cash']]];
        $f['down_payment_pct'] = ['C', 'percent', 'Down payment', 25.0, ['min' => 0, 'max' => 100, 'assumption' => 'Common lender requirement range; verify with your lender.']];
        $f['interest_rate_pct'] = ['C', 'percent', 'Interest rate (annual)', null, ['min' => 0, 'max' => 40, 'help' => 'Required for a mortgage — use the rate you have been quoted.']];
        $f['rate_type'] = ['C', 'select', 'Rate type', 'fixed', ['options' => ['fixed' => 'Fixed', 'variable' => 'Variable']]];
        $f['loan_term_years'] = ['C', 'int', 'Loan term (years)', 25, ['min' => 1, 'max' => 40, 'assumption' => 'Typical term; check the term you are offered.']];
        $f['io_years'] = ['C', 'int', 'Interest-only period (years)', 0, ['min' => 0, 'max' => 40]];
        $f['loan_fees'] = ['C', 'money', 'Loan arrangement fees', 0.0, ['min' => 0]];
        $f['acq_tax_pct'] = ['C', 'percent', 'Acquisition / transfer tax', null, ['min' => 0, 'max' => 30, 'help' => 'Stamp duty, transfer or registration fee. Varies by country and buyer status.']];
        $f['legal_fees'] = ['C', 'money', 'Legal / conveyancing fees', null, ['min' => 0]];
        $f['brokerage_pct'] = ['C', 'percent', 'Buyer brokerage', null, ['min' => 0, 'max' => 10]];
        $f['other_closing'] = ['C', 'money', 'Other closing costs', 0.0, ['min' => 0]];
        $f['renovation'] = ['C', 'money', 'Renovation / initial capex', 0.0, ['min' => 0]];
        $f['insurance_annual'] = ['C', 'money', 'Insurance (annual)', null, ['min' => 0]];
        $f['property_tax_annual'] = ['C', 'money', 'Property tax (annual)', null, ['min' => 0]];
        $f['service_charge_annual'] = ['C', 'money', 'Service / HOA charges (annual)', null, ['min' => 0]];
        $f['maintenance_pct_value'] = ['C', 'percent', 'Maintenance (% of value / yr)', 1.0, ['min' => 0, 'max' => 10, 'assumption' => 'Rule-of-thumb only; older or larger buildings often cost more.']];
        $f['management_pct'] = ['C', 'percent', 'Management fee (% of collected rent)', 8.0, ['min' => 0, 'max' => 40, 'assumption' => 'Placeholder; set 0 if self-managing.']];
        $f['utilities_annual'] = ['C', 'money', 'Owner-paid utilities (annual)', 0.0, ['min' => 0]];
        $f['other_opex_annual'] = ['C', 'money', 'Other operating costs (annual)', 0.0, ['min' => 0]];
        $f['capex_reserve_pct'] = ['C', 'percent', 'Capex reserve (% of rent)', 0.0, ['min' => 0, 'max' => 30]];

        // D. Rental
        $f['rental_mode'] = ['D', 'select', 'Rental strategy', 'long_term', ['options' => ['long_term' => 'Long-term let', 'short_term' => 'Short-term / holiday let', 'owner_occupied' => 'Owner-occupied (no rent)']]];
        $f['monthly_rent'] = ['D', 'money', 'Monthly rent', null, ['min' => 0, 'help' => 'Current rent if tenanted, otherwise your expected market rent.']];
        $f['rent_basis'] = ['D', 'select', 'Rent figure is', 'expected', ['options' => ['current' => 'Current contracted rent', 'expected' => 'Expected market rent', 'agent' => 'Agent / seller estimate']]];
        $f['nightly_rate'] = ['D', 'money', 'Average nightly rate (STR)', null, ['min' => 0]];
        $f['str_occupancy_pct'] = ['D', 'percent', 'Occupancy (STR)', null, ['min' => 0, 'max' => 100]];
        $f['str_fees_pct'] = ['D', 'percent', 'Platform & cleaning fees (% of revenue, STR)', 15.0, ['min' => 0, 'max' => 60, 'assumption' => 'Placeholder for platform + cleaning; verify locally.']];
        $f['vacancy_pct'] = ['D', 'percent', 'Vacancy & credit loss', 5.0, ['min' => 0, 'max' => 90, 'assumption' => 'Generic allowance, not a local vacancy statistic.']];
        $f['rent_growth_pct'] = ['D', 'percent', 'Annual rent growth', 2.0, ['min' => -20, 'max' => 30, 'assumption' => 'Assumption, not a forecast.']];
        $f['other_income_monthly'] = ['D', 'money', 'Other income (monthly)', 0.0, ['min' => 0]];
        $f['lease_months'] = ['D', 'int', 'Remaining lease term (months)', null, ['min' => 0, 'max' => 600]];
        $f['rent_restrictions'] = ['D', 'select', 'Rent / letting restrictions', 'unknown', ['options' => ['unknown' => 'Unknown', 'none' => 'None known', 'some' => 'Some (licensing, caps)', 'significant' => 'Significant (rent control, STR bans)']]];

        // E. Objectives & assumptions
        $f['objective'] = ['E', 'select', 'Primary objective', 'wealth', ['options' => self::OBJECTIVES]];
        $f['hold_years'] = ['E', 'int', 'Holding period (years)', 10, ['min' => 1, 'max' => 40, 'assumption' => 'Default analysis horizon.']];
        $f['appreciation_pct'] = ['E', 'percent', 'Annual price change assumption', 2.0, ['min' => -30, 'max' => 30, 'assumption' => 'Neutral placeholder, not a forecast. Replace with your own view.']];
        $f['expense_growth_pct'] = ['E', 'percent', 'Annual cost growth', 2.5, ['min' => -10, 'max' => 50, 'assumption' => 'Placeholder near typical inflation targets.']];
        $f['inflation_pct'] = ['E', 'percent', 'Inflation (for real returns)', 2.5, ['min' => -10, 'max' => 200, 'assumption' => 'Placeholder; use your country\'s current CPI.']];
        $f['selling_cost_pct'] = ['E', 'percent', 'Selling costs at exit', 5.0, ['min' => 0, 'max' => 20, 'assumption' => 'Agent + legal + taxes at sale; varies widely.']];
        $f['discount_rate_pct'] = ['E', 'percent', 'Discount rate (required return)', 8.0, ['min' => 0, 'max' => 50, 'assumption' => 'Your opportunity cost of capital.']];
        $f['target_irr_pct'] = ['E', 'percent', 'Target annual return (IRR)', 8.0, ['min' => -50, 'max' => 100]];
        $f['market_cap_rate_pct'] = ['E', 'percent', 'Market cap rate (if known)', null, ['min' => 0.5, 'max' => 30, 'help' => 'From a broker, valuer or published survey. Enables the income approach to value.']];
        $f['budget'] = ['E', 'money', 'Total investment budget (equity)', null, ['min' => 0]];
        $f['risk_tolerance'] = ['E', 'select', 'Risk tolerance', 'balanced', ['options' => ['conservative' => 'Conservative', 'balanced' => 'Balanced', 'aggressive' => 'Aggressive']]];
        $f['liquidity_need'] = ['E', 'select', 'Liquidity need', 'low', ['options' => ['low' => 'Low — can hold through downturns', 'medium' => 'Medium', 'high' => 'High — may need to sell quickly']]];
        $f['portfolio_share_pct'] = ['E', 'percent', 'Share of your total wealth', null, ['min' => 0, 'max' => 100]];
        $f['investor_currency'] = ['E', 'select', 'Your reporting currency', '', ['options' => ['' => 'Same as property'] + Countries::currencyOptions()]];
        $f['fx_rate'] = ['E', 'number', 'FX rate (1 property ccy = X reporting ccy)', null, ['min' => 0.0000001]];
        $f['fx_source'] = ['E', 'text', 'FX rate source', '', ['max' => 80]];
        $f['fx_date'] = ['E', 'date', 'FX rate date', '', []];
        $f['fx_vol_pct'] = ['E', 'percent', 'FX annual volatility', 8.0, ['min' => 0, 'max' => 100, 'assumption' => 'Placeholder for currency-risk simulation only.']];

        // F. Location & qualitative risk — never inferred, only user-reported.
        $f['flood_risk'] = ['F', 'select', 'Flood / climate exposure', 'unknown', ['options' => $tri]];
        $f['country_risk'] = ['F', 'select', 'Political / country risk', 'unknown', ['options' => $tri]];
        $f['new_supply'] = ['F', 'select', 'Planned new supply nearby', 'unknown', ['options' => $tri]];
        $f['rental_demand'] = ['F', 'select', 'Evidence of rental demand', 'unknown', ['options' => ['unknown' => 'Unknown', 'weak' => 'Weak', 'moderate' => 'Moderate', 'strong' => 'Strong']]];
        $f['transport'] = ['F', 'select', 'Transport & amenities access', 'unknown', ['options' => ['unknown' => 'Unknown', 'poor' => 'Poor', 'average' => 'Average', 'good' => 'Good']]];
        $f['title_verified'] = ['F', 'select', 'Title checked by a lawyer', 'no', ['options' => ['no' => 'Not yet', 'yes' => 'Yes']]];
        $f['zoning_verified'] = ['F', 'select', 'Zoning / permitted use checked', 'no', ['options' => ['no' => 'Not yet', 'yes' => 'Yes']]];
        $f['inspection_done'] = ['F', 'select', 'Physical inspection / survey done', 'no', ['options' => ['no' => 'Not yet', 'yes' => 'Yes']]];

        // G. Uncertainty settings (Monte Carlo + Bayesian)
        $f['sims'] = ['G', 'int', 'Simulation runs', 2000, ['min' => 200, 'max' => 10000]];
        $f['seed'] = ['G', 'int', 'Random seed', 20260101, ['min' => 1, 'max' => 2147483647]];
        $f['rent_sd_pct'] = ['G', 'percent', 'Rent uncertainty (±1 sd)', 10.0, ['min' => 0, 'max' => 100, 'assumption' => 'Spread of possible achieved rent around your estimate.']];
        $f['vacancy_sd_pts'] = ['G', 'percent', 'Vacancy uncertainty (±pts)', 3.0, ['min' => 0, 'max' => 50]];
        $f['appreciation_sd_pts'] = ['G', 'percent', 'Price-change uncertainty (±pts / yr)', 4.0, ['min' => 0, 'max' => 50]];
        $f['rent_growth_sd_pts'] = ['G', 'percent', 'Rent-growth uncertainty (±pts / yr)', 1.5, ['min' => 0, 'max' => 30]];
        $f['opex_sd_pct'] = ['G', 'percent', 'Operating-cost uncertainty (±%)', 10.0, ['min' => 0, 'max' => 100]];
        $f['rate_sd_pts'] = ['G', 'percent', 'Interest-rate uncertainty (±pts, variable only)', 1.0, ['min' => 0, 'max' => 20]];
        $f['asking_adjust_pct'] = ['G', 'percent', 'Discount applied to asking-price comps', 0.0, ['min' => 0, 'max' => 50, 'help' => 'Asking prices often exceed achieved prices; set your local estimate. 0 = no adjustment.']];

        $out = [];
        foreach ($f as $key => [$section, $type, $label, $default, $opts]) {
            $out[$key] = ['key' => $key, 'section' => $section, 'type' => $type, 'label' => $label, 'default' => $default] + $opts;
        }
        return $out;
    }

    public const SECTIONS = [
        'A' => ['Property identity', 'Where it is and what it is.'],
        'B' => ['Price & characteristics', 'The asset itself.'],
        'C' => ['Financing & costs', 'How you will pay for and run it.'],
        'D' => ['Rental income', 'What it can earn.'],
        'E' => ['Objectives & assumptions', 'Your goals and the forward-looking assumptions the model uses.'],
        'F' => ['Location & due-diligence status', 'Only what you have checked — unknowns stay unknown.'],
        'G' => ['Uncertainty & simulation', 'How wide the range of outcomes should be.'],
    ];

    public const COMP_KINDS = [
        'sale_txn' => 'Sale — completed transaction',
        'sale_ask' => 'Sale — asking price',
        'rent_contract' => 'Rent — signed lease',
        'rent_ask' => 'Rent — advertised',
    ];

    /**
     * Validate and normalise raw input. Returns [values, provenance, errors].
     * provenance: key => 'user' | 'default' | 'missing' | 'derived'
     */
    public static function normalise(array $raw): array
    {
        $schema = self::schema();
        $v = [];
        $prov = [];
        $err = [];
        foreach ($schema as $key => $def) {
            $r = $raw[$key] ?? null;
            $r = is_string($r) ? trim($r) : $r;
            $isBlank = $r === null || $r === '';
            if ($isBlank) {
                $v[$key] = $def['default'];
                $prov[$key] = $def['default'] === null || $def['default'] === '' ? 'missing' : 'default';
                if (!empty($def['required']) && $prov[$key] === 'missing') {
                    $err[$key] = $def['label'] . ' is required.';
                }
                continue;
            }
            switch ($def['type']) {
                case 'select':
                    if (!array_key_exists((string) $r, $def['options'])) {
                        $err[$key] = 'Choose a valid ' . strtolower($def['label']) . '.';
                        $v[$key] = $def['default'];
                        $prov[$key] = 'default';
                        continue 2;
                    }
                    $v[$key] = (string) $r;
                    break;
                case 'text':
                    $s = mb_substr(trim(strip_tags((string) $r)), 0, $def['max'] ?? 200);
                    $v[$key] = $s;
                    break;
                case 'date':
                    $v[$key] = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $r) ? (string) $r : '';
                    break;
                default: // number, money, percent, int
                    $num = str_replace([',', ' '], '', (string) $r);
                    if (!is_numeric($num)) {
                        $err[$key] = $def['label'] . ' must be a number.';
                        $v[$key] = $def['default'];
                        $prov[$key] = 'default';
                        continue 2;
                    }
                    $num = $def['type'] === 'int' ? (int) round((float) $num) : (float) $num;
                    if (isset($def['min']) && $num < $def['min']) {
                        $err[$key] = $def['label'] . ' must be at least ' . $def['min'] . '.';
                    }
                    if (isset($def['max']) && $num > $def['max']) {
                        $err[$key] = $def['label'] . ' must be at most ' . $def['max'] . '.';
                    }
                    $v[$key] = $num;
            }
            $prov[$key] = 'user';
        }

        // Cross-field rules.
        if ($v['purchase_price'] === null && $v['asking_price'] !== null) {
            $v['purchase_price'] = $v['asking_price'];
            $prov['purchase_price'] = 'derived';
        }
        if ($v['financing'] === 'mortgage') {
            if ($v['interest_rate_pct'] === null) {
                $err['interest_rate_pct'] = 'Enter the interest rate you have been quoted, or choose all-cash.';
            }
            if ($v['io_years'] > $v['loan_term_years']) {
                $err['io_years'] = 'Interest-only period cannot exceed the loan term.';
            }
        }
        if ($v['rental_mode'] === 'short_term') {
            if ($v['nightly_rate'] !== null && $v['str_occupancy_pct'] !== null) {
                $gross = $v['nightly_rate'] * 365 / 12 * $v['str_occupancy_pct'] / 100;
                $v['monthly_rent'] = $gross * (1 - $v['str_fees_pct'] / 100);
                $prov['monthly_rent'] = 'derived';
                // Occupancy already captures empty nights.
                if ($prov['vacancy_pct'] === 'default') {
                    $v['vacancy_pct'] = 0.0;
                    $prov['vacancy_pct'] = 'derived';
                }
            } elseif ($v['monthly_rent'] === null) {
                $err['nightly_rate'] = 'For short-term rentals enter nightly rate and occupancy, or a monthly net revenue.';
            }
        } elseif ($v['rental_mode'] === 'owner_occupied') {
            $v['monthly_rent'] = 0.0;
            $prov['monthly_rent'] = 'derived';
        } elseif ($v['monthly_rent'] === null) {
            $err['monthly_rent'] = 'Monthly rent is required for a rental analysis.';
        }
        if ($v['investor_currency'] !== '' && $v['investor_currency'] !== $v['currency'] && $v['fx_rate'] === null) {
            $err['fx_rate'] = 'Enter the exchange rate (with its source and date) to report in a different currency.';
        }
        if ($v['area'] !== null && $v['area_unit'] === 'sqft') {
            $v['area_sqm'] = $v['area'] * 0.09290304;
        } else {
            $v['area_sqm'] = $v['area'];
        }
        if ($v['rate_type'] === 'fixed') {
            $v['rate_sd_pts'] = 0.0;
        }
        $v['comps'] = self::normaliseComps($raw['comps'] ?? [], $v['area_unit'], $err);
        return [$v, $prov, $err];
    }

    private static function normaliseComps($rows, string $unit, array &$err): array
    {
        $out = [];
        if (!is_array($rows)) {
            return $out;
        }
        foreach (array_slice($rows, 0, 25) as $i => $r) {
            if (!is_array($r)) {
                continue;
            }
            $price = str_replace([',', ' '], '', (string) ($r['price'] ?? ''));
            if ($price === '' || !is_numeric($price) || (float) $price <= 0) {
                continue; // blank row
            }
            $kind = (string) ($r['kind'] ?? 'sale_txn');
            if (!isset(self::COMP_KINDS[$kind])) {
                $kind = 'sale_txn';
            }
            $area = is_numeric($r['area'] ?? null) ? (float) $r['area'] : null;
            if ($area !== null && $area <= 0) {
                $area = null;
            }
            $out[] = [
                'kind' => $kind,
                'price' => (float) $price,
                'area_sqm' => $area === null ? null : ($unit === 'sqft' ? $area * 0.09290304 : $area),
                'area' => $area,
                'bedrooms' => is_numeric($r['bedrooms'] ?? null) ? (int) $r['bedrooms'] : null,
                'age' => is_numeric($r['age'] ?? null) ? max(0, (int) $r['age']) : null,
                'months_ago' => is_numeric($r['months_ago'] ?? null) ? max(0.0, (float) $r['months_ago']) : null,
                'distance_km' => is_numeric($r['distance_km'] ?? null) ? max(0.0, (float) $r['distance_km']) : null,
                'condition' => max(-1, min(1, (int) ($r['condition'] ?? 0))),
                'source' => mb_substr(trim(strip_tags((string) ($r['source'] ?? ''))), 0, 120),
            ];
        }
        return $out;
    }
}
