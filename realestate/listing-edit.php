<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Auth, Countries, Db, Fmt, Inputs, Settings};

$u = Auth::require('listing.create');
$uid = (int) $u['id'];
$id = (int) ($_GET['id'] ?? 0);
$l = $id ? Db::one('SELECT * FROM listings WHERE id = ? AND user_id = ?', [$id, $uid]) : null;
if ($id && !$l) {
    render_error(404, 'Listing not found.');
}
$f = $l ?: ['title' => '', 'country' => '', 'city' => '', 'property_type' => 'apartment', 'price' => '', 'currency' => '', 'monthly_rent' => '', 'area' => '', 'area_unit' => 'sqm', 'bedrooms' => '', 'description' => '', 'report_id' => null];

// Prefill from one of the user's reports.
if (!$l && !empty($_GET['report'])) {
    $r = Db::one('SELECT * FROM reports WHERE token = ? AND user_id = ?', [(string) $_GET['report'], $uid]);
    if ($r) {
        $in = json_decode((string) Db::val('SELECT inputs_json FROM report_versions WHERE report_id = ? ORDER BY version DESC LIMIT 1', [$r['id']]), true) ?: [];
        $f = array_merge($f, ['title' => $r['title'], 'country' => $r['country'], 'city' => $r['city'], 'property_type' => $r['property_type'], 'currency' => $r['currency'],
            'price' => $in['asking_price'] ?? '', 'monthly_rent' => $in['monthly_rent'] ?? '', 'area' => $in['area'] ?? '', 'area_unit' => $in['area_unit'] ?? 'sqm', 'bedrooms' => $in['bedrooms'] ?? '', 'report_id' => $r['id']]);
    }
}
$myReports = Db::all('SELECT id, title, visibility FROM reports WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100', [$uid]);
$err = [];
if (is_post()) {
    csrf_check();
    if (($_POST['action'] ?? '') === 'withdraw' && $l) {
        Db::update('listings', ['status' => 'withdrawn', 'updated_at' => Db::now()], 'id = ?', [$id]);
        flash('Listing withdrawn.', 'ok');
        redirect('dashboard.php', ['tab' => 'listings']);
    }
    $num = static fn($k) => ($x = str_replace([',', ' '], '', (string) ($_POST[$k] ?? ''))) !== '' && is_numeric($x) ? (float) $x : null;
    $f = [
        'title' => mb_substr(trim(strip_tags((string) ($_POST['title'] ?? ''))), 0, 160),
        'country' => isset(Countries::LIST[$_POST['country'] ?? '']) ? $_POST['country'] : '',
        'city' => mb_substr(trim(strip_tags((string) ($_POST['city'] ?? ''))), 0, 80),
        'property_type' => isset(Inputs::PROPERTY_TYPES[$_POST['property_type'] ?? '']) ? $_POST['property_type'] : 'other',
        'price' => $num('price'), 'currency' => array_key_exists($_POST['currency'] ?? '', Countries::currencyOptions()) ? $_POST['currency'] : '',
        'monthly_rent' => $num('monthly_rent'), 'area' => $num('area'), 'area_unit' => ($_POST['area_unit'] ?? '') === 'sqft' ? 'sqft' : 'sqm',
        'bedrooms' => $num('bedrooms') === null ? null : (int) $num('bedrooms'),
        'description' => mb_substr(trim(strip_tags((string) ($_POST['description'] ?? ''))), 0, 5000),
        'report_id' => null,
    ];
    $rid = (int) ($_POST['report_id'] ?? 0);
    if ($rid && Db::val('SELECT COUNT(*) FROM reports WHERE id = ? AND user_id = ?', [$rid, $uid])) {
        $f['report_id'] = $rid;
    }
    if ($f['title'] === '') {
        $err['title'] = 'Enter a title.';
    }
    if (!$f['country']) {
        $err['country'] = 'Choose a country.';
    }
    if (!$f['currency']) {
        $err['currency'] = 'Choose a currency.';
    }
    if (!$f['price'] || $f['price'] <= 0) {
        $err['price'] = 'Enter a price.';
    }
    if (empty($_POST['accuracy'])) {
        $err['accuracy'] = 'Confirm the listing is accurate and you are authorised to market it.';
    }
    if (!$err) {
        $now = Db::now();
        $needsReview = Settings::on('listings_require_approval') && !Auth::can('admin.moderate');
        if ($l) {
            $priceChanged = abs((float) $l['price'] - (float) $f['price']) > 0.005;
            // Edits keep the moderation status; a withdrawn or rejected listing goes back to review.
            $status = in_array($l['status'], ['withdrawn', 'rejected'], true) ? ($needsReview ? 'pending' : 'approved') : $l['status'];
            Db::update('listings', $f + ['updated_at' => $now, 'status' => $status], 'id = ?', [$id]);
            if ($priceChanged) {
                foreach (Db::all('SELECT user_id, last_price FROM watchlist WHERE listing_id = ?', [$id]) as $w) {
                    $dir = $f['price'] < (float) $w['last_price'] ? 'dropped' : 'changed';
                    notify((int) $w['user_id'], 'price_change', sprintf('Price %s on "%s": %s → %s', $dir, $f['title'], Fmt::money((float) $l['price'], $f['currency']), Fmt::money($f['price'], $f['currency'])), url('marketplace.php', ['id' => $id]));
                }
                Db::q('UPDATE watchlist SET last_price = ? WHERE listing_id = ?', [$f['price'], $id]);
                audit('listing.price_change', 'listing:' . $id, ['from' => (float) $l['price'], 'to' => $f['price']]);
            }
            flash('Listing updated.', 'ok');
        } else {
            $id = Db::insert('listings', $f + ['user_id' => $uid, 'status' => $needsReview ? 'pending' : 'approved', 'created_at' => $now, 'updated_at' => $now]);
            track('listing_created');
            audit('listing.create', 'listing:' . $id);
            flash($needsReview ? 'Listing submitted. It will appear once a moderator approves it.' : 'Listing published.', 'ok');
        }
        if ($f['report_id']) {
            $vis = Db::val('SELECT visibility FROM reports WHERE id = ?', [$f['report_id']]);
            if ($vis === 'private') {
                flash('Note: the linked report is private, so investors will not see it. Set it to unlisted or public from the report page.', 'info');
            }
        }
        redirect('marketplace.php', ['id' => $id]);
    }
}
$page_title = $l ? 'Edit listing' : 'New listing';
$noindex = true;
require __DIR__ . '/views/header.php';
$fe = static fn($k) => isset($err[$k]) ? '<p class="err">' . e($err[$k]) . '</p>' : '';
?>
<section><div class="wrap narrow">
  <h1><?= $l ? 'Edit listing' : 'List a property' ?></h1>
  <p class="muted">Listings are reviewed before they appear. Price changes alert investors watching the listing.</p>
  <form method="post" class="card" novalidate><?= csrf_field() ?>
    <div class="field<?= isset($err['title']) ? ' has-err' : '' ?>"><label for="lt">Title</label><input id="lt" name="title" value="<?= e($f['title']) ?>" maxlength="160" required><?= $fe('title') ?></div>
    <div class="fgrid">
      <div class="field<?= isset($err['country']) ? ' has-err' : '' ?>"><label for="lc">Country</label><select id="lc" name="country"><option value="">Choose…</option><?php foreach (Countries::options() as $k => $lbl): ?><option value="<?= e($k) ?>"<?= $f['country'] === $k ? ' selected' : '' ?>><?= e($lbl) ?></option><?php endforeach; ?></select><?= $fe('country') ?></div>
      <div class="field"><label for="lci">City</label><input id="lci" name="city" value="<?= e($f['city']) ?>"></div>
      <div class="field"><label for="ltp">Type</label><select id="ltp" name="property_type"><?php foreach (Inputs::PROPERTY_TYPES as $k => $lbl): ?><option value="<?= e($k) ?>"<?= $f['property_type'] === $k ? ' selected' : '' ?>><?= e($lbl) ?></option><?php endforeach; ?></select></div>
      <div class="field<?= isset($err['currency']) ? ' has-err' : '' ?>"><label for="lcu">Currency</label><select id="lcu" name="currency"><option value="">Choose…</option><?php foreach (Countries::currencyOptions() as $c): ?><option<?= $f['currency'] === $c ? ' selected' : '' ?>><?= e($c) ?></option><?php endforeach; ?></select><?= $fe('currency') ?></div>
      <div class="field<?= isset($err['price']) ? ' has-err' : '' ?>"><label for="lp">Asking price</label><input id="lp" name="price" value="<?= e($f['price']) ?>" inputmode="decimal"><?= $fe('price') ?></div>
      <div class="field"><label for="lr">Monthly rent (current or expected)</label><input id="lr" name="monthly_rent" value="<?= e($f['monthly_rent']) ?>" inputmode="decimal"></div>
      <div class="field"><label for="la">Area</label><input id="la" name="area" value="<?= e($f['area']) ?>" inputmode="decimal"></div>
      <div class="field"><label for="lu">Unit</label><select id="lu" name="area_unit"><option value="sqm"<?= $f['area_unit'] === 'sqm' ? ' selected' : '' ?>>m²</option><option value="sqft"<?= $f['area_unit'] === 'sqft' ? ' selected' : '' ?>>ft²</option></select></div>
      <div class="field"><label for="lb">Bedrooms</label><input id="lb" name="bedrooms" value="<?= e($f['bedrooms']) ?>" inputmode="numeric"></div>
    </div>
    <div class="field"><label for="lrep">Attach investment report</label><select id="lrep" name="report_id"><option value="">None</option><?php foreach ($myReports as $r): ?><option value="<?= (int) $r['id'] ?>"<?= (int) $f['report_id'] === (int) $r['id'] ? ' selected' : '' ?>><?= e($r['title'] . ' (' . $r['visibility'] . ')') ?></option><?php endforeach; ?></select><p class="hint">Investors trust listings that show the numbers. The report must be unlisted or public to be visible.</p></div>
    <div class="field"><label for="ld">Description</label><textarea id="ld" name="description" maxlength="5000" style="font-family:var(--font)"><?= e($f['description']) ?></textarea><p class="hint">Do not include personal data of tenants or occupiers.</p></div>
    <label class="checkrow"><input type="checkbox" name="accuracy" value="1"> <span>The information is accurate to my knowledge and I am the owner or authorised to market this property.</span></label><?= $fe('accuracy') ?>
    <p style="margin-top:12px" class="btn-row"><button class="btn"><?= $l ? 'Save changes' : 'Submit listing' ?></button></p>
  </form>
  <?php if ($l && $l['status'] !== 'withdrawn'): ?>
  <form method="post" style="margin-top:12px" data-confirm="Withdraw this listing?"><?= csrf_field() ?><input type="hidden" name="action" value="withdraw"><button class="btn btn-sm btn-ghost">Withdraw listing</button></form>
  <?php endif; ?>
</div></section>
<?php require __DIR__ . '/views/footer.php';
