<?php
declare(strict_types=1);
/** @var array $record */
$amountInr = number_format(((int) ($record['amount'] ?? 0)) / 100, 2);
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment &amp; Application Confirmed — INDRA AGR TRADING PVT. LTD.</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #F6F4EC; color: #1B2B22; margin: 0; padding: 24px; }
    .card { max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid rgba(23,77,50,0.2); border-radius: 8px; padding: 32px; }
    h1 { color: #174D32; margin-top: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; background: #F6F4EC; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .label { font-size: 12px; color: #52635a; }
    .val { font-weight: 700; margin-top: 4px; font-family: ui-monospace, monospace; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
    .btn { background: #174D32; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 6px; font-weight: 600; font-size: 14px; }
    .btn-outline { border: 1px solid #174D32; color: #174D32; background: #fff; text-decoration: none; padding: 12px 18px; border-radius: 6px; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <p style="font-size:12px;font-weight:700;color:#174D32;">INDRA AGR TRADING PVT. LTD.</p>
    <h1>Payment Verified &amp; Application Submitted</h1>
    <p>Your application fee payment has been cryptographically verified by the payment gateway and your job application is officially registered.</p>

    <div class="grid">
      <div><div class="label">Application Number</div><div class="val"><?= htmlspecialchars((string) ($record['application_number'] ?? ''), ENT_QUOTES, 'UTF-8') ?></div></div>
      <div><div class="label">Receipt Number</div><div class="val"><?= htmlspecialchars((string) ($record['receipt_number'] ?? ''), ENT_QUOTES, 'UTF-8') ?></div></div>
      <div><div class="label">Candidate Name</div><div class="val" style="font-family:inherit;"><?= htmlspecialchars((string) ($record['candidate_name'] ?? ''), ENT_QUOTES, 'UTF-8') ?></div></div>
      <div><div class="label">Position Applied For</div><div class="val" style="font-family:inherit;"><?= htmlspecialchars((string) ($record['job_title'] ?? ''), ENT_QUOTES, 'UTF-8') ?></div></div>
      <div><div class="label">Application Fee Paid</div><div class="val">INR <?= htmlspecialchars($amountInr, ENT_QUOTES, 'UTF-8') ?></div></div>
      <div><div class="label">Payment ID</div><div class="val"><?= htmlspecialchars((string) ($record['gateway_payment_id'] ?? ''), ENT_QUOTES, 'UTF-8') ?></div></div>
      <div><div class="label">Order ID</div><div class="val"><?= htmlspecialchars((string) ($record['payment_order_id'] ?? ''), ENT_QUOTES, 'UTF-8') ?></div></div>
      <div><div class="label">UPI Reference / UTR</div><div class="val"><?= htmlspecialchars((string) ($record['transaction_reference'] ?? 'Verified'), ENT_QUOTES, 'UTF-8') ?></div></div>
      <div><div class="label">Payment Date &amp; Time (IST)</div><div class="val"><?= htmlspecialchars((string) ($record['paid_at'] ?? ''), ENT_QUOTES, 'UTF-8') ?></div></div>
      <div><div class="label">Payment Status</div><div class="val" style="color:#174D32;">SUCCESS</div></div>
    </div>

    <div class="actions">
      <a class="btn" href="/application/pdf/download?app=<?= urlencode((string) ($record['application_number'] ?? '')) ?>">Download Application PDF</a>
      <a class="btn-outline" href="/payment/receipt/download?receipt=<?= urlencode((string) ($record['receipt_number'] ?? '')) ?>">Download Payment Receipt PDF</a>
      <a class="btn-outline" href="/application-status">Track Application Status</a>
    </div>
  </div>
</body>
</html>
