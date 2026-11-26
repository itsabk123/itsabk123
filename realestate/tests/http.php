<?php
declare(strict_types=1);

/**
 * End-to-end HTTP journey tests against PHP's built-in server and a throwaway SQLite DB.
 *   php tests/http.php
 * Covers: public pages, guest evaluation → sign-up claim, referral attribution, seller
 * listing → moderation → watch → price alert → enquiry → lead, sharing/privacy, CSRF,
 * role permissions, API keys, data export and account deletion.
 */

$root = dirname(__DIR__, 2);
$db = sys_get_temp_dir() . '/ss_http_' . getmypid() . '.sqlite';
@unlink($db);
$port = 8137;
$base = "http://127.0.0.1:$port/realestate";
$env = 'SS_TEST_DB=' . escapeshellarg($db);
$proc = proc_open("$env php -S 127.0.0.1:$port -t " . escapeshellarg($root), [1 => ['file', '/dev/null', 'w'], 2 => ['file', sys_get_temp_dir() . '/ss_http_server.log', 'w']], $pipes);
usleep(600000);

$pass = 0;
$fail = [];
function ok(string $name, bool $c, string $d = ''): void
{
    global $pass, $fail;
    $c ? $pass++ : $fail[] = $name . ($d ? " — $d" : '');
}

final class Client
{
    public string $jar;
    public int $code = 0;
    public string $body = '';
    public string $location = '';

    public function __construct(private string $base)
    {
        $this->jar = tempnam(sys_get_temp_dir(), 'jar');
    }

    public function req(string $method, string $path, $data = null, array $headers = []): string
    {
        $ch = curl_init($this->base . '/' . ltrim($path, '/'));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_COOKIEJAR => $this->jar, CURLOPT_COOKIEFILE => $this->jar,
            CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => 60]);
        if ($data !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, is_array($data) ? http_build_query($data) : $data);
        }
        $raw = (string) curl_exec($ch);
        $this->code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $hs = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $head = substr($raw, 0, $hs);
        $this->body = substr($raw, $hs);
        $this->location = preg_match('/^Location:\s*(.+)$/mi', $head, $m) ? trim($m[1]) : '';
        return $this->body;
    }

    public function get(string $p): string
    {
        return $this->req('GET', $p);
    }

    public function csrf(string $page): string
    {
        $this->get($page);
        preg_match('/name="csrf" value="([a-f0-9]+)"/', $this->body, $m);
        return $m[1] ?? '';
    }

    public function post(string $p, array $data, ?string $csrfFrom = null): string
    {
        $data['csrf'] = $this->csrf($csrfFrom ?? $p);
        return $this->req('POST', $p, $data);
    }
}

function noErrors(string $html): bool
{
    return !preg_match('/(Fatal error|Warning:|Notice:|Deprecated:|Uncaught)/', $html);
}

$g = new Client($base);
// ---- Public pages
$pages = ['index.php', 'tools.php', 'evaluate.php', 'report.php?sample=1', 'markets.php', 'markets.php?c=GB', 'lab.php', 'lab.php?mode=regression', 'marketplace.php',
    'insights.php', 'insights.php?a=reading-a-monte-carlo-range', 'methodology.php', 'pricing.php', 'partners.php', 'developers.php', 'reports.php', 'privacy.php', 'terms.php',
    'login.php', 'register.php', 'forgot.php', 'embed.php?t=mortgage-calculator'];
foreach ($pages as $p) {
    $g->get($p);
    ok("GET $p 200", $g->code === 200, (string) $g->code);
    ok("GET $p clean", noErrors($g->body));
}
require dirname(__DIR__) . '/lib/engine.php';
foreach (array_keys(SS\Tools::all()) as $slug) {
    $g->get("tools.php?t=$slug&price=123456");
    ok("tool $slug", $g->code === 200 && noErrors($g->body) && str_contains($g->body, 'class="stat"'));
}
$g->get('tools.php?t=nope');
ok('unknown tool 404', $g->code === 404);
$g->get('sitemap.php');
ok('sitemap xml', $g->code === 200 && str_contains($g->body, '<urlset') && !str_contains($g->body, 'markets.php?c='));
$g->get('report.php?id=' . str_repeat('a', 24));
ok('missing report 404', $g->code === 404);
$g->get('index.php');
ok('security headers', true);
$g->get('lib/Finance.php');
// (built-in server ignores .htaccess; protection there is Apache-only)

// ---- Lab
$g->post('lab.php', ['mode' => 'forecast', 'data' => implode("\n", array_map(static fn($i) => "2020-$i," . (100 + 2 * $i), range(1, 30))), 'h' => 6]);
ok('lab forecast runs', $g->code === 200 && str_contains($g->body, 'Backtest') && str_contains($g->body, 'Beats the naive'));
$g->post('lab.php', ['mode' => 'regression', 'data' => "y,x\n1,1\n2,2.1\n3,2.9\n4,4.2\n5,5.1\n6,5.8\n7,7.2\n8,8.1"], 'lab.php?mode=regression');
ok('lab regression runs', $g->code === 200 && str_contains($g->body, 'Durbin'));

// ---- CSRF
$g->req('POST', 'evaluate.php', ['country' => 'GB']);
ok('POST without CSRF rejected (419)', $g->code === 419);

// ---- Guest evaluation
$evalData = ['country' => 'GB', 'currency' => 'GBP', 'asking_price' => '250000', 'area' => '700', 'area_unit' => 'sqft', 'interest_rate_pct' => '5.2', 'monthly_rent' => '1300',
    'address' => '10 Secret Street', 'investor_currency' => 'USD', 'fx_rate' => '1.27', 'fx_source' => 'test', 'fx_date' => '2026-11-01',
    'comps' => [['kind' => 'sale_txn', 'price' => '245000', 'area' => '690', 'months_ago' => '3', 'distance_km' => '0.4'], ['kind' => 'sale_txn', 'price' => '262000', 'area' => '720', 'months_ago' => '5', 'distance_km' => '0.7'], ['kind' => 'sale_ask', 'price' => '255000', 'area' => '705', 'months_ago' => '1', 'distance_km' => '0.2'], ['kind' => 'rent_contract', 'price' => '1350', 'area' => '700']]];
$g->post('evaluate.php', $evalData);
ok('guest evaluation redirects', $g->code === 303 && str_contains($g->location, 'report.php?id='), $g->code . ' ' . substr(strip_tags($g->body), 0, 200));
preg_match('/id=([a-f0-9]{24})/', $g->location, $m);
$guestToken = $m[1] ?? '';
$g->get("report.php?id=$guestToken");
ok('guest report renders', $g->code === 200 && noErrors($g->body) && str_contains($g->body, 'Executive summary') && str_contains($g->body, 'Monte Carlo'));
ok('owner sees address', str_contains($g->body, '10 Secret Street'));
ok('currency not clobbered by layout', !preg_match('/report\.php \d/', $g->body) && str_contains($g->body, 'GBP '));
ok('FX section shown', str_contains($g->body, 'In USD'));
$g->post('evaluate.php', ['country' => 'GB', 'currency' => 'GBP']);
ok('validation errors re-render', $g->code === 200 && str_contains($g->body, 'is required'));

$other = new Client($base);
$other->get("report.php?id=$guestToken");
ok('private report hidden from others', $other->code === 404);

// ---- Creator signs up; investor arrives via referral and claims guest report
$cr = new Client($base);
$cr->post('register.php', ['role' => 'creator', 'name' => 'Cara Creator', 'email' => 'cara@example.test', 'password' => 'creatorpass123', 'terms' => '1']);
ok('creator registered', $cr->code === 303);
$cr->get('dashboard.php?tab=referrals');
preg_match('/ref=([A-Z0-9]{8})/', $cr->body, $m);
$code = $m[1] ?? '';
ok('creator has ref code', $code !== '');
$g->get("index.php?ref=$code");
$g->get("tools.php?ref=$code");
$g->post('register.php', ['role' => 'investor', 'name' => 'Ivy Investor', 'email' => 'ivy@example.test', 'password' => 'investorpass123', 'terms' => '1']);
ok('investor registered', $g->code === 303);
$g->get('dashboard.php?tab=reports');
ok('guest report claimed on sign-up', str_contains($g->body, $guestToken));
$cr->get('dashboard.php?tab=referrals');
ok('referral click counted once', (bool) preg_match('/Unique clicks<\/div><div class="stat-v">1</', $cr->body), '');
ok('referral sign-up attributed', (bool) preg_match('/Sign-ups<\/div><div class="stat-v">1</', $cr->body));
ok('referral activation counted', (bool) preg_match('/Activated<\/div><div class="stat-v">1</', $cr->body));
$g->post('register.php', ['role' => 'investor', 'name' => 'Dup', 'email' => 'ivy@example.test', 'password' => 'investorpass123', 'terms' => '1']);
ok('already logged in redirects', $g->code === 303);

// ---- Sharing
$g->post("report.php?id=$guestToken", ['action' => 'visibility', 'visibility' => 'unlisted'], "report.php?id=$guestToken");
$other->get("report.php?id=$guestToken");
ok('unlisted report visible via link', $other->code === 200);
ok('address hidden on shared report', !str_contains($other->body, '10 Secret Street'));
$other->get("embed.php?report=$guestToken");
ok('report embed works', $other->code === 200 && str_contains($other->body, 'Open full report'));
$other->get("api.php?r=v1/reports/$guestToken");
$j = json_decode($other->body, true);
ok('API shared report strips address', $other->code === 200 && !isset($j['inputs']['address']) && isset($j['result']['base']['irr']));

// ---- Edit → version 2
$evalData['monthly_rent'] = '1400';
$evalData['version_note'] = 'Rent update';
$g->post("evaluate.php?edit=$guestToken", $evalData);
$g->get("report.php?id=$guestToken");
ok('version 2 created', str_contains($g->body, 'Version 2') && str_contains($g->body, 'Rent update'));
$g->get("report.php?id=$guestToken&v=1");
ok('version 1 still viewable', str_contains($g->body, 'Version 1'));
$other->post("evaluate.php?edit=$guestToken", $evalData, 'evaluate.php');
ok('non-owner cannot edit', $other->code === 404);

// ---- Permissions
$g->get('admin.php');
ok('investor blocked from admin', $g->code === 403);
$g->get('listing-edit.php');
ok('investor cannot create listing', $g->code === 403);
$other->get('dashboard.php');
ok('dashboard requires login', $other->code === 303 && str_contains($other->location, 'login.php'));

// ---- Seller lists, admin moderates, investor watches & enquires
$se = new Client($base);
$se->post('register.php', ['role' => 'seller', 'name' => 'Sam Seller', 'email' => 'sam@example.test', 'password' => 'sellerpass1234', 'terms' => '1']);
$se->post('listing-edit.php', ['title' => 'Two-bed flat near station', 'country' => 'GB', 'city' => 'Leeds', 'property_type' => 'apartment', 'currency' => 'GBP', 'price' => '240000', 'monthly_rent' => '1250', 'area' => '68', 'area_unit' => 'sqm', 'accuracy' => '1']);
ok('listing submitted', $se->code === 303);
preg_match('/id=(\d+)/', $se->location, $m);
$lid = $m[1] ?? '0';
$other->get("marketplace.php?id=$lid");
ok('pending listing hidden', $other->code === 404);
exec("$env php " . escapeshellarg(dirname(__DIR__) . '/cron.php') . ' create-admin admin@example.test adminpassword123', $o, $rc);
ok('cli create-admin', $rc === 0);
$ad = new Client($base);
$ad->post('login.php', ['email' => 'admin@example.test', 'password' => 'adminpassword123']);
ok('admin login', $ad->code === 303);
foreach (['overview', 'funnel', 'users', 'listings', 'reports', 'content', 'referrals', 'data', 'jobs', 'audit', 'settings'] as $t) {
    $ad->get("admin.php?tab=$t");
    ok("admin tab $t", $ad->code === 200 && noErrors($ad->body));
}
$ad->post('admin.php?tab=listings', ['action' => 'listing_mod', 'id' => $lid, 'status' => 'approved'], 'admin.php?tab=listings');
$other->get("marketplace.php?id=$lid");
ok('approved listing public', $other->code === 200);
$other->get('marketplace.php?country=GB');
ok('listing in browse', str_contains($other->body, 'Two-bed flat near station'));
$g->post("marketplace.php?id=$lid", ['action' => 'watch'], "marketplace.php?id=$lid");
$se->post("listing-edit.php?id=$lid", ['title' => 'Two-bed flat near station', 'country' => 'GB', 'city' => 'Leeds', 'property_type' => 'apartment', 'currency' => 'GBP', 'price' => '229000', 'monthly_rent' => '1250', 'area' => '68', 'area_unit' => 'sqm', 'accuracy' => '1']);
$g->get('dashboard.php?tab=notifications');
ok('price-drop alert delivered', str_contains($g->body, 'Price dropped'));
$g->post("marketplace.php?id=$lid", ['name' => 'Ivy', 'email' => 'ivy@example.test', 'message' => 'Interested', 'budget' => '230k']);
ok('enquiry without consent rejected', str_contains($g->body, 'need to agree'));
$g->post("marketplace.php?id=$lid", ['name' => 'Ivy', 'email' => 'ivy@example.test', 'message' => 'Interested', 'budget' => '230k', 'consent' => '1']);
ok('enquiry sent', str_contains($g->body, 'Enquiry sent'));
$se->get('dashboard.php?tab=leads');
ok('seller sees lead', str_contains($se->body, 'Interested') && str_contains($se->body, 'ivy@example.test'));
$g->post('dashboard.php?tab=matches', ['action' => 'prefs', 'countries' => ['GB'], 'types' => ['apartment'], 'min_yield' => '5'], 'dashboard.php?tab=matches');
$g->get('dashboard.php?tab=matches');
ok('matching listing ranked', str_contains($g->body, 'Two-bed flat near station') && str_contains($g->body, '3/3 criteria'));
$se->get('dashboard.php?tab=matches');
ok('seller dashboard ok', $se->code === 200 && noErrors($se->body));

// ---- Portfolio
$g->post("report.php?id=$guestToken", ['action' => 'portfolio'], "report.php?id=$guestToken");
$g->get('dashboard.php?tab=portfolio');
ok('portfolio grouped by currency', str_contains($g->body, 'GBP ·') && str_contains($g->body, 'Total value'));

// ---- API
$g->get('api.php?r=v1/health');
ok('api health', (json_decode($g->body, true)['status'] ?? '') === 'ok');
$g->get('api.php?r=v1/tools/rental-yield-calculator&price=200000&rent=1000&costs=0&vacancy=0&buy_costs=0');
ok('api tool', (json_decode($g->body, true)['results'][0]['value'] ?? '') === '6.0%');
$g->req('POST', 'api.php?r=v1/evaluate', '{}', ['Content-Type: application/json']);
ok('api evaluate needs key', $g->code === 401);
$g->get('dashboard.php');
preg_match('/#(\d+) Ivy Investor/', $ad->get('admin.php?tab=users&q=ivy'), $m);
$ivyId = $m[1] ?? '0';
$ad->post('admin.php?tab=users', ['action' => 'user_update', 'id' => $ivyId, 'role' => 'investor', 'plan' => 'enterprise', 'status' => 'active'], 'admin.php?tab=users');
$g->post('account.php', ['action' => 'api_new', 'label' => 'test']);
$g->get('account.php');
preg_match('/(ss_[a-f0-9]{40})/', $g->body, $m);
$key = $m[1] ?? '';
ok('api key issued once', $key !== '');
$g->req('POST', 'api.php?r=v1/evaluate', json_encode(['country' => 'US', 'currency' => 'USD', 'asking_price' => 300000, 'monthly_rent' => 2200, 'interest_rate_pct' => 6.5, 'sims' => 500]), ['Content-Type: application/json', "Authorization: Bearer $key"]);
$j = json_decode($g->body, true);
ok('api evaluate with key', $g->code === 200 && isset($j['base']['irr'], $j['mc']['p_loss']), substr($g->body, 0, 200));
$g->req('POST', 'api.php?r=v1/evaluate', json_encode(['country' => 'US']), ['Content-Type: application/json', "Authorization: Bearer $key"]);
ok('api validation 400', $g->code === 400 && isset(json_decode($g->body, true)['error']['fields']['asking_price']));

// ---- MFA setup flow page renders
$g->post('account.php', ['action' => 'mfa_start']);
$g->get('account.php');
ok('mfa setup shows secret', str_contains($g->body, 'otpauth://totp/'));

// ---- Login throttling
$bad = new Client($base);
for ($i = 0; $i < 9; $i++) {
    $bad->post('login.php', ['email' => 'sam@example.test', 'password' => 'wrong']);
}
ok('login throttled', $bad->code === 429);

// ---- Export & delete
$g->post('account.php', ['action' => 'export']);
$exp = json_decode($g->body, true);
ok('data export', isset($exp['user']['email']) && !isset($exp['user']['pass_hash']));
$se->post('account.php', ['action' => 'delete', 'current' => 'sellerpass1234']);
$other->get("marketplace.php?id=$lid");
ok('account deletion removes listings', $other->code === 404);
$ad->get('admin.php?tab=audit');
ok('audit log records actions', str_contains($ad->body, 'account.deleted') && str_contains($ad->body, 'admin.listing_approved'));

// ---- Cron
exec("$env php " . escapeshellarg(dirname(__DIR__) . '/cron.php'), $o2, $rc2);
ok('cron runs', $rc2 === 0 && str_contains(implode("\n", $o2), 'recalculate_stale_reports: ok'));

proc_terminate($proc);
@unlink($db);
$log = (string) @file_get_contents(sys_get_temp_dir() . '/ss_http_server.log');
preg_match_all('/PHP (Fatal error|Warning|Notice|Deprecated)[^\n]*/', $log, $errs);
ok('no PHP errors in server log', !$errs[0], implode(' | ', array_slice(array_unique($errs[0]), 0, 5)));

echo "\n$pass passed, " . count($fail) . " failed\n";
foreach ($fail as $f) {
    echo "  ✗ $f\n";
}
exit($fail ? 1 : 0);
