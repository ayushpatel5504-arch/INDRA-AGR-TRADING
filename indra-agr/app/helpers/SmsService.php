<?php
declare(strict_types=1);

namespace App\Helpers;

final class SmsService
{
    /**
     * Dispatches 6-digit OTP via configured SMS HTTP gateway.
     * Never simulates a successful OTP if provider credentials are missing.
     */
    public static function sendOtp(string $mobileNumber, string $otp): array
    {
        $apiUrl = trim((string) ($_ENV['SMS_API_URL'] ?? ''));
        $apiKey = trim((string) ($_ENV['SMS_API_KEY'] ?? ''));
        $senderId = trim((string) ($_ENV['SMS_SENDER_ID'] ?? 'INDAGR'));

        if ($apiUrl === '' || $apiKey === '') {
            return [
                'ok' => false,
                'error' => 'SMS OTP provider is not configured. Configure SMS_API_URL and SMS_API_KEY in .env.',
            ];
        }

        $payload = json_encode([
            'sender_id' => $senderId,
            'to' => $mobileNumber,
            'template_id' => $_ENV['SMS_TEMPLATE_ID'] ?? '',
            'message' => "Your INDRA AGR TRADING PVT. LTD. verification OTP is {$otp}. Valid for 5 minutes. Do not share.",
        ], JSON_THROW_ON_ERROR);

        $ch = curl_init($apiUrl);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
            ],
            CURLOPT_POSTFIELDS => $payload,
        ]);

        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false || $httpCode < 200 || $httpCode >= 300) {
            return ['ok' => false, 'error' => 'Unable to dispatch SMS OTP. Please verify SMS gateway settings.'];
        }

        return ['ok' => true];
    }
}
