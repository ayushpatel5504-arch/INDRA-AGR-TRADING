<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__));
$dotenv->safeLoad();

date_default_timezone_set($_ENV['APP_TIMEZONE'] ?? 'Asia/Kolkata');

ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Lax');
if (($_ENV['SESSION_COOKIE_SECURE'] ?? 'false') === 'true') {
    ini_set('session.cookie_secure', '1');
}

session_start();
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$basePath = rtrim((string) parse_url($_ENV['APP_URL'] ?? '', PHP_URL_PATH), '/');
if ($basePath !== '' && str_starts_with($uri, $basePath)) {
    $uri = substr($uri, strlen($basePath)) ?: '/';
}

// Payment & Webhook Routes
$paymentController = new App\Controllers\PaymentController();
$adminPaymentController = new App\Controllers\AdminPaymentController();

switch ($uri) {
    case '/api/payment/create-order':
        $paymentController->createOrder();
        exit;
    case '/api/payment/verify':
        $paymentController->verifyPayment();
        exit;
    case '/webhooks/payment':
        $paymentController->handleWebhook();
        exit;
    case '/payment/receipt/download':
        $paymentController->downloadReceipt();
        exit;
    case '/admin/payments/export':
        $adminPaymentController->exportCsv();
        exit;
    case '/admin/payments/refund':
        $adminPaymentController->initiateRefund();
        exit;
    case '/admin/payment-settings/save':
        $adminPaymentController->savePaymentSettings();
        exit;
    case '/apply/payment':
        $draftToken = (string) ($_SESSION['application_draft_token'] ?? '');
        if ($draftToken === '') {
            header('Location: /apply');
            exit;
        }
        $pdo = App\Helpers\Database::connection();
        $stmt = $pdo->prepare('SELECT d.*, j.title AS job_title FROM application_drafts d JOIN jobs j ON j.id = d.job_id WHERE d.draft_token = :t LIMIT 1');
        $stmt->execute([':t' => $draftToken]);
        $draftRow = $stmt->fetch();
        if (!$draftRow) {
            header('Location: /apply');
            exit;
        }
        $payload = json_decode((string) $draftRow['payload_json'], true) ?: [];
        $draft = array_merge($payload, ['job_title' => $draftRow['job_title']]);
        $settings = App\Helpers\Database::getWebsiteSettings($pdo);
        $csrfToken = (string) $_SESSION['csrf_token'];
        require __DIR__ . '/../app/views/application/payment_summary.php';
        exit;
    case '/payment/success':
        $appNo = trim((string) ($_GET['app'] ?? ($_SESSION['last_verified_application_number'] ?? '')));
        $isOwner = $appNo !== '' && hash_equals((string) ($_SESSION['last_verified_application_number'] ?? ''), $appNo);
        if (!$isOwner && empty($_SESSION['admin_id'])) {
            http_response_code(403);
            exit('Unauthorized payment confirmation access.');
        }
        $pdo = App\Helpers\Database::connection();
        $stmt = $pdo->prepare(
            "SELECT pt.*, a.application_number, ap.full_name AS candidate_name, j.title AS job_title
             FROM payment_transactions pt
             JOIN applications a ON a.id = pt.application_id
             JOIN applicants ap ON ap.id = a.applicant_id
             JOIN jobs j ON j.id = a.job_id
             WHERE a.application_number = :app AND pt.payment_status = 'success'
             LIMIT 1"
        );
        $stmt->execute([':app' => $appNo]);
        $record = $stmt->fetch();
        if (!$record) {
            http_response_code(404);
            exit('Verified payment record not found.');
        }
        require __DIR__ . '/../app/views/application/payment_success.php';
        exit;
    case '/payment/failure':
        require __DIR__ . '/../app/views/application/payment_failure.php';
        exit;
    case '/admin/payments':
        $data = $adminPaymentController->listPayments();
        $transactions = $data['transactions'];
        $stats = $data['stats'];
        $csrfToken = (string) $_SESSION['csrf_token'];
        require __DIR__ . '/../app/views/admin/payments.php';
        exit;
    case '/admin/payment-settings':
        if (empty($_SESSION['admin_id'])) {
            http_response_code(403);
            exit('Unauthorized admin access.');
        }
        $pdo = App\Helpers\Database::connection();
        $settings = App\Helpers\Database::getWebsiteSettings($pdo);
        $csrfToken = (string) $_SESSION['csrf_token'];
        require __DIR__ . '/../app/views/admin/payment_settings.php';
        exit;
}

http_response_code(200);
header('Content-Type: text/html; charset=UTF-8');
echo '<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>INDRA AGR TRADING PVT. LTD.</title></head><body>';
echo '<h1>INDRA AGR TRADING PVT. LTD.</h1><p>Front controller active for route: ' . htmlspecialchars($uri, ENT_QUOTES, 'UTF-8') . '</p>';
echo '</body></html>';
