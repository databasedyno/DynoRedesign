# Investigation handoff — (1) missing BTC merchant/admin emails, (2) notification vs table timestamp mismatch

Date: 2026-06 (fork). Status: **INVESTIGATION ONLY — nothing changed in code yet.** Preview pod has
`DISABLE_OUTBOUND_EMAIL=true` (wired to LIVE prod DB) so **Bug #1 cannot be reproduced on the pod** — all
outbound mail is suppressed + dumped. Bug #2 is a frontend/data-consistency issue analysable from code.

User's original report (verbatim):
1. "no email to merchant or admin about the most recent BTC transaction"
2. "when transaction shows 45 seconds since notification, the timing displayed for the same transaction
   appears 20 more minutes older under recent transaction table"
User then said: **"implement best option"** (i.e. they approve a fix; pick the best approach).

---

## BUG #2 — timestamp mismatch (ROOT CAUSE FOUND; frontend/data; low risk)

### What each surface renders
| Surface | File:line | Field rendered | Meaning of that field |
|---|---|---|---|
| Notification inbox "45s ago" | `Components/Page/Notification/NotificationInbox.tsx:278` → `formatTimeAgo(notif.created_at)` | **notification record `created_at`** | set when the "Payment Received" notification row is INSERTED = at **settlement** |
| /transactions table | `Components/Page/Transactions/index.tsx:241` → `dateTime: formatDateTime(item.createdAt)` | `tbl_user_transaction.createdAt` | when the tx ROW was first created |
| Dashboard Recent Transactions widget | `Components/Page/Dashboard/RecentTransactionsWidget.tsx:535` → `formatWhen(tx.createdAt || tx.created_at)`, labelled **"Received {when}"** (line 577, `receivedWhen`) | `tbl_user_transaction.createdAt` | same as above |

### Why they differ by ~20 min
- The **in-app "Payment Received" notification** is created at **settlement**:
  `backend/controller/payment/settlement/chainVerification.ts:1996` `createNotification(..., NOTIFICATION_TYPES.PAYMENT_RECEIVED, ...)`.
  For BTC this runs only AFTER on-chain confirmations + sweep → ~20 min after the customer paid. Its
  `created_at = now()` → "45 seconds ago".
- The **tx row `createdAt`** is set when the row is first inserted. In `cryptoCheckout.ts:1133`
  `userTransactionModel.create({... status:"pending" ...})` runs when the **pool/checkout address is
  reserved** (customer opens checkout), i.e. BEFORE the on-chain payment and ~20 min before settlement.
  So the table/widget shows the older time and labels it "Received 20 min ago".

### IMPORTANT unresolved question (confirm on prod before choosing the fix)
There is a conflicting precedent: the **email** "session-49" fix at `chainVerification.ts:1800-1826`
deliberately uses `tbl_user_transaction.createdAt` as the "payment **detection** time" (comment: customer
paid 13:49, handler ran 13:54 → use createdAt=13:49). That implies `createdAt` ≈ payment-detected time,
NOT checkout-open time. Reconcile this: pull the real BTC tx from prod and compare `createdAt` vs the
notification `created_at` and the on-chain first-seen time. Decide which is authoritative.

RO SQL helper: `cd /app/backend && node scripts/ro_query.js "<sql>"` (RO_JSON=1 for json).
Example: `select transaction_id, id, status, "createdAt", "updatedAt" from tbl_user_transaction where crypto_currency='BTC' order by "createdAt" desc limit 5;`
Also confirm which timestamp columns exist on tbl_user_transaction (there is NO models/userTransaction file;
it's a Sequelize `define` — grep for it. The recent-tx + getAllTransactions queries select ONLY `createdAt`,
no `paid_at`/`settled_at`/`last_paid_at`. `updatedAt` likely reflects the last status write = settlement.)

### Two candidate fixes ("best option" — pick after confirming above)
- **(A) Make the notification match the table/email.** Store the payment time in the PAYMENT_RECEIVED
  notification `data` (e.g. `data.paid_at = paymentDateTime.toISOString()` — `paymentDateTime` already
  computed at chainVerification.ts:1805-1826) and have the notification UI render `data.paid_at ?? created_at`
  for payment notifications. Result: notification also shows "~20 min ago", consistent everywhere.
- **(B) Make the table/widget show the settled time for settled rows.** Select `ut."updatedAt"` (and/or add a
  real `settled_at`) in `getRecentTransactions` (dashboardController.ts ~861-912) and `getAllTransactions`
  (`controller/wallet/transactionsList.ts`), and render the settled time for `confirmed/settled` rows while
  keeping `createdAt` for pending ones. Result: table shows "45s ago" for the just-settled payment.

Recommendation: **(A)** is lower-risk and matches the existing email semantics (createdAt = payment time).
It only touches the notification render + adds one metadata field. Confirm createdAt semantics first.

---

## BUG #1 — no merchant/admin email for the BTC payment (investigation; MUST verify on prod)

### Dispatch map (all in `backend/controller/payment/settlement/chainVerification.ts`)
- **Merchant "Payment settled/received" email** — `dispatchCompanyEmail(company_id, "payments", {merchant}, sendPaymentReceivedEmail(...))` at **1929-1950**, wrapped in a Redis dedup guard
  `payment-received-email-${transactionId}` (read 1779; **set `{sent:true}` at 1787-1788 BEFORE sending**, 30-day TTL).
- **Admin fee email** — `sendAdminFeeReceivedEmail(...)` at **1065 / 1077**, gated by `ADMIN_EMAIL` env AND
  `adminAmountToSend > 1e-8`; own dedup key `admin-fee-email-${transactionId}` (**set at 1058-1059 BEFORE sending**).
- **Customer receipt** — dedup `customer-receipt-email-${transactionId}` (**set at 2028-2029 BEFORE sending**).
- **In-app notification** — `createNotification(...)` at **1996**, which is OUTSIDE the merchant-email dedup
  block (the `else` closes at line 1951). ⇒ the notification fires even when the merchant email is skipped.
  **This is why the user saw a notification but no email.**

### Strongest CODE-level root cause (fixable, chain-agnostic — matches "notification yes, email no")
**The dedup keys are set to `{sent:true}` BEFORE the Brevo call, and the send errors are swallowed.**
`sendPaymentReceivedEmail` wraps everything in `try/catch` → `captureError` (paymentEmails.ts:102-104), and
`dispatchCompanyEmail` also catches per-recipient (companyDispatch.ts:40-42). So if Brevo rejects (DKIM/domain
auth), times out, or 4xx's, the email is lost BUT the 30-day dedup key says "sent" → **never retried, silently
dropped**, while the notification (outside the guard) still appears. Same optimistic-dedup anti-pattern on the
admin-fee and customer-receipt emails.

Fix direction: set the dedup key only AFTER a confirmed successful send (or store `{sent:false}` first and flip
to `true` on success; on failure delete the key / short TTL so a sweep-recovery retry can re-send). Add explicit
per-send success/fail logging so prod logs show delivered vs skipped vs errored.

### Other hypotheses to check on PROD (Brevo + prod logs + prod DB), priority order
1. **Stale dedup key** `payment-received-email-<btc-txid>` already in Redis (from an earlier pending/sweep pass)
   → merchant block skipped. Grep prod logs: `Payment received email already sent for tx: <txid>`.
2. **Merchant disabled the "payments" category** → `resolveCompanyRecipients` returns [] and
   `isCategoryDisabled(company, "payments")` true → suppressed (companyDispatch.ts:60-77). Check the company's
   notification prefs (`utils/notificationRecipients.ts`).
3. **Brevo DKIM/domain auth failure for dynopay.com** (previous agent's finding on the Brevo dashboard). NOTE:
   this would hit ALL dynopay.com mail, not just this BTC tx, and some mail IS delivered — so DKIM alone is
   unlikely to be the sole cause. Still verify sender domain auth + check Brevo transactional log for the
   merchant + ADMIN_EMAIL addresses around the tx timestamp (delivered / soft-bounce / blocked / spam).
4. **`sendPaymentReceivedEmail` threw before send** (e.g. a template/i18n error) → swallowed by captureError.
   Check error-monitoring for `extraContext: 'sendPaymentReceivedEmail'`.
5. **Admin email**: `ADMIN_EMAIL` unset in prod, or `adminAmountToSend == 0` (fee_payer edge), or stale
   `admin-fee-email-<txid>` key.

### How to get prod data (pod cannot send mail / may lack prod shell)
- Previous fork generated an SSH keypair `/root/.ssh/dynopay_prod_ed25519`; the owner must add its pub key to
  `root@<droplet>` authorized_keys (see earlier PRD/SWEEP docs). Prod droplet IP referenced in PRD: 134.209.94.115.
- Brevo: check the **Transactional → Logs** for the merchant's email + `ADMIN_EMAIL` (moxxcompany@gmail.com)
  around the BTC tx time, and **Senders & IP → Domains** for dynopay.com DKIM/SPF/DMARC status.
- To render the exact merchant email that WOULD be sent (no delivery), on the pod:
  `cd /app/backend && EMAIL_DUMP_DIR=/tmp/btc_email DISABLE_OUTBOUND_EMAIL=true node_modules/.bin/ts-node --transpile-only scripts/render_email_previews.ts` (or render_dark_mode_fixes.ts). Dumps to HTML.

---

## Key files
- `backend/controller/payment/settlement/chainVerification.ts` — merchant(1929)/admin(1065,1077)/customer(2017+)
  email dispatch + notification(1996); dedup keys set before send (1058, 1787, 2028); paymentDateTime(1805-1826).
- `backend/services/email/companyDispatch.ts` — merchant fan-out + category-disabled suppression.
- `backend/services/email/paymentEmails.ts` — `sendPaymentReceivedEmail` (try/catch swallows errors, :102).
- `backend/utils/mailTransporter.ts` — Brevo API; `DISABLE_OUTBOUND_EMAIL` suppression (:82), retry on 5xx only.
- `backend/controller/payment/cryptoCheckout.ts:1133` — tx row create (status pending) at checkout reservation.
- `backend/controller/dashboardController.ts:834-917` — getRecentTransactions (selects only `createdAt`).
- `backend/controller/wallet/transactionsList.ts` — getAllTransactions (/transactions page source).
- `Components/Page/Notification/NotificationInbox.tsx:278` — notif time = `created_at`.
- `Components/Page/Transactions/index.tsx:241` — table time = `createdAt`.
- `Components/Page/Dashboard/RecentTransactionsWidget.tsx:535,577` — widget time = `createdAt`, "Received {when}".

## Recommended order for next agent
1. Confirm `createdAt` semantics on prod for the specific BTC tx (RO SQL above) → decide Bug #2 approach (A vs B).
2. Bug #1: fix the optimistic-dedup (set key only after successful send) + add send success/fail logging — this
   is the best code-fixable hypothesis and is safe to ship regardless of the Brevo DNS state.
3. Pull Brevo logs + domain auth status to confirm/deny the DKIM angle (owner action if DNS fix needed).
4. Test: backend (curl/settlement sim is OFF on pod — use unit/log assertions + prod log review); frontend
   (screenshot /transactions + /notifications + dashboard widget to confirm consistent times after Bug #2 fix).

## Ops reminders (this pod)
- Preview URL = SERVER_URL in `/app/backend/.env` (test_credentials.md top line has current pod URL).
- Frontend = PRODUCTION Next build (no hot reload): after FE edits rebuild + `sudo supervisorctl restart frontend`.
- Backend = ts-node (no auto-reload): `sudo supervisorctl restart backend`.
- Owner/merchant: onarrival21@gmail.com / Katiekendra123@ (TOTP: `node /app/backend/scripts/print_totp.cjs 1`).
  Admin: moxxcompany@gmail.com / Katiekendra123@. Send a browser User-Agent (curl/python UAs get 403'd).
