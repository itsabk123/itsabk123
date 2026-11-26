<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Auth, Db, Fmt, Registry, Settings, View, Countries};

$me = Auth::require('admin.moderate');
$super = Auth::can('admin.users');
$tabs = ['overview' => 'Overview', 'funnel' => 'Analytics', 'users' => 'Users', 'listings' => 'Listings', 'reports' => 'Reports', 'content' => 'Content', 'referrals' => 'Referrals', 'data' => 'Data & models', 'jobs' => 'Jobs', 'audit' => 'Audit log'];
if ($super) {
    $tabs['settings'] = 'Settings';
}
$tab = isset($tabs[$_GET['tab'] ?? '']) ? $_GET['tab'] : 'overview';

if (is_post()) {
    csrf_check();
    $a = (string) ($_POST['action'] ?? '');
    $id = (int) ($_POST['id'] ?? 0);
    switch ($a) {
        case 'user_update':
            if (!$super) {
                render_error(403, 'Only super admins can change users.');
            }
            if ($id === (int) $me['id'] && ($_POST['role'] ?? '') !== 'super_admin') {
                flash('You cannot remove your own super-admin role.', 'err');
                break;
            }
            $row = [];
            if (isset(Auth::ROLES[$_POST['role'] ?? ''])) {
                $row['role'] = $_POST['role'];
            }
            if (isset(Auth::PLANS[$_POST['plan'] ?? ''])) {
                $row['plan'] = $_POST['plan'];
            }
            if (in_array($_POST['status'] ?? '', ['active', 'suspended'], true)) {
                $row['status'] = $_POST['status'];
            }
            $row['verified_pro'] = !empty($_POST['verified_pro']) ? 1 : 0;
            Db::update('users', $row, 'id = ?', [$id]);
            audit('admin.user_update', 'user:' . $id, $row);
            flash('User updated.', 'ok');
            break;
        case 'user_reset':
            if (!$super) {
                render_error(403, 'Forbidden');
            }
            $tmp = bin2hex(random_bytes(6));
            Db::update('users', ['pass_hash' => password_hash($tmp, PASSWORD_DEFAULT), 'totp_secret' => null], 'id = ?', [$id]);
            audit('admin.user_reset', 'user:' . $id);
            flash('Temporary password for user #' . $id . ': ' . $tmp . ' — share it securely; 2FA was cleared.', 'ok');
            break;
        case 'listing_mod':
            $st = in_array($_POST['status'] ?? '', ['approved', 'rejected', 'pending'], true) ? $_POST['status'] : 'pending';
            $l = Db::one('SELECT user_id, title FROM listings WHERE id = ?', [$id]);
            if ($l) {
                Db::update('listings', ['status' => $st, 'sponsored' => !empty($_POST['sponsored']) ? 1 : 0, 'updated_at' => Db::now()], 'id = ?', [$id]);
                notify((int) $l['user_id'], 'moderation', 'Your listing "' . $l['title'] . '" is now ' . $st . '.', url('marketplace.php', ['id' => $id]));
                audit('admin.listing_' . $st, 'listing:' . $id, ['sponsored' => !empty($_POST['sponsored'])]);
            }
            break;
        case 'report_unpublish':
            Db::update('reports', ['visibility' => 'private'], 'id = ?', [$id]);
            audit('admin.report_unpublish', 'report:' . $id);
            flash('Report set to private.', 'ok');
            break;
        case 'article_save':
            $slug = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', (string) ($_POST['slug'] ?? '')), '-'));
            $row = ['title' => mb_substr(trim((string) $_POST['title']), 0, 200), 'summary' => mb_substr(trim((string) $_POST['summary']), 0, 300), 'body' => (string) $_POST['body'],
                'disclosure' => in_array($_POST['disclosure'] ?? '', ['editorial', 'sponsored', 'affiliate'], true) ? $_POST['disclosure'] : 'editorial',
                'status' => ($_POST['status'] ?? '') === 'published' ? 'published' : 'draft', 'updated_at' => Db::now()];
            if (!$slug || !$row['title']) {
                flash('Slug and title are required.', 'err');
                break;
            }
            $ex = Db::one('SELECT id, published_at FROM articles WHERE slug = ?', [$slug]);
            if ($row['status'] === 'published' && (!$ex || !$ex['published_at'])) {
                $row['published_at'] = Db::now();
            }
            $ex ? Db::update('articles', $row, 'id = ?', [$ex['id']]) : Db::insert('articles', $row + ['slug' => $slug, 'author_id' => $me['id']]);
            audit('admin.article_save', 'article:' . $slug, ['status' => $row['status']]);
            flash('Article saved.', 'ok');
            break;
        case 'settings':
            if (!Auth::can('admin.settings')) {
                render_error(403, 'Forbidden');
            }
            foreach (Settings::DEFAULTS as $k => $def) {
                if (in_array($def, ['0', '1'], true)) {
                    Settings::set($k, !empty($_POST[$k]) ? '1' : '0');
                } elseif (isset($_POST[$k]) && is_numeric($_POST[$k])) {
                    Settings::set($k, (string) max(0, (int) $_POST[$k]));
                }
            }
            audit('admin.settings', null, $_POST);
            flash('Settings saved.', 'ok');
            break;
        case 'referral_void':
            if (!$super) {
                render_error(403, 'Forbidden');
            }
            Db::q('UPDATE users SET referred_by = NULL WHERE id = ?', [$id]);
            audit('admin.referral_void', 'user:' . $id);
            flash('Referral attribution removed.', 'ok');
            break;
    }
    redirect('admin.php', ['tab' => $tab] + array_intersect_key($_GET, ['q' => 1]));
}

$since = static fn($d) => gmdate('Y-m-d H:i:s', time() - $d * 86400);
$ev = static fn($name, $d = 30) => (int) Db::val('SELECT COUNT(*) FROM events WHERE name = ? AND created_at > ?', [$name, $since($d)]);
$page_title = 'Admin';
$noindex = true;
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap">
  <div class="section-head"><div><p class="eyebrow"><?= e(Auth::ROLES[$me['role']]) ?></p><h1>Control centre</h1></div><p class="small muted">Environment: <?= e(cfg('ENVIRONMENT')) ?> · DB: <?= e(Db::driver()) ?> · schema v<?= Db::SCHEMA_VERSION ?></p></div>
  <nav class="tabs"><?php foreach ($tabs as $k => $l): ?><a href="<?= e(url('admin.php', ['tab' => $k])) ?>"<?= $tab === $k ? ' aria-current="page"' : '' ?>><?= e($l) ?></a><?php endforeach; ?></nav>

<?php if ($tab === 'overview'):
    $roles = Db::all('SELECT role, COUNT(*) n FROM users GROUP BY role');
    $plans = Db::all('SELECT plan, COUNT(*) n FROM users GROUP BY plan');
    $users = (int) Db::val('SELECT COUNT(*) FROM users');
    $active = (int) Db::val('SELECT COUNT(DISTINCT user_id) FROM reports WHERE user_id IS NOT NULL');
    ?>
  <div class="stats">
    <?= View::stat('Users', (string) $users, (int) Db::val('SELECT COUNT(*) FROM users WHERE created_at > ?', [$since(7)]) . ' in 7 days') ?>
    <?= View::stat('Activated users', (string) $active, $users ? Fmt::pct($active / $users) . ' ran ≥1 evaluation' : '') ?>
    <?= View::stat('Reports', (string) Db::val('SELECT COUNT(*) FROM reports'), Db::val("SELECT COUNT(*) FROM reports WHERE visibility <> 'private'") . ' shared') ?>
    <?= View::stat('Evaluations (30d)', (string) $ev('evaluation_completed')) ?>
    <?= View::stat('Calculator uses (30d)', (string) ($ev('tool_compute') + $ev('tool_view'))) ?>
    <?= View::stat('Pending listings', (string) Db::val("SELECT COUNT(*) FROM listings WHERE status = 'pending'"), '', Db::val("SELECT COUNT(*) FROM listings WHERE status = 'pending'") ? 'neg' : '') ?>
    <?= View::stat('Enquiries (30d)', (string) Db::val('SELECT COUNT(*) FROM enquiries WHERE created_at > ?', [$since(30)])) ?>
    <?= View::stat('Referral clicks (30d)', (string) Db::val('SELECT COUNT(*) FROM referral_clicks WHERE created_at > ?', [$since(30)])) ?>
    <?= View::stat('MRR', 'n/a', 'Payments not enabled') ?>
  </div>
  <div class="grid g2" style="margin-top:16px">
    <?= View::table(['Role', 'Users'], array_map(static fn($r) => [Auth::ROLES[$r['role']] ?? $r['role'], (string) $r['n']], $roles)) ?>
    <?= View::table(['Plan', 'Users'], array_map(static fn($r) => [Auth::PLANS[$r['plan']] ?? $r['plan'], (string) $r['n']], $plans)) ?>
  </div>

<?php elseif ($tab === 'funnel'):
    $steps = [['Calculator viewed', 'tool_view'], ['Calculator used', 'tool_compute'], ['Evaluation form viewed', 'evaluate_view'], ['Evaluation completed', 'evaluation_completed'], ['Sign-up', 'signup'], ['Report shared', 'report_visibility'], ['Enquiry sent', 'enquiry_sent']];
    $top = Db::all("SELECT props, COUNT(*) n FROM events WHERE name IN ('tool_view','tool_compute') AND created_at > ? GROUP BY props ORDER BY n DESC LIMIT 15", [$since(30)]);
    $daily = Db::all("SELECT substr(created_at, 1, 10) d, COUNT(*) n FROM events WHERE name = 'evaluation_completed' AND created_at > ? GROUP BY d ORDER BY d", [$since(30)]);
    ?>
  <h2>Funnel — last 30 days</h2>
  <?= View::table(['Step', 'Events', '7 days'], array_map(static fn($s) => [$s[0], (string) $ev($s[1]), (string) $ev($s[1], 7)], $steps)) ?>
  <p class="hint">Activation event: <strong>evaluation completed</strong> (demonstrated value), not account creation. Baseline targets will be set after real traffic is observed.</p>
  <div class="grid g2" style="margin-top:16px;align-items:start">
    <div><h3>Top calculators</h3><?= View::table(['Tool', 'Events'], array_map(static fn($r) => [json_decode((string) $r['props'], true)['t'] ?? '—', (string) $r['n']], $top)) ?></div>
    <div><h3>Evaluations per day</h3><?= $daily ? \SS\Charts::bars(array_map(static fn($r) => substr($r['d'], 5), $daily), array_map(static fn($r) => (float) $r['n'], $daily), 'Evaluations per day', static fn($v) => (string) (int) $v) : '<p class="muted">No data yet.</p>' ?></div>
  </div>

<?php elseif ($tab === 'users'):
    $q = trim((string) ($_GET['q'] ?? ''));
    $users = $q !== '' ? Db::all('SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT 100', ["%$q%", "%$q%"]) : Db::all('SELECT * FROM users ORDER BY created_at DESC LIMIT 100');
    ?>
  <form method="get" class="btn-row" style="margin-bottom:12px"><input type="hidden" name="tab" value="users"><input name="q" value="<?= e($q) ?>" placeholder="Search email or name" aria-label="Search users" style="max-width:320px"><button class="btn btn-sm">Search</button></form>
  <?php if (!$super): ?><p class="hint">Read-only: only super admins can change roles, plans or status.</p><?php endif; ?>
  <div class="tablewrap"><table><thead><tr><th>User</th><th>Joined / last login</th><th>Role · plan · status</th><th>Licence</th><th></th></tr></thead><tbody>
  <?php foreach ($users as $x): ?>
    <tr><th scope="row">#<?= (int) $x['id'] ?> <?= e($x['name']) ?><br><span class="small muted"><?= e($x['email']) ?> · ref <?= e($x['ref_code']) ?><?= $x['totp_secret'] ? ' · 2FA' : '' ?></span></th>
    <td class="small"><?= e(substr($x['created_at'], 0, 10)) ?><br><?= e($x['last_login_at'] ? substr($x['last_login_at'], 0, 16) : 'never') ?></td>
    <td><?php if ($super): ?><form method="post" class="btn-row"><?= csrf_field() ?><input type="hidden" name="action" value="user_update"><input type="hidden" name="id" value="<?= (int) $x['id'] ?>">
      <select name="role" aria-label="Role"><?php foreach (Auth::ROLES as $k => $l): ?><option value="<?= $k ?>"<?= $x['role'] === $k ? ' selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?></select>
      <select name="plan" aria-label="Plan"><?php foreach (Auth::PLANS as $k => $l): ?><option value="<?= $k ?>"<?= $x['plan'] === $k ? ' selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?></select>
      <select name="status" aria-label="Status"><option<?= $x['status'] === 'active' ? ' selected' : '' ?>>active</option><option<?= $x['status'] === 'suspended' ? ' selected' : '' ?>>suspended</option></select>
      <label class="checkrow small"><input type="checkbox" name="verified_pro" value="1"<?= $x['verified_pro'] ? ' checked' : '' ?>> verified</label>
      <button class="btn btn-sm btn-ghost">Save</button></form><?php else: ?><?= e($x['role'] . ' · ' . $x['plan'] . ' · ' . $x['status']) ?><?php endif; ?></td>
    <td class="small"><?= e($x['licence_no'] ?: '—') ?><?= $x['agency'] ? '<br>' . e($x['agency']) : '' ?></td>
    <td><?php if ($super): ?><form method="post" data-confirm="Reset this user's password and clear 2FA?"><?= csrf_field() ?><input type="hidden" name="action" value="user_reset"><input type="hidden" name="id" value="<?= (int) $x['id'] ?>"><button class="btn-link small">Reset access</button></form><?php endif; ?></td></tr>
  <?php endforeach; ?>
  </tbody></table></div>

<?php elseif ($tab === 'listings'):
    $ls = Db::all("SELECT l.*, u.email, u.role FROM listings l JOIN users u ON u.id = l.user_id ORDER BY CASE l.status WHEN 'pending' THEN 0 ELSE 1 END, l.created_at DESC LIMIT 200");
    $dupes = Db::all('SELECT a.id AS a, b.id AS b, a.title FROM listings a JOIN listings b ON a.id < b.id AND a.country = b.country AND a.price = b.price AND (a.title = b.title OR (a.area IS NOT NULL AND a.area = b.area AND a.city = b.city))');
    ?>
  <?php if ($dupes): ?><div class="callout"><p><strong>Possible duplicates:</strong> <?= e(implode('; ', array_map(static fn($d) => '#' . $d['a'] . ' ↔ #' . $d['b'] . ' (' . $d['title'] . ')', $dupes))) ?></p></div><?php endif; ?>
  <div class="tablewrap"><table><thead><tr><th>Listing</th><th>Lister</th><th>Price</th><th>Moderation</th></tr></thead><tbody>
  <?php foreach ($ls as $l): ?><tr><th scope="row"><a href="<?= e(url('marketplace.php', ['id' => $l['id']])) ?>">#<?= (int) $l['id'] ?> <?= e($l['title']) ?></a><br><span class="small muted"><?= e(Countries::name($l['country'])) ?> · <?= e(substr($l['created_at'], 0, 10)) ?></span></th><td class="small"><?= e($l['email']) ?><br><?= e($l['role']) ?></td><td><?= e(Fmt::money((float) $l['price'], $l['currency'])) ?></td>
    <td><form method="post" class="btn-row"><?= csrf_field() ?><input type="hidden" name="action" value="listing_mod"><input type="hidden" name="id" value="<?= (int) $l['id'] ?>">
      <select name="status" aria-label="Status"><?php foreach (['pending', 'approved', 'rejected'] as $s): ?><option<?= $l['status'] === $s ? ' selected' : '' ?>><?= $s ?></option><?php endforeach; ?></select>
      <label class="checkrow small"><input type="checkbox" name="sponsored" value="1"<?= $l['sponsored'] ? ' checked' : '' ?>> sponsored</label><button class="btn btn-sm btn-ghost">Save</button></form><?= $l['status'] === 'withdrawn' ? View::badge('withdrawn') : '' ?></td></tr><?php endforeach; ?>
  </tbody></table></div>

<?php elseif ($tab === 'reports'):
    $rs = Db::all("SELECT r.id, r.token, r.title, r.visibility, r.views, r.updated_at, u.email FROM reports r LEFT JOIN users u ON u.id = r.user_id WHERE r.visibility <> 'private' ORDER BY r.updated_at DESC LIMIT 200");
    ?>
  <p class="muted small">Shared reports (private reports are not listed to staff).</p>
  <div class="tablewrap"><table><thead><tr><th>Report</th><th>Owner</th><th>Visibility</th><th>Views</th><th></th></tr></thead><tbody>
  <?php foreach ($rs as $r): ?><tr><th scope="row"><a href="<?= e(url('report.php', ['id' => $r['token']])) ?>"><?= e($r['title']) ?></a></th><td class="small"><?= e($r['email'] ?? 'guest') ?></td><td><?= e($r['visibility']) ?></td><td><?= (int) $r['views'] ?></td>
    <td><form method="post" data-confirm="Make this report private?"><?= csrf_field() ?><input type="hidden" name="action" value="report_unpublish"><input type="hidden" name="id" value="<?= (int) $r['id'] ?>"><button class="btn-link small">Unpublish</button></form></td></tr><?php endforeach; ?>
  </tbody></table></div>

<?php elseif ($tab === 'content'):
    $edit = !empty($_GET['slug']) ? Db::one('SELECT * FROM articles WHERE slug = ?', [(string) $_GET['slug']]) : null;
    $arts = Db::all('SELECT slug, title, status, disclosure, updated_at FROM articles ORDER BY updated_at DESC');
    ?>
  <div class="grid g2" style="align-items:start">
    <div><?= View::table(['Article', 'Status', 'Disclosure', 'Updated'], array_map(static fn($a) => [$a['title'], $a['status'], $a['disclosure'], substr($a['updated_at'], 0, 10)], $arts)) ?>
      <ul class="small"><?php foreach ($arts as $a): ?><li><a href="<?= e(url('admin.php', ['tab' => 'content', 'slug' => $a['slug']])) ?>">Edit "<?= e($a['title']) ?>"</a></li><?php endforeach; ?></ul></div>
    <form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="article_save">
      <h2><?= $edit ? 'Edit article' : 'New article' ?></h2>
      <div class="field"><label for="as">Slug</label><input id="as" name="slug" value="<?= e($edit['slug'] ?? '') ?>" required></div>
      <div class="field"><label for="at">Title</label><input id="at" name="title" value="<?= e($edit['title'] ?? '') ?>" required></div>
      <div class="field"><label for="asu">Summary (meta description)</label><input id="asu" name="summary" value="<?= e($edit['summary'] ?? '') ?>" maxlength="300"></div>
      <div class="field"><label for="ab">Body (Markdown: ## headings, - lists, **bold**, [links](url))</label><textarea id="ab" name="body" rows="14"><?= e($edit['body'] ?? '') ?></textarea></div>
      <div class="fgrid"><div class="field"><label for="ad">Disclosure</label><select id="ad" name="disclosure"><?php foreach (['editorial', 'sponsored', 'affiliate'] as $d): ?><option<?= ($edit['disclosure'] ?? '') === $d ? ' selected' : '' ?>><?= $d ?></option><?php endforeach; ?></select></div>
      <div class="field"><label for="ast">Status</label><select id="ast" name="status"><?php foreach (['draft', 'published'] as $d): ?><option<?= ($edit['status'] ?? 'draft') === $d ? ' selected' : '' ?>><?= $d ?></option><?php endforeach; ?></select></div></div>
      <p class="hint">Market statistics in articles must cite a source. Sponsored and affiliate content is labelled automatically.</p>
      <button class="btn btn-sm">Save</button>
    </form>
  </div>

<?php elseif ($tab === 'referrals'):
    $top = Db::all('SELECT u.id, u.name, u.email, u.ref_code, u.role, (SELECT COUNT(*) FROM referral_clicks c WHERE c.ref_code = u.ref_code) clicks, (SELECT COUNT(*) FROM users r WHERE r.referred_by = u.id) signups FROM users u ORDER BY signups DESC, clicks DESC LIMIT 50');
    $suspicious = Db::all('SELECT ref_code, day, COUNT(*) n FROM referral_clicks GROUP BY ref_code, day HAVING COUNT(*) > 200 ORDER BY n DESC LIMIT 20');
    $recent = Db::all('SELECT u.id, u.email, u.created_at, p.email AS referrer FROM users u JOIN users p ON p.id = u.referred_by ORDER BY u.created_at DESC LIMIT 50');
    ?>
  <?php if ($suspicious): ?><div class="callout"><p><strong>Unusual click volume:</strong> <?= e(implode(', ', array_map(static fn($s) => $s['ref_code'] . ' on ' . $s['day'] . ' (' . $s['n'] . ')', $suspicious))) ?></p></div><?php endif; ?>
  <?= View::table(['Partner', 'Role', 'Code', 'Unique clicks', 'Sign-ups', 'Conversion'], array_map(static fn($r) => [$r['name'] . ' <' . $r['email'] . '>', $r['role'], $r['ref_code'], (string) $r['clicks'], (string) $r['signups'], $r['clicks'] ? Fmt::pct($r['signups'] / $r['clicks']) : '—'], array_filter($top, static fn($r) => $r['clicks'] || $r['signups']))) ?>
  <h3 style="margin-top:16px">Recent referred sign-ups</h3>
  <div class="tablewrap"><table><thead><tr><th>User</th><th>Referrer</th><th>Joined</th><th></th></tr></thead><tbody>
  <?php foreach ($recent as $r): ?><tr><td><?= e($r['email']) ?></td><td><?= e($r['referrer']) ?></td><td><?= e(substr($r['created_at'], 0, 10)) ?></td><td><?php if ($super): ?><form method="post" data-confirm="Remove referral attribution for this user?"><?= csrf_field() ?><input type="hidden" name="action" value="referral_void"><input type="hidden" name="id" value="<?= (int) $r['id'] ?>"><button class="btn-link small">Void</button></form><?php endif; ?></td></tr><?php endforeach; ?>
  </tbody></table></div>
  <p class="hint">Payouts are not active; commission structures require a partner agreement.</p>

<?php elseif ($tab === 'data'): ?>
  <h2>Model registry</h2>
  <?= View::table(['Model', 'Version', 'Status', 'Validation'], array_map(static fn($m) => [$m[0], $m[1], $m[2], $m[7]], Registry::models())) ?>
  <h2 style="margin-top:18px">Data sources</h2>
  <?= View::table(['Source', 'Data', 'Granularity', 'Licence', 'Status'], Countries::GLOBAL_SOURCES) ?>
  <p class="hint">No external source is connected, so there are no API credentials, import schedules or source-health checks to show yet. When a licensed source is added, its credentials belong in config.php (never the database UI) and its health check in cron.php.</p>
  <h2 style="margin-top:18px">Data quality</h2>
  <?php
    $stale = (int) Db::val('SELECT COUNT(*) FROM reports r JOIN report_versions v ON v.report_id = r.id AND v.version = r.current_version WHERE v.engine <> ?', [\SS\Analysis::VERSION]);
    $impossible = (int) Db::val('SELECT COUNT(*) FROM listings WHERE price <= 0 OR (monthly_rent IS NOT NULL AND monthly_rent * 12 > price)');
  ?>
  <ul class="small"><li>Reports computed with an older engine: <?= $stale ?> (recalculated by the nightly job within its limit).</li><li>Listings with impossible values (rent ≥ price per year, or price ≤ 0): <?= $impossible ?>.</li><li>Unverified documents: <?= (int) Db::val('SELECT COUNT(*) FROM documents WHERE verified = 0') ?>.</li></ul>

<?php elseif ($tab === 'jobs'):
    $jobs = Db::all('SELECT * FROM jobs_log ORDER BY started_at DESC LIMIT 100');
    ?>
  <p class="small">Scheduled jobs run via <span class="mono">php cron.php</span> (set a cPanel cron, e.g. hourly). Kill switch: Settings → cron_enabled.</p>
  <?= $jobs ? View::table(['Job', 'Status', 'Detail', 'Started', 'Finished'], array_map(static fn($j) => [$j['job'], $j['status'], mb_substr((string) $j['detail'], 0, 160), $j['started_at'], (string) $j['finished_at']], $jobs)) : '<p class="muted">No job runs recorded yet.</p>' ?>

<?php elseif ($tab === 'audit'):
    $logs = Db::all('SELECT a.*, u.email FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 200');
    ?>
  <?= View::table(['When', 'Actor', 'Action', 'Target', 'Detail'], array_map(static fn($l) => [$l['created_at'], $l['email'] ?? 'system/guest', $l['action'], (string) $l['target'], mb_substr((string) $l['detail'], 0, 120)], $logs)) ?>

<?php elseif ($tab === 'settings' && $super): ?>
  <form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="settings">
    <h2>Feature flags & limits</h2>
    <?php foreach (Settings::DEFAULTS as $k => $def): $cur = Settings::get($k); ?>
      <?php if (in_array($def, ['0', '1'], true)): ?>
        <label class="checkrow"><input type="checkbox" name="<?= e($k) ?>" value="1"<?= $cur === '1' ? ' checked' : '' ?>> <span class="mono"><?= e($k) ?></span></label>
      <?php else: ?>
        <div class="field"><label for="s_<?= e($k) ?>" class="mono"><?= e($k) ?></label><input id="s_<?= e($k) ?>" name="<?= e($k) ?>" value="<?= e($cur) ?>" inputmode="numeric" style="max-width:200px"></div>
      <?php endif; ?>
    <?php endforeach; ?>
    <p class="hint">payments_enabled only changes labels — no payment provider is integrated.</p>
    <button class="btn btn-sm">Save settings</button>
  </form>
<?php endif; ?>
</div></section>
<?php require __DIR__ . '/views/footer.php';
