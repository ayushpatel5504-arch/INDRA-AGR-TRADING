<?php
declare(strict_types=1);

namespace App\Helpers;

use PDO;
use PDOException;
use RuntimeException;

final class Database
{
    private static ?PDO $instance = null;

    public static function connection(): PDO
    {
        if (self::$instance instanceof PDO) {
            return self::$instance;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $_ENV['DB_HOST'] ?? '127.0.0.1',
            $_ENV['DB_PORT'] ?? '3306',
            $_ENV['DB_DATABASE'] ?? 'indra_agr_portal'
        );

        try {
            self::$instance = new PDO(
                $dsn,
                $_ENV['DB_USERNAME'] ?? 'root',
                $_ENV['DB_PASSWORD'] ?? '',
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
            self::$instance->exec("SET time_zone = '+05:30'");
        } catch (PDOException $e) {
            error_log('[DB Connection Error] ' . $e->getMessage());
            throw new RuntimeException('Database connection unavailable.');
        }

        return self::$instance;
    }

    /**
     * Concurrency-safe application number generator: INDRA-AGR-YYYY-NNNNNN
     * Must be called inside an active PDO transaction.
     */
    public static function nextApplicationNumber(PDO $pdo, int $year): string
    {
        $pdo->prepare(
            'INSERT INTO application_sequences (seq_year, last_value) VALUES (:y, 0)
             ON DUPLICATE KEY UPDATE seq_year = seq_year'
        )->execute([':y' => $year]);

        $stmt = $pdo->prepare('SELECT last_value FROM application_sequences WHERE seq_year = :y FOR UPDATE');
        $stmt->execute([':y' => $year]);
        $next = ((int) $stmt->fetchColumn()) + 1;

        $pdo->prepare('UPDATE application_sequences SET last_value = :v WHERE seq_year = :y')
            ->execute([':v' => $next, ':y' => $year]);

        return sprintf('INDRA-AGR-%04d-%06d', $year, $next);
    }

    /**
     * Concurrency-safe payment receipt number generator: PREFIX-YYYY-NNNNNN
     * Must be called inside an active PDO transaction.
     */
    public static function nextReceiptNumber(PDO $pdo, int $year, string $prefix = 'INDRA-REC'): string
    {
        $cleanPrefix = preg_replace('/[^A-Z0-9\-]/', '', strtoupper($prefix)) ?: 'INDRA-REC';

        $pdo->prepare(
            'INSERT INTO payment_receipt_sequences (seq_year, last_value) VALUES (:y, 0)
             ON DUPLICATE KEY UPDATE seq_year = seq_year'
        )->execute([':y' => $year]);

        $stmt = $pdo->prepare('SELECT last_value FROM payment_receipt_sequences WHERE seq_year = :y FOR UPDATE');
        $stmt->execute([':y' => $year]);
        $next = ((int) $stmt->fetchColumn()) + 1;

        $pdo->prepare('UPDATE payment_receipt_sequences SET last_value = :v WHERE seq_year = :y')
            ->execute([':v' => $next, ':y' => $year]);

        return sprintf('%s-%04d-%06d', $cleanPrefix, $year, $next);
    }

    public static function getWebsiteSettings(PDO $pdo): array
    {
        $rows = $pdo->query('SELECT setting_key, setting_value FROM website_settings')->fetchAll();
        $out = [];
        foreach ($rows as $row) {
            $out[$row['setting_key']] = (string) ($row['setting_value'] ?? '');
        }
        return $out;
    }
}
