<?php
declare(strict_types=1);

namespace SS;

/**
 * Server-rendered inline SVG charts. No chart library, no JS required, theme
 * colours come from CSS custom properties so light/dark both work. Every chart
 * carries an aria-label and the report always prints the underlying numbers
 * in a table next to it.
 */
final class Charts
{
    private static function t($s): string
    {
        return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
    }

    private static function open(int $w, int $h, string $label): string
    {
        return '<svg class="chart" viewBox="0 0 ' . $w . ' ' . $h . '" role="img" aria-label="' . self::t($label) . '" preserveAspectRatio="xMidYMid meet">';
    }

    private static function niceTicks(float $lo, float $hi, int $n = 5): array
    {
        if ($hi <= $lo) {
            $hi = $lo + 1;
        }
        $raw = ($hi - $lo) / $n;
        $mag = 10 ** floor(log10($raw));
        $step = $mag * (($raw / $mag) >= 5 ? 10 : (($raw / $mag) >= 2 ? 5 : (($raw / $mag) >= 1 ? 2 : 1)));
        $start = floor($lo / $step) * $step;
        $ticks = [];
        for ($v = $start; $v <= $hi + $step * 0.5; $v += $step) {
            $ticks[] = round($v, 10);
        }
        return $ticks;
    }

    /** Vertical bars with sign colouring (e.g. annual cash flow). */
    public static function bars(array $labels, array $values, string $label, callable $fmt): string
    {
        $W = 640;
        $H = 260;
        $L = 64;
        $R = 12;
        $T = 14;
        $B = 30;
        $lo = min(0, min($values));
        $hi = max(0, max($values));
        $ticks = self::niceTicks($lo, $hi, 4);
        $lo = min($lo, $ticks[0]);
        $hi = max($hi, end($ticks));
        $y = static fn($v) => $T + ($hi - $v) / ($hi - $lo ?: 1) * ($H - $T - $B);
        $n = count($values);
        $bw = ($W - $L - $R) / max(1, $n);
        $s = self::open($W, $H, $label);
        foreach ($ticks as $tv) {
            $yy = $y($tv);
            $s .= '<line class="grid" x1="' . $L . '" x2="' . ($W - $R) . '" y1="' . $yy . '" y2="' . $yy . '"/>';
            $s .= '<text class="axis" x="' . ($L - 6) . '" y="' . ($yy + 4) . '" text-anchor="end">' . self::t($fmt($tv)) . '</text>';
        }
        foreach ($values as $i => $v) {
            $x = $L + $i * $bw + $bw * 0.15;
            $y0 = $y(0);
            $y1 = $y($v);
            $s .= '<rect class="' . ($v >= 0 ? 'pos' : 'neg') . '" x="' . round($x, 1) . '" y="' . round(min($y0, $y1), 1) . '" width="' . round($bw * 0.7, 1) . '" height="' . round(max(1, abs($y1 - $y0)), 1) . '" rx="2"><title>' . self::t($labels[$i] . ': ' . $fmt($v)) . '</title></rect>';
            if ($n <= 16 || $i % 2 === 0) {
                $s .= '<text class="axis" x="' . round($x + $bw * 0.35, 1) . '" y="' . ($H - 10) . '" text-anchor="middle">' . self::t($labels[$i]) . '</text>';
            }
        }
        $s .= '<line class="zero" x1="' . $L . '" x2="' . ($W - $R) . '" y1="' . $y(0) . '" y2="' . $y(0) . '"/>';
        return $s . '</svg>';
    }

    /** Monte Carlo histogram with target line and P5/P50/P95 markers. */
    public static function histogram(array $hist, array $q, ?float $target, string $label): string
    {
        $W = 640;
        $H = 240;
        $L = 16;
        $R = 16;
        $T = 24;
        $B = 30;
        $counts = $hist['counts'];
        $max = max($counts) ?: 1;
        $n = count($counts);
        $bw = ($W - $L - $R) / $n;
        $x = static fn($v) => $L + ($v - $hist['lo']) / (($hist['hi'] - $hist['lo']) ?: 1) * ($W - $L - $R);
        $s = self::open($W, $H, $label);
        foreach ($counts as $i => $c) {
            $h = $c / $max * ($H - $T - $B);
            $mid = $hist['lo'] + ($i + 0.5) * $hist['width'];
            $cls = $mid < 0 ? 'neg' : 'pos';
            $s .= '<rect class="' . $cls . ' soft" x="' . round($L + $i * $bw + 1, 1) . '" y="' . round($H - $B - $h, 1) . '" width="' . round($bw - 2, 1) . '" height="' . round($h, 1) . '"><title>' . self::t(Fmt::pct($mid) . ': ' . $c . ' runs') . '</title></rect>';
        }
        $marks = [['P5', $q['0.05']], ['P50', $q['0.5']], ['P95', $q['0.95']]];
        foreach ($marks as [$lab, $v]) {
            $xx = max($L, min($W - $R, $x($v)));
            $s .= '<line class="mark" x1="' . $xx . '" x2="' . $xx . '" y1="' . ($T - 4) . '" y2="' . ($H - $B) . '"/>';
            $s .= '<text class="axis strong" x="' . $xx . '" y="' . ($T - 8) . '" text-anchor="middle">' . $lab . ' ' . self::t(Fmt::pct($v)) . '</text>';
        }
        if ($target !== null && $target >= $hist['lo'] && $target <= $hist['hi']) {
            $xx = $x($target);
            $s .= '<line class="target" x1="' . $xx . '" x2="' . $xx . '" y1="' . $T . '" y2="' . ($H - $B) . '"/>';
            $s .= '<text class="axis" x="' . ($xx + 4) . '" y="' . ($T + 12) . '">target</text>';
        }
        foreach (self::niceTicks($hist['lo'], $hist['hi'], 6) as $tv) {
            if ($tv < $hist['lo'] || $tv > $hist['hi']) {
                continue;
            }
            $s .= '<text class="axis" x="' . round($x($tv), 1) . '" y="' . ($H - 10) . '" text-anchor="middle">' . self::t(Fmt::pct($tv, 0)) . '</text>';
        }
        return $s . '</svg>';
    }

    /** Tornado chart of IRR swings around the base case. */
    public static function tornado(array $rows, ?float $base, string $label): string
    {
        $W = 640;
        $rowH = 30;
        $L = 190;
        $R = 70;
        $T = 10;
        $H = $T + count($rows) * $rowH + 26;
        $vals = [$base ?? 0];
        foreach ($rows as $r) {
            $vals[] = $r['low'] ?? 0;
            $vals[] = $r['high'] ?? 0;
        }
        $lo = min($vals);
        $hi = max($vals);
        $pad = ($hi - $lo) * 0.05 ?: 0.01;
        $lo -= $pad;
        $hi += $pad;
        $x = static fn($v) => $L + ($v - $lo) / ($hi - $lo) * ($W - $L - $R);
        $s = self::open($W, (int) $H, $label);
        foreach ($rows as $i => $r) {
            $yy = $T + $i * $rowH;
            $s .= '<text class="axis" x="' . ($L - 8) . '" y="' . ($yy + 19) . '" text-anchor="end">' . self::t($r['label']) . '</text>';
            foreach (['low', 'high'] as $side) {
                $v = $r[$side];
                if ($v === null) {
                    continue;
                }
                $a = $x($base ?? 0);
                $b = $x($v);
                $cls = $v >= ($base ?? 0) ? 'pos' : 'neg';
                $s .= '<rect class="' . $cls . '" x="' . round(min($a, $b), 1) . '" y="' . ($yy + 5) . '" width="' . round(max(1, abs($b - $a)), 1) . '" height="' . ($rowH - 10) . '" rx="2"><title>' . self::t($r['label'] . ': ' . Fmt::pct($v)) . '</title></rect>';
                $s .= '<text class="axis" x="' . round($b + ($b >= $a ? 4 : -4), 1) . '" y="' . ($yy + 19) . '" text-anchor="' . ($b >= $a ? 'start' : 'end') . '">' . self::t(Fmt::pct($v)) . '</text>';
            }
        }
        $bx = $x($base ?? 0);
        $s .= '<line class="zero" x1="' . $bx . '" x2="' . $bx . '" y1="' . $T . '" y2="' . ($H - 22) . '"/>';
        $s .= '<text class="axis strong" x="' . $bx . '" y="' . ($H - 6) . '" text-anchor="middle">base ' . self::t(Fmt::pct($base)) . '</text>';
        return $s . '</svg>';
    }

    /** Two-series line chart (e.g. property value vs loan balance). Optional band [lo, hi]. */
    public static function lines(array $labels, array $series, string $label, callable $fmt, ?array $band = null): string
    {
        $W = 640;
        $H = 260;
        $L = 70;
        $R = 14;
        $T = 14;
        $B = 30;
        $all = [];
        foreach ($series as $s) {
            $all = array_merge($all, array_filter($s['values'], static fn($v) => $v !== null));
        }
        if ($band) {
            $all = array_merge($all, array_filter($band[0], static fn($v) => $v !== null), array_filter($band[1], static fn($v) => $v !== null));
        }
        $lo = min(0, min($all));
        $hi = max($all);
        $ticks = self::niceTicks($lo, $hi, 4);
        $lo = min($lo, $ticks[0]);
        $hi = max($hi, end($ticks));
        $n = count($labels);
        $x = static fn($i) => $L + ($n > 1 ? $i / ($n - 1) : 0.5) * ($W - $L - $R);
        $y = static fn($v) => $T + ($hi - $v) / ($hi - $lo ?: 1) * ($H - $T - $B);
        $svg = self::open($W, $H, $label);
        foreach ($ticks as $tv) {
            $svg .= '<line class="grid" x1="' . $L . '" x2="' . ($W - $R) . '" y1="' . $y($tv) . '" y2="' . $y($tv) . '"/>';
            $svg .= '<text class="axis" x="' . ($L - 6) . '" y="' . ($y($tv) + 4) . '" text-anchor="end">' . self::t($fmt($tv)) . '</text>';
        }
        if ($band) {
            $pts = [];
            foreach ($band[1] as $i => $v) {
                if ($v !== null) {
                    $pts[] = round($x($i), 1) . ',' . round($y($v), 1);
                }
            }
            foreach (array_reverse($band[0], true) as $i => $v) {
                if ($v !== null) {
                    $pts[] = round($x($i), 1) . ',' . round($y($v), 1);
                }
            }
            $svg .= '<polygon class="band" points="' . implode(' ', $pts) . '"/>';
        }
        foreach ($series as $k => $s) {
            $pts = [];
            foreach ($s['values'] as $i => $v) {
                if ($v !== null) {
                    $pts[] = round($x($i), 1) . ',' . round($y($v), 1);
                }
            }
            $svg .= '<polyline class="line s' . $k . (!empty($s['dashed']) ? ' dashed' : '') . '" points="' . implode(' ', $pts) . '"/>';
        }
        $step = max(1, (int) ceil($n / 10));
        foreach ($labels as $i => $lab) {
            if ($i % $step === 0 || $i === $n - 1) {
                $svg .= '<text class="axis" x="' . round($x($i), 1) . '" y="' . ($H - 10) . '" text-anchor="middle">' . self::t($lab) . '</text>';
            }
        }
        $lx = $L + 8;
        foreach ($series as $k => $s) {
            $svg .= '<rect class="key s' . $k . '" x="' . $lx . '" y="' . ($T + 2) . '" width="12" height="4"/><text class="axis" x="' . ($lx + 16) . '" y="' . ($T + 8) . '">' . self::t($s['name']) . '</text>';
            $lx += 24 + 7 * mb_strlen($s['name']);
        }
        return $svg . '</svg>';
    }

    /** Year-1 waterfall from gross rent to cash flow. */
    public static function waterfall(array $steps, string $label, callable $fmt): string
    {
        $W = 640;
        $H = 270;
        $L = 70;
        $R = 10;
        $T = 14;
        $B = 46;
        $run = 0.0;
        $pos = [];
        foreach ($steps as [$name, $v, $isTotal]) {
            if ($isTotal) {
                $pos[] = [$name, 0.0, $v, true];
                $run = $v;
            } else {
                $pos[] = [$name, $run, $run + $v, false];
                $run += $v;
            }
        }
        $vals = [0];
        foreach ($pos as $p) {
            $vals[] = $p[1];
            $vals[] = $p[2];
        }
        $ticks = self::niceTicks(min($vals), max($vals), 4);
        $lo = min(min($vals), $ticks[0]);
        $hi = max(max($vals), end($ticks));
        $y = static fn($v) => $T + ($hi - $v) / ($hi - $lo ?: 1) * ($H - $T - $B);
        $bw = ($W - $L - $R) / count($pos);
        $s = self::open($W, $H, $label);
        foreach ($ticks as $tv) {
            $s .= '<line class="grid" x1="' . $L . '" x2="' . ($W - $R) . '" y1="' . $y($tv) . '" y2="' . $y($tv) . '"/><text class="axis" x="' . ($L - 6) . '" y="' . ($y($tv) + 4) . '" text-anchor="end">' . self::t($fmt($tv)) . '</text>';
        }
        foreach ($pos as $i => [$name, $a, $b, $tot]) {
            $x = $L + $i * $bw + $bw * 0.12;
            $cls = $tot ? 'total' : ($b >= $a ? 'pos' : 'neg');
            $s .= '<rect class="' . $cls . '" x="' . round($x, 1) . '" y="' . round(min($y($a), $y($b)), 1) . '" width="' . round($bw * 0.76, 1) . '" height="' . round(max(1, abs($y($b) - $y($a))), 1) . '" rx="2"><title>' . self::t($name . ': ' . $fmt($b - $a)) . '</title></rect>';
            $words = explode(' ', $name);
            $line1 = implode(' ', array_slice($words, 0, 2));
            $line2 = implode(' ', array_slice($words, 2));
            $s .= '<text class="axis" x="' . round($x + $bw * 0.38, 1) . '" y="' . ($H - 28) . '" text-anchor="middle">' . self::t($line1) . '</text>';
            if ($line2 !== '') {
                $s .= '<text class="axis" x="' . round($x + $bw * 0.38, 1) . '" y="' . ($H - 16) . '" text-anchor="middle">' . self::t($line2) . '</text>';
            }
        }
        $s .= '<line class="zero" x1="' . $L . '" x2="' . ($W - $R) . '" y1="' . $y(0) . '" y2="' . $y(0) . '"/>';
        return $s . '</svg>';
    }

    /** Radar chart for score dimensions (0–100). Unrated axes are drawn hollow. */
    public static function radar(array $dims, string $label): string
    {
        $W = 320;
        $H = 300;
        $cx = 160;
        $cy = 150;
        $r = 100;
        $n = count($dims);
        $s = self::open($W, $H, $label);
        foreach ([25, 50, 75, 100] as $ring) {
            $pts = [];
            for ($i = 0; $i < $n; $i++) {
                $a = -M_PI / 2 + 2 * M_PI * $i / $n;
                $pts[] = round($cx + cos($a) * $r * $ring / 100, 1) . ',' . round($cy + sin($a) * $r * $ring / 100, 1);
            }
            $s .= '<polygon class="ring" points="' . implode(' ', $pts) . '"/>';
        }
        $pts = [];
        $i = 0;
        foreach ($dims as $d) {
            $a = -M_PI / 2 + 2 * M_PI * $i / $n;
            $val = $d[1] ?? 0;
            $pts[] = round($cx + cos($a) * $r * $val / 100, 1) . ',' . round($cy + sin($a) * $r * $val / 100, 1);
            $lx = $cx + cos($a) * ($r + 22);
            $ly = $cy + sin($a) * ($r + 22);
            $anchor = abs(cos($a)) < 0.3 ? 'middle' : (cos($a) > 0 ? 'start' : 'end');
            $s .= '<line class="grid" x1="' . $cx . '" y1="' . $cy . '" x2="' . round($cx + cos($a) * $r, 1) . '" y2="' . round($cy + sin($a) * $r, 1) . '"/>';
            $s .= '<text class="axis strong" x="' . round($lx, 1) . '" y="' . round($ly + 4, 1) . '" text-anchor="' . $anchor . '">' . self::t($d[0]) . '</text>';
            $s .= '<text class="axis" x="' . round($lx, 1) . '" y="' . round($ly + 17, 1) . '" text-anchor="' . $anchor . '">' . ($d[1] === null ? 'not rated' : (int) round($d[1])) . '</text>';
            $i++;
        }
        $s .= '<polygon class="area" points="' . implode(' ', $pts) . '"/>';
        return $s . '</svg>';
    }

    /** Horizontal stacked bar for a cost breakdown. */
    public static function stack(array $parts, string $label, callable $fmt): string
    {
        $W = 640;
        $H = 64;
        $tot = array_sum(array_map(static fn($p) => max(0, $p[1]), $parts)) ?: 1;
        $s = self::open($W, $H, $label);
        $x = 0.0;
        foreach (array_values($parts) as $i => [$name, $v]) {
            if ($v <= 0) {
                continue;
            }
            $w = $v / $tot * $W;
            $s .= '<rect class="cat c' . ($i % 8) . '" x="' . round($x, 1) . '" y="4" width="' . round($w, 1) . '" height="30"><title>' . self::t($name . ': ' . $fmt($v) . ' (' . Fmt::pct($v / $tot, 0) . ')') . '</title></rect>';
            if ($w > 70) {
                $s .= '<text class="axis inv" x="' . round($x + 6, 1) . '" y="23">' . self::t(Fmt::pct($v / $tot, 0)) . '</text>';
            }
            $x += $w;
        }
        return $s . '</svg>';
    }
}
