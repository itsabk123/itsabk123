<?php
declare(strict_types=1);

namespace SS;

/**
 * Free calculator registry. Every tool reuses Finance/Proforma/MonteCarlo,
 * so a tool and a full report can never disagree on a formula.
 * Pre-filled values are clearly labelled EXAMPLES, not market data.
 */
final class Tools
{
    public static function all(): array
    {
        return [
            'rental-yield-calculator' => [
                'title' => 'Rental Yield Calculator',
                'summary' => 'Gross and net rental yield from price, rent and running costs.',
                'fields' => [['price', 'Purchase price', 'money', 250000], ['rent', 'Monthly rent', 'money', 1500], ['costs', 'Annual running costs', 'money', 3000, 'Service charges, insurance, maintenance, management, tax.'], ['vacancy', 'Vacancy allowance', 'percent', 5], ['buy_costs', 'Purchase costs (taxes, fees)', 'money', 10000]],
                'formula' => 'Gross yield = annual rent ÷ price. Net yield = (annual rent × (1 − vacancy) − running costs) ÷ (price + purchase costs).',
                'faq' => [['What is a good rental yield?', 'There is no universal threshold: it depends on local interest rates, expected price growth, and risk. Compare the net yield with your borrowing cost and with alternative investments of similar risk.'], ['Why is net yield lower than gross?', 'Net yield deducts vacancy, running costs and includes purchase costs in the denominator, so it reflects what you actually keep.']],
                'related' => ['cash-flow-calculator', 'cap-rate-calculator', 'rental-income-calculator'],
            ],
            'real-estate-roi-calculator' => [
                'title' => 'Real Estate ROI Calculator',
                'summary' => 'Total and annualised return on the cash you invest.',
                'fields' => [['equity', 'Cash invested (deposit + costs)', 'money', 80000], ['annual_cf', 'Average annual net cash flow', 'money', 4000], ['years', 'Years held', 'int', 7], ['exit_equity', 'Net sale proceeds after loan repayment', 'money', 120000]],
                'formula' => 'Total ROI = (cash flows + net sale proceeds − cash invested) ÷ cash invested. Annualised = (1 + ROI)^(1/years) − 1. IRR also accounts for timing.',
                'faq' => [['ROI vs IRR?', 'ROI ignores when money is received; IRR discounts each cash flow by when it arrives, so it is the better measure for comparing holds of different lengths.']],
                'related' => ['irr-npv-calculator', 'property-appreciation-calculator'],
            ],
            'mortgage-calculator' => [
                'title' => 'Mortgage Calculator',
                'summary' => 'Monthly payment, total interest and a year-by-year amortisation table.',
                'fields' => [['price', 'Property price', 'money', 300000], ['down', 'Down payment', 'percent', 20], ['rate', 'Interest rate (annual)', 'percent', 5.5], ['term', 'Term (years)', 'int', 25], ['io', 'Interest-only years', 'int', 0]],
                'formula' => 'Payment = P·r·(1+r)^n ÷ ((1+r)^n − 1), with r = annual rate ÷ 12 and n = months. Zero-rate loans are P ÷ n.',
                'faq' => [['Does this include insurance or taxes?', 'No. It is principal and interest only; add property tax, insurance and fees separately.']],
                'related' => ['real-estate-affordability-calculator', 'cash-flow-calculator'],
            ],
            'cash-flow-calculator' => [
                'title' => 'Rental Cash Flow Calculator',
                'summary' => 'Monthly cash left after vacancy, costs and the mortgage.',
                'fields' => [['rent', 'Monthly rent', 'money', 1800], ['vacancy', 'Vacancy', 'percent', 5], ['mgmt', 'Management fee (% of rent)', 'percent', 8], ['fixed', 'Fixed monthly costs (tax, insurance, charges, repairs)', 'money', 350], ['mortgage', 'Monthly mortgage payment', 'money', 1100]],
                'formula' => 'Cash flow = rent × (1 − vacancy) × (1 − management) − fixed costs − mortgage payment.',
                'faq' => [['Should cash flow be positive?', 'For income investors, usually yes. Some growth investors accept negative cash flow, but must fund it every month and carry the extra risk.']],
                'related' => ['break-even-calculator', 'rental-yield-calculator'],
            ],
            'cap-rate-calculator' => [
                'title' => 'Cap Rate Calculator',
                'summary' => 'Capitalisation rate from NOI and price — or the value implied by a market cap rate.',
                'fields' => [['gross', 'Annual gross rent', 'money', 60000], ['vacancy', 'Vacancy', 'percent', 5], ['opex', 'Annual operating expenses (exclude mortgage)', 'money', 15000], ['price', 'Price', 'money', 700000], ['market_cap', 'Market cap rate to value at (optional)', 'percent', null]],
                'formula' => 'NOI = gross rent × (1 − vacancy) − operating expenses. Cap rate = NOI ÷ price. Implied value = NOI ÷ market cap rate.',
                'faq' => [['Is cap rate the same as yield?', 'Cap rate is NOI over price, excluding financing and purchase costs; net yield in this platform includes purchase costs in the denominator.']],
                'related' => ['rental-yield-calculator', 'property-valuation-estimator'],
            ],
            'buy-vs-rent-calculator' => [
                'title' => 'Buy vs Rent Calculator',
                'summary' => 'Compare net worth after N years of buying versus renting and investing the difference.',
                'fields' => [['price', 'Home price', 'money', 400000], ['down', 'Down payment', 'percent', 20], ['buy_costs', 'Purchase costs', 'percent', 4], ['rate', 'Mortgage rate', 'percent', 5], ['term', 'Term (years)', 'int', 25], ['own_costs', 'Ownership costs (% of value / yr)', 'percent', 1.5], ['rent', 'Equivalent monthly rent', 'money', 1700], ['rent_growth', 'Rent growth', 'percent', 3], ['app', 'Price change', 'percent', 3], ['inv', 'Return on invested savings', 'percent', 5], ['sell', 'Selling costs', 'percent', 5], ['years', 'Years', 'int', 10]],
                'formula' => 'Buyer net worth = value − loan balance − selling costs. Renter invests the deposit and purchase costs, plus any monthly saving versus owning, at the stated return. Results depend heavily on the price-change and investment-return assumptions.',
                'faq' => [['Does this include taxes?', 'No — tax treatment of homes, rent and investments varies by country. Add your local effects separately.']],
                'related' => ['mortgage-calculator', 'real-estate-affordability-calculator'],
            ],
            'property-appreciation-calculator' => [
                'title' => 'Property Appreciation Calculator',
                'summary' => 'Future value under an assumed growth rate, or the historical CAGR between two prices.',
                'fields' => [['start', 'Starting value', 'money', 300000], ['rate', 'Assumed annual change', 'percent', 3], ['years', 'Years', 'int', 10], ['end', 'Known ending value (for CAGR, optional)', 'money', null]],
                'formula' => 'Future value = start × (1 + rate)^years. CAGR = (end ÷ start)^(1/years) − 1.',
                'faq' => [['Is the growth rate a forecast?', 'No. It is your assumption. Past growth does not guarantee future growth, and prices can fall.']],
                'related' => ['real-estate-inflation-calculator', 'real-estate-roi-calculator'],
            ],
            'investment-property-comparison' => [
                'title' => 'Investment Property Comparison',
                'summary' => 'Side-by-side yield, cash flow, IRR and NPV for two properties on identical assumptions.',
                'fields' => [['a_price', 'A — price', 'money', 250000], ['a_rent', 'A — monthly rent', 'money', 1400], ['a_costs', 'A — annual costs', 'money', 3500], ['b_price', 'B — price', 'money', 320000], ['b_rent', 'B — monthly rent', 'money', 1650], ['b_costs', 'B — annual costs', 'money', 4500], ['down', 'Down payment (both)', 'percent', 25], ['rate', 'Interest rate (both)', 'percent', 5.5], ['app', 'Price change (both)', 'percent', 2], ['years', 'Hold (years)', 'int', 10], ['disc', 'Discount rate', 'percent', 8]],
                'formula' => 'Each property runs through the same cash-flow engine used in full reports (25-year amortising loan, 5% vacancy, 5% purchase costs, 5% selling costs).',
                'faq' => [['Why identical assumptions?', 'So differences come from the properties, not from inconsistent assumptions. Run full evaluations to tailor each.']],
                'related' => ['rental-yield-calculator', 'irr-npv-calculator'],
            ],
            'rental-income-calculator' => [
                'title' => 'Rental Income Calculator',
                'summary' => 'Effective gross income across units after vacancy, plus other income.',
                'fields' => [['units', 'Number of units', 'int', 4], ['rent', 'Average monthly rent per unit', 'money', 1100], ['other', 'Other monthly income (parking, laundry)', 'money', 150], ['vacancy', 'Vacancy', 'percent', 6]],
                'formula' => 'Effective gross income = units × rent × 12 × (1 − vacancy) + other income × 12.',
                'faq' => [['What vacancy should I use?', 'Use local evidence: time-to-let for similar units plus expected turnover. Unknown? Test several values in the full report.']],
                'related' => ['rental-yield-calculator', 'cash-flow-calculator'],
            ],
            'real-estate-inflation-calculator' => [
                'title' => 'Real Estate Inflation Calculator',
                'summary' => 'Convert nominal returns and values into inflation-adjusted (real) terms.',
                'fields' => [['nominal', 'Nominal annual return', 'percent', 7], ['inflation', 'Inflation', 'percent', 3], ['amount', 'Amount', 'money', 100000], ['years', 'Years', 'int', 10]],
                'formula' => 'Real return = (1 + nominal) ÷ (1 + inflation) − 1 (Fisher). Real value = nominal value ÷ (1 + inflation)^years.',
                'faq' => [['Why not just subtract inflation?', 'Subtraction is an approximation; the Fisher relation is exact and matters at higher rates.']],
                'related' => ['property-appreciation-calculator'],
            ],
            'property-investment-risk-calculator' => [
                'title' => 'Property Investment Risk Calculator',
                'summary' => 'A quick Monte Carlo: probability of loss and the range of returns.',
                'fields' => [['price', 'Price', 'money', 300000], ['rent', 'Monthly rent', 'money', 1600], ['costs', 'Annual running costs', 'money', 4000], ['down', 'Down payment', 'percent', 25], ['rate', 'Interest rate', 'percent', 5.5], ['app', 'Expected price change', 'percent', 2], ['app_sd', 'Price-change uncertainty (±pts)', 'percent', 4], ['rent_sd', 'Rent uncertainty (±%)', 'percent', 10], ['years', 'Hold (years)', 'int', 10]],
                'formula' => '1,000 simulated paths (fixed seed, reproducible) through the full-report cash-flow engine; price change and rent growth are correlated (ρ = 0.5).',
                'faq' => [['Are these probabilities real-world odds?', 'They are model probabilities given your assumptions, not guarantees. Wider uncertainty inputs give wider ranges.']],
                'related' => ['break-even-calculator', 'investment-property-comparison'],
            ],
            'break-even-calculator' => [
                'title' => 'Break-Even Occupancy & Rent Calculator',
                'summary' => 'The occupancy and rent needed for zero cash flow.',
                'fields' => [['rent', 'Monthly rent at full occupancy', 'money', 2000], ['fixed', 'Fixed monthly costs', 'money', 400], ['mgmt', 'Variable costs (% of collected rent)', 'percent', 10], ['mortgage', 'Monthly mortgage payment', 'money', 1200]],
                'formula' => 'Break-even occupancy = (fixed costs + mortgage) ÷ (rent × (1 − variable %)). Break-even rent = (fixed + mortgage) ÷ (1 − variable %).',
                'faq' => [['What is a comfortable break-even?', 'Lower is safer. Above ~90% means a month or two of vacancy wipes out the year\'s cash flow.']],
                'related' => ['cash-flow-calculator'],
            ],
            'real-estate-affordability-calculator' => [
                'title' => 'Real Estate Affordability Calculator',
                'summary' => 'Maximum price you can finance from income, debts and a debt-to-income limit.',
                'fields' => [['income', 'Gross monthly income', 'money', 8000], ['debts', 'Other monthly debt payments', 'money', 500], ['dti', 'Max total debt-to-income', 'percent', 40, 'Lender limits vary by country and lender.'], ['rate', 'Interest rate', 'percent', 5.5], ['term', 'Term (years)', 'int', 25], ['cash', 'Cash available for deposit', 'money', 60000], ['costs', 'Purchase costs', 'percent', 4]],
                'formula' => 'Max payment = income × DTI − debts. Max loan = present value of that payment. Max price = min(loan + deposit, budget after purchase costs).',
                'faq' => [['Will a lender approve this?', 'Not necessarily — lenders also stress-test rates, check credit and cap loan-to-value. Treat this as an upper bound.']],
                'related' => ['mortgage-calculator', 'buy-vs-rent-calculator'],
            ],
            'short-term-rental-calculator' => [
                'title' => 'Short-Term Rental Calculator',
                'summary' => 'Holiday-let revenue and profit versus a long-term let.',
                'fields' => [['nightly', 'Average nightly rate', 'money', 150], ['occ', 'Occupancy', 'percent', 65], ['fees', 'Platform & cleaning fees (% of revenue)', 'percent', 18], ['mgmt', 'Management (% of revenue)', 'percent', 15], ['fixed', 'Monthly fixed costs (utilities, internet, supplies)', 'money', 450], ['ltr', 'Alternative long-term monthly rent', 'money', 2000]],
                'formula' => 'Revenue = nightly × 365 ÷ 12 × occupancy. Net = revenue × (1 − fees − management) − fixed costs.',
                'faq' => [['Is short-term letting allowed?', 'Many cities license, cap or ban it. Check local rules before relying on short-term income.']],
                'related' => ['rental-yield-calculator', 'cash-flow-calculator'],
            ],
            'irr-npv-calculator' => [
                'title' => 'IRR, NPV & MIRR Calculator',
                'summary' => 'Internal rate of return, net present value and modified IRR for any series of cash flows.',
                'fields' => [['flows', 'Cash flows, one per period (first = investment, negative)', 'textarea', "-100000\n8000\n8000\n8000\n8000\n125000"], ['disc', 'Discount rate', 'percent', 8], ['fin', 'Finance rate (MIRR)', 'percent', 6], ['reinv', 'Reinvestment rate (MIRR)', 'percent', 6]],
                'formula' => 'IRR solves Σ CFₜ/(1+IRR)ᵗ = 0 (Newton–Raphson with bisection fallback). NPV = Σ CFₜ/(1+r)ᵗ with CF₀ undiscounted. MIRR uses separate finance and reinvestment rates.',
                'faq' => [['Why can IRR be undefined?', 'If cash flows never change sign there is no rate that makes NPV zero.']],
                'related' => ['real-estate-roi-calculator'],
            ],
            'property-valuation-estimator' => [
                'title' => 'Property Valuation Estimator (Comparables)',
                'summary' => 'Indicative value from comparables you supply, weighted by recency, distance and size.',
                'fields' => [['area', 'Subject area (m² or ft²)', 'number', 95], ['comps', 'Comparables — one per line: price, area, months ago, distance km, T (transaction) or A (asking)', 'textarea', "410000, 100, 3, 0.4, T\n385000, 92, 8, 0.9, T\n455000, 110, 2, 1.2, A\n398000, 96, 14, 0.6, T"], ['app', 'Price change used to time-adjust', 'percent', 2], ['ask_adj', 'Discount on asking prices', 'percent', 0]],
                'formula' => 'Each comparable\'s price per unit area is time-adjusted, then weighted by recency (e^(−months/12)), distance (1/(1+km)), size similarity and evidence type (transactions 1.0, asking 0.6). Value = weighted mean × subject area; range = ±1.28 weighted SD.',
                'faq' => [['Is this a valuation?', 'No. It is an indicative estimate from the evidence you enter — not a regulated valuation. Quality depends entirely on the comparables.']],
                'related' => ['cap-rate-calculator', 'rental-yield-calculator'],
            ],
        ];
    }

    public static function values(array $tool, array $raw): array
    {
        $v = [];
        foreach ($tool['fields'] as $f) {
            [$k, , $type, $def] = $f;
            $r = $raw[$k] ?? null;
            if ($type === 'textarea') {
                $v[$k] = is_string($r) && $r !== '' ? mb_substr($r, 0, 4000) : $def;
                continue;
            }
            if ($r === null || $r === '') {
                $v[$k] = $def;
                continue;
            }
            $r = str_replace([',', ' '], '', (string) $r);
            $v[$k] = is_numeric($r) ? ($type === 'int' ? max(0, min(100, (int) $r)) : (float) $r) : $def;
        }
        return $v;
    }

    private static function pct(?float $x): ?float
    {
        return $x === null ? null : $x / 100;
    }

    /** @return array{results: array, table?: array, note?: string} */
    public static function compute(string $slug, array $v): array
    {
        $m = static fn($x) => Fmt::money($x, '', 0);
        $p = static fn($x) => Fmt::pct($x);
        switch ($slug) {
            case 'rental-yield-calculator':
                $annual = $v['rent'] * 12;
                $net = $annual * (1 - $v['vacancy'] / 100) - $v['costs'];
                return ['results' => [
                    ['Gross yield', $v['price'] > 0 ? $p($annual / $v['price']) : '—', 'Annual rent ÷ price'],
                    ['Net yield', ($v['price'] + $v['buy_costs']) > 0 ? $p($net / ($v['price'] + $v['buy_costs'])) : '—', 'After vacancy, costs and purchase costs'],
                    ['Net annual income', $m($net), 'Before mortgage'],
                    ['Net monthly income', $m($net / 12), 'Before mortgage'],
                ]];
            case 'real-estate-roi-calculator':
                $cfs = array_merge([-$v['equity']], array_fill(0, max(1, $v['years']), $v['annual_cf']));
                $cfs[count($cfs) - 1] += $v['exit_equity'];
                $profit = array_sum($cfs);
                $roi = $v['equity'] > 0 ? $profit / $v['equity'] : null;
                return ['results' => [
                    ['Total profit', $m($profit), ''],
                    ['Total ROI', $p($roi), 'Profit ÷ cash invested'],
                    ['Annualised ROI', $roi !== null && $roi > -1 ? $p((1 + $roi) ** (1 / max(1, $v['years'])) - 1) : '—', ''],
                    ['IRR', $p(Finance::irr($cfs)), 'Accounts for timing'],
                    ['Equity multiple', Fmt::num(Finance::equityMultiple($cfs)) . '×', ''],
                ]];
            case 'mortgage-calculator':
                $loan = $v['price'] * (1 - $v['down'] / 100);
                $sched = Finance::amortisationByYear($v['rate'] / 100, max(1, $v['term']), $loan, min($v['io'], $v['term']));
                $totalInt = array_sum(array_column($sched, 'interest'));
                $first = $v['io'] > 0 ? $loan * $v['rate'] / 1200 : Finance::pmt($v['rate'] / 1200, $v['term'] * 12, $loan);
                $amortPay = Finance::pmt($v['rate'] / 1200, max(1, ($v['term'] - $v['io']) * 12), $loan);
                $rows = array_map(static fn($r) => [$r['year'], Fmt::money($r['interest'], ''), Fmt::money($r['principal'], ''), Fmt::money($r['balance'], '')], $sched);
                return ['results' => [
                    ['Loan amount', $m($loan), ''],
                    ['Monthly payment', $m($first) . ($v['io'] > 0 ? ' (IO)' : ''), $v['io'] > 0 ? 'Then ' . $m($amortPay) . ' once amortising' : 'Principal and interest'],
                    ['Total interest', $m($totalInt), 'Over the full term'],
                    ['Total paid', $m($totalInt + $loan), ''],
                ], 'table' => ['head' => ['Year', 'Interest', 'Principal', 'Balance'], 'rows' => $rows]];
            case 'cash-flow-calculator':
                $col = $v['rent'] * (1 - $v['vacancy'] / 100);
                $cf = $col * (1 - $v['mgmt'] / 100) - $v['fixed'] - $v['mortgage'];
                return ['results' => [
                    ['Monthly cash flow', $m($cf), $cf >= 0 ? 'Positive' : 'Negative — you fund this each month'],
                    ['Annual cash flow', $m($cf * 12), ''],
                    ['Collected rent', $m($col), 'After vacancy'],
                    ['Expense ratio', $col > 0 ? $p(($col * $v['mgmt'] / 100 + $v['fixed']) / $col) : '—', 'Operating costs ÷ collected rent'],
                ]];
            case 'cap-rate-calculator':
                $noi = $v['gross'] * (1 - $v['vacancy'] / 100) - $v['opex'];
                $res = [['NOI', $m($noi), 'Net operating income'], ['Cap rate', $v['price'] > 0 ? $p($noi / $v['price']) : '—', 'NOI ÷ price']];
                if ($v['market_cap'] > 0) {
                    $res[] = ['Implied value at ' . $v['market_cap'] . '%', $m($noi / ($v['market_cap'] / 100)), 'NOI ÷ market cap rate'];
                }
                return ['results' => $res];
            case 'buy-vs-rent-calculator':
                return self::buyVsRent($v);
            case 'property-appreciation-calculator':
                $fv = $v['start'] * (1 + $v['rate'] / 100) ** $v['years'];
                $res = [['Future value', $m($fv), 'Under your assumption'], ['Change', $m($fv - $v['start']), $p($fv / max(1e-9, $v['start']) - 1) . ' total']];
                if ($v['end'] > 0) {
                    $res[] = ['Historical CAGR', $p(Finance::cagr($v['start'], $v['end'], $v['years'])), 'From start to known end value'];
                }
                return ['results' => $res];
            case 'investment-property-comparison':
                $rows = [];
                $out = [];
                foreach (['a' => 'Property A', 'b' => 'Property B'] as $k => $label) {
                    $pp = self::simpleParams($v[$k . '_price'], $v[$k . '_rent'], $v[$k . '_costs'], $v['down'], $v['rate'], $v['app'], $v['years'], $v['disc']);
                    $r = Proforma::run($pp);
                    $out[$k] = $r;
                }
                $metrics = [
                    ['Gross yield', 'gross_yield', 'pct'], ['Net yield', 'net_yield', 'pct'], ['Cap rate', 'cap_rate', 'pct'],
                    ['Monthly cash flow (yr 1)', 'monthly_cf1', 'money'], ['Cash-on-cash', 'coc', 'pct'], ['DSCR', 'dscr', 'x'],
                    ['IRR', 'irr', 'pct'], ['NPV', 'npv', 'money'], ['Equity multiple', 'equity_multiple', 'x'], ['Cash required', 'equity0', 'money'],
                ];
                foreach ($metrics as [$label, $key, $fmt]) {
                    $f = static fn($x) => $fmt === 'pct' ? Fmt::pct($x) : ($fmt === 'money' ? Fmt::money($x, '') : Fmt::num($x) . '×');
                    $rows[] = [$label, $f($out['a'][$key]), $f($out['b'][$key])];
                }
                $better = ($out['a']['irr'] ?? -9) >= ($out['b']['irr'] ?? -9) ? 'A' : 'B';
                return ['results' => [['Higher base-case IRR', 'Property ' . $better, 'On identical assumptions — not a recommendation']], 'table' => ['head' => ['Metric', 'Property A', 'Property B'], 'rows' => $rows]];
            case 'rental-income-calculator':
                $gpr = $v['units'] * $v['rent'] * 12;
                $egi = $gpr * (1 - $v['vacancy'] / 100) + $v['other'] * 12;
                return ['results' => [['Gross potential rent', $m($gpr), 'Per year, fully let'], ['Vacancy loss', $m($gpr * $v['vacancy'] / 100), ''], ['Effective gross income', $m($egi), 'Per year'], ['Per month', $m($egi / 12), '']]];
            case 'real-estate-inflation-calculator':
                $real = Finance::realRate($v['nominal'] / 100, $v['inflation'] / 100);
                $nomFv = $v['amount'] * (1 + $v['nominal'] / 100) ** $v['years'];
                return ['results' => [
                    ['Real annual return', $p($real), 'Fisher relation'],
                    ['Nominal value', $m($nomFv), 'After ' . $v['years'] . ' years'],
                    ['Value in today\'s money', $m($nomFv / (1 + $v['inflation'] / 100) ** $v['years']), ''],
                    ['Purchasing power of today\'s amount', $m($v['amount'] / (1 + $v['inflation'] / 100) ** $v['years']), 'If held as cash'],
                ]];
            case 'property-investment-risk-calculator':
                $pp = self::simpleParams($v['price'], $v['rent'], $v['costs'], $v['down'], $v['rate'], $v['app'], $v['years'], 8);
                $u = ['rent_mean' => $pp['rent_m'], 'rent_sd_abs' => $pp['rent_m'] * $v['rent_sd'] / 100, 'vac_sd' => 0.03, 'app_sd' => $v['app_sd'] / 100, 'rg_sd' => 0.015, 'opex_sd' => 0.1, 'rate_sd' => 0.0];
                $mc = MonteCarlo::run($pp, $u, 1000, 42, 0.08);
                return ['results' => [
                    ['Probability of losing money', $p($mc['p_loss']), '± ' . Fmt::pct(1.96 * $mc['p_loss_se']) . ' simulation error'],
                    ['Median IRR', $p($mc['irr_q']['0.5']), ''],
                    ['5th–95th percentile IRR', $p($mc['irr_q']['0.05']) . ' to ' . $p($mc['irr_q']['0.95']), '90% of simulated paths'],
                    ['Probability IRR ≥ 8%', $p($mc['p_target']), ''],
                    ['VaR 95% (total profit)', $m(-$mc['var95']), 'Loss exceeded in only 5% of paths'],
                ], 'mc' => $mc];
            case 'break-even-calculator':
                $share = 1 - $v['mgmt'] / 100;
                $need = $v['fixed'] + $v['mortgage'];
                return ['results' => [
                    ['Break-even occupancy', $v['rent'] * $share > 0 ? $p($need / ($v['rent'] * $share)) : '—', ''],
                    ['Break-even rent', $share > 0 ? $m($need / $share) : '—', 'At 100% occupancy'],
                    ['Monthly margin at full occupancy', $m($v['rent'] * $share - $need), ''],
                ]];
            case 'real-estate-affordability-calculator':
                $pay = max(0.0, $v['income'] * $v['dti'] / 100 - $v['debts']);
                $loan = Finance::principalFromPayment($v['rate'] / 100, max(1, $v['term']), $pay);
                $deposit = $v['cash'];
                // price*(costs%) + (price - loan) = cash  =>  price = (cash + loan)/(1+costs%)
                $price = ($deposit + $loan) / (1 + $v['costs'] / 100);
                $loanUsed = max(0.0, min($loan, $price));
                return ['results' => [
                    ['Max monthly payment', $m($pay), 'Income × DTI − other debts'],
                    ['Max loan', $m($loan), ''],
                    ['Indicative max price', $m($price), 'Using all available cash for deposit and costs'],
                    ['Implied loan-to-value', $price > 0 ? $p($loanUsed / $price) : '—', 'Lenders may cap this lower'],
                ]];
            case 'short-term-rental-calculator':
                $rev = $v['nightly'] * 365 / 12 * $v['occ'] / 100;
                $net = $rev * (1 - ($v['fees'] + $v['mgmt']) / 100) - $v['fixed'];
                $beOcc = ($v['nightly'] * 365 / 12 * (1 - ($v['fees'] + $v['mgmt']) / 100));
                return ['results' => [
                    ['Monthly revenue', $m($rev), ''],
                    ['Monthly net (before mortgage & tax)', $m($net), ''],
                    ['vs long-term rent', $m($net - $v['ltr']), $net >= $v['ltr'] ? 'Short-term earns more' : 'Long-term earns more'],
                    ['Occupancy to match long-term', $beOcc > 0 ? $p(($v['ltr'] + $v['fixed']) / $beOcc) : '—', ''],
                ]];
            case 'irr-npv-calculator':
                $cfs = [];
                foreach (preg_split('/[\s;]+/', (string) $v['flows']) as $t) {
                    $t = str_replace(',', '', $t);
                    if ($t !== '' && is_numeric($t)) {
                        $cfs[] = (float) $t;
                    }
                }
                $cfs = array_slice($cfs, 0, 100);
                if (count($cfs) < 2) {
                    return ['results' => [['Error', 'Enter at least two cash flows', '']]];
                }
                return ['results' => [
                    ['IRR', $p(Finance::irr($cfs)), Finance::irr($cfs) === null ? 'Undefined — cash flows never change sign' : ''],
                    ['NPV at ' . $v['disc'] . '%', $m(Finance::npv($v['disc'] / 100, $cfs)), ''],
                    ['MIRR', $p(Finance::mirr($cfs, $v['fin'] / 100, $v['reinv'] / 100)), ''],
                    ['Equity multiple', Fmt::num(Finance::equityMultiple($cfs)) . '×', ''],
                    ['Periods', (string) (count($cfs) - 1), ''],
                ]];
            case 'property-valuation-estimator':
                $comps = [];
                foreach (preg_split('/\r?\n/', (string) $v['comps']) as $line) {
                    $c = array_map('trim', explode(',', $line));
                    if (count($c) < 2 || !is_numeric($c[0]) || !is_numeric($c[1])) {
                        continue;
                    }
                    $comps[] = ['kind' => strtoupper($c[4] ?? 'T') === 'A' ? 'sale_ask' : 'sale_txn', 'price' => (float) $c[0], 'area_sqm' => (float) $c[1],
                        'months_ago' => is_numeric($c[2] ?? null) ? (float) $c[2] : null, 'distance_km' => is_numeric($c[3] ?? null) ? (float) $c[3] : null, 'condition' => 0];
                }
                $r = Valuation::comps(array_slice($comps, 0, 25), (float) $v['area'] ?: null, $v['app'] / 100, $v['ask_adj'] / 100);
                if (!$r['available']) {
                    return ['results' => [['Not enough evidence', $r['reason'], '']]];
                }
                return ['results' => [
                    ['Indicative value', $m($r['value']), 'Weighted comparable mean × area'],
                    ['Indicative range', $m($r['lo']) . ' – ' . $m($r['hi']), '±1.28 weighted SD (≈ 80% band)'],
                    ['Price per unit area', $m($r['ppsm']), ''],
                    ['Effective comparables', Fmt::num($r['n_eff'], 1), 'Lower = estimate relies on fewer comps'],
                ], 'table' => ['head' => ['Price', 'Area', 'Adjusted / area', 'Weight'], 'rows' => array_map(static fn($c) => [Fmt::money($c['price'], ''), Fmt::num($c['area_sqm'], 0), Fmt::money($c['ppsm'], ''), Fmt::pct($c['weight_share'], 0)], $r['rows'])]];
        }
        return ['results' => []];
    }

    public static function simpleParams(float $price, float $rent, float $costs, float $downPct, float $ratePct, float $appPct, int $years, float $discPct): array
    {
        return [
            'price' => $price, 'acq_costs' => $price * 0.05, 'renovation' => 0.0, 'loan' => $price * (1 - $downPct / 100),
            'rate' => $ratePct / 100, 'term' => 25, 'io' => 0, 'rent_m' => $rent, 'other_m' => 0.0, 'vacancy' => 0.05,
            'mgmt' => 0.0, 'capex' => 0.0, 'fixed_opex' => $costs, 'maint' => 0.0, 'rent_growth' => 0.02, 'exp_growth' => 0.025,
            'appreciation' => $appPct / 100, 'hold' => max(1, $years), 'sell_cost' => 0.05, 'discount' => $discPct / 100,
            'inflation' => 0.025, 'opex_mult' => 1.0,
        ];
    }

    private static function buyVsRent(array $v): array
    {
        $price = $v['price'];
        $loan = $price * (1 - $v['down'] / 100);
        $upfront = $price * $v['down'] / 100 + $price * $v['buy_costs'] / 100;
        $rm = $v['rate'] / 1200;
        $n = max(1, $v['term']) * 12;
        $pay = Finance::pmt($rm, $n, $loan);
        $inv = (1 + $v['inv'] / 100) ** (1 / 12) - 1;
        $portfolio = $upfront;
        $rent = $v['rent'];
        $rows = [];
        $buyerNW = 0.0;
        $renterNW = 0.0;
        for ($mth = 1; $mth <= $v['years'] * 12; $mth++) {
            $year = (int) ceil($mth / 12);
            $value = $price * (1 + $v['app'] / 100) ** ($mth / 12);
            $ownCost = ($mth <= $n ? $pay : 0) + $value * $v['own_costs'] / 1200;
            $saving = $ownCost - $rent;
            $portfolio = $portfolio * (1 + $inv) + $saving;
            if ($mth % 12 === 0) {
                $bal = Finance::balance($rm, $n, $loan, $mth);
                $buyerNW = $value * (1 - $v['sell'] / 100) - $bal;
                $renterNW = $portfolio;
                $rows[] = [$year, Fmt::money($buyerNW, ''), Fmt::money($renterNW, ''), Fmt::money($buyerNW - $renterNW, '')];
                $rent *= 1 + $v['rent_growth'] / 100;
            }
        }
        return ['results' => [
            ['Buyer net worth after ' . $v['years'] . ' yrs', Fmt::money($buyerNW, ''), 'Value − selling costs − loan balance'],
            ['Renter net worth', Fmt::money($renterNW, ''), 'Invested deposit + monthly savings'],
            ['Difference', Fmt::money($buyerNW - $renterNW, ''), $buyerNW >= $renterNW ? 'Buying ahead under these assumptions' : 'Renting ahead under these assumptions'],
            ['Monthly mortgage', Fmt::money($pay, ''), ''],
        ], 'table' => ['head' => ['Year', 'Buyer', 'Renter', 'Buy − Rent'], 'rows' => $rows]];
    }
}
