<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Database;
use App\Helpers\Mailer;
use App\Helpers\PaymentGateway;
use App\Helpers\PdfGenerator;
use PDO;
use Throwable;

final class PaymentController
{
    public function createOrder(): void
    {
        header('Content-Type: application/json; charset=UTF-8');

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed.']);
            return;
        }

        $csrf = $_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        if (!hash_equals((string) ($_SESSION['csrf_token'] ?? ''), (string) $csrf)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Invalid CSRF token.']);
            return;
        }

        $draftToken = (string) ($_SESSION['application_draft_token'] ?? '');
        if ($draftToken === '') {
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'Application session expired. Please review your form.']);
            return;
        }

        $pdo = Database::connection();

        try {
            $stmt = $pdo->prepare('SELECT * FROM application_drafts WHERE draft_token = :t LIMIT 1');
            $stmt->execute([':t' => $draftToken]);
            $draft = $stmt->fetch();

            if (!$draft) {
                http_response_code(404);
                echo json_encode(['ok' => false, 'error' => 'Application draft not found.']);
                return;
            }

            if ((int) $draft['mobile_verified'] !== 1 || (int) $draft['email_verified'] !== 1) {
                http_response_code(422);
                echo json_encode(['ok' => false, 'error' => 'Mobile and Email OTP verifications are required before payment.']);
                return;
            }

            if ($draft['status'] === 'submitted' || $draft['final_application_id'] !== null) {
                http_response_code(409);
                echo json_encode(['ok' => false, 'error' => 'Application has already been paid and submitted.']);
                return;
            }

            // Prevent duplicate paid transaction for the same draft
            $paidStmt = $pdo->prepare(
                "SELECT id FROM payment_transactions WHERE draft_id = :d AND payment_status = 'success' LIMIT 1"
            );
            $paidStmt->execute([':d' => $draft['id']]);
            if ($paidStmt->fetch()) {
                http_response_code(409);
                echo json_encode(['ok' => false, 'error' => 'Payment already verified for this application.']);
                return;
            }

            $settings = Database::getWebsiteSettings($pdo);
            $config = PaymentGateway::getConfig($settings);
            $amountPaise = (int) ($settings['application_fee_paise'] ?? 0);
            $currency = (string) ($settings['payment_currency'] ?? 'INR');
            $description = (string) ($settings['payment_description'] ?? 'Job Application Processing Fee - INDRA AGR TRADING PVT. LTD.');

            $payload = json_decode((string) $draft['payload_json'], true, 512, JSON_THROW_ON_ERROR);

            $order = PaymentGateway::createOrder(
                $config,
                $amountPaise,
                $currency,
                $draftToken,
                [
                    'full_name' => $payload['full_name'] ?? '',
                    'email_address' => $draft['email_address'],
                    'mobile_number' => $draft['mobile_number'],
                ],
                $description
            );

            $insert = $pdo->prepare(
                'INSERT INTO payment_transactions
                 (draft_id, gateway_provider, gateway_mode, payment_order_id, amount, currency, payment_status, gateway_response)
                 VALUES (:draft_id, :provider, :mode, :order_id, :amount, :currency, "created", :raw)'
            );
            $insert->execute([
                ':draft_id' => $draft['id'],
                ':provider' => $order['provider'],
                ':mode' => $order['mode'],
                ':order_id' => $order['order_id'],
                ':amount' => $order['amount_paise'],
                ':currency' => $order['currency'],
                ':raw' => json_encode($order['raw'], JSON_THROW_ON_ERROR),
            ]);

            $txId = (int) $pdo->lastInsertId();
            $pdo->prepare("UPDATE application_drafts SET status = 'payment_pending' WHERE id = :id")
                ->execute([':id' => $draft['id']]);

            $this->audit($pdo, $txId, 'candidate', $draftToken, 'order_created', 'Gateway order ' . $order['order_id']);

            echo json_encode([
                'ok' => true,
                'provider' => $order['provider'],
                'mode' => $order['mode'],
                'order_id' => $order['order_id'],
                'key_id' => $order['key_id'] ?? null,
                'payment_session_id' => $order['payment_session_id'] ?? null,
                'amount' => $order['amount_paise'],
                'currency' => $order['currency'],
                'description' => $description,
                'prefill' => [
                    'name' => $payload['full_name'] ?? '',
                    'email' => $draft['email_address'],
                    'contact' => $draft['mobile_number'],
                ],
            ]);
        } catch (Throwable $e) {
            error_log('[Payment Order Error] ' . $e->getMessage());
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
        }
    }

    public function verifyPayment(): void
    {
        header('Content-Type: application/json; charset=UTF-8');

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed.']);
            return;
        }

        $input = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $csrf = (string) ($input['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
        if (!hash_equals((string) ($_SESSION['csrf_token'] ?? ''), $csrf)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Invalid CSRF token.']);
            return;
        }

        $orderId = trim((string) ($input['payment_order_id'] ?? ''));
        $paymentId = trim((string) ($input['gateway_payment_id'] ?? ''));
        $signature = trim((string) ($input['gateway_signature'] ?? ''));

        if ($orderId === '') {
            http_response_code(422);
            echo json_encode(['ok' => false, 'error' => 'Missing payment order ID.']);
            return;
        }

        $pdo = Database::connection();
        $settings = Database::getWebsiteSettings($pdo);
        $config = PaymentGateway::getConfig($settings);

        try {
            $txStmt = $pdo->prepare('SELECT * FROM payment_transactions WHERE payment_order_id = :o LIMIT 1');
            $txStmt->execute([':o' => $orderId]);
            $tx = $txStmt->fetch();

            if (!$tx) {
                http_response_code(404);
                echo json_encode(['ok' => false, 'error' => 'Payment order not found.']);
                return;
            }

            // Idempotency: already finalized
            if ($tx['payment_status'] === 'success' && $tx['application_id'] !== null) {
                $appStmt = $pdo->prepare('SELECT application_number FROM applications WHERE id = :id');
                $appStmt->execute([':id' => $tx['application_id']]);
                echo json_encode([
                    'ok' => true,
                    'status' => 'success',
                    'application_number' => $appStmt->fetchColumn(),
                    'receipt_number' => $tx['receipt_number'],
                    'gateway_payment_id' => $tx['gateway_payment_id'],
                    'payment_order_id' => $tx['payment_order_id'],
                ]);
                return;
            }

            $verify = PaymentGateway::verifyCheckoutPayment(
                $config,
                $orderId,
                $paymentId,
                $signature,
                (int) $tx['amount'],
                (string) $tx['currency']
            );

            if (!$verify['ok']) {
                $newStatus = $verify['status'] === 'failed' ? 'failed' : 'pending';
                $pdo->prepare(
                    'UPDATE payment_transactions SET payment_status = :st, failure_reason = :err, gateway_response = :raw WHERE id = :id'
                )->execute([
                    ':st' => $newStatus,
                    ':err' => $verify['error'] ?? 'Verification incomplete',
                    ':raw' => json_encode($verify['raw'] ?? [], JSON_THROW_ON_ERROR),
                    ':id' => $tx['id'],
                ]);
                $this->audit($pdo, (int) $tx['id'], 'system', $orderId, 'verification_' . $newStatus, (string) ($verify['error'] ?? ''));

                http_response_code($newStatus === 'failed' ? 422 : 202);
                echo json_encode([
                    'ok' => false,
                    'status' => $newStatus,
                    'error' => $verify['error'] ?? 'Payment verification pending.',
                    'payment_order_id' => $orderId,
                ]);
                return;
            }

            $final = $this->finalizeSuccessfulPayment(
                $pdo,
                (int) $tx['id'],
                (string) $verify['gateway_payment_id'],
                $signature,
                (string) ($verify['payment_method'] ?? 'upi'),
                $verify['transaction_reference'] ?? null,
                $verify['raw'] ?? [],
                $settings
            );

            echo json_encode([
                'ok' => true,
                'status' => 'success',
                'application_number' => $final['application_number'],
                'receipt_number' => $final['receipt_number'],
                'gateway_payment_id' => $verify['gateway_payment_id'],
                'payment_order_id' => $orderId,
            ]);
        } catch (Throwable $e) {
            error_log('[Payment Verify Error] ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Unable to verify payment right now.']);
        }
    }

    public function handleWebhook(): void
    {
        header('Content-Type: application/json; charset=UTF-8');
        $rawBody = (string) file_get_contents('php://input');
        $headers = function_exists('getallheaders') ? getallheaders() : [];

        $pdo = Database::connection();
        $settings = Database::getWebsiteSettings($pdo);
        $config = PaymentGateway::getConfig($settings);

        $sigValid = PaymentGateway::verifyWebhookSignature($config, $rawBody, $headers);
        $data = json_decode($rawBody, true);
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Invalid JSON payload.']);
            return;
        }

        $eventType = (string) ($data['event'] ?? ($data['type'] ?? 'unknown'));
        $eventId = (string) (
            $headers['X-Razorpay-Event-Id']
            ?? $headers['x-razorpay-event-id']
            ?? ($data['event_id'] ?? hash('sha256', $rawBody))
        );

        $orderId = $data['payload']['payment']['entity']['order_id']
            ?? $data['data']['order']['order_id']
            ?? null;

        // Idempotent webhook event insert
        try {
            $evStmt = $pdo->prepare(
                'INSERT INTO payment_webhook_events (gateway_provider, event_id, event_type, payment_order_id, signature_valid, payload_json)
                 VALUES (:p, :eid, :et, :oid, :sv, :raw)'
            );
            $evStmt->execute([
                ':p' => $config['provider'],
                ':eid' => $eventId,
                ':et' => $eventType,
                ':oid' => $orderId,
                ':sv' => $sigValid ? 1 : 0,
                ':raw' => $rawBody,
            ]);
        } catch (Throwable $dup) {
            // Duplicate webhook already recorded
            http_response_code(200);
            echo json_encode(['ok' => true, 'duplicate' => true]);
            return;
        }

        if (!$sigValid) {
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'Invalid webhook signature.']);
            return;
        }

        if (!$orderId) {
            http_response_code(200);
            echo json_encode(['ok' => true]);
            return;
        }

        $txStmt = $pdo->prepare('SELECT * FROM payment_transactions WHERE payment_order_id = :o LIMIT 1');
        $txStmt->execute([':o' => $orderId]);
        $tx = $txStmt->fetch();

        if ($tx && ($eventType === 'payment.captured' || $eventType === 'PAYMENT_SUCCESS_WEBHOOK')) {
            $paymentEntity = $data['payload']['payment']['entity'] ?? ($data['data']['payment'] ?? []);
            $gwPayId = (string) ($paymentEntity['id'] ?? ($paymentEntity['cf_payment_id'] ?? ''));
            $amount = $config['provider'] === 'cashfree'
                ? (int) round(((float) ($paymentEntity['payment_amount'] ?? 0)) * 100)
                : (int) ($paymentEntity['amount'] ?? 0);
            $currency = (string) ($paymentEntity['currency'] ?? ($paymentEntity['payment_currency'] ?? 'INR'));

            if ($amount === (int) $tx['amount'] && $currency === (string) $tx['currency'] && $gwPayId !== '') {
                $utr = $paymentEntity['acquirer_data']['rrn']
                    ?? $paymentEntity['bank_reference']
                    ?? null;
                $this->finalizeSuccessfulPayment(
                    $pdo,
                    (int) $tx['id'],
                    $gwPayId,
                    (string) ($tx['gateway_signature'] ?? ''),
                    'upi',
                    $utr ? (string) $utr : null,
                    $data,
                    $settings
                );
            }
        } elseif ($tx && ($eventType === 'payment.failed' || $eventType === 'PAYMENT_FAILED_WEBHOOK')) {
            if ($tx['payment_status'] !== 'success') {
                $pdo->prepare("UPDATE payment_transactions SET payment_status = 'failed', failure_reason = 'Gateway reported payment failed via webhook' WHERE id = :id")
                    ->execute([':id' => $tx['id']]);
            }
        }

        $pdo->prepare('UPDATE payment_webhook_events SET processed_at = NOW() WHERE gateway_provider = :p AND event_id = :eid')
            ->execute([':p' => $config['provider'], ':eid' => $eventId]);

        echo json_encode(['ok' => true]);
    }

    private function finalizeSuccessfulPayment(
        PDO $pdo,
        int $txId,
        string $gatewayPaymentId,
        string $signature,
        string $paymentMethod,
        ?string $transactionRef,
        array $gatewayRaw,
        array $settings
    ): array {
        $pdo->beginTransaction();
        try {
            $txLock = $pdo->prepare('SELECT * FROM payment_transactions WHERE id = :id FOR UPDATE');
            $txLock->execute([':id' => $txId]);
            $tx = $txLock->fetch();

            if (!$tx) {
                throw new \RuntimeException('Payment transaction missing.');
            }

            if ($tx['payment_status'] === 'success' && $tx['application_id'] !== null) {
                $appStmt = $pdo->prepare('SELECT application_number FROM applications WHERE id = :id');
                $appStmt->execute([':id' => $tx['application_id']]);
                $pdo->commit();
                return [
                    'application_number' => (string) $appStmt->fetchColumn(),
                    'receipt_number' => (string) $tx['receipt_number'],
                ];
            }

            $draftLock = $pdo->prepare('SELECT * FROM application_drafts WHERE id = :id FOR UPDATE');
            $draftLock->execute([':id' => $tx['draft_id']]);
            $draft = $draftLock->fetch();
            if (!$draft) {
                throw new \RuntimeException('Application draft missing.');
            }

            $payload = json_decode((string) $draft['payload_json'], true, 512, JSON_THROW_ON_ERROR);
            $year = (int) date('Y');
            $appNumber = Database::nextApplicationNumber($pdo, $year);
            $receiptNumber = Database::nextReceiptNumber(
                $pdo,
                $year,
                (string) ($settings['payment_receipt_prefix'] ?? 'INDRA-REC')
            );

            // Upsert Applicant
            $appcantStmt = $pdo->prepare(
                'INSERT INTO applicants (full_name, father_name, date_of_birth, gender, nationality, mobile_number, email_address, permanent_address, district, state, pin_code)
                 VALUES (:fn, :fan, :dob, :gen, :nat, :mob, :em, :addr, :dist, :st, :pin)
                 ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), full_name = VALUES(full_name), permanent_address = VALUES(permanent_address)'
            );
            $appcantStmt->execute([
                ':fn' => $payload['full_name'],
                ':fan' => $payload['father_name'] ?? null,
                ':dob' => $payload['date_of_birth'],
                ':gen' => $payload['gender'] ?? null,
                ':nat' => $payload['nationality'] ?? 'Indian',
                ':mob' => $draft['mobile_number'],
                ':em' => $draft['email_address'],
                ':addr' => $payload['permanent_address'],
                ':dist' => $payload['district'],
                ':st' => $payload['state'],
                ':pin' => $payload['pin_code'],
            ]);
            $applicantId = (int) $pdo->lastInsertId();

            $nowIst = date('Y-m-d H:i:s');
            $appInsert = $pdo->prepare(
                'INSERT INTO applications
                 (application_number, applicant_id, job_id, preferred_location, experience_level, expected_salary,
                  mobile_verified, mobile_verified_at, email_verified, email_verified_at,
                  declaration_accepted, privacy_consent_accepted, payment_transaction_id, fee_amount_paise, status, submitted_at)
                 VALUES (:appno, :aid, :jid, :loc, :exp, :sal, 1, :mva, 1, :eva, 1, 1, :ptx, :fee, "Submitted", :sub)'
            );
            $appInsert->execute([
                ':appno' => $appNumber,
                ':aid' => $applicantId,
                ':jid' => $draft['job_id'],
                ':loc' => $payload['preferred_location'],
                ':exp' => $payload['experience_level'] ?? 'Fresher',
                ':sal' => $payload['expected_salary'] ?? null,
                ':mva' => $nowIst,
                ':eva' => $nowIst,
                ':ptx' => $tx['id'],
                ':fee' => $tx['amount'],
                ':sub' => $nowIst,
            ]);
            $applicationId = (int) $pdo->lastInsertId();

            // Education
            $pdo->prepare(
                'INSERT INTO education_details
                 (application_id, tenth_board, tenth_passing_year, tenth_roll_number, tenth_marks_obtained, tenth_total_marks,
                  twelfth_board, twelfth_passing_year, twelfth_roll_number, twelfth_marks_obtained, twelfth_total_marks,
                  highest_qualification, additional_qualifications, computer_skills)
                 VALUES (:aid, :tb, :ty, :tr, :tm, :tt, :wb, :wy, :wr, :wm, :wt, :hq, :aq, :cs)'
            )->execute([
                ':aid' => $applicationId,
                ':tb' => $payload['tenth_board'],
                ':ty' => $payload['tenth_passing_year'],
                ':tr' => $payload['tenth_roll_number'],
                ':tm' => $payload['tenth_marks_obtained'],
                ':tt' => $payload['tenth_total_marks'],
                ':wb' => $payload['twelfth_board'],
                ':wy' => $payload['twelfth_passing_year'],
                ':wr' => $payload['twelfth_roll_number'],
                ':wm' => $payload['twelfth_marks_obtained'],
                ':wt' => $payload['twelfth_total_marks'],
                ':hq' => $payload['highest_qualification'],
                ':aq' => $payload['additional_qualifications'] ?? null,
                ':cs' => $payload['computer_skills'] ?? null,
            ]);

            // Status History
            $pdo->prepare(
                'INSERT INTO application_status_history (application_id, previous_status, new_status, remarks)
                 VALUES (:aid, NULL, "Submitted", :rem)'
            )->execute([
                ':aid' => $applicationId,
                ':rem' => "Submitted after verified UPI payment ({$receiptNumber}).",
            ]);

            // Storage paths outside public/
            $storageRoot = dirname(__DIR__, 2) . '/storage';
            $appPdfPath = $storageRoot . '/applications/' . $appNumber . '.pdf';
            $receiptPdfPath = $storageRoot . '/applications/' . $receiptNumber . '.pdf';

            $pdo->prepare(
                "UPDATE payment_transactions
                 SET application_id = :aid, receipt_number = :rno, gateway_payment_id = :gpid, gateway_signature = :sig,
                     payment_method = :pm, transaction_reference = :utr, payment_status = 'success',
                     receipt_storage_path = :rpath, gateway_response = :raw, paid_at = :paid
                 WHERE id = :id"
            )->execute([
                ':aid' => $applicationId,
                ':rno' => $receiptNumber,
                ':gpid' => $gatewayPaymentId,
                ':sig' => $signature,
                ':pm' => $paymentMethod,
                ':utr' => $transactionRef,
                ':rpath' => $receiptPdfPath,
                ':raw' => json_encode($gatewayRaw, JSON_THROW_ON_ERROR),
                ':paid' => $nowIst,
                ':id' => $txId,
            ]);

            $pdo->prepare("UPDATE applications SET pdf_storage_path = :p WHERE id = :id")
                ->execute([':p' => $appPdfPath, ':id' => $applicationId]);

            $pdo->prepare("UPDATE application_drafts SET status = 'submitted', final_application_id = :aid WHERE id = :id")
                ->execute([':aid' => $applicationId, ':id' => $draft['id']]);

            $this->audit($pdo, $txId, 'system', $gatewayPaymentId, 'payment_verified_and_submitted', "Application {$appNumber} finalized");

            $pdo->commit();

            // Fetch Job Title & generate PDFs + Send Confirmation Email (once)
            $jobStmt = $pdo->prepare('SELECT title FROM jobs WHERE id = :id');
            $jobStmt->execute([':id' => $draft['job_id']]);
            $jobTitle = (string) ($jobStmt->fetchColumn() ?: 'Published Position');

            $pdfPayload = array_merge($payload, [
                'application_number' => $appNumber,
                'job_title' => $jobTitle,
                'status' => 'Submitted',
                'submitted_at' => $nowIst,
                'mobile_number' => $draft['mobile_number'],
                'email_address' => $draft['email_address'],
                'receipt_number' => $receiptNumber,
                'fee_amount_paise' => $tx['amount'],
                'payment_status' => 'SUCCESS',
            ]);
            PdfGenerator::generateApplicationPdf($pdfPayload, $appPdfPath);

            PdfGenerator::generatePaymentReceiptPdf([
                'receipt_number' => $receiptNumber,
                'candidate_name' => $payload['full_name'],
                'application_number' => $appNumber,
                'job_title' => $jobTitle,
                'gateway_provider' => $tx['gateway_provider'],
                'gateway_payment_id' => $gatewayPaymentId,
                'payment_order_id' => $tx['payment_order_id'],
                'transaction_reference' => $transactionRef,
                'amount' => $tx['amount'],
                'currency' => $tx['currency'],
                'payment_date' => date('Y-m-d'),
                'payment_time' => date('H:i:s'),
                'payment_status' => 'SUCCESS',
            ], $receiptPdfPath);

            if ((int) $tx['confirmation_email_sent'] === 0) {
                $mailRes = Mailer::sendPaymentAndApplicationConfirmation([
                    'candidate_name' => $payload['full_name'],
                    'email_address' => $draft['email_address'],
                    'application_number' => $appNumber,
                    'job_title' => $jobTitle,
                    'amount_paise' => $tx['amount'],
                    'gateway_payment_id' => $gatewayPaymentId,
                    'payment_date' => $nowIst,
                ], $appPdfPath, $receiptPdfPath);

                if ($mailRes['ok']) {
                    $pdo->prepare('UPDATE payment_transactions SET confirmation_email_sent = 1 WHERE id = :id')
                        ->execute([':id' => $txId]);
                }
            }

            $_SESSION['last_verified_application_number'] = $appNumber;
            $_SESSION['last_verified_receipt_number'] = $receiptNumber;

            return [
                'application_number' => $appNumber,
                'receipt_number' => $receiptNumber,
            ];
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public function downloadReceipt(): void
    {
        $receiptNo = trim((string) ($_GET['receipt'] ?? ''));
        $isAdmin = !empty($_SESSION['admin_id']);
        $isOwner = hash_equals((string) ($_SESSION['last_verified_receipt_number'] ?? ''), $receiptNo);

        if ($receiptNo === '' || (!$isAdmin && !$isOwner)) {
            http_response_code(403);
            exit('Unauthorized receipt download.');
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT receipt_storage_path FROM payment_transactions WHERE receipt_number = :r LIMIT 1');
        $stmt->execute([':r' => $receiptNo]);
        $path = (string) $stmt->fetchColumn();

        if ($path === '' || !is_file($path)) {
            http_response_code(404);
            exit('Receipt PDF not found.');
        }

        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . basename($path) . '"');
        readfile($path);
    }

    private function audit(PDO $pdo, ?int $txId, string $actorType, string $actorId, string $action, string $details): void
    {
        $pdo->prepare(
            'INSERT INTO payment_audit_logs (payment_transaction_id, actor_type, actor_id, action, details, ip_address)
             VALUES (:tx, :at, :ai, :ac, :dt, :ip)'
        )->execute([
            ':tx' => $txId,
            ':at' => $actorType,
            ':ai' => $actorId,
            ':ac' => $action,
            ':dt' => $details,
            ':ip' => $_SERVER['REMOTE_ADDR'] ?? null,
        ]);
    }
}
