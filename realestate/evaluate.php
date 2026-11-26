<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Analysis, Auth, Countries, Db, Inputs, View, Settings};

$schema = Inputs::schema();
$errors = [];
$editing = null;
$values = [];

function report_owned(array $r): bool
{
    $uid = Auth::id();
    return ($uid && (int) $r['user_id'] === $uid) || (!$r['user_id'] && $r['guest_key'] && hash_equals((string) $r['guest_key'], (string) guest_key(false)));
}

if (!empty($_GET['edit'])) {
    $editing = Db::one('SELECT * FROM reports WHERE token = ?', [(string) $_GET['edit']]);
    if (!$editing || !report_owned($editing)) {
        render_error(404, 'Report not found, or you do not have permission to edit it.');
    }
    $ver = Db::one('SELECT inputs_json FROM report_versions WHERE report_id = ? ORDER BY version DESC LIMIT 1', [$editing['id']]);
    $values = json_decode($ver['inputs_json'], true) ?: [];
} else {
    // Quick-start prefill from GET (e.g. from a calculator): only known schema keys.
    foreach ($schema as $k => $def) {
        if (isset($_GET[$k]) && is_scalar($_GET[$k])) {
            $values[$k] = mb_substr((string) $_GET[$k], 0, 120);
        }
    }
}

if (is_post()) {
    csrf_check();
    $raw = $_POST;
    unset($raw['csrf']);
    $values = array_intersect_key($raw, $schema + ['comps' => 1]);
    if (!empty($_POST['website'])) {
        render_error(400, 'Submission rejected.');
    }
    $bucket = 'eval:' . (Auth::id() ? 'u' . Auth::id() : ip_hash());
    if (!rate_limit($bucket, Auth::id() ? 120 : 30, 3600)) {
        render_error(429, 'Too many evaluations in the last hour. Please wait and try again.');
    }
    [$v, $prov, $errors] = Inputs::normalise($values);
    $maxSims = (int) (Auth::user() ? Auth::entitlement('sims') : Settings::get('max_sims_free'));
    if ($v['sims'] > $maxSims) {
        $v['sims'] = $maxSims;
        $prov['sims'] = 'derived';
    }
    if (!$errors && !$editing && Auth::user()) {
        $count = (int) Db::val('SELECT COUNT(*) FROM reports WHERE user_id = ?', [Auth::id()]);
        if ($count >= (int) Auth::entitlement('reports')) {
            $errors['_'] = 'Your plan allows ' . Auth::entitlement('reports') . ' saved reports. Delete an old report or upgrade your plan.';
        }
    }
    if (!$errors) {
        $t0 = microtime(true);
        $res = Analysis::run($v, $prov);
        $res['provenance'] = $prov;
        $res['runtime_ms'] = (int) round((microtime(true) - $t0) * 1000);
        $title = trim(($v['subtype'] ?: Inputs::PROPERTY_TYPES[$v['property_type']]) . ($v['city'] ? ' · ' . $v['city'] : '') . ' · ' . Countries::name($v['country']));
        $now = Db::now();
        $inputsJson = json_encode($values, JSON_UNESCAPED_UNICODE);
        $resultJson = json_encode($res, JSON_PARTIAL_OUTPUT_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION);
        if ($editing) {
            $ver = (int) $editing['current_version'] + 1;
            Db::insert('report_versions', ['report_id' => $editing['id'], 'version' => $ver, 'inputs_json' => $inputsJson, 'result_json' => $resultJson, 'engine' => Analysis::VERSION, 'note' => mb_substr(trim((string) ($_POST['version_note'] ?? 'Inputs edited')), 0, 200) ?: 'Inputs edited', 'created_at' => $now]);
            Db::update('reports', ['current_version' => $ver, 'title' => mb_substr($title, 0, 160), 'country' => $v['country'], 'city' => $v['city'], 'property_type' => $v['property_type'], 'currency' => $v['currency'], 'updated_at' => $now], 'id = ?', [$editing['id']]);
            $token = $editing['token'];
            track('report_updated', ['v' => $ver]);
        } else {
            $token = bin2hex(random_bytes(12));
            $rid = Db::insert('reports', [
                'token' => $token, 'user_id' => Auth::id(), 'guest_key' => Auth::id() ? null : guest_key(), 'title' => mb_substr($title, 0, 160),
                'country' => $v['country'], 'city' => $v['city'], 'property_type' => $v['property_type'], 'currency' => $v['currency'],
                'visibility' => 'private', 'current_version' => 1, 'ref_code' => current_ref(), 'created_at' => $now, 'updated_at' => $now,
            ]);
            Db::insert('report_versions', ['report_id' => $rid, 'version' => 1, 'inputs_json' => $inputsJson, 'result_json' => $resultJson, 'engine' => Analysis::VERSION, 'note' => 'Initial evaluation', 'created_at' => $now]);
            track('evaluation_completed', ['country' => $v['country'], 'type' => $v['property_type'], 'ms' => $res['runtime_ms'], 'guest' => Auth::id() ? 0 : 1]);
        }
        redirect('report.php', ['id' => $token]);
    }
    flash('Please fix the highlighted fields.', 'err');
}

$countryMap = [];
foreach (Countries::LIST as $iso => $c) {
    $countryMap[$iso] = [$c[1], $c[2]];
}
$page_title = $editing ? 'Edit evaluation' : 'Evaluate a property';
$page_desc = 'Run a full property investment evaluation: valuation evidence, cash flow, IRR, NPV, Monte Carlo simulation, scenarios and risk — free, no sign-up.';
$canonical = abs_url('evaluate.php');
track($editing ? 'evaluate_edit_view' : 'evaluate_view');
require __DIR__ . '/views/header.php';
$comps = $values['comps'] ?? [];
$compRows = max(4, count(is_array($comps) ? $comps : []));
?>
<section>
  <div class="wrap">
    <p class="eyebrow">Property evaluation</p>
    <h1><?= $editing ? 'Edit: ' . e($editing['title']) : 'Evaluate a property' ?></h1>
    <p class="lead">Fill in what you know. Required fields are marked <span class="req">*</span>. Anything you leave blank either uses a clearly labelled default assumption or is reported as missing — never silently invented.</p>
    <?php if (!empty($errors['_'])): ?><div class="flash flash-err"><?= e($errors['_']) ?></div><?php endif; ?>
    <?php if (!Auth::user()): ?><div class="callout callout-info"><p>You can run this as a guest — the report is saved privately to this browser. <a href="<?= e(url('register.php')) ?>">Create a free account</a> to keep it, share it and track the property.</p></div><?php endif; ?>

    <form id="evalform" method="post" action="<?= e(url('evaluate.php', ['edit' => $editing['token'] ?? null])) ?>" novalidate data-fresh="<?= $editing || is_post() || $values ? '0' : '1' ?>" data-countries="<?= e(json_encode($countryMap)) ?>">
      <?= csrf_field() ?>
      <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
      <?php foreach (Inputs::SECTIONS as $sec => [$name, $desc]):
          $open = in_array($sec, ['A', 'B', 'C', 'D'], true) || array_intersect_key($errors, array_filter($schema, static fn($d) => $d['section'] === $sec));
      ?>
      <details class="fs" <?= $open ? 'open' : '' ?>>
        <summary><span><?= e($sec . '. ' . $name) ?> <span class="muted small" style="font-weight:400">— <?= e($desc) ?></span></span></summary>
        <div class="fs-body">
          <div class="fgrid">
            <?php foreach ($schema as $k => $def) {
                if ($def['section'] !== $sec) {
                    continue;
                }
                $val = $values[$k] ?? '';
                if ($val === '' && $def['type'] === 'select' && $def['default'] !== null) {
                    $val = $def['default'];
                }
                echo View::field($def, $val, $errors[$k] ?? null);
            } ?>
          </div>
          <?php if ($sec === 'B'): ?>
          <h3 style="margin-top:10px">Comparable properties <span class="muted small" style="font-weight:400">— optional, but needed for a fair-value estimate</span></h3>
          <p class="hint">Enter sales (completed transactions are best) and rents for similar nearby properties, in the same currency and area unit. Record where each came from. Rents are monthly.</p>
          <div class="tablewrap">
            <table id="comps" class="comps-table">
              <thead><tr><th>Type</th><th>Price / rent</th><th>Area</th><th>Beds</th><th>Age (yrs)</th><th>Months ago</th><th>Distance km</th><th>Condition vs subject</th><th>Source</th></tr></thead>
              <tbody>
              <?php for ($i = 0; $i < $compRows; $i++): $c = $comps[$i] ?? []; ?>
                <tr>
                  <td><select name="comps[<?= $i ?>][kind]" aria-label="Comparable <?= $i + 1 ?> type"><?php foreach (Inputs::COMP_KINDS as $ck => $cl): ?><option value="<?= e($ck) ?>"<?= ($c['kind'] ?? '') === $ck ? ' selected' : '' ?>><?= e($cl) ?></option><?php endforeach; ?></select></td>
                  <?php foreach (['price', 'area', 'bedrooms', 'age', 'months_ago', 'distance_km'] as $ff): ?>
                  <td><input type="text" inputmode="decimal" name="comps[<?= $i ?>][<?= $ff ?>]" value="<?= e($c[$ff] ?? '') ?>" aria-label="Comparable <?= $i + 1 ?> <?= e(str_replace('_', ' ', $ff)) ?>"></td>
                  <?php endforeach; ?>
                  <td><select name="comps[<?= $i ?>][condition]" aria-label="Comparable <?= $i + 1 ?> condition"><?php foreach (['0' => 'Similar', '-1' => 'Worse', '1' => 'Better'] as $cv => $cl): ?><option value="<?= $cv ?>"<?= (string) ($c['condition'] ?? '0') === (string) $cv ? ' selected' : '' ?>><?= $cl ?></option><?php endforeach; ?></select></td>
                  <td><input type="text" name="comps[<?= $i ?>][source]" value="<?= e($c['source'] ?? '') ?>" maxlength="120" aria-label="Comparable <?= $i + 1 ?> source"></td>
                </tr>
              <?php endfor; ?>
              </tbody>
            </table>
          </div>
          <p><button type="button" class="btn btn-ghost btn-sm" id="addcomp">+ Add row</button></p>
          <?php endif; ?>
        </div>
      </details>
      <?php endforeach; ?>
      <?php if ($editing): ?>
      <div class="field"><label for="vnote">What changed? (saved in version history)</label><input id="vnote" type="text" name="version_note" maxlength="200" placeholder="e.g. Updated rent after agent call"></div>
      <?php endif; ?>
      <div class="formbar">
        <div class="btn-row">
          <button class="btn" type="submit"><?= $editing ? 'Re-run evaluation (new version)' : 'Run evaluation' ?></button>
          <span id="savestate" class="savestate" aria-live="polite"></span>
        </div>
        <p class="hint">By running an evaluation you accept that results are indicative estimates, not advice. <a href="<?= e(url('methodology.php')) ?>">How it works</a>.</p>
      </div>
    </form>
  </div>
</section>
<?php require __DIR__ . '/views/footer.php';
