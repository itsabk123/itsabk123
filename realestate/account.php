<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Auth, Db, Totp, View};

$u = Auth::require();
$uid = (int) $u['id'];

if (is_post()) {
    csrf_check();
    $a = (string) ($_POST['action'] ?? '');
    $clean = static fn($k, $n = 120) => mb_substr(trim(strip_tags((string) ($_POST[$k] ?? ''))), 0, $n);
    if ($a === 'profile') {
        $row = ['name' => $clean('name') ?: $u['name'], 'marketing_opt_in' => !empty($_POST['marketing']) ? 1 : 0];
        if (Auth::can('branding')) {
            $row += ['brand_name' => $clean('brand_name') ?: null, 'agency' => $clean('agency') ?: null, 'licence_no' => $clean('licence_no', 80) ?: null, 'bio' => $clean('bio', 600) ?: null];
            if ($row['licence_no'] !== $u['licence_no']) {
                $row['verified_pro'] = 0; // changing credentials resets verification
            }
        }
        Db::update('users', $row, 'id = ?', [$uid]);
        audit('account.profile', 'user:' . $uid);
        flash('Profile saved.', 'ok');
    } elseif ($a === 'password') {
        if (!password_verify((string) ($_POST['current'] ?? ''), $u['pass_hash'])) {
            flash('Current password is incorrect.', 'err');
        } elseif (strlen((string) ($_POST['new'] ?? '')) < 10) {
            flash('New password must be at least 10 characters.', 'err');
        } else {
            Db::update('users', ['pass_hash' => password_hash((string) $_POST['new'], PASSWORD_DEFAULT)], 'id = ?', [$uid]);
            session_regenerate_id(true);
            audit('account.password', 'user:' . $uid);
            flash('Password changed.', 'ok');
        }
    } elseif ($a === 'mfa_start') {
        $_SESSION['mfa_setup'] = Totp::secret();
    } elseif ($a === 'mfa_confirm' && !empty($_SESSION['mfa_setup'])) {
        if (Totp::verify($_SESSION['mfa_setup'], (string) ($_POST['code'] ?? ''))) {
            Db::update('users', ['totp_secret' => $_SESSION['mfa_setup']], 'id = ?', [$uid]);
            unset($_SESSION['mfa_setup']);
            audit('account.mfa_on', 'user:' . $uid);
            flash('Two-factor authentication is on.', 'ok');
        } else {
            flash('That code did not match. Check your device clock and try again.', 'err');
        }
    } elseif ($a === 'mfa_off') {
        if (password_verify((string) ($_POST['current'] ?? ''), $u['pass_hash'])) {
            Db::update('users', ['totp_secret' => null], 'id = ?', [$uid]);
            audit('account.mfa_off', 'user:' . $uid);
            flash('Two-factor authentication turned off.', 'ok');
        } else {
            flash('Password incorrect.', 'err');
        }
    } elseif ($a === 'api_new' && Auth::entitlement('api')) {
        $key = 'ss_' . bin2hex(random_bytes(20));
        Db::insert('api_keys', ['user_id' => $uid, 'key_hash' => hash('sha256', $key), 'prefix' => substr($key, 0, 10), 'label' => $clean('label', 80) ?: 'API key', 'created_at' => Db::now()]);
        $_SESSION['new_api_key'] = $key;
        audit('api.key_created', 'user:' . $uid);
    } elseif ($a === 'api_revoke') {
        Db::q('UPDATE api_keys SET revoked = 1 WHERE id = ? AND user_id = ?', [(int) $_POST['id'], $uid]);
        audit('api.key_revoked', 'user:' . $uid);
    } elseif ($a === 'export') {
        $data = [
            'exported_at' => gmdate('c'),
            'user' => array_diff_key($u, array_flip(['pass_hash', 'totp_secret'])),
            'reports' => Db::all('SELECT r.token, r.title, r.visibility, r.created_at, v.version, v.inputs_json FROM reports r JOIN report_versions v ON v.report_id = r.id WHERE r.user_id = ?', [$uid]),
            'portfolio' => Db::all('SELECT * FROM portfolio WHERE user_id = ?', [$uid]),
            'listings' => Db::all('SELECT * FROM listings WHERE user_id = ?', [$uid]),
            'enquiries_sent' => Db::all('SELECT * FROM enquiries WHERE from_user_id = ?', [$uid]),
            'preferences' => Db::one('SELECT * FROM preferences WHERE user_id = ?', [$uid]),
            'notifications' => Db::all('SELECT * FROM notifications WHERE user_id = ?', [$uid]),
        ];
        audit('account.export', 'user:' . $uid);
        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="shelterandsense-export.json"');
        echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    } elseif ($a === 'delete') {
        if (!password_verify((string) ($_POST['current'] ?? ''), $u['pass_hash'])) {
            flash('Password incorrect — account not deleted.', 'err');
        } else {
            $pdo = Db::pdo();
            $pdo->beginTransaction();
            $rids = array_column(Db::all('SELECT id FROM reports WHERE user_id = ?', [$uid]), 'id');
            foreach ($rids as $rid) {
                Db::q('DELETE FROM report_versions WHERE report_id = ?', [$rid]);
            }
            foreach (Db::all('SELECT stored_name FROM documents WHERE user_id = ?', [$uid]) as $d) {
                @unlink(SS_ROOT . '/data/uploads/' . $d['stored_name']);
            }
            $lids = array_column(Db::all('SELECT id FROM listings WHERE user_id = ?', [$uid]), 'id');
            foreach ($lids as $lid) {
                Db::q('DELETE FROM enquiries WHERE listing_id = ?', [$lid]);
                Db::q('DELETE FROM watchlist WHERE listing_id = ?', [$lid]);
            }
            foreach (['documents', 'reports', 'listings', 'portfolio', 'notifications', 'api_keys', 'password_resets', 'watchlist'] as $t) {
                Db::q("DELETE FROM $t WHERE user_id = ?", [$uid]);
            }
            Db::q('DELETE FROM preferences WHERE user_id = ?', [$uid]);
            Db::q('UPDATE enquiries SET from_user_id = NULL WHERE from_user_id = ?', [$uid]);
            Db::q('UPDATE users SET referred_by = NULL WHERE referred_by = ?', [$uid]);
            Db::q('UPDATE events SET user_id = NULL WHERE user_id = ?', [$uid]);
            Db::q('DELETE FROM users WHERE id = ?', [$uid]);
            $pdo->commit();
            audit('account.deleted', 'user:' . $uid);
            Auth::logout();
            flash('Your account and its data have been deleted.', 'ok');
            redirect('index.php');
        }
    }
    redirect('account.php');
}

$keys = Db::all('SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC', [$uid]);
$newKey = $_SESSION['new_api_key'] ?? null;
unset($_SESSION['new_api_key']);
$page_title = 'Account & security';
$noindex = true;
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap narrow">
  <h1>Account &amp; security</h1>
  <p class="muted">Signed in as <?= e($u['email']) ?> · <?= e(Auth::ROLES[$u['role']]) ?> · <?= e(Auth::PLANS[$u['plan']]) ?> plan</p>

  <form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="profile">
    <h2>Profile</h2>
    <div class="field"><label for="n">Name</label><input id="n" name="name" value="<?= e($u['name']) ?>" required></div>
    <?php if (Auth::can('branding')): ?>
      <h3>Branding for reports</h3>
      <p class="hint">Shown on reports you share when your plan includes branded reports (Professional and Enterprise). Licence numbers are displayed as "not verified" until an administrator checks them.</p>
      <div class="fgrid">
        <div class="field"><label for="bn">Display brand</label><input id="bn" name="brand_name" value="<?= e($u['brand_name'] ?? '') ?>"></div>
        <div class="field"><label for="ag">Agency / company</label><input id="ag" name="agency" value="<?= e($u['agency'] ?? '') ?>"></div>
        <div class="field"><label for="lc">Licence / registration no.</label><input id="lc" name="licence_no" value="<?= e($u['licence_no'] ?? '') ?>"></div>
      </div>
      <div class="field"><label for="bio">Short bio</label><textarea id="bio" name="bio" maxlength="600" style="font-family:var(--font)"><?= e($u['bio'] ?? '') ?></textarea></div>
      <p class="small">Verification: <?= $u['verified_pro'] ? View::badge('Verified', 'pos') : View::badge('Not verified') ?></p>
    <?php endif; ?>
    <label class="checkrow"><input type="checkbox" name="marketing" value="1"<?= $u['marketing_opt_in'] ? ' checked' : '' ?>> <span>Product update emails</span></label>
    <p style="margin-top:12px"><button class="btn btn-sm">Save</button></p>
  </form>

  <form method="post" class="card" style="margin-top:16px"><?= csrf_field() ?><input type="hidden" name="action" value="password">
    <h2>Password</h2>
    <div class="fgrid"><div class="field"><label for="cp">Current</label><input id="cp" type="password" name="current" autocomplete="current-password" required></div>
    <div class="field"><label for="np">New (10+ characters)</label><input id="np" type="password" name="new" minlength="10" autocomplete="new-password" required></div></div>
    <button class="btn btn-sm">Change password</button>
  </form>

  <div class="card" style="margin-top:16px" id="mfa">
    <h2>Two-factor authentication</h2>
    <?php if ($u['totp_secret']): ?>
      <p><?= View::badge('On', 'pos') ?> Codes from your authenticator app are required at login.</p>
      <form method="post" class="btn-row"><?= csrf_field() ?><input type="hidden" name="action" value="mfa_off"><input type="password" name="current" placeholder="Password" aria-label="Password" required style="max-width:240px"><button class="btn btn-sm btn-ghost">Turn off</button></form>
    <?php elseif (!empty($_SESSION['mfa_setup'])): ?>
      <p>Add this key to an authenticator app (time-based, 6 digits), then enter the code it shows.</p>
      <p class="mono" style="word-break:break-all"><?= e(chunk_split($_SESSION['mfa_setup'], 4, ' ')) ?></p>
      <p class="hint">Or open: <span class="mono" style="word-break:break-all"><?= e(Totp::uri($_SESSION['mfa_setup'], $u['email'])) ?></span></p>
      <form method="post" class="btn-row"><?= csrf_field() ?><input type="hidden" name="action" value="mfa_confirm"><input name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" aria-label="Code" required style="max-width:160px"><button class="btn btn-sm">Confirm</button></form>
    <?php else: ?>
      <p>Protect your account with a code from an authenticator app.</p>
      <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="mfa_start"><button class="btn btn-sm">Set up</button></form>
    <?php endif; ?>
  </div>

  <div class="card" style="margin-top:16px">
    <h2>API keys</h2>
    <?php if (!Auth::entitlement('api')): ?>
      <p class="muted">API access is part of the Enterprise plan. <a href="<?= e(url('developers.php')) ?>">See the API</a>.</p>
    <?php else: ?>
      <?php if ($newKey): ?><div class="callout"><p>Copy your new key now — it will not be shown again:</p><p class="mono" style="word-break:break-all"><?= e($newKey) ?></p></div><?php endif; ?>
      <?php if ($keys): ?><ul class="list-plain small"><?php foreach ($keys as $k): ?><li><span class="mono"><?= e($k['prefix']) ?>…</span> <?= e($k['label']) ?> · created <?= e(substr($k['created_at'], 0, 10)) ?> · last used <?= e($k['last_used_at'] ? substr($k['last_used_at'], 0, 10) : 'never') ?> <?= $k['revoked'] ? View::badge('Revoked', 'neg') : '<form method="post" class="inline">' . csrf_field() . '<input type="hidden" name="action" value="api_revoke"><input type="hidden" name="id" value="' . (int) $k['id'] . '"><button class="btn-link small">Revoke</button></form>' ?></li><?php endforeach; ?></ul><?php endif; ?>
      <form method="post" class="btn-row"><?= csrf_field() ?><input type="hidden" name="action" value="api_new"><input name="label" placeholder="Label" aria-label="Key label" style="max-width:220px"><button class="btn btn-sm">Create key</button></form>
    <?php endif; ?>
  </div>

  <div class="card" style="margin-top:16px">
    <h2>Your data</h2>
    <form method="post" class="inline"><?= csrf_field() ?><input type="hidden" name="action" value="export"><button class="btn btn-sm btn-ghost">Download all my data (JSON)</button></form>
    <h3 style="margin-top:16px">Delete account</h3>
    <p class="small muted">Permanently deletes your account, reports, listings, portfolio, documents and alerts. Anonymous analytics events are kept without your user ID.</p>
    <form method="post" class="btn-row" data-confirm="Permanently delete your account and all its data?"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="password" name="current" placeholder="Password" aria-label="Password to confirm" required style="max-width:240px"><button class="btn btn-sm btn-danger">Delete my account</button></form>
  </div>
</div></section>
<?php require __DIR__ . '/views/footer.php';
