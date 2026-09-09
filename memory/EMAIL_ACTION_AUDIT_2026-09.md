# Dynopay — Email ⇄ Action Audit (2026-09)

Scope of this audit: every email that can land in a **user's inbox**, the **action that triggers it**, whether the current
**subject / body / CTA** actually matches that action, the **missing** emails, and a per‑email recommendation
(**subject + CTA + light graphic**).

Legend: [USER]=merchant account holder · [CUSTOMER]=the payer/contributor · [ADMIN]=internal ops (not a real user inbox)

Source of truth: `backend/services/email/*.ts`, subjects/copy in `backend/locales/en/emails.json`, template in `backend/utils/emailTemplate.ts`.

---

## 0. The single biggest reason emails "don't feel relevant to the action"

`baseEmailTemplate()` renders **logo → H1 heading → text → (optional) CTA → footer** for EVERY email.
There is **no per‑action hero icon / graphic** (icons exist only for footer social links). So a security alert,
a payout, a welcome, and a wallet change all look structurally identical. Recommendation: add one optional
`icon`/`accent` to the template and map a small PNG per email (infra already exists: `getEmailIconUrl()` →
`/api/static/email/<name>.png`).

---

## 1. Concrete relevance BUGS / weaknesses found (current code)

| # | Email | Problem | Fix |
|---|-------|---------|-----|
| 1 | `sendWalletDeletedEmail` (walletEmails.ts:128) | "Wallet **Removed**" email reuses the **`walletAdded.cta`** button ("View Wallets"). Wrong key → if walletAdded CTA changes to "Add wallet", the delete email would invite you to add one. | Give it its own `walletDeleted.cta` = "View wallets". |
| 2 | `sendAutoConversionPayoutEmail`, `sendWeeklyConversionSummaryEmail` (conversionEmails.ts) | **No CTA** (showButton=false). A "Payout complete" email dead-ends. | Add CTA "View transactions" / "View analytics". |
| 3 | Payment lifecycle: `paymentPending`, `paymentConfirming`, `transactionConfirmed`, `paymentPartial`, `paymentPartialExpired` (paymentEmails.ts) | **No CTA** — merchant can't jump to the transaction. | Add CTA "View transaction". |
| 4 | `companyContactWelcome.cta` = "Learn More" | Vague CTA on a brand-registered email. | "Go to dashboard". |
| 5 | `companyCreated` subject "Profile complete – One step left" + CTA "Add Wallet" | It's really an onboarding nudge, not a "brand created" confirmation. Acceptable but conflates two intents. | Keep as onboarding nudge, OR split into a clean "Brand created" confirmation. |
| 6 | i18n fallback: `t()` returns the **raw key** if a subject string is missing. | Any missing `*.subject` ships a subject like `merchant.foo.subject`. | Add a CI check that every referenced key resolves (all langs). |
| 7 | Terminology | Emails still say **"company"** (companyCreated/Updated/ContactWelcome, paymentFailed "{{companyName}}"). Product direction is **"Brand"**. | Rename user-facing copy company→brand (aligns with the Brand rename task). |

---

## 2. MISSING emails (a user action happens, no email is sent)

| Action | Today | Recommendation |
|--------|-------|----------------|
| **Brand/Company deleted** | ❌ none (only created/updated) | "Your brand '{name}' was deleted" confirmation + security note. (Pairs with the new delete‑OTP flow.) |
| **API key deleted / revoked** | ❌ only `apiKeyCreated` | "An API key was revoked" security confirmation. |
| **2FA / login-security enabled or disabled** | ❌ none | "Two-factor authentication turned on/off" security email. |
| **Payment link deleted / disabled / expired** (to merchant) | ❌ none | "Your payment link was disabled/expired" notice. |
| **New device/session login** | ⚠️ `loginNotification` exists but `newDeviceLogin` copy is defined and appears unused | Wire the richer `newDeviceLogin` template or consolidate. |
| **Withdrawal/refund failed** (user-initiated payout) | ⚠️ referral payout failed exists; general withdrawal failure to user? | Add "Withdrawal failed" if a user withdrawal can fail outside referral. |
| **Email successfully verified / account activated** | ⚠️ only OTP + welcome | Optional "Email verified" confirmation. |

---

## 3. Full inventory — user actions → email (with verdict)

### 3.1 Account & Security  [USER] — `accountEmails.ts`
| Action (trigger) | Email fn | Subject | CTA | Verdict | Suggested graphic |
|---|---|---|---|---|---|
| Register (send code) | sendEmailVerificationOTPEmail | "Verify your email" | (code, no btn) | OK | shield/✉ |
| Login with code | sendLoginOTPEmail | "Your login code" | (code) | OK | key |
| Password reset request | (forgotPasswordOtp copy) | "Password reset code" | (code) | OK | lock |
| Password changed | sendPasswordChangedEmail | "Password updated successfully" | View Account Settings | OK | lock-check ✔ |
| Profile updated | sendUserProfileUpdatedEmail | "Account profile updated" | View Profile | OK | pencil |
| Email address changed | (profileUpdated.emailChanged) | "Your Dynopay email address has been changed" | Contact Support | OK (good security net) | ✉-alert |
| Volume tier upgrade | sendVolumeTierUpgradeEmail | "You just unlocked the {tier} tier…" | View your dashboard | OK | trophy/📈 |
| Security alert (otp lockout / login rate limit) | sendSecurityAlertEmail | "Security alert on your account" | Secure My Account | OK | alert (amber) |
| New sign-in | sendLoginNotificationEmail | "New sign-in to your Dynopay account" | "This wasn't me — Secure my account" | OK | pin/🌐 |
| Many failed logins | sendFailedLoginAttemptsEmail | "Multiple failed login attempts…" | Reset Password | OK | alert (red) |
| Welcome | sendWelcomeEmail | "Welcome to Dynopay – Let's get you paid" | Get Started | OK | rocket |

### 3.2 Brand / Company  [USER] — `companyEmails.ts`
| Action | Email fn | Subject | CTA | Verdict |
|---|---|---|---|---|
| Brand profile created | sendCompanyProfileCreatedEmail | "Profile complete – One step left" | Add Wallet | ⚠ conflates create+onboarding; company→brand rename |
| Contact/owner welcome | sendCompanyContactWelcomeEmail | "Welcome to Dynopay – {name} is now registered" | Learn More | ⚠ vague CTA; rename |
| Brand profile updated | sendCompanyProfileUpdatedEmail | "Your company profile was updated" | View Profile | ⚠ rename; verify it doesn't fire on every tiny save |
| Team member joined | sendTeamMemberJoinedEmail | "{member} joined {company} on Dynopay" | – | OK; rename |
| **Brand deleted** | — | — | — | ❌ MISSING |

### 3.3 Wallet  [USER] — `walletEmails.ts`, `walletSecurityEmails.ts`
| Action | Email fn | Subject | CTA | Verdict |
|---|---|---|---|---|
| Wallet added | sendWalletAddedEmail | "Wallet added – {network}" | View Wallets | OK · icon: wallet+ |
| Wallet updated | sendWalletUpdatedEmail | "Wallet updated – {network}" | View Wallets | OK |
| Wallet removed | sendWalletDeletedEmail | "Wallet removed from your account" | (borrows walletAdded.cta) | 🐛 BUG #1 |
| Confirm wallet update (OTP) | sendWalletUpdateOTPEmail | "Confirm wallet update" | (code) | OK |
| Confirm wallet delete (OTP) | sendWalletDeleteOTPEmail | "Confirm wallet deletion" | (code) | OK |
| Wallet mgmt code (sudo) | sendWalletSudoOTPEmail | "Your wallet management code" | (code) | OK |
| Withdrawal OTP | sendWithdrawalOTPEmail | "Confirm your withdrawal" | (code) | OK |
| Withdrawal submitted | sendWithdrawalSuccessEmail | "Withdrawal submitted – {amt}" | View Transactions | OK |
| Exchange OTP | sendExchangeOTPEmail | "Confirm your exchange" | (code) | OK |
| Add-wallet reminder (cron) | sendAddWalletReminderEmail | "You're almost ready…" | Add Wallet Now | OK |
| Batch payout summary | sendWalletBatchSummaryEmail | (constructed) | – | verify |
| Wallet change alert / secured | sendWalletChangeAlertEmail / sendWalletSecuredEmail | "…secured your account" | Undo/secure | OK (good) |

### 3.4 API & Billing  [USER] — `billingReportEmails.ts`
| Action | Email fn | Subject | CTA | Verdict |
|---|---|---|---|---|
| API key created/regenerated | sendApiKeyCreatedEmail | apiKey.subjectCreated/Regenerated | View API Keys | OK · icon: key |
| **API key deleted/revoked** | — | — | — | ❌ MISSING |
| Invoice generated | sendInvoiceGeneratedEmail | "Invoice {number}" | View Invoice | OK |
| Weekly summary (cron) | sendWeeklySummaryEmail | "Your weekly Dynopay summary" | View Full Analytics | OK · icon: chart |
| Subscription created | sendSubscriptionCreatedEmail | (built in code) | View Subscriptions | verify subject present |
| Subscription cancelled | sendSubscriptionCancelledEmail | (built in code) | View Subscriptions | verify |
| Subscription payment failed | sendSubscriptionPaymentFailedEmail | (built in code) | (cust/merch) | verify CTA present |

### 3.5 Payment Links & Campaigns  [USER/CUSTOMER] — `linkCampaignEmails.ts`
| Action | Email fn | Subject | CTA | Verdict |
|---|---|---|---|---|
| Payment link created | sendPaymentLinkCreatedEmail | "Payment link ready — {amt}" | Open Payment Link | OK · icon: link |
| Crowdfunding campaign created | sendCrowdfundingCampaignCreatedEmail | "Your crowdfunding campaign is live" | View Campaign | OK |
| Crowdfunding update [CUSTOMER] | sendCrowdfundingUpdateEmail | contributor.* | View | OK |
| Payment link reminder (cron) [CUSTOMER] | sendPaymentLinkReminderEmail | "Complete your payment…" | Pay Now | OK |
| Referee invite/reminder [CUSTOMER] | sendRefereeInviteEmail / sendRefereeCodeReminderEmail | referral.* | Sign up | OK |
| **Payment link disabled/deleted/expired** (to merchant) | — | — | — | ❌ MISSING |

### 3.6 Payments to merchant  [USER] — `paymentEmails.ts`
| Action (on-chain event) | Email fn | Subject | CTA | Verdict |
|---|---|---|---|---|
| Payment received/settled | sendPaymentReceivedEmail | "Payment received – {amt}" | View Transaction | OK · icon: ✔ green |
| Payment detected (pending) | sendPaymentPendingEmail | "Payment detected – confirming on-chain" | none | ⚠ add "View transaction" · icon: hourglass |
| Confirming | sendPaymentConfirmingEmail | "Payment confirming – {c}/{r}…" | none | ⚠ add CTA |
| Transaction confirmed | sendTransactionConfirmedEmail | "Transaction {status}" | none | ⚠ add CTA; subject a bit terse |
| Partial payment | sendPaymentPartialEmail | "Partial payment received — action needed" | none | ⚠ add "Review payment" |
| Partial expired | sendPaymentPartialExpiredEmail | (verify subject) | none | ⚠ verify + CTA |
| Payment failed | sendPaymentFailedEmail | "Payment unsuccessful – {companyName}" | View Transaction | OK; rename company→brand |

### 3.7 Conversions  [USER] — `conversionEmails.ts`
| Action | Email fn | Subject | CTA | Verdict |
|---|---|---|---|---|
| Auto-conversion payout | sendAutoConversionPayoutEmail | "Payout Complete — {amt} {ccy}…" | **none** | 🐛 #2 add CTA "View transactions" · icon: swap |
| Weekly conversion report | sendWeeklyConversionSummaryEmail | (constructed) | **none** | add CTA "View analytics" |

### 3.8 KYC  [USER] — `kycEmails.ts`  (all OK, icon: id-card)
required / approved / rejected / started / resubmission — subjects & CTAs all present and on-topic.

### 3.9 Referrals  [USER] — `referralEmails.ts` (subjects hardcoded, on-topic, custom CTA buttons)
payout ready / autopay enabled / payout requested / payout failed / accrual / activated / monthly digest / share nudge — OK · icon: gift.

### 3.10 Orders / Store  [USER + CUSTOMER] — `orderEmails.ts`
receipt (buyer) / new-sale (merchant) / order expired / refunded / shipped / digital-download reminder — subjects on-topic. Verify each has a fitting CTA.

### 3.11 Activation drip  [USER] — `activationEmails.ts`, `activationGateEmail.ts` — step-based, OK.

---

## 4. Out of a real user inbox (listed for completeness)
- [CUSTOMER] `customerReceiptEmail.ts` (payment confirmation to payer) — OK.
- [ADMIN] `adminNotificationEmails.ts` (new user, onboarding stuck/complete, first payment, new visitor) and
  `adminOpsEmails.ts` (large tx, webhook disabled/redirect, admin fee received/swept, treasury low) — internal, not user-facing.

---

## 5. Recommended light-graphic set (map one per email)
success ✔ (green) · pending/hourglass (amber) · alert (amber) · danger (red) · wallet · key · link · swap/convert ·
gift · id-card · rocket · lock · chart. Serve as 64–96px PNGs from `/api/static/email/<name>.png` and add an
optional `icon`+`accent` param to `baseEmailTemplate()` shown above the H1.
