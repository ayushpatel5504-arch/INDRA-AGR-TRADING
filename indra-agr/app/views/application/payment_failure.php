<?php
declare(strict_types=1);
$orderId = (string) ($_GET['order'] ?? '');
$reason = (string) ($_GET['reason'] ?? 'The UPI payment could not be completed or was cancelled.');
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Failed — INDRA AGR TRADING PVT. LTD.</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #F6F4EC; color: #1B2B22; margin: 0; padding: 24px; }
    .card { max-width: 680px; margin: 0 auto; background: #fff; border: 1px solid #fecaca; border-radius: 8px; padding: 32px; }
    h1 { color: #991b1b; margin-top: 0; }
    .box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 20px 0; font-size: 14px; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn { background: #174D32; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600; font-size: 14px; }
    .btn-outline { border: 1px solid #174D32; color: #174D32; background: #fff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <p style="font-size:12px;font-weight:700;color:#991b1b;">PAYMENT STATUS: FAILED / CANCELLED</p>
    <h1>Application Fee Payment Not Completed</h1>
    <p>Your application draft and uploaded documents remain safely preserved. Final submission will be completed only after verified UPI payment.</p>

    <div class="box">
      <strong>Order Reference:</strong> <?= htmlspecialchars($orderId ?: 'Not Created', ENT_QUOTES, 'UTF-8') ?><br />
      <strong>Reason:</strong> <?= htmlspecialchars($reason, ENT_QUOTES, 'UTF-8') ?>
    </div>

    <div class="actions">
      <a class="btn" href="/apply/payment">Retry Payment</a>
      <a class="btn-outline" href="/apply">Return to Application</a>
    </div>
  </div>
</body>
</html>
