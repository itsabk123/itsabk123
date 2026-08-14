<?php
declare(strict_types=1);

function rc_clean(string $value): string
{
    return trim(strip_tags($value));
}

function rc_valid_email(string $email): bool
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function rc_valid_phone(string $phone): bool
{
    $digits = preg_replace('/[^0-9]/', '', $phone);
    return preg_match('/^[0-9+\-\s().]{7,20}$/', $phone) === 1
        && strlen($digits) >= 7
        && strlen($digits) <= 15;
}

function rc_csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function rc_csrf_valid(?string $token): bool
{
    return !empty($_SESSION['csrf_token']) && !empty($token)
        && hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * True when a submission looks like spam: the honeypot field was filled in
 * (a real visitor never sees or fills it), or the form was submitted faster
 * than a human could plausibly complete it.
 */
function rc_is_spam(string $honeypot, ?string $formRenderedAt): bool
{
    if (rc_clean($honeypot) !== '') {
        return true;
    }

    $renderedAt = (int) $formRenderedAt;
    if ($renderedAt <= 0) {
        return true;
    }

    return (time() - $renderedAt) < 2;
}
