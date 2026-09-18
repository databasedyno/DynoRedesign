# Escrow — Value, Custody, Onboarding & Settlement Completion

## Objective
Decide how escrow value is denominated, how funds are held while a deal is open, how the
invited counterparty joins and gets paid, and — the focus of this revision — **exactly when
a deal is considered settled relative to the seller having a payout wallet.**

Builds on the escrow service already in progress (a standalone product where the platform
holds crypto and releases it on completion or dispute resolution). In the preview, funding
and settlement are simulated and the exchange is unavailable, so real conversion/custody/
payout run only in production.

---

## Value & custody model (from the prior revision, unchanged)
- **Deals are priced in fiat** (e.g., USD) — the source of truth for what's owed.
- Buyer pays in any supported crypto at the live rate.
- On funding, funds are **swept to platform custody and converted to a stablecoin** (skip if
  already stable) and recorded per-deal in an internal ledger.
- **Held in stable** while open, so value never drifts with the market.
- Release / refund / split pay out in a **stablecoin** of the seller's choosing.
- This uses **pooled custody + a per-deal ledger** (not per-deal addresses).

---

## Settlement completion & seller payout timing (this revision)

Settlement is **two phases**, so a missing or late wallet never blocks the deal:

1. **Outcome authorized.** Triggered by buyer confirmation, the auto-release timer, or an
   admin ruling. The seller's (and/or buyer's) entitlement is locked in stable value. Does
   **not** require a payout address.
2. **Payout executed.** Funds leave custody to the destination address. Runs as soon as a
   valid destination exists — immediately if on file, or later when it's added.

A deal therefore has a clear "decided but not yet paid" state: **"completed — payout
pending"**, which becomes **"completed — paid"** once the transfer succeeds. Because value is
held in stable, time spent pending costs the seller nothing.

### Scenario matrix (seller side, at the moment of release)
- **Seller signed in to an existing account with a payout wallet** → pay out immediately to
  the confirmed wallet.
- **Seller signed in, but no payout wallet set** → payout pending; prompt to add one; pay on
  add.
- **Seller has no account but added a stable address earlier** → pay out immediately.
- **Seller has no account and no address at release** → outcome authorized, **payout
  pending**; seller is prompted (email + invite page, OTP-verified) to add a stable address;
  on add + validation → payout executes → fully complete. (This directly answers: yes,
  settlement completes after the seller adds a wallet post-trade.)

### Auto-release edge cases
- Timer elapses with no seller address → still authorizes automatically; payout pending
  (never blocked by the missing address).
- A dispute opened before the timer → timer paused (already handled); on resolution the same
  two-phase rule applies.

### Refund side (buyer)
- Refund needs a **buyer refund address**. Buyer with account (signed in) → available; buyer
  without → must provide one. If absent at refund time → **"refunded — payout pending"** until
  they add it. Same two-phase pattern.

### Split outcome (needs both destinations)
- Seller leg pays when the seller's stable address is available; buyer leg pays when the
  buyer's refund address is available. **Each leg can settle independently** — one side may be
  paid while the other stays pending.

### Existing-account reuse — security stance
- Paying to an account's saved wallet requires the seller to have **signed in** (proved
  identity), not merely that the invited email equals an account email. An OTP-only seller
  (no sign-in) must paste an explicit stable address they control. This prevents anyone
  holding the invite link from redirecting funds.

### Integrity / failure handling
- **Idempotent payout** — a deal pays out once even if the address is submitted twice or a
  trigger fires twice (e.g., buyer confirm racing the auto-release timer).
- **No payout while disputed** — a pending payout does not execute until a dispute resolves.
- **Failed on-chain payout (production):** stays "payout pending (retrying)", retried, with an
  admin alert; value remains safe in stable custody.
- **Unclaimed funds:** if payout stays pending because the seller never adds an address,
  reminders are sent, then after a set window it goes to admin review (policy in decisions).
- **Preview:** the payout step is simulated, but the pending → paid transition is still
  modeled so the flow is exercised end-to-end.

---

## Counterparty onboarding (role-aware, account-optional)
- Verify the email once with a **6-digit OTP** when the invite opens (no account needed).
- If the invited email **already has an account**, offer one-tap sign-in to reuse wallet +
  identity (offered, not forced; required only to pay to an account wallet — see above).
- **Buyer:** accept, then pay; refund address optional.
- **Seller:** accept; add a stable payout address any time (before or after release) — funds
  wait safely.
- Offer, don't require, creating a full account afterwards.

---

## Decisions to confirm
1. **Two-phase settlement** (authorize the outcome now, pay out when a valid destination
   exists; deals can sit "completed — payout pending"). Recommended: yes.
2. **Reuse of an existing account's wallet requires sign-in**, while OTP-only parties must
   paste their own address. Recommended: yes (security).
3. **Splits settle per-leg independently** as each address becomes available. Recommended:
   yes.
4. **Unclaimed-funds policy:** how long a pending payout waits (reminder cadence) and what
   happens after (recommended: reminders, then admin review; funds stay in stable custody).
5. Value/custody model: adopt fiat + convert-to-stable + pooled custody (recommended).
6. Hold/payout stablecoin(s) & network(s) (default: USDT-TRON + USDC).
7. Fiat pricing currencies (default: USD first).
8. Who bears conversion + withdrawal costs (recommended: folded into the buyer-paid amount
   with network fees).
9. Stablecoin-only payouts in v1 (recommended) vs a later second conversion to a non-stable
   coin.
10. Counterparty identity check: email OTP (recommended) / type-the-email / full account.
11. KYC/compliance for receiving parties and pooled custody: none in v1 (assumption); flag if
    legal review is needed above a threshold.

---

## Scope
- **This version:** fiat-priced deals; convert-to-stable on funding into pooled custody with a
  per-deal ledger; **two-phase settlement** with a "payout pending" state so a deal completes
  once the seller adds a wallet (or immediately if already available); stable payouts on
  release/refund/split with per-leg splits; email-OTP counterparty verification; reuse an
  existing account (sign-in required to use its wallet); the public invite page reflecting all
  of this. Conversion/custody/payout are simulated in preview.
- **Later:** non-stable seller payouts (second conversion), multi-fiat pricing, reputation and
  saved wallets across deals, full counterparty accounts/dashboard, and any KYC gating.
