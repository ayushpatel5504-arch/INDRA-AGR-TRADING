<?php
declare(strict_types=1);

/**
 * Initial Verified Company Data Seeder (Directors & Editable Placeholders)
 * Run via: php database/seeders/InitialSeeder.php
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI execution only.');
}

require_once __DIR__ . '/../../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__, 2));
$dotenv->safeLoad();

$dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
    $_ENV['DB_HOST'] ?? '127.0.0.1',
    $_ENV['DB_PORT'] ?? '3306',
    $_ENV['DB_DATABASE'] ?? 'indra_agr_portal'
);

$pdo = new PDO($dsn, $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);

$directors = [
    ['Manish Kumar', 'Director', 'Guiding strategic agricultural trading partnerships and sustainable farmer-to-enterprise networks.', 1],
    ['Indra Kumar', 'Director', 'Leading operational integrity, quality governance, and long-term business growth initiatives.', 2],
];

$stmt = $pdo->prepare(
    'INSERT INTO directors (full_name, designation, bio, display_order, is_active)
     SELECT ?, ?, ?, ?, 1 FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM directors WHERE full_name = ?)'
);

foreach ($directors as [$name, $role, $bio, $order]) {
    $stmt->execute([$name, $role, $bio, $order, $name]);
}

$settings = [
    'company_name' => 'INDRA AGR TRADING PVT. LTD.',
    'tagline' => 'Connecting Farmers, Growing Businesses.',
    'values' => 'Quality | Trust | Growth',
    'office_address' => '[Editable Placeholder: Add verified registered office address in Admin Settings]',
    'contact_email' => '[Editable Placeholder: Add verified official email in Admin Settings]',
    'contact_phone' => '[Editable Placeholder: Add verified official phone number in Admin Settings]',
    'recruitment_fee_notice' => 'Application fees, where authorized by INDRA AGR TRADING PVT. LTD., are collected exclusively through the official UPI payment gateway inside this portal.',

    // Configurable Payment Gateway Settings (never hardcode an invented fee)
    'payment_gateway_enabled' => '0',
    'payment_gateway_provider' => 'razorpay',
    'payment_gateway_mode' => 'test',
    'application_fee_paise' => '0',
    'payment_currency' => 'INR',
    'payment_description' => 'Job Application Processing Fee - INDRA AGR TRADING PVT. LTD.',
    'payment_instructions' => 'Complete payment exclusively via the official UPI QR Code or UPI App inside the gateway checkout. Do not transfer funds to any personal UPI ID.',
    'refund_policy' => 'Application fees paid via the official gateway are subject to company recruitment refund rules. For duplicate debits or technical failures, contact official recruitment support with your Order ID and Payment ID.',
    'payment_receipt_prefix' => 'INDRA-REC',
];

$settingStmt = $pdo->prepare(
    'INSERT INTO website_settings (setting_key, setting_value)
     VALUES (:k, :v)
     ON DUPLICATE KEY UPDATE setting_value = setting_value'
);
foreach ($settings as $k => $v) {
    $settingStmt->execute([':k' => $k, ':v' => $v]);
}

echo "Initial verified directors, website settings, and configurable payment placeholders seeded.\n";
