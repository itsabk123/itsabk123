<?php
declare(strict_types=1);

/**
 * One-time setup: creates the first super admin. Requires SS_SETUP_KEY in config.php
 * and only works while no super admin exists. Delete SS_SETUP_KEY afterwards.
 */
require __DIR__ . '/bootstrap.php';

use SS\Db;

$key = (string) cfg('SETUP_KEY');
$hasAdmin = (int) Db::val("SELECT COUNT(*) FROM users WHERE role = 'super_admin'") > 0;
$msg = '';
if (!$key || $hasAdmin) {
    render_error(404, 'Setup is not available.');
}
if (is_post()) {
    csrf_check();
    if (!hash_equals($key, (string) ($_POST['setup_key'] ?? ''))) {
        $msg = 'Setup key incorrect.';
    } elseif (!filter_var($_POST['email'] ?? '', FILTER_VALIDATE_EMAIL) || strlen((string) ($_POST['password'] ?? '')) < 12) {
        $msg = 'Valid email and a password of 12+ characters required.';
    } else {
        $email = strtolower(trim((string) $_POST['email']));
        $ex = Db::one('SELECT id FROM users WHERE email = ?', [$email]);
        if ($ex) {
            Db::update('users', ['role' => 'super_admin', 'pass_hash' => password_hash((string) $_POST['password'], PASSWORD_DEFAULT)], 'id = ?', [$ex['id']]);
        } else {
            Db::insert('users', ['email' => $email, 'pass_hash' => password_hash((string) $_POST['password'], PASSWORD_DEFAULT), 'name' => 'Administrator', 'role' => 'super_admin', 'plan' => 'enterprise', 'status' => 'active', 'ref_code' => strtoupper(substr(bin2hex(random_bytes(5)), 0, 8)), 'created_at' => Db::now()]);
        }
        audit('setup.super_admin', $email);
        flash('Super admin ready. Remove SS_SETUP_KEY from config.php now.', 'ok');
        redirect('login.php');
    }
}
$page_title = 'Setup';
$noindex = true;
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap narrow"><h1>Create the first super admin</h1>
<?php if ($msg): ?><div class="flash flash-err"><?= e($msg) ?></div><?php endif; ?>
<form method="post" class="card"><?= csrf_field() ?>
  <div class="field"><label for="k">Setup key (from config.php)</label><input id="k" type="password" name="setup_key" required></div>
  <div class="field"><label for="e">Email</label><input id="e" type="email" name="email" required></div>
  <div class="field"><label for="p">Password (12+)</label><input id="p" type="password" name="password" minlength="12" required></div>
  <button class="btn">Create</button>
</form></div></section>
<?php require __DIR__ . '/views/footer.php';
