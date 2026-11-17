<?php
declare(strict_types=1);
/** @var array $transactions */
/** @var array $stats */
/** @var string $csrfToken */
$collectedInr = number_format(((int) ($stats['total_collected_paise'] ?? 0)) / 100, 2);
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin Payment Management — INDRA AGR TRADING PVT. LTD.</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #F6F4EC; color: #1B2B22; margin: 0; padding: 24px; }
    .wrap { max-width: 1180px; margin: 0 auto; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi { background: #fff; border: 1px solid rgba(23,77,50,0.15); border-radius: 8px; padding: 18px; }
    .kpi .val { font-size: 26px; font-weight: 700; color: #174D32; margin-top: 6px; font-family: ui-monospace, monospace; }
    .panel { background: #fff; border: 1px solid rgba(23,77,50,0.15); border-radius: 8px; padding: 24px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid rgba(23,77,50,0.1); }
    .btn { background: #174D32; color: #fff; border: none; padding: 8px 14px; border-radius: 5px; font-size: 13px; text-decoration: none; cursor: pointer; }
  </style>
</head>
<body>
  <div class="wrap">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h1 style="margin:0;color:#174D32;">Payment Management</h1>
      <div style="display:flex;gap:10px;">
        <a class="btn" href="/admin/payment-settings">Payment Settings</a>
        <a class="btn" href="/admin/payments/export?<?= htmlspecialchars(http_build_query($_GET), ENT_QUOTES, 'UTF-8') ?>">Export CSV</a>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi"><div>Total Successful Payments</div><div class="val"><?= (int) ($stats['total_success'] ?? 0) ?></div></div>
      <div class="kpi"><div>Total Pending Payments</div><div class="val"><?= (int) ($stats['total_pending'] ?? 0) ?></div></div>
      <div class="kpi"><div>Total Failed Payments</div><div class="val"><?= (int) ($stats['total_failed'] ?? 0) ?></div></div>
      <div class="kpi"><div>Total Collected (Verified INR)</div><div class="val">INR <?= htmlspecialchars($collectedInr, ENT_QUOTES, 'UTF-8') ?></div></div>
    </div>

    <div class="panel">
      <form method="GET" style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <input name="q" placeholder="Search Payment ID, Order ID, or App No" value="<?= htmlspecialchars((string) ($_GET['q'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" style="padding:8px 12px;min-width:260px;border:1px solid #ccc;border-radius:5px;" />
        <select name="status" style="padding:8px 12px;border:1px solid #ccc;border-radius:5px;">
          <option value="">All Statuses</option>
          <?php foreach (['created', 'pending', 'processing', 'success', 'failed', 'cancelled', 'refunded'] as $st): ?>
            <option value="<?= $st ?>" <?= ($_GET['status'] ?? '') === $st ? 'selected' : '' ?>><?= strtoupper($st) ?></option>
          <?php endforeach; ?>
        </select>
        <button class="btn" type="submit">Filter</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Receipt</th><th>App No</th><th>Candidate</th><th>Gateway / Order ID</th><th>Payment ID / UTR</th>
            <th>Amount</th><th>Status</th><th>Refund</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($transactions as $t): ?>
            <tr>
              <td><?= htmlspecialchars((string) ($t['receipt_number'] ?? '—'), ENT_QUOTES, 'UTF-8') ?></td>
              <td><?= htmlspecialchars((string) ($t['application_number'] ?? 'Pending'), ENT_QUOTES, 'UTF-8') ?></td>
              <td><?= htmlspecialchars((string) ($t['candidate_name'] ?? 'Draft Applicant'), ENT_QUOTES, 'UTF-8') ?></td>
              <td><?= htmlspecialchars($t['gateway_provider'] . ' / ' . $t['payment_order_id'], ENT_QUOTES, 'UTF-8') ?></td>
              <td><?= htmlspecialchars((string) ($t['gateway_payment_id'] ?? '—'), ENT_QUOTES, 'UTF-8') ?><br /><small><?= htmlspecialchars((string) ($t['transaction_reference'] ?? ''), ENT_QUOTES, 'UTF-8') ?></small></td>
              <td>INR <?= number_format(((int) $t['amount']) / 100, 2) ?></td>
              <td><strong><?= htmlspecialchars(strtoupper((string) $t['payment_status']), ENT_QUOTES, 'UTF-8') ?></strong></td>
              <td><?= htmlspecialchars((string) $t['refund_status'], ENT_QUOTES, 'UTF-8') ?></td>
              <td>
                <?php if (!empty($t['receipt_number'])): ?>
                  <a href="/payment/receipt/download?receipt=<?= urlencode((string) $t['receipt_number']) ?>">Receipt PDF</a>
                <?php endif; ?>
                <?php if ($t['payment_status'] === 'success' && !empty($t['gateway_payment_id'])): ?>
                  <form method="POST" action="/admin/payments/refund" style="display:inline;margin-left:8px;">
                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />
                    <input type="hidden" name="payment_transaction_id" value="<?= (int) $t['id'] ?>" />
                    <input type="hidden" name="reason" value="Authorized admin refund" />
                    <button type="submit" style="color:#991b1b;background:none;border:none;cursor:pointer;text-decoration:underline;">Refund</button>
                  </form>
                <?php endif; ?>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
