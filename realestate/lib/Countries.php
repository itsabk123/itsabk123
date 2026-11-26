<?php
declare(strict_types=1);

namespace SS;

/**
 * Country configuration and the coverage matrix.
 *
 * Coverage statuses are deliberately conservative:
 *  - operational: works today in this build
 *  - partial:     works with user-supplied evidence only
 *  - unavailable: no integrated source — we do not estimate or invent it
 *
 * "Candidate sources" are official/open datasets identified for future
 * integration. Their licence terms MUST be verified before ingestion; none
 * is ingested in this build.
 */
final class Countries
{
    /** iso => [name, currency, default area unit, region, candidate official sources] */
    public const LIST = [
        'AE' => ['United Arab Emirates', 'AED', 'sqft', 'Middle East', ['Dubai Land Department open data (Dubai Pulse)', 'Abu Dhabi DARI / ADREC publications', 'Central Bank of the UAE statistics']],
        'SA' => ['Saudi Arabia', 'SAR', 'sqm', 'Middle East', ['Real Estate General Authority (REGA) indicators', 'GASTAT real estate price index', 'SAMA statistics']],
        'QA' => ['Qatar', 'QAR', 'sqm', 'Middle East', ['Ministry of Justice real estate bulletins', 'Qatar Central Bank statistics']],
        'EG' => ['Egypt', 'EGP', 'sqm', 'Middle East', ['CAPMAS statistics', 'Central Bank of Egypt']],
        'TR' => ['Türkiye', 'TRY', 'sqm', 'Europe', ['TurkStat house sales statistics', 'CBRT residential property price index']],
        'GB' => ['United Kingdom', 'GBP', 'sqft', 'Europe', ['HM Land Registry Price Paid Data (Open Government Licence)', 'ONS House Price Index & private rents', 'Bank of England statistics']],
        'IE' => ['Ireland', 'EUR', 'sqm', 'Europe', ['Residential Property Price Register', 'CSO RPPI']],
        'DE' => ['Germany', 'EUR', 'sqm', 'Europe', ['Destatis house price index', 'Gutachterausschüsse (local valuation boards)']],
        'FR' => ['France', 'EUR', 'sqm', 'Europe', ['DVF — Demandes de valeurs foncières (open data)', 'INSEE housing price indices']],
        'ES' => ['Spain', 'EUR', 'sqm', 'Europe', ['INE housing price index', 'Registradores / Notariado statistics']],
        'PT' => ['Portugal', 'EUR', 'sqm', 'Europe', ['INE Portugal housing statistics']],
        'IT' => ['Italy', 'EUR', 'sqm', 'Europe', ['Agenzia delle Entrate OMI quotations', 'ISTAT house price index']],
        'NL' => ['Netherlands', 'EUR', 'sqm', 'Europe', ['CBS house prices', 'Kadaster']],
        'CH' => ['Switzerland', 'CHF', 'sqm', 'Europe', ['FSO residential property price index', 'SNB statistics']],
        'US' => ['United States', 'USD', 'sqft', 'Americas', ['FHFA House Price Index', 'US Census housing data (ACS, construction)', 'County recorder / assessor records (licence varies by county)']],
        'CA' => ['Canada', 'CAD', 'sqft', 'Americas', ['Statistics Canada new housing price index', 'CMHC housing market data']],
        'MX' => ['Mexico', 'MXN', 'sqm', 'Americas', ['SHF house price index', 'INEGI']],
        'BR' => ['Brazil', 'BRL', 'sqm', 'Americas', ['IBGE', 'Banco Central do Brasil statistics']],
        'AU' => ['Australia', 'AUD', 'sqm', 'Asia-Pacific', ['ABS total value of dwellings / RPPI', 'State valuer-general sales data (licence varies)']],
        'NZ' => ['New Zealand', 'NZD', 'sqm', 'Asia-Pacific', ['Stats NZ', 'RBNZ housing statistics']],
        'SG' => ['Singapore', 'SGD', 'sqft', 'Asia-Pacific', ['data.gov.sg HDB resale prices', 'URA private property data']],
        'MY' => ['Malaysia', 'MYR', 'sqft', 'Asia-Pacific', ['NAPIC property market reports']],
        'TH' => ['Thailand', 'THB', 'sqm', 'Asia-Pacific', ['Bank of Thailand housing indices']],
        'IN' => ['India', 'INR', 'sqft', 'Asia-Pacific', ['RBI house price index', 'NHB RESIDEX']],
        'JP' => ['Japan', 'JPY', 'sqm', 'Asia-Pacific', ['MLIT Real Estate Information Library (transaction prices)']],
        'HK' => ['Hong Kong SAR', 'HKD', 'sqft', 'Asia-Pacific', ['Rating and Valuation Department statistics', 'Land Registry statistics']],
        'ZA' => ['South Africa', 'ZAR', 'sqm', 'Africa', ['Stats SA', 'SARB statistics']],
        'NG' => ['Nigeria', 'NGN', 'sqm', 'Africa', ['National Bureau of Statistics']],
        'KE' => ['Kenya', 'KES', 'sqm', 'Africa', ['KNBS', 'Central Bank of Kenya']],
        'PK' => ['Pakistan', 'PKR', 'sqft', 'Asia-Pacific', ['Pakistan Bureau of Statistics', 'State Bank of Pakistan']],
        'OTHER' => ['Other / not listed', 'USD', 'sqm', 'Other', []],
    ];

    public const EXTRA_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CNY', 'KWD', 'BHD', 'OMR', 'SEK', 'NOK', 'DKK', 'PLN'];

    public const GLOBAL_SOURCES = [
        ['World Bank — World Development Indicators', 'Macro (GDP, population, inflation)', 'Country / annual', 'CC BY 4.0 (verify per series)', 'Not integrated'],
        ['IMF — International Financial Statistics / WEO', 'Macro, rates, FX', 'Country / monthly–annual', 'IMF terms (verify redistribution rights)', 'Not integrated'],
        ['OECD — Analytical house price indicators', 'House prices, rent indices', 'Country / quarterly', 'OECD terms (verify)', 'Not integrated'],
        ['BIS — Residential property prices', 'House price indices', 'Country / quarterly', 'BIS terms (verify)', 'Not integrated'],
        ['UN DESA — World Population Prospects', 'Population projections', 'Country / annual', 'CC BY 3.0 IGO (verify)', 'Not integrated'],
        ['OpenStreetMap', 'Amenities, transport, POIs', 'Point / continuous', 'ODbL — attribution & share-alike', 'Not integrated'],
        ['Central bank policy rates (per country)', 'Interest rates', 'Country / as published', 'Varies', 'Not integrated'],
        ['Licensed listing & transaction providers', 'Comparables, rents', 'Address-level', 'Commercial contract required', 'Not integrated'],
    ];

    public static function options(): array
    {
        $o = [];
        foreach (self::LIST as $iso => $c) {
            $o[$iso] = $c[0];
        }
        return $o;
    }

    public static function currencyOptions(): array
    {
        $c = [];
        foreach (self::LIST as $row) {
            $c[$row[1]] = $row[1];
        }
        foreach (self::EXTRA_CURRENCIES as $x) {
            $c[$x] = $x;
        }
        ksort($c);
        return $c;
    }

    public static function name(string $iso): string
    {
        return self::LIST[$iso][0] ?? $iso;
    }

    /** Capability matrix rows: [capability, status, note]. Same for all countries in this build. */
    public static function capabilities(): array
    {
        return [
            ['Financial calculations (yield, cash flow, IRR, NPV, mortgage)', 'operational', 'Currency-agnostic; works anywhere with your inputs.'],
            ['Monte Carlo & scenario analysis', 'operational', 'Driven by your assumptions and uncertainty ranges.'],
            ['Comparable-sales valuation', 'partial', 'Operational on comparables you enter; no integrated transaction feed.'],
            ['Hedonic regression valuation', 'partial', 'Runs when you supply ≥ 8 sale comparables.'],
            ['Bayesian rent estimate', 'partial', 'Updates your estimate with rental comparables you enter.'],
            ['Time-series forecasting', 'partial', 'Runs on a historical series you paste (Market Lab).'],
            ['Local tax & transaction-cost rules', 'unavailable', 'Not encoded — enter your own figures; rules differ by buyer type and change often.'],
            ['Market statistics (prices, rents, vacancy)', 'unavailable', 'No licensed source integrated yet. We do not display invented figures.'],
            ['Climate / flood datasets', 'unavailable', 'User-reported only until a verified dataset is integrated.'],
            ['Live FX rates', 'unavailable', 'Enter the rate, source and date yourself; the report records them.'],
        ];
    }
}
