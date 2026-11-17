<?php
declare(strict_types=1);
/** @var array $settings */
/** @var string $csrfToken */
$feeInr = number_format(((int) ($settings['application_fee_paise'] ?? 0)) / 100, 2, '.', '');
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin Payment Settings — INDRA AGR TRADING PVT. LTD.</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #F6F4EC; color: #1B2B22; margin: 0; padding: 24px; }
    .card { max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid rgba(23,77,50,0.15); border-radius: 8px; padding: 32px; }
    label { display: block; font-size: 13px; font-weight: 600; margin: 14px 0 6px; }
    input, select, textarea { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; }
    .btn { background: #174D32; color: #fff; border: none; padding: 12px 22px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-top: 20px; }
    .note { background: #F6F4EC; border-left: 4px solid #C7A65A; padding: 12px 16px; font-size: 13px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1 style="margin-top:0;color:#174D32;">Payment Gateway &amp; Fee Settings</h1>

    <?php if (!empty($_GET['saved'])): ?>
      <p style="color:#174D32;font-weight:700;">Payment settings updated successfully.</p>
    <?php endif; ?>

    <div class="note">
      <strong>Security Note:</strong> Gateway API Secrets and Webhook Secrets are loaded from server-side <code>.env</code> credentials and are never exposed in HTML or browser JavaScript.
      <br /><strong>Webhook Endpoint:</strong> <code><?= htmlspecialchars(rtrim((string) ($_ENV['APP_URL'] ?? ''), '/') . '/webhooks/payment', ENT_QUOTES, 'UTF-8') ?></code>
    </div>

    <form method="POST" action="/admin/payment-settings/save">
      <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />

      <label>
        <input type="checkbox" name="payment_gateway_enabled" value="1" style="width:auto;margin-right:8px;" <?= ($settings['payment_gateway_enabled'] ?? '0') === '1' ? 'checked' : '' ?> />
        Enable Online Application Fee Payment Gateway
      </label>

      <label for="gw-provider">Payment Gateway Provider</label>
      <select id="gw-provider" name="payment_gateway_provider">
        <option value="razorpay" <?= ($settings['payment_gateway_provider'] ?? 'razorpay') === 'razorpay' ? 'selected' : '' ?>>Razorpay (UPI QR &amp; Apps)</option>
        <option value="cashfree" <?= ($settings['payment_gateway_provider'] ?? '') === 'cashfree' ? 'selected' : '' ?>>Cashfree Payments (UPI QR &amp; Apps)</option>
      </select>

      <label for="gw-mode">Gateway Mode</label>
      <select id="gw-mode" name="payment_gateway_mode">
        <option value="test" <?= ($settings['payment_gateway_mode'] ?? 'test') === 'test' ? 'selected' : '' ?>>Test / Sandbox Mode</option>
        <option value="live" <?= ($settings['payment_gateway_mode'] ?? '') === 'live' ? 'selected' : '' ?>>Live Production Mode</option>
      </select>

      <label for="fee-inr">Application Fee Amount (INR — 0 disables collection)</label>
      <input id="fee-inr" name="application_fee_inr" type="number" step="0.01" min="0" value="<?= htmlspecialchars($feeInr, ENT_QUOTES, 'UTF-8') ?>" />

      <label for="rec-prefix">Receipt Prefix</label>
      <input id="rec-prefix" name="payment_receipt_prefix" value="<?= htmlspecialchars((string) ($settings['payment_receipt_prefix'] ?? 'INDRA-REC'), ENT_QUOTES, 'UTF-8') ?>" />

      <label for="pay-desc">Payment Description</label>
      <input id="pay-desc" name="payment_description" value="<?= htmlspecialchars((string) ($settings['payment_description'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" />

      <label for="pay-inst">Candidate Payment Instructions</label>
      <textarea id="pay-inst" name="payment_instructions" rows="3"><?= htmlspecialchars((string) ($settings['payment_instructions'] ?? ''), ENT_QUOTES, 'UTF-8') ?></textarea>

      <label for="refund-pol">Refund Policy</label>
      <textarea id="refund-pol" name="refund_policy" rows="3"><?= htmlspecialchars((string) ($settings['refund_policy'] ?? ''), ENT_QUOTES, 'UTF-8') ?></textarea>

      <button class="btn" type="submit">Save Payment Settings</button>
    </form>
  </div>
</body>
</html>
