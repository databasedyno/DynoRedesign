# Dynopay email audit — every trigger, current copy, proposed copy

Scope: every outbound email in `backend/` (services/email/*, refund templates, OTP helpers, admin/ops alerts). Copy source is
`backend/locales/<lang>/emails.json` (6 languages) unless marked **hardcoded** (English only, in the .ts file).

## House rules proposed for all emails
1. **Subject = what happened + the one number that matters.** ≤ 55 chars, sentence case, no emoji, no "Great news".
2. **Body = 3 beats, max ~60 words:** (1) one sentence saying what happened, (2) one data box with only the rows a reader acts on, (3) one next step / one button. No second CTA in the text when there is a button.
3. **Cut boilerplate**: "You can view details in your dashboard", "Keep growing your business", "We're excited…", estimated-time tables, "This is a regulatory requirement…", repeated status rows (a "Payment received" email does not need a `Status: Received` row).
4. **Security emails end with one identical line:** *"Not you? Secure your account →"* (button) — never a numbered 3-step list.
5. **Vocabulary**: brand (not company), payout wallet, buyer / merchant, "confirmed" (not "credited"), amounts as `$15.00 · 0.2 LTC`.
6. **One OTP template** (6-digit block, expiry line, "never share") — today 4 flows use a raw *"OTP for login – Here is your login code: 123456"* body.

Legend: **T** trigger · **To** recipient · **S** subject · **B** body. `→` = proposed.

---

## A. Buyer / customer emails

### A1. Payment confirmed (receipt) — `sendCustomerPaymentConfirmationEmail`
**T** payment reaches confirmed/settled (settlement/verifyPayment) and the buyer left an email · **To** buyer · PDF receipt attached.
**S** `Your payment to {{companyName}} is confirmed` → keep.
**B** "Payment Successful / Your payment to X has been successfully processed." + box (amount paid, crypto, fee split rows, date, tx id) + "PDF Receipt Attached — a detailed receipt is attached to this email for your records." + "If you have any questions… contact X directly." + "This payment was processed securely through Dynopay, a non-custodial crypto payment gateway."
→ **Heading** "Paid — thank you". **Body:** "You paid **{{companyName}}** {{amount}} ({{crypto}}). Your receipt is attached." + box: You paid · Paid with · Date · Reference. Button *View receipt online*. Footer line: "Questions about this purchase? Contact {{companyName}} directly." *(drop the "securedBy" paragraph and the "PDF attached" paragraph — the paperclip and the button already say it).*

### A2. Contribution thank-you (donation/tip variant of A1)
**S** `Thank you for contributing to {{campaignName}}` → `Thanks for supporting {{campaignName}} — {{amount}}`.
**B** "Your contribution to X just landed — thank you… The organizer may email you campaign updates… Questions? Reply to this email and the organizer will get back to you."
→ "Your {{amount}} for **{{campaignName}}** is in. Receipt attached." + box (You gave · Campaign · Date). One line: "The organizer can see your support and may send campaign updates." *(drop "reply to this email" — replies go to Dynopay, not the organizer).*

### A3. Payment window closed after partial payment — `sendBuyerPaymentExpiredEmail`
**T** partial payment grace period expires (paymentController) · **To** buyer.
**S** `Your payment to {{companyName}} didn't complete` → `Your payment to {{companyName}} is short by {{remaining}}`.
**B** "Payment window closed / You sent a partial payment… but the remaining amount didn't arrive before the window closed." + box (You sent, Amount due) + "What happens next: X has been notified and can see exactly what arrived. Please contact them directly to settle the difference or arrange a refund of the partial amount."
→ "We received **{{received}}** of the **{{due}}** owed to {{companyName}} before the payment window closed." + box (You sent · Amount due · Still missing). "**{{companyName}}** has the details and will either collect the difference or refund you — contact them to arrange it."

### A4. Payment link reminders (3 stages) — `sendPaymentLinkReminderEmail` *(hardcoded, cron)*
**T** cron `paymentLinkReminder` for unpaid links that have a customer email · **To** buyer.
**S** stage 1 `Complete your payment to {{company}}` · stage 2 `Your payment to {{company}} is still pending` · stage 3 `Payment expires soon - {{company}}` / `Final reminder: Payment pending - {{company}}`.
→ `{{company}}: {{amount}} payment link waiting` · `Reminder: {{amount}} to {{company}} is still unpaid` · `Last chance — link to {{company}} expires in {{time}}`.
**B** "You have X to complete this payment / We noticed you haven't completed your payment yet. Need help? / This is a final reminder…" + link box.
→ One template, one variable line: "**{{company}}** sent you a request for **{{amount}}**. {{It expires in {{time}} | It's still open}}." + button *Pay {{amount}}*. Final stage adds: "After that the link closes and you'll need a new one from {{company}}." *(localize — today English only).*

### A5. Payment request — `sendPaymentRequestEmail`
**T** merchant sends a payment link by email · **To** buyer.
**S** `{{companyName}} sent you a payment request – {{amount}} {{currency}}` → `{{companyName}} requests {{amount}} {{currency}}`.
**B** "X is requesting a payment from you. Review the details below and pay securely with crypto." + box (amount, description, expires) + "The payment page shows the exact crypto amount and the coins you can pay with. If you weren't expecting this request, you can simply ignore this email."
→ Keep intro; box (Amount · For · Expires); button *Pay now*. Replace outro with one line: "Not expecting this? Ignore it — nothing is charged until you pay."

### A6. Order receipt — `sendOrderReceiptEmail`
**T** cart order → paid (orderFulfillmentService) · **To** buyer.
**S** `Your order {{ref}} is confirmed` → keep.
**B** "Thanks for your purchase! Your payment has been received and your order is confirmed." + verified line + ref box + items table + digital note ("Download links above are valid for 24 hours. Need a fresh link? Open your order page.") + physical note + "View order details →" link.
→ "Order **{{ref}}** is paid. Here's what you bought:" + items table (downloads inline) + one situational line: digital → "Download links work for 24 h — open your order page any time for fresh ones." physical → "{{companyName}} will email tracking when it ships." Button *View order*.

### A7. Order not completed — `sendOrderExpiredEmail` *(hardcoded, cron)*
**S** `Your order {{ref}} wasn't completed` → `Order {{ref}} expired — items returned to the shop`.
**B** "It looks like your recent order was not paid before the checkout window closed, so we've released it and returned the items to the shop's stock." + ref + items + "If this was intentional — no worries. If you still want these items, you can start a fresh cart: Return to the shop →"
→ "Order **{{ref}}** wasn't paid in time, so we released it." + items table + button *Start a new cart*. *(drop "If this was intentional — no worries".)*

### A8. Order refunded — `sendOrderRefundedEmail` *(hardcoded)*
**S** `Refund confirmed for order {{ref}}` → `Refund on the way for order {{ref}}`.
**B** "Your recent order has been refunded by the merchant. Depending on the network, the crypto refund may take a few blocks to appear in your wallet." + ref + merchant note + items + "View order status →".
→ "**{{companyName}}** refunded order **{{ref}}**. Crypto refunds usually land within a few blocks." + merchant note (if any) + items. Button *View order*.

### A9. Order shipped — `sendOrderShippedEmail` *(hardcoded; template only — no caller yet)*
**S** `Your order {{ref}} has shipped` → keep. **B** "Great news — your order is on its way!" + tracking box → drop "Great news"; "Order **{{ref}}** shipped with {{carrier}}." + tracking box + button *Track / View order*.

### A10. Download links expiring — `sendDigitalDownloadReminderEmail` *(hardcoded, cron 6 h before expiry)*
**S** `Your download links expire soon (order {{ref}})` → `Your downloads for order {{ref}} expire in 6 hours`.
**B** two paragraphs + items + "Refresh download links →" → one line: "The download links from order **{{ref}}** stop working in about 6 hours. Refresh them any time from your order page — new links last 24 h." Button *Refresh downloads*. *(drop the items table.)*

### A11. Crypto refund in progress / complete — `buildRefundEmail` *(hardcoded, dark "shell" template — off-brand vs. every other email)*
**S** `Your Dynopay refund of {{amount}} is on its way` / `… is complete` → `Refund of {{amount}} on its way from {{companyName}}` / `Refund of {{amount}} received? — it's complete`.
**B** OK but uses a different visual template. → Move both onto `dynoPayEmailTemplate`, name the merchant (buyers know the shop, not "Dynopay"), keep tx link button.

### A12. Referral invite after paying — `sendRefereeInviteEmail`
**T** buyer completes a payment (postPaymentInvite / backfill) · **To** buyer.
**S** `You've got {{discountPercent}}% off Dynopay fees` → `Get paid in crypto too — {{discountPercent}}% off for {{days}} days`.
**B** "Thanks for paying with Dynopay! Did you know you can accept crypto payments for your own business too?" + gift box + "Why Dynopay?" 4 bullets + code.
→ "You just paid {{companyName}} with Dynopay. If you sell anything, you can accept crypto the same way — and your first {{days}} days are {{discountPercent}}% off." + code box + button *Start free*. Cut the 4-bullet "Why Dynopay" list to one line: "Non-custodial, 15+ coins, no chargebacks."

### A13. Referral code reminders (week 1/2/3/final) — `sendRefereeCodeReminderEmail` *(cron)*
**S** `Don't forget your exclusive Dynopay offer` / `Your X% discount is waiting` / `Only N days left…` / `Last chance: your Dynopay discount expires in N days`
→ `{{discount}}% off Dynopay fees — {{days}} days left` (same shape all four weeks; final: `Ends in {{days}} days: {{discount}}% off Dynopay fees`).
**B** "We noticed you haven't claimed your exclusive Dynopay discount yet." + urgency line + offer box → one line "Your code **{{code}}** still gives {{discount}}% off fees for {{days}} days." + button. Drop the red "Final reminder:" styling and "This is your last chance."

### A14. Campaign update to contributors — `sendCrowdfundingUpdateEmail`
**S** `{{title}} — update from {{campaign}}` → keep. **B** fine; drop "You're receiving this because you previously contributed" into the footer.

### A15. Subscription confirmed / cancelled / payment failed (buyer side) — `sendSubscription*Email`
**S** `Subscription confirmed – {{planName}}` → `You're subscribed to {{planName}} ({{companyName}})`; `Subscription cancelled – {{planName}}` → `{{planName}} cancelled — access until {{effectiveDate}}`; `Payment failed for {{planName}}` → `Action needed: {{planName}} payment didn't go through`.
**B** keep the facts; cut "You can cancel anytime", "If you change your mind, you can always resubscribe", and the 3-step "To keep your subscription active" list → one line + button *Pay now*.

---

## B. Merchant — payment lifecycle

### B1. Payment received — `sendPaymentReceivedEmail`
**T** payment confirmed & forwarded (settlement, chainVerification, merchantPoolSweep) · **To** brand owner + notify contacts (`dispatchCompanyEmail`).
**S** `Payment received – {{amount}} {{currency}}` → `{{companyName}}: {{amount}} {{currency}} received`.
**B** "Great news! Your brand X has received a payment." + box (Amount, Crypto, Payment method, **Status: Received**, Date, Tx id) + referral-credit line + "The funds have been forwarded to your payout wallet. You can view the full transaction details in your dashboard."
→ "**{{amount}} {{currency}}** ({{crypto}}) landed for **{{companyName}}** and is on its way to your payout wallet." + box (Amount · Paid in · Via · Reference). Button *View transaction*. *(drop Status row, "Great news", and the dashboard sentence.)*

### B2. Payment detected / pending — `sendPaymentPendingEmail` ← the example from the brief
**T** unconfirmed tx seen on-chain (pendingPaymentService, 0-conf) · **To** brand owner + contacts.
**S** `Payment detected – confirming on-chain` → `{{amount}} {{currency}} incoming for {{companyName}} — confirming`.
**B** "Payment Pending / A new payment has been detected for your brand X!" + box (Amount, Crypto, Status: Awaiting Confirmation, Tx id) + **"Estimated Confirmation Times" table (BTC 10-60 min, ETH 1-5, TRX 1-3, LTC/DOGE)** + "We'll notify you once the payment is fully confirmed and credited to your wallet. You can track the transaction status in your Dynopay dashboard."
→ "A **{{amount}} {{currency}}** payment ({{crypto}}) is confirming on the {{network}} network for **{{companyName}}**. We'll email you when it's final — nothing to do yet." + box (Amount · Paid in · Reference). Button *Track it*. **Delete the estimated-times table entirely** (we know the coin — if anything, one line: "Usually {{eta}} on {{network}}." using the checkout's `NETWORK_ETA`).

### B3. Payment confirming (n of N) — `sendPaymentConfirmingEmail`
**T** confirmation count changes on multi-confirmation coins · **To** merchant.
**S** `Payment confirming – {{current}} of {{required}} confirmations` → keep numbers, shorten: `{{current}}/{{required}} confirmations — {{amount}} {{currency}}`.
**B** "Good news! Your payment for X is being confirmed." + box + "N more confirmations needed before the payment is credited. You can track the full status in your Dynopay dashboard."
→ **Recommend removing this email** (B2 + B1 already bracket the flow; intermediate counts are noise). If kept: single line "{{current}} of {{required}} confirmations so far — we'll email when it's final." No CTA sentence.

### B4. Transaction {{status}} — `sendTransactionConfirmedEmail` *(legacy; only exported via emailService barrel, no live caller)*
**S** `Transaction {{status}}` **B** "Your transaction has been {{statusLower}}. You can view more details…" → **Delete** (redundant with B1).

### B5. Partial payment received — `sendPaymentPartialEmail`
**S** `Partial payment received — action needed` → `Short payment: {{received}} of {{expected}} {{currency}} — {{companyName}}`.
**B** intro + box + "Action Required — You have N minutes to send the remaining X…" + "Send to:" address + grace note.
→ *This goes to the merchant, but the "you have N minutes to send the remaining" text is written to the buyer.* Rewrite for the merchant: "A buyer sent **{{received}}** of **{{expected}} {{currency}}**. They have {{minutes}} min to send the remaining **{{remaining}}**; if it doesn't arrive we settle what was received with fees adjusted." + box (Received · Expected · Remaining · Window closes). Button *View payment*.

### B6. Partial payment processed / grace expired — `sendPaymentPartialExpiredEmail`
**S** `Partial payment processed` / `Partial payment expired` → `Settled short: {{received}} of {{expected}} {{currency}}` (one subject; the body states which).
**B** two near-identical paragraphs + "Please note that fees may be higher for incomplete payments" + "You can view the transaction details…"
→ "The buyer never sent the remaining **{{remaining}}**, so we settled the **{{received}} {{currency}}** that arrived to your payout wallet (fee adjusted)." + box. Button *View payment*.

### B7. Payment failed / underpaid (merchant + customer) — `sendPaymentFailedEmail` *(no live caller — legacy)*
→ **Delete**, or fold "underpaid" into B5/B6 and "expired" into A3.

### B8. Overpayment — `notifyOverpayment` (merchant) + admin copy
**S** `Overpayment received — {{excess}} extra` → `A buyer overpaid {{companyName}} by {{excess}}`.
**B** "A customer just completed a payment to X and sent MORE than the amount due." + box + "You've been credited your full expected amount. The extra… was routed to Dynopay per your account's overpayment policy, so there's nothing you need to do."
→ "You received the full **{{expected}}**. The buyer sent **{{excess}}** (≈{{excessFiat}}) extra, which went to Dynopay under your overpayment policy — nothing to do." + box (Expected · Received · Extra). Button *View transaction*. *(Consider adding "Change policy" link.)*

### B9. Large payment — `sendLargeTransactionAlertEmail`
**S** `Large payment received – {{amount}} {{currency}}` → `Large payment: {{amount}} {{currency}} to {{companyName}}`.
**B** "…may require your attention… This payment has been automatically processed and forwarded… For large transactions, we recommend: 1. Verify… 2. Confirm delivery… 3. Keep records…"
→ "**{{amount}} {{currency}}** just settled to your payout wallet — flagged because it's well above your usual size. Worth a second look before you ship." + box. Button *Review payment*. *(drop the 3-point list.)*

### B10. Auto-conversion payout complete — `sendAutoConversionPayoutEmail`
**S** `Payout Complete — {{payout}} {{target}} from {{source}} {{sourceCur}}` → `{{payout}} {{target}} paid out ({{source}} {{sourceCur}} converted)`.
**B** "Your crypto payment has been auto-converted and the payout has been sent to your wallet." + big box + "Auto-conversion ensures you receive stablecoins, protecting your revenue from crypto price swings. View your full transaction history…"
→ "We converted **{{source}} {{sourceCur}}** → **{{payout}} {{target}}** and sent it to your payout wallet." + box (Received · Rate · Fee · Paid out · Tx / off-chain ref). Button *View payout*. *(drop the marketing sentence.)*

### B11. Auto-conversion failed — `sendConversionFailedEmail`
**S** `Action needed — auto-conversion of {{amount}} failed` → `Conversion of {{amount}} failed — funds held safely`.
**B** already good (safe-funds line, retry CTA). Trim the reason row to one line; keep.

### B12. Weekly conversion report — `sendWeeklyConversionSummaryEmail` *(hardcoded subject)*
**S** `Weekly Conversion Report — N conversions, $X paid out` → `Last week: {{n}} conversions, {{payout}} paid out`. **B** keep table; drop intro sentence.

### B13. Weekly payout digest — `payoutDigestService`
**S** `Weekly payout digest — {{amount}}` / `… quiet week ahead of a new one` → `Your week on Dynopay: {{amount}} settled` / `Your week on Dynopay: nothing settled yet`. **B** fine; remove "Here's how the last 7 days looked for your business on Dynopay." (the heading says it).

### B14. Weekly summary — `sendWeeklySummaryEmail` *(cron)* — **duplicate of B13.** Recommend **retiring** it (two weekly emails with the same numbers).

### B15. Invoice generated — `sendInvoiceGeneratedEmail`
**S** `Invoice {{number}}` → `Dynopay fee invoice {{number}} — {{amount}}`. **B** "Your invoice has been successfully generated for transaction #… You can view and download…" → "Invoice **{{number}}** for our fee on payment {{txId}} is ready (PDF attached / button)." *(drop "successfully".)*

### B16. Fee tier upgrade — `sendVolumeTierUpgradeEmail`
**S** `You just unlocked the {{tier}} tier — {{pct}}% fees` → `Your Dynopay fee is now {{pct}}% ({{tier}} tier)`. **B** good; drop "Thanks for building on Dynopay." and "the next tier down is waiting for you".

### B17. New contribution (donation/tip to the merchant) — `contributionReceived.*` variant of B1
**S** `You just received a contribution — {{amount}} {{currency}}` → `{{amount}} {{currency}} contribution to {{campaignName}}`. **B** "Someone just supported X — here are the details… You'll find the full donor list in your campaign dashboard." → "**{{donor|Someone}}** gave **{{amount}}** to **{{campaignName}}**{{ · "message"}}." + box. Button *View campaign*.

### B18. New sale (store) — `sendOrderReceiptMerchantEmail` *(hardcoded)*
**S** `New sale – {{total}}` (brand-prefixed) → keep. **B** "You just made a new sale on X! Order Y has been paid in full and settled to your wallet." → drop "!" and "in full"; keep buyer + shipping + items. Button *Open order*.

### B19. Merchant refund record — `buildMerchantRefundEmail` *(dark shell)*
**S** `Refund of {{amount}} to {{customer}} is complete` → keep; move to the standard template.

---

## C. Merchant — account & security

### C1. Welcome — `sendWelcomeEmail`
**S** `Welcome to Dynopay – Let's get you paid` → `Welcome to Dynopay — your first payment is fee-free`.
**B** two intro paragraphs + promo + "Here's what you can do next: 1. Complete your brand profile 2. Add your payout wallet 3. Start accepting payments" + "If you have any questions, our support team is here to help."
→ "You're in. Two things unlock payouts: add a **payout wallet** and create a **payment link**. We waive our whole fee on your first settled payment." Button *Set up in 2 minutes*. *(drop "We're excited…", "Whether you're a freelancer…", and the support line.)*

### C2. Sign-up verification code — `registerEmailStep1` *(hardcoded via generic sendEmailOTP)*
**S** `Verify your email to finish signing up · Dynopay` → `{{code}} is your Dynopay sign-up code`.
**B** raw: "Hey there, Welcome to Dynopay! Here is your sign-up verification code: 123456" (no OTP block, no expiry, English only).
→ Use the OTP template: heading "Confirm your email", 6-digit block, "Expires in 10 minutes. Didn't sign up? Ignore this."

### C3. Login code — `sendEmailOTP` default *(hardcoded)* **← copy bug**
**T** passwordless login, SMS fallback · **To** merchant. **S** `OTP for login` **B** "Hey X, Here is your login code: 123456".
→ `{{code}} is your Dynopay login code` + OTP template ("Expires in 10 minutes. Never share this code — Dynopay will never ask for it."). *(The localized `merchant.loginOtp.*` copy already exists but isn't used here.)*

### C4. Password-reset code — `passwordReset.ts` → generic `sendEmailOTP` **← copy bug**
Currently sends **"OTP for login / Here is your login code"** for a password reset. → `{{code}} is your password reset code` + OTP template: "Use this code to choose a new password. Didn't ask for this? Ignore it — your password stays the same." *(i18n `merchant.forgotPasswordOtp.*` exists; wire it.)*

### C5. Email-change / set-password codes — `contactEmail.ts`, `profileSecurity.ts` → generic `sendEmailOTP` **← copy bug**
Same "OTP for login" body. → `{{code}} to confirm your new email` / `{{code}} to set your password`, OTP template, one purpose line each.

### C6. Email verify code (onboarding) — `sendEmailVerificationOTPEmail`
**S** `Verify your email` → `{{code}} is your Dynopay verification code`. **B** fine; shorten intro to "Enter this code to confirm {{email}}."

### C7. Password changed — `sendPasswordChangedEmail`
**S** `Password updated successfully` → `Your Dynopay password was changed`. **B** "…successfully updated. Security Notice: If you didn't make this change, please contact our support team immediately…" → "Your password was changed on {{date}} from {{device/location}}." + rule-4 line + button *Secure my account*.

### C8. Profile updated (+ notice to old address) — `sendUserProfileUpdatedEmail`
**S** `Account profile updated` → `Your account details were changed`; old-address notice `Your Dynopay email address has been changed` → `Your Dynopay login email moved to {{newEmail}}`. **B** list only the changed fields; rule-4 line.

### C9. Creator handle reserved / changed — `sendCreatorHandleUpdatedEmail` *(hardcoded)*
**S** `Your handle @{{h}} is reserved` / `Your handle is now @{{h}}` → `@{{h}} is yours — dynopay.com/{{h}}` / `Your page moved to dynopay.com/{{h}}`. **B** fine; drop the Date row (never actionable); for changes keep "update links you've already shared".

### C10. Security alert (OTP lockout / login rate-limit) — `sendSecurityAlertEmail`
**S** `Security alert on your account` → `Blocked: {{count}} failed sign-in attempts` / `Verification code locked after 5 wrong tries`. **B** "We detected unusual activity…" + details + "Was this you?… Didn't perform this action? Please secure your account immediately by: 1. Changing your password 2. Reviewing… 3. Contacting…" → one line stating the event + box (When · IP · Location) + rule-4 button.

### C11. Sign-in notification (known device, throttled) — `sendLoginNotificationEmail`
**S** `New sign-in to your Dynopay account` → `Signed in from {{location}} on {{device}}`. **B** long "Was this you? / Not you?… We'll lock your account and require identity verification…" → box (Device · Location · When) + rule-4 button *This wasn't me*. *(Consider sending this only for new devices — see C12 — and dropping the throttled known-device version.)*

### C12. New device alert — `sendNewDeviceAlertEmail` *(hardcoded)*
**S** `New device signed in to your Dynopay account` → `New device: {{device}} in {{location}}`. **B** already the right shape; localize.

### C13. Failed login attempts — `sendFailedLoginAttemptsEmail` — overlaps with C10 (`login_rate_limit`). → **Merge into C10**.

### C14. 2FA on / off / backup codes — `send2FA*Email`
**S** `Two-factor authentication is on` → `2FA is on for your account`; `…turned off` → `2FA was turned off — was that you?`; `New 2FA backup codes generated` → `Your 2FA backup codes were replaced`. **B** fine — drop the "tip" paragraphs, keep rule-4 line on off/backup.

### C15. Phone added / changed / removed — `sendPhoneChangedEmail` — **S** fine; **B** one line + masked number row + rule-4.

### C16. Account deleted / suspended / closed / reactivated — `sendAccountDeletedEmail`, `sendAccountStatusEmail`
**S** OK. **B** deleted: drop "We're sorry to see you go… welcome back any time." → keep the data list + "Didn't request this? Contact support now." suspended/closed: keep; reactivated: one line.

### C17. Team member joined — `sendTeamMemberJoinedEmail` *(hardcoded)* **S** `{{member}} joined {{company}} on Dynopay` → `{{member}} accepted your invite to {{brand}}`; body: one line + role row + button *Manage team*.

### C18. Brand created ("one step left") — `sendCompanyProfileCreatedEmail`
**S** `Profile complete – One step left` → `{{brand}} is set up — add a payout wallet to get paid`. **B** "Great job!… You're almost ready… Why add a wallet? Your wallet is where we'll send…" → one line: "Payments to **{{brand}}** settle straight to a wallet you control — add one now and you can take your first payment today." Button *Add payout wallet*.

### C19. Brand contact welcome — `sendCompanyContactWelcomeEmail` (to the brand's contact email when ≠ owner)
**S** `Welcome to Dynopay – {{brand}} is now registered` → `{{accountHolder}} added {{brand}} to Dynopay`. **B** cut the 3-point "What this means for you" list → "{{accountHolder}} registered **{{brand}}** on Dynopay and listed this address as its contact. You'll receive payment and payout notices for {{brand}} here." + button. (Unsubscribe/contact-change hint.)

### C20. Brand profile updated — `sendCompanyProfileUpdatedEmail` **S** `Your brand profile was updated` → `{{brand}} details were changed`; **B** list changed fields + rule-4.

### C21. Brand delete OTP / brand deleted — `sendCompanyDeleteOTPEmail`, `sendCompanyDeletedEmail` **S** `Confirm brand deletion – {{brand}}` → `{{code}} to delete {{brand}}`; `Brand deleted – {{brand}}` → `{{brand}} was deleted`. **B** good; trim the "What was removed" list to one line.

### C22. API key created / regenerated / revoked — `sendApiKey*Email`
**S** `API key created – {{keyType}} environment` → `New {{live|test}} API key for {{brand}}`; regenerated → `{{live|test}} API key rotated — old key stopped working`; revoked → `{{live|test}} API key deleted — integrations using it will fail`. **B** one line + key preview row + rule-4. Drop "Keep it secure and never share it publicly" (they never see the key in the email).

### C23. Webhook auto-disabled / redirects — `sendWebhookDisabledEmail`, `sendWebhookRedirectEmail` *(hardcoded)*
**S** `Action needed – webhook delivery paused for {{company}}` → `Webhooks paused for {{brand}} after {{n}} failed deliveries`; `Heads up – your webhook URL redirects ({{company}})` → `Your webhook URL redirects — update it to {{finalUrl}}`. **B** disabled: keep the 3 steps (genuinely needed), cut the "If you don't recognize this endpoint" paragraph. Redirect: cut to two lines: "We're following a {{status}} redirect to {{finalUrl}} on every delivery. Point your webhook there directly to remove the extra hop." Button *Update webhook*.

---

## D. Merchant — payout wallets

### D1. Wallet address verification code — `walletOtp.updateOtp` (`walletOtp.*`)
**S** `Confirm your wallet address` → `{{code}} to confirm your {{currency}} payout wallet`. **B** "You are validating a new wallet address for X." + address + expiry → OTP template + masked address row.

### D2. Wallet update / edit / delete / withdrawal / exchange OTPs — `sendWalletUpdateOTPEmail`, `sendWalletDeleteOTPEmail`, `sendWithdrawalOTPEmail`, `sendExchangeOTPEmail`
**S** `Confirm wallet update` / `Confirm wallet deletion` / `Confirm your withdrawal` / `Confirm your exchange` → `{{code}} to update your payout wallet` / `{{code}} to delete a payout wallet` / `{{code}} to withdraw {{amount}} {{currency}}` / `{{code}} to confirm your exchange`. **B** all → the one OTP template with one purpose line + expiry.

### D3. Wallet management unlock code — `sendWalletSudoOTPEmail` *(hardcoded)*
**S** `Your wallet management code` → `{{code}} to unlock wallet changes (10 min)`. **B** good — localize.

### D4. Wallet added / updated / removed — `sendWalletAddedEmail`, `sendWalletUpdatedEmail`, `sendWalletDeletedEmail`
**S** `Wallet added – {{network}}` → `{{network}} payout wallet added to {{brand}}`; `Wallet updated – {{network}}` → `{{network}} payout wallet changed on {{brand}}`; `Wallet removed from your account` → `{{network}} payout wallet removed from {{brand}}`. **B** one line + masked address (old → new) + rule-4. Drop "All payments in X will be forwarded to this wallet. You can manage your wallets in the dashboard."

### D5. Batch summary — `sendWalletBatchSummaryEmail` *(hardcoded)* **S** `Your payout wallets were updated` → `{{n}} payout wallets changed on {{brand}}`; body fine.

### D6. Wallet change alert with one-tap undo — `sendWalletChangeAlertEmail` *(hardcoded)* **S** keep pattern `Payout wallet changed — {{network}}`; body already tight. Localize.

### D7. "We've secured your account" — `sendWalletSecuredEmail` **S** → `Wallet change undone — wallet edits are now locked`. Body good.

### D8. Add-wallet reminder — `sendAddWalletReminderEmail` *(cron)* **S** `You're almost ready to accept payments` → `{{brand}} can't get paid yet — add a payout wallet`. **B** "You're so close!… Why add a wallet? Without a wallet, you can't receive payments. It takes less than 2 minutes…" → one line + button. *(Overlaps with C18 and E2 wallet gate — keep only one reminder cadence.)*

### D9. Withdrawal submitted — `sendWithdrawalSuccessEmail` **S** `Withdrawal submitted – {{amount}} {{currency}}` → `{{amount}} {{currency}} withdrawal sent`. **B** two outro paragraphs → one: "Broadcast to {{network}}; usually confirms in {{eta}}." + tx hash row.

### D10. `merchant.walletVerified.*` and `merchant.walletEditOtp.*` — i18n keys with **no sender** → delete keys.

---

## E. Onboarding, activation, KYC

### E1. Activation drip d1 / d3 / d7 — `sendActivationEmail` *(cron)*
**S** `You're set up — here's how to get your first payment` / `Still here to help you get paid` / `Your Dynopay account is ready when you are` → `Next step: {{segmentCta}}` (d1) / `Still one step from your first payment` (d3) / `Pick up where you left off — {{segmentCta}}` (d7). **B** already segment-based (made link / no link / fundraiser); drop the intro paragraph so each email is: one segment line + button + unsubscribe.

### E2. Activation gate (brand / wallet / KYC missing when creating a link) — `sendActivationGateEmail`
**S** `Finish setting up to get paid` → `Add a {{brand|payout wallet}} to publish your payment link` / `Quick ID check needed to create new links`. **B** good; drop "It takes just a minute, and you'll pick up exactly where you left off."

### E3. KYC required (volume threshold) — `sendKYCRequiredEmail`
**S** `Verification required at {{threshold}} volume` → `You passed {{threshold}} — verify your identity to keep accepting payments`. **B** "Congratulations on reaching X!… This is a regulatory requirement and helps us keep Dynopay secure. What you need: 1. ID 2. selfie 3. ~5 minutes…" → "You've processed **{{volume}}**. Past **{{threshold}}** we need a one-time ID check (photo ID + selfie, ~5 min) before new payments." Button *Verify now*.

### E4. KYC started — `sendKYCStartedEmail` → **Recommend removing** (user just clicked "Start" in the app; the email repeats the screen). If kept: `Finish your ID check` + button only.

### E5. KYC approved — **S** `Verification approved – You're all set` → `You're verified — no limits on payments`. **B** drop "Keep growing your business with Dynopay!"

### E6. KYC rejected / resubmission — **S** `Verification unsuccessful` → `We couldn't verify your ID — {{reason}}`; `Additional information needed for verification` → `One more thing for your ID check`. **B** keep reason box; collapse the numbered tips to one line: "Use a clear photo of an unexpired ID in the same name as your account."

---

## F. Merchant — links, campaigns, subscriptions

### F1. Payment link created — `sendPaymentLinkCreatedEmail` → **Recommend removing** (they just created it and see the success modal with copy/QR). If kept: `Link ready: {{amount}} {{currency}}` + URL row + button *Open link*.
### F2. Crowdfunding campaign live — `sendCrowdfundingCampaignCreatedEmail` **S** `Your crowdfunding campaign is live — {{title}}` → `{{title}} is live — share it`. **B** drop "You can track progress from your dashboard."
### F3. Subscription created / cancelled / failed (merchant side) **S** `New subscriber – {{plan}}` → `New subscriber to {{plan}} — {{amount}}/{{interval}}`; `Subscription cancelled – {{name}}` → `{{name}} cancelled {{plan}}`; failed → `{{name}}'s {{plan}} payment failed`. **B** one line + box.

---

## G. Referral program (referrer)

### G1–G8 `sendReferral*Email` *(all hardcoded, English only, emoji subjects)*
| # | Now | → Proposed |
|---|---|---|
| Payout ready | `You can cash out $X in referral rewards 🎉` | `$X in referral rewards ready to cash out` |
| Auto-pay on | `Auto cash-out is on for your referral rewards` | `Auto cash-out on — pays at $X to …{{addr}}` |
| Payout requested | `Your $X referral cash-out is on the way` | `$X referral payout sent to …{{addr}}` |
| Payout failed | `Your $X referral cash-out couldn't be sent` | `$X referral payout failed — balance kept` |
| Accrual | `You just earned $X in referral rewards 🎉` | `+$X from {{merchant}} — referral rewards` |
| Activated | `{{merchant}} just went live — your rewards start now 🚀` | `{{merchant}} took their first payment — you earn 25% of their fees` |
| Monthly digest | `Your referrals earned you $X in {{month}} 🎉` | `{{month}} referrals: $X earned` |
| Share nudge | `Your Dynopay referral link is ready — earn 25% for a year 💸` | `Earn 25% of every referred merchant's fees for 12 months` |
**B** (all): keep the data box; remove "Hey X," + "Nice work / Good news / Great news" openers, the repeated "switch to USDT (TRC-20) cash-out on your referrals page" paragraph (say it once in the digest), and "Keep sharing your link…". Localize.

---

## H. Internal / admin & ops (moxxcompany@ / ops inbox)

| Email | Now | → Proposed |
|---|---|---|
| New merchant registration — `sendNewUserAdminNotification` | `New Merchant Registration — {{name}} · {{country}} · {{method}}` | keep |
| Onboarding stuck — `sendOnboardingStuckAdminEmail` | `{{urgency}} Onboarding Stuck — {{name}} at "{{step}}" ({{h}}h)` | `Stuck {{h}}h at {{step}}: {{name}}` |
| Onboarding complete | `✅ Onboarding Complete — {{name}} is ready to accept payments` | `Onboarded: {{name}} (ready to accept payments)` |
| First payment | `🎉 First Payment! — {{merchant}} received {{amount}} {{cur}}` | `First payment: {{merchant}} · {{amount}} {{cur}}` |
| **New visitor** — `sendNewVisitorAdminEmail` (trackRouter) | `👀 New Visitor — {{country}} via …` | **Retire** — one email per anonymous visit is inbox noise; keep it in the dashboard/analytics only |
| Platform fee received — `sendAdminFeeReceivedEmail` | `Platform fee received – {{fee}} {{cur}}` | `Fee {{fee}} {{cur}} from {{brand}}` (or batch into the daily digest) |
| Admin fee swept | `Admin Fee Swept — {{amount}} {{cur}}` | `Fees swept: {{amount}} {{cur}} → admin wallet` |
| Treasury low | `⚠️ Low {{asset}} treasury — top up Binance` | `Top up Binance {{asset}}: need {{need}}, have {{have}}` |
| Overpayment routed to admin | `Overpayment routed to admin — {{excess}} ({{company}})` | keep |
| Webhook DLQ alert | `DLQ Alert: Webhook failed for tx {{id}}... ({{asset}})` | `Webhook dead-lettered: {{brand}} · {{asset}} · {{txid8}}` |
| Error digest / critical | `🚨 Dynopay Error Digest — N errors in last 60 min` / `🔴 CRITICAL: …` | `Errors last hour: {{n}} ({{critical}} critical)` / `CRITICAL {{component}}: {{message}}` |

Bodies for admin mail: keep tables, delete greetings ("Hey Dynopay Admin,") and prose.

---

## I. Findings to fix regardless of copy choice
1. **`sendEmailOTP` generic body** ("OTP for login / Here is your login code: 123456") is used for **password reset, email change and set-password** → wrong purpose text, no expiry, no OTP block, English only. Wire the existing localized templates (`forgotPasswordOtp`, `emailVerifyOtp`, `loginOtp`).
2. **B5 partial-payment email** addresses the merchant as if they were the buyer ("You have N minutes to send the remaining…").
3. **Dead senders**: `sendTransactionConfirmedEmail`, `sendPaymentFailedEmail`, `sendSubscriptionPaymentFailedEmail`, `sendOrderShippedEmail` (no callers); i18n `walletVerified.*`, `walletEditOtp.*` (no sender).
4. **Duplicates**: weekly summary vs payout digest (B13/B14); failed-logins vs security-alert rate-limit (C10/C13); sign-in notification vs new-device alert (C11/C12); add-wallet reminder vs brand-created vs wallet gate (D8/C18/E2).
5. **Off-brand templates**: refund emails use a separate dark "shell"; referral + order + webhook + admin emails are hardcoded English while the rest is 6-language.
6. **Emoji in subjects** (referral, admin) — remove for consistency/deliverability.
