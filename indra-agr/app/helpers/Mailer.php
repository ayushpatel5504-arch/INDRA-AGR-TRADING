<?php
declare(strict_types=1);

namespace App\Helpers;

use PDO;
use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;

final class Mailer
{
    public static function send(
        string $toEmail,
        string $toName,
        string $subject,
        string $htmlBody,
        string $templateKey,
        ?string $attachmentPath = null
    ): array {
        $host = $_ENV['MAIL_HOST'] ?? '';
        $user = $_ENV['MAIL_USERNAME'] ?? '';
        $pass = $_ENV['MAIL_PASSWORD'] ?? '';
        $from = $_ENV['MAIL_FROM_ADDRESS'] ?? '';

        if ($host === '' || $user === '' || $pass === '' || $from === '') {
            self::log($toEmail, $subject, $templateKey, 'failed', 'SMTP configuration incomplete.');
            return ['ok' => false, 'error' => 'SMTP email service is not configured. Contact administrator.'];
        }

        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = $host;
            $mail->SMTPAuth = true;
            $mail->Username = $user;
            $mail->Password = $pass;
            $mail->SMTPSecure = ($_ENV['MAIL_ENCRYPTION'] ?? 'tls') === 'ssl'
                ? PHPMailer::ENCRYPTION_SMTPS
                : PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = (int) ($_ENV['MAIL_PORT'] ?? 587);

            $mail->setFrom($from, $_ENV['MAIL_FROM_NAME'] ?? 'INDRA AGR TRADING PVT. LTD.');
            $mail->addAddress($toEmail, $toName);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $htmlBody;

            if ($attachmentPath !== null && is_file($attachmentPath)) {
                $mail->addAttachment($attachmentPath, basename($attachmentPath));
            }

            $mail->send();
            self::log($toEmail, $subject, $templateKey, 'sent', null);
            return ['ok' => true];
        } catch (MailException $e) {
            self::log($toEmail, $subject, $templateKey, 'failed', $mail->ErrorInfo);
            return ['ok' => false, 'error' => 'Email delivery failed. Please try again later.'];
        }
    }

    public static function sendPaymentAndApplicationConfirmation(
        array $details,
        string $applicationPdfPath,
        string $receiptPdfPath
    ): array {
        $host = $_ENV['MAIL_HOST'] ?? '';
        $user = $_ENV['MAIL_USERNAME'] ?? '';
        $pass = $_ENV['MAIL_PASSWORD'] ?? '';
        $from = $_ENV['MAIL_FROM_ADDRESS'] ?? '';

        $toEmail = (string) ($details['email_address'] ?? '');
        $toName = (string) ($details['candidate_name'] ?? '');
        $subject = 'INDRA AGR – Application Payment Confirmation';

        if ($host === '' || $user === '' || $pass === '' || $from === '') {
            self::log($toEmail, $subject, 'payment_confirmation', 'failed', 'SMTP configuration incomplete.');
            return ['ok' => false, 'error' => 'SMTP email service is not configured.'];
        }

        $e = static fn(mixed $v): string => htmlspecialchars((string) ($v ?? '—'), ENT_QUOTES, 'UTF-8');
        $amt = number_format(((int) ($details['amount_paise'] ?? 0)) / 100, 2);

        $html = <<<HTML
<div style="font-family:Arial,sans-serif;color:#1B2B22;max-width:620px;margin:auto;border:1px solid #D9D4C5;padding:24px;">
  <h2 style="color:#174D32;margin-top:0;">INDRA AGR TRADING PVT. LTD.</h2>
  <p>Dear {$e($toName)},</p>
  <p>Your application fee payment has been verified and your job application has been formally submitted.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
    <tr><td style="padding:6px;border:1px solid #E2DED2;"><strong>Application Number</strong></td><td style="padding:6px;border:1px solid #E2DED2;">{$e($details['application_number'])}</td></tr>
    <tr><td style="padding:6px;border:1px solid #E2DED2;"><strong>Position Applied For</strong></td><td style="padding:6px;border:1px solid #E2DED2;">{$e($details['job_title'])}</td></tr>
    <tr><td style="padding:6px;border:1px solid #E2DED2;"><strong>Amount Paid</strong></td><td style="padding:6px;border:1px solid #E2DED2;">INR {$amt}</td></tr>
    <tr><td style="padding:6px;border:1px solid #E2DED2;"><strong>Payment ID</strong></td><td style="padding:6px;border:1px solid #E2DED2;">{$e($details['gateway_payment_id'])}</td></tr>
    <tr><td style="padding:6px;border:1px solid #E2DED2;"><strong>Payment Date</strong></td><td style="padding:6px;border:1px solid #E2DED2;">{$e($details['payment_date'])} IST</td></tr>
    <tr><td style="padding:6px;border:1px solid #E2DED2;"><strong>Payment Status</strong></td><td style="padding:6px;border:1px solid #E2DED2;color:#174D32;"><strong>SUCCESS</strong></td></tr>
  </table>
  <p>Your Application Form PDF and Official Payment Receipt PDF are attached to this email.</p>
  <p style="font-size:12px;color:#6B7280;">Regards,<br>Recruitment Team — INDRA AGR TRADING PVT. LTD.</p>
</div>
HTML;

        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = $host;
            $mail->SMTPAuth = true;
            $mail->Username = $user;
            $mail->Password = $pass;
            $mail->SMTPSecure = ($_ENV['MAIL_ENCRYPTION'] ?? 'tls') === 'ssl'
                ? PHPMailer::ENCRYPTION_SMTPS
                : PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = (int) ($_ENV['MAIL_PORT'] ?? 587);

            $mail->setFrom($from, $_ENV['MAIL_FROM_NAME'] ?? 'INDRA AGR TRADING PVT. LTD.');
            $mail->addAddress($toEmail, $toName);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $html;

            if (is_file($applicationPdfPath)) {
                $mail->addAttachment($applicationPdfPath, basename($applicationPdfPath));
            }
            if (is_file($receiptPdfPath)) {
                $mail->addAttachment($receiptPdfPath, basename($receiptPdfPath));
            }

            $mail->send();
            self::log($toEmail, $subject, 'payment_confirmation', 'sent', null);
            return ['ok' => true];
        } catch (MailException $e) {
            self::log($toEmail, $subject, 'payment_confirmation', 'failed', $mail->ErrorInfo);
            return ['ok' => false, 'error' => 'Email delivery failed.'];
        }
    }

    private static function log(string $to, string $subject, string $template, string $status, ?string $err): void
    {
        try {
            $pdo = Database::connection();
            $stmt = $pdo->prepare(
                'INSERT INTO email_logs (recipient_email, subject, template_key, status, error_message)
                 VALUES (:r, :s, :t, :st, :e)'
            );
            $stmt->execute([':r' => $to, ':s' => $subject, ':t' => $template, ':st' => $status, ':e' => $err]);
        } catch (\Throwable $t) {
            error_log('[Email Log Error] ' . $t->getMessage());
        }
    }
}
