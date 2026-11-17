# INDRA AGR TRADING PVT. LTD. — Corporate Website & Job Recruitment Management Portal

**Tagline:** Connecting Farmers, Growing Businesses.  
**Core Values:** Quality | Trust | Growth  
**Directors:** Manish Kumar (Director), Indra Kumar (Director)

---

## 1. XAMPP Local Setup Guide (`C:\xampp\htdocs\indra-agr\`)

1. Copy the `indra-agr/` folder into `C:\xampp\htdocs\indra-agr\`.
2. Start **Apache** and **MySQL** in the XAMPP Control Panel.
3. Open a terminal in `C:\xampp\htdocs\indra-agr\` and install PHP dependencies (includes PHPMailer, Dompdf, phpdotenv, and Razorpay PHP SDK):
   ```bash
   composer install
   ```
4. Create `.env` from `.env.example`:
   ```bash
   copy .env.example .env
   ```
   Configure:
   - `DB_DATABASE=indra_agr_portal`, `DB_USERNAME=root`, `DB_PASSWORD=`
   - SMTP (`MAIL_*`) and SMS (`SMS_*`) credentials
   - Payment Gateway test credentials (`PAYMENT_GATEWAY=razorpay` or `cashfree`, `PAYMENT_MODE=test`, `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`, `RAZORPAY_TEST_WEBHOOK_SECRET`, or `CASHFREE_TEST_*`).
5. Import `database/schema.sql` via phpMyAdmin or MySQL CLI:
   ```bash
   mysql -u root < database/schema.sql
   ```
   *(For existing installations, apply `database/migrations/2026_11_17_0001_add_payment_transactions.sql`.)*
6. Seed verified Directors, website placeholders, and configurable payment keys:
   ```bash
   php database/seeders/InitialSeeder.php
   ```
7. Initialize the Super Admin account securely (no hardcoded credentials):
   ```bash
   php database/setup_admin.php
   ```
8. Open `http://localhost/indra-agr/` in your browser, log into `/admin/login`, and configure the authorized **Application Fee (INR)**, **Payment Gateway**, **Instructions**, and **Refund Policy** in **Payment Settings** before enabling checkout.

---

## 2. Payment Gateway & Webhook Configuration

1. **Razorpay Test Mode**:
   - Generate Test API Keys (`rzp_test_...` + secret) in the Razorpay Dashboard and place them in `.env` (`RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`).
   - Configure Webhook URL: `https://your-domain.com/webhooks/payment` (for local XAMPP webhook testing, use a secure HTTPS tunnel such as `ngrok http 80` pointing to `http://localhost/indra-agr/webhooks/payment`).
   - Subscribe to `payment.captured` and `payment.failed` events and save the Webhook Secret into `RAZORPAY_TEST_WEBHOOK_SECRET`.
2. **Cashfree Payments Sandbox**:
   - Place Sandbox App ID, Secret Key, and Webhook Secret in `.env` (`CASHFREE_TEST_APP_ID`, `CASHFREE_TEST_SECRET_KEY`, `CASHFREE_TEST_WEBHOOK_SECRET`).
   - Set Webhook URL to `https://your-domain.com/webhooks/payment`.
3. **Production Deployment**:
   - Enforce HTTPS (`SESSION_COOKIE_SECURE=true`), set `APP_ENV=production`, switch `PAYMENT_MODE=live`, and populate `*_LIVE_*` credentials strictly in server `.env` (never in version control or frontend JavaScript).

---

## 3. Payment & Recruitment Testing Checklist

- [ ] Homepage & public pages render cleanly and transparently show the configured Application Fee policy.
- [ ] Candidate completes Steps 1–6 (including Mobile OTP & Email OTP verification) and previews Step 7.
- [ ] Step 8 displays the exact server-configured INR fee, payment instructions, and refund policy before opening gateway checkout.
- [ ] Official Test-Mode UPI payment succeeds -> server verifies HMAC signature + gateway payment API + amount + currency + order ID -> Application Number (`INDRA-AGR-2026-NNNNNN`) and Receipt Number (`INDRA-REC-2026-NNNNNN`) are created atomically.
- [ ] Failed or cancelled UPI checkout displays Payment Failure page with Retry Payment and Return to Application without creating a submitted application.
- [ ] Pending payment displays pending verification state until server/webhook confirms capture.
- [ ] Duplicate webhook delivery is ignored idempotently without duplicate applications, receipts, or confirmation emails.
- [ ] Invalid signature, mismatched amount, or wrong order ID is rejected by backend verification.
- [ ] Dompdf generates both Application PDF and Payment Receipt PDF; PHPMailer sends `"INDRA AGR – Application Payment Confirmation"` with both PDFs attached.
- [ ] Admin Payment Management tracks KPIs from verified successful payments only, exports CSV, and processes gateway refunds via official API.
