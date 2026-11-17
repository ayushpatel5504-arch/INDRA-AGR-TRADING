<?php
declare(strict_types=1);

namespace App\Helpers;

use Razorpay\Api\Api as RazorpayApi;
use RuntimeException;

final class PaymentGateway
{
    public static function getConfig(array $settings): array
    {
        $provider = $settings['payment_gateway_provider'] ?? ($_ENV['PAYMENT_GATEWAY'] ?? 'razorpay');
        $mode = $settings['payment_gateway_mode'] ?? ($_ENV['PAYMENT_MODE'] ?? 'test');
        $enabled = ($settings['payment_gateway_enabled'] ?? '0') === '1';

        $prefix = strtoupper($provider) . '_' . strtoupper($mode);

        if ($provider === 'cashfree') {
            return [
                'provider' => 'cashfree',
                'mode' => $mode === 'live' ? 'live' : 'test',
                'enabled' => $enabled,
                'key_id' => trim((string) ($_ENV["CASHFREE_{$mode}_APP_ID"] ?? $_ENV['CASHFREE_' . strtoupper($mode) . '_APP_ID'] ?? '')),
                'key_secret' => trim((string) ($_ENV['CASHFREE_' . strtoupper($mode) . '_SECRET_KEY'] ?? '')),
                'webhook_secret' => trim((string) ($_ENV['CASHFREE_' . strtoupper($mode) . '_WEBHOOK_SECRET'] ?? '')),
                'api_version' => trim((string) ($_ENV['CASHFREE_API_VERSION'] ?? '2023-08-01')),
                'base_url' => $mode === 'live' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg',
            ];
        }

        return [
            'provider' => 'razorpay',
            'mode' => $mode === 'live' ? 'live' : 'test',
            'enabled' => $enabled,
            'key_id' => trim((string) ($_ENV[$prefix . '_KEY_ID'] ?? '')),
            'key_secret' => trim((string) ($_ENV[$prefix . '_KEY_SECRET'] ?? '')),
            'webhook_secret' => trim((string) ($_ENV[$prefix . '_WEBHOOK_SECRET'] ?? '')),
        ];
    }

    /**
     * Create a payment order on the configured gateway using server-side fee amount only.
     */
    public static function createOrder(
        array $config,
        int $amountPaise,
        string $currency,
        string $draftToken,
        array $customer,
        string $description
    ): array {
        if (!$config['enabled']) {
            throw new RuntimeException('Payment gateway is currently disabled by administrator.');
        }
        if ($amountPaise <= 0) {
            throw new RuntimeException('Application fee must be configured (> 0) before creating a payment order.');
        }
        if ($currency !== 'INR') {
            throw new RuntimeException('Only INR currency is supported.');
        }
        if ($config['key_id'] === '' || $config['key_secret'] === '') {
            throw new RuntimeException('Payment gateway API credentials are not configured in server environment.');
        }

        if ($config['provider'] === 'cashfree') {
            $orderId = 'cf_ord_' . bin2hex(random_bytes(8));
            $amountInr = round($amountPaise / 100, 2);
            $returnUrl = rtrim((string) ($_ENV['APP_URL'] ?? ''), '/') . '/payment/callback?order_id={order_id}';

            $payload = [
                'order_id' => $orderId,
                'order_amount' => $amountInr,
                'order_currency' => 'INR',
                'customer_details' => [
                    'customer_id' => 'cand_' . substr($draftToken, 0, 16),
                    'customer_name' => $customer['full_name'],
                    'customer_email' => $customer['email_address'],
                    'customer_phone' => $customer['mobile_number'],
                ],
                'order_meta' => [
                    'return_url' => $returnUrl,
                    'payment_methods' => 'upi',
                ],
                'order_note' => $description,
            ];

            $res = self::httpRequest('POST', $config['base_url'] . '/orders', $payload, [
                'x-client-id: ' . $config['key_id'],
                'x-client-secret: ' . $config['key_secret'],
                'x-api-version: ' . $config['api_version'],
            ]);

            if (empty($res['payment_session_id'])) {
                throw new RuntimeException('Cashfree order creation failed.');
            }

            return [
                'provider' => 'cashfree',
                'order_id' => $res['order_id'],
                'payment_session_id' => $res['payment_session_id'],
                'amount_paise' => $amountPaise,
                'currency' => 'INR',
                'mode' => $config['mode'],
                'raw' => $res,
            ];
        }

        // Razorpay Official PHP SDK
        $api = new RazorpayApi($config['key_id'], $config['key_secret']);
        $order = $api->order->create([
            'receipt' => 'rcpt_' . substr($draftToken, 0, 24),
            'amount' => $amountPaise,
            'currency' => 'INR',
            'payment_capture' => 1,
            'notes' => [
                'draft_token' => $draftToken,
                'purpose' => $description,
            ],
        ]);

        return [
            'provider' => 'razorpay',
            'order_id' => (string) $order['id'],
            'key_id' => $config['key_id'],
            'amount_paise' => (int) $order['amount'],
            'currency' => (string) $order['currency'],
            'mode' => $config['mode'],
            'raw' => $order->toArray(),
        ];
    }

    /**
     * Server-side payment signature + gateway API status/amount/currency/order verification.
     */
    public static function verifyCheckoutPayment(
        array $config,
        string $orderId,
        string $paymentId,
        string $signature,
        int $expectedAmountPaise,
        string $expectedCurrency = 'INR'
    ): array {
        if ($config['provider'] === 'cashfree') {
            $payments = self::httpRequest(
                'GET',
                $config['base_url'] . '/orders/' . rawurlencode($orderId) . '/payments',
                null,
                [
                    'x-client-id: ' . $config['key_id'],
                    'x-client-secret: ' . $config['key_secret'],
                    'x-api-version: ' . $config['api_version'],
                ]
            );

            $matched = null;
            if (is_array($payments)) {
                foreach ($payments as $p) {
                    if (($p['payment_status'] ?? '') === 'SUCCESS') {
                        $matched = $p;
                        break;
                    }
                }
                if ($matched === null && isset($payments[0])) {
                    $matched = $payments[0];
                }
            }

            if ($matched === null) {
                return ['ok' => false, 'status' => 'pending', 'error' => 'Payment status pending confirmation from Cashfree.'];
            }

            $paidPaise = (int) round(((float) ($matched['payment_amount'] ?? 0)) * 100);
            $currency = (string) ($matched['payment_currency'] ?? '');
            $status = strtoupper((string) ($matched['payment_status'] ?? 'PENDING'));

            if ($paidPaise !== $expectedAmountPaise || $currency !== $expectedCurrency) {
                return ['ok' => false, 'status' => 'failed', 'error' => 'Payment amount or currency mismatch detected.'];
            }

            if ($status !== 'SUCCESS') {
                return [
                    'ok' => false,
                    'status' => $status === 'FAILED' ? 'failed' : 'pending',
                    'error' => (string) ($matched['payment_message'] ?? 'Payment not completed.'),
                    'raw' => $matched,
                ];
            }

            $utr = $matched['bank_reference'] ?? ($matched['payment_method']['upi']['utr'] ?? null);
            return [
                'ok' => true,
                'status' => 'success',
                'gateway_payment_id' => (string) $matched['cf_payment_id'],
                'payment_method' => 'upi',
                'transaction_reference' => $utr ? (string) $utr : null,
                'raw' => $matched,
            ];
        }

        // Razorpay Signature Verification (constant-time comparison)
        $expectedSig = hash_hmac('sha256', $orderId . '|' . $paymentId, $config['key_secret']);
        if (!hash_equals($expectedSig, $signature)) {
            return ['ok' => false, 'status' => 'failed', 'error' => 'Invalid Razorpay payment signature.'];
        }

        // Fetch authoritative payment state directly from Razorpay API
        $api = new RazorpayApi($config['key_id'], $config['key_secret']);
        $payment = $api->payment->fetch($paymentId);
        $pArr = $payment->toArray();

        if (($pArr['order_id'] ?? '') !== $orderId) {
            return ['ok' => false, 'status' => 'failed', 'error' => 'Order ID mismatch.'];
        }
        if ((int) ($pArr['amount'] ?? 0) !== $expectedAmountPaise || ($pArr['currency'] ?? '') !== $expectedCurrency) {
            return ['ok' => false, 'status' => 'failed', 'error' => 'Payment amount or currency mismatch.'];
        }

        $rzpStatus = (string) ($pArr['status'] ?? '');
        if ($rzpStatus === 'authorized') {
            $payment->capture(['amount' => $expectedAmountPaise, 'currency' => $expectedCurrency]);
            $pArr = $api->payment->fetch($paymentId)->toArray();
            $rzpStatus = (string) ($pArr['status'] ?? '');
        }

        if ($rzpStatus !== 'captured') {
            return [
                'ok' => false,
                'status' => $rzpStatus === 'failed' ? 'failed' : 'pending',
                'error' => (string) ($pArr['error_description'] ?? 'Payment pending capture.'),
                'raw' => $pArr,
            ];
        }

        $utr = $pArr['acquirer_data']['rrn'] ?? $pArr['acquirer_data']['upi_transaction_id'] ?? null;

        return [
            'ok' => true,
            'status' => 'success',
            'gateway_payment_id' => (string) $pArr['id'],
            'payment_method' => (string) ($pArr['method'] ?? 'upi'),
            'transaction_reference' => $utr ? (string) $utr : null,
            'raw' => $pArr,
        ];
    }

    public static function verifyWebhookSignature(
        array $config,
        string $rawBody,
        array $headers
    ): bool {
        $secret = $config['webhook_secret'] ?? '';
        if ($secret === '') {
            return false;
        }

        $normalized = array_change_key_case($headers, CASE_LOWER);

        if ($config['provider'] === 'cashfree') {
            $sig = $normalized['x-webhook-signature'] ?? '';
            $ts = $normalized['x-webhook-timestamp'] ?? '';
            if ($sig === '' || $ts === '') {
                return false;
            }
            $computed = base64_encode(hash_hmac('sha256', $ts . $rawBody, $secret, true));
            return hash_equals($computed, $sig);
        }

        $sig = $normalized['x-razorpay-signature'] ?? '';
        if ($sig === '') {
            return false;
        }
        $computed = hash_hmac('sha256', $rawBody, $secret);
        return hash_equals($computed, $sig);
    }

    public static function initiateRefund(
        array $config,
        string $gatewayPaymentId,
        string $orderId,
        int $amountPaise,
        string $reason
    ): array {
        if ($config['key_id'] === '' || $config['key_secret'] === '') {
            return ['ok' => false, 'refund_status' => 'Refund Failed', 'error' => 'Gateway credentials not configured.'];
        }

        if ($config['provider'] === 'cashfree') {
            $refundId = 'cf_ref_' . bin2hex(random_bytes(6));
            $res = self::httpRequest(
                'POST',
                $config['base_url'] . '/orders/' . rawurlencode($orderId) . '/refunds',
                [
                    'refund_amount' => round($amountPaise / 100, 2),
                    'refund_id' => $refundId,
                    'refund_note' => $reason,
                ],
                [
                    'x-client-id: ' . $config['key_id'],
                    'x-client-secret: ' . $config['key_secret'],
                    'x-api-version: ' . $config['api_version'],
                ]
            );
            $st = strtoupper((string) ($res['refund_status'] ?? 'PENDING'));
            return [
                'ok' => in_array($st, ['SUCCESS', 'PENDING'], true),
                'refund_id' => (string) ($res['cf_refund_id'] ?? $refundId),
                'refund_status' => $st === 'SUCCESS' ? 'Refunded' : ($st === 'PENDING' ? 'Processing' : 'Refund Failed'),
                'raw' => $res,
            ];
        }

        $api = new RazorpayApi($config['key_id'], $config['key_secret']);
        $refund = $api->payment->fetch($gatewayPaymentId)->refund([
            'amount' => $amountPaise,
            'notes' => ['reason' => $reason],
        ]);
        $rArr = $refund->toArray();
        $st = (string) ($rArr['status'] ?? 'pending');

        return [
            'ok' => in_array($st, ['processed', 'pending'], true),
            'refund_id' => (string) ($rArr['id'] ?? ''),
            'refund_status' => $st === 'processed' ? 'Refunded' : ($st === 'pending' ? 'Processing' : 'Refund Failed'),
            'raw' => $rArr,
        ];
    }

    private static function httpRequest(string $method, string $url, ?array $body, array $headers): array
    {
        $ch = curl_init($url);
        $allHeaders = array_merge(['Content-Type: application/json'], $headers);
        $opts = [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => $allHeaders,
        ];
        if ($body !== null) {
            $opts[CURLOPT_POSTFIELDS] = json_encode($body, JSON_THROW_ON_ERROR);
        }
        curl_setopt_array($ch, $opts);
        $raw = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($raw === false || $code >= 400) {
            throw new RuntimeException('Gateway HTTP request failed with status ' . $code);
        }
        return json_decode((string) $raw, true, 512, JSON_THROW_ON_ERROR);
    }
}
