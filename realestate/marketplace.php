<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Auth, Countries, Db, Fmt, Inputs, View, Settings};

if (!Settings::on('marketplace_enabled')) {
    render_error(503, 'The marketplace is temporarily unavailable.');
}

$id = (int) ($_GET['id'] ?? 0);
if ($id) {
    $l = Db::one('SELECT l.*, u.name AS owner_name, u.role AS owner_role, u.agency, u.brand_name, u.verified_pro, r.token AS report_token, r.visibility AS report_vis FROM listings l JOIN users u ON u.id = l.user_id LEFT JOIN reports r ON r.id = l.report_id WHERE l.id = ?', [$id]);
    $isOwner = $l && (int) $l['user_id'] === Auth::id();
    if (!$l || ($l['status'] !== 'approved' && !$isOwner && !Auth::can('admin.moderate'))) {
        render_error(404, 'Listing not found.');
    }
    $sent = false;
    $err = [];
    if (is_post()) {
        csrf_check();
        if (($_POST['action'] ?? '') === 'watch') {
            Auth::require();
            if (!Db::val('SELECT COUNT(*) FROM watchlist WHERE user_id = ? AND listing_id = ?', [Auth::id(), $id])) {
                Db::insert('watchlist', ['user_id' => Auth::id(), 'listing_id' => $id, 'last_price' => $l['price'], 'created_at' => Db::now()]);
                track('watch_add');
            }
            flash('Added to your watchlist. You will be alerted if the price changes.', 'ok');
            redirect('marketplace.php', ['id' => $id]);
        }
        if (!empty($_POST['website']) || !rate_limit('enq:' . ip_hash(), 10, 3600)) {
            render_error(429, 'Too many enquiries. Please try again later.');
        }
        $f = [];
        foreach (['name' => 120, 'email' => 190, 'phone' => 40, 'message' => 2000, 'budget' => 40, 'timeline' => 40, 'financing' => 40] as $k => $max) {
            $f[$k] = mb_substr(trim(strip_tags((string) ($_POST[$k] ?? ''))), 0, $max);
        }
        if ($f['name'] === '') {
            $err['name'] = 'Enter your name.';
        }
        if (!filter_var($f['email'], FILTER_VALIDATE_EMAIL)) {
            $err['email'] = 'Enter a valid email.';
        }
        if (empty($_POST['consent'])) {
            $err['consent'] = 'You need to agree to share your details with the lister.';
        }
        if ($isOwner) {
            $err['name'] = 'You cannot enquire about your own listing.';
        }
        if (!$err) {
            Db::insert('enquiries', $f + ['listing_id' => $id, 'from_user_id' => Auth::id(), 'consent' => 1, 'status' => 'new', 'created_at' => Db::now()]);
            notify((int) $l['user_id'], 'lead', 'New enquiry from ' . $f['name'] . ' about "' . $l['title'] . '"', url('dashboard.php', ['tab' => 'leads']));
            $owner = Db::one('SELECT email FROM users WHERE id = ?', [$l['user_id']]);
            if ($owner) {
                send_mail($owner['email'], 'New enquiry: ' . $l['title'], "You have a new enquiry on Shelter and Sense.\n\nName: {$f['name']}\nEmail: {$f['email']}\nPhone: {$f['phone']}\nBudget: {$f['budget']}\nTimeline: {$f['timeline']}\nFinancing: {$f['financing']}\n\n{$f['message']}\n\nManage leads: " . abs_url('dashboard.php', ['tab' => 'leads']));
            }
            track('enquiry_sent', ['listing' => $id]);
            $sent = true;
        }
    } elseif (!$isOwner) {
        Db::q('UPDATE listings SET views = views + 1 WHERE id = ?', [$id]);
        track('listing_view', ['listing' => $id]);
    }
    $rep = null;
    if ($l['report_token'] && in_array($l['report_vis'], ['public', 'unlisted'], true)) {
        $rv = Db::one('SELECT result_json FROM report_versions WHERE report_id = ? ORDER BY version DESC LIMIT 1', [$l['report_id']]);
        $rep = json_decode($rv['result_json'] ?? 'null', true);
    }
    $u = Auth::user();
    $page_title = $l['title'];
    $page_desc = 'Investment property: ' . $l['title'] . ' — ' . Fmt::money((float) $l['price'], $l['currency']) . ' in ' . ($l['city'] ? $l['city'] . ', ' : '') . Countries::name($l['country']) . '.';
    $canonical = abs_url('marketplace.php', ['id' => $id]);
    require __DIR__ . '/views/header.php';
    ?>
    <section><div class="wrap">
      <nav class="small muted" aria-label="Breadcrumb"><a href="<?= e(url('marketplace.php')) ?>">Marketplace</a> › <?= e($l['title']) ?></nav>
      <h1><?= e($l['title']) ?></h1>
      <p class="rep-meta"><?= e(($l['city'] ? $l['city'] . ', ' : '') . Countries::name($l['country'])) ?> · <?= e(Inputs::PROPERTY_TYPES[$l['property_type']] ?? $l['property_type']) ?> <?= $l['sponsored'] ? View::badge('Sponsored', 'warn') : '' ?> <?= $l['status'] !== 'approved' ? View::badge('Status: ' . $l['status'], 'warn') : '' ?></p>
      <div class="grid g2" style="align-items:start">
        <div>
          <div class="stats">
            <?= View::stat('Price', Fmt::money((float) $l['price'], $l['currency'])) ?>
            <?= View::stat('Stated rent', $l['monthly_rent'] ? Fmt::money((float) $l['monthly_rent'], $l['currency']) . '/mo' : '—', 'Seller-provided') ?>
            <?= View::stat('Gross yield', $l['monthly_rent'] ? Fmt::pct($l['monthly_rent'] * 12 / $l['price']) : '—', 'On stated rent') ?>
            <?= View::stat('Size', $l['area'] ? number_format((float) $l['area']) . ($l['area_unit'] === 'sqft' ? ' ft²' : ' m²') : '—', $l['bedrooms'] !== null ? $l['bedrooms'] . ' bedrooms' : '') ?>
          </div>
          <?php if ($l['description']): ?><div class="card" style="margin-top:14px"><h2>Description</h2><p><?= nl2br(e($l['description'])) ?></p></div><?php endif; ?>
          <?php if ($rep): ?>
          <div class="card" style="margin-top:14px"><h2>Investment analysis</h2>
            <div class="stats"><?= View::stat('Net yield', Fmt::pct($rep['base']['net_yield'])) ?><?= View::stat('IRR (base)', Fmt::pct($rep['base']['irr'])) ?><?= $rep['mc'] ? View::stat('P(loss)', Fmt::pct($rep['mc']['p_loss'], 0)) : '' ?><?= View::stat('Data confidence', $rep['confidence']['band']) ?></div>
            <p class="hint">Prepared by the lister using their own assumptions. Review the inputs and re-run with yours before relying on it.</p>
            <a class="btn btn-sm btn-ghost" href="<?= e(url('report.php', ['id' => $l['report_token']])) ?>">Open full report</a>
            <a class="btn btn-sm btn-ghost" href="<?= e(url('evaluate.php', ['asking_price' => (float) $l['price'], 'currency' => $l['currency'], 'country' => $l['country'], 'city' => $l['city'], 'property_type' => $l['property_type'], 'monthly_rent' => $l['monthly_rent'] ? (float) $l['monthly_rent'] : null, 'area' => $l['area'] ? (float) $l['area'] : null, 'area_unit' => $l['area_unit']])) ?>">Evaluate with my assumptions</a>
          </div>
          <?php else: ?>
          <p style="margin-top:14px"><a class="btn btn-sm" href="<?= e(url('evaluate.php', ['asking_price' => (float) $l['price'], 'currency' => $l['currency'], 'country' => $l['country'], 'city' => $l['city'], 'property_type' => $l['property_type'], 'monthly_rent' => $l['monthly_rent'] ? (float) $l['monthly_rent'] : null, 'area' => $l['area'] ? (float) $l['area'] : null, 'area_unit' => $l['area_unit']])) ?>">Evaluate this property</a></p>
          <?php endif; ?>
          <p class="small muted" style="margin-top:12px">Listed by <?= e($l['brand_name'] ?: $l['owner_name']) ?><?= $l['agency'] ? ' · ' . e($l['agency']) : '' ?> (<?= e(Auth::ROLES[$l['owner_role']] ?? '') ?>) <?= $l['verified_pro'] ? View::badge('Credentials verified', 'pos') : View::badge('Credentials not verified') ?>. Shelter and Sense does not verify listing details or act as broker.</p>
        </div>
        <div>
          <?php if ($u && !$isOwner): ?><form method="post" style="margin-bottom:12px"><?= csrf_field() ?><input type="hidden" name="action" value="watch"><button class="btn btn-ghost btn-sm">☆ Watch price</button></form><?php endif; ?>
          <?php if ($sent): ?>
            <div class="flash flash-ok">Enquiry sent. The lister will contact you directly.</div>
          <?php elseif (!$isOwner): ?>
          <form method="post" class="card" novalidate><?= csrf_field() ?>
            <h2>Enquire</h2>
            <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
            <div class="field<?= isset($err['name']) ? ' has-err' : '' ?>"><label for="en">Name</label><input id="en" name="name" value="<?= e($_POST['name'] ?? ($u['name'] ?? '')) ?>" autocomplete="name"><?= isset($err['name']) ? '<p class="err">' . e($err['name']) . '</p>' : '' ?></div>
            <div class="field<?= isset($err['email']) ? ' has-err' : '' ?>"><label for="ee">Email</label><input id="ee" type="email" name="email" value="<?= e($_POST['email'] ?? ($u['email'] ?? '')) ?>" autocomplete="email"><?= isset($err['email']) ? '<p class="err">' . e($err['email']) . '</p>' : '' ?></div>
            <div class="field"><label for="ep">Phone (optional)</label><input id="ep" name="phone" value="<?= e($_POST['phone'] ?? '') ?>" autocomplete="tel"></div>
            <div class="fgrid">
              <div class="field"><label for="eb">Budget</label><input id="eb" name="budget" value="<?= e($_POST['budget'] ?? '') ?>"></div>
              <div class="field"><label for="et">Timeline</label><select id="et" name="timeline"><option value="">—</option><?php foreach (['Within 1 month', '1–3 months', '3–6 months', '6+ months'] as $o): ?><option><?= $o ?></option><?php endforeach; ?></select></div>
              <div class="field"><label for="ef">Financing</label><select id="ef" name="financing"><option value="">—</option><?php foreach (['Cash buyer', 'Mortgage approved in principle', 'Mortgage not yet arranged'] as $o): ?><option><?= $o ?></option><?php endforeach; ?></select></div>
            </div>
            <div class="field"><label for="em">Message</label><textarea id="em" name="message" style="font-family:var(--font)"><?= e($_POST['message'] ?? '') ?></textarea></div>
            <label class="checkrow"><input type="checkbox" name="consent" value="1"> <span>I agree to share these details with the lister of this property so they can contact me about it.</span></label>
            <?= isset($err['consent']) ? '<p class="err">' . e($err['consent']) . '</p>' : '' ?>
            <p style="margin-top:12px"><button class="btn">Send enquiry</button></p>
          </form>
          <?php else: ?><div class="callout callout-info"><p>This is your listing. <a href="<?= e(url('listing-edit.php', ['id' => $id])) ?>">Edit it</a> or see <a href="<?= e(url('dashboard.php', ['tab' => 'leads'])) ?>">your leads</a>.</p></div><?php endif; ?>
        </div>
      </div>
    </div></section>
    <?php
    require __DIR__ . '/views/footer.php';
    exit;
}

// Browse
$q = ['country' => (string) ($_GET['country'] ?? ''), 'type' => (string) ($_GET['type'] ?? ''), 'currency' => (string) ($_GET['currency'] ?? ''), 'max' => (string) ($_GET['max'] ?? ''), 'sort' => (string) ($_GET['sort'] ?? 'new')];
$where = ["status = 'approved'"];
$args = [];
if (isset(Countries::LIST[$q['country']])) {
    $where[] = 'country = ?';
    $args[] = $q['country'];
}
if (isset(Inputs::PROPERTY_TYPES[$q['type']])) {
    $where[] = 'property_type = ?';
    $args[] = $q['type'];
}
if (array_key_exists($q['currency'], Countries::currencyOptions())) {
    $where[] = 'currency = ?';
    $args[] = $q['currency'];
    if (is_numeric($q['max'])) {
        $where[] = 'price <= ?';
        $args[] = (float) $q['max'];
    }
}
$order = ['new' => 'sponsored DESC, created_at DESC', 'price_asc' => 'price ASC', 'price_desc' => 'price DESC', 'yield' => 'CASE WHEN monthly_rent IS NULL THEN 0 ELSE monthly_rent * 12.0 / price END DESC'][$q['sort']] ?? 'created_at DESC';
$page = max(1, (int) ($_GET['page'] ?? 1));
$per = 18;
$total = (int) Db::val('SELECT COUNT(*) FROM listings WHERE ' . implode(' AND ', $where), $args);
$rows = Db::all('SELECT * FROM listings WHERE ' . implode(' AND ', $where) . " ORDER BY $order LIMIT $per OFFSET " . (($page - 1) * $per), $args);
track('marketplace_view');
$page_title = 'Investment property marketplace';
$page_desc = 'Investment properties listed by sellers and agents, each with transparent investment analysis you can re-run with your own assumptions.';
$canonical = abs_url('marketplace.php');
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap">
  <div class="section-head">
    <div><p class="eyebrow">Marketplace</p><h1>Investment opportunities</h1><p class="muted">Listings are published by sellers and agents and moderated before they appear. Sponsored listings are labelled and never affect analysis or scores.</p></div>
    <?php if (Auth::can('listing.create')): ?><a class="btn" href="<?= e(url('listing-edit.php')) ?>">List a property</a><?php else: ?><a class="btn btn-ghost" href="<?= e(url('register.php', ['role' => 'seller'])) ?>">Sell or list a property</a><?php endif; ?>
  </div>
  <form method="get" class="card fgrid" style="margin-bottom:18px">
    <div class="field"><label for="fc">Country</label><select id="fc" name="country"><option value="">Any</option><?php foreach (Countries::options() as $k => $lbl): ?><option value="<?= e($k) ?>"<?= $q['country'] === $k ? ' selected' : '' ?>><?= e($lbl) ?></option><?php endforeach; ?></select></div>
    <div class="field"><label for="ft">Type</label><select id="ft" name="type"><option value="">Any</option><?php foreach (Inputs::PROPERTY_TYPES as $k => $lbl): ?><option value="<?= e($k) ?>"<?= $q['type'] === $k ? ' selected' : '' ?>><?= e($lbl) ?></option><?php endforeach; ?></select></div>
    <div class="field"><label for="fcur">Currency</label><select id="fcur" name="currency"><option value="">Any</option><?php foreach (Countries::currencyOptions() as $c): ?><option<?= $q['currency'] === $c ? ' selected' : '' ?>><?= e($c) ?></option><?php endforeach; ?></select></div>
    <div class="field"><label for="fm">Max price (needs currency)</label><input id="fm" name="max" value="<?= e($q['max']) ?>" inputmode="decimal"></div>
    <div class="field"><label for="fs">Sort</label><select id="fs" name="sort"><?php foreach (['new' => 'Newest', 'price_asc' => 'Price ↑', 'price_desc' => 'Price ↓', 'yield' => 'Stated gross yield'] as $k => $lbl): ?><option value="<?= $k ?>"<?= $q['sort'] === $k ? ' selected' : '' ?>><?= $lbl ?></option><?php endforeach; ?></select></div>
    <div class="field" style="align-self:end"><button class="btn">Filter</button></div>
  </form>
  <p class="small muted"><?= $total ?> listing<?= $total === 1 ? '' : 's' ?></p>
  <?php if (!$rows): ?><div class="card"><p>No approved listings match yet. <?= Auth::can('listing.create') ? '<a href="' . e(url('listing-edit.php')) . '">Be the first to list</a>.' : '' ?></p></div><?php endif; ?>
  <div class="grid g3">
    <?php foreach ($rows as $l): ?>
    <a class="card card-link" href="<?= e(url('marketplace.php', ['id' => $l['id']])) ?>">
      <?= $l['sponsored'] ? View::badge('Sponsored', 'warn') : '' ?>
      <h3><?= e($l['title']) ?></h3>
      <p class="small muted"><?= e(($l['city'] ? $l['city'] . ', ' : '') . Countries::name($l['country'])) ?> · <?= e(Inputs::PROPERTY_TYPES[$l['property_type']] ?? '') ?></p>
      <p><strong><?= e(Fmt::money((float) $l['price'], $l['currency'])) ?></strong><?= $l['monthly_rent'] ? ' · <span class="small">' . e(Fmt::pct($l['monthly_rent'] * 12 / $l['price'])) . ' stated gross yield</span>' : '' ?></p>
      <?= $l['report_id'] ? View::badge('Has investment report', 'info') : '' ?>
    </a>
    <?php endforeach; ?>
  </div>
  <?= View::pager($page, (int) ceil($total / $per), array_filter($q), 'marketplace.php') ?>
</div></section>
<?php require __DIR__ . '/views/footer.php';
