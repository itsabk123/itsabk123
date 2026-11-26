<?php
/**
 * @var string|null $page_title
 * @var string|null $page_desc
 * @var string|null $canonical  absolute URL
 * @var array|null  $jsonld     list of JSON-LD objects
 * @var array|null  $og         ['title','description','type']
 */
use SS\{Auth, View, Db};
$u = Auth::user();
$page_title = $page_title ?? 'Shelter and Sense';
$page_desc = $page_desc ?? 'Global real estate investment intelligence: evaluate properties with transparent cash-flow, valuation, simulation and risk analysis.';
$cur = basename($_SERVER['SCRIPT_NAME'] ?? 'index.php');
$unread = $u ? (int) Db::val('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL', [$u['id']]) : 0;
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($page_title === 'Shelter and Sense' ? 'Shelter and Sense — Real Estate Investment Intelligence' : $page_title . ' · Shelter and Sense') ?></title>
<meta name="description" content="<?= e($page_desc) ?>">
<?php if (cfg('NOINDEX') || !empty($noindex)): ?><meta name="robots" content="noindex, nofollow"><?php endif; ?>
<?php if (!empty($canonical)): ?><link rel="canonical" href="<?= e($canonical) ?>"><?php endif; ?>
<meta property="og:site_name" content="Shelter and Sense">
<meta property="og:title" content="<?= e($og['title'] ?? $page_title) ?>">
<meta property="og:description" content="<?= e($og['description'] ?? $page_desc) ?>">
<meta property="og:type" content="<?= e($og['type'] ?? 'website') ?>">
<?php if (!empty($canonical)): ?><meta property="og:url" content="<?= e($canonical) ?>"><?php endif; ?>
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#1f3a2e">
<link rel="icon" href="<?= e(url('assets/icon.svg')) ?>" type="image/svg+xml">
<link rel="stylesheet" href="<?= e(url('assets/app.css')) ?>?v=<?= e(SS_VERSION) ?>">
<?php foreach (($jsonld ?? []) as $ld): ?>
<script type="application/ld+json"><?= json_encode($ld, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?></script>
<?php endforeach; ?>
</head>
<body class="<?= e($body_class ?? '') ?>">
<a class="skip" href="#main">Skip to content</a>
<?php if (cfg('ENVIRONMENT') !== 'production'): ?>
<div class="envbar">v3 staging build <?= e(SS_VERSION) ?> — test data only. Not indexed by search engines.</div>
<?php endif; ?>
<header class="top">
  <div class="wrap top-in">
    <a class="brand" href="<?= e(url('index.php')) ?>" aria-label="Shelter and Sense home">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><path class="brand-roof" d="M4 15 16 5l12 10"/><path class="brand-wall" d="M8 13v13h16V13"/><path class="brand-bar" d="M12 22v-4M16 22v-7M20 22v-9"/></svg>
      <span>Shelter <em>and</em> Sense</span>
    </a>
    <button class="navtoggle" type="button" aria-expanded="false" aria-controls="mainnav">Menu</button>
    <nav id="mainnav" class="nav" aria-label="Main">
      <ul>
        <?php foreach (View::NAV as [$href, $label]): ?>
        <li><a href="<?= e(url($href)) ?>"<?= $cur === $href ? ' aria-current="page"' : '' ?>><?= e($label) ?></a></li>
        <?php endforeach; ?>
      </ul>
      <div class="nav-acct">
        <?php if ($u): ?>
          <a href="<?= e(url('dashboard.php')) ?>" class="btn btn-sm btn-ghost">Dashboard<?= $unread ? ' <span class="dot" aria-label="' . $unread . ' unread">' . $unread . '</span>' : '' ?></a>
          <?php if (Auth::can('admin.moderate')): ?><a href="<?= e(url('admin.php')) ?>" class="btn btn-sm btn-ghost">Admin</a><?php endif; ?>
          <form method="post" action="<?= e(url('logout.php')) ?>" class="inline"><?= csrf_field() ?><button class="btn btn-sm btn-link" type="submit">Log out</button></form>
        <?php else: ?>
          <a href="<?= e(url('login.php')) ?>" class="btn btn-sm btn-ghost">Log in</a>
          <a href="<?= e(url('register.php')) ?>" class="btn btn-sm">Sign up</a>
        <?php endif; ?>
      </div>
    </nav>
  </div>
</header>
<main id="main">
<?php foreach (flash() as [$kind, $msg]): ?>
<div class="wrap"><div class="flash flash-<?= e($kind) ?>" role="status"><?= e($msg) ?></div></div>
<?php endforeach; ?>
