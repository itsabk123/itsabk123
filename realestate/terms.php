<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
$page_title = 'Terms & disclosures';
$canonical = abs_url('terms.php');
require __DIR__ . '/views/header.php';
?>
<section><div class="wrap article">
  <h1>Terms &amp; disclosures (staging draft)</h1>
  <div class="callout"><p>Draft for the staging build — requires legal review per jurisdiction, including rules on financial promotions, real estate advertising, brokerage, valuation and referral compensation.</p></div>
  <h2>Not advice</h2>
  <p>Shelter and Sense provides analytical decision-support tools. Outputs are estimates based on the information you provide and published assumptions. They are not financial, investment, tax, legal or valuation advice, are not a regulated valuation, and do not guarantee any return, price or outcome. Property values and rents can fall as well as rise.</p>
  <h2>Your inputs</h2>
  <p>You are responsible for the accuracy of the data you enter, and for having the right to use any third-party data (such as comparables) you include. Do not upload personal data of tenants or other third parties unless you are entitled to.</p>
  <h2>Marketplace</h2>
  <p>Shelter and Sense is not a party to any transaction, does not act as a broker or agent, and does not verify listings unless explicitly labelled. Listers must be the owner or authorised to market a property and must comply with local advertising and licensing rules.</p>
  <h2>Sponsored content, advertising and affiliates</h2>
  <p>Sponsored listings and content are labelled. Affiliate links are disclosed. Paid relationships never alter calculations, scores, or methodology.</p>
  <h2>Acceptable use</h2>
  <p>No scraping, abuse of rate limits, fraudulent referrals or misleading listings. We may suspend accounts that breach these terms.</p>
</div></section>
<?php require __DIR__ . '/views/footer.php';
