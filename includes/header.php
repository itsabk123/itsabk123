<?php
/**
 * @var string $page_title
 * @var int    $current_step  1, 2, or 3 — omit/0 to hide the step indicator
 */
$current_step = $current_step ?? 0;
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= htmlspecialchars($page_title ?? 'RealtyCompass', ENT_QUOTES) ?> · RealtyCompass</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="rc-shell">
  <header class="rc-topbar">
    <a class="rc-brand" href="index.php">RealtyCompass</a>
  </header>

  <?php if ($current_step > 0): ?>
  <ol class="rc-steps" aria-label="Progress">
    <?php
    $rc_step_labels = [1 => 'Preferences', 2 => 'Contact', 3 => 'Results'];
    foreach ($rc_step_labels as $rc_num => $rc_label):
        $rc_state = $rc_num < $current_step ? 'done' : ($rc_num === $current_step ? 'active' : 'upcoming');
    ?>
    <li class="rc-step rc-step--<?= $rc_state ?>">
      <span class="rc-step-num"><?= $rc_num < $current_step ? '✓' : $rc_num ?></span>
      <span class="rc-step-label"><?= htmlspecialchars($rc_label, ENT_QUOTES) ?></span>
    </li>
    <?php endforeach; ?>
  </ol>
  <?php endif; ?>

  <main class="rc-main">
