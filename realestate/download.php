<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

use SS\{Auth, Db};

$u = Auth::require();
$d = Db::one('SELECT * FROM documents WHERE id = ?', [(int) ($_GET['id'] ?? 0)]);
if (!$d || ((int) $d['user_id'] !== (int) $u['id'] && !Auth::can('admin.moderate'))) {
    render_error(404, 'Document not found.');
}
$path = SS_ROOT . '/data/uploads/' . basename($d['stored_name']);
if (!is_file($path)) {
    render_error(404, 'File missing.');
}
audit('document.download', 'doc:' . $d['id']);
header('Content-Type: ' . $d['mime']);
header('Content-Length: ' . filesize($path));
header('Content-Disposition: attachment; filename="' . str_replace('"', '', $d['filename']) . '"');
header("Content-Security-Policy: default-src 'none'; sandbox");
readfile($path);
