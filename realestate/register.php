<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Auth, Db, Settings};

if (Auth::user()) {
    redirect('dashboard.php');
}
$err = [];
$old = ['name' => '', 'email' => '', 'role' => in_array($_GET['role'] ?? '', Auth::SELF_SERVE_ROLES, true) ? $_GET['role'] : 'investor', 'marketing' => 0];
if (is_post()) {
    csrf_check();
    if (!Settings::on('registrations_open')) {
        render_error(403, 'Registrations are temporarily closed.');
    }
    if (!empty($_POST['website']) || !rate_limit('register:' . ip_hash(), 5, 3600)) {
        render_error(429, 'Too many sign-up attempts. Please try again later.');
    }
    $old['name'] = mb_substr(trim(strip_tags((string) ($_POST['name'] ?? ''))), 0, 120);
    $old['email'] = strtolower(trim((string) ($_POST['email'] ?? '')));
    $old['role'] = in_array($_POST['role'] ?? '', Auth::SELF_SERVE_ROLES, true) ? $_POST['role'] : 'investor';
    $old['marketing'] = !empty($_POST['marketing']) ? 1 : 0;
    $pw = (string) ($_POST['password'] ?? '');
    if ($old['name'] === '') {
        $err['name'] = 'Enter your name.';
    }
    if (!filter_var($old['email'], FILTER_VALIDATE_EMAIL) || strlen($old['email']) > 190) {
        $err['email'] = 'Enter a valid email address.';
    } elseif (Db::val('SELECT COUNT(*) FROM users WHERE email = ?', [$old['email']])) {
        $err['email'] = 'An account with this email already exists. Try logging in.';
    }
    if (strlen($pw) < 10) {
        $err['password'] = 'Use at least 10 characters.';
    } elseif (in_array(strtolower($pw), ['password123', '1234567890', 'qwertyuiop', 'shelterandsense'], true)) {
        $err['password'] = 'That password is too common.';
    }
    if (empty($_POST['terms'])) {
        $err['terms'] = 'Please accept the terms to continue.';
    }
    if (!$err) {
        $refBy = null;
        if ($rc = current_ref()) {
            $refBy = Db::val('SELECT id FROM users WHERE ref_code = ?', [$rc]);
        }
        do {
            $code = strtoupper(substr(bin2hex(random_bytes(5)), 0, 8));
        } while (Db::val('SELECT COUNT(*) FROM users WHERE ref_code = ?', [$code]));
        $id = Db::insert('users', [
            'email' => $old['email'], 'pass_hash' => password_hash($pw, PASSWORD_DEFAULT), 'name' => $old['name'], 'role' => $old['role'], 'plan' => 'free',
            'status' => 'active', 'ref_code' => $code, 'referred_by' => $refBy, 'marketing_opt_in' => $old['marketing'], 'created_at' => Db::now(),
        ]);
        audit('auth.register', 'user:' . $id, ['role' => $old['role'], 'referred' => (bool) $refBy]);
        track('signup', ['role' => $old['role'], 'referred' => $refBy ? 1 : 0]);
        if ($refBy) {
            notify((int) $refBy, 'referral', 'Someone you referred just created an account.', url('dashboard.php', ['tab' => 'referrals']));
        }
        Auth::login(Db::one('SELECT * FROM users WHERE id = ?', [$id]));
        flash('Welcome to Shelter and Sense. Any reports you ran as a guest in this browser are now in your account.', 'ok');
        redirect('dashboard.php', ['welcome' => 1]);
    }
}
$page_title = 'Create your account';
$canonical = abs_url('register.php');
require __DIR__ . '/views/header.php';
$roleDesc = ['investor' => 'Evaluate, compare and track properties.', 'seller' => 'Present your property to investors and receive enquiries.', 'agent' => 'Branded reports, listings and a lead inbox.', 'creator' => 'Embed tools, publish analysis and track referrals.'];
?>
<section><div class="wrap narrow">
  <h1>Create your free account</h1>
  <p class="muted">Save reports, track a portfolio, share analysis and get alerts. No payment details required.</p>
  <form method="post" class="card" novalidate>
    <?= csrf_field() ?>
    <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
    <fieldset style="border:0;padding:0;margin:0 0 10px;background:none"><legend style="padding:0">I am a…</legend>
      <div class="grid g2">
      <?php foreach (Auth::SELF_SERVE_ROLES as $r): ?>
        <label class="checkrow card" style="padding:12px"><input type="radio" name="role" value="<?= $r ?>"<?= $old['role'] === $r ? ' checked' : '' ?>><span><strong><?= e(Auth::ROLES[$r]) ?></strong><br><span class="small muted"><?= e($roleDesc[$r]) ?></span></span></label>
      <?php endforeach; ?>
      </div>
    </fieldset>
    <div class="field<?= isset($err['name']) ? ' has-err' : '' ?>"><label for="name">Name</label><input id="name" name="name" type="text" autocomplete="name" value="<?= e($old['name']) ?>" required><?= isset($err['name']) ? '<p class="err">' . e($err['name']) . '</p>' : '' ?></div>
    <div class="field<?= isset($err['email']) ? ' has-err' : '' ?>"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" value="<?= e($old['email']) ?>" required><?= isset($err['email']) ? '<p class="err">' . e($err['email']) . '</p>' : '' ?></div>
    <div class="field<?= isset($err['password']) ? ' has-err' : '' ?>"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="10" required><?= isset($err['password']) ? '<p class="err">' . e($err['password']) . '</p>' : '<p class="hint">At least 10 characters. You can add two-factor authentication later.</p>' ?></div>
    <label class="checkrow"><input type="checkbox" name="terms" value="1"> <span>I accept the <a href="<?= e(url('terms.php')) ?>">terms</a> and understand reports are estimates, not advice.</span></label>
    <?= isset($err['terms']) ? '<p class="err">' . e($err['terms']) . '</p>' : '' ?>
    <label class="checkrow" style="margin-top:8px"><input type="checkbox" name="marketing" value="1"<?= $old['marketing'] ? ' checked' : '' ?>> <span>Email me occasional product updates (optional, unsubscribe any time).</span></label>
    <p style="margin-top:14px"><button class="btn" type="submit">Create account</button></p>
    <p class="small muted">Already have an account? <a href="<?= e(url('login.php')) ?>">Log in</a>.</p>
  </form>
</div></section>
<?php require __DIR__ . '/views/footer.php';
