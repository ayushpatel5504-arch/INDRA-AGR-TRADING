<?php
declare(strict_types=1);

namespace App\Helpers;

final class FileUpload
{
    private const ALLOWED_MIMES = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
    ];

    public static function storePrivate(array $file, string $storageDir, int $maxBytes): array
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            return ['ok' => false, 'error' => 'File upload failed.'];
        }

        if (($file['size'] ?? 0) <= 0 || ($file['size'] ?? 0) > $maxBytes) {
            return ['ok' => false, 'error' => 'File exceeds maximum allowed size.'];
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->file($file['tmp_name']);
        if (!isset(self::ALLOWED_MIMES[$mime])) {
            return ['ok' => false, 'error' => 'Only PDF, JPG, JPEG, and PNG files are permitted.'];
        }

        $ext = self::ALLOWED_MIMES[$mime];
        $randomName = bin2hex(random_bytes(20)) . '.' . $ext;

        if (!is_dir($storageDir)) {
            mkdir($storageDir, 0750, true);
        }

        $target = rtrim($storageDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $randomName;
        if (!move_uploaded_file($file['tmp_name'], $target)) {
            return ['ok' => false, 'error' => 'Unable to store uploaded file securely.'];
        }

        return [
            'ok' => true,
            'original_filename' => basename((string) $file['name']),
            'stored_filename' => $randomName,
            'mime_type' => $mime,
            'file_size_bytes' => (int) $file['size'],
        ];
    }
}
