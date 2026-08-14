<?php

declare(strict_types=1);

/**
 * The "prediction" behind RealtyCompass is a deterministic weighted-score
 * rules engine, not a machine-learning model — it needs no training data,
 * no inference cost, and runs comfortably on shared PHP hosting. Every
 * match can be explained by naming the rules that fired for it.
 */

function rc_category_labels(): array
{
    return [
        'residential' => 'Residential',
        'commercial'  => 'Commercial',
        'rental'      => 'Rental / Buy-to-Let',
        'for_sale'    => 'For Sale / Flip',
        'other'       => 'Other / Land',
    ];
}

function rc_category_descriptions(): array
{
    return [
        'residential' => 'Single-family homes, condos, and small multi-unit properties bought to hold or improve.',
        'commercial'  => 'Retail, office, and mixed-use buildings leased to businesses.',
        'rental'      => 'Buy-to-let properties held for steady monthly cash flow.',
        'for_sale'    => 'Properties bought to renovate and resell quickly.',
        'other'       => 'Land, niche opportunities, and REIT-adjacent investments outside the main categories.',
    ];
}

function rc_budget_options(): array
{
    return [
        'under_50k' => 'Under $50k',
        '50k_150k'  => '$50k – $150k',
        '150k_350k' => '$150k – $350k',
        '350k_750k' => '$350k – $750k',
        '750k_plus' => '$750k+',
    ];
}

function rc_goal_options(): array
{
    return [
        'cash_flow'       => 'Cash flow',
        'appreciation'    => 'Long-term appreciation',
        'flip'            => 'Quick resale / flip',
        'diversification' => 'Portfolio diversification',
    ];
}

function rc_risk_options(): array
{
    return [
        'conservative' => 'Conservative',
        'balanced'     => 'Balanced',
        'aggressive'   => 'Aggressive',
    ];
}

function rc_timeline_options(): array
{
    return [
        'under_1y' => 'Under 1 year',
        '1_3y'     => '1 – 3 years',
        '3_5y'     => '3 – 5 years',
        '5y_plus'  => '5+ years',
    ];
}

function rc_market_options(): array
{
    return [
        'urban'    => 'Urban',
        'suburban' => 'Suburban',
        'rural'    => 'Rural',
        'any'      => 'No preference',
    ];
}

/** category => point delta, keyed by question => answer. */
function rc_rules(): array
{
    return [
        'budget' => [
            'under_50k' => ['residential' => 3, 'rental' => 3, 'for_sale' => 1],
            '50k_150k'  => ['residential' => 3, 'rental' => 3, 'for_sale' => 1],
            '150k_350k' => ['residential' => 2, 'rental' => 2, 'for_sale' => 1, 'commercial' => 1],
            '350k_750k' => ['commercial' => 3, 'for_sale' => 2],
            '750k_plus' => ['commercial' => 3, 'for_sale' => 2, 'other' => 1],
        ],
        'goal' => [
            'cash_flow'       => ['rental' => 4, 'residential' => 2],
            'appreciation'    => ['residential' => 3, 'commercial' => 2],
            'flip'            => ['for_sale' => 4, 'residential' => 1],
            'diversification' => ['other' => 3, 'commercial' => 1, 'rental' => 1],
        ],
        'risk' => [
            'conservative' => ['rental' => 2, 'residential' => 2, 'for_sale' => -2],
            'balanced'     => ['residential' => 1, 'rental' => 1],
            'aggressive'   => ['for_sale' => 3, 'commercial' => 2],
        ],
        'timeline' => [
            'under_1y' => ['for_sale' => 3],
            '1_3y'     => ['for_sale' => 1, 'residential' => 1],
            '3_5y'     => ['residential' => 2, 'commercial' => 1],
            '5y_plus'  => ['rental' => 3, 'commercial' => 2],
        ],
    ];
}

/** Human-readable reason per question => answer => category, only for rules with a positive delta. */
function rc_reasons(): array
{
    return [
        'budget' => [
            'under_50k' => [
                'residential' => 'your budget fits smaller residential entry points',
                'rental'      => 'your budget fits smaller rental entry points',
                'for_sale'    => 'your budget still allows a modest flip project',
            ],
            '50k_150k' => [
                'residential' => 'your budget fits smaller residential entry points',
                'rental'      => 'your budget fits smaller rental entry points',
                'for_sale'    => 'your budget still allows a modest flip project',
            ],
            '150k_350k' => [
                'residential' => 'your budget is a comfortable fit for residential purchases',
                'rental'      => 'your budget is a comfortable fit for rental purchases',
                'for_sale'    => 'your budget covers a mid-size flip',
                'commercial'  => 'your budget can stretch to a small commercial unit',
            ],
            '350k_750k' => [
                'commercial' => 'your budget supports a meaningful commercial purchase',
                'for_sale'   => 'your budget covers a larger renovation project',
            ],
            '750k_plus' => [
                'commercial' => 'your budget supports a larger commercial purchase',
                'for_sale'   => 'your budget covers a substantial renovation project',
                'other'      => 'your budget opens up land and niche opportunities',
            ],
        ],
        'goal' => [
            'cash_flow' => [
                'rental'      => 'your goal is steady cash flow',
                'residential' => 'your goal is steady cash flow',
            ],
            'appreciation' => [
                'residential' => 'your goal is long-term appreciation',
                'commercial'  => 'your goal is long-term appreciation',
            ],
            'flip' => [
                'for_sale'    => 'your goal is a quick resale',
                'residential' => 'your goal is a quick resale',
            ],
            'diversification' => [
                'other'      => 'your goal is portfolio diversification',
                'commercial' => 'your goal is portfolio diversification',
                'rental'     => 'your goal is portfolio diversification',
            ],
        ],
        'risk' => [
            'conservative' => [
                'rental'      => 'you prefer a conservative risk level',
                'residential' => 'you prefer a conservative risk level',
            ],
            'balanced' => [
                'residential' => 'you prefer a balanced risk level',
                'rental'      => 'you prefer a balanced risk level',
            ],
            'aggressive' => [
                'for_sale'   => 'you\'re comfortable with an aggressive risk level',
                'commercial' => 'you\'re comfortable with an aggressive risk level',
            ],
        ],
        'timeline' => [
            'under_1y' => [
                'for_sale' => 'you\'re working with a timeline under a year',
            ],
            '1_3y' => [
                'for_sale'    => 'your 1–3 year timeline suits a faster turnaround',
                'residential' => 'your 1–3 year timeline suits a faster turnaround',
            ],
            '3_5y' => [
                'residential' => 'your 3–5 year timeline suits a medium hold',
                'commercial'  => 'your 3–5 year timeline suits a medium hold',
            ],
            '5y_plus' => [
                'rental'     => 'your 5+ year timeline suits a long hold',
                'commercial' => 'your 5+ year timeline suits a long hold',
            ],
        ],
    ];
}

function rc_next_action(string $category, string $region): string
{
    $place = $region !== '' ? $region : 'your target area';

    $actions = [
        'residential' => "Start viewing single-family or small multi-unit listings in {$place}.",
        'commercial'  => "Talk to a commercial broker about retail or office space in {$place}.",
        'rental'      => "Screen buy-to-let listings in {$place} for strong rent-to-price ratios.",
        'for_sale'    => "Look for undervalued fixer-uppers in {$place} with a clear resale comp.",
        'other'       => "Explore land parcels or niche opportunities tied to {$place}'s growth.",
    ];

    return $actions[$category] ?? "Research opportunities in {$place}.";
}

/**
 * Score a completed step-one answer set and return the top matches
 * (score > 0, capped at 3), sorted highest first.
 *
 * @param array{categories: string[], budget: string, goal: string, risk: string, timeline: string} $answers
 */
function rc_score(array $answers): array
{
    $rules   = rc_rules();
    $reasons = rc_reasons();
    $labels  = rc_category_labels();

    $scores = array_fill_keys(array_keys($labels), 0);
    $why    = array_fill_keys(array_keys($labels), []);

    foreach (['budget', 'goal', 'risk', 'timeline'] as $question) {
        $answer = $answers[$question] ?? '';
        if ($answer === '' || !isset($rules[$question][$answer])) {
            continue;
        }
        foreach ($rules[$question][$answer] as $category => $delta) {
            $scores[$category] += $delta;
            if ($delta > 0 && isset($reasons[$question][$answer][$category])) {
                $why[$category][] = $reasons[$question][$answer][$category];
            }
        }
    }

    foreach ($answers['categories'] ?? [] as $category) {
        if (!array_key_exists($category, $scores)) {
            continue;
        }
        $scores[$category] += 5;
        $why[$category][] = "you told us you're specifically interested in {$labels[$category]}";
    }

    $descriptions = rc_category_descriptions();
    $region = trim((string) ($answers['region'] ?? ''));

    $results = [];
    foreach ($scores as $category => $score) {
        if ($score <= 0) {
            continue;
        }
        $results[] = [
            'category'    => $category,
            'label'       => $labels[$category],
            'description' => $descriptions[$category],
            'score'       => $score,
            'reasons'     => array_values(array_unique($why[$category])),
            'next_action' => rc_next_action($category, $region),
        ];
    }

    usort($results, static fn(array $a, array $b): int => $b['score'] <=> $a['score']);

    return array_slice($results, 0, 3);
}
