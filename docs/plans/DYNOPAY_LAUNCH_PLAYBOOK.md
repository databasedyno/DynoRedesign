# DynoPay — Launch Readiness & Growth Playbook

> Master document covering everything that needs to be done: product features, technical QA, growth strategy, and monetization. Each item is prioritized, scoped, and linked to the existing codebase.

---

## Table of Contents

1. [Product-Led Growth Features](#1-product-led-growth-features)
2. [Technical QA Hardening](#2-technical-qa-hardening)
3. [Go-To-Market: First 50–100 Customers (Zero Ad Spend)](#3-go-to-market-first-50100-customers)
4. [Monetization Strategy](#4-monetization-strategy)
5. [Implementation Roadmap](#5-implementation-roadmap)
6. [Current System Inventory](#6-current-system-inventory)

---

## 1. Product-Led Growth Features

### 1.1 🔴 P0 — "Try Before You Sign Up" Payment Link Creator

**The Core Idea:**
A visitor lands on DynoPay, creates a payment link + QR code in 30 seconds — **no account, no email, no login**. They share it. When someone pays, DynoPay holds the funds and says: *"You have €47.50 waiting. Enter your email to claim it."* Now you have a paying merchant.

**What Needs to Be Built:**

| Component | Description | Files to Touch |
|---|---|---|
| **Public API endpoint** | `POST /api/public/create-trial-link` — accepts `{amount, currency, description}`, returns `{link_url, qr_code_base64, claim_token}`. No auth required. Rate-limited to 5/hour per IP. | New route: `routes/publicTrialRouter.ts` |
| **Trial Payment Link model** | New DB table `tbl_trial_payment_links` with fields: `id (UUID)`, `slug (unique)`, `amount`, `fiat_currency`, `description`, `qr_code_url`, `claim_token (hashed)`, `claim_email (null until claimed)`, `status (active/paid/claimed/expired)`, `paid_amount_crypto`, `paid_currency`, `paid_tx_hash`, `ip_address`, `created_at`, `expires_at (24h)`, `claimed_at` | New model: `models/trialPaymentLinkModel.ts` |
| **Public payment page** | `/try/[slug]` — standalone checkout page (no DynoPay chrome). Shows amount, description, crypto selector, QR code for deposit address. Minimal, fast, mobile-first. | New page: `pages/try/[slug]/index.tsx` |
| **QR code generation** | Reuse existing `generateQRCodeWithLogo()` from `utils/qrCodeWithLogo.ts`. Generate QR for the crypto deposit address on the payment page. | Existing: `utils/qrCodeWithLogo.ts` |
| **Claim flow** | After payment confirmed, show "Claim Your Funds" screen. Merchant enters email → creates account → funds released to their wallet. If unclaimed after 72h, auto-refund to sender. | New page: `pages/try/[slug]/claim.tsx`, new endpoint: `POST /api/public/claim-funds` |
| **Landing page CTA** | Hero section button: "Create a Payment Link — No Account Needed" → opens inline form (amount + description) → generates link + QR in 3 seconds | Modify: `pages/index.tsx` or `Components/landing/` |
| **Trial → Account conversion** | When merchant claims funds, auto-create company + user account. Pre-fill with claim email. Mark first €1,000 as fee-free (see 1.2). Send welcome email with "Your dashboard is ready." | New service: `services/trialConversionService.ts` |

**User Flow:**
```
Visitor → [Create Link] → gets URL + QR
                ↓
        Shares with customer
                ↓
Customer → [Pays in crypto] → DynoPay confirms on-chain
                ↓
Visitor → [Gets email: "€47.50 received!"] → clicks "Claim Funds"
                ↓
        [Enters email, sets password] → account created
                ↓
       Dashboard opens → funds in wallet → "First €1,000 fee-free!"
```

**Technical Considerations:**
- Trial links use the existing merchant pool address system (`tbl_merchant_pool_addresses`)
- Assign a temp address from the pool, tag it with the trial link's `claim_token`
- Webhook processing works the same — Tatum notifies, BullMQ processes, crypto-verification settles
- Key difference: instead of forwarding to a merchant wallet (they don't have one yet), hold in an escrow/staging address until claimed
- Expiry: unclaimed after 72h → initiate refund to sender (if possible) or flag for admin review

**Rate Limiting & Abuse Prevention:**
- 5 trial links per IP per 24 hours
- CAPTCHA on creation form (hCaptcha — free, privacy-respecting)
- Minimum amount: €5 (prevents dust spam)
- Maximum amount: €500 (prevents money laundering before KYC)
- Trial links expire in 24h if unpaid

---

### 1.2 🔴 P0 — "First €1,000 Fee-Free" Trial System

**The Core Idea:**
Every new merchant gets their first €1,000 in cumulative transaction volume processed with **0% DynoPay fees**. Only blockchain network/gas fees apply. After €1,000, normal fee schedule kicks in (1.5% default).

**Positioning:** *"Stop losing 3% to Stripe. Accept your first €1,000 in stablecoins with 0% fees."*

**What Needs to Be Built:**

| Component | Description | Files to Touch |
|---|---|---|
| **Company fee tier tracking** | Add columns to `tbl_company`: `cumulative_volume_usd (DECIMAL)`, `fee_free_remaining_usd (DECIMAL, default 1000)`, `fee_tier (enum: trial/standard/premium)`, `trial_started_at`, `trial_ended_at` | Alter: `models/companyModel.ts` |
| **Fee calculation override** | In `cryptoVerification` fee calculation (around line 4270 of `paymentController.ts`), check `fee_free_remaining_usd`. If > 0, set DynoPay fee to 0%. Deduct transaction amount from remaining balance. | Modify: `controller/paymentController.ts` (fee calc section) |
| **Volume tracking** | After every successful payment, increment `cumulative_volume_usd` on the company record. Already partially exists in `kycEnforcement.ts` — extend it. | Modify: `helper/kycEnforcement.ts`, `controller/paymentController.ts` |
| **Trial expiry notification** | When `fee_free_remaining_usd` drops below €100, send email: "You have €XX fee-free left. Upgrade to keep your low rates." When it hits 0, send: "Trial complete! Your fee is now 1.5%. Here's why DynoPay is still cheaper than Stripe." | New email template: `emails/trialExpiring.ts`, `emails/trialComplete.ts` |
| **Dashboard widget** | Show "€743 fee-free remaining" progress bar on merchant dashboard. | Modify: `pages/dashboard/index.tsx` or equivalent component |
| **Admin config** | Env var `FREE_TRIAL_VOLUME_USD=1000` (configurable without code change) | Add to `.env` |

**Fee Calculation Logic (pseudocode):**
```
function calculateFee(company, transactionAmountUSD):
    if company.fee_free_remaining_usd > 0:
        feeableAmount = max(0, transactionAmountUSD - company.fee_free_remaining_usd)
        company.fee_free_remaining_usd -= min(transactionAmountUSD, company.fee_free_remaining_usd)
        if feeableAmount == 0:
            return { dynopayFee: 0, reason: "trial_fee_free" }
        else:
            return { dynopayFee: feeableAmount * feePercent, reason: "partial_trial" }
    else:
        return { dynopayFee: transactionAmountUSD * feePercent, reason: "standard" }
```

**Edge Cases:**
- Transaction straddles the threshold (e.g., €800 remaining, €900 payment) → first €800 fee-free, last €100 at 1.5%
- Company created before feature launch → grandfather in with full €1,000 trial? Or only new accounts? *Decision needed.*
- Multiple concurrent payments could race on `fee_free_remaining_usd` → use DB-level atomic decrement: `UPDATE tbl_company SET fee_free_remaining_usd = GREATEST(0, fee_free_remaining_usd - $amount) WHERE id = $id RETURNING fee_free_remaining_usd`

---

## 2. Technical QA Hardening

### 2.1 🔴 P0 — Customer-Facing Idempotency Keys

**The Problem:**
If a user clicks "Pay" twice, or their internet cuts out mid-transaction and the request retries, the system could create two separate payment records — resulting in the customer being charged twice.

**Current State:**
- ✅ Settlement idempotency exists (added in reliability hardening) — `checkSettlementIdempotency()` prevents double blockchain transfers
- ✅ Webhook deduplication exists — `processed-tx-${txId}` Redis key prevents double webhook processing
- ❌ **Payment creation endpoint has NO idempotency key** — calling `POST /api/user/cryptoPayment` twice creates two separate payments with two different deposit addresses

**What Needs to Be Built:**

| Component | Description | Files to Touch |
|---|---|---|
| **Idempotency key header** | Accept `X-Idempotency-Key` header on payment creation endpoints. If a request with the same key was already processed, return the cached response instead of creating a new payment. | New middleware: `middleware/idempotencyMiddleware.ts` |
| **Idempotency cache** | Redis key `idempotency-{api_key}-{idempotency_key}` with TTL of 24h. Stores the full response body + status code of the original request. | Part of middleware |
| **Endpoints to protect** | `POST /api/user/cryptoPayment`, `POST /api/user/createPayment`, `POST /api/user/addFunds`, `POST /api/pay/createPaymentLink`, `POST /api/public/create-trial-link` | Apply middleware to these routes |
| **Client-side key generation** | Frontend generates `crypto.randomUUID()` for every payment initiation. Retries reuse the same key. Document in API docs. | Modify: `pages/pay/index.tsx`, API documentation |
| **Conflict response** | If idempotency key matches but request body differs, return `409 Conflict` with error: "Idempotency key already used with different parameters" | Part of middleware |

**Implementation Pattern:**
```
middleware/idempotencyMiddleware.ts:

1. Extract X-Idempotency-Key header
2. If no key → proceed normally (backward compatible)
3. If key exists:
   a. Check Redis: idempotency-{apiKey}-{key}
   b. If found → return cached response (same status + body)
   c. If not found → proceed, but intercept response:
      - Cache response body + status in Redis (TTL 24h)
      - Return response to client
4. Hash request body → store alongside cached response
5. On retry: compare body hash → 409 if different, cached response if same
```

**Testing Checklist:**
- [ ] Send same payment request twice with same idempotency key → second returns cached response, only one payment created
- [ ] Send same key with different body → 409 Conflict
- [ ] Send without key → works normally (backward compatible)
- [ ] Key expiry after 24h → same key can be reused
- [ ] Concurrent requests with same key → only one processes (use Redis SET NX for atomic lock)

---

### 2.2 🟡 P1 — "Slow Block" Resilience

**The Problem:**
If the blockchain (e.g., Bitcoin during fee spikes, Polygon during congestion) takes 10+ minutes to confirm a transaction, the payment status UI might:
- Show a spinning loader indefinitely
- Time out and show "Payment Failed" even though the money was sent
- Leave the customer confused about whether they need to pay again

**Current State:**
- ✅ Backend handles slow blocks well — BullMQ queue processes webhooks whenever they arrive, even if delayed
- ✅ Reconciliation service catches missed payments on startup
- ❌ **Frontend payment status page has no "congestion-aware" UX** — it polls but doesn't communicate blockchain delays to the user
- ❌ **No estimated confirmation time** shown to the user based on current network conditions

**What Needs to Be Built:**

| Component | Description | Files to Touch |
|---|---|---|
| **Blockchain congestion indicator** | Call mempool.space API (BTC) / Etherscan gas tracker (ETH) / etc. to get current network congestion level. Show on payment page: "Bitcoin network is busy. Estimated confirmation: ~15 minutes" | New utility: `utils/blockchainStatus.ts`, modify: `pages/pay/index.tsx` |
| **Progressive status messages** | Instead of just "Waiting for payment...", show timeline: "Payment sent → Detected on network (1 confirmation) → Confirmed (3 confirmations) → Processing → Complete" | Modify: `pages/pay/index.tsx`, `Components/PaymentStatus/` |
| **Timeout-proof polling** | Current polling might stop after N minutes. Change to: poll every 5s for first 2 min, then every 15s for next 10 min, then every 60s indefinitely. Never show "failed" unless explicitly marked failed by backend. | Modify: `pages/pay/index.tsx` |
| **"Don't worry" messaging** | After 5 min with no confirmation, show: "Your transaction has been detected on the blockchain. Confirmations can take longer during busy periods. Your payment is safe — we'll email you when it's confirmed." | Modify: payment status component |
| **Email notification fallback** | If customer provides email, send "Payment confirmed!" email as soon as it's done — even if they've left the page. Already partially exists. | Verify: existing email flow |

**Congestion API Sources:**
- BTC: `https://mempool.space/api/v1/fees/recommended` → `fastestFee`, `halfHourFee`, `hourFee`
- ETH: `https://api.etherscan.io/api?module=gastracker&action=gasoracle` → `SafeGasPrice`, `ProposeGasPrice`
- SOL: `https://api.mainnet-beta.solana.com` → `getRecentPerformanceSamples`
- Fallback: just show "Network may be congested" without specific estimates

---

### 2.3 🟡 P1 — Webhook Reliability Audit

**The Problem:**
DynoPay relies on Tatum webhooks to know when a payment is received. If the DynoPay server is down when the webhook arrives, the payment could be "lost" — the customer paid but the merchant never sees it.

**Current State:**
- ✅ **BullMQ queue** with 3 retries, exponential backoff (5s → 30s → 120s), and Dead Letter Queue (DLQ)
- ✅ **Tatum retry** — Tatum automatically retries failed webhook deliveries
- ✅ **Reconciliation service** — runs on startup, catches stuck/failed payments
- ✅ **DLQ alerting** — sends email when a job exhausts all retries
- ⚠️ **No Tatum webhook retry config verification** — are we sure Tatum retries? How many times? What interval?
- ❌ **No webhook receipt logging** — if a webhook arrives but fails validation (bad signature, unknown address), we don't track it
- ❌ **No webhook replay endpoint** — if a payment is stuck, admin has to manually fix. Should have "replay webhook" button in dashboard.

**What Needs to Be Built:**

| Component | Description | Files to Touch |
|---|---|---|
| **Webhook receipt log** | Log every incoming webhook to `tbl_payment_journal` (already exists!) — event type `webhook_received`, with raw payload in metadata. This creates an audit trail even for rejected webhooks. | Modify: `webhooks/index.ts` |
| **Webhook replay endpoint** | `POST /api/admin/replay-webhook` — admin can re-trigger webhook processing for a given txId. Fetches from journal, re-enqueues in BullMQ. | New endpoint in `routes/adminRouter.ts` |
| **Tatum retry verification** | Document and test Tatum's webhook retry behavior. Configure `maxRetries` in Tatum subscription if possible. Add monitoring for "gap detection" — if we expect a webhook but don't receive it within 10 min, proactively check the blockchain. | Config verification + `services/webhookGapDetector.ts` |
| **Webhook health dashboard** | In admin panel, show: total webhooks received (24h), success rate, average processing time, DLQ depth, failed webhook count. | Modify: admin dashboard |

**Testing Protocol (with simulated downtime):**
1. Send a real test payment to a pool address
2. Kill the BullMQ worker (`webhookWorker.close()`)
3. Wait for Tatum webhook to arrive → it should 200 (still enqueued in Redis/BullMQ)
4. Restart worker → job should process from queue
5. Verify payment appears in dashboard
6. If step 3 returns non-200 → verify Tatum retries (check Tatum dashboard)

---

## 3. Go-To-Market: First 50–100 Customers

### 3.1 Organic Acquisition Channels (Zero Ad Spend)

**Week 1-2: Foundation**

| Action | Details | Expected Outcome |
|---|---|---|
| **Crypto freelancer communities** | Post in r/freelance, r/cryptocurrency, r/ethdev, Hacker News "Show HN". Message: "I built a tool that lets you accept crypto payments with a single link. No Stripe, no 3% fee. First €1,000 free." | 5-10 signups |
| **Twitter/X crypto builder community** | Daily posts: "Day X of building DynoPay" thread. Show screenshots, share payment link demos. Tag crypto influencers. Use #BuildInPublic #CryptoPayments | 500-1000 followers, 3-5 signups |
| **Discord/Telegram crypto groups** | Join 10 active crypto communities. Don't spam — answer questions about crypto payments, naturally mention DynoPay when relevant. | 5-10 signups |
| **Product Hunt launch** | Prepare assets (logo, screenshots, demo video). Launch on Tuesday at 12:01 AM PST. Rally community to upvote. | 50-100 signups in one day |

**Week 3-4: Partnerships & Direct Outreach**

| Action | Details | Expected Outcome |
|---|---|---|
| **Invoice tool integrations** | Reach out to Invoice Ninja, Wave, Hiveage — offer free DynoPay integration. "Your users can now accept crypto. Here's the PR." | 1-2 partnerships |
| **E-commerce plugin** | Build a simple WooCommerce/Shopify plugin that uses DynoPay API. List on plugin marketplaces. | 10-20 installs/month |
| **Direct outreach to Stripe complainers** | Search Twitter for "Stripe fees" "Stripe sucks" "payment processing expensive". DM them: "Hey, saw you're frustrated with Stripe fees. I built something that might help — crypto payments at 0% for your first €1,000." | 5-10 conversations → 2-3 signups |
| **Freelancer platforms** | Post on Fiverr, Upwork communities. "Accept crypto from international clients without PayPal's 5% cut." | 5-10 signups |

**Week 5-8: Content & SEO**

| Action | Details | Expected Outcome |
|---|---|---|
| **Blog: "How to Accept Crypto Payments in 5 Minutes"** | Step-by-step tutorial with screenshots. SEO-optimize for "accept crypto payments", "crypto payment gateway", "alternative to Stripe crypto" | Long-tail traffic (100-500/month after 2-3 months) |
| **Blog: "Stripe vs DynoPay: Fee Comparison Calculator"** | Interactive tool: enter your monthly revenue → see how much you save | Lead magnet + SEO |
| **YouTube: "I replaced Stripe with crypto payments"** | 5-minute demo video showing the full flow from link creation to receiving funds | 1000-5000 views |
| **Developer docs + API playground** | Already have Swagger. Add a "Try it" playground where devs can create test payments. Make it the best crypto payment API docs on the internet. | Developer signups |

### 3.2 The "Email Problem" — Getting Past Gmail

**Problem:** Cold emails for SaaS products go to spam. Nobody reads them.

**Solution:** Don't send cold emails. Instead, use the **product as the outreach tool:**

1. **The "Try Without Signup" link IS the outreach.** Tweet it. Post it. DM it. "Here, create a payment link right now: [link]"
2. **The "Claim Your Funds" email IS the conversion.** When someone actually gets paid through a trial link, the email "You have €47.50 waiting" has a 90%+ open rate — it's transactional, not promotional.
3. **Warm intros only.** After someone signs up, ask: "Know anyone else who'd benefit? Share your referral link for +€500 fee-free bonus."

---

## 4. Monetization Strategy

### 4.1 Pricing Tiers

| Tier | Price | Volume | Features |
|---|---|---|---|
| **Trial** | 0% fee | First €1,000 | Payment links, QR codes, basic dashboard, 1 currency |
| **Starter** | 1.5% per tx | €1,000 - €10,000/mo | All currencies, webhook notifications, email receipts |
| **Growth** | 1.0% per tx | €10,000 - €100,000/mo | Auto-convert to fiat, advanced analytics, priority support |
| **Enterprise** | 0.5% per tx (negotiable) | €100,000+/mo | White-label, dedicated account manager, custom integrations, SLA |

### 4.2 Revenue Boosters

| Feature | Revenue Model |
|---|---|
| **Auto-convert to stablecoin/fiat** | +0.5% spread on conversion (Binance integration already built) |
| **Instant fiat off-ramp** | +1% on fiat withdrawal (partner with on-ramp provider) |
| **White-label checkout** | €99/month flat fee — remove DynoPay branding from payment pages |
| **Premium webhooks** | Free: 3 retries. Premium (€29/mo): 10 retries + Hookdeck-style dashboard |
| **Referral program** | Give €500 fee-free, get €500 fee-free for each referral. Cost: deferred revenue, but LTV >> CAC |

### 4.3 Early Offers (First 100 Customers)

| Offer | Purpose |
|---|---|
| **"Founder's Rate" — 0.75% for life** | Lock in first 50 customers at a rate that's still profitable but feels exclusive |
| **"First €1,000 free"** | Zero-risk trial, converts at high rate because merchant has already received real money |
| **"Crypto for Freelancers" bundle** | Partner with invoicing tool: DynoPay + InvoiceNinja = accept crypto on invoices. Free for 3 months. |

---

## 5. Implementation Roadmap

### Phase 1: "Try Before Signup" (Week 1-2) — THE ACQUISITION FUNNEL

```
Priority: 🔴 CRITICAL — this is the primary growth driver
```

**Sprint 1 (Days 1-3): Backend**
- [ ] Create `tbl_trial_payment_links` model + migration
- [ ] Create `POST /api/public/create-trial-link` endpoint (no auth, rate-limited)
- [ ] Wire trial link to merchant pool address assignment
- [ ] Create `POST /api/public/claim-funds` endpoint
- [ ] Create `trialConversionService.ts` — claim → account creation → fund release
- [ ] Add trial link webhook handling (hold funds in escrow until claimed)
- [ ] Test: create trial link → pay → verify funds held → claim → verify account created

**Sprint 2 (Days 4-6): Frontend**
- [ ] Create `/try/[slug]` payment page — minimal, mobile-first, no login required
- [ ] Create `/try/[slug]/claim` — email capture + account creation
- [ ] Add "Create Payment Link" CTA on landing page hero section
- [ ] Add inline form: amount + description → generates link + QR in 3 seconds
- [ ] Test: full flow end-to-end on mobile + desktop

**Sprint 3 (Day 7): Polish**
- [ ] Add hCaptcha to creation form
- [ ] Rate limiting (5 links/IP/24h)
- [ ] Expiry handling (24h unpaid, 72h unclaimed)
- [ ] Welcome email template for new merchants
- [ ] "Trial ending" email template

### Phase 2: Fee-Free Trial System (Week 2-3)

```
Priority: 🔴 HIGH — converts trial users to free accounts
```

- [ ] Add `fee_free_remaining_usd`, `cumulative_volume_usd`, `fee_tier` to company model
- [ ] Modify fee calculation in `cryptoVerification` to check remaining balance
- [ ] Atomic DB decrement to prevent race conditions
- [ ] Dashboard widget: "€743 fee-free remaining" progress bar
- [ ] Email notifications: approaching limit, limit reached
- [ ] Env var: `FREE_TRIAL_VOLUME_USD=1000`
- [ ] Test: payment below threshold → 0% fee, payment crossing threshold → partial fee, payment above threshold → full fee

### Phase 3: Idempotency Keys (Week 3)

```
Priority: 🟡 MEDIUM — prevents double charges
```

- [ ] Create `idempotencyMiddleware.ts`
- [ ] Apply to all payment creation endpoints
- [ ] Add `X-Idempotency-Key` support to frontend
- [ ] Document in API docs
- [ ] Test: duplicate requests, concurrent requests, different body with same key

### Phase 4: "Slow Block" UX (Week 3-4)

```
Priority: 🟡 MEDIUM — prevents customer confusion
```

- [ ] Create `blockchainStatus.ts` utility (mempool.space, etherscan APIs)
- [ ] Add congestion indicator to payment page
- [ ] Progressive status messages with timeline
- [ ] Timeout-proof polling (adaptive intervals)
- [ ] "Don't worry" messaging after 5 minutes
- [ ] Test: simulate slow confirmation, verify UI behavior

### Phase 5: Webhook Hardening (Week 4)

```
Priority: 🟢 LOW — defense in depth
```

- [ ] Log all incoming webhooks to payment journal
- [ ] Create admin webhook replay endpoint
- [ ] Verify Tatum retry configuration
- [ ] Add webhook gap detection (expected but not received within 10 min)
- [ ] Webhook health metrics in admin dashboard

---

## 6. Current System Inventory

### What Already Works (Don't Rebuild)

| Feature | Status | Notes |
|---|---|---|
| Payment link creation (authenticated) | ✅ Working | `POST /api/pay/createPaymentLink` |
| Crypto payment processing (BTC, ETH, LTC, DOGE, TRX, SOL, XRP, BCH) | ✅ Working | Full webhook → verification → settlement pipeline |
| QR code generation | ✅ Working | `utils/qrCodeWithLogo.ts` + `qrcode` package |
| Merchant pool address management | ✅ Working | Auto-assignment, release, monitoring |
| Merchant webhook notifications | ✅ Working | `payment.pending`, `payment.underpaid`, `payment.confirmed` |
| Email notifications | ✅ Working | SendGrid integration for all payment events |
| Auto-convert to stablecoin | ✅ Working | Binance integration for auto-sell |
| Settlement (UTXO + account-based) | ✅ Working | Single-TX multi-output for BTC, direct transfer for ETH/TRX |
| Admin dashboard | ✅ Working | Transaction history, company management, fee tracking |
| API key authentication | ✅ Working | Encrypted API keys, legacy + modern auth |
| BullMQ job queue | ✅ Working | 3 retries, exponential backoff, DLQ, health monitoring |
| Settlement idempotency | ✅ Working | Redis + PostgreSQL dual check (just added) |
| Admin ≠ Merchant wallet guard | ✅ Working | Blocks misconfigured settlements (just added) |
| Payment journal | ✅ Working | `tbl_payment_journal` — full audit trail (just added) |
| Queue backpressure | ✅ Working | 503 when overwhelmed (just added) |
| Stuck payment watchdog | ✅ Working | Cron every 2 min (just added) |
| Circuit breaker (Tatum) | ✅ Working | `utils/circuitBreaker.ts` |
| KYC enforcement | ✅ Working | Volume-based KYC gates |
| Referral system | ✅ Working | Referee codes, referral tracking |
| 2FA / OTP login | ✅ Working | Email OTP + Google Sign-In |
| Swagger/API docs | ✅ Working | `/api/docs` endpoint |

### What Needs to Be Built (This Document)

| Feature | Priority | Effort | Dependencies |
|---|---|---|---|
| No-account payment link creator | 🔴 P0 | 5-7 days | Merchant pool, QR code |
| "First €1,000 fee-free" system | 🔴 P0 | 2-3 days | Company model, fee calc |
| Customer-facing idempotency keys | 🟡 P1 | 1-2 days | Redis |
| "Slow block" resilient UI | 🟡 P1 | 2-3 days | Frontend only |
| Webhook reliability hardening | 🟢 P2 | 1-2 days | Payment journal (done) |
| Webhook replay admin endpoint | 🟢 P2 | 0.5 day | BullMQ |
| WooCommerce/Shopify plugin | 🟢 P2 | 3-5 days | Public API |
| Referral bonus (fee-free credits) | 🟢 P2 | 1-2 days | Referral system (done) |

---

## Appendix A: Environment Variables Needed

```env
# Trial system
FREE_TRIAL_VOLUME_USD=1000          # Fee-free threshold per company
TRIAL_LINK_EXPIRY_HOURS=24          # Unpaid trial link expiry
TRIAL_CLAIM_EXPIRY_HOURS=72         # Unclaimed funds expiry
TRIAL_LINK_RATE_LIMIT=5             # Max trial links per IP per 24h
TRIAL_MIN_AMOUNT_USD=5              # Minimum trial link amount
TRIAL_MAX_AMOUNT_USD=500            # Maximum trial link amount (pre-KYC)

# Idempotency
IDEMPOTENCY_TTL_HOURS=24            # How long idempotency keys are cached

# Blockchain status
MEMPOOL_SPACE_API=https://mempool.space/api
ETHERSCAN_API_KEY=                   # For gas price tracking (optional)
```

## Appendix B: Key Metrics to Track

| Metric | Target (Month 1) | How to Measure |
|---|---|---|
| Trial links created | 500 | `tbl_trial_payment_links` count |
| Trial links paid | 50 (10% conversion) | Status = 'paid' |
| Trial → Account conversion | 40 (80% of paid) | Status = 'claimed' |
| Fee-free volume processed | €20,000 | `SUM(cumulative_volume_usd)` |
| Paid customers (post-trial) | 15-20 | Companies with `fee_tier = 'standard'` |
| Monthly recurring revenue | €300-600 | 1.5% of post-trial volume |
| Webhook success rate | >99.5% | Payment journal events |
| Avg payment confirmation time | <5 min (BTC), <30s (ETH) | Payment journal timestamps |

---

*Document created: March 2026*
*Last updated: March 2026*
*Owner: DynoPay Engineering*
