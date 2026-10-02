# Email / notification system + codebase over-engineering audit — 2026-10-02
_Read-only audit (no code changed). Tools: tsc --noUnusedLocals, jscpd 5.4 (min 70 tokens / 8 lines), import-graph scan, grep. Pod 31539451._

## A. Email delivery — why "all emails deliver" is NOT guaranteed today
| # | Finding | Evidence | Risk |
|---|---------|----------|------|
| A1 | **No durable send path.** `utils/mailTransporter.ts` calls Brevo synchronously: 3 attempts, 300/900/2700 ms backoff (≈4 s total). If Brevo/network is down longer, the email is gone. | mailTransporter.ts L144-188 | P0 |
| A2 | **HTTP 429 (rate-limit) is treated as permanent** — only `!status`/5xx/timeouts retry. Brevo throttles bursts (payout digests, crons) → silent loss. | L169-176 | P0 |
| A3 | **Every one of ~174 senders swallows errors** (`catch → apiLogger.error`), returns `undefined`. Callers can't tell sent from failed; nothing is re-queued. | services/email/*.ts | P0 |
| A4 | **No send log.** No `tbl_email_log`; Brevo `messageId` is discarded. Support cannot answer "did we email X?". | grep email_log → none | P1 |
| A5 | **No bounce/complaint handling.** No Brevo webhook (hard_bounce / blocked / spam / invalid). Dead addresses keep being hit → reputation damage on the shared IP (the SMADAV "inbox full + throttled" incident). No per-user `email_bounced_at`, no fallback notification email. | routes/* no brevo webhook | P1 |
| A6 | **Emails sent inline in request handlers** — 44× `await send*Email(` in controllers → +1-4 s on API responses (e.g. updateCompany waits for Brevo). | grep controller/ | P2 |
| A7 | `companyDispatch` success contract broken for some senders: it counts `undefined` as failure, but `sendPayoutDelayedEmail`, `sendTipGoalMilestoneEmail` never return the transporter result → every successful send logs "[companyDispatch] send reported failure" (false alarms, and any dedup-after-success logic never seals). | companyDispatch.ts L43-55, payoutEmails.ts L75 | P2 |

## B. Notification preferences — two systems, one of them decorative
| # | Finding |
|---|---------|
| B1 | **Per-user toggles are not enforced.** `tbl_notification_preferences` (transaction_updates, payment_received, payment_pending, security_alerts, email_notifications, sms_notifications, browser_notifications, notify_new_device_only) is exposed as switches on /notifications (NotificationPage L737-883) but **only `weekly_summary` + `payout_digest_weekly` are read by the backend** (cronJobs.ts, payoutDigestService.ts). Turning OFF "Payment received" or "Email notifications" changes nothing. |
| B2 | **Per-brand categories ARE enforced** (`tbl_company.notification_prefs.categories` payments/payouts/orders/confirming via `companyDispatch` + `notificationRecipients`) — this is the real system (CompanyEmailRoutingCard). |
| B3 | Security alerts (`securityAlertService`, 2FA, new device) bypass both systems — fine (must-send), but the UI still offers a "Security alerts" switch. |
| B4 | In-app notifications (`tbl_notification`) are created ad hoc in 8 places (kycController ×6, pendingPaymentService ×4, crons…) with no shared service; push (`pushNotificationService`) is a separate channel with its own payload shapes. |

## C. Email code over-engineering / duplication
- **~7.9k lines across 29 email files, 174 `send*` functions**, each re-implementing: resolve lang → build subject → build HTML → try/catch → log. ~102 go through `dynoPayEmailTemplate` (a 1-line wrapper over `baseEmailTemplate`), 13 call `baseEmailTemplate` directly, 9 use `dynoPayGreetingTemplate` — 3 entry points to one template.
- `services/emailService.ts` is a 210-line barrel; half the codebase imports it, the other half imports `services/email/x` directly. 30 non-email modules import `mailTransporter` directly (every `controller/wallet/*.ts` file imports it — none of them send mail).
- Unused senders: `sendCompanyContactWelcomeEmail`, `sendEscrowDisputeOpenedEmail`, `sendEscrowOtpEmail` (0 call sites).
- **Onboarding cadence is heavy**: signup OTP → welcome → (2FA OTP + "email codes on") → brand welcome (+10 min, new) → wallet OTP + "wallet added" → hourly-cron "You're all set" → "payment link created" → activation drip d1/d3/d7 + wallet nudge → first-payment ×2. Three "welcome-ish" emails (signup welcome, brand welcome, all-set) within the first hour.
- Copy contradiction: `merchant.welcome.questions` (and others) say "reply to this email" while the footer says "sent from an unmonitored mailbox — replies are not read".

## D. Codebase-wide duplication / dead code / god files
**Dead code**
- Frontend: **71 never-imported modules, 8,934 lines** — `Components/Page/Home/v3,v5(partial),v6` (17 files; v7 is live), old dashboard (`DashboardLeftSection/RightSection`, `coinbase/index`, `ClaimHandleBanner`, `PasswordNudge`, `ReferralCodeCard`, `ReferralRewardBanner`, `UnderpaidActionBanner`, `WalletSetupNudge`), `UI/OnboardingFlow/index.tsx` (CreateCompanyModal still used), `Layout/Header|AdminHeader/styled.tsx`, `Pay3Components/success|failed.tsx`, `UI/{ChatButton,CustomAlert,CustomTooltip,DashboardSetupPrompt,DataTable,FeeCalculator,FullHeightModal,HomeCard,Loading,SectionTitle,TabPanel,TextArea,TimePicker}`, `Modals/{DemoVideoModal,ExitIntentModal}`, `hooks/{useDashboardLayout,usePaymentRates}`, `styles/{theme2,homeBento}`, `utils/constants/*-policy.js`, `constants/trustStats.ts`, `Containers/index.ts`… (full list: /tmp/fe_unused_files.txt at audit time)
- Backend: **13 never-imported files, 1,782 lines** — `controller/thresholdTestController.ts`, `services/blockchain/blockchainService.ts`, `services/chains/index.ts`, `utils/{addressValidation,constants,localStorage,redactSecrets,rpcFallback,transactionHelper}.ts`, `models/{adminModel,associations,serviceHealthDailyModel}.ts`, `types/index.ts`.
- **1,668 unused imports in 99 backend files** (tsc TS6133). Root cause: mechanical file splits copied the whole import header — every `controller/wallet/*.ts` (22 files) carries ~35-50 unused imports; same in `controller/payment/settlement/*`, `controller/user/*`. Frontend: 296 unused imports.

**Clones (jscpd)** — backend 191 clones / 4,250 dup lines (3.6%); frontend 182 clones / 3,232 lines (1.8%). Biggest: `product/productController.ts` (141 self-dup lines), `paymentController.ts` 124, `cryptoCheckout.ts` 118, `dashboardController.ts` 99, `merchantApiRouter.ts` 99; the `controller/wallet/*` header block cloned 20×; FE `API/BuyButtonsSection ↔ PublishableKeysSection` 232 lines, `UI/OverPayment ↔ UnderPayment` 229, `Layout/AdminHeader ↔ Header` 177, `Creator/InlineTipCheckout ↔ CleanCheckoutV2` 145, `Admin DeletedAccountsPanel ↔ DeletedBrandsPanel` 88.

**Duplicate helpers (backend)**: `round2` ×15 files, `num` ×9, `esc` ×7, `CACHE_TTL` ×7, `maskEmail` ×6, `escapeHtml` ×4, `MAX_ATTEMPTS` ×4, `hashCode` ×3, `getCurrencySymbol` ×3, `maskAddress` ×3, `isProduction` ×3, `parseRedisUrl` ×2 (webhookQueue + brandWelcomeScheduler — ours).

**God files**: `paymentLinkController.ts` 2,996 · `chainVerification.ts` 2,209 · `companyController.ts` 2,103 · `paymentController.ts` 2,061 · `diagnosticsRouter.ts` 2,032 (QA/diagnostics shipped in the prod bundle) · `cryptoCheckout.ts` 1,999 · `server.ts` 1,987 · FE `cryptoTransfer.tsx` 2,657 · `documentation.tsx` 2,553 · `CleanCheckoutV2.tsx` 2,381 · `CreatePaymentLink/index.tsx` 2,208 · `auth/login.tsx` 2,038 · `ApiKeysPage.tsx` 2,029.

**Three frontend data layers**: Redux-saga (113 files), SWR (50), React contexts (Company/Wallet stores). `useSetupProgress` alone reads all three. Payment-link + API-key + dashboard data are fetched via sagas while newer features use SWR → double fetches and race comments throughout.

**Preview/QA code in production bundles**: `diagnosticsRouter.ts` (2k lines), `paymentTestHookRouter.ts`, `/pay/*-demo` pages allow-listed in middleware, `thresholdTestController.ts` (dead).

## E. Recommendations (prioritised)
**P0 — make delivery reliable (email)**
1. **Durable email queue**: `mailTransporter` enqueues to a BullMQ `emails` queue (Redis already in prod); worker sends with 6-8 attempts, exponential backoff to ~1 h, DLQ + admin alert. Retry on 429 (honour `Retry-After`), 5xx, network. OTP/login codes get a high-priority lane with a 10-min TTL (stale codes must not be delivered late). Request handlers return immediately (fixes A1/A2/A3/A6).
2. **`tbl_email_log`** (to, template, subject, brevo message_id, status, attempts, last_error, sent_at) written by the worker → admin "Email log" tab + support lookup (A4).
3. **Brevo webhook** `/api/webhooks/brevo` (hard_bounce, blocked, spam, invalid_email, unsubscribed) → `tbl_user.email_bounced_at` + suppression check in the worker + "Needs attention" item "We can't reach you at … — add a backup email" + optional `notification_email` fallback (A5, SMADAV case).
4. Fix the `companyDispatch` contract (A7): treat "did not throw" as success, or make every sender return the transporter result.

**P1 — one preference system**
5. Remove the decorative per-user switches (B1) or wire them; recommended: keep the per-brand categories (already enforced), map the /notifications page to them, keep Security as always-on (no switch).
6. Consolidate onboarding emails: drop the hourly "You're all set" cron email when the brand welcome already fired (or vice-versa); activation drip only if no payment by day 1.

**P2 — codebase hygiene (safe, mechanical)**
7. Delete the 71 dead FE files + 13 dead BE files (−10.7k lines); run `eslint --fix` for unused imports (−1,964 imports) and add `noUnusedLocals` to CI.
8. Collapse the 3 template entry points into `baseEmailTemplate`; move helpers (`round2`, `maskEmail`, `escapeHtml`, `hashCode`, `parseRedisUrl`) into `utils/`.
9. De-dupe the top clones (OverPayment/UnderPayment → one `PaymentDeltaCard`; BuyButtons/PublishableKeys → shared key table; wallet controller header; Deleted*Panel).
10. Strip diagnostics/QA routers from production builds (env-gated dynamic import).
11. Longer term: retire Redux-saga in favour of SWR (start with paymentLink/api/dashboard reducers consumed by useSetupProgress).
