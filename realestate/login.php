<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Auth, Db, Totp};

$next = (string) ($_GET['next'] ?? $_POST['next'] ?? '');
$safeNext = (str_starts_with($next, base_path() . '/') && !str_contains(substr($next, 1), '//') && !preg_match('/[\r\n]/', $next)) ? $next : url('dashboard.php');
if (Auth::user()) {
    header('Location: ' . $safeNext, true, 303);
    exit;
}
$err = '';
$stage = isset($_SESSION['mfa_pending']) ? 'mfa' : 'password';
if (is_post()) {
    csrf_check();
    if (($_POST['stage'] ?? '') === 'mfa' && isset($_SESSION['mfa_pending'])) {
        $u = Db::one('SELECT * FROM users WHERE id = ?', [$_SESSION['mfa_pending']]);
        if (!rate_limit('mfa:' . $_SESSION['mfa_pending'], 6, 900)) {
            unset($_SESSION['mfa_pending']);
            render_error(429, 'Too many attempts. Please start again in 15 minutes.');
        }
        if ($u && $u['totp_secret'] && Totp::verify($u['totp_secret'], (string) ($_POST['code'] ?? ''))) {
            Auth::login($u);
            track('login', ['mfa' => 1]);
            header('Location: ' . $safeNext, true, 303);
            exit;
        }
        $err = 'That code is not valid. Codes change every 30 seconds.';
        $stage = 'mfa';
    } else {
        $email = strtolower(trim((string) ($_POST['email'] ?? '')));
        $pw = (string) ($_POST['password'] ?? '');
        $bucket = 'login:' . hash('sha256', $email) . ':' . ip_hash();
        if (!rate_limit($bucket, 8, 900)) {
            audit('auth.login_throttled', null, ['email_hash' => hash('sha256', $email)]);
            render_error(429, 'Too many login attempts. Please wait 15 minutes or reset your password.');
        }
        $u = Db::one('SELECT * FROM users WHERE email = ?', [$email]);
        // Constant-work check so response timing does not reveal whether the email exists.
        $ok = password_verify($pw, $u['pass_hash'] ?? password_hash('timing-equaliser', PASSWORD_DEFAULT));
        if ($u && $ok && $u['status'] === 'active') {
            if (password_needs_rehash($u['pass_hash'], PASSWORD_DEFAULT)) {
                Db::update('users', ['pass_hash' => password_hash($pw, PASSWORD_DEFAULT)], 'id = ?', [$u['id']]);
            }
            if ($u['totp_secret']) {
                session_regenerate_id(true);
                $_SESSION['mfa_pending'] = (int) $u['id'];
                $stage = 'mfa';
            } else {
                Auth::login($u);
                track('login');
                header('Location: ' . $safeNext, true, 303);
                exit;
            }
        } else {
            $err = ($u && $ok && $u['status'] !== 'active') ? 'This account is suspended. Contact support.' : 'Email or password is incorrect.';
        }
    }
}
$page_title = 'Log in';
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap narrow">
  <h1>Log in</h1>
  <?php if ($err): ?><div class="flash flash-err" role="alert"><?= e($err) ?></div><?php endif; ?>
  <form method="post" class="card" style="margin-top:12px">
    <?= csrf_field() ?><input type="hidden" name="next" value="<?= e($next) ?>">
    <?php if ($stage === 'mfa'): ?>
      <input type="hidden" name="stage" value="mfa">
      <div class="field"><label for="code">Authentication code</label><input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required autofocus><p class="hint">From your authenticator app.</p></div>
      <button class="btn">Verify</button>
    <?php else: ?>
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
      <div class="btn-row"><button class="btn">Log in</button><a href="<?= e(url('forgot.php')) ?>" class="small">Forgot password?</a></div>
      <p class="small muted" style="margin-top:12px">New here? <a href="<?= e(url('register.php')) ?>">Create a free account</a>.</p>
    <?php endif; ?>
  </form>
</div></section>
<?php require __DIR__ . '/views/footer.php';
