<?php
declare(strict_types=1);

namespace SS;

/** Request-level services: session, CSRF, auth, permissions, analytics, rate limiting, audit. */
final class Auth
{
    public const ROLES = ['investor' => 'Investor', 'seller' => 'Property seller', 'agent' => 'Agent / broker', 'creator' => 'Content creator', 'admin' => 'Admin', 'super_admin' => 'Super admin'];
    public const SELF_SERVE_ROLES = ['investor', 'seller', 'agent', 'creator'];
    public const PLANS = ['free' => 'Free', 'pro' => 'Pro', 'professional' => 'Professional', 'enterprise' => 'Enterprise'];

    /** Permission matrix: permission => roles allowed. */
    public const PERMS = [
        'report.save' => ['investor', 'seller', 'agent', 'creator', 'admin', 'super_admin'],
        'listing.create' => ['seller', 'agent', 'admin', 'super_admin'],
        'listing.enquiries' => ['seller', 'agent', 'admin', 'super_admin'],
        'portfolio' => ['investor', 'agent', 'admin', 'super_admin'],
        'branding' => ['agent', 'creator', 'admin', 'super_admin'],
        'referrals' => ['investor', 'seller', 'agent', 'creator', 'admin', 'super_admin'],
        'admin.moderate' => ['admin', 'super_admin'],
        'admin.analytics' => ['admin', 'super_admin'],
        'admin.content' => ['admin', 'super_admin'],
        'admin.users' => ['super_admin'],
        'admin.settings' => ['super_admin'],
    ];

    /** Plan entitlements. Payments are not integrated: plans are assigned by an admin. */
    public const ENTITLEMENTS = [
        'free' => ['reports' => 10, 'sims' => 2000, 'branding' => false, 'api' => false, 'unbranded_embed' => false, 'docs' => 3],
        'pro' => ['reports' => 250, 'sims' => 10000, 'branding' => false, 'api' => false, 'unbranded_embed' => false, 'docs' => 50],
        'professional' => ['reports' => 1000, 'sims' => 10000, 'branding' => true, 'api' => false, 'unbranded_embed' => true, 'docs' => 200],
        'enterprise' => ['reports' => 100000, 'sims' => 10000, 'branding' => true, 'api' => true, 'unbranded_embed' => true, 'docs' => 2000],
    ];

    private static ?array $user = null;
    private static bool $loaded = false;

    public static function user(): ?array
    {
        if (!self::$loaded) {
            self::$loaded = true;
            $id = $_SESSION['uid'] ?? null;
            if ($id) {
                self::$user = Db::one("SELECT * FROM users WHERE id = ? AND status = 'active'", [$id]);
                if (!self::$user) {
                    unset($_SESSION['uid']);
                }
            }
        }
        return self::$user;
    }

    public static function id(): ?int
    {
        return isset(self::user()['id']) ? (int) self::user()['id'] : null;
    }

    public static function can(string $perm, ?array $u = null): bool
    {
        $u = $u ?? self::user();
        return $u !== null && in_array($u['role'], self::PERMS[$perm] ?? [], true);
    }

    public static function entitlement(string $k, ?array $u = null)
    {
        $u = $u ?? self::user();
        $plan = $u['plan'] ?? 'free';
        return self::ENTITLEMENTS[$plan][$k] ?? self::ENTITLEMENTS['free'][$k];
    }

    public static function require(?string $perm = null): array
    {
        $u = self::user();
        if (!$u) {
            flash('Please log in to continue.');
            redirect('login.php', ['next' => $_SERVER['REQUEST_URI'] ?? '']);
        }
        if ($perm && !self::can($perm)) {
            http_response_code(403);
            render_error(403, 'Your account role does not have access to this area.');
        }
        return $u;
    }

    public static function login(array $u): void
    {
        session_regenerate_id(true);
        $_SESSION['uid'] = (int) $u['id'];
        unset($_SESSION['mfa_pending']);
        self::$loaded = false;
        Db::update('users', ['last_login_at' => Db::now()], 'id = ?', [$u['id']]);
        // Claim reports created as a guest in this browser.
        $gk = guest_key(false);
        if ($gk) {
            Db::q('UPDATE reports SET user_id = ?, guest_key = NULL WHERE guest_key = ? AND user_id IS NULL', [$u['id'], $gk]);
        }
        audit('auth.login', 'user:' . $u['id']);
    }

    public static function logout(): void
    {
        audit('auth.logout', 'user:' . (self::id() ?? 0));
        $_SESSION = [];
        session_regenerate_id(true);
        self::$user = null;
    }
}

/** RFC 6238 TOTP for optional two-factor authentication. */
final class Totp
{
    private const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function secret(): string
    {
        $s = '';
        $bytes = random_bytes(20);
        for ($i = 0; $i < 32; $i++) {
            $s .= self::B32[ord($bytes[$i % 20]) % 32];
        }
        return $s;
    }

    public static function decode(string $b32): string
    {
        $b32 = strtoupper(preg_replace('/[^A-Z2-7]/i', '', $b32));
        $bits = '';
        foreach (str_split($b32) as $c) {
            $bits .= str_pad(decbin(strpos(self::B32, $c)), 5, '0', STR_PAD_LEFT);
        }
        $out = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $out .= chr(bindec($byte));
            }
        }
        return $out;
    }

    public static function code(string $secret, ?int $t = null): string
    {
        $counter = intdiv($t ?? time(), 30);
        $bin = pack('N*', 0) . pack('N*', $counter);
        $h = hash_hmac('sha1', $bin, self::decode($secret), true);
        $o = ord($h[19]) & 0xF;
        $num = ((ord($h[$o]) & 0x7F) << 24) | (ord($h[$o + 1]) << 16) | (ord($h[$o + 2]) << 8) | ord($h[$o + 3]);
        return str_pad((string) ($num % 1000000), 6, '0', STR_PAD_LEFT);
    }

    public static function verify(string $secret, string $code): bool
    {
        $code = preg_replace('/\D/', '', $code);
        foreach ([-1, 0, 1] as $w) {
            if (hash_equals(self::code($secret, time() + 30 * $w), $code)) {
                return true;
            }
        }
        return false;
    }

    public static function uri(string $secret, string $email): string
    {
        return 'otpauth://totp/' . rawurlencode('Shelter and Sense:' . $email) . '?secret=' . $secret . '&issuer=' . rawurlencode('Shelter and Sense');
    }
}

final class Md
{
    /** Minimal, safe Markdown subset: ## / ### headings, paragraphs, - and 1. lists, **bold**, *italic*, [text](url). */
    public static function render(string $md): string
    {
        $html = '';
        $blocks = preg_split("/\n{2,}/", str_replace("\r", '', trim($md)));
        foreach ($blocks as $b) {
            $lines = explode("\n", $b);
            if (preg_match('/^(#{2,3}) (.+)$/', $lines[0], $m) && count($lines) === 1) {
                $tag = strlen($m[1]) === 2 ? 'h2' : 'h3';
                $html .= "<$tag>" . self::inline($m[2]) . "</$tag>";
            } elseif (preg_match('/^- /', $lines[0])) {
                $html .= '<ul>' . implode('', array_map(static fn($l) => '<li>' . self::inline(preg_replace('/^- /', '', $l)) . '</li>', $lines)) . '</ul>';
            } elseif (preg_match('/^\d+\. /', $lines[0])) {
                $html .= '<ol>' . implode('', array_map(static fn($l) => '<li>' . self::inline(preg_replace('/^\d+\. /', '', $l)) . '</li>', $lines)) . '</ol>';
            } else {
                $html .= '<p>' . self::inline(implode(' ', $lines)) . '</p>';
            }
        }
        return $html;
    }

    private static function inline(string $s): string
    {
        $s = htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
        $s = preg_replace('/\*\*(.+?)\*\*/', '<strong>$1</strong>', $s);
        $s = preg_replace('/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/', '<em>$1</em>', $s);
        return preg_replace_callback('/\[([^\]]+)\]\(([^)\s]+)\)/', static function ($m) {
            $href = html_entity_decode($m[2]);
            if (!preg_match('#^(https?://|/|[a-z0-9-]+\.php)#i', $href)) {
                return $m[1];
            }
            return '<a href="' . htmlspecialchars($href, ENT_QUOTES) . '" rel="nofollow noopener">' . $m[1] . '</a>';
        }, $s);
    }
}
