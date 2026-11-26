<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Auth, Db, Fmt, Inputs, View, Countries};

$u = Auth::require();
$uid = (int) $u['id'];
$role = $u['role'];

$tabs = ['overview' => 'Overview', 'reports' => 'Reports'];
if (Auth::can('portfolio')) {
    $tabs['portfolio'] = 'Portfolio';
}
$tabs['watchlist'] = 'Watchlist';
$tabs['matches'] = 'Matches';
if (Auth::can('listing.create')) {
    $tabs['listings'] = 'Listings';
    $tabs['leads'] = 'Leads';
}
$tabs['referrals'] = $role === 'creator' ? 'Earnings & referrals' : 'Referrals';
$tabs['notifications'] = 'Notifications';
$tab = isset($tabs[$_GET['tab'] ?? '']) ? $_GET['tab'] : 'overview';

if (is_post()) {
    csrf_check();
    $a = (string) ($_POST['action'] ?? '');
    $num = static fn($k) => is_numeric(str_replace(',', '', (string) ($_POST[$k] ?? ''))) ? (float) str_replace(',', '', (string) $_POST[$k]) : 0.0;
    if ($a === 'pf_save' && Auth::can('portfolio')) {
        $row = ['name' => mb_substr(trim(strip_tags((string) ($_POST['name'] ?? 'Property'))), 0, 120) ?: 'Property', 'currency' => array_key_exists($_POST['currency'] ?? '', Countries::currencyOptions()) ? $_POST['currency'] : 'USD',
            'value' => max(0, $num('value')), 'loan_balance' => max(0, $num('loan_balance')), 'monthly_rent' => max(0, $num('monthly_rent')), 'monthly_costs' => max(0, $num('monthly_costs')), 'updated_at' => Db::now()];
        if (!empty($_POST['id'])) {
            Db::update('portfolio', $row, 'id = ? AND user_id = ?', [(int) $_POST['id'], $uid]);
        } else {
            Db::insert('portfolio', $row + ['user_id' => $uid, 'purchase_price' => $row['value'], 'created_at' => Db::now()]);
            track('portfolio_add', ['manual' => 1]);
        }
        flash('Portfolio updated.', 'ok');
    } elseif ($a === 'pf_delete') {
        Db::q('DELETE FROM portfolio WHERE id = ? AND user_id = ?', [(int) $_POST['id'], $uid]);
    } elseif ($a === 'notif_read') {
        Db::q('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [Db::now(), $uid]);
    } elseif ($a === 'watch_remove') {
        Db::q('DELETE FROM watchlist WHERE user_id = ? AND listing_id = ?', [$uid, (int) $_POST['listing_id']]);
    } elseif ($a === 'lead_status' && Auth::can('listing.enquiries')) {
        $st = in_array($_POST['status'] ?? '', ['new', 'contacted', 'qualified', 'closed'], true) ? $_POST['status'] : 'new';
        Db::q('UPDATE enquiries SET status = ? WHERE id = ? AND listing_id IN (SELECT id FROM listings WHERE user_id = ?)', [$st, (int) $_POST['id'], $uid]);
    } elseif ($a === 'prefs') {
        $countries = array_values(array_intersect((array) ($_POST['countries'] ?? []), array_keys(Countries::LIST)));
        $types = array_values(array_intersect((array) ($_POST['types'] ?? []), array_keys(Inputs::PROPERTY_TYPES)));
        $row = ['countries' => implode(',', $countries), 'types' => implode(',', $types), 'budget_min' => $num('budget_min') ?: null, 'budget_max' => $num('budget_max') ?: null,
            'currency' => array_key_exists($_POST['currency'] ?? '', Countries::currencyOptions()) ? $_POST['currency'] : null, 'min_yield' => $num('min_yield') ? $num('min_yield') / 100 : null,
            'horizon' => (int) $num('horizon') ?: null, 'risk' => in_array($_POST['risk'] ?? '', ['conservative', 'balanced', 'aggressive'], true) ? $_POST['risk'] : null, 'updated_at' => Db::now()];
        if (Db::val('SELECT COUNT(*) FROM preferences WHERE user_id = ?', [$uid])) {
            Db::update('preferences', $row, 'user_id = ?', [$uid]);
        } else {
            Db::insert('preferences', $row + ['user_id' => $uid]);
        }
        flash('Investment preferences saved. They are private and only used to rank listings for you.', 'ok');
    }
    redirect('dashboard.php', ['tab' => $tab]);
}

$myReports = Db::all('SELECT token, title, currency, visibility, views, current_version, updated_at FROM reports WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200', [$uid]);
$pf = Auth::can('portfolio') ? Db::all('SELECT * FROM portfolio WHERE user_id = ? ORDER BY created_at DESC', [$uid]) : [];
$notifs = Db::all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [$uid]);
$unread = count(array_filter($notifs, static fn($n) => !$n['read_at']));

/** Rank approved listings against the user's private preferences (transparent criteria). */
function match_listings(array $prefs, int $limit = 20): array
{
    $rows = Db::all("SELECT * FROM listings WHERE status = 'approved' ORDER BY created_at DESC LIMIT 500");
    $out = [];
    foreach ($rows as $l) {
        $why = [];
        $score = 0;
        $crit = 0;
        if ($prefs['countries']) {
            $crit++;
            if (in_array($l['country'], explode(',', $prefs['countries']), true)) {
                $score++;
                $why[] = 'country';
            }
        }
        if ($prefs['types']) {
            $crit++;
            if (in_array($l['property_type'], explode(',', $prefs['types']), true)) {
                $score++;
                $why[] = 'type';
            }
        }
        if (($prefs['budget_min'] || $prefs['budget_max']) && (!$prefs['currency'] || $prefs['currency'] === $l['currency'])) {
            $crit++;
            if ((!$prefs['budget_min'] || $l['price'] >= $prefs['budget_min']) && (!$prefs['budget_max'] || $l['price'] <= $prefs['budget_max'])) {
                $score++;
                $why[] = 'budget';
            }
        }
        if ($prefs['min_yield'] && $l['monthly_rent']) {
            $crit++;
            if ($l['monthly_rent'] * 12 / $l['price'] >= $prefs['min_yield']) {
                $score++;
                $why[] = 'gross yield';
            }
        }
        if ($crit && $score) {
            $out[] = $l + ['match' => $score / $crit, 'why' => $why, 'crit' => $crit];
        }
    }
    usort($out, static fn($a, $b) => $b['match'] <=> $a['match']);
    return array_slice($out, 0, $limit);
}

$prefs = Db::one('SELECT * FROM preferences WHERE user_id = ?', [$uid]);
$page_title = 'Dashboard';
$noindex = true;
track('dashboard_view', ['tab' => $tab]);
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap">
  <div class="section-head">
    <div><p class="eyebrow"><?= e(Auth::ROLES[$role]) ?> · <?= e(Auth::PLANS[$u['plan']]) ?> plan</p><h1>Hello, <?= e($u['name']) ?></h1></div>
    <div class="btn-row"><a class="btn" href="<?= e(url('evaluate.php')) ?>">New evaluation</a><a class="btn btn-ghost" href="<?= e(url('account.php')) ?>">Account &amp; security</a></div>
  </div>
  <nav class="tabs" aria-label="Dashboard sections">
    <?php foreach ($tabs as $k => $l): ?><a href="<?= e(url('dashboard.php', ['tab' => $k])) ?>"<?= $tab === $k ? ' aria-current="page"' : '' ?>><?= e($l) ?><?= $k === 'notifications' && $unread ? ' (' . $unread . ')' : '' ?></a><?php endforeach; ?>
  </nav>

<?php if ($tab === 'overview'):
    $listCount = (int) Db::val('SELECT COUNT(*) FROM listings WHERE user_id = ?', [$uid]);
    $leadCount = (int) Db::val("SELECT COUNT(*) FROM enquiries e JOIN listings l ON l.id = e.listing_id WHERE l.user_id = ? AND e.status = 'new'", [$uid]);
    $refSignups = (int) Db::val('SELECT COUNT(*) FROM users WHERE referred_by = ?', [$uid]);
    ?>
  <?php if (!empty($_GET['welcome'])): ?>
  <div class="card" style="margin-bottom:16px"><h2>Get started</h2><ol>
    <?php if (in_array($role, ['investor', 'creator'], true)): ?><li><a href="<?= e(url('evaluate.php')) ?>">Evaluate your first property</a> (or open the <a href="<?= e(url('report.php', ['sample' => 1])) ?>">example report</a>).</li><li><a href="<?= e(url('dashboard.php', ['tab' => 'matches'])) ?>">Set your investment preferences</a> to see matching listings.</li><?php endif; ?>
    <?php if (in_array($role, ['seller', 'agent'], true)): ?><li><a href="<?= e(url('evaluate.php')) ?>">Evaluate the property</a> to create an investor report.</li><li>From the report, choose <strong>Publish as listing</strong>.</li><?php endif; ?>
    <?php if (in_array($role, ['agent', 'creator'], true)): ?><li>Add your <a href="<?= e(url('account.php')) ?>">brand details</a> and grab <a href="<?= e(url('developers.php')) ?>">embed codes</a>.</li><?php endif; ?>
    <li>Turn on <a href="<?= e(url('account.php')) ?>#mfa">two-factor authentication</a>.</li>
  </ol></div>
  <?php endif; ?>
  <div class="stats">
    <?= View::stat('Saved reports', (string) count($myReports), 'of ' . number_format(Auth::entitlement('reports')) . ' on your plan') ?>
    <?php if (Auth::can('portfolio')): ?><?= View::stat('Portfolio properties', (string) count($pf)) ?><?php endif; ?>
    <?php if (Auth::can('listing.create')): ?><?= View::stat('Listings', (string) $listCount) ?><?= View::stat('New leads', (string) $leadCount, '', $leadCount ? 'pos' : '') ?><?php endif; ?>
    <?= View::stat('Referred sign-ups', (string) $refSignups) ?>
    <?= View::stat('Unread alerts', (string) $unread) ?>
  </div>
  <h2 style="margin-top:24px">Recent reports</h2>
  <?php if ($myReports): ?>
  <?= '<div class="tablewrap"><table><thead><tr><th>Report</th><th>Visibility</th><th>Version</th><th>Views</th><th>Updated</th></tr></thead><tbody>' . implode('', array_map(static fn($r) => '<tr><th scope="row"><a href="' . e(url('report.php', ['id' => $r['token']])) . '">' . e($r['title']) . '</a></th><td>' . e($r['visibility']) . '</td><td>v' . (int) $r['current_version'] . '</td><td>' . (int) $r['views'] . '</td><td>' . e(substr($r['updated_at'], 0, 10)) . '</td></tr>', array_slice($myReports, 0, 5))) . '</tbody></table></div>' ?>
  <?php else: ?><p class="muted">No reports yet. <a href="<?= e(url('evaluate.php')) ?>">Run your first evaluation</a>.</p><?php endif; ?>

<?php elseif ($tab === 'reports'): ?>
  <?php if ($myReports): ?>
  <?= '<div class="tablewrap"><table><thead><tr><th>Report</th><th>Currency</th><th>Visibility</th><th>Version</th><th>Views</th><th>Updated</th><th></th></tr></thead><tbody>' . implode('', array_map(static fn($r) => '<tr><th scope="row"><a href="' . e(url('report.php', ['id' => $r['token']])) . '">' . e($r['title']) . '</a></th><td>' . e($r['currency']) . '</td><td>' . e($r['visibility']) . '</td><td>v' . (int) $r['current_version'] . '</td><td>' . (int) $r['views'] . '</td><td>' . e(substr($r['updated_at'], 0, 10)) . '</td><td><a href="' . e(url('evaluate.php', ['edit' => $r['token']])) . '">Edit</a></td></tr>', $myReports)) . '</tbody></table></div>' ?>
  <?php else: ?><p class="muted">No reports yet.</p><?php endif; ?>

<?php elseif ($tab === 'portfolio'):
    $byCur = [];
    foreach ($pf as $x) {
        $c = $x['currency'];
        $byCur[$c] ??= ['value' => 0, 'loan' => 0, 'rent' => 0, 'costs' => 0, 'n' => 0];
        $byCur[$c]['value'] += $x['value'];
        $byCur[$c]['loan'] += $x['loan_balance'];
        $byCur[$c]['rent'] += $x['monthly_rent'];
        $byCur[$c]['costs'] += $x['monthly_costs'];
        $byCur[$c]['n']++;
    }
    ?>
  <p class="muted small">Totals are shown per currency and never mixed without an exchange rate. Values are your own estimates — update them as you get new evidence.</p>
  <?php foreach ($byCur as $c => $t): ?>
  <h3><?= e($c) ?> · <?= (int) $t['n'] ?> propert<?= $t['n'] === 1 ? 'y' : 'ies' ?></h3>
  <div class="stats">
    <?= View::stat('Total value', Fmt::money($t['value'], $c)) ?>
    <?= View::stat('Equity', Fmt::money($t['value'] - $t['loan'], $c), $t['value'] > 0 ? Fmt::pct(1 - $t['loan'] / $t['value'], 0) . ' of value' : '') ?>
    <?= View::stat('Monthly cash flow', Fmt::money($t['rent'] - $t['costs'], $c), 'Rent − costs incl. debt', View::tone($t['rent'] - $t['costs'])) ?>
    <?= View::stat('Gross yield', $t['value'] > 0 ? Fmt::pct($t['rent'] * 12 / $t['value']) : '—') ?>
  </div>
  <?php endforeach; ?>
  <div class="tablewrap" style="margin-top:16px"><table><thead><tr><th>Property</th><th>Value</th><th>Loan</th><th>Rent / mo</th><th>Costs / mo</th><th></th></tr></thead><tbody>
  <?php foreach ($pf as $x): ?>
    <tr><td colspan="6"><form method="post" class="btn-row"><?= csrf_field() ?><input type="hidden" name="action" value="pf_save"><input type="hidden" name="id" value="<?= (int) $x['id'] ?>"><input type="hidden" name="currency" value="<?= e($x['currency']) ?>">
      <input name="name" value="<?= e($x['name']) ?>" aria-label="Name" style="max-width:220px"><input name="value" value="<?= e((float) $x['value']) ?>" aria-label="Value" style="max-width:130px"><input name="loan_balance" value="<?= e((float) $x['loan_balance']) ?>" aria-label="Loan balance" style="max-width:130px"><input name="monthly_rent" value="<?= e((float) $x['monthly_rent']) ?>" aria-label="Monthly rent" style="max-width:110px"><input name="monthly_costs" value="<?= e((float) $x['monthly_costs']) ?>" aria-label="Monthly costs" style="max-width:110px">
      <button class="btn btn-sm btn-ghost">Save</button><?= $x['report_id'] ? '<span class="small muted">linked report</span>' : '' ?></form>
      <form method="post" class="inline" data-confirm="Remove this property from your portfolio?"><?= csrf_field() ?><input type="hidden" name="action" value="pf_delete"><input type="hidden" name="id" value="<?= (int) $x['id'] ?>"><button class="btn-link small">Remove</button></form></td></tr>
  <?php endforeach; ?>
  </tbody></table></div>
  <h3 style="margin-top:20px">Add a property</h3>
  <form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="pf_save">
    <div class="fgrid">
      <div class="field"><label for="pn">Name</label><input id="pn" name="name" required></div>
      <div class="field"><label for="pc">Currency</label><select id="pc" name="currency"><?php foreach (Countries::currencyOptions() as $c): ?><option<?= $c === 'USD' ? ' selected' : '' ?>><?= e($c) ?></option><?php endforeach; ?></select></div>
      <div class="field"><label for="pv">Current value (your estimate)</label><input id="pv" name="value" inputmode="decimal" required></div>
      <div class="field"><label for="pl">Loan balance</label><input id="pl" name="loan_balance" inputmode="decimal"></div>
      <div class="field"><label for="pr">Monthly rent</label><input id="pr" name="monthly_rent" inputmode="decimal"></div>
      <div class="field"><label for="pk">Monthly costs incl. mortgage</label><input id="pk" name="monthly_costs" inputmode="decimal"></div>
    </div><button class="btn btn-sm">Add</button>
  </form>

<?php elseif ($tab === 'watchlist'):
    $w = Db::all('SELECT l.*, w.last_price FROM watchlist w JOIN listings l ON l.id = w.listing_id WHERE w.user_id = ? ORDER BY w.created_at DESC', [$uid]);
    ?>
  <p class="muted small">You'll get an alert here when a watched listing's price changes.</p>
  <?php if (!$w): ?><p>Nothing watched yet. <a href="<?= e(url('marketplace.php')) ?>">Browse the marketplace</a>.</p><?php endif; ?>
  <div class="grid g3"><?php foreach ($w as $l): ?>
    <div class="card"><h3><a href="<?= e(url('marketplace.php', ['id' => $l['id']])) ?>"><?= e($l['title']) ?></a></h3><p class="small muted"><?= e(Fmt::money((float) $l['price'], $l['currency'])) ?> · <?= e($l['status']) ?></p>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="watch_remove"><input type="hidden" name="listing_id" value="<?= (int) $l['id'] ?>"><button class="btn-link small">Stop watching</button></form></div>
  <?php endforeach; ?></div>

<?php elseif ($tab === 'matches'):
    $pc = $prefs ? explode(',', (string) $prefs['countries']) : [];
    $pt = $prefs ? explode(',', (string) $prefs['types']) : [];
    ?>
  <div class="grid g2" style="align-items:start">
    <form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="prefs">
      <h2>Your investment preferences</h2>
      <p class="hint">Private. Never shown to sellers or agents. Only used to rank listings for you.</p>
      <div class="field"><label for="mc">Countries</label><select id="mc" name="countries[]" multiple size="6"><?php foreach (Countries::options() as $k => $l): ?><option value="<?= e($k) ?>"<?= in_array($k, $pc, true) ? ' selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?></select></div>
      <div class="field"><label for="mt">Property types</label><select id="mt" name="types[]" multiple size="6"><?php foreach (Inputs::PROPERTY_TYPES as $k => $l): ?><option value="<?= e($k) ?>"<?= in_array($k, $pt, true) ? ' selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?></select></div>
      <div class="fgrid">
        <div class="field"><label for="bmin">Budget min</label><input id="bmin" name="budget_min" value="<?= e($prefs['budget_min'] ?? '') ?>" inputmode="decimal"></div>
        <div class="field"><label for="bmax">Budget max</label><input id="bmax" name="budget_max" value="<?= e($prefs['budget_max'] ?? '') ?>" inputmode="decimal"></div>
        <div class="field"><label for="bcur">Budget currency</label><select id="bcur" name="currency"><option value="">Any</option><?php foreach (Countries::currencyOptions() as $c): ?><option<?= ($prefs['currency'] ?? '') === $c ? ' selected' : '' ?>><?= e($c) ?></option><?php endforeach; ?></select></div>
        <div class="field"><label for="myl">Min gross yield %</label><input id="myl" name="min_yield" value="<?= e(isset($prefs['min_yield']) ? $prefs['min_yield'] * 100 : '') ?>" inputmode="decimal"></div>
        <div class="field"><label for="hz">Horizon (years)</label><input id="hz" name="horizon" value="<?= e($prefs['horizon'] ?? '') ?>" inputmode="numeric"></div>
        <div class="field"><label for="rk">Risk appetite</label><select id="rk" name="risk"><option value="">—</option><?php foreach (['conservative', 'balanced', 'aggressive'] as $r): ?><option<?= ($prefs['risk'] ?? '') === $r ? ' selected' : '' ?>><?= $r ?></option><?php endforeach; ?></select></div>
      </div>
      <button class="btn btn-sm">Save preferences</button>
    </form>
    <div>
      <h2>Matching listings</h2>
      <?php $m = $prefs ? match_listings($prefs) : []; ?>
      <?php if (!$prefs): ?><p class="muted">Save preferences to see matches.</p><?php elseif (!$m): ?><p class="muted">No approved listings match yet.</p><?php endif; ?>
      <?php foreach ($m as $l): ?>
        <div class="card" style="margin-bottom:10px"><h3><a href="<?= e(url('marketplace.php', ['id' => $l['id']])) ?>"><?= e($l['title']) ?></a></h3>
        <p class="small"><?= e(Fmt::money((float) $l['price'], $l['currency'])) ?> · <?= e(Countries::name($l['country'])) ?> · <?= View::badge(round($l['match'] * $l['crit']) . '/' . $l['crit'] . ' criteria', $l['match'] >= 0.99 ? 'pos' : 'info') ?></p>
        <p class="hint">Matched on: <?= e(implode(', ', $l['why'])) ?>. Gross yield uses the seller's stated rent — verify it.</p></div>
      <?php endforeach; ?>
    </div>
  </div>

<?php elseif ($tab === 'listings'):
    $ls = Db::all('SELECT l.*, (SELECT COUNT(*) FROM enquiries e WHERE e.listing_id = l.id) AS enq, (SELECT COUNT(*) FROM watchlist w WHERE w.listing_id = l.id) AS watchers FROM listings l WHERE user_id = ? ORDER BY updated_at DESC', [$uid]);
    ?>
  <p><a class="btn btn-sm" href="<?= e(url('listing-edit.php')) ?>">New listing</a> <span class="hint">Tip: create listings from a report so investors see the full analysis.</span></p>
  <?= $ls ? '<div class="tablewrap"><table><thead><tr><th>Listing</th><th>Price</th><th>Status</th><th>Views</th><th>Watchers</th><th>Enquiries</th><th>Conversion</th><th></th></tr></thead><tbody>' . implode('', array_map(static fn($l) => '<tr><th scope="row"><a href="' . e(url('marketplace.php', ['id' => $l['id']])) . '">' . e($l['title']) . '</a></th><td>' . e(Fmt::money((float) $l['price'], $l['currency'])) . '</td><td>' . e($l['status']) . '</td><td>' . (int) $l['views'] . '</td><td>' . (int) $l['watchers'] . '</td><td>' . (int) $l['enq'] . '</td><td>' . ($l['views'] ? Fmt::pct($l['enq'] / $l['views']) : '—') . '</td><td><a href="' . e(url('listing-edit.php', ['id' => $l['id']])) . '">Edit</a></td></tr>', $ls)) . '</tbody></table></div>' : '<p class="muted">No listings yet.</p>' ?>

<?php elseif ($tab === 'leads'):
    $leads = Db::all('SELECT e.*, l.title FROM enquiries e JOIN listings l ON l.id = e.listing_id WHERE l.user_id = ? ORDER BY e.created_at DESC LIMIT 200', [$uid]);
    ?>
  <p class="muted small">Enquirers consented to share these details with you for this property only. Do not add them to marketing lists without separate consent.</p>
  <?php if (!$leads): ?><p>No enquiries yet.</p><?php endif; ?>
  <?php foreach ($leads as $q): ?>
  <div class="card" style="margin-bottom:10px">
    <div class="section-head"><h3><?= e($q['name']) ?> — <?= e($q['title']) ?></h3><?= View::badge($q['status'], $q['status'] === 'new' ? 'info' : '') ?></div>
    <p class="small"><a href="mailto:<?= e($q['email']) ?>"><?= e($q['email']) ?></a><?= $q['phone'] ? ' · ' . e($q['phone']) : '' ?> · <?= e(substr($q['created_at'], 0, 16)) ?> UTC</p>
    <p class="small">Budget: <?= e($q['budget'] ?: '—') ?> · Timeline: <?= e($q['timeline'] ?: '—') ?> · Financing: <?= e($q['financing'] ?: '—') ?></p>
    <?php if ($q['message']): ?><p><?= nl2br(e($q['message'])) ?></p><?php endif; ?>
    <form method="post" class="btn-row"><?= csrf_field() ?><input type="hidden" name="action" value="lead_status"><input type="hidden" name="id" value="<?= (int) $q['id'] ?>">
      <select name="status" aria-label="Lead status" style="max-width:180px"><?php foreach (['new', 'contacted', 'qualified', 'closed'] as $s): ?><option<?= $q['status'] === $s ? ' selected' : '' ?>><?= $s ?></option><?php endforeach; ?></select><button class="btn btn-sm btn-ghost">Update</button></form>
  </div>
  <?php endforeach; ?>

<?php elseif ($tab === 'referrals'):
    $code = $u['ref_code'];
    $clicks = (int) Db::val('SELECT COUNT(*) FROM referral_clicks WHERE ref_code = ?', [$code]);
    $clicks30 = (int) Db::val('SELECT COUNT(*) FROM referral_clicks WHERE ref_code = ? AND created_at > ?', [$code, gmdate('Y-m-d H:i:s', time() - 30 * 86400)]);
    $signups = Db::all('SELECT id, created_at, plan, (SELECT COUNT(*) FROM reports r WHERE r.user_id = users.id) AS reps FROM users WHERE referred_by = ? ORDER BY created_at DESC', [$uid]);
    $activated = count(array_filter($signups, static fn($s) => $s['reps'] > 0));
    $paid = count(array_filter($signups, static fn($s) => $s['plan'] !== 'free'));
    $embedViews = (int) Db::val("SELECT COUNT(*) FROM events WHERE name = 'embed_view' AND ref_code = ?", [$code]);
    $guestEvals = (int) Db::val("SELECT COUNT(*) FROM events WHERE name = 'evaluation_completed' AND ref_code = ?", [$code]);
    ?>
  <div class="stats">
    <?= View::stat('Unique clicks', (string) $clicks, $clicks30 . ' in last 30 days') ?>
    <?= View::stat('Embed views', (string) $embedViews) ?>
    <?= View::stat('Evaluations from your links', (string) $guestEvals) ?>
    <?= View::stat('Sign-ups', (string) count($signups), $clicks ? Fmt::pct(count($signups) / $clicks) . ' of clicks' : '') ?>
    <?= View::stat('Activated', (string) $activated, 'Ran at least one evaluation') ?>
    <?= View::stat('Paid plans', (string) $paid) ?>
  </div>
  <div class="card" style="margin-top:16px">
    <label for="reflink">Your referral link</label>
    <div class="share-box"><input id="reflink" readonly value="<?= e(abs_url('index.php', ['ref' => $code])) ?>"><button class="btn btn-sm btn-ghost" type="button" data-copy="#reflink">Copy</button></div>
    <p class="hint">Add <span class="mono">?ref=<?= e($code) ?></span> to any page or calculator link. Attribution: first click wins, 30-day cookie, one click counted per visitor per day, self-referrals ignored.</p>
  </div>
  <div class="callout"><p><strong>Commissions:</strong> payouts are not active on this staging build. Commission rates, payout thresholds and tax forms will be set in a written partner agreement before any earnings accrue. The numbers above are the attribution that agreement would use.</p></div>
  <?php if ($signups): ?><?= View::table(['Referred user', 'Joined', 'Plan', 'Reports'], array_map(static fn($s) => ['User #' . $s['id'], substr($s['created_at'], 0, 10), $s['plan'], (string) $s['reps']], $signups)) ?><?php endif; ?>

<?php elseif ($tab === 'notifications'): ?>
  <?php if ($unread): ?><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="notif_read"><button class="btn btn-sm btn-ghost">Mark all read</button></form><?php endif; ?>
  <?php if (!$notifs): ?><p class="muted">No notifications.</p><?php endif; ?>
  <ul class="list-plain"><?php foreach ($notifs as $n): ?><li><?= $n['read_at'] ? '' : View::badge('New', 'info') . ' ' ?><?= $n['link'] ? '<a href="' . e($n['link']) . '">' . e($n['message']) . '</a>' : e($n['message']) ?> <span class="muted small">· <?= e(substr($n['created_at'], 0, 16)) ?></span></li><?php endforeach; ?></ul>
<?php endif; ?>
</div></section>
<?php require __DIR__ . '/views/footer.php';
