
## 8. Severity roll-up → Phase 2 waves
**Blockers (3) — all fixed in Phase 1** (see §2). Nothing else met the blocker bar (wrong/missing money info, dead-end money state,
unusable on phone): no horizontal overflow on any route at any width; no raw i18n keys on pages or emails.

**Should fix (Wave 4 — emails):** paymentPending (network + confirmations + wait), paymentConfirming (opt-in), paymentPartialExpired
completed-partial (money path), autoConversionPayout (wallet + tx link, shorter), withdrawalSuccess (hash/explorer), largeTransaction
(merge into settled), orderReceiptMerchant (money path or link to settled), orderReceipt + customerConfirmation (network + tx link,
refund-policy/merchant contact), orderRefunded (refund crypto/network/hash), subscriptionCreated (CTA + manage path), loginNotification
(merge), retire legacy paymentReceived layout, footer (why-received + notification settings + legal address), preheader everywhere,
unified date/time, CTA deep-links. New emails (decided): **Payout delayed**, **Overpaid**, refund/auto-convert/monthly statement
field additions. Notification controls in Settings → Notifications.

**Should fix (Wave 5 — checkout & buyer pages):** `/payment/success`, `/payment/failed`, `/payment/verify` are near-empty without
query context (dead ends / bare spinner); coin picker lacks per-option network fee + confirmation time, stablecoins-first,
trust cues in first screen; rate-lock colour thresholds + fee disclosure line; `/unsubscribe` and `/wallet-security` invalid-token
states need explanation + support route.

**Should fix (Wave 7 — public):** `/about` legitimacy block (legal entity, address, custody, contact hours); `/fees` worked example;
legal pages TOC + summary; 404 links (status/support); auth invalid-link states next steps.

**Polish (Waves 6/8):** creator page footer weight + 4 preset chips at 390; product page sticky buy bar check; docs phone jump-nav;
in-app pages per Part E (create-pay-link live preview, link detail funnel, KYC timeline, help pre-fill).

## 9. Files created / changed in Phase 1
- New: `backend/services/email/paymentSettled.ts`, `backend/scripts/audit_render_all_emails.ts`,
  `backend/scripts/inject_payment_settled_i18n.py`, `scripts/qa/audit_page_shots.mjs`, `scripts/qa/audit_email_structure.py`,
  `scripts/qa/build_audit_gallery.py`, `scripts/qa/build_audit_report.py`, `plan/audit/findings.json`, `plan/audit/audit_phase1_head.md`,
  `plan/audit/audit_phase1_tail.md`, `public/audit/**` (git-ignored).
- Changed: `backend/services/email/paymentEmails.ts` (moneyPath param + settled layout), `accountEmails.ts` (OTP subjects),
  `adminOpsEmails.ts` (duplicate greeting), `controller/payment/settlement/chainVerification.ts` (money path + explorer import),
  `services/merchantPool/merchantPoolSweep.ts` (money path in sweep recovery), `routes/testRouter.ts` (test hook sample),
  `backend/locales/{en,de,es,fr,pt,nl}/emails.json` (+`paymentSettled.*`), `scripts/qa/email_dark_shots.mjs` (--width/--modes/--full-slug),
  `.gitignore` (+`public/audit/`).

## 10. Re-running
```
cd /app/backend && node_modules/.bin/ts-node --transpile-only scripts/audit_render_all_emails.ts
cd /app && export PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell
node scripts/qa/email_dark_shots.mjs --in=/app/plan/audit/emails/html --out=/app/public/audit/emails --width=600 --full-slug   # and --width=390
node scripts/qa/audit_page_shots.mjs --base=<preview> --set=public --out=/app/public/audit/pages   # and --set=inapp; add --merge --routes=a,b to re-shoot
python3 scripts/qa/audit_email_structure.py && python3 scripts/qa/build_audit_report.py && python3 scripts/qa/build_audit_gallery.py
```
