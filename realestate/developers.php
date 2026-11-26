<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Auth, Tools};

$page_title = 'API & embeds';
$page_desc = 'Embed free calculators with one line of code, or call the JSON API for full property evaluations.';
$canonical = abs_url('developers.php');
$ref = Auth::user()['ref_code'] ?? 'YOURCODE';
require __DIR__ . '/views/header.php';
$api = abs_url('api.php');
?>
<section><div class="wrap">
  <p class="eyebrow">Developers</p>
  <h1>Embeds & JSON API</h1>
  <h2>Embeddable calculators</h2>
  <p>Drop a placeholder and the loader anywhere on your page. The widget resizes automatically and is responsive.</p>
  <textarea class="embedcode" readonly id="snip"><div data-ss-widget="rental-yield-calculator" data-ref="<?= e($ref) ?>"></div>
<script async src="<?= e(abs_url('assets/embed.js')) ?>"></script></textarea>
  <button class="btn btn-sm btn-ghost" type="button" data-copy="#snip">Copy</button>
  <p class="small">Or use a plain iframe: <span class="mono"><?= e(abs_url('embed.php', ['t' => 'mortgage-calculator', 'ref' => $ref])) ?></span>. Options: <span class="mono">theme=light|dark</span>; <span class="mono">nobrand=1</span> (Professional and Enterprise partners only).</p>
  <div class="tablewrap"><table><thead><tr><th>Widget slug</th><th>Calculator</th></tr></thead><tbody>
  <?php foreach (Tools::all() as $s => $t): ?><tr><td class="mono"><?= e($s) ?></td><td><?= e($t['title']) ?></td></tr><?php endforeach; ?>
  </tbody></table></div>

  <h2 style="margin-top:28px">JSON API v1</h2>
  <p>Base URL <span class="mono"><?= e($api) ?></span>. Public endpoints are rate-limited per IP; <span class="mono">evaluate</span> requires an Enterprise API key in the <span class="mono">Authorization: Bearer</span> header.</p>
  <div class="tablewrap"><table><thead><tr><th>Method & path</th><th>Auth</th><th>Description</th></tr></thead><tbody>
    <tr><td class="mono">GET ?r=v1/health</td><td>None</td><td>Service status and engine version.</td></tr>
    <tr><td class="mono">GET ?r=v1/schema</td><td>None</td><td>Full input schema (fields, types, defaults, limits).</td></tr>
    <tr><td class="mono">GET ?r=v1/tools</td><td>None</td><td>List calculators and their fields.</td></tr>
    <tr><td class="mono">GET ?r=v1/tools/{slug}&amp;field=value…</td><td>None</td><td>Run a calculator.</td></tr>
    <tr><td class="mono">POST ?r=v1/evaluate</td><td>API key</td><td>Run a full evaluation. Body: JSON object of inputs (same keys as the schema, plus <span class="mono">comps</span> array).</td></tr>
    <tr><td class="mono">GET ?r=v1/reports/{token}</td><td>None</td><td>Latest version of a public or unlisted report (address and coordinates removed).</td></tr>
  </tbody></table></div>
  <h3 style="margin-top:16px">Example</h3>
  <pre class="card mono small" style="overflow-x:auto;white-space:pre">curl -X POST '<?= e($api) ?>?r=v1/evaluate' \
  -H 'Authorization: Bearer ss_…' -H 'Content-Type: application/json' \
  -d '{"country":"GB","currency":"GBP","asking_price":250000,"monthly_rent":1250,
       "interest_rate_pct":5.2,"area":70,"comps":[{"kind":"sale_txn","price":245000,"area":68,"months_ago":3}]}'</pre>
  <p class="small">Errors return <span class="mono">{"error": {...}}</span> with HTTP 400 (validation, field-level messages), 401, 404 or 429. Responses include <span class="mono">engine</span> and model versions; outputs are estimates with the same limitations as reports.</p>
  <p class="small">Data licensing: API output contains only calculations on the data you send. Redistribution of any third-party data you include is your responsibility.</p>
</div></section>
<?php require __DIR__ . '/views/footer.php';
