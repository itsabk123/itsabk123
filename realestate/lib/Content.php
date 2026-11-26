<?php
declare(strict_types=1);

namespace SS;

/**
 * Seed editorial content. These are explanatory guides about methodology —
 * they contain no market statistics, so nothing here needs a data source.
 */
final class Content
{
    public static function seed(\PDO $pdo): void
    {
        $now = gmdate('Y-m-d H:i:s');
        $st = $pdo->prepare('SELECT COUNT(*) FROM articles WHERE slug = ?');
        $ins = $pdo->prepare('INSERT INTO articles (slug, title, summary, body, disclosure, status, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        foreach (self::articles() as [$slug, $title, $summary, $body]) {
            $st->execute([$slug, ]);
            if ((int) $st->fetchColumn() === 0) {
                $ins->execute([$slug, $title, $summary, $body, 'editorial', 'published', $now, $now]);
            }
        }
    }

    public static function articles(): array
    {
        return [
            ['gross-yield-net-yield-cap-rate', 'Gross yield, net yield and cap rate: what each one tells you',
                'Three ratios that look alike but answer different questions — and why mixing them up leads to overpaying.',
                <<<'MD'
Most property listings quote a single "yield". Before comparing two properties, check which yield you are looking at, because the three common measures answer different questions.

## Gross yield
**Gross yield = annual rent ÷ price.** It is quick and needs only two numbers, which is why listings use it. It ignores vacancy, running costs, purchase taxes and financing, so it overstates what you keep — often by a wide margin in buildings with high service charges.

## Net yield
**Net yield = (rent after vacancy − operating costs) ÷ (price + purchase costs).** In Shelter and Sense reports the denominator includes acquisition taxes, legal fees, brokerage and initial renovation, because that is the cash the asset actually cost you. It still excludes the mortgage, so it describes the property, not your financing.

## Cap rate
**Cap rate = net operating income ÷ price.** Commercial brokers and valuers use cap rates to compare assets and to value them: value ≈ NOI ÷ market cap rate. Because it excludes purchase costs, a cap rate is slightly higher than net yield for the same property.

## Which one should you use?
- Use **gross yield** only for a first screen.
- Use **net yield** to compare properties you might buy.
- Use **cap rate** when talking to commercial brokers, or to value an income-producing asset with a market cap rate you can evidence.
- Use **cash-on-cash** and **IRR** once financing and your holding period are known.

## A common trap
A high gross yield with high service charges, short leases, or an expensive building to maintain can produce a lower net yield than a "boring" property with a lower headline number. Always rebuild the net figure yourself from the cost lines — the free Rental Yield Calculator and a full evaluation both show each line separately.
MD],
            ['reading-a-monte-carlo-range', 'Why a single "expected return" is misleading: reading a Monte Carlo range',
                'How to read simulated percentiles, probability of loss and VaR — and what they do not mean.',
                <<<'MD'
A spreadsheet gives you one IRR. Reality gives you one outcome out of many possible ones. Monte Carlo simulation makes that visible by re-running the cash-flow model thousands of times with rent, vacancy, costs, price growth and (for variable loans) interest rates drawn from ranges you set.

## What the outputs mean
- **Median IRR (P50):** half of simulated paths do better, half worse.
- **P5 and P95:** 90% of simulated paths fall between these two numbers.
- **Probability of loss:** the share of paths where total profit (all cash flows plus sale proceeds, minus your equity) is negative.
- **VaR 95%:** the loss exceeded in only the worst 5% of paths. **CVaR 95%** is the average loss within those worst 5%.

## What they do not mean
These are **model probabilities given your assumptions**, not objective odds. If you set price-change uncertainty at ±2 points when your market has historically swung ±10 points, the simulation will look reassuring and be wrong. The width of the range is only as honest as the uncertainty inputs.

## How the platform keeps simulations honest
- Every report shows the seed and number of runs, so results are reproducible.
- Convergence checkpoints show the probability estimate at a quarter, half and all runs; if they are still moving, increase the run count.
- Price growth and rent growth are correlated (ρ = 0.5) because they usually move together; treating them as independent would understate risk.
- Simulated outcomes are always labelled as simulations and never mixed with historical performance.

## Practical use
Compare the P5 outcome with what you can afford to lose. If a plausible bad case would force a sale, the median return matters much less than the downside.
MD],
            ['asking-prices-vs-transactions', 'Asking prices vs completed transactions: using comparables honestly',
                'Why the type, age and distance of each comparable matters more than the number of comparables.',
                <<<'MD'
A valuation is only as good as its evidence. The most common mistake investors make is treating advertised asking prices as if they were sale prices.

## Evidence hierarchy
1. **Completed transactions** recorded by a land registry or similar official source.
2. **Agreed sales** confirmed by an agent but not yet registered.
3. **Asking prices** — what a seller hopes to achieve. They can sit above eventual sale prices, especially in slow markets.

Shelter and Sense weights a completed transaction at 1.0 and an asking price at 0.6, and lets you apply your own percentage discount to asking prices. We do not apply a hidden default discount, because the gap varies by market and over time.

## Recency, distance and similarity
Each comparable's weight also falls with age (e^(−months/12)), distance (1 ÷ (1 + km)) and difference in size. Comparables in worse or better condition are weighted down rather than adjusted by an invented percentage.

## When we will not estimate
With fewer than three sale comparables with floor area, the comparable valuation is reported as **unavailable** rather than guessed. The hedonic regression needs at least eight, and reports its leave-one-out error so you can see how well it predicts properties it was not trained on.

## Good practice
- Prefer transactions from the last 12 months.
- Stay within the same building or micro-location where possible.
- Record the source of every comparable — reports show it next to each one.
MD],
            ['investment-property-due-diligence-checklist', 'A due-diligence checklist before you buy an investment property',
                'The checks that change the numbers — title, use, condition, rent evidence, taxes and exit.',
                <<<'MD'
The numbers in any investment model rest on facts that only due diligence can confirm. These are the checks that most often change a decision.

## Legal
- **Title and ownership:** a qualified local lawyer should confirm the seller owns the property and that there are no undisclosed charges or liens.
- **Permitted use:** confirm that your intended use — including short-term letting — is allowed by zoning, building rules and any licensing regime.
- **Tenure:** for leaseholds, check remaining term, ground rent and extension costs.

## Physical
- Commission an independent inspection or survey and price defects into your renovation budget.
- For apartments, request service-charge history and any planned major works.

## Income
- Ask for signed leases and payment history. An agent's rent estimate is a claim, not evidence.
- Check three or more independent rental comparables.

## Money
- Get a written financing offer: rate, fees, reset terms and early-repayment penalties.
- Confirm purchase taxes, annual property taxes, income tax on rent and tax on sale for **your** buyer status with a tax adviser. These differ by country, region and residency and change frequently.

## Exit
- Understand how long similar properties take to sell and who buys them. Illiquid assets need a longer horizon and a bigger cash buffer.

Every Shelter and Sense report includes a checklist tailored to the property type, tenure, construction status and currency of the deal.
MD],
        ];
    }

    /**
     * A clearly HYPOTHETICAL property used for the homepage demo and the example
     * report. Country "Other", illustrative comparables — not real market data.
     */
    public static function sampleInputs(): array
    {
        return [
            'country' => 'OTHER', 'city' => 'Sample City (hypothetical)', 'property_type' => 'apartment', 'subtype' => '2-bed apartment',
            'currency' => 'USD', 'asking_price' => 320000, 'purchase_price' => 310000, 'area' => 85, 'area_unit' => 'sqm', 'bedrooms' => 2, 'bathrooms' => 2,
            'building_age' => 12, 'condition' => 'good', 'tenure' => 'freehold', 'financing' => 'mortgage', 'down_payment_pct' => 25,
            'interest_rate_pct' => 5.5, 'rate_type' => 'fixed', 'loan_term_years' => 25, 'acq_tax_pct' => 4, 'legal_fees' => 2500, 'brokerage_pct' => 1,
            'insurance_annual' => 600, 'property_tax_annual' => 1200, 'service_charge_annual' => 1800, 'monthly_rent' => 1850, 'rent_basis' => 'expected',
            'objective' => 'wealth', 'hold_years' => 10, 'target_irr_pct' => 8, 'budget' => 110000,
            'comps' => [
                ['kind' => 'sale_txn', 'price' => 305000, 'area' => 82, 'bedrooms' => 2, 'age' => 10, 'months_ago' => 4, 'distance_km' => 0.4, 'condition' => 0, 'source' => 'Illustrative — not real data'],
                ['kind' => 'sale_txn', 'price' => 342000, 'area' => 92, 'bedrooms' => 2, 'age' => 6, 'months_ago' => 7, 'distance_km' => 0.9, 'condition' => 1, 'source' => 'Illustrative — not real data'],
                ['kind' => 'sale_txn', 'price' => 289000, 'area' => 80, 'bedrooms' => 2, 'age' => 18, 'months_ago' => 2, 'distance_km' => 0.6, 'condition' => -1, 'source' => 'Illustrative — not real data'],
                ['kind' => 'sale_ask', 'price' => 335000, 'area' => 86, 'bedrooms' => 2, 'age' => 11, 'months_ago' => 1, 'distance_km' => 0.3, 'condition' => 0, 'source' => 'Illustrative — not real data'],
                ['kind' => 'rent_contract', 'price' => 1800, 'area' => 84, 'source' => 'Illustrative — not real data'],
                ['kind' => 'rent_ask', 'price' => 1950, 'area' => 88, 'source' => 'Illustrative — not real data'],
            ],
        ];
    }
}
