<?php
declare(strict_types=1);

namespace SS;

final class View
{
    public const NAV = [
        ['index.php', 'Home'],
        ['evaluate.php', 'Evaluate Property'],
        ['markets.php', 'Explore Markets'],
        ['tools.php', 'Investment Tools'],
        ['marketplace.php', 'Marketplace'],
        ['insights.php', 'Insights'],
        ['pricing.php', 'Pricing'],
    ];

    /** Render one schema field. $val is the current value, $err an error string. */
    public static function field(array $def, $val, ?string $err = null, string $prefix = ''): string
    {
        $k = $def['key'];
        $name = $prefix ? $prefix . '[' . $k . ']' : $k;
        $id = 'f_' . $k;
        $help = $def['help'] ?? ($def['assumption'] ?? '');
        $req = !empty($def['required']);
        $unit = $def['type'] === 'percent' ? '%' : '';
        $h = '<div class="field' . ($err ? ' has-err' : '') . '" data-key="' . e($k) . '">';
        $h .= '<label for="' . $id . '">' . e($def['label']) . ($req ? ' <span class="req" aria-hidden="true">*</span>' : '') . '</label>';
        if ($def['type'] === 'select') {
            $h .= '<select id="' . $id . '" name="' . e($name) . '"' . ($req ? ' required' : '') . '>';
            if ($req && $def['default'] === null) {
                $h .= '<option value="">Choose…</option>';
            }
            foreach ($def['options'] as $ov => $ol) {
                $h .= '<option value="' . e($ov) . '"' . ((string) $val === (string) $ov ? ' selected' : '') . '>' . e($ol) . '</option>';
            }
            $h .= '</select>';
        } else {
            $type = $def['type'] === 'date' ? 'date' : ($def['type'] === 'text' ? 'text' : 'text');
            $mode = in_array($def['type'], ['number', 'money', 'percent', 'int'], true) ? ' inputmode="decimal"' : '';
            $ph = ($def['default'] !== null && $def['default'] !== '' && $def['type'] !== 'text') ? ' placeholder="' . e($def['default']) . '"' : '';
            $h .= '<div class="inwrap' . ($unit ? ' has-unit' : '') . '"><input id="' . $id . '" name="' . e($name) . '" type="' . $type . '"' . $mode . $ph . ' value="' . e($val ?? '') . '"' . ($req ? ' required' : '') . (isset($def['max']) && $def['type'] === 'text' ? ' maxlength="' . (int) $def['max'] . '"' : '') . '>' . ($unit ? '<span class="unit">' . $unit . '</span>' : '') . '</div>';
        }
        if ($err) {
            $h .= '<p class="err" role="alert">' . e($err) . '</p>';
        } elseif ($help) {
            $h .= '<p class="hint">' . e($help) . (!empty($def['assumption']) && $def['default'] !== null ? ' Default: ' . e($def['default']) . $unit . '.' : '') . '</p>';
        }
        return $h . '</div>';
    }

    public static function prov(string $p): string
    {
        $map = ['user' => ['You', 'user'], 'default' => ['Default assumption', 'default'], 'missing' => ['Missing', 'missing'], 'derived' => ['Derived', 'derived']];
        [$l, $c] = $map[$p] ?? [$p, 'default'];
        return '<span class="prov prov-' . $c . '">' . e($l) . '</span>';
    }

    public static function level(string $lvl): string
    {
        $map = ['low' => ['Low', 'ok'], 'medium' => ['Medium', 'warn'], 'high' => ['High', 'bad'], 'not_assessed' => ['Not assessed', 'na']];
        [$l, $c] = $map[$lvl] ?? [$lvl, 'na'];
        $icon = ['ok' => '●', 'warn' => '▲', 'bad' => '■', 'na' => '○'][$c];
        return '<span class="lvl lvl-' . $c . '"><span aria-hidden="true">' . $icon . '</span> ' . e($l) . '</span>';
    }

    public static function stat(string $label, string $value, string $note = '', string $tone = ''): string
    {
        return '<div class="stat' . ($tone ? ' tone-' . $tone : '') . '"><div class="stat-l">' . e($label) . '</div><div class="stat-v">' . e($value) . '</div>' . ($note ? '<div class="stat-n">' . e($note) . '</div>' : '') . '</div>';
    }

    public static function tone(?float $x, float $good = 0, ?float $bad = null): string
    {
        if ($x === null) {
            return '';
        }
        $bad = $bad ?? $good;
        return $x > $good ? 'pos' : ($x < $bad ? 'neg' : '');
    }

    public static function table(array $head, array $rows, string $cls = ''): string
    {
        $h = '<div class="tablewrap"><table class="' . e($cls) . '"><thead><tr>';
        foreach ($head as $c) {
            $h .= '<th scope="col">' . e($c) . '</th>';
        }
        $h .= '</tr></thead><tbody>';
        foreach ($rows as $r) {
            $h .= '<tr>';
            foreach (array_values($r) as $i => $c) {
                $h .= $i === 0 ? '<th scope="row">' . e($c) . '</th>' : '<td>' . e($c) . '</td>';
            }
            $h .= '</tr>';
        }
        return $h . '</tbody></table></div>';
    }

    public static function badge(string $text, string $kind = ''): string
    {
        return '<span class="badge' . ($kind ? ' badge-' . e($kind) : '') . '">' . e($text) . '</span>';
    }

    public static function pager(int $page, int $pages, array $q, string $path): string
    {
        if ($pages <= 1) {
            return '';
        }
        $h = '<nav class="pager" aria-label="Pages">';
        if ($page > 1) {
            $h .= '<a href="' . e(url($path, $q + ['page' => $page - 1])) . '">← Previous</a>';
        }
        $h .= '<span>Page ' . $page . ' of ' . $pages . '</span>';
        if ($page < $pages) {
            $h .= '<a href="' . e(url($path, $q + ['page' => $page + 1])) . '">Next →</a>';
        }
        return $h . '</nav>';
    }
}
