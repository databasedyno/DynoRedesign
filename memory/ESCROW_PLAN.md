# DynoPay Escrow Service — End‑to‑End Plan & Implementation Doc

_Last updated: 2026‑09 (session: escrow custody + two‑phase settlement + OTP onboarding)_

Standalone escrow product where DynoPay holds a buyer's crypto and releases it to a
seller only when the deal completes (buyer confirmation / auto‑release) or a dispute is
resolved. Reuses DynoPay's existing checkout, wallets, payout engine, admin console and
email system rather than porting the reference project (Lockbay).

> **Preview reality:** the preview pod runs in **SAFE MODE** against the **LIVE production
> Postgres DB** with background jobs OFF and the exchange unavailable. Therefore **funding,
> stablecoin conversion, custody and payouts are SIMULATED** (no on‑chain transaction, no
> real conversion). The state transitions (incl. `pending → paid`) are fully modelled so the
> flow is exercised end‑to‑end; real conversion/custody/payout only run in production behind
> the `ESCROW_LIVE_SETTLEMENT` flag (default OFF).

---

## 1. Locked decisions (defaults from the approved plan)
1. **Two‑phase settlement** — authorize the outcome now; pay out when a valid destination
   exists. Deals can sit **"completed — payout pending"**.
2. **Account‑wallet reuse requires sign‑in.** An OTP‑only party (no sign‑in) must paste an
   explicit stable address they control.
3. **Splits settle per‑leg independently** (seller leg and buyer leg pay as each address
   becomes available).
4. **Unclaimed funds:** reminders (cadence), then admin review; funds stay in stable custody.
5. **Value/custody:** fiat‑priced deals → convert to stable on funding → **pooled custody +
   per‑deal ledger** (NOT per‑deal addresses).
6. **Hold/payout stablecoins:** default **USDT‑TRON** + **USDC**.
7. **Fiat pricing:** **USD** first.
8. **Costs:** conversion + withdrawal folded into the buyer‑paid amount + network fees.
9. **Payouts stablecoin‑only in v1** (non‑stable second conversion is later).
10. **Counterparty identity:** **email OTP** (6‑digit), account optional.
11. **KYC:** none in v1 (assumption; flag if legal review needed above a threshold).

---

## 2. Value & custody model
- Deal priced in fiat (USD) = source of truth for what's owed.
- Buyer pays any supported crypto at the live rate.
- On funding: sweep to platform custody, **convert to a stablecoin** (skip if already stable),
  record the stable amount per‑deal in the ledger. Held in stable so value never drifts.
- Release/refund/split pays out in a **stablecoin of the seller's choosing** (USDT‑TRON / USDC).
- Pooled custody (one platform stable balance) + a per‑deal ledger entry (`custody_amount_stable`,
  `custody_stablecoin`). No per‑deal deposit addresses in this revision.

---

## 3. Two‑phase settlement (the focus of this revision)

**Phase 1 — Outcome authorized.** Triggered by buyer confirmation, the auto‑release timer, or
an admin ruling. Locks each party's entitlement in **stable** value. Requires **no** payout
address. Sets `outcome` + `outcome_authorized_at` and the deal `status`.

**Phase 2 — Payout executed.** Funds leave custody to the destination. Executes as soon as a
valid destination exists — immediately if on file, else later when it's added. Per **leg**.

**Overall label (derived):** `completed — payout pending` → `completed — payout paid`
(same for `refunded …`; split shows per‑leg `paid/pending`).

### Payout legs
| Outcome     | Seller leg                        | Buyer leg                          |
|-------------|-----------------------------------|------------------------------------|
| `release`   | seller entitled to `sellerReceives` (stable); needs seller stable address | n/a |
| `refund`    | n/a                               | buyer entitled to `buyerPays` (stable); needs buyer refund address |
| `split`     | seller entitled to `sellerShare`  | buyer entitled to `buyerShare`     |

Each leg state: `na | pending | paid | retrying`.

### Scenario matrix (seller side at release)
- Signed‑in + payout wallet → pay immediately.
- Signed‑in, no wallet → pending; prompt to add; pay on add.
- OTP‑only + stable address added earlier → pay immediately.
- OTP‑only + no address at release → **authorized, payout pending**; prompt (email + invite
  page, OTP‑verified) to add a stable address; on add + validate → payout executes → complete.

### Edge cases
- **Auto‑release** with no seller address → authorizes anyway; payout pending.
- **Dispute before timer** → timer paused; on resolution the two‑phase rule applies.
- **Refund** with no buyer address → `refunded — payout pending` until added.
- **Split** → legs settle independently; one may be paid while the other is pending.
- **Idempotent payout** — a leg pays out exactly once (buyer‑confirm racing the timer, address
  submitted twice, etc.).
- **No payout while `disputed`.**
- **Failed on‑chain payout (prod):** `retrying`, retried, admin alert; value safe in stable.
- **Unclaimed:** reminders, then `needs_admin_review`; funds stay in stable custody.

---

## 4. Counterparty onboarding (role‑aware, account‑optional)
- Open invite → **verify email once with a 6‑digit OTP** (Redis, 10‑min TTL). No account needed.
  In preview (`DISABLE_OUTBOUND_EMAIL=true`) the OTP is returned as `preview_otp` in the API
  response (mirrors the app's existing delete‑OTP pattern).
- On verify → issue a short‑lived **escrow session token** (Redis, ~1h) returned to the client;
  every subsequent public action carries it (`x-escrow-token` header) instead of re‑typing email.
- If the invited email **already has a DynoPay account** → surface `has_account:true` and offer
  one‑tap sign‑in (offered, not forced). Required **only** to pay to an account's saved wallet.
- **Buyer:** accept → pay; refund address optional.
- **Seller:** accept; add a stable payout address any time (before/after release) — funds wait.
- Offer (don't force) creating a full account afterwards.

---

## 5. Data model — `tbl_escrow_deal`
Created by migration **0035** (v1). This revision adds columns via migration **0036**
(`ALTER TABLE … ADD COLUMN IF NOT EXISTS`, additive/idempotent, safe on live prod).

**Core (0035):** escrow_id, deal_token, company_id, creator_user_id, creator_role,
counterparty_email, counterparty_user_id, title, description, amount, currency,
accepted_coins, terms, fee_percent, fee_min_usd, fee_payer, auto_release_days, status,
lifecycle timestamps (invited/accepted/declined/funded/delivered/auto_release/completed/
refunded/cancelled/disputed/dispute_resolved/expired), delivery_note, dispute_reason,
dispute_raised_by, dispute_resolution, split_percent_seller, seller_payout_address,
seller_payout_coin, buyer_refund_address, funding_coin, funding_crypto_amount,
funding_deposit_address, funding_tx_hash, funded_amount_usd, simulated, settlement_note,
activity_log (JSONB timeline).

**Added (0036 — custody + two‑phase + onboarding):**
- Custody: `custody_stablecoin`, `custody_amount_stable`, `converted_at`.
- Outcome: `outcome` (release|refund|split), `outcome_authorized_at`.
- Seller leg: `seller_entitlement_stable`, `seller_payout_state` (na|pending|paid|retrying),
  `seller_paid_at`, `seller_payout_tx`, `seller_signed_in`.
- Buyer leg: `buyer_entitlement_stable`, `buyer_payout_state`, `buyer_refund_coin`,
  `buyer_paid_at`, `buyer_payout_tx`, `buyer_signed_in`.
- Paid milestone: `fully_paid_at`.
- Reminders/unclaimed: `payout_reminder_count`, `payout_reminder_last_at`, `needs_admin_review`.
- Onboarding: `counterparty_verified_at`.

---

## 6. Status & transitions
`draft → invited → (declined | awaiting_payment) → funded → (delivered) → {completed|refunded|split}`
plus branches `disputed`, `cancelled` (pre‑funding), `expired`.
- `completed` = release authorized (seller entitled). `refunded` = refund authorized (buyer).
  `split` = split authorized (both). These are **phase‑1** states; the payout legs then move
  `pending → paid` (phase 2). Terminal for the lifecycle, sub‑state for payout.
- Invalid jumps rejected (`assertTransition`).

---

## 7. API contract (prefix `/api`)

### Merchant (Bearer JWT)
- `POST /escrow/fee-preview` {amount,currency,fee_percent,fee_min_usd,fee_payer} → breakdown
- `POST /escrow` {company_id,title,description,amount,currency,accepted_coins,terms,
  counterparty_email,creator_role,fee_percent,fee_payer,auto_release_days,send_invite}
- `GET  /escrow?company_id=&status=&role=buyer|seller`
- `GET  /escrow/:id`
- `POST /escrow/:id/simulate-fund` {coin}  (buyer; SAFE‑MODE only; converts to stable, funds)
- `POST /escrow/:id/deliver` {delivery_note}  (seller)
- `POST /escrow/:id/release`  (buyer → authorize release + attempt seller payout)
- `POST /escrow/:id/dispute` {reason}
- `POST /escrow/:id/cancel` {reason}  (creator, pre‑funding)
- `POST /escrow/:id/payout-info` {payout_address,payout_coin,refund_address}
  (signed‑in; sets destination → triggers pending payout execution)

### Public (token + email OTP; counterparty may have no account)
- `GET  /escrow/public/:token`  (read; no OTP)
- `POST /escrow/public/:token/send-otp` {email} → sends OTP (returns `preview_otp` in preview)
- `POST /escrow/public/:token/verify-otp` {email,otp} → {escrow_session, has_account}
- `POST /escrow/public/:token/respond` {action:accept|decline, reason?}  (needs x-escrow-token)
- `POST /escrow/public/:token/action` {action:fund|deliver|release|dispute|payout-info, …}
  (needs x-escrow-token; payout-info requires an explicit pasted stable/refund address)

### Admin (adminAuthMiddleware)
- `GET  /escrow/admin/deals?status=&company_id=`
- `GET  /escrow/admin/disputes`
- `POST /escrow/admin/:id/resolve` {outcome:release|refund|split, split_percent_seller, note}
- `POST /escrow/admin/run-auto-release`   (scan delivered past auto_release_at → authorize)
- `POST /escrow/admin/run-payout-reminders` (scan payout‑pending → remind / flag review)

---

## 8. Fee model (unchanged)
Escrow fee = `max(amount * fee_percent/100, fee_min_usd)`, default 5%, floor $1.
- `buyer`  → buyerPays = amount + fee; sellerReceives = amount.
- `seller` → buyerPays = amount; sellerReceives = amount − fee.
- `split`  → fee split 50/50.
Network + conversion + withdrawal costs are covered from the funded amount (buyer‑paid buffer).

---

## 9. Build phases & status
- [x] **P1 Backend v1** — model 0035, fee math, state machine, CRUD, invite, admin disputes,
  simulated fund + settlement, lifecycle emails, CSRF exemption for public. (DONE, tested)
- [ ] **P2 Backend revision (this session):** migration 0036 columns; stable conversion on
  funding; two‑phase authorize→payout with per‑leg states + idempotency; add‑address triggers
  payout; split per‑leg; email‑OTP onboarding (send/verify + session token); has_account
  detection; auto‑release + reminder admin scans; new/updated emails. → **test backend**.
- [ ] **P3 Frontend — public invite page** `/escrow/invite/[token]`: review terms + fee
  breakdown, OTP verify, role‑aware actions (accept/decline, fund, deliver, release, dispute),
  add stable payout / refund address, payout‑pending status, offer sign‑in when has_account.
- [ ] **P4 Frontend — merchant Escrow dashboard**: list + create (live breakdown, shareable
  link) + detail (timeline, role actions, settlement status). Nav entry next to Pay Links.
- [ ] **P5 Frontend — admin Escrow oversight**: deals list + dispute queue + resolve.

## 10. Later (out of scope now)
Non‑stable seller payouts (2nd conversion), multi‑fiat pricing, reputation/saved wallets
across deals, full counterparty accounts/dashboard, KYC gating, "escrow protection" toggle on
payment links, in‑app chat, referral invites, NGN cash‑out.
