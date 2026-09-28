> ============================================================================
> ## ⚠️ TOP PRIORITY FOR NEXT AGENT (2026-09-20): FUNDS / FEES / PAYOUTS ACCURACY AUDIT
> ============================================================================
> Two backend refinements were implemented this session but **NOT YET TESTED**:
> (1) auto-withdraw **sweep-on-enable**, (2) mutually-agreed cancellation **escrow-fee waiver**.
> Before anything ships, run deep_testing_backend_v2 and verify that **every calculation
> relating to funds, fees, and payouts is accurate** across the escrow/SafeDeal money model —
> not only the two new paths. Full step-by-step test scenarios (A cancellation waiver + control,
> B sweep) live at the TOP of `memory/SAFEDEAL_NOTES.md`; file-level change detail is in the
> `test_result.md` top block. Read-only DB: `node /app/backend/scripts/ro_query.js "SELECT ..."`.
>
> ### Money model (source of truth to check against)
> - `computeFeeBreakdown` (controller/escrow/escrowShared.ts) → `escrowFee`, `exchangeFeeUsd`
>   (conversion when funding coin ≠ stablecoin), `passThroughCosts` (network + conversion +
>   withdrawal), `totalCost`, `buyerPays`, `sellerReceives`, `platformFee`.
> - Funding: buyer pays `buyerPays`; custody converts to USDT → `custody_amount_stable` (= "held").
> - Settlement: `authorizeOutcome` sets entitlements → `attemptPayouts` →
>   `settleToWallets` (SafeDeal wallet ledger) + `settlementPayout` (external send / kept / parked).
>
> ### Invariants that MUST hold (assert each against tbl_customer_ledger + wallet balances)
> 1. **Custody conservation:** for every settled deal, `held == seller_credit + buyer_credit +
>    escrowFee + exchangeFee + passThroughCosts (± rounding ≤ $0.01)`. No dust left, no over-credit.
> 2. **Fee-payer math:** buyer-pays → `buyerPays = amount + totalCost`, `sellerReceives = amount`.
>    seller-pays → `buyerPays = amount`, `sellerReceives = amount − totalCost`. split → totalCost
>    shared per policy. Displayed breakdown (fee-preview / serializeDeal) MUST equal what is
>    actually charged/credited at settlement (what the user saw = what they get).
> 3. **Release:** seller gets `sellerReceives`; platform keeps escrowFee + real costs; buyer $0.
> 4. **Refund (normal dispute / admin ruling):** buyer gets `held − totalCost` (fee + costs KEPT).
> 5. **Refund (mutually-agreed cancellation):** buyer gets `held − real costs`, escrow fee = $0
>    (waived). Must equal normal-refund + escrowFee, and tbl_customer_ledger must have NO
>    escrow_fee debit. Waiver applies ONLY when `dispute_proposal.kind === 'cancellation'` was
>    dispute-accepted — a countered/negotiated refund or an admin ruling still KEEPS the fee.
> 6. **Split:** seller gets split% of the pool, buyer the remainder; fees/costs counted once.
> 7. **Fee floor:** when `5% < fee_min_usd`, the minimum applies (and is shown + charged);
>    a waived cancellation → $0 regardless of the floor.
> 8. **Withdrawal fee:** settlement legs use `fee_covered=true` (fee already reserved in the deal
>    quote's passThroughCosts → no double charge). Manual withdraw AND the new auto-withdraw
>    sweep charge the network fee (fee_covered=false, min $10, >$1000 → pending_approval).
>    Confirm a 'kept' settlement balance later withdrawn manually is not surprisingly double-charged.
> 9. **Sweep-on-enable:** swept = full available (or PARKED if the address is in its 24h cooling);
>    parked_payout_usd ≤ available always; no double-send between releaseParkedPayouts + sweep;
>    toggling auto-withdraw OFF clears parked.
> 10. **Rounding & sign:** all values round2; rounding-guard entry ≤ $0.01; never negative
>     balances; `buyerRefund`/`sellerAmount` ≥ 0.
> 11. **Idempotency:** payout legs are state-gated (pending→paid); re-running attemptPayouts must
>     NOT double-pay and must not create duplicate ledger rows.
> 12. **Currency/coin:** non-USD deals converted via `fiatToUsd`; custody always USDT; refunds
>     denominated in USDT regardless of funding coin. Verify FX rounding doesn't leak value.
> 13. **Auto-release (3-day):** auto-released deals settle to the same seller entitlement as a
>     manual release.
> 14. **Live vs simulated:** with `ESCROW_LIVE_SETTLEMENT` off, funding + payouts are simulated;
>     SafeDeal wallet credits are real either way. On-chain (non-SafeDeal) broadcast is NOT wired
>     in v1 ("never broadcast in v1") — confirm nothing attempts a real on-chain send.
>
> ### Suggested method
> Drive throwaway SafeDeal deals (brand company_id 262, `sd_qa_*@example.com`) through each
> outcome (release, normal-refund, cancellation-refund, split) for BOTH fee_payer=buyer and
> fee_payer=seller, and reconcile the ledger to the invariants above. Reset any touched
> customer to auto_withdraw=false / parked=0 afterwards.
> ============================================================================


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

---

## SESSION UPDATE (2026‑09, fork: continue‑escrow)

### Done this session
- **Backend re‑test PASSED 7/7** (OTP onboarding, custody convert, two‑phase
  authorize→payout per‑leg, split/refund/release, run‑auto‑release, guards,
  idempotency). SAFE MODE, simulated money.
- **Frontend P3+P4+P5 BUILT** (MUI, DynoPay design system):
  - `api/escrow.ts` — merchant (`escrowApi`) / admin (`escrowAdminApi`) / public
    (`escrowPublicApi`, bare axios + `x-escrow-token`).
  - Merchant: `pages/escrow/index.tsx` (+ `Components/Page/Escrow/EscrowDashboard.tsx`,
    `CreateEscrowDialog.tsx`), `pages/escrow/[id].tsx` (+ `EscrowDetail.tsx`),
    shared `escrowUtils.ts` + `StatusChip.tsx`. Nav entry in "Sell"
    (navSections.ts + NewSidebar icon `escrow`→Handshake). `/escrow` protected,
    `/escrow/invite` public (helpers/publicPaths.ts), `_app` privatePrefixes += `/escrow`.
  - Public invite `pages/escrow/invite/[token].tsx` (layout "none") +
    `Components/Page/Escrow/Public/EscrowInvite.tsx` — email‑OTP verify + role actions
    + add stable/refund address + payout‑pending + offer sign‑in when has_account.
    VERIFIED rendering (screenshot) — summary + fee breakdown + OTP card.
  - Admin `pages/admin/escrow.tsx` + `Components/Page/Admin/Escrow/index.tsx` — deals
    list + dispute queue + resolve (outcome/split slider/note) + run‑auto‑release /
    run‑payout‑reminders. Admin nav "Escrow" (Menus.tsx).
  - All three routes compile & serve 200 (verified). Frontend E2E NOT yet green —
    first test run was blocked by a dev‑server memory‑restart window + the 2FA
    segmented‑OTP selector; NOT real bugs. RE‑RUN frontend E2E.

### Fee/cost model change (user decisions: 1‑c cost split follows fee_payer; 2 automatic;
###   3 USDT+USDC; 4 reuse existing Binance code; 5 itemized)
- §8 replaced: price now = escrow fee (5%, floor $1, platform revenue) **+ pass‑through
  costs**: inbound **network** sweep + Binance **conversion** (~0.1% taker) + outbound
  **withdrawal** (Binance flat per payout network). Total allocated per `fee_payer`
  (buyer on top / seller net / split 50‑50). Costs are ESTIMATES folded into the quote,
  refined at funding once the real coin is known.
- NEW `backend/services/escrow/escrowCosts.ts` — sync static rate table (env‑overridable)
  + best‑effort `refreshEscrowCostRates()` that pulls LIVE rates from existing
  `blockchainFeeService.getBlockchainNetworkFee` (sweep) and new
  `binanceService.getWithdrawFeesUsd()` (Binance `/sapi/v1/capital/config/getall`),
  static fallback in SAFE MODE. Payout options: USDT‑TRON/ERC20/POLYGON, USDC‑ERC20/POLYGON.
- `computeFeeBreakdown` (escrowShared.ts) extended: returns `networkFeeUsd,
  conversionFeeUsd, withdrawalFeeUsd, passThroughCosts, totalCost, payoutCoin,
  costsEstimated, costItems[]` (+ existing escrowFee/buyerPays/sellerReceives now
  include costs). Callers updated: serializeDeal (passes payoutCoin/fundingCoin/
  acceptedCoins), actFund (fundingCoin=coin), previewFee (accepts `payout_coin`,
  fires refresh). Backend BOOTS HEALTHY after change.

### TODO for next agent (in order)
1. **BACKEND re‑test the new fee/cost model** (deep_testing_backend_v2): POST /api/escrow/fee-preview
   with {amount,fee_payer,payout_coin} for buyer/seller/split — assert escrowFee + networkFeeUsd +
   conversionFeeUsd + withdrawalFeeUsd sum into totalCost and buyerPays/sellerReceives allocate per
   fee_payer; withdrawal fee changes with payout_coin (USDT-TRON vs USDT-ERC20); costItems length=4.
   Re‑confirm the full lifecycle still passes (it's additive). Note: line ~247 authorizeOutcome's
   computeFeeBreakdown call still uses default payout coin (minor; entitlements use sellerReceives) —
   optionally pass deal.seller_payout_coin there too.
2. **FRONTEND display of itemized costs**: `Components/Page/Escrow/escrowUtils.ts` `FeeBreakdown`
   type + the three surfaces (CreateEscrowDialog fee-preview panel, EscrowDetail Amounts card,
   EscrowInvite summary) should render costItems (escrow fee / network / conversion / withdrawal)
   + total. Currently they show only escrowFee/buyerPays/sellerReceives (still correct, just not
   itemized yet). Also expand PAYOUT_STABLECOINS in escrowUtils.ts to the 5 options above and let
   the create dialog + address forms pick the payout coin so the quote's withdrawal fee matches.
3. **RE‑RUN frontend E2E** (auto_frontend_testing_agent) — see test_result.md handoff for the exact
   testids + login recipe. For the 2FA step, target the TOTP entry specifically (the screen renders
   segmented digit boxes → `input[type=text]` matches many).


## SESSION UPDATE (2026-06, fork: escrow-design-polish) — FRONTEND POLISH SHIPPED (code), E2E PENDING

### Done this session (frontend only; backend untouched — it already returns itemised fees)
- **Shared components** (new, `/app/Components/Page/Escrow/`):
  - `CoinIcon.tsx` — `CoinIcon`, `CoinChip`, `coinInfo(code)` using the checkout's Iconify `cryptocurrency-color:*` set.
  - `FeeBreakdownCard.tsx` — itemised: escrow fee / network / conversion / withdrawal → total + buyer pays / seller receives.
  - `EscrowProgress.tsx` — step ladder (Invited→Accepted→Funded→Delivered→Released/Refunded/Split→Paid out; terminal banner + disputed amber).
- **api/escrow.ts** — `FeeBreakdown` extended (networkFeeUsd/conversionFeeUsd/withdrawalFeeUsd/passThroughCosts/totalCost/payoutCoin/costsEstimated/costItems[] + `CostItem`); `feePreview` sends `payout_coin` + `accepted_coins`.
- **escrowUtils.ts** — `PAYOUT_OPTIONS` (5 nets: USDT Tron/ERC20/Polygon, USDC ERC20/Polygon), `PAYOUT_STABLECOINS`, `payoutOptionLabel()`.
- **CreateEscrowDialog** — DynoPay Logo header, role/fee-payer cards, coin icon chips, live itemised quote, QR success (qrcode.react), confetti.
- **EscrowDetail** — progress card, FeeBreakdownCard amounts, coin icons in custody/legs, 5-network payout picker, confetti on release/pay.
- **EscrowInvite (public)** — DynoPay Logo brand bar, progress tracker, itemised breakdown, coin icons, 5-network cash-out, confetti.
- **EscrowDashboard** — DynoPay Logo in banner.
- Verified `tsc --noEmit` = 0; all escrow routes compiled; `/escrow` = 200 locally.

### TODO for next agent (in order)
1. **RE-RUN frontend E2E via testing_agent** — escrow surfaces. Merchant login = user 1 (onarrival21@gmail.com,
   TOTP: `node /app/backend/scripts/print_totp.cjs 1`). Flows: create deal (assert escrow-fee-preview itemised rows
   escrow-cost-escrow_fee/network_fee/conversion_fee/withdrawal_fee, escrow-preview-buyerpays/-sellerreceives,
   escrow-preview-total; on submit assert escrow-created-qr + invite url). Deal detail: escrow-detail-progress renders,
   payout network picker escrow-address-coin shows 5 options. Public invite: escrow-invite-progress + escrow-invite-total
   + OTP (single field escrow-invite-otp, preview_otp returned) → accept → fund → deliver → release.
   Preview URL: https://passphrase-config-1.preview.emergentagent.com (retry if Cloudflare 502 —
   transient at wrap-up). To create a public-invite test deal, POST /api/escrow (merchant token) then use returned deal_token.
2. Optional: expand FUNDING_COINS chip set / add per-network sub-labels if desired; wire payout_coin into the
   create quote (currently the quote uses default USDT-TRON withdrawal fee; seller picks the real network later).
3. COMMIT via "Save to GitHub" (nothing pushed from pod).
