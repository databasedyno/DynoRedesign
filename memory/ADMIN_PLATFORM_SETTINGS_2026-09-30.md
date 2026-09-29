# Dynopay — What admins should manage from the dashboard instead of `.env` (2026-09-30)

## 0. Where Dynopay is today
- `backend/.env` holds **195 keys**; code references **~250** distinct env keys (the rest have code defaults). Every business-rule change (a fee, a limit, a kill switch, an alert recipient) = edit `.env` on the droplet + vault reseal + redeploy (canary→swap, ~10 min) + risk of drift between pod `.env`, `env.vault.enc` and `/opt/dynopay/.env`.
- Admin console has 7 pages (Overview, Merchants, Transactions, Escrow, Fee reconciliation, Live console, Support) + ~30 ops endpoints (diagnostics triggers, SafeDeal withdrawal approve/reject, dispute resolve, unfreeze). **There is no settings surface at all**, no feature-flag UI, no supported-assets registry, no admin roles, no config audit trail.
- Industry reference (Stripe Dashboard, Adyen Customer Area, Coinbase Commerce, BitPay, Fireblocks console): secrets + infrastructure live in env / a secret manager; **business rules, limits, fees, flags, kill switches, alert routing, branding and content are managed in the console** — with RBAC, step-up, an immutable audit log, "effective value + source" visibility, validation, and hot-reload without redeploy.

## 1. Move to the dashboard (business rules ops should own)

| Group | Env keys today | Why the dashboard |
|---|---|---|
| **Fees & pricing** | `TRANSACTION_FEE_PERCENT`, `FEE_TIER_1..4_{MIN,MAX,FIXED}`, `VOLUME_TIER_{STARTER,GROWTH,SCALE,ENTERPRISE}_{MIN,MAX,PERCENT}`, `CHECKOUT_MIN_FEE_MULTIPLE`, `BLOCKCHAIN_FEE_TIERS`, `FREE_TRIAL_VOLUME_USD`, `PLATFORM_FEE_EXEMPT_COMPANY_IDS` (a CSV of company ids!) | Pricing changes are commercial decisions, need effective-date versioning, preview of impact, and per-merchant overrides — not a redeploy |
| **Order & checkout limits** | `MIN_ORDER_{STORE,PAYMENT_LINK,BUY_BUTTON,API}_USD`, `RESERVATION_TIMEOUT_MINUTES`, `PAYMENT_EXPIRED_LOOKBACK_MINUTES`, `MAX_PENDING_AGE_HOURS`, `TRIAL_{MIN,MAX}_AMOUNT_USD`, `TRIAL_LINK_EXPIRY_HOURS`, `TRIAL_CLAIM_EXPIRY_HOURS`, `TRIAL_LINK_RATE_LIMIT` | Tuned in response to fraud/UX data, often same-day |
| **SafeDeal / escrow economics & risk** | `ESCROW_FEE_PERCENT`, `ESCROW_FEE_MIN_USD`, `ESCROW_MIN_DEAL_USD`, `ESCROW_MAX_DEAL_EUR`, `ESCROW_EXCHANGE_FEE_PCT`, `ESCROW_CONVERSION_FEE_PCT`, `ESCROW_WITHDRAW_FEE_{USDT_TRON,USDT_POLYGON,USDT_ERC20,USDC_POLYGON,USDC_ERC20}`, `ESCROW_WITHDRAW_FEE_FLOOR_USD`, `ESCROW_SWEEP_FEE_USD_DEFAULT`, `SAFEDEAL_CANCELLATION_FEE_PERCENT`, `SAFEDEAL_MIN_WITHDRAWAL_USD`, `SAFEDEAL_WITHDRAWAL_APPROVAL_USD` ($200), `SAFEDEAL_VELOCITY_CAP_USD` ($1k/24h), `SAFEDEAL_ADDRESS_COOLING_HOURS`, `SAFEDEAL_{MIN,MAX}_TOPUP_USD`, `ESCROW_DISPUTE_AUTO_ESCALATE_HOURS`, `ESCROW_MAX_REVISION_ROUNDS` | AML limits and approval thresholds must be adjustable within minutes when a mixer/laundering pattern appears (yesterday's $1k cap took a deploy) |
| **Compliance / KYC / AML** | `KYC_THRESHOLD_USD`, `KYC_GRACE_PERIOD_DAYS`, `KYC_EXEMPT_USER_IDS`, `KYC_EXEMPT_COMPANY_IDS` (CSVs), `REFERRAL_MIN_PAYOUT_USDT` | Exemptions are per-merchant decisions with an audit requirement; CSV-in-env has no "who/when/why" |
| **Security policy** | `ACCOUNT_LOCKOUT_{MAX_ATTEMPTS,WINDOW_MINUTES,DURATION_MINUTES}`, `MAX_2FA_FAILED_ATTEMPTS`, `LOCKOUT_DURATION_MINUTES`, `MAX_CONCURRENT_SESSIONS`, `ACCESS_TOKEN_EXPIRY_SECONDS`, `REFRESH_TOKEN_EXPIRY_DAYS`, `BACKUP_CODE_COUNT`, MFA grace period (hard-coded 14 days in `mfaEnforcement.ts`) | Policy knobs tightened during an incident; should not need engineering |
| **Feature flags & kill switches** | `ENABLE_CRYPTO_REFUNDS`, `REFUND_DRY_RUN`, `REFUND_FORWARDING_WIRED`, `ESCROW_LIVE_SETTLEMENT`, `SAFEDEAL_ALLOW_SIMULATION`, `STOREFRONT_PER_COMPANY`, `AUTO_PROVISION_PERSONAL_ACCOUNT`, `ADMIN_NOTIFY_NEW_USER`, `SHOW_SOCIAL_LINKS`, `NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG`, `NEXT_PUBLIC_CLEAN_CHECKOUT_V2`, `NEXT_PUBLIC_INLINE_TIP_CHECKOUT`, `NEXT_PUBLIC_ENABLE_{GOOGLE,GITHUB}_AUTH` | Flags are meant to be flipped live. **Missing entirely today (industry-standard for a PSP):** global *maintenance mode*, *pause new checkouts*, *pause settlements/payouts*, *pause SafeDeal cashouts*, *per-asset disable* — currently the only way to stop money movement is to stop the container |
| **Treasury & sweep operations** | `{BTC,ETH,LTC,DOGE,BCH,SOL,XRP,TRX,POLYGON,RLUSD*,USDT_*,USDC_*}_THRESHOLD` (13 sweep thresholds), `*_SWEEP` flags, `MIN_SWEEP_USD_{NATIVE,LOW_FEE,TOKEN_HIGH_FEE}`, `{ETH,TRX,POLYGON}_FEE_WALLET_{HEALTHY,WARNING,CRITICAL}`, `TRON_{MIN,MAX}_FEE_LIMIT_TRX`, `MERCHANT_POOL_INITIAL_SIZE`, `MERCHANT_POOL_MIN_AVAILABLE`, `MERCHANT_PRE_RESERVE_TARGET`, `BINANCE_CONVERT_INTERVAL_MINUTES`, `SETTLEMENT_DRAIN_MS`, `ALIGN_SETTLEMENT_MIN_TO_CHECKOUT`, `WATCHDOG_*` | Gas prices and volumes change weekly; treasury should tune thresholds from the console with the fee-wallet balances shown next to them |
| **Alerting & notification routing** | `ADMIN_EMAIL`, `OPS_EMAILS`, `ALERT_CHANNEL`, `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL`, `EMAIL_TEST_ALLOWLIST`, `DISABLE_OUTBOUND_EMAIL` | Recipients/channels change with staffing; needs a "send test" button (exists: `/admin/alerts/test`) and per-alert-type routing |
| **Branding, legal & content** | `APP_NAME`, `EMAIL_LEGAL_NAME`, `EMAIL_LEGAL_ADDRESS`, `SAFEDEAL_LEGAL_NAME`, `SAFEDEAL_SENDER_EMAIL`, `BREVO_SENDER_EMAIL`, `LANDING_PROOF_STORE_USER_ID`, `LANDING_FEED_WINDOW_HOURS`, `INVOICE_VAT_ON_GROSS`, `SUPPORT_CHAT_MODEL`, `TAX_AI_MODEL` | Marketing/legal edits; zero engineering content |
| **Webhook & job policy** | `WEBHOOK_DELIVERY_TIMEOUT_MS`, `MAX_QUEUE_DEPTH`, `MAX_ACTIVE_JOBS`, `LEDGER_INVARIANT_{CRON,INTERVAL_MIN,WINDOW_HOURS}`, `RPC_HEALTH_{PING_TIMEOUT_MS,FAILURE_THRESHOLD}` | Ops tuning; pair with the existing diagnostics triggers |

≈ **110 keys** fall in this bucket.

## 2. Show in the dashboard (read-only) but keep in env
Integration health & readiness: Tatum (mainnet/testnet mode, webhook secret present), Binance (key permissions + IP restriction — already in SafeDeal readiness), KMS, Brevo, Telnyx/Infobip, Spaces/GCS, Redis/DB pool, `WORKER_ROLE`, `ENABLE_BACKGROUND_JOBS`, `ENABLE_LEDGER`/`ENABLE_OUTBOX`/`LEDGER_DUAL_WRITE`, `CHAIN_TX_VERIFY_MODE`, `NODE_ENV`. Plus an **effective-config view**: every setting with its *source* (dashboard override → env → code default) so drift between pod/droplet is visible.

## 3. Must stay in env / secret manager (never in the DB, never in the UI as plain text)
DB/Redis URLs, `ACCESS_TOKEN_SECRET`, `API_SECRET`, `CYPHER_KEY`, `CRYPTO_{PUBLIC,SECRET}_KEY`, `NEXTAUTH_SECRET`, KMS service-account (`GOOGLE_CLIENT_KEY`, `PROJECT_ID`, `KEY_RING_ID`, `LOCATION_ID`, `PRIVATE_KEY_ID`, `TEMP_KEY_ID`, `XPUB_KEY_ID`), Tatum keys + `TATUM_WEBHOOK_SECRET`, Binance key/secret, Brevo/Telnyx/Infobip/OpenAI/Veriff/TronGrid/Blockchair/BlockBee/FastForex/TaxData keys, Spaces keys, Google/GitHub OAuth secrets, Telegram bot tokens, `SAFEDEAL_API_KEY`/`SAFEDEAL_WEBHOOK_SECRET`, SSH tunnel creds, VAPID private key, `PRODUCT_DOWNLOAD_SECRET`, `PAYMENT_TEST_HOOK_SECRET`, `QA_PASSCODE`, ports/hosts/URLs, chain constants (contract addresses, Tatum account ids, `RLUSD_ISSUER`).
Industry pattern for the third-party credentials (optional Phase 3): a **Connections** page with write-only fields stored KMS-encrypted, "test connection" and "rotate" buttons, last-rotated date — never displayed back.

## 4. Admin capabilities missing entirely (industry-standard PSP console)
1. **Platform Settings** page — none exists (everything above).
2. **Kill switches / maintenance mode** — global + per-flow (checkouts, settlements, payouts, SafeDeal cashouts) + per-asset; banner shown to merchants/customers.
3. **Supported assets registry** — enable/disable coin+network, min amount, confirmations, sweep threshold, display order; today spread across env + code constants.
4. **Fee schedule editor** — versioned with effective dates, per-merchant overrides/exemptions (replaces the CSV env), impact preview.
5. **Risk & limits** — KYC threshold/grace, exemption lists with reason, SafeDeal approval/velocity caps, cooling periods; a "Needs attention" queue already partly exists (withdrawals).
6. **Admin users & roles** — today a single `tbl_admin` row, no roles, no 2FA (see SEC-002). Need super-admin / finance / ops / support / read-only, mandatory TOTP, session list + revoke.
7. **Config audit log** — immutable who/what/before/after/why for every setting change and every fund-moving admin action; exportable.
8. **Alert routing** — channels, recipients, per-alert-type severity, quiet hours, test send.
9. **Branding & legal** — sender identities, legal footer, support contact, landing proof source.
10. **Integrations & health** — one page: readiness checks (extend the SafeDeal readiness pattern), credential presence/rotation age, webhook secret status.
11. **Jobs & schedules** — run/pause background jobs, view last run/next run (partly exists as scattered diagnostics triggers), cron expressions.
12. **Effective-config / drift view** — value + source per key across API and worker.

## 5. Recommended architecture (minimal, industry-standard)
- **Storage**: `tbl_platform_setting (key PK, value jsonb, updated_by, updated_at, version)` + append-only `tbl_platform_setting_history (key, old_value, new_value, changed_by, reason, changed_at)`.
- **Typed registry in code** (`services/platformSettings/registry.ts`): for each key → group, type, validation (zod/Joi), default, `envFallback`, `requiresStepUp`, `restartRequired=false`. Resolution order: **DB override → env → code default**. This keeps `.env` working unchanged (zero-risk migration; each key can be moved independently).
- **Access**: `settings.get("safedeal.velocity_cap_usd")` with in-process cache + Redis pub/sub invalidation → API **and** worker pick up changes in <1s, no redeploy.
- **API**: `GET /api/admin/settings` (grouped, effective value + source), `PUT /api/admin/settings/:key` (validated, audited, `requireStepUp` once admin 2FA exists), `GET /api/admin/settings/history`.
- **UI**: `/admin/settings` with tabs = groups above; each row shows value, source chip (Override / Env / Default), last changed by/when, inline validation, "review changes" diff before save, one-click revert to previous version; kill switches as prominent toggles with confirmation.
- **Guardrails**: money-affecting groups (fees, limits, kill switches) require step-up + reason; dangerous combos validated server-side (e.g. `approval_usd ≤ velocity_cap`, `fee_min ≤ min_deal`); every change emits a `securityEventService` event + Slack alert.

## 6. Phased plan
- **Phase 1 — Foundation + highest-churn groups** (~2–3 sessions): settings service/registry/cache/audit + `/admin/settings` with Fees & pricing, Limits, SafeDeal risk, Security policy, Feature flags + **new kill switches** (maintenance, pause checkouts/settlements/cashouts), Alert routing. Migrate ~60 keys.
- **Phase 2 — Money surfaces**: Supported-assets registry (per-coin enable + sweep thresholds + fee-wallet bands with live balances), fee schedule versioning + per-merchant overrides (replace `PLATFORM_FEE_EXEMPT_COMPANY_IDS` / `KYC_EXEMPT_*` CSVs), branding/legal.
- **Phase 3 — Governance**: admin users & roles + mandatory admin 2FA (closes SEC-002), config/admin-action audit viewer, Integrations & Connections (KMS-encrypted credentials, test/rotate), jobs & schedules, effective-config drift view.

Dependencies: Phase 1 should ship together with (or right after) admin 2FA + revocable sessions from the security audit — putting fee/limit/kill-switch controls behind a password-only 30-day token would widen SEC-002.
