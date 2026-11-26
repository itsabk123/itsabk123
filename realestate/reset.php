<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\Db;

$token = (string) ($_GET['t'] ?? $_POST['t'] ?? '');
$row = preg_match('/^[a-f0-9]{64}$/', $token) ? Db::one('SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > ?', [hash('sha256', $token), Db::now()]) : null;
$err = '';
if ($row && is_post()) {
    csrf_check();
    $pw = (string) ($_POST['password'] ?? '');
    if (strlen($pw) < 10) {
        $err = 'Use at least 10 characters.';
    } else {
        Db::update('users', ['pass_hash' => password_hash($pw, PASSWORD_DEFAULT)], 'id = ?', [$row['user_id']]);
        Db::q('UPDATE password_resets SET used = 1 WHERE user_id = ?', [$row['user_id']]);
        audit('auth.reset_done', 'user:' . $row['user_id']);
        flash('Password updated. Please log in.', 'ok');
        redirect('login.php');
    }
}
$page_title = 'Choose a new password';
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap narrow">
  <h1>Choose a new password</h1>
  <?php if (!$row): ?>
    <div class="flash flash-err">This reset link is invalid or has expired.</div><p><a href="<?= e(url('forgot.php')) ?>">Request a new link</a></p>
  <?php else: ?>
  <form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="t" value="<?= e($token) ?>">
    <div class="field<?= $err ? ' has-err' : '' ?>"><label for="password">New password</label><input id="password" type="password" name="password" minlength="10" required autocomplete="new-password"><?= $err ? '<p class="err">' . e($err) . '</p>' : '' ?></div>
    <button class="btn">Update password</button>
  </form>
  <?php endif; ?>
</div></section>
<?php require __DIR__ . '/views/footer.php';
