<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

function rc_mail_domain(): string
{
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return preg_replace('/:\d+$/', '', $host) ?? 'localhost';
}

/**
 * Notify the site owner about a new lead. Uses PHP's built-in mail() so no
 * Composer/SMTP library is required on shared hosting; swap in PHPMailer
 * here later if a host's mail() delivery proves unreliable.
 */
function rc_notify_admin(array $lead, array $answers): bool
{
    $subject = SITE_NAME . ': new lead — ' . $lead['name'];

    $lines = [
        'New lead submitted on ' . SITE_NAME,
        '',
        'Name: ' . $lead['name'],
        'Phone: ' . $lead['phone'],
        'Email: ' . $lead['email'],
        '',
        'Interested in: ' . implode(', ', array_map(
            static fn(string $c): string => rc_category_labels()[$c] ?? $c,
            $answers['categories'] ?? []
        )),
        'Budget: ' . (rc_budget_options()[$answers['budget']] ?? $answers['budget']),
        'Goal: ' . (rc_goal_options()[$answers['goal']] ?? $answers['goal']),
        'Risk tolerance: ' . (rc_risk_options()[$answers['risk']] ?? $answers['risk']),
        'Timeline: ' . (rc_timeline_options()[$answers['timeline']] ?? $answers['timeline']),
        'Preferred market: ' . (rc_market_options()[$answers['market_type']] ?? $answers['market_type']),
        'Region: ' . ($answers['region'] !== '' ? $answers['region'] : 'not specified'),
    ];

    $body = implode("\n", $lines);
    $headers = 'From: ' . SITE_NAME . ' <no-reply@' . rc_mail_domain() . ">\r\n"
        . 'Reply-To: ' . $lead['email'];

    return @mail(NOTIFY_EMAIL, $subject, $body, $headers);
}
