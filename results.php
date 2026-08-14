<?php
declare(strict_types=1);

session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
]);

require_once __DIR__ . '/includes/scoring.php';

if (empty($_SESSION['results']) || empty($_SESSION['contact'])) {
    header('Location: index.php');
    exit;
}

$results = $_SESSION['results'];
$contact = $_SESSION['contact'];

if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['start_over'] ?? '') === '1') {
    session_unset();
    session_destroy();
    header('Location: index.php');
    exit;
}

$page_title = 'Your Results';
$current_step = 3;

$reportBody = "Hi " . $contact['name'] . ",\n\nYour top RealtyCompass matches:\n";
foreach ($results as $r) {
    $reportBody .= "- " . $r['label'] . ": " . $r['next_action'] . "\n";
}
$mailtoHref = 'mailto:' . rawurlencode($contact['email'])
    . '?subject=' . rawurlencode('Your RealtyCompass results')
    . '&body=' . rawurlencode($reportBody);

require __DIR__ . '/includes/header.php';
?>
<div class="rc-results-intro">
  <h1>Your top investment matches</h1>
  <p>Based on your budget, goals, risk tolerance, and timeline.</p>
</div>

<?php if (empty($results)): ?>
<div class="rc-empty">
  <p>Your answers didn't point clearly toward one category — that usually means a mixed strategy fits best. Consider talking to a local advisor about a blended residential/rental approach.</p>
</div>
<?php else: ?>
  <?php foreach ($results as $i => $r): ?>
  <div class="rc-result-card">
    <div class="rc-result-rank">Match <?= $i + 1 ?></div>
    <h2><?= htmlspecialchars($r['label'], ENT_QUOTES) ?></h2>
    <p class="rc-desc"><?= htmlspecialchars($r['description'], ENT_QUOTES) ?></p>
    <?php if (!empty($r['reasons'])): ?>
    <ul class="rc-why">
      <?php foreach ($r['reasons'] as $reason): ?>
        <li><?= htmlspecialchars(ucfirst($reason), ENT_QUOTES) ?></li>
      <?php endforeach; ?>
    </ul>
    <?php endif; ?>
    <div class="rc-next-action"><?= htmlspecialchars($r['next_action'], ENT_QUOTES) ?></div>
  </div>
  <?php endforeach; ?>
<?php endif; ?>

<div class="rc-results-actions">
  <a class="rc-btn" href="<?= htmlspecialchars($mailtoHref, ENT_QUOTES) ?>">Email Me This Report</a>
  <a class="rc-btn rc-btn-secondary" href="results.php?start_over=1">Start Over</a>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>
