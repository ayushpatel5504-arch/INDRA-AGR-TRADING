<?php
declare(strict_types=1);

/**
 * Secure CLI-only Super Admin Initializer
 * Run via: php database/setup_admin.php
 * Never expose this script over HTTP.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI execution only.');
}

require_once __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__));
$dotenv->safeLoad();

$dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
    $_ENV['DB_HOST'] ?? '127.0.0.1',
    $_ENV['DB_PORT'] ?? '3306',
    $_ENV['DB_DATABASE'] ?? 'indra_agr_portal'
);

$pdo = new PDO($dsn, $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

echo "=== INDRA AGR TRADING PVT. LTD. — Super Admin Setup ===\n";
echo "Full Name: ";
$fullName = trim((string) fgets(STDIN));
echo "Admin Email: ";
$email = strtolower(trim((string) fgets(STDIN)));
echo "Password (min 12 chars): ";
$password = trim((string) fgets(STDIN));

if ($fullName === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 12) {
    fwrite(STDERR, "Error: Provide a valid name, email, and password of at least 12 characters.\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_ARGON2ID);

$stmt = $pdo->prepare(
    'INSERT INTO admins (full_name, email, password_hash, role, is_active)
     VALUES (:full_name, :email, :password_hash, "super_admin", 1)
     ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash), is_active = 1'
);
$stmt->execute([
    ':full_name' => $fullName,
    ':email' => $email,
    ':password_hash' => $hash,
]);

echo "Super Admin account configured successfully for {$email}.\n";
