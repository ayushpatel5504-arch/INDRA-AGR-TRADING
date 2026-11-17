<?php
declare(strict_types=1);
/** @var array $draft */
/** @var array $settings */
/** @var string $csrfToken */

$feePaise = (int) ($settings['application_fee_paise'] ?? 0);
$feeInr = number_format($feePaise / 100, 2);
$gatewayEnabled = ($settings['payment_gateway_enabled'] ?? '0') === '1';
$provider = (string) ($settings['payment_gateway_provider'] ?? 'razorpay');
$mode = (string) ($settings['payment_gateway_mode'] ?? 'test');
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Step 8: Payment Summary — INDRA AGR TRADING PVT. LTD.</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #F6F4EC; color: #1B2B22; margin: 0; padding: 24px; }
    .card { max-width: 780px; margin: 0 auto; background: #fff; border: 1px solid rgba(23,77,50,0.2); border-radius: 8px; padding: 32px; }
    h1 { color: #174D32; margin-top: 0; }
    .summary { background: #F6F4EC; border-radius: 6px; padding: 20px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(23,77,50,0.1); }
    .row:last-child { border-bottom: none; font-weight: 700; font-size: 18px; color: #174D32; }
    .btn { background: #174D32; color: #fff; border: none; padding: 14px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 15px; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .policy { font-size: 13px; background: #fff; border: 1px solid #C7A65A; padding: 14px; border-radius: 6px; margin-bottom: 20px; }
    .btn-outline { background: #F6F4EC; color: #174D32; border: 1px solid rgba(23,77,50,0.35); padding: 13px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(16,59,39,0.75); display: none; align-items: center; justify-content: center; padding: 16px; z-index: 50; }
    .modal-backdrop.open { display: flex; }
    .modal-box { background: #fff; max-width: 560px; width: 100%; border-radius: 8px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.25); }
    .modal-header { background: #103B27; color: #fff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; }
    .modal-body { padding: 24px; font-size: 14px; line-height: 1.6; }
    .error { color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 6px; margin-bottom: 16px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <p style="font-size:12px;font-weight:700;color:#174D32;margin-bottom:4px;">STEP 8 — APPLICATION FEE SUMMARY</p>
    <h1>Confirm &amp; Pay Application Fee</h1>
    <p>Please verify your application summary and configured fee before launching the official <?= htmlspecialchars(strtoupper($provider), ENT_QUOTES, 'UTF-8') ?> UPI checkout.</p>

    <div id="pay-error" class="error" role="alert"></div>

    <div class="summary">
      <div class="row"><span>Candidate Name</span><span><?= htmlspecialchars((string) ($draft['full_name'] ?? ''), ENT_QUOTES, 'UTF-8') ?></span></div>
      <div class="row"><span>Position Applied For</span><span><?= htmlspecialchars((string) ($draft['job_title'] ?? ''), ENT_QUOTES, 'UTF-8') ?></span></div>
      <div class="row"><span>Gateway / Mode</span><span><?= htmlspecialchars(ucfirst($provider) . ' (' . strtoupper($mode) . ')', ENT_QUOTES, 'UTF-8') ?></span></div>
      <div class="row"><span>Payment Method</span><span>UPI (QR Code / UPI Apps)</span></div>
      <div class="row"><span>Application Fee</span><span>INR <?= htmlspecialchars($feeInr, ENT_QUOTES, 'UTF-8') ?></span></div>
    </div>

    <div class="policy">
      <strong>Payment Instructions:</strong> <?= htmlspecialchars((string) ($settings['payment_instructions'] ?? ''), ENT_QUOTES, 'UTF-8') ?>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
      <button id="pay-btn" class="btn" <?= (!$gatewayEnabled || $feePaise <= 0) ? 'disabled' : '' ?>>
        Pay Application Fee (INR <?= htmlspecialchars($feeInr, ENT_QUOTES, 'UTF-8') ?>)
      </button>
      <button type="button" id="open-refund-modal" class="btn-outline">
        Refund Policy
      </button>
    </div>
  </div>

  <div id="refund-modal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="refund-modal-title">
    <div class="modal-box">
      <div class="modal-header">
        <div>
          <div style="font-size:11px;color:#C7A65A;font-weight:700;">PRE-PAYMENT DISCLOSURE</div>
          <h2 id="refund-modal-title" style="margin:2px 0 0;font-size:20px;">Application Fee Refund Policy</h2>
        </div>
        <button type="button" id="close-refund-x" aria-label="Close Refund Policy modal" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">&times;</button>
      </div>
      <div class="modal-body">
        <div style="background:#F6F4EC;border:1px solid #C7A65A;padding:16px;border-radius:6px;margin-bottom:18px;">
          <?= nl2br(htmlspecialchars((string) ($settings['refund_policy'] ?? 'No refund policy configured.'), ENT_QUOTES, 'UTF-8')) ?>
        </div>
        <div style="text-align:right;">
          <button type="button" id="close-refund-btn" class="btn" style="padding:10px 18px;font-size:14px;">Close &amp; Return</button>
        </div>
      </div>
    </div>
  </div>

  <?php if ($provider === 'razorpay'): ?>
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <?php else: ?>
    <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  <?php endif; ?>

  <script>
    const payBtn = document.getElementById('pay-btn');
    const errBox = document.getElementById('pay-error');
    const csrfToken = <?= json_encode($csrfToken, JSON_THROW_ON_ERROR) ?>;

    function showErr(msg) {
      errBox.textContent = msg;
      errBox.style.display = 'block';
      payBtn.disabled = false;
    }

    async function verifyOnServer(payload) {
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok && data.status === 'success') {
        window.location.href = '/payment/success?app=' + encodeURIComponent(data.application_number) + '&receipt=' + encodeURIComponent(data.receipt_number);
      } else {
        window.location.href = '/payment/failure?order=' + encodeURIComponent(payload.payment_order_id) + '&reason=' + encodeURIComponent(data.error || 'Verification failed');
      }
    }

    payBtn?.addEventListener('click', async () => {
      payBtn.disabled = true;
      errBox.style.display = 'none';
      try {
        const orderRes = await fetch('/api/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrfToken },
          body: 'csrf_token=' + encodeURIComponent(csrfToken)
        });
        const order = await orderRes.json();
        if (!order.ok) return showErr(order.error || 'Unable to create order.');

        if (order.provider === 'razorpay') {
          const rzp = new Razorpay({
            key: order.key_id,
            amount: order.amount,
            currency: order.currency,
            name: 'INDRA AGR TRADING PVT. LTD.',
            description: order.description,
            order_id: order.order_id,
            prefill: order.prefill,
            config: {
              display: {
                blocks: { upi: { name: 'Pay via UPI', instruments: [{ method: 'upi' }] } },
                sequence: ['block.upi'],
                preferences: { show_default_blocks: false }
              }
            },
            handler: function (resp) {
              verifyOnServer({
                csrf_token: csrfToken,
                payment_order_id: resp.razorpay_order_id,
                gateway_payment_id: resp.razorpay_payment_id,
                gateway_signature: resp.razorpay_signature
              });
            },
            modal: {
              ondismiss: function () {
                window.location.href = '/payment/failure?order=' + encodeURIComponent(order.order_id) + '&reason=Checkout+cancelled+by+candidate';
              }
            }
          });
          rzp.on('payment.failed', function (resp) {
            window.location.href = '/payment/failure?order=' + encodeURIComponent(order.order_id) + '&reason=' + encodeURIComponent(resp.error?.description || 'Payment failed');
          });
          rzp.open();
        } else {
          const cashfree = Cashfree({ mode: order.mode === 'live' ? 'production' : 'sandbox' });
          cashfree.checkout({
            paymentSessionId: order.payment_session_id,
            redirectTarget: '_modal'
          }).then(function (result) {
            if (result.error) {
              window.location.href = '/payment/failure?order=' + encodeURIComponent(order.order_id) + '&reason=' + encodeURIComponent(result.error.message || 'Payment failed');
            } else {
              verifyOnServer({
                csrf_token: csrfToken,
                payment_order_id: order.order_id,
                gateway_payment_id: result.paymentDetails?.paymentId || '',
                gateway_signature: ''
              });
            }
          });
        }
      } catch (e) {
        showErr('Network error while connecting to payment gateway.');
      }
    });

    const refundModal = document.getElementById('refund-modal');
    const openRefund = () => refundModal?.classList.add('open');
    const closeRefund = () => refundModal?.classList.remove('open');
    document.getElementById('open-refund-modal')?.addEventListener('click', openRefund);
    document.getElementById('close-refund-x')?.addEventListener('click', closeRefund);
    document.getElementById('close-refund-btn')?.addEventListener('click', closeRefund);
    refundModal?.addEventListener('click', (e) => { if (e.target === refundModal) closeRefund(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeRefund(); });
  </script>
</body>
</html>
