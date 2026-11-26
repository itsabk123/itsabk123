<?php
declare(strict_types=1);

namespace SS;

use PDO;

/**
 * PDO wrapper supporting SQLite (zero-config staging) and MySQL/MariaDB
 * (production shared hosting). All queries use prepared statements.
 */
final class Db
{
    public const SCHEMA_VERSION = 3;
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo) {
            return self::$pdo;
        }
        $opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false];
        if (cfg('DB_DRIVER') === 'mysql') {
            $dsn = 'mysql:host=' . cfg('DB_HOST') . ';dbname=' . cfg('DB_NAME') . ';charset=utf8mb4';
            self::$pdo = new PDO($dsn, cfg('DB_USER'), cfg('DB_PASS'), $opts);
        } else {
            $path = cfg('DB_PATH');
            $dir = dirname($path);
            if (!is_dir($dir)) {
                mkdir($dir, 0770, true);
            }
            self::$pdo = new PDO('sqlite:' . $path, null, null, $opts);
            self::$pdo->exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 4000;');
        }
        self::migrate();
        return self::$pdo;
    }

    public static function driver(): string
    {
        return cfg('DB_DRIVER') === 'mysql' ? 'mysql' : 'sqlite';
    }

    public static function q(string $sql, array $args = []): \PDOStatement
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($args);
        return $st;
    }

    public static function one(string $sql, array $args = []): ?array
    {
        $r = self::q($sql, $args)->fetch();
        return $r === false ? null : $r;
    }

    public static function all(string $sql, array $args = []): array
    {
        return self::q($sql, $args)->fetchAll();
    }

    public static function val(string $sql, array $args = [])
    {
        $r = self::q($sql, $args)->fetchColumn();
        return $r === false ? null : $r;
    }

    public static function insert(string $table, array $row): int
    {
        $cols = array_keys($row);
        $sql = 'INSERT INTO ' . $table . ' (' . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')';
        self::q($sql, array_values($row));
        return (int) self::pdo()->lastInsertId();
    }

    public static function update(string $table, array $row, string $where, array $args): void
    {
        $set = implode(',', array_map(static fn($c) => "$c = ?", array_keys($row)));
        self::q("UPDATE $table SET $set WHERE $where", array_merge(array_values($row), $args));
    }

    public static function now(): string
    {
        return gmdate('Y-m-d H:i:s');
    }

    private static function migrate(): void
    {
        $pdo = self::$pdo;
        $my = self::driver() === 'mysql';
        $pk = $my ? 'INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
        $fk = $my ? 'INT UNSIGNED' : 'INTEGER';
        $long = $my ? 'MEDIUMTEXT' : 'TEXT';
        $tail = $my ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
        try {
            $ver = (int) $pdo->query("SELECT v FROM settings WHERE k = 'schema_version'")->fetchColumn();
        } catch (\Throwable $e) {
            $ver = 0;
        }
        if ($ver >= self::SCHEMA_VERSION) {
            return;
        }
        $t = [];
        $t[] = "CREATE TABLE IF NOT EXISTS settings (k VARCHAR(64) NOT NULL PRIMARY KEY, v TEXT)";
        $t[] = "CREATE TABLE IF NOT EXISTS users (id $pk, email VARCHAR(190) NOT NULL UNIQUE, pass_hash VARCHAR(255) NOT NULL, name VARCHAR(120) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'investor', plan VARCHAR(20) NOT NULL DEFAULT 'free', status VARCHAR(20) NOT NULL DEFAULT 'active',
            ref_code VARCHAR(16) NOT NULL UNIQUE, referred_by $fk NULL, totp_secret VARCHAR(64) NULL, marketing_opt_in TINYINT NOT NULL DEFAULT 0,
            agency VARCHAR(120) NULL, brand_name VARCHAR(120) NULL, licence_no VARCHAR(80) NULL, verified_pro TINYINT NOT NULL DEFAULT 0, bio TEXT NULL,
            created_at DATETIME NOT NULL, last_login_at DATETIME NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS reports (id $pk, token VARCHAR(32) NOT NULL UNIQUE, user_id $fk NULL, guest_key VARCHAR(64) NULL,
            title VARCHAR(160) NOT NULL, country VARCHAR(8) NOT NULL, city VARCHAR(80) NULL, property_type VARCHAR(30) NOT NULL, currency VARCHAR(8) NOT NULL,
            visibility VARCHAR(12) NOT NULL DEFAULT 'private', current_version INT NOT NULL DEFAULT 1, views INT NOT NULL DEFAULT 0, ref_code VARCHAR(16) NULL,
            created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS report_versions (id $pk, report_id $fk NOT NULL, version INT NOT NULL, inputs_json $long NOT NULL, result_json $long NOT NULL,
            engine VARCHAR(20) NOT NULL, note VARCHAR(200) NULL, created_at DATETIME NOT NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS listings (id $pk, user_id $fk NOT NULL, report_id $fk NULL, title VARCHAR(160) NOT NULL, country VARCHAR(8) NOT NULL,
            city VARCHAR(80) NULL, property_type VARCHAR(30) NOT NULL, price DECIMAL(18,2) NOT NULL, currency VARCHAR(8) NOT NULL, monthly_rent DECIMAL(18,2) NULL,
            area DECIMAL(12,2) NULL, area_unit VARCHAR(6) NOT NULL DEFAULT 'sqm', bedrooms INT NULL, description TEXT NULL, status VARCHAR(12) NOT NULL DEFAULT 'pending',
            sponsored TINYINT NOT NULL DEFAULT 0, views INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS enquiries (id $pk, listing_id $fk NOT NULL, from_user_id $fk NULL, name VARCHAR(120) NOT NULL, email VARCHAR(190) NOT NULL,
            phone VARCHAR(40) NULL, message TEXT NULL, budget VARCHAR(40) NULL, timeline VARCHAR(40) NULL, financing VARCHAR(40) NULL, consent TINYINT NOT NULL,
            status VARCHAR(12) NOT NULL DEFAULT 'new', created_at DATETIME NOT NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS watchlist (user_id $fk NOT NULL, listing_id $fk NOT NULL, last_price DECIMAL(18,2) NULL, created_at DATETIME NOT NULL, PRIMARY KEY (user_id, listing_id))";
        $t[] = "CREATE TABLE IF NOT EXISTS notifications (id $pk, user_id $fk NOT NULL, kind VARCHAR(30) NOT NULL, message VARCHAR(255) NOT NULL, link VARCHAR(255) NULL,
            read_at DATETIME NULL, created_at DATETIME NOT NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS portfolio (id $pk, user_id $fk NOT NULL, name VARCHAR(120) NOT NULL, currency VARCHAR(8) NOT NULL, value DECIMAL(18,2) NOT NULL,
            loan_balance DECIMAL(18,2) NOT NULL DEFAULT 0, monthly_rent DECIMAL(18,2) NOT NULL DEFAULT 0, monthly_costs DECIMAL(18,2) NOT NULL DEFAULT 0,
            purchase_price DECIMAL(18,2) NULL, report_id $fk NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS preferences (user_id $fk NOT NULL PRIMARY KEY, countries VARCHAR(255) NULL, types VARCHAR(255) NULL, budget_min DECIMAL(18,2) NULL,
            budget_max DECIMAL(18,2) NULL, currency VARCHAR(8) NULL, min_yield DECIMAL(6,3) NULL, horizon INT NULL, risk VARCHAR(20) NULL, updated_at DATETIME NOT NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS referral_clicks (id $pk, ref_code VARCHAR(16) NOT NULL, ip_hash VARCHAR(64) NOT NULL, landing VARCHAR(255) NULL, day VARCHAR(10) NOT NULL, created_at DATETIME NOT NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS events (id $pk, name VARCHAR(40) NOT NULL, user_id $fk NULL, session_hash VARCHAR(64) NULL, ref_code VARCHAR(16) NULL, props TEXT NULL, created_at DATETIME NOT NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS articles (id $pk, slug VARCHAR(120) NOT NULL UNIQUE, title VARCHAR(200) NOT NULL, summary VARCHAR(300) NOT NULL, body $long NOT NULL,
            disclosure VARCHAR(20) NOT NULL DEFAULT 'editorial', status VARCHAR(12) NOT NULL DEFAULT 'draft', author_id $fk NULL, published_at DATETIME NULL, updated_at DATETIME NOT NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS audit_log (id $pk, actor_id $fk NULL, action VARCHAR(60) NOT NULL, target VARCHAR(120) NULL, detail TEXT NULL, ip_hash VARCHAR(64) NULL, created_at DATETIME NOT NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS rate_limits (id $pk, bucket VARCHAR(100) NOT NULL, created_at DATETIME NOT NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS password_resets (id $pk, user_id $fk NOT NULL, token_hash VARCHAR(64) NOT NULL, expires_at DATETIME NOT NULL, used TINYINT NOT NULL DEFAULT 0)";
        $t[] = "CREATE TABLE IF NOT EXISTS api_keys (id $pk, user_id $fk NOT NULL, key_hash VARCHAR(64) NOT NULL UNIQUE, prefix VARCHAR(12) NOT NULL, label VARCHAR(80) NULL,
            revoked TINYINT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL, last_used_at DATETIME NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS documents (id $pk, user_id $fk NOT NULL, report_id $fk NULL, filename VARCHAR(200) NOT NULL, stored_name VARCHAR(80) NOT NULL,
            mime VARCHAR(60) NOT NULL, size INT NOT NULL, doc_type VARCHAR(40) NULL, verified TINYINT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL)";
        $t[] = "CREATE TABLE IF NOT EXISTS jobs_log (id $pk, job VARCHAR(60) NOT NULL, status VARCHAR(20) NOT NULL, detail TEXT NULL, started_at DATETIME NOT NULL, finished_at DATETIME NULL)";
        foreach ($t as $sql) {
            $pdo->exec($sql . $tail);
        }
        $idx = [
            'CREATE INDEX idx_reports_user ON reports (user_id)', 'CREATE INDEX idx_reports_vis ON reports (visibility)',
            'CREATE INDEX idx_rv_report ON report_versions (report_id)', 'CREATE INDEX idx_listings_status ON listings (status)',
            'CREATE INDEX idx_enq_listing ON enquiries (listing_id)', 'CREATE INDEX idx_events_name ON events (name, created_at)',
            'CREATE INDEX idx_rl_bucket ON rate_limits (bucket, created_at)', 'CREATE INDEX idx_refclick ON referral_clicks (ref_code, day)',
            'CREATE INDEX idx_notif_user ON notifications (user_id, read_at)',
        ];
        foreach ($idx as $sql) {
            try {
                $pdo->exec($sql);
            } catch (\Throwable $e) {
                // index already exists
            }
        }
        $up = $my ? 'REPLACE INTO settings (k, v) VALUES (?, ?)' : 'INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)';
        $st = $pdo->prepare($up);
        $st->execute(['schema_version', (string) self::SCHEMA_VERSION]);
        foreach (Settings::DEFAULTS as $k => $v) {
            $ex = $pdo->prepare('SELECT COUNT(*) FROM settings WHERE k = ?');
            $ex->execute([$k]);
            if (!(int) $ex->fetchColumn()) {
                $st->execute([$k, (string) $v]);
            }
        }
        Content::seed($pdo);
    }
}

final class Settings
{
    public const DEFAULTS = [
        'registrations_open' => '1',
        'marketplace_enabled' => '1',
        'listings_require_approval' => '1',
        'public_reports_enabled' => '1',
        'max_sims_free' => '2000',
        'max_sims_paid' => '10000',
        'free_report_limit' => '10',
        'cron_enabled' => '1',
        'cron_max_recalcs' => '25',
        'api_rate_per_hour' => '60',
        'payments_enabled' => '0',
    ];
    private static ?array $cache = null;

    public static function get(string $k): string
    {
        if (self::$cache === null) {
            self::$cache = [];
            foreach (Db::all('SELECT k, v FROM settings') as $r) {
                self::$cache[$r['k']] = (string) $r['v'];
            }
        }
        return self::$cache[$k] ?? (self::DEFAULTS[$k] ?? '');
    }

    public static function set(string $k, string $v): void
    {
        $sql = Db::driver() === 'mysql' ? 'REPLACE INTO settings (k, v) VALUES (?, ?)' : 'INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)';
        Db::q($sql, [$k, $v]);
        self::$cache = null;
    }

    public static function on(string $k): bool
    {
        return self::get($k) === '1';
    }
}
