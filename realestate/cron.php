<?php
declare(strict_types=1);

/**
 * Scheduled & maintenance jobs (CLI only).
 *   php cron.php                         run all scheduled jobs
 *   php cron.php create-admin EMAIL PASS create/promote a super admin
 * Each job is logged in jobs_log, bounded by limits, and stopped by the
 * cron_enabled kill switch. Failures are retried next run, never in a loop.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/bootstrap.php';

use SS\{Analysis, Db, Inputs, Settings};

$cmd = $argv[1] ?? 'run';
if ($cmd === 'create-admin') {
    [$email, $pass] = [strtolower($argv[2] ?? ''), $argv[3] ?? ''];
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pass) < 12) {
        fwrite(STDERR, "Usage: php cron.php create-admin EMAIL PASSWORD(12+)\n");
        exit(1);
    }
    $ex = Db::one('SELECT id FROM users WHERE email = ?', [$email]);
    $ex ? Db::update('users', ['role' => 'super_admin', 'pass_hash' => password_hash($pass, PASSWORD_DEFAULT)], 'id = ?', [$ex['id']])
        : Db::insert('users', ['email' => $email, 'pass_hash' => password_hash($pass, PASSWORD_DEFAULT), 'name' => 'Administrator', 'role' => 'super_admin', 'plan' => 'enterprise', 'status' => 'active', 'ref_code' => strtoupper(substr(bin2hex(random_bytes(5)), 0, 8)), 'created_at' => Db::now()]);
    echo "Super admin ready: $email\n";
    exit(0);
}

if (!Settings::on('cron_enabled')) {
    echo "cron disabled by kill switch\n";
    exit(0);
}

function job(string $name, callable $fn): void
{
    $id = Db::insert('jobs_log', ['job' => $name, 'status' => 'running', 'started_at' => Db::now()]);
    try {
        $detail = $fn();
        Db::update('jobs_log', ['status' => 'ok', 'detail' => is_string($detail) ? $detail : json_encode($detail), 'finished_at' => Db::now()], 'id = ?', [$id]);
        echo "$name: ok\n";
    } catch (\Throwable $e) {
        Db::update('jobs_log', ['status' => 'failed', 'detail' => mb_substr($e->getMessage(), 0, 500), 'finished_at' => Db::now()], 'id = ?', [$id]);
        $admin = cfg('NOTIFY_EMAIL');
        if ($admin) {
            send_mail($admin, "[Shelter and Sense] job failed: $name", $e->getMessage());
        }
        echo "$name: FAILED " . $e->getMessage() . "\n";
    }
}

// Prevent overlapping runs (duplicate-job guard).
$running = Db::val("SELECT COUNT(*) FROM jobs_log WHERE status = 'running' AND started_at > ?", [gmdate('Y-m-d H:i:s', time() - 1800)]);
if ($running) {
    echo "another run in progress\n";
    exit(0);
}

job('purge_expired', static function () {
    $a = Db::q('DELETE FROM rate_limits WHERE created_at < ?', [gmdate('Y-m-d H:i:s', time() - 86400)])->rowCount();
    $b = Db::q('DELETE FROM password_resets WHERE expires_at < ? OR used = 1', [Db::now()])->rowCount();
    // Guest reports not claimed within 90 days are removed (data minimisation).
    $old = Db::all('SELECT id FROM reports WHERE user_id IS NULL AND updated_at < ?', [gmdate('Y-m-d H:i:s', time() - 90 * 86400)]);
    foreach ($old as $r) {
        Db::q('DELETE FROM report_versions WHERE report_id = ?', [$r['id']]);
        Db::q('DELETE FROM reports WHERE id = ?', [$r['id']]);
    }
    return "rate_limits=$a resets=$b guest_reports=" . count($old);
});

job('recalculate_stale_reports', static function () {
    $limit = max(0, (int) Settings::get('cron_max_recalcs'));
    $rows = Db::all('SELECT r.id, r.current_version, r.user_id, r.title, v.inputs_json FROM reports r JOIN report_versions v ON v.report_id = r.id AND v.version = r.current_version WHERE v.engine <> ? AND r.user_id IS NOT NULL LIMIT ' . $limit, [Analysis::VERSION]);
    $done = 0;
    foreach ($rows as $r) {
        $inputs = json_decode($r['inputs_json'], true) ?: [];
        [$v, $prov, $err] = Inputs::normalise($inputs);
        if ($err) {
            continue; // inputs no longer valid under new rules — leave for the owner
        }
        $res = Analysis::run($v, $prov) + ['provenance' => $prov];
        $ver = (int) $r['current_version'] + 1;
        Db::insert('report_versions', ['report_id' => $r['id'], 'version' => $ver, 'inputs_json' => $r['inputs_json'], 'result_json' => json_encode($res, JSON_PARTIAL_OUTPUT_ON_ERROR), 'engine' => Analysis::VERSION, 'note' => 'Automatic recalculation: engine ' . Analysis::VERSION, 'created_at' => Db::now()]);
        Db::update('reports', ['current_version' => $ver, 'updated_at' => Db::now()], 'id = ?', [$r['id']]);
        notify((int) $r['user_id'], 'report_update', 'Report "' . $r['title'] . '" was recalculated with engine ' . Analysis::VERSION . '. Previous versions are kept.', url('report.php'));
        $done++;
    }
    return "recalculated=$done of candidates=" . count($rows);
});

job('data_quality_scan', static function () {
    $bad = Db::all("SELECT id FROM listings WHERE status = 'approved' AND (price <= 0 OR (monthly_rent IS NOT NULL AND monthly_rent * 12 > price))");
    foreach ($bad as $l) {
        Db::update('listings', ['status' => 'pending'], 'id = ?', [$l['id']]);
        audit('system.listing_flagged', 'listing:' . $l['id'], 'impossible values');
    }
    return 'flagged=' . count($bad);
});

job('referral_fraud_scan', static function () {
    $rows = Db::all('SELECT ref_code, day, COUNT(*) n FROM referral_clicks WHERE day >= ? GROUP BY ref_code, day HAVING COUNT(*) > 200', [gmdate('Y-m-d', time() - 2 * 86400)]);
    foreach ($rows as $r) {
        audit('system.referral_spike', 'ref:' . $r['ref_code'], $r);
    }
    return 'spikes=' . count($rows);
});
