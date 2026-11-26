<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
$page_title = 'Privacy';
$canonical = abs_url('privacy.php');
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap article">
  <h1>Privacy notice (staging draft)</h1>
  <div class="callout"><p>Draft for the staging build. It must be reviewed by a qualified privacy lawyer for each operating market (e.g. GDPR/UK GDPR, UAE PDPL, Saudi PDPL, CCPA) before production launch.</p></div>
  <h2>What we collect</h2>
  <ul><li><strong>Account data:</strong> name, email, hashed password, role, optional brand and licence details.</li>
  <li><strong>Analysis data:</strong> property inputs, comparables, reports and documents you upload.</li>
  <li><strong>Enquiries:</strong> contact details you choose to send to a lister, with your consent.</li>
  <li><strong>Usage analytics:</strong> first-party events (e.g. "calculator used") with a pseudonymous session hash. We do not store raw IP addresses — only a keyed hash used for rate limiting, abuse prevention and referral de-duplication.</li></ul>
  <h2>Cookies</h2>
  <p>Essential only: a session cookie, a guest key that lets you see reports you created before signing up, and a referral cookie (30 days) when you arrive through a partner link. No third-party advertising or analytics cookies. The evaluation form saves an unsent draft in your browser's local storage, which never leaves your device until you submit.</p>
  <h2>Sharing</h2>
  <p>Reports are private by default. If you make one public or unlisted, its contents (except street address and coordinates) are visible to anyone with the link. Your investment preferences are never shown to sellers or agents. Listers see your details only when you send them an enquiry and tick the consent box.</p>
  <h2>Your rights</h2>
  <p>From Account &amp; security you can download all your data as JSON and permanently delete your account. Contact us for any other request.</p>
  <h2>Security</h2>
  <p>Passwords are hashed, sessions are HTTP-only and SameSite, every form is CSRF-protected, optional two-factor authentication is available, and uploaded documents are stored outside the public web path with access checks.</p>
</div></section>
<?php require __DIR__ . '/views/footer.php';
