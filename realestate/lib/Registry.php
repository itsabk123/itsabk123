<?php
declare(strict_types=1);

namespace SS;

/**
 * Model registry: every model the platform uses, with status, purpose,
 * assumptions, limitations, training data and validation. Status values:
 *   operational — implemented, tested in tests/run.php, used in reports
 *   user-data   — implemented and tested, runs only on data the user supplies
 *   planned     — not implemented; never shown as a result
 */
final class Registry
{
    public static function models(): array
    {
        return [
            ['Discounted cash flow (IRR, MIRR, NPV, equity multiple)', Proforma::VERSION, 'operational', 'Return metrics over the holding period.',
                'Annual periods; sale at end of final year at price × (1+g)^H less selling costs and loan balance; pre-tax.', 'No tax; annual (not monthly) discounting; constant growth rates in the base case.',
                'None (deterministic).', 'Benchmarked against independently computed cases (textbook IRR/MIRR/NPV, amortisation balances, zero-interest and negative-cash-flow cases).'],
            ['Mortgage amortisation', Proforma::VERSION, 'operational', 'Debt service, balances, interest-only periods.',
                'Monthly payments, fixed rate per scenario.', 'Variable-rate resets modelled only as a shift in the simulation, not as a reset schedule.', 'None.', 'Closed-form payment and balance checks.'],
            ['Monte Carlo simulation', MonteCarlo::VERSION, 'operational', 'Distribution of IRR, profit and cash flow; P(loss), P(target), VaR/CVaR.',
                'Per-path average price change and rent growth ~ Normal, correlated ρ=0.5; rent level ~ Normal (or Bayesian posterior); vacancy ~ truncated Normal; costs ~ lognormal; seeded xorshift RNG.',
                'Parameter uncertainty is user-set; no fat tails or regime switches; per-path averages understate path volatility within a hold.', 'None — driven by user ranges.',
                'Reproducibility with fixed seed; degenerate case equals deterministic result; median stable across seeds; percentile ordering; CVaR ≥ VaR.'],
            ['Bayesian rent update (normal–normal)', Bayes::VERSION, 'user-data', 'Combine the user\'s rent estimate with rental comparables.',
                'Conjugate normal prior on mean rent; observation sd from comparables (or 15% if fewer than 3); size-adjusted per area.', 'Assumes comparables are exchangeable draws; no hierarchy across locations.',
                'User-entered rental comparables only.', 'Analytic posterior check; prior-sensitivity reported in every report.'],
            ['Comparable sales valuation', Valuation::VERSION, 'user-data', 'Indicative value from weighted price per area.',
                'Weights: recency e^(−months/12), distance 1/(1+km), size e^(−2|ln ratio|), transactions 1.0 vs asking 0.6, condition 1−0.3|Δ|. Past sales time-adjusted by the user\'s growth assumption.',
                'Heuristic weights, not estimated; quality depends entirely on comparables; minimum 3 with area.', 'User-entered comparables.', 'Identical-comps exactness; asking discount and time-adjustment checks.'],
            ['Hedonic regression', Valuation::VERSION, 'user-data', 'Value from property characteristics.',
                'log(price) linear in ln(area), bedrooms, age, condition, asking flag; standardised; ridge λ=1 when n < 3(k+1); ≤ n/4 parameters.',
                'Small samples; no spatial terms; coefficients are associations, not causal.', 'User-entered sale comparables (n ≥ 8).', 'Recovers known synthetic model within 3%; leave-one-out error reported per report.'],
            ['Damped Holt exponential smoothing', Forecast::VERSION, 'user-data', 'Forecast a price/rent/vacancy series.',
                'Grid-searched α, β, φ on one-step SSE; intervals from residual sd × √h.', 'No seasonality term; intervals approximate; breaks not modelled.', 'User-pasted series.',
                'Mandatory rolling-origin backtest versus naive and drift baselines; linear-trend recovery test.'],
            ['OLS regression with diagnostics', 'ols-1.0.0', 'user-data', 'Econometric relationships between market variables.',
                'Classical and HC1 robust SEs; VIF; Breusch–Pagan (Koenker); Durbin–Watson.', 'No automatic structural-break test; no causal identification.', 'User-pasted dataset.', 'Exact-recovery test; inverse, p-value and VIF unit tests.'],
            ['Scenario & sensitivity analysis', Proforma::VERSION, 'operational', 'Optimistic/base/pessimistic/severe scenarios, tornado, rent × price matrix, vacancy table.',
                'Published fixed deltas around the user base case.', 'Scenarios are not probabilities.', 'None.', 'Scenario ordering test.'],
            ['Risk register', Analysis::VERSION, 'operational', 'Leverage, DSCR, vacancy, rate, liquidity, market, currency, concentration, construction, lease, environmental, political, regulatory.',
                'Rule-based thresholds on inputs; VaR/CVaR from simulation; qualitative risks only from user reports.', 'Thresholds are conventions, not calibrated default probabilities; unassessed risks are shown as "not assessed".', 'None.', 'Covered via full-analysis tests.'],
            ['Multi-criteria investment scoring', Scoring::VERSION, 'operational', 'Fit for the user\'s objective.',
                'Piecewise-linear curves per metric; objective-specific weights; hard-constraint caps; unrated dimensions excluded.', 'Curves are explicit judgements, published for scrutiny; not a probability of success.', 'None.', 'Curve interpolation and weight-normalisation tests.'],
            ['Data confidence score', Analysis::VERSION, 'operational', 'How much of the analysis rests on evidence.',
                'Inputs 35%, comparable evidence 30%, verification 20%, market data 15% (always 0 in this build).', 'Counts evidence; does not judge its truth.', 'None.', 'Market component asserted 0.'],
            ['Gradient boosting / random forest valuation (AVM)', '—', 'planned', 'Automated valuation at scale.', 'Requires licensed transaction data with time-aware and geographic validation, SHAP explainability and drift monitoring.', 'Not implemented — no training data.', 'None.', 'Not applicable.'],
            ['Spatial econometrics & geospatial clustering', '—', 'planned', 'Location effects and submarket detection.', 'Requires geocoded transactions.', 'Not implemented.', 'None.', 'Not applicable.'],
            ['Survival analysis (time-to-let / time-to-sell)', '—', 'planned', 'Liquidity and vacancy duration.', 'Requires listing lifecycle data.', 'Not implemented.', 'None.', 'Not applicable.'],
            ['Real options & portfolio optimisation', '—', 'planned', 'Development timing; multi-asset allocation.', 'Requires return covariance estimates from market data.', 'Not implemented.', 'None.', 'Not applicable.'],
        ];
    }
}
