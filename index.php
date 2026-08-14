<?php
declare(strict_types=1);

session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
]);

require_once __DIR__ . '/includes/validate.php';
require_once __DIR__ . '/includes/scoring.php';

$errors = [];
$old = [
    'categories'  => [],
    'budget'      => '',
    'goal'        => '',
    'risk'        => '',
    'timeline'    => '',
    'market_type' => '',
    'region'      => '',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!rc_csrf_valid($_POST['csrf_token'] ?? null)) {
        $errors[] = 'Your session expired. Please try again.';
    } elseif (rc_is_spam((string) ($_POST['website'] ?? ''), $_POST['form_ts'] ?? null)) {
        $errors[] = 'We could not process that submission. Please try again.';
    } else {
        $old['categories']  = array_values(array_intersect(
            (array) ($_POST['categories'] ?? []),
            array_keys(rc_category_labels())
        ));
        $old['budget']      = rc_clean((string) ($_POST['budget'] ?? ''));
        $old['goal']        = rc_clean((string) ($_POST['goal'] ?? ''));
        $old['risk']        = rc_clean((string) ($_POST['risk'] ?? ''));
        $old['timeline']    = rc_clean((string) ($_POST['timeline'] ?? ''));
        $old['market_type'] = rc_clean((string) ($_POST['market_type'] ?? ''));
        $old['region']      = rc_clean((string) ($_POST['region'] ?? ''));

        if (empty($old['categories'])) {
            $errors[] = 'Pick at least one investment type.';
        }
        if (!array_key_exists($old['budget'], rc_budget_options())) {
            $errors[] = 'Choose a budget range.';
        }
        if (!array_key_exists($old['goal'], rc_goal_options())) {
            $errors[] = 'Choose your primary goal.';
        }
        if (!array_key_exists($old['risk'], rc_risk_options())) {
            $errors[] = 'Choose your risk tolerance.';
        }
        if (!array_key_exists($old['timeline'], rc_timeline_options())) {
            $errors[] = 'Choose a timeline.';
        }
        if (!array_key_exists($old['market_type'], rc_market_options())) {
            $errors[] = 'Choose a preferred market type.';
        }
        if (strlen($old['region']) > 120) {
            $errors[] = 'Region must be under 120 characters.';
        }

        if (empty($errors)) {
            $_SESSION['answers'] = $old;
            unset($_SESSION['lead_id'], $_SESSION['results']);
            header('Location: step2.php');
            exit;
        }
    }
}

$page_title = 'Find Your Investment';
$current_step = 1;
$csrf_token = rc_csrf_token();
$form_ts = time();

require __DIR__ . '/includes/header.php';
?>
<div class="rc-hero">
  <h1>Find where to put your next real estate dollar.</h1>
  <p>Answer a few questions about your budget, goals, and timeline. We'll match you to the investment types that fit — residential, commercial, rental, flips, and more.</p>
</div>

<div class="rc-card">
  <?php if (!empty($errors)): ?>
  <div class="rc-error">
    <ul style="margin:0;padding-left:1.1rem;">
      <?php foreach ($errors as $error): ?>
        <li><?= htmlspecialchars($error, ENT_QUOTES) ?></li>
      <?php endforeach; ?>
    </ul>
  </div>
  <?php endif; ?>

  <form class="rc-form" method="post" action="index.php" data-rc-form="preferences" novalidate>
    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf_token, ENT_QUOTES) ?>">
    <input type="hidden" name="form_ts" value="<?= $form_ts ?>">
    <div class="rc-hp" aria-hidden="true">
      <label for="website">Leave this field blank</label>
      <input type="text" id="website" name="website" tabindex="-1" autocomplete="off">
    </div>

    <fieldset>
      <legend>What are you interested in?</legend>
      <p class="rc-hint">Choose one or more.</p>
      <div class="rc-choice-group" data-rc-group="categories">
        <?php foreach (rc_category_labels() as $value => $label): ?>
        <label class="rc-choice">
          <input type="checkbox" name="categories[]" value="<?= htmlspecialchars($value, ENT_QUOTES) ?>"
            <?= in_array($value, $old['categories'], true) ? 'checked' : '' ?>>
          <span><?= htmlspecialchars($label, ENT_QUOTES) ?></span>
        </label>
        <?php endforeach; ?>
      </div>
    </fieldset>

    <div class="rc-field">
      <label class="rc-label" for="budget">Budget range</label>
      <select id="budget" name="budget" required>
        <option value="">Select a budget range</option>
        <?php foreach (rc_budget_options() as $value => $label): ?>
        <option value="<?= htmlspecialchars($value, ENT_QUOTES) ?>" <?= $old['budget'] === $value ? 'selected' : '' ?>>
          <?= htmlspecialchars($label, ENT_QUOTES) ?>
        </option>
        <?php endforeach; ?>
      </select>
    </div>

    <fieldset>
      <legend>Primary goal</legend>
      <div class="rc-choice-group">
        <?php foreach (rc_goal_options() as $value => $label): ?>
        <label class="rc-choice">
          <input type="radio" name="goal" value="<?= htmlspecialchars($value, ENT_QUOTES) ?>"
            <?= $old['goal'] === $value ? 'checked' : '' ?> required>
          <span><?= htmlspecialchars($label, ENT_QUOTES) ?></span>
        </label>
        <?php endforeach; ?>
      </div>
    </fieldset>

    <fieldset>
      <legend>Risk tolerance</legend>
      <div class="rc-choice-group">
        <?php foreach (rc_risk_options() as $value => $label): ?>
        <label class="rc-choice">
          <input type="radio" name="risk" value="<?= htmlspecialchars($value, ENT_QUOTES) ?>"
            <?= $old['risk'] === $value ? 'checked' : '' ?> required>
          <span><?= htmlspecialchars($label, ENT_QUOTES) ?></span>
        </label>
        <?php endforeach; ?>
      </div>
    </fieldset>

    <div class="rc-field">
      <label class="rc-label" for="timeline">Timeline</label>
      <select id="timeline" name="timeline" required>
        <option value="">Select a timeline</option>
        <?php foreach (rc_timeline_options() as $value => $label): ?>
        <option value="<?= htmlspecialchars($value, ENT_QUOTES) ?>" <?= $old['timeline'] === $value ? 'selected' : '' ?>>
          <?= htmlspecialchars($label, ENT_QUOTES) ?>
        </option>
        <?php endforeach; ?>
      </select>
    </div>

    <fieldset>
      <legend>Preferred market type</legend>
      <div class="rc-choice-group">
        <?php foreach (rc_market_options() as $value => $label): ?>
        <label class="rc-choice">
          <input type="radio" name="market_type" value="<?= htmlspecialchars($value, ENT_QUOTES) ?>"
            <?= $old['market_type'] === $value ? 'checked' : '' ?> required>
          <span><?= htmlspecialchars($label, ENT_QUOTES) ?></span>
        </label>
        <?php endforeach; ?>
      </div>
    </fieldset>

    <div class="rc-field">
      <label class="rc-label" for="region">Region <span style="font-weight:400;color:var(--ink-faint);">(optional)</span></label>
      <input type="text" id="region" name="region" maxlength="120" placeholder="e.g. Austin, TX"
        value="<?= htmlspecialchars($old['region'], ENT_QUOTES) ?>">
    </div>

    <div class="rc-actions">
      <span></span>
      <button type="submit" class="rc-btn">Find My Investment →</button>
    </div>
  </form>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>
