<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Analysis, Auth, Charts, Content, Countries, Db, Fmt, Inputs, View, Settings};

$isSample = !empty($_GET['sample']);
$report = null;
$owner = false;
$versions = [];
if ($isSample) {
    $inputs = Content::sampleInputs();
    [$v, $prov] = Inputs::normalise($inputs);
    $v['sims'] = 2000;
    $res = Analysis::run($v, $prov);
    $res['provenance'] = $prov;
    $verRow = ['version' => 1, 'created_at' => Db::now(), 'engine' => Analysis::VERSION, 'note' => 'Example'];
} else {
    $token = (string) ($_GET['id'] ?? '');
    $report = preg_match('/^[a-f0-9]{24}$/', $token) ? Db::one('SELECT r.*, u.name AS owner_name, u.role AS owner_role, u.plan AS owner_plan, u.agency, u.brand_name, u.licence_no, u.verified_pro, u.ref_code AS owner_ref FROM reports r LEFT JOIN users u ON u.id = r.user_id WHERE r.token = ?', [$token]) : null;
    if (!$report) {
        render_error(404, 'Report not found.');
    }
    $uid = Auth::id();
    $owner = ($uid && (int) $report['user_id'] === $uid) || (!$report['user_id'] && $report['guest_key'] && hash_equals((string) $report['guest_key'], (string) guest_key(false)));
    $isStaff = Auth::can('admin.moderate');
    if (!$owner && !$isStaff && $report['visibility'] === 'private') {
        render_error(404, 'Report not found, or it is private.');
    }

    // Owner actions
    if (is_post()) {
        csrf_check();
        if (!$owner) {
            render_error(403, 'Only the owner can change this report.');
        }
        $act = (string) ($_POST['action'] ?? '');
        if ($act === 'visibility' && in_array($_POST['visibility'] ?? '', ['private', 'unlisted', 'public'], true)) {
            $vis = $_POST['visibility'];
            if ($vis === 'public' && !Settings::on('public_reports_enabled')) {
                flash('Public reports are currently disabled.', 'err');
            } elseif ($vis !== 'private' && !$report['user_id']) {
                flash('Create a free account to share reports.', 'err');
            } else {
                Db::update('reports', ['visibility' => $vis, 'updated_at' => Db::now()], 'id = ?', [$report['id']]);
                track('report_visibility', ['to' => $vis]);
                audit('report.visibility', 'report:' . $report['id'], $vis);
                flash($vis === 'private' ? 'Report is now private.' : 'Sharing turned on (' . $vis . ').', 'ok');
            }
        } elseif ($act === 'delete') {
            Db::q('DELETE FROM report_versions WHERE report_id = ?', [$report['id']]);
            Db::q('UPDATE listings SET report_id = NULL WHERE report_id = ?', [$report['id']]);
            Db::q('UPDATE portfolio SET report_id = NULL WHERE report_id = ?', [$report['id']]);
            foreach (Db::all('SELECT stored_name FROM documents WHERE report_id = ?', [$report['id']]) as $d) {
                @unlink(SS_ROOT . '/data/uploads/' . $d['stored_name']);
            }
            Db::q('DELETE FROM documents WHERE report_id = ?', [$report['id']]);
            Db::q('DELETE FROM reports WHERE id = ?', [$report['id']]);
            audit('report.delete', 'report:' . $report['id']);
            flash('Report deleted.', 'ok');
            redirect(Auth::id() ? 'dashboard.php' : 'index.php');
        } elseif ($act === 'portfolio' && Auth::can('portfolio')) {
            $rv = Db::one('SELECT result_json, inputs_json FROM report_versions WHERE report_id = ? ORDER BY version DESC LIMIT 1', [$report['id']]);
            $rr = json_decode($rv['result_json'], true);
            $now = Db::now();
            Db::insert('portfolio', ['user_id' => Auth::id(), 'name' => $report['title'], 'currency' => $report['currency'], 'value' => $rr['params']['price'],
                'loan_balance' => $rr['params']['loan'], 'monthly_rent' => $rr['params']['rent_m'], 'monthly_costs' => ($rr['base']['rows'][0]['opex'] + $rr['base']['rows'][0]['ds']) / 12,
                'purchase_price' => $rr['params']['price'], 'report_id' => $report['id'], 'created_at' => $now, 'updated_at' => $now]);
            track('portfolio_add');
            flash('Added to your portfolio. Update its current value any time from your dashboard.', 'ok');
        } elseif ($act === 'upload' && Auth::id()) {
            $f = $_FILES['doc'] ?? null;
            $allowed = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'];
            $count = (int) Db::val('SELECT COUNT(*) FROM documents WHERE user_id = ?', [Auth::id()]);
            if (!$f || $f['error'] !== UPLOAD_ERR_OK) {
                flash('Upload failed. Choose a PDF, JPG or PNG under 5 MB.', 'err');
            } elseif ($f['size'] > 5 * 1024 * 1024) {
                flash('File is larger than 5 MB.', 'err');
            } elseif ($count >= (int) Auth::entitlement('docs')) {
                flash('Document limit for your plan reached.', 'err');
            } else {
                $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
                if (!isset($allowed[$mime])) {
                    flash('Only PDF, JPG and PNG files are accepted.', 'err');
                } else {
                    $dir = SS_ROOT . '/data/uploads';
                    if (!is_dir($dir)) {
                        mkdir($dir, 0770, true);
                    }
                    $stored = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
                    if (move_uploaded_file($f['tmp_name'], $dir . '/' . $stored)) {
                        Db::insert('documents', ['user_id' => Auth::id(), 'report_id' => $report['id'], 'filename' => mb_substr(basename(preg_replace('/[^\w.\- ]/u', '_', $f['name'])), 0, 200),
                            'stored_name' => $stored, 'mime' => $mime, 'size' => (int) $f['size'], 'doc_type' => in_array($_POST['doc_type'] ?? '', ['photo', 'floorplan', 'valuation', 'lease', 'title', 'financials', 'inspection', 'planning', 'other'], true) ? $_POST['doc_type'] : 'other', 'created_at' => Db::now()]);
                        audit('document.upload', 'report:' . $report['id']);
                        flash('Document stored privately. Remember: we do not read or verify its contents — confirm key figures yourself.', 'ok');
                    }
                }
            }
        }
        redirect('report.php', ['id' => $report['token']]);
    }

    $versions = Db::all('SELECT version, engine, note, created_at FROM report_versions WHERE report_id = ? ORDER BY version DESC', [$report['id']]);
    $want = (int) ($_GET['v'] ?? $report['current_version']);
    $verRow = Db::one('SELECT * FROM report_versions WHERE report_id = ? AND version = ?', [$report['id'], $want]) ?? Db::one('SELECT * FROM report_versions WHERE report_id = ? ORDER BY version DESC LIMIT 1', [$report['id']]);
    $res = json_decode($verRow['result_json'], true);
    $inputs = json_decode($verRow['inputs_json'], true);
    [$v, $prov] = Inputs::normalise($inputs);
    $prov = $res['provenance'] ?? $prov;
    if (!$owner) {
        Db::q('UPDATE reports SET views = views + 1 WHERE id = ?', [$report['id']]);
        track('report_view_shared', ['r' => $report['id']]);
    }
}

$cur = $v['currency'];
$M = static fn($x) => Fmt::money($x, $cur);
$Ms = static fn($x) => Fmt::short($x);
$P = static fn($x) => Fmt::pct($x);
$b = $res['base'];
$mc = $res['mc'];
$sc = $res['scores'];
$val = $res['valuation'];
$ck = $res['checks'];
$p = $res['params'];
$stale = !$isSample && $res['engine'] !== Analysis::VERSION;
$branded = $report && $report['brand_name'] && in_array($report['owner_role'], ['agent', 'creator', 'admin', 'super_admin'], true) && (\SS\Auth::ENTITLEMENTS[$report['owner_plan']]['branding'] ?? false);
$title = $isSample ? 'Example report — hypothetical apartment' : $report['title'];
$page_title = $title;
$page_desc = sprintf('Investment analysis: net yield %s, base-case IRR %s, %s simulated outcomes. Indicative, not advice.', $P($b['net_yield']), $P($b['irr']), $mc ? number_format($mc['n']) : 'no');
$canonical = $isSample ? abs_url('report.php', ['sample' => 1]) : abs_url('report.php', ['id' => $report['token']]);
$og = ['title' => $title . ' — Shelter and Sense report', 'description' => $page_desc, 'type' => 'article'];
$noindex = !$isSample && $report['visibility'] !== 'public';
$shareUrl = $canonical . (Auth::user() ? '&ref=' . Auth::user()['ref_code'] : '');
$showPrivate = $owner || $isSample;
require __DIR__ . '/views/header.php';

$sections = [
    'summary' => 'Executive summary', 'overview' => 'Property overview', 'valuation' => 'Indicative valuation', 'comps' => 'Comparable analysis',
    'rent' => 'Rental income potential', 'returns' => 'Yields & returns', 'cashflow' => 'Cash flow', 'financing' => 'Financing analysis',
    'costs' => 'Operating costs', 'breakeven' => 'Break-even & vacancy', 'scenarios' => 'Appreciation & scenarios', 'sensitivity' => 'Sensitivity',
    'montecarlo' => 'Monte Carlo simulation', 'risk' => 'Risk assessment', 'location' => 'Location & market', 'regulatory' => 'Regulatory & tax',
    'swot' => 'Strengths, weaknesses, uncertainties', 'missing' => 'Missing information', 'diligence' => 'Due-diligence checklist',
    'suitability' => 'Suitability & next steps', 'inputs' => 'Inputs & provenance', 'method' => 'Sources, methodology & versions',
];
$n = 0;
$H = static function (string $id) use (&$n, $sections) {
    $n++;
    return '<section class="rsec" id="' . $id . '"><h2><span class="n">' . str_pad((string) $n, 2, '0', STR_PAD_LEFT) . '</span>' . e($sections[$id]) . '</h2>';
};
?>
<div class="wrap">
  <header class="rep-head">
    <?php if ($branded): ?>
    <div class="brandbar"><strong><?= e($report['brand_name']) ?></strong><?= $report['agency'] ? '<span>' . e($report['agency']) . '</span>' : '' ?><?= $report['licence_no'] ? '<span class="muted">Licence ' . e($report['licence_no']) . ($report['verified_pro'] ? ' · verified' : ' · not verified by Shelter and Sense') . '</span>' : '' ?><span class="muted" style="margin-left:auto">Prepared with Shelter and Sense</span></div>
    <?php endif; ?>
    <p class="eyebrow">Investment evaluation report</p>
    <h1><?= e($title) ?></h1>
    <div class="rep-meta">
      <?php if ($isSample): ?><?= View::badge('Hypothetical example — illustrative inputs, not real market data', 'warn') ?><?php endif; ?>
      <span>Version <?= (int) $verRow['version'] ?></span><span>·</span><span>Computed <?= e(substr($res['computed_at'], 0, 16)) ?> UTC</span><span>·</span><span>Engine <?= e($res['engine']) ?></span>
      <?php if ($report): ?><span>·</span><?= View::badge(ucfirst($report['visibility']), $report['visibility'] === 'private' ? '' : 'info') ?><?php endif; ?>
    </div>
    <?php if ($stale): ?><div class="callout"><p>This report was computed with engine <?= e($res['engine']) ?>. The current engine is <?= e(Analysis::VERSION) ?>. <?= $owner ? '<a href="' . e(url('evaluate.php', ['edit' => $report['token']])) . '">Re-run it</a> to update.' : '' ?></p></div><?php endif; ?>
    <div class="btn-row noprint" style="margin-top:12px">
      <?php if ($owner): ?><a class="btn btn-sm" href="<?= e(url('evaluate.php', ['edit' => $report['token']])) ?>">Edit inputs</a><?php endif; ?>
      <?php if ($isSample): ?><a class="btn btn-sm" href="<?= e(url('evaluate.php')) ?>">Evaluate your own property</a><?php endif; ?>
      <button class="btn btn-sm btn-ghost" type="button" data-print>Download PDF / print</button>
      <?php if ($owner && Auth::can('listing.create')): ?><a class="btn btn-sm btn-ghost" href="<?= e(url('listing-edit.php', ['report' => $report['token']])) ?>">Publish as listing</a><?php endif; ?>
      <?php if ($owner && Auth::can('portfolio')): ?><form method="post" class="inline"><?= csrf_field() ?><input type="hidden" name="action" value="portfolio"><button class="btn btn-sm btn-ghost">Add to portfolio</button></form><?php endif; ?>
    </div>
  </header>

  <div class="cols">
    <aside class="sticky toc noprint" aria-label="Report contents">
      <ol><?php foreach ($sections as $id => $label): ?><li><a href="#<?= $id ?>"><?= e($label) ?></a></li><?php endforeach; ?></ol>
      <?php if ($owner && $report): ?>
      <div class="card" style="margin-top:16px">
        <h3>Sharing</h3>
        <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="visibility">
          <select name="visibility" aria-label="Report visibility">
            <?php foreach (['private' => 'Private — only you', 'unlisted' => 'Unlisted — anyone with the link', 'public' => 'Public — listed in the gallery'] as $vk => $vl): ?>
            <option value="<?= $vk ?>"<?= $report['visibility'] === $vk ? ' selected' : '' ?>><?= e($vl) ?></option><?php endforeach; ?>
          </select>
          <button class="btn btn-sm" style="margin-top:8px">Save</button>
        </form>
        <p class="hint">Shared reports hide the street address and coordinates.</p>
        <?php if ($report['visibility'] !== 'private'): ?>
        <label for="shareurl" style="margin-top:10px">Share link</label>
        <div class="share-box"><input id="shareurl" type="text" readonly value="<?= e($shareUrl) ?>"><button class="btn btn-sm btn-ghost" type="button" data-copy="#shareurl">Copy</button></div>
        <label for="embedrep" style="margin-top:10px">Embed preview</label>
        <textarea id="embedrep" class="embedcode" readonly><iframe src="<?= e(abs_url('embed.php', ['report' => $report['token']])) ?>" width="100%" height="360" style="border:0" loading="lazy" title="Shelter and Sense report"></iframe></textarea>
        <?php endif; ?>
      </div>
      <?php endif; ?>
    </aside>

    <article>
      <?= $H('summary') ?>
        <div class="verdict">
          <div>
            <div class="stat-l">Fit for your objective (<?= e(Inputs::OBJECTIVES[$v['objective']]) ?>)</div>
            <div class="verdict-band"><?= e($sc['band']) ?></div>
            <?php if ($sc['overall'] !== null): ?><span class="score-pill"><?= (int) round($sc['overall']) ?><span class="muted small">/100</span></span><?php endif; ?>
          </div>
          <dl class="kv">
            <dt>Financial performance</dt><dd><?= e($P($b['irr'])) ?> base-case IRR · <?= e($M($b['monthly_cf1'])) ?>/month year 1</dd>
            <dt>Risk</dt><dd><?= e($sc['risk_rating']) ?> — <?= (int) $sc['risk_high'] ?> high, <?= (int) $sc['risk_not_assessed'] ?> not assessed</dd>
            <dt>Market conditions</dt><dd><?= e($sc['market_rating']) ?></dd>
            <dt>Data reliability</dt><dd><?= e($res['confidence']['band']) ?> (<?= (int) round($res['confidence']['total']) ?>/100)</dd>
            <?php if ($mc): ?><dt>Chance of meeting <?= e($v['target_irr_pct']) ?>% target</dt><dd><?= e($P($mc['p_target'])) ?> of <?= number_format($mc['n']) ?> simulations</dd><?php endif; ?>
          </dl>
        </div>
        <?php if ($sc['gates']): ?><div class="callout"><p><strong>Constraints applied:</strong></p><ul><?php foreach ($sc['gates'] as $g): ?><li><?= e($g) ?></li><?php endforeach; ?></ul></div><?php endif; ?>
        <div class="stats" style="margin-top:14px">
          <?= View::stat('Purchase price', $M($p['price'])) ?>
          <?= View::stat('Cash required', $M($b['equity0']), 'Deposit + costs') ?>
          <?= View::stat('Net yield', $P($b['net_yield'])) ?>
          <?= View::stat('Cash-on-cash', $P($b['coc']), 'Year 1', View::tone($b['coc'])) ?>
          <?= View::stat('IRR', $P($b['irr']), $v['hold_years'] . '-yr hold', View::tone($b['irr'])) ?>
          <?= View::stat('NPV @ ' . $v['discount_rate_pct'] . '%', $M($b['npv']), '', View::tone($b['npv'])) ?>
        </div>
        <p class="small muted" style="margin-top:12px">This property is not labelled "good" or "bad": the fit above is for the objective, budget and risk tolerance you entered. Change them and the fit changes.</p>
      </section>

      <?= $H('overview') ?>
        <dl class="kv">
          <dt>Location</dt><dd><?= e(trim(($v['district'] ? $v['district'] . ', ' : '') . ($v['city'] ? $v['city'] . ', ' : '') . Countries::name($v['country']))) ?><?= $showPrivate && $v['address'] ? ' — ' . e($v['address']) : '' ?></dd>
          <dt>Type</dt><dd><?= e(Inputs::PROPERTY_TYPES[$v['property_type']] . ($v['subtype'] ? ' — ' . $v['subtype'] : '')) ?></dd>
          <dt>Status</dt><dd><?= e(str_replace('_', ' ', $v['construction_status'])) ?><?= $v['project_name'] ? ' · ' . e($v['project_name']) : '' ?></dd>
          <dt>Size</dt><dd><?= $v['area'] ? e(number_format($v['area']) . ' ' . ($v['area_unit'] === 'sqft' ? 'ft²' : 'm²')) : 'Not provided' ?><?= $v['bedrooms'] !== null ? ' · ' . (int) $v['bedrooms'] . ' bed' : '' ?><?= $v['bathrooms'] !== null ? ' · ' . (int) $v['bathrooms'] . ' bath' : '' ?></dd>
          <dt>Age & condition</dt><dd><?= $v['building_age'] !== null ? (int) $v['building_age'] . ' years · ' : '' ?><?= e($v['condition']) ?> · <?= e($v['furnishing']) ?></dd>
          <dt>Tenure</dt><dd><?= e($v['tenure']) ?><?= $v['lease_years_left'] !== null ? ' · ' . (int) $v['lease_years_left'] . ' years left' : '' ?></dd>
          <dt>Asking / purchase</dt><dd><?= e($M($v['asking_price'])) ?> / <?= e($M($v['purchase_price'])) ?><?= $v['area_sqm'] ? ' · ' . e($M($v['purchase_price'] / $v['area'])) . ' per ' . ($v['area_unit'] === 'sqft' ? 'ft²' : 'm²') : '' ?></dd>
          <dt>Strategy</dt><dd><?= e(str_replace('_', ' ', $v['rental_mode'])) ?> · <?= e(Inputs::OBJECTIVES[$v['objective']]) ?> · <?= (int) $v['hold_years'] ?>-year hold</dd>
        </dl>
        <?php if ($report && $owner): $docs = Db::all('SELECT * FROM documents WHERE report_id = ? ORDER BY created_at DESC', [$report['id']]); ?>
        <h3 style="margin-top:16px">Documents</h3>
        <?php if ($docs): ?><ul class="list-plain small"><?php foreach ($docs as $d): ?><li><a href="<?= e(url('download.php', ['id' => $d['id']])) ?>"><?= e($d['filename']) ?></a> <span class="muted">· <?= e($d['doc_type']) ?> · <?= number_format($d['size'] / 1024) ?> KB · <?= $d['verified'] ? 'verified' : 'unverified' ?></span></li><?php endforeach; ?></ul><?php endif; ?>
        <?php if (Auth::id()): ?>
        <form method="post" enctype="multipart/form-data" class="noprint btn-row"><?= csrf_field() ?><input type="hidden" name="action" value="upload">
          <select name="doc_type" aria-label="Document type" style="max-width:180px"><?php foreach (['photo' => 'Photo', 'floorplan' => 'Floor plan', 'valuation' => 'Valuation report', 'lease' => 'Lease', 'title' => 'Title document', 'financials' => 'Financial statements', 'inspection' => 'Inspection', 'planning' => 'Planning', 'other' => 'Other'] as $dk => $dl): ?><option value="<?= $dk ?>"><?= $dl ?></option><?php endforeach; ?></select>
          <input type="file" name="doc" accept=".pdf,.jpg,.jpeg,.png" aria-label="Choose document" required>
          <button class="btn btn-sm btn-ghost">Upload privately</button>
        </form>
        <p class="hint">Stored privately for your reference. Automatic text extraction (OCR) is not available in this version — enter figures from documents into the form yourself.</p>
        <?php else: ?><p class="hint">Log in to attach documents.</p><?php endif; ?>
        <?php endif; ?>
      </section>

      <?= $H('valuation') ?>
        <?php $rec = $val['reconciled']; ?>
        <?php if ($rec): ?>
        <div class="stats">
          <?= View::stat('Indicative value', $M($rec['value']), 'Reconciled from ' . count($rec['weights']) . ' approach(es)') ?>
          <?= View::stat('80% range', $Ms($rec['value'] - 1.2816 * $rec['sd']) . ' – ' . $Ms($rec['value'] + 1.2816 * $rec['sd'])) ?>
          <?= View::stat('Asking vs estimate', Fmt::pct($val['asking_gap'], 1, true), abs($val['asking_z']) < 1 ? 'Within 1 sd of the evidence' : 'More than 1 sd from the evidence', $val['asking_gap'] > 0.05 ? 'neg' : ($val['asking_gap'] < -0.03 ? 'pos' : '')) ?>
        </div>
        <?php else: ?>
        <div class="callout"><p><strong>Fair value not estimated.</strong> <?= e($val['comps']['reason'] ?? 'Not enough comparable evidence.') ?> We do not guess a value without evidence.</p></div>
        <?php endif; ?>
        <?= View::table(['Approach', 'Indication', 'Range (≈80%)', 'Weight', 'Status'], [
            ['Comparable sales', !empty($val['comps']['available']) ? $M($val['comps']['value']) : '—', !empty($val['comps']['available']) ? $Ms($val['comps']['lo']) . ' – ' . $Ms($val['comps']['hi']) : '—', isset($rec['weights']['comparables']) ? Fmt::pct($rec['weights']['comparables'], 0) : '—', !empty($val['comps']['available']) ? 'Operational' : ($val['comps']['reason'] ?? 'Unavailable')],
            ['Hedonic regression', !empty($val['hedonic']['available']) ? $M($val['hedonic']['value']) : '—', !empty($val['hedonic']['available']) ? $Ms($val['hedonic']['lo']) . ' – ' . $Ms($val['hedonic']['hi']) : '—', isset($rec['weights']['hedonic']) ? Fmt::pct($rec['weights']['hedonic'], 0) : '—', !empty($val['hedonic']['available']) ? sprintf('R² %.2f, LOOCV error %s, n=%d', $val['hedonic']['r2'], Fmt::pct($val['hedonic']['loocv_mape']), $val['hedonic']['n']) : ($val['hedonic']['reason'] ?? 'Unavailable')],
            ['Income approach', !empty($val['income']['available']) ? $M($val['income']['value']) : '—', '—', 'Shown separately', !empty($val['income']['available']) ? 'Year-1 NOI ÷ your ' . Fmt::pct($val['income']['cap_rate']) . ' market cap rate' : 'Enter a market cap rate to enable'],
        ]) ?>
        <?php if (!empty($val['hedonic']['available'])): ?>
        <details style="margin-top:10px"><summary class="small">Regression coefficients</summary>
          <?= View::table(['Term', 'Coefficient (per unit)', 'p-value'], array_map(static fn($c) => [$c['term'], Fmt::num($c['beta_raw'], 4), Fmt::num($c['p'], 3)], $val['hedonic']['coef'])) ?>
          <p class="hint">Log-price model<?= $val['hedonic']['lambda'] > 0 ? ' with ridge penalty λ=' . $val['hedonic']['lambda'] . ' (few comparables relative to variables)' : '' ?>. Associations within your comparables, not causal effects.</p>
        </details>
        <?php endif; ?>
        <p class="hint">An indicative estimate from the evidence you supplied — not a regulated valuation. Lenders and courts require a qualified valuer.</p>
      </section>

      <?= $H('comps') ?>
        <?php $crow = $val['comps']['rows'] ?? []; ?>
        <?php if ($crow): ?>
        <?= View::table(['Evidence', 'Price', 'Area', 'Months ago', 'Distance', 'Adj. per area', 'Weight', 'Source'], array_map(static fn($c) => [
            \SS\Inputs::COMP_KINDS[$c['kind']], Fmt::money($c['price'], $cur), $c['area'] ? number_format($c['area']) : '—', $c['months_ago'] ?? '?', $c['distance_km'] !== null ? $c['distance_km'] . ' km' : '?',
            Fmt::money($c['ppsm'] * ($v['area_unit'] === 'sqft' ? 0.09290304 : 1), $cur), Fmt::pct($c['weight_share'], 0), $c['source'] ?: 'Not stated'], $crow)) ?>
        <p class="hint">Completed transactions: <?= (int) $val['comps']['n_txn'] ?> of <?= (int) $val['comps']['n'] ?>. Asking prices are evidence of seller expectations, not achieved prices<?= $v['asking_adjust_pct'] > 0 ? ' — discounted by ' . e($v['asking_adjust_pct']) . '% as you set' : ' — no discount applied (set one in section G if appropriate)' ?>. Past transactions are time-adjusted using your <?= e($v['appreciation_pct']) ?>% price-change assumption. Effective number of comparables: <?= Fmt::num($val['comps']['n_eff'], 1) ?>.</p>
        <?php else: ?><p class="muted">No sale comparables were analysed. <?= e($val['comps']['reason'] ?? '') ?></p><?php endif; ?>
      </section>

      <?= $H('rent') ?>
        <div class="stats">
          <?= View::stat('Monthly rent used', $M($p['rent_m']), ucfirst($v['rent_basis']) . ' · ' . strip_tags(View::prov($prov['monthly_rent'] ?? 'user'))) ?>
          <?= View::stat('Gross annual rent', $M($b['gpr1'])) ?>
          <?= View::stat('Rent per area', $v['area'] ? $M($p['rent_m'] / $v['area']) : '—', $v['area'] ? 'per ' . ($v['area_unit'] === 'sqft' ? 'ft²' : 'm²') . ' / month' : '') ?>
        </div>
        <?php $by = $res['bayes']; if (!empty($by['available'])): $po = $by['posterior']; ?>
        <h3 style="margin-top:16px">Bayesian rent check</h3>
        <p class="small">Your estimate (prior <?= e($M($by['prior'])) ?> ± <?= e($M($by['prior_sd'])) ?>) updated with <?= (int) $by['n'] ?> rental comparable(s) averaging <?= e($M($po['xbar'])) ?> (size-adjusted<?= $by['obs_sd_assumed'] ? '; spread assumed at 15% because fewer than 3 comparables' : '' ?>):</p>
        <div class="stats">
          <?= View::stat('Posterior rent', $M($po['mean'])) ?>
          <?= View::stat('90% credible interval', $Ms($po['lo90']) . ' – ' . $Ms($po['hi90'])) ?>
          <?= View::stat('Weight on evidence', Fmt::pct($po['weight_on_data'], 0)) ?>
        </div>
        <p class="hint">Prior sensitivity — posterior if your prior were half / as / twice as uncertain: <?= e($M($by['sensitivity']['0.5'])) ?> / <?= e($M($by['sensitivity']['1'])) ?> / <?= e($M($by['sensitivity']['2'])) ?>. A credible interval describes uncertainty given the model and evidence; it is not a guarantee. The Monte Carlo simulation is centred on the posterior.</p>
        <?php else: ?><p class="muted small">No rental comparables entered, so your rent estimate has not been tested against evidence. Add signed leases or advertised rents for similar properties in section B.</p><?php endif; ?>
      </section>

      <?= $H('returns') ?>
        <div class="stats">
          <?= View::stat('Gross yield', $P($b['gross_yield']), 'Rent ÷ price') ?>
          <?= View::stat('Net yield', $P($b['net_yield']), 'NOI ÷ total cost') ?>
          <?= View::stat('Cap rate', $P($b['cap_rate']), 'NOI ÷ price') ?>
          <?= View::stat('Cash-on-cash', $P($b['coc']), 'Yr-1 cash flow ÷ equity', View::tone($b['coc'])) ?>
          <?= View::stat('IRR', $P($b['irr']), 'Nominal', View::tone($b['irr'])) ?>
          <?= View::stat('Real IRR', $P($b['real_irr']), 'After ' . $v['inflation_pct'] . '% inflation') ?>
          <?= View::stat('MIRR', $P($b['mirr'])) ?>
          <?= View::stat('NPV', $M($b['npv']), '@ ' . $v['discount_rate_pct'] . '%', View::tone($b['npv'])) ?>
          <?= View::stat('Equity multiple', Fmt::num($b['equity_multiple']) . '×') ?>
          <?= View::stat('Total ROI', $P($b['roi_total']), $P($b['roi_annualised']) . ' annualised') ?>
        </div>
        <?php if ($res['fx']): $fx = $res['fx']['rate']; $ic = $v['investor_currency']; ?>
        <div class="callout callout-info"><p><strong>In <?= e($ic) ?></strong> at <?= e($fx) ?> (<?= e($v['fx_source'] ?: 'source not stated') ?>, <?= e($v['fx_date'] ?: 'date not stated') ?>): cash required <?= e(Fmt::money($b['equity0'] * $fx, $ic)) ?>, year-1 cash flow <?= e(Fmt::money($b['cf1'] * $fx / 12, $ic)) ?>/month. Original currency (<?= e($cur) ?>) figures are authoritative.<?php if (isset($mc['fx_irr_q'])): ?> Simulated <?= e($ic) ?> IRR with <?= e($v['fx_vol_pct']) ?>% FX volatility: P5 <?= e($P($mc['fx_irr_q']['0.05'])) ?>, median <?= e($P($mc['fx_irr_q']['0.5'])) ?>, P95 <?= e($P($mc['fx_irr_q']['0.95'])) ?>.<?php endif; ?></p></div>
        <?php endif; ?>
        <p class="hint">IRR, NPV and MIRR use the year-by-year flows below with sale at the end of year <?= (int) $v['hold_years'] ?>. MIRR uses your loan rate as finance rate and your discount rate as reinvestment rate.</p>
      </section>

      <?= $H('cashflow') ?>
        <?php $rows = $b['rows']; $first = $rows[0]; ?>
        <div class="stats">
          <?= View::stat('Monthly cash flow (yr 1)', $M($b['monthly_cf1']), '', View::tone($b['monthly_cf1'])) ?>
          <?= View::stat('Annual cash flow (yr 1)', $M($b['cf1']), '', View::tone($b['cf1'])) ?>
          <?= View::stat('Net sale proceeds', $M($b['net_sale']), 'Year ' . (int) $v['hold_years']) ?>
        </div>
        <h3 style="margin-top:16px">Year-1 waterfall</h3>
        <?= Charts::waterfall([
            ['Gross rent', $first['gpr'], true], ['Vacancy', -$first['vacLoss'], false], ['Other income', $first['other'], false], ['Management', -$first['mgmt'], false],
            ['Fixed costs', -$first['fixed'], false], ['Debt service', -$first['ds'], false], ['Capex reserve', -$first['capex'], false], ['Cash flow', $first['cf'], true],
        ], 'Year-1 waterfall from gross rent to cash flow', $Ms) ?>
        <h3>Annual cash flow</h3>
        <?= Charts::bars(array_map(static fn($r) => 'Y' . $r['y'], $rows), array_column($rows, 'cf'), 'Annual cash flow by year', $Ms) ?>
        <details><summary class="small">Year-by-year table</summary>
          <?= View::table(['Year', 'Gross rent', 'Vacancy', 'Opex', 'NOI', 'Debt service', 'Cash flow', 'Loan balance', 'Value'], array_map(static fn($r) => ['Y' . $r['y'], Fmt::short($r['gpr']), Fmt::short(-$r['vacLoss']), Fmt::short(-$r['opex']), Fmt::short($r['noi']), Fmt::short(-$r['ds']), Fmt::short($r['cf']), Fmt::short($r['balance']), Fmt::short($r['value'])], $rows)) ?>
        </details>
      </section>

      <?= $H('financing') ?>
        <?php if ($p['loan'] > 0): ?>
        <div class="stats">
          <?= View::stat('Loan', $M($p['loan']), Fmt::pct($b['ltv'], 0) . ' LTV') ?>
          <?= View::stat('Rate', Fmt::pct($p['rate'], 2), ucfirst($v['rate_type'])) ?>
          <?= View::stat('Monthly payment', $M($b['payment_monthly']), $v['io_years'] ? 'Interest-only first ' . $v['io_years'] . ' yrs' : 'Principal + interest') ?>
          <?= View::stat('DSCR', $b['dscr'] !== null ? Fmt::num($b['dscr']) . '×' : '—', 'NOI ÷ debt service', $b['dscr'] !== null ? ($b['dscr'] >= 1.25 ? 'pos' : ($b['dscr'] < 1 ? 'neg' : '')) : '') ?>
          <?= View::stat('Interest over hold', $M(array_sum(array_column(array_slice($b['amort'], 0, $v['hold_years']), 'interest')))) ?>
        </div>
        <?= Charts::lines(array_map(static fn($r) => 'Y' . $r['y'], $rows), [['name' => 'Property value', 'values' => array_column($rows, 'value')], ['name' => 'Loan balance', 'values' => array_column($rows, 'balance')]], 'Property value versus loan balance', $Ms) ?>
        <p class="hint">Equity at exit before selling costs: <?= e($M($b['exit_value'] - $b['exit_balance'])) ?>. Value path uses your <?= e($v['appreciation_pct']) ?>% assumption, not a forecast.</p>
        <?php else: ?><p>All-cash purchase — no financing risk, but lower leverage means lower cash-on-cash potential when the property yield exceeds borrowing costs.</p><?php endif; ?>
      </section>

      <?= $H('costs') ?>
        <?php
        $costParts = [['Management', $first['mgmt']], ['Maintenance', $p['maint']], ['Insurance', (float) ($v['insurance_annual'] ?? 0)], ['Property tax', (float) ($v['property_tax_annual'] ?? 0)], ['Service charges', (float) ($v['service_charge_annual'] ?? 0)], ['Utilities', (float) $v['utilities_annual']], ['Other', (float) $v['other_opex_annual']], ['Capex reserve', $first['capex']]];
        ?>
        <?= Charts::stack($costParts, 'Year-1 operating cost breakdown', $M) ?>
        <ul class="legend"><?php foreach ($costParts as $i => [$nm, $cv]): if ($cv <= 0) continue; ?><li><i class="c<?= $i % 8 ?>"></i><?= e($nm) ?> <?= e($M($cv)) ?></li><?php endforeach; ?></ul>
        <?= View::table(['Upfront cost', 'Amount'], [['Purchase price', $M($p['price'])], ['Taxes, fees & brokerage', $M($p['acq_costs'])], ['Renovation / initial capex', $M($p['renovation'])], ['Total cost', $M($b['total_cost'])], ['Less loan', $M(-$p['loan'])], ['Cash required', $M($b['equity0'])]]) ?>
        <p class="hint">Operating expense ratio year 1: <?= $first['egi'] > 0 ? e($P(($first['opex']) / $first['egi'])) : '—' ?> of effective income. Costs grow at <?= e($v['expense_growth_pct']) ?>% a year.</p>
      </section>

      <?= $H('breakeven') ?>
        <div class="stats">
          <?= View::stat('Break-even occupancy', $P($b['break_even_occ']), 'For zero year-1 cash flow', $b['break_even_occ'] !== null ? ($b['break_even_occ'] > 0.9 ? 'neg' : '') : '') ?>
          <?= View::stat('Vacancy assumed', $P($p['vacancy'])) ?>
        </div>
        <?= View::table(['Vacancy', 'Monthly cash flow', 'IRR'], array_map(static fn($r) => [Fmt::pct($r['vacancy'], 0), Fmt::money($r['cf_m'], $cur), Fmt::pct($r['irr'])], $res['vacancy_sens'])) ?>
      </section>

      <?= $H('scenarios') ?>
        <?= View::table(['Scenario', 'IRR', 'NPV', 'Cash flow / mo (yr 1)', 'Total profit', 'DSCR'], array_map(static fn($s) => [$s['label'], Fmt::pct($s['irr']), Fmt::money($s['npv'], $cur), Fmt::money($s['cf1'] / 12, $cur), Fmt::money($s['profit'], $cur), $s['dscr'] !== null ? Fmt::num($s['dscr']) . '×' : '—'], $res['scenarios'])) ?>
        <details><summary class="small">Scenario definitions</summary>
          <ul class="small"><?php foreach (Analysis::scenarioDefs() as [$lab, $d]): if (!$d) continue; ?><li><strong><?= e($lab) ?>:</strong> <?= e(implode(', ', array_map(static function ($k, $x) {
              $names = ['rent_m' => 'rent', 'vacancy' => 'vacancy', 'appreciation' => 'price change', 'rent_growth' => 'rent growth', 'opex_mult' => 'operating costs', 'rate' => 'interest rate', 'sell_cost' => 'selling costs'];
              return ($names[$k] ?? $k) . ' ' . (in_array($k, ['rent_m', 'opex_mult'], true) ? sprintf('×%.2f', $x) : sprintf('%+.1f pts', $x * 100));
          }, array_keys($d), $d))) ?></li><?php endforeach; ?></ul>
          <p class="hint">Fixed, published deltas around your base case — not probabilities. Use the Monte Carlo section for likelihoods.</p>
        </details>
      </section>

      <?= $H('sensitivity') ?>
        <h3>What moves the IRR most</h3>
        <?= Charts::tornado($res['tornado'], $b['irr'], 'Tornado chart: IRR sensitivity to each assumption') ?>
        <h3>IRR by rent and price change</h3>
        <?php $mx = $res['matrix']; $tg = $v['target_irr_pct'] / 100; ?>
        <div class="tablewrap"><table class="heat"><thead><tr><th scope="col">Price change ↓ / Rent →</th><?php foreach ($mx['rent'] as $rs): ?><th scope="col"><?= e(Fmt::pct($rs, 0, true)) ?></th><?php endforeach; ?></tr></thead><tbody>
        <?php foreach ($mx['irr'] as $i => $row): ?><tr><th scope="row"><?= e(Fmt::pct($p['appreciation'] + $mx['app'][$i], 1)) ?>/yr</th><?php foreach ($row as $j => $irr):
            $cls = $irr === null || $irr < 0 ? 'h0' : ($irr < $tg * 0.5 ? 'h1' : ($irr < $tg ? 'h2' : ($irr < $tg * 1.5 ? 'h3' : 'h4')));
            $cls .= ($i === 2 && $j === 2) ? ' hbase' : ''; ?><td class="<?= $cls ?>"><?= e(Fmt::pct($irr)) ?></td><?php endforeach; ?></tr><?php endforeach; ?>
        </tbody></table></div>
        <p class="hint">Outlined cell = base case. Shading is relative to your <?= e($v['target_irr_pct']) ?>% target: darker red below zero, darker green above 1.5× target.</p>
      </section>

      <?= $H('montecarlo') ?>
        <?php if ($mc): ?>
        <div class="stats">
          <?= View::stat('Median IRR', $P($mc['irr_q']['0.5'])) ?>
          <?= View::stat('5th–95th pct', $P($mc['irr_q']['0.05']) . ' to ' . $P($mc['irr_q']['0.95'])) ?>
          <?= View::stat('P(IRR ≥ ' . $v['target_irr_pct'] . '%)', $P($mc['p_target'])) ?>
          <?= View::stat('P(loss)', $P($mc['p_loss']), '± ' . Fmt::pct(1.96 * $mc['p_loss_se']) . ' sampling error', $mc['p_loss'] > 0.2 ? 'neg' : '') ?>
          <?= View::stat('VaR 95%', $M(-$mc['var95']), 'Total profit, worst 5%') ?>
          <?= View::stat('CVaR 95%', $M(-$mc['cvar95']), 'Average of worst 5%') ?>
          <?= View::stat('P(any negative year)', $P($mc['p_negative_year']), 'Cash flow below zero') ?>
        </div>
        <?= Charts::histogram($mc['hist'], $mc['irr_q'], $v['target_irr_pct'] / 100, 'Histogram of simulated IRR') ?>
        <?= View::table(['Percentile', 'IRR', 'Total profit', 'Monthly cash flow yr 1'], array_map(static fn($k) => ['P' . (int) round($k * 100), Fmt::pct($mc['irr_q'][(string) $k]), Fmt::money($mc['profit_q'][(string) $k], $cur), Fmt::money($mc['cf1_q'][(string) $k], $cur)], [0.05, 0.25, 0.5, 0.75, 0.95])) ?>
        <details style="margin-top:10px"><summary class="small">Simulation settings & convergence</summary>
          <dl class="kv small">
            <dt>Runs / seed</dt><dd><?= number_format($mc['n']) ?> / <?= (int) $mc['seed'] ?> (re-running with the same seed reproduces these numbers exactly)</dd>
            <dt>Rent</dt><dd>Centred on <?= e($M($mc['u']['rent_mean'])) ?> (<?= e($mc['rent_source']) ?>), sd <?= e($M($mc['u']['rent_sd_abs'])) ?></dd>
            <dt>Price change</dt><dd><?= e($v['appreciation_pct']) ?>% ± <?= e($v['appreciation_sd_pts']) ?> pts per year (per-path average), correlated ρ=0.5 with rent growth (± <?= e($v['rent_growth_sd_pts']) ?> pts)</dd>
            <dt>Vacancy / costs</dt><dd>± <?= e($v['vacancy_sd_pts']) ?> pts · ± <?= e($v['opex_sd_pct']) ?>% (lognormal)</dd>
            <dt>Interest rate</dt><dd><?= $mc['u']['rate_sd'] > 0 ? '± ' . e($v['rate_sd_pts']) . ' pts (variable)' : 'Fixed — not varied' ?></dd>
            <dt>Convergence</dt><dd><?= e(implode(' → ', array_map(static fn($c) => 'n=' . $c['n'] . ': ' . Fmt::pct($c['p_target']), $mc['checkpoints']))) ?></dd>
            <dt>Undefined IRR paths</dt><dd><?= (int) $mc['irr_undefined'] ?> (cash flows never turned positive; counted as −100% or 0%)</dd>
          </dl>
        </details>
        <p class="hint">Simulated outcomes given your assumptions and ranges — not observed historical performance and not a prediction.</p>
        <?php else: ?><p class="muted">Simulation not run (no income and no price change to simulate).</p><?php endif; ?>
      </section>

      <?= $H('risk') ?>
        <?= '<div class="tablewrap"><table><thead><tr><th scope="col">Risk</th><th scope="col">Level</th><th scope="col">Basis</th></tr></thead><tbody>' . implode('', array_map(static fn($r) => '<tr><th scope="row">' . e($r['name']) . '</th><td>' . View::level($r['level']) . '</td><td>' . e($r['note']) . '</td></tr>', $res['risk'])) . '</tbody></table></div>' ?>
        <p class="hint">Levels are rule-based thresholds on your inputs (published in the methodology). "Not assessed" means we have no verified data — it is not the same as low risk.</p>
      </section>

      <?= $H('location') ?>
        <dl class="kv">
          <?php foreach (['rental_demand' => 'Rental demand evidence', 'transport' => 'Transport & amenities', 'new_supply' => 'Planned new supply', 'flood_risk' => 'Flood / climate exposure', 'country_risk' => 'Political / country risk'] as $lk => $ll): ?>
          <dt><?= e($ll) ?></dt><dd><?= $v[$lk] === 'unknown' ? '<span class="lvl lvl-na">○ Not assessed</span>' : e(ucfirst($v[$lk])) . ' <span class="muted small">(your assessment)</span>' ?></dd>
          <?php endforeach; ?>
        </dl>
        <div class="callout callout-info"><p><strong>Market fundamentals:</strong> no verified population, employment, price-index or rent-index dataset is integrated for <?= e(Countries::name($v['country'])) ?> in this version, so we do not show market statistics. <a href="<?= e(url('markets.php', ['c' => $v['country']])) ?>">See candidate official sources</a> or analyse a series you have in the <a href="<?= e(url('lab.php')) ?>">Market Lab</a>.</p></div>
      </section>

      <?= $H('regulatory') ?>
        <ul class="small">
          <li>Purchase taxes entered: <?= $prov['acq_tax_pct'] === 'missing' ? '<strong>none entered</strong> — many countries levy transfer or stamp duty' : e($v['acq_tax_pct']) . '% of price' ?>.</li>
          <li>Recurring property tax entered: <?= $prov['property_tax_annual'] === 'missing' ? '<strong>none entered</strong>' : e($M($v['property_tax_annual'])) . ' / year' ?>.</li>
          <li>Income tax on rent and tax on sale are <strong>not modelled</strong> — returns shown are pre-tax.</li>
          <li>Letting restrictions: <?= e($v['rent_restrictions'] === 'unknown' ? 'not checked' : $v['rent_restrictions']) ?><?= $v['rental_mode'] === 'short_term' ? ' — short-term letting is licensed or restricted in many cities' : '' ?>.</li>
          <?php if ($v['investor_currency'] !== '' && $v['investor_currency'] !== $cur): ?><li>Foreign-buyer rules, withholding taxes and capital repatriation may apply to cross-border investors.</li><?php endif; ?>
        </ul>
        <p class="hint">Tax and ownership rules differ by country, region and buyer status and change often. Confirm with a qualified local adviser.</p>
      </section>

      <?= $H('swot') ?>
        <div class="grid g2">
          <div class="card"><h3>Strengths</h3><?= $ck['strengths'] ? '<ul class="small">' . implode('', array_map(static fn($s) => '<li>' . e($s) . '</li>', $ck['strengths'])) . '</ul>' : '<p class="muted small">None identified from the inputs.</p>' ?></div>
          <div class="card"><h3>Weaknesses</h3><?= $ck['weaknesses'] ? '<ul class="small">' . implode('', array_map(static fn($s) => '<li>' . e($s) . '</li>', $ck['weaknesses'])) . '</ul>' : '<p class="muted small">None identified from the inputs.</p>' ?></div>
        </div>
        <h3 style="margin-top:14px">Key uncertainties</h3>
        <ul class="small">
          <?php foreach (array_slice($res['tornado'], 0, 3) as $t): ?><li><?= e($t['label']) ?> moves IRR between <?= e($P($t['low'])) ?> and <?= e($P($t['high'])) ?>.</li><?php endforeach; ?>
          <?php foreach ($ck['warnings'] as $w): ?><li><?= e($w) ?></li><?php endforeach; ?>
        </ul>
        <?php if ($ck['questions']): ?><h3>Questions to ask the seller or agent</h3><ul class="small"><?php foreach ($ck['questions'] as $q): ?><li><?= e($q) ?></li><?php endforeach; ?></ul><?php endif; ?>
      </section>

      <?= $H('missing') ?>
        <?php if ($ck['missing']): ?>
        <?= '<div class="tablewrap"><table><thead><tr><th scope="col">Input</th><th scope="col">Status</th><th scope="col">Why it matters</th></tr></thead><tbody>' . implode('', array_map(static fn($m) => '<tr><th scope="row">' . e($m['label']) . '</th><td>' . View::prov(!empty($m['default']) ? 'default' : 'missing') . '</td><td>' . e($m['why']) . '</td></tr>', $ck['missing'])) . '</tbody></table></div>' ?>
        <?php else: ?><p>No important inputs are missing.</p><?php endif; ?>
      </section>

      <?= $H('diligence') ?>
        <ul class="list-plain">
          <?php foreach ($ck['checklist'] as $c): ?><li><span class="lvl <?= $c['done'] ? 'lvl-ok' : 'lvl-na' ?>"><?= $c['done'] ? '☑ Done' : '☐ To do' ?></span> <strong><?= e($c['item']) ?></strong> — <span class="small"><?= e($c['detail']) ?></span></li><?php endforeach; ?>
        </ul>
      </section>

      <?= $H('suitability') ?>
        <?= Charts::radar(array_values($sc['dimensions']), 'Score dimensions radar') ?>
        <?= View::table(['Dimension', 'Score', 'Weight for ' . Inputs::OBJECTIVES[$v['objective']], 'How it is measured'], array_map(static fn($k, $d) => [$d[0], $d[1] === null ? 'Not rated' : (string) (int) round($d[1]), Fmt::pct($sc['weights'][$k], 0), $d[2]], array_keys($sc['dimensions']), $sc['dimensions'])) ?>
        <p class="small">Weighted score <?= $sc['raw'] !== null ? (int) round($sc['raw']) : '—' ?><?= $sc['gates'] ? ', capped to ' . (int) round($sc['overall']) . ' by constraints' : '' ?> → <strong><?= e($sc['band']) ?></strong>. Unrated dimensions are excluded and the weights re-normalised.</p>
        <h3>Suggested next steps</h3>
        <ol class="small"><?php foreach ($ck['next_steps'] as $s): ?><li><?= e($s) ?></li><?php endforeach; ?></ol>
      </section>

      <?= $H('inputs') ?>
        <?php
        $schema = Inputs::schema();
        $rowsIn = [];
        foreach ($schema as $k => $def) {
            if (!$showPrivate && !empty($def['private'])) {
                continue;
            }
            $val0 = $v[$k];
            if ($val0 === null || $val0 === '') {
                $disp = '—';
            } elseif ($def['type'] === 'select') {
                $disp = $def['options'][$val0] ?? $val0;
            } elseif ($def['type'] === 'money') {
                $disp = $M((float) $val0);
            } elseif ($def['type'] === 'percent') {
                $disp = $val0 . '%';
            } else {
                $disp = (string) $val0;
            }
            $rowsIn[] = '<tr><th scope="row">' . e($def['label']) . '</th><td>' . e($disp) . '</td><td>' . View::prov($prov[$k] ?? 'user') . '</td></tr>';
        }
        ?>
        <details><summary class="small">All <?= count($rowsIn) ?> inputs with provenance</summary>
          <div class="tablewrap"><table><thead><tr><th scope="col">Input</th><th scope="col">Value</th><th scope="col">Source</th></tr></thead><tbody><?= implode('', $rowsIn) ?></tbody></table></div>
        </details>
        <p class="hint"><?= View::prov('user') ?> entered by the report owner · <?= View::prov('default') ?> platform assumption (not market data) · <?= View::prov('derived') ?> calculated from other inputs · <?= View::prov('missing') ?> not provided.</p>
      </section>

      <?= $H('method') ?>
        <h3>Data confidence: <?= e($res['confidence']['band']) ?> (<?= (int) round($res['confidence']['total']) ?>/100)</h3>
        <?= View::table(['Component', 'Score', 'Weight', 'Basis'], array_map(static fn($c) => [$c[0], (string) (int) round($c[1]), Fmt::pct($c[2], 0), $c[3]], $res['confidence']['components'])) ?>
        <dl class="kv small" style="margin-top:12px">
          <dt>Models</dt><dd><?= e(implode(', ', $res['models'])) ?></dd>
          <dt>Engine</dt><dd><?= e($res['engine']) ?> · computed <?= e($res['computed_at']) ?><?= isset($res['runtime_ms']) ? ' in ' . (int) $res['runtime_ms'] . ' ms' : '' ?></dd>
          <dt>Data sources</dt><dd>Inputs and comparables supplied by the report owner. No third-party market data is used in this version.</dd>
          <dt>Freshness</dt><dd>Comparable ages as entered; FX rate dated <?= e($v['fx_date'] ?: 'n/a') ?>.</dd>
        </dl>
        <p class="small"><a href="<?= e(url('methodology.php')) ?>">Full methodology, formulas, scoring curves and model limitations →</a></p>
        <?php if ($versions && count($versions) > 1): ?>
        <h3>Version history</h3>
        <ul class="list-plain small"><?php foreach ($versions as $vr): ?><li><a href="<?= e(url('report.php', ['id' => $report['token'], 'v' => $vr['version']])) ?>">Version <?= (int) $vr['version'] ?></a> · <?= e($vr['created_at']) ?> UTC · <?= e($vr['note']) ?> · engine <?= e($vr['engine']) ?><?= (int) $vr['version'] === (int) $verRow['version'] ? ' <strong>(viewing)</strong>' : '' ?></li><?php endforeach; ?></ul>
        <?php endif; ?>
        <div class="callout"><p><strong>Limitations.</strong> Indicative analysis based on the inputs above. It is not financial, investment, tax, legal or valuation advice, and it does not guarantee any outcome. Property values and rents can fall. Verify every material assumption with qualified, regulated professionals in the relevant country before committing capital.</p></div>
      </section>

      <?php if ($owner && $report): ?>
      <form method="post" class="noprint" data-confirm="Delete this report and all its versions? This cannot be undone." style="margin:20px 0"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><button class="btn btn-sm btn-danger">Delete report</button></form>
      <?php endif; ?>
    </article>
  </div>
</div>
<?php require __DIR__ . '/views/footer.php';
