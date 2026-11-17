<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Database;
use App\Helpers\PaymentGateway;
use PDO;

final class AdminPaymentController
{
    private function requireAdmin(): void
    {
        if (empty($_SESSION['admin_id'])) {
            http_response_code(403);
            exit('Unauthorized admin access.');
        }
    }

    public function listPayments(): array
    {
        $this->requireAdmin();
        $pdo = Database::connection();

        $search = trim((string) ($_GET['q'] ?? ''));
        $status = trim((string) ($_GET['status'] ?? ''));

        $where = ['1=1'];
        $params = [];

        if ($search !== '') {
            $where[] = '(pt.gateway_payment_id LIKE :q OR pt.payment_order_id LIKE :q OR a.application_number LIKE :q)';
            $params[':q'] = '%' . $search . '%';
        }
        if (in_array($status, ['created', 'pending', 'processing', 'success', 'failed', 'cancelled', 'refunded'], true)) {
            $where[] = 'pt.payment_status = :st';
            $params[':st'] = $status;
        }

        $sql = 'SELECT pt.*, a.application_number, ap.full_name AS candidate_name, j.title AS job_title
                FROM payment_transactions pt
                LEFT JOIN applications a ON a.id = pt.application_id
                LEFT JOIN applicants ap ON ap.id = a.applicant_id
                LEFT JOIN jobs j ON j.id = a.job_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY pt.created_at DESC LIMIT 200';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $stats = $pdo->query(
            "SELECT
              SUM(CASE WHEN payment_status = 'success' THEN 1 ELSE 0 END) AS total_success,
              SUM(CASE WHEN payment_status IN ('created', 'pending', 'processing') THEN 1 ELSE 0 END) AS total_pending,
              SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) AS total_failed,
              COALESCE(SUM(CASE WHEN payment_status = 'success' THEN amount ELSE 0 END), 0) AS total_collected_paise
             FROM payment_transactions"
        )->fetch();

        return [
            'transactions' => $stmt->fetchAll(),
            'stats' => $stats,
        ];
    }

    public function exportCsv(): void
    {
        $this->requireAdmin();
        $data = $this->listPayments();

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="indra-agr-payments-' . date('Y-m-d') . '.csv"');

        $out = fopen('php://output', 'w');
        fputcsv($out, [
            'Receipt No', 'Application No', 'Candidate', 'Gateway', 'Order ID', 'Payment ID',
            'UPI Reference', 'Amount (INR)', 'Currency', 'Status', 'Refund Status', 'Paid At (IST)',
        ]);
        foreach ($data['transactions'] as $row) {
            fputcsv($out, [
                $row['receipt_number'] ?? '',
                $row['application_number'] ?? '',
                $row['candidate_name'] ?? '',
                $row['gateway_provider'],
                $row['payment_order_id'],
                $row['gateway_payment_id'] ?? '',
                $row['transaction_reference'] ?? '',
                number_format(((int) $row['amount']) / 100, 2, '.', ''),
                $row['currency'],
                $row['payment_status'],
                $row['refund_status'],
                $row['paid_at'] ?? '',
            ]);
        }
        fclose($out);
    }

    public function initiateRefund(): void
    {
        $this->requireAdmin();
        header('Content-Type: application/json; charset=UTF-8');

        $csrf = (string) ($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
        if (!hash_equals((string) ($_SESSION['csrf_token'] ?? ''), $csrf)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Invalid CSRF token.']);
            return;
        }

        $txId = (int) ($_POST['payment_transaction_id'] ?? 0);
        $reason = trim((string) ($_POST['reason'] ?? 'Authorized administrative refund'));
        $pdo = Database::connection();

        $stmt = $pdo->prepare("SELECT * FROM payment_transactions WHERE id = :id AND payment_status = 'success' LIMIT 1");
        $stmt->execute([':id' => $txId]);
        $tx = $stmt->fetch();

        if (!$tx || empty($tx['gateway_payment_id'])) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'Eligible verified successful transaction not found.']);
            return;
        }

        $settings = Database::getWebsiteSettings($pdo);
        $config = PaymentGateway::getConfig($settings);

        $res = PaymentGateway::initiateRefund(
            $config,
            (string) $tx['gateway_payment_id'],
            (string) $tx['payment_order_id'],
            (int) $tx['amount'],
            $reason
        );

        $pdo->prepare(
            "UPDATE payment_transactions
             SET refund_status = :rs, refund_id = :rid, refund_amount = :ramt, refund_reason = :rreas,
                 refund_requested_at = NOW(),
                 refunded_at = CASE WHEN :rs2 = 'Refunded' THEN NOW() ELSE refunded_at END,
                 payment_status = CASE WHEN :rs3 = 'Refunded' THEN 'refunded' ELSE payment_status END
             WHERE id = :id"
        )->execute([
            ':rs' => $res['refund_status'],
            ':rs2' => $res['refund_status'],
            ':rs3' => $res['refund_status'],
            ':rid' => $res['refund_id'] ?? null,
            ':ramt' => $tx['amount'],
            ':rreas' => $reason,
            ':id' => $txId,
        ]);

        $pdo->prepare(
            'INSERT INTO payment_audit_logs (payment_transaction_id, actor_type, actor_id, action, details, ip_address)
             VALUES (:tx, "admin", :aid, "refund_initiated", :dt, :ip)'
        )->execute([
            ':tx' => $txId,
            ':aid' => (string) $_SESSION['admin_id'],
            ':dt' => 'Refund API result: ' . $res['refund_status'],
            ':ip' => $_SERVER['REMOTE_ADDR'] ?? null,
        ]);

        echo json_encode($res);
    }

    public function savePaymentSettings(): void
    {
        $this->requireAdmin();
        $csrf = (string) ($_POST['csrf_token'] ?? '');
        if (!hash_equals((string) ($_SESSION['csrf_token'] ?? ''), $csrf)) {
            http_response_code(403);
            exit('Invalid CSRF token.');
        }

        $feeInr = (float) ($_POST['application_fee_inr'] ?? 0);
        $feePaise = max(0, (int) round($feeInr * 100));

        $updates = [
            'payment_gateway_provider' => in_array($_POST['payment_gateway_provider'] ?? '', ['razorpay', 'cashfree'], true)
                ? $_POST['payment_gateway_provider']
                : 'razorpay',
            'payment_gateway_enabled' => !empty($_POST['payment_gateway_enabled']) ? '1' : '0',
            'payment_gateway_mode' => ($_POST['payment_gateway_mode'] ?? 'test') === 'live' ? 'live' : 'test',
            'application_fee_paise' => (string) $feePaise,
            'payment_currency' => 'INR',
            'payment_description' => trim((string) ($_POST['payment_description'] ?? '')),
            'payment_instructions' => trim((string) ($_POST['payment_instructions'] ?? '')),
            'refund_policy' => trim((string) ($_POST['refund_policy'] ?? '')),
            'payment_receipt_prefix' => preg_replace('/[^A-Z0-9\-]/', '', strtoupper((string) ($_POST['payment_receipt_prefix'] ?? 'INDRA-REC'))) ?: 'INDRA-REC',
        ];

        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'INSERT INTO website_settings (setting_key, setting_value) VALUES (:k, :v)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
        );
        foreach ($updates as $k => $v) {
            $stmt->execute([':k' => $k, ':v' => $v]);
        }

        header('Location: /admin/payment-settings?saved=1');
    }
}
