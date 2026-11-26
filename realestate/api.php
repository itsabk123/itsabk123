<?php
declare(strict_types=1);

/**
 * JSON API v1. Routed by ?r=v1/... so it works on hosts without URL rewriting.
 * Authentication: API keys only (never session cookies), so no CSRF surface.
 */
define('SS_EMBED', true); // skip HTML frame headers
require __DIR__ . '/bootstrap.php';

use SS\{Analysis, Auth, Db, Inputs, Settings, Tools};

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function api_err(int $code, string $type, string $msg, array $extra = []): never
{
    json_out(['error' => ['type' => $type, 'message' => $msg] + $extra], $code);
}

$route = trim((string) ($_GET['r'] ?? ''), '/');
$parts = explode('/', $route);
if (($parts[0] ?? '') !== 'v1') {
    api_err(404, 'not_found', 'Unknown API version. Use ?r=v1/health');
}
$key = null;
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if (preg_match('/^Bearer\s+(ss_[a-f0-9]{40})$/', $auth, $m)) {
    $key = Db::one('SELECT k.*, u.plan, u.status FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.key_hash = ? AND k.revoked = 0', [hash('sha256', $m[1])]);
    if (!$key || $key['status'] !== 'active' || !(Auth::ENTITLEMENTS[$key['plan']]['api'] ?? false)) {
        api_err(401, 'unauthorized', 'Invalid, revoked or non-entitled API key.');
    }
    if (!rate_limit('apikey:' . $key['id'], 1000, 3600)) {
        api_err(429, 'rate_limited', 'Hourly API quota exceeded.');
    }
    Db::update('api_keys', ['last_used_at' => Db::now()], 'id = ?', [$key['id']]);
} elseif (!rate_limit('api:' . ip_hash(), (int) Settings::get('api_rate_per_hour'), 3600)) {
    api_err(429, 'rate_limited', 'Too many requests from this address. Try again later.');
}

$res = $parts[1] ?? '';
switch ($res) {
    case 'health':
        json_out(['status' => 'ok', 'engine' => Analysis::VERSION, 'build' => SS_VERSION, 'time' => gmdate('c')]);
    case 'schema':
        json_out(['engine' => Analysis::VERSION, 'fields' => array_values(array_map(static fn($d) => array_intersect_key($d, array_flip(['key', 'section', 'type', 'label', 'default', 'required', 'min', 'max', 'options', 'help', 'assumption'])), Inputs::schema())), 'comp_kinds' => Inputs::COMP_KINDS]);
    case 'tools':
        $tools = Tools::all();
        if (!empty($parts[2])) {
            $slug = $parts[2];
            if (!isset($tools[$slug])) {
                api_err(404, 'not_found', 'Unknown tool.');
            }
            $out = Tools::compute($slug, Tools::values($tools[$slug], $_GET));
            unset($out['mc']['hist']);
            track('api_tool', ['t' => $slug]);
            json_out(['tool' => $slug, 'results' => array_map(static fn($r) => ['label' => $r[0], 'value' => $r[1], 'note' => $r[2]], $out['results']), 'table' => $out['table'] ?? null]);
        }
        json_out(['tools' => array_map(static fn($s, $t) => ['slug' => $s, 'title' => $t['title'], 'fields' => array_map(static fn($f) => ['key' => $f[0], 'label' => $f[1], 'type' => $f[2], 'default' => $f[3]], $t['fields'])], array_keys($tools), $tools)]);
    case 'evaluate':
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            api_err(405, 'method_not_allowed', 'Use POST.');
        }
        if (!$key) {
            api_err(401, 'unauthorized', 'An Enterprise API key is required for evaluations.');
        }
        $body = json_decode((string) file_get_contents('php://input', false, null, 0, 200000), true);
        if (!is_array($body)) {
            api_err(400, 'invalid_json', 'Request body must be a JSON object.');
        }
        [$v, $prov, $errors] = Inputs::normalise($body);
        if ($errors) {
            api_err(400, 'validation_error', 'Some inputs are invalid.', ['fields' => $errors]);
        }
        $result = Analysis::run($v, $prov);
        unset($result['base']['amort'], $result['mc']['hist']);
        $result['provenance'] = $prov;
        track('api_evaluate');
        json_out($result);
    case 'reports':
        $token = (string) ($parts[2] ?? '');
        $r = preg_match('/^[a-f0-9]{24}$/', $token) ? Db::one("SELECT * FROM reports WHERE token = ? AND visibility IN ('public','unlisted')", [$token]) : null;
        if (!$r) {
            api_err(404, 'not_found', 'Report not found or not shared.');
        }
        $ver = Db::one('SELECT version, inputs_json, result_json, created_at FROM report_versions WHERE report_id = ? ORDER BY version DESC LIMIT 1', [$r['id']]);
        $inputs = json_decode($ver['inputs_json'], true);
        foreach (Inputs::schema() as $k => $d) {
            if (!empty($d['private'])) {
                unset($inputs[$k]);
            }
        }
        $result = json_decode($ver['result_json'], true);
        unset($result['base']['amort'], $result['mc']['hist']);
        json_out(['title' => $r['title'], 'version' => (int) $ver['version'], 'computed' => $ver['created_at'], 'inputs' => $inputs, 'result' => $result]);
    default:
        api_err(404, 'not_found', 'Unknown endpoint.');
}
