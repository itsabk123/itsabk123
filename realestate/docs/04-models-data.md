# 04 — Financial & scientific model specification, data register, coverage

The live, always-current versions are `methodology.php` (formulas, curves, weights, registry) and
`lib/Registry.php`. This document adds the design reasoning.

## 1. Financial calculation specification

Inputs are normalised by `Inputs::normalise()` — every value tagged `user | default | derived | missing`.
Annual model, end-of-year cash flows, sale at end of year H, pre-tax, original currency preserved.

```
price          = purchase price (asking if blank)
loan           = price × (1 − down%)            (0 if cash)
acq_costs      = price × (acq_tax% + brokerage%) + legal + other + loan_fees
equity0        = price − loan + acq_costs + renovation
GPR_t          = rent_m × 12 × (1+g_rent)^(t−1)
collected_t    = GPR_t × (1 − vacancy)
EGI_t          = collected_t + other_m × 12 × (1+g_rent)^(t−1)
opex_t         = collected_t × mgmt% + (fixed + price × maint%) × (1+g_cost)^(t−1)
NOI_t          = EGI_t − opex_t
CF_t           = NOI_t − DS_t − collected_t × capex%
exit           = price × (1+g_price)^H × (1 − sell%) − balance_H
flows          = [−equity0, CF_1, …, CF_H + exit]
```
Short-term rentals: rent_m = nightly × 365/12 × occupancy × (1 − fees%); vacancy set to 0 because
occupancy already captures empty nights (tagged *derived*).

Benchmarks in `tests/run.php` were computed independently (Python): PMT 200k/6%/30y = 1,199.1011;
balance after 12 = 197,543.98; IRR[−1000,300,400,500] = 8.8963%; MIRR(10%,12%) = 9.8157%;
NPV(10%) = −21.0368; zero-rate loans; negative cash flow; IO periods; manual-flow IRR reconciliation.

## 2. Scientific model specification

| Model | Method | Why this choice | Known limits | Validation |
|---|---|---|---|---|
| Monte Carlo | Seeded xorshift32 + Box–Muller; per-path average price change & rent growth (ρ=0.5), rent level, vacancy (truncated), costs (lognormal, mean-preserving), variable-rate shift, optional FX lognormal path | Captures the main drivers of property returns with explainable inputs | No fat tails / regime switching; per-path averages | Degenerate = deterministic; reproducible; cross-seed median stable; CVaR ≥ VaR; convergence checkpoints shown |
| Bayesian rent | Normal–normal conjugate; obs sd from comps (15% if n<3) | Closed form, transparent, shows how much the evidence moved the estimate | Exchangeability; no spatial hierarchy | Analytic check; prior-sensitivity (×0.5/×1/×2) printed in each report |
| Comparables | Weighted price/area; recency, distance, size, evidence type, condition | Mirrors appraisal practice without inventing adjustment coefficients | Heuristic weights | Exactness tests; time & asking adjustments |
| Hedonic | log-linear OLS, standardised, ridge when n < 3(k+1), ≤ n/4 params | Classical hedonic pricing with small-sample protection | Small n; no spatial terms | Recovers synthetic truth within 3%; LOOCV MAPE per report |
| Reconciliation | Inverse-variance weighting | Precision-weighted, standard meta-analytic combination | Assumes independence | Unit test |
| Forecasting | Damped Holt (α, β, φ grid) | Robust default for trended housing series | No seasonality; approximate intervals | Mandatory rolling backtest vs naive & drift; result flagged when it doesn't beat naive |
| Econometrics | OLS + HC1, VIF, Breusch–Pagan, Durbin–Watson | Required diagnostics from the brief | No break test, no causal ID | Exact recovery, p-value and VIF tests |
| Scoring (MCDA) | Piecewise curves, objective weights, hard-constraint caps | Avoids averaging away fatal flaws; fully published | Curves are judgements | Curve & weight tests |
| Risk | Thresholds + VaR/CVaR | Transparent conventions | Not calibrated PDs | Full-analysis tests |

**Not implemented (shown as "planned" only):** gradient boosting/RF/XGBoost AVM, SHAP, spatial
econometrics, clustering, survival analysis, Markov, agent-based models, Bayesian networks, real
options, portfolio optimisation, CAPM comparisons. All require licensed transaction/market data
with time-aware and geographic validation — building them on no data would violate the brief.

## 3. Data source & licensing register

No external data source is ingested in v3. Candidate sources (licence/terms to be verified before use):

| Source | Data | Granularity | Licence (verify) | API | Status |
|---|---|---|---|---|---|
| HM Land Registry Price Paid (UK) | Transactions | Address | Open Government Licence | Bulk CSV | Candidate |
| ONS HPI / private rents (UK) | Indices | Region / LA | OGL | CSV/API | Candidate |
| Dubai Land Department / Dubai Pulse | Transactions, rents | Area / project | Open data terms | API | Candidate |
| DVF (France) | Transactions | Parcel | Licence Ouverte | Bulk | Candidate |
| FHFA HPI (US) | Indices | Metro/state | Public | CSV | Candidate |
| data.gov.sg HDB resale | Transactions | Block | SG Open Data Licence | API | Candidate |
| MLIT (Japan) | Transactions | District | Gov terms | API | Candidate |
| World Bank WDI | Macro | Country/year | CC BY 4.0 | API | Candidate |
| IMF IFS/WEO | Macro, FX, rates | Country | IMF terms | API | Candidate |
| OECD / BIS house prices | Indices | Country/quarter | Terms vary | API | Candidate |
| OpenStreetMap | Amenities, transport | Point | ODbL (share-alike) | Overpass | Candidate |
| Commercial providers (portals, data vendors) | Listings, rents, comps | Address | Commercial contract | API | Requires contract |

For each integration record: coverage, granularity, update frequency, historical depth, accuracy
evidence, licence & redistribution rights, cost, rate limits, provenance field mapping. Ingested
records must keep a `source_type` (verified transaction / listing / asking / third-party estimate /
model estimate / user-provided / statistic / forecast) — the same taxonomy already used for comps.

## 4. Country coverage matrix
Identical for all 30 listed countries in this build (`Countries::capabilities()`):

| Capability | Status |
|---|---|
| Financial calculations, Monte Carlo, scenarios | Operational |
| Comparable valuation, hedonic, Bayesian rent, forecasting | Partial (user-supplied data) |
| Local tax / transaction-cost rules | Unavailable (user enters figures) |
| Market statistics | Unavailable |
| Climate / flood data | Unavailable (user-reported) |
| Live FX | Unavailable (user enters rate, source, date) |

Currencies are never mixed: portfolio totals are per currency; reporting-currency conversion uses the
user's stated rate with source and date printed beside it.
