<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if (is_post()) {
    csrf_check();
    \SS\Auth::logout();
    flash('You have been logged out.', 'ok');
}
redirect('index.php');
