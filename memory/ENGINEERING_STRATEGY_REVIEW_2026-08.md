# DynoPay — End-to-End Engineering & Strategy Review (2026-08)

Scope: full codebase (~250K LOC TS: 123K backend / 123K frontend), live prod topology,
internal audits (UIUX_AUDIT_2026-06 8.4/10, IA_TAB_ARCHITECTURE_AUDIT), monetization mechanics.
Advisory only — no code changed.

## 1. What is genuinely strong (keep, don't churn)
- Payment core: 11-state PaymentState machine with validated transitions; idempotency in
  settlement/order paths; payment event journal; reconciliation + feeFreeReconciliation services.
- Chain abstraction (services/chains: EVM/Polygon/Tron/Sol/XRP/UTXO) — adding chain #16 is cheap.
- Resilience: Binance WS → CoinGecko/Tatum REST fallback, Tatum circuit breaker, leader election
  (WORKER_ROLE), volatility monitor, RPC health monitor, error digests + Slack alerts.
- Security middleware depth: rate limits, CSRF, bot protection, sanitization, account lockout,
  2FA, publishable keys, customer-session auth, API usage logging. Webhooks HMAC-signed
  (x-dynopay-signature). Merchant API versioned (/api/v1).
- Money math is unit-tested (fees, settlementMath, state machine, webhook processing) — the right
  10% of the codebase to test hardest.
- Product surface breadth: links, products/storefront, buy-button embed, subscriptions CRUD,
  invoices/tax, referrals, KYC scaffolding, support chat + KB, i18n (6 locales), PWA push, SSE.

## 2. Engineering risks (priority order)
- R1 SECRET SPRAWL (act now): full prod secrets (DB, Binance trade keys, wallet-KMS refs, OAuth,
  OpenAI, Brevo, Flutterwave, Telegram) pasted into chat across 7+ preview pods. ROTATE all
  rotatable keys; move to a secret manager; scope Binance key to read+convert only, IP-allowlist.
- R2 GOD FILES: userController 4.9K lines, walletController 4.6K, emailService 3.6K,
  cryptoSettlement 3.2K. Every hotfix lands in a minefield. Extract domain modules
  (auth/, wallets/, settlement/) behind the existing routers; add a max-500-line lint budget for
  NEW files; strangler-pattern, never big-bang.
- R3 MIGRATION DISCIPLINE: only 11 migration files vs a mature schema — drift is managed by hand
  on live Railway PG. Every schema change through sequelize-cli/umzug + PITR backups verified
  restorable (quarterly restore drill).
- R4 LEDGER: paymentJournal is an event log, not double-entry. Formalize a double-entry ledger
  (accounts: buyer_escrow, merchant_payable, fee_revenue, gas_expense, conversion_pnl) with an
  invariant checker cron; reconciliation.ts becomes assertion-based, alert on penny drift.
- R5 SINGLE-INSTANCE TOPOLOGY: one Railway node + leader election. Fine to ~$1-2M/mo volume.
  Before scale: split "API" from "worker" deploys, Redis persistence policy (BullMQ jobs are
  money-moving), health-gated deploys, and a second region for the checkout read path.
- R6 SIGNING ISOLATION: KMS (GCP key ring) is used for wallet keys — good. Next step: a separate
  signer service with destination allow-lists + per-tx/day spend limits so an app-server RCE
  cannot drain pools. Withdrawal approval workflow (2-man rule) above a threshold.
- R7 OBSERVABILITY: logs+Slack today. Add OpenTelemetry traces on the payment path,
  RED metrics per chain, and 3 SLOs: checkout p95 < 2s, detect→confirm lag, webhook delivery
  success. Alert on SLO burn, not on individual errors.
- R8 TEST PYRAMID: ~16 unit-test files for 250K LOC; E2E is agent-driven. Add contract tests
  generated from Swagger for /api/v1 (merchant-facing breakage = churn), plus golden-file tests
  for PDF receipts/invoices and locale keys.
- R9 Binance geo-block workaround (SSH SOCKS tunnel to a single VPS) is a fragile SPOF for
  conversion; either host the worker in an allowed region or make Tatum/CoinGecko the primary
  with tolerance bands.

## 3. UI/UX (builds on the internal 8.4/10 audit)
- Finish IA Batch C (one sale = one object) — biggest remaining confusion source.
- Ship the revenue-adjacent P1s already specced: expired-link rescue (Extend/Resend),
  shareable receipt URL (/receipt/<ref> + OG), storefront share nudge, offline QR pack.
- Checkout IS the product: keep prod-build p95 <2s; add wallet deep-links (BIP21/EIP-681 URIs,
  exchange-withdrawal guidance), live "confirmations n/m" progress (SSE exists), and
  paid-state trust cues. Every buyer is a future merchant impression.
- Plain-English everywhere: KPI reads ("3 more payments than yesterday, smaller baskets"),
  fee explanations at the moment fees are charged, "why is this pending" inline education.
- Merchant mobile: PWA install prompt + push (infra exists) — merchants live on phones.

## 4. Monetization (today: single-lever take rate 1.5%→0.5% by volume tier + $1 fixed, $500 fee-free trial, referral credits)
Keep checkout cheap (land-grab); monetize settlement, treasury, and software:
- M1 Instant settlement premium (+0.2-0.3%): instant stablecoin credit vs standard sweep timing.
- M2 Treasury/float: partner-held T-bill-backed stablecoin balances; share yield above a free
  threshold. At scale this quietly exceeds take-rate revenue.
- M3 Storefront Pro SaaS ($19-29/mo): custom domain, advanced analytics, no Dynopay branding,
  priority support. The creator surface is already built; this is packaging.
- M4 FX/off-ramp margin via partners on fiat payout rails (transparent, disclosed).
- M5 Enterprise tier: contract-committed volume for the 0.5% rate (don't give margin away
  without commitment), SLA, dedicated pool, compliance exports (CSV/tax already exist).
- M6 Developer platform: generous free tier, usage pricing on embed sessions/buy-button at scale.
- Anti-advice: don't paywall receipts, statuses, or basic analytics — trust surfaces convert.

## 5. Beyond 2026 (strategic bets, in order of conviction)
- B1 Stablecoin-native rails: USDT/USDC/RLUSD already first-class. As MiCA + US stablecoin
  regime mature, "accept any token → settle in regulated stablecoin → payout to bank" is the
  category winner. RLUSD support is a real differentiator — lean into Ripple ecosystem co-marketing.
- B2 Agentic commerce: AI agents are becoming buyers (x402-style machine payments). The
  publishable-key + embed-session + signed-webhook stack is 80% of what's needed. Ship an
  MCP server over /api/v1 (create link, check balance, list transactions) so merchants' AI
  assistants — and buying agents — integrate natively. Cheap, early, differentiating.
- B3 Real crypto subscriptions: subscriptionRouter CRUD exists but crypto has no "pull".
  ERC-4337 smart-account delegated allowances / permit2 make recurring real. First mover in
  "Stripe Billing for stablecoins" is an open seat.
- B4 Accept-anything routing: swap-route any buyer token into merchant's settlement asset
  (LI.FI-style aggregation) — kills the #1 checkout drop ("I don't hold that coin").
- B5 The custody fork (decide deliberately): custodial pools = licensing gravity (VASP/MiCA
  CASP, US MTL, Travel Rule; KYC creds are placeholders today — closing this is a prerequisite
  for scale, not optional). Alternative: non-custodial split-payment contracts (fee skimmed
  on-chain, funds direct to merchant) drastically cut regulatory surface at cost of UX control.
  A hybrid — non-custodial default, custodial as premium in licensed regions — is likely optimal.

## 6. 90-day sequence (if asked "what first")
1. Rotate pasted secrets + Binance key scoping (day 1).
2. Live KYC provider (Veriff creds real) + compliance narrative — unblocks everything else.
3. IA Batch C + expired-link rescue + shareable receipts (product P1s, all specced).
4. Double-entry ledger + assertion reconciliation (R4) before volume grows.
5. Storefront Pro packaging (M3) — first non-take-rate revenue line.
6. MCP/agent-payments spike (B2) — 1-2 week bet, outsized optionality.
