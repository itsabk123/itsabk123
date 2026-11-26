<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\Db;

$sent = false;
if (is_post()) {
    csrf_check();
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    if (rate_limit('forgot:' . ip_hash(), 5, 3600)) {
        $u = Db::one("SELECT id, email FROM users WHERE email = ? AND status = 'active'", [$email]);
        if ($u) {
            $token = bin2hex(random_bytes(32));
            Db::insert('password_resets', ['user_id' => $u['id'], 'token_hash' => hash('sha256', $token), 'expires_at' => gmdate('Y-m-d H:i:s', time() + 3600), 'used' => 0]);
            send_mail($u['email'], 'Reset your Shelter and Sense password', "Use this link within one hour to choose a new password:\n\n" . abs_url('reset.php', ['t' => $token]) . "\n\nIf you did not request this, ignore this email.");
            audit('auth.reset_requested', 'user:' . $u['id']);
        }
    }
    $sent = true; // Same response whether or not the account exists.
}
$page_title = 'Reset password';
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap narrow">
  <h1>Reset your password</h1>
  <?php if ($sent): ?>
    <div class="flash flash-ok">If an account exists for that email, a reset link is on its way. It expires in one hour.</div>
    <p class="hint">On this staging server outgoing email may not be configured; an administrator can reset access from the admin panel.</p>
  <?php else: ?>
  <form method="post" class="card"><?= csrf_field() ?>
    <div class="field"><label for="email">Email</label><input id="email" type="email" name="email" required autocomplete="email"></div>
    <button class="btn">Send reset link</button>
  </form>
  <?php endif; ?>
</div></section>
<?php require __DIR__ . '/views/footer.php';
