</main>
<footer class="foot">
  <div class="wrap foot-grid">
    <div>
      <p class="brand-sm">Shelter <em>and</em> Sense</p>
      <p class="muted">Analytical decision support for property investors. Not financial, legal, tax or valuation advice, and no guarantee of future performance. Verify every assumption with qualified local professionals.</p>
    </div>
    <div>
      <h2 class="foot-h">Analyse</h2>
      <ul><li><a href="<?= e(url('evaluate.php')) ?>">Evaluate a property</a></li><li><a href="<?= e(url('tools.php')) ?>">Free calculators</a></li><li><a href="<?= e(url('lab.php')) ?>">Market Lab</a></li><li><a href="<?= e(url('report.php', ['sample' => 1])) ?>">Example report</a></li></ul>
    </div>
    <div>
      <h2 class="foot-h">Platform</h2>
      <ul><li><a href="<?= e(url('marketplace.php')) ?>">Marketplace</a></li><li><a href="<?= e(url('reports.php')) ?>">Public reports</a></li><li><a href="<?= e(url('partners.php')) ?>">Creators &amp; affiliates</a></li><li><a href="<?= e(url('developers.php')) ?>">API &amp; embeds</a></li></ul>
    </div>
    <div>
      <h2 class="foot-h">Trust</h2>
      <ul><li><a href="<?= e(url('methodology.php')) ?>">Methodology &amp; models</a></li><li><a href="<?= e(url('markets.php')) ?>">Data coverage</a></li><li><a href="<?= e(url('privacy.php')) ?>">Privacy</a></li><li><a href="<?= e(url('terms.php')) ?>">Terms &amp; disclosures</a></li></ul>
    </div>
  </div>
  <div class="wrap foot-bottom muted">© <?= gmdate('Y') ?> Shelter and Sense · Engine <?= e(\SS\Analysis::VERSION) ?> · Build <?= e(SS_VERSION) ?></div>
</footer>
<script src="<?= e(url('assets/app.js')) ?>?v=<?= e(SS_VERSION) ?>"></script>
</body>
</html>
