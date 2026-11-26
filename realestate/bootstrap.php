<?php
declare(strict_types=1);

/**
 * Shelter and Sense v3 — front controller bootstrap.
 * Included by every page. Works at any URL sub-path (e.g. /githubtest2/realestate/).
 */

use SS\{Auth, Db, Settings};

define('SS_ROOT', __DIR__);
define('SS_VERSION', '3.0.0-staging');

if (is_file(__DIR__ . '/config.php')) {
    require __DIR__ . '/config.php';
}

function cfg(string $k)
{
    static $defaults = null;
    $defaults ??= [
        'DB_DRIVER' => 'sqlite',
        'DB_PATH' => SS_ROOT . '/data/shelterandsense.sqlite',
        'DB_HOST' => 'localhost', 'DB_NAME' => '', 'DB_USER' => '', 'DB_PASS' => '',
        'SITE_URL' => '',
        'SITE_NAME' => 'Shelter and Sense',
        'NOTIFY_EMAIL' => '',
        'MAIL_FROM' => '',
        'SETUP_KEY' => '',
        'APP_SECRET' => 'change-me',
        'ENVIRONMENT' => 'staging',
        'NOINDEX' => true,
    ];
    return defined('SS_' . $k) ? constant('SS_' . $k) : ($defaults[$k] ?? null);
}

require_once SS_ROOT . '/lib/engine.php';
foreach (['Db', 'Content', 'App', 'Charts', 'View'] as $f) {
    require_once SS_ROOT . '/lib/' . $f . '.php';
}

error_reporting(E_ALL);
ini_set('display_errors', cfg('ENVIRONMENT') === 'development' ? '1' : '0');

function base_path(): string
{
    static $b = null;
    if ($b === null) {
        $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/index.php');
        $b = rtrim(dirname($script), '/');
        if (str_ends_with($b, '/api')) {
            $b = substr($b, 0, -4);
        }
    }
    return $b;
}

function url(string $path = '', array $q = []): string
{
    $u = base_path() . '/' . ltrim($path, '/');
    $q = array_filter($q, static fn($v) => $v !== null && $v !== '');
    return $u . ($q ? '?' . http_build_query($q) : '');
}

function abs_url(string $path = '', array $q = []): string
{
    $site = cfg('SITE_URL');
    if ($site) {
        return rtrim($site, '/') . '/' . ltrim($path, '/') . ($q ? '?' . http_build_query($q) : '');
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $host = preg_replace('/[^A-Za-z0-9.\-:\[\]]/', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
    return ($https ? 'https' : 'http') . '://' . $host . url($path, $q);
}

function e($s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function redirect(string $path, array $q = []): never
{
    header('Location: ' . (preg_match('#^https?://#', $path) ? $path : url($path, $q)), true, 303);
    exit;
}

function flash(?string $msg = null, string $kind = 'info')
{
    if ($msg !== null) {
        $_SESSION['flash'][] = [$kind, $msg];
        return null;
    }
    $f = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $f;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}

function csrf_check(): void
{
    $t = $_POST['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (empty($_SESSION['csrf']) || !is_string($t) || !hash_equals($_SESSION['csrf'], $t)) {
        http_response_code(419);
        render_error(419, 'Your session expired or the form was submitted twice. Please go back and try again.');
    }
}

function is_post(): bool
{
    return ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
}

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/** IPs are never stored raw — only a keyed, daily-rotating hash for abuse control and dedupe. */
function ip_hash(?string $salt = null): string
{
    return hash_hmac('sha256', client_ip() . '|' . ($salt ?? gmdate('Y-m-d')), (string) cfg('APP_SECRET'));
}

function guest_key(bool $create = true): ?string
{
    $k = $_COOKIE['ss_guest'] ?? null;
    if (is_string($k) && preg_match('/^[a-f0-9]{48}$/', $k)) {
        return $k;
    }
    if (!$create) {
        return null;
    }
    $k = bin2hex(random_bytes(24));
    setcookie('ss_guest', $k, ['expires' => time() + 86400 * 90, 'path' => base_path() . '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => is_https()]);
    $_COOKIE['ss_guest'] = $k;
    return $k;
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

/** First-party analytics: event name + small JSON props. No third-party trackers, no raw IPs. */
function track(string $name, array $props = []): void
{
    try {
        Db::insert('events', [
            'name' => substr($name, 0, 40), 'user_id' => Auth::id(), 'session_hash' => substr(hash('sha256', session_id() . cfg('APP_SECRET')), 0, 32),
            'ref_code' => current_ref(), 'props' => $props ? json_encode($props) : null, 'created_at' => Db::now(),
        ]);
    } catch (\Throwable $e) {
        error_log('track failed: ' . $e->getMessage());
    }
}

function audit(string $action, ?string $target = null, $detail = null): void
{
    try {
        Db::insert('audit_log', ['actor_id' => Auth::id(), 'action' => $action, 'target' => $target, 'detail' => $detail === null ? null : (is_string($detail) ? $detail : json_encode($detail)), 'ip_hash' => ip_hash('audit'), 'created_at' => Db::now()]);
    } catch (\Throwable $e) {
        error_log('audit failed: ' . $e->getMessage());
    }
}

/** Sliding-window rate limit. Returns true when the call is allowed (and records it). */
function rate_limit(string $bucket, int $max, int $windowSeconds): bool
{
    $since = gmdate('Y-m-d H:i:s', time() - $windowSeconds);
    $n = (int) Db::val('SELECT COUNT(*) FROM rate_limits WHERE bucket = ? AND created_at > ?', [$bucket, $since]);
    if ($n >= $max) {
        return false;
    }
    Db::insert('rate_limits', ['bucket' => $bucket, 'created_at' => Db::now()]);
    return true;
}

function current_ref(): ?string
{
    $r = $_COOKIE['ss_ref'] ?? null;
    return is_string($r) && preg_match('/^[A-Z0-9]{6,12}$/', $r) ? $r : null;
}

function send_mail(string $to, string $subject, string $body): bool
{
    $from = cfg('MAIL_FROM') ?: 'no-reply@' . preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
    $ok = @mail($to, $subject, $body, 'From: ' . cfg('SITE_NAME') . ' <' . $from . ">\r\nContent-Type: text/plain; charset=utf-8");
    if (!$ok) {
        error_log("mail to $to failed: $subject");
    }
    return $ok;
}

function notify(int $userId, string $kind, string $message, ?string $link = null): void
{
    Db::insert('notifications', ['user_id' => $userId, 'kind' => $kind, 'message' => mb_substr($message, 0, 250), 'link' => $link, 'created_at' => Db::now()]);
}

function render_error(int $code, string $msg): never
{
    http_response_code($code);
    $page_title = 'Error ' . $code;
    require SS_ROOT . '/views/header.php';
    echo '<section class="wrap narrow"><h1>' . e($page_title) . '</h1><p>' . e($msg) . '</p><p><a class="btn" href="' . e(url('index.php')) . '">Back to home</a></p></section>';
    require SS_ROOT . '/views/footer.php';
    exit;
}

function json_out($data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

// ---- request setup --------------------------------------------------------

if (PHP_SAPI !== 'cli') {
    session_name('ss_sid');
    session_set_cookie_params(['lifetime' => 0, 'path' => base_path() . '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => is_https()]);
    session_start();
    if (!isset($_SESSION['created'])) {
        $_SESSION['created'] = time();
    } elseif (time() - $_SESSION['created'] > 3600) {
        session_regenerate_id(true);
        $_SESSION['created'] = time();
    }

    if (!defined('SS_EMBED')) {
        header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'");
        header('X-Frame-Options: SAMEORIGIN');
    }
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    if (cfg('NOINDEX')) {
        header('X-Robots-Tag: noindex, nofollow');
    }

    // Referral capture: ?ref=CODE sets a 30-day first-party cookie and logs one click per IP per day.
    if (isset($_GET['ref']) && is_string($_GET['ref'])) {
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $_GET['ref']));
        if (preg_match('/^[A-Z0-9]{6,12}$/', $code)) {
            try {
                $owner = Db::one('SELECT id FROM users WHERE ref_code = ?', [$code]);
                if ($owner && $owner['id'] != ($_SESSION['uid'] ?? 0)) {
                    if (!current_ref()) {
                        setcookie('ss_ref', $code, ['expires' => time() + 86400 * 30, 'path' => base_path() . '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => is_https()]);
                        $_COOKIE['ss_ref'] = $code;
                    }
                    $day = gmdate('Y-m-d');
                    $ih = ip_hash();
                    if (!Db::val('SELECT COUNT(*) FROM referral_clicks WHERE ref_code = ? AND ip_hash = ? AND day = ?', [$code, $ih, $day])) {
                        Db::insert('referral_clicks', ['ref_code' => $code, 'ip_hash' => $ih, 'landing' => substr($_SERVER['REQUEST_URI'] ?? '', 0, 250), 'day' => $day, 'created_at' => Db::now()]);
                    }
                }
            } catch (\Throwable $e) {
                error_log('ref capture: ' . $e->getMessage());
            }
        }
    }
}
