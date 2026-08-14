<?php
declare(strict_types=1);

session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
]);

require_once __DIR__ . '/includes/validate.php';
require_once __DIR__ . '/includes/scoring.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/mailer.php';

if (empty($_SESSION['answers'])) {
    header('Location: index.php');
    exit;
}

$answers = $_SESSION['answers'];

$errors = [];
$old = ['name' => '', 'phone' => '', 'email' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!rc_csrf_valid($_POST['csrf_token'] ?? null)) {
        $errors[] = 'Your session expired. Please try again.';
    } elseif (rc_is_spam((string) ($_POST['website'] ?? ''), $_POST['form_ts'] ?? null)) {
        $errors[] = 'We could not process that submission. Please try again.';
    } else {
        $old['name']  = rc_clean((string) ($_POST['name'] ?? ''));
        $old['phone'] = rc_clean((string) ($_POST['phone'] ?? ''));
        $old['email'] = rc_clean((string) ($_POST['email'] ?? ''));
        $consent      = !empty($_POST['consent']);

        if ($old['name'] === '' || strlen($old['name']) > 120) {
            $errors[] = 'Enter your full name.';
        }
        if (!rc_valid_phone($old['phone'])) {
            $errors[] = 'Enter a valid phone number.';
        }
        if (!rc_valid_email($old['email'])) {
            $errors[] = 'Enter a valid email address.';
        }
        if (!$consent) {
            $errors[] = 'Please confirm you agree to be contacted about your results.';
        }

        if (empty($errors)) {
            $results = rc_score($answers);

            try {
                $pdo = rc_db();
                $pdo->beginTransaction();

                $leadStmt = $pdo->prepare(
                    'INSERT INTO leads (name, phone, email, ip_address) VALUES (:name, :phone, :email, :ip)'
                );
                $leadStmt->execute([
                    ':name'  => $old['name'],
                    ':phone' => $old['phone'],
                    ':email' => $old['email'],
                    ':ip'    => $_SERVER['REMOTE_ADDR'] ?? '',
                ]);
                $leadId = (int) $pdo->lastInsertId();

                $topResults = array_map(static fn(array $r): string => $r['category'], $results);

                $submissionStmt = $pdo->prepare(
                    'INSERT INTO submissions
                        (lead_id, categories_selected, budget, goal, risk, timeline, market_type, region,
                         top_result_1, top_result_2, top_result_3)
                     VALUES
                        (:lead_id, :categories, :budget, :goal, :risk, :timeline, :market_type, :region,
                         :top1, :top2, :top3)'
                );
                $submissionStmt->execute([
                    ':lead_id'     => $leadId,
                    ':categories'  => implode(',', $answers['categories']),
                    ':budget'      => $answers['budget'],
                    ':goal'        => $answers['goal'],
                    ':risk'        => $answers['risk'],
                    ':timeline'    => $answers['timeline'],
                    ':market_type' => $answers['market_type'],
                    ':region'      => $answers['region'],
                    ':top1'        => $topResults[0] ?? null,
                    ':top2'        => $topResults[1] ?? null,
                    ':top3'        => $topResults[2] ?? null,
                ]);

                $pdo->commit();

                rc_notify_admin($old, $answers);

                $_SESSION['lead_id'] = $leadId;
                $_SESSION['results'] = $results;
                $_SESSION['contact'] = $old;

                header('Location: results.php');
                exit;
            } catch (PDOException $e) {
                if (isset($pdo) && $pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                $errors[] = 'We could not save your details right now. Please try again in a moment.';
            }
        }
    }
}

$page_title = 'Your Contact Details';
$current_step = 2;
$csrf_token = rc_csrf_token();
$form_ts = time();

require __DIR__ . '/includes/header.php';
?>
<div class="rc-hero">
  <h1>Almost there</h1>
  <p>Tell us where to send your personalized results — we'll match your answers to specific investment ideas next.</p>
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

  <form class="rc-form" method="post" action="step2.php" data-rc-form="contact" novalidate>
    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf_token, ENT_QUOTES) ?>">
    <input type="hidden" name="form_ts" value="<?= $form_ts ?>">
    <div class="rc-hp" aria-hidden="true">
      <label for="website">Leave this field blank</label>
      <input type="text" id="website" name="website" tabindex="-1" autocomplete="off">
    </div>

    <div class="rc-field">
      <label class="rc-label" for="name">Full name</label>
      <input type="text" id="name" name="name" maxlength="120" required autocomplete="name"
        value="<?= htmlspecialchars($old['name'], ENT_QUOTES) ?>">
    </div>

    <div class="rc-field">
      <label class="rc-label" for="phone">Phone number</label>
      <input type="tel" id="phone" name="phone" maxlength="30" required autocomplete="tel"
        value="<?= htmlspecialchars($old['phone'], ENT_QUOTES) ?>">
    </div>

    <div class="rc-field">
      <label class="rc-label" for="email">Email address</label>
      <input type="email" id="email" name="email" maxlength="160" required autocomplete="email"
        value="<?= htmlspecialchars($old['email'], ENT_QUOTES) ?>">
    </div>

    <label class="rc-consent">
      <input type="checkbox" id="consent" name="consent" value="1">
      <span>I agree to be contacted about my results.</span>
    </label>

    <div class="rc-actions">
      <a class="rc-btn rc-btn-secondary" href="index.php">← Back</a>
      <button type="submit" class="rc-btn">See My Results →</button>
    </div>
  </form>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>
