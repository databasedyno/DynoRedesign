# Dynopay + SafeDeal — E2E Experience Audit & Fix Program · Phase 1 execution plan

Repo facts: Next.js frontend at `/app` root (Components/, pages/), Node/TS backend at `/app/backend`. Preview runs a PRODUCTION build (no hot reload → `rm -rf /app/.next-prod && sudo supervisorctl restart frontend`, ~3.5 min). Preview shares the LIVE prod DB → read-only for merchant data; SafeDeal QA only with throwaway `*@example.com` identities (cleaned up after). Prod deploy = "Save to GitHub" → GHA canary → swap.

Already existing (verify, don't rebuild): Getting-started hero + setup progress (dashboard), FirstPaymentCelebrationModal, AttentionFeed, EmptyStatePanel, Sandbox simulator card (Developers), checkout FSM with waiting→detected→confirmed timeline + underpaid/expired phases + receipt email field, SafeDeal fee-preview endpoint, admin Escrow → Withdrawals tab.

## Step 0 — Harness + living report (≈30 min)
- New living report `/app/memory/UX_AUDIT_E2E_2026-09.md`: one section per surface, table rows = `id · severity (P0/P1/P2/ENG) · persona · viewport/theme · what's wrong · proposed fix · status (open/fixed/shipped)`.
- Persona recipes (all already documented in test_credentials.md): merchant owner (TOTP via `print_totp.cjs 1`), empty brand 228 vs rich brand 1, SafeDeal buyer/seller (`sd-audit-*@example.com`, preview_code), admin (`moxxcompany@gmail.com`), guest checkout (`/pay?d=rNtQRX` with `addPayment`/`verifyCryptoPayment` mocked so no real address is reserved).
- Local Playwright walkthrough script `scripts/qa/e2e_audit_shots.mjs` (390×844 + 1440×900, light + dark) → `/tmp/e2e_audit/*.jpg`. Fallback for the platform screenshot tool when it's gated.
- Test: each persona reaches its surface; screenshots produced.

## Step 1 — Surface-by-surface audit + fixes (audit → fix → ship per surface)
Order: **Checkout → Merchant dashboard → SafeDeal → Admin** (revenue-critical first). Each surface: log findings → fix P0+P1 → tsc → prod rebuild → testing_agent (frontend) → mark rows "fixed" → hand to user for Save to GitHub.

### 1A Hosted checkout (`/pay`, CleanCheckoutV2)
Audit: all FSM phases via mocked `verifyCryptoPayment` (waiting, mempool/detected, confirmed, underpaid, overpaid, expired, failed), mobile above-the-fold (amount + coin picker / QR + address visible without scroll at 390×844), receipt-email capture across phases, copy/QR/wallet buttons, dark mode.
Planned fixes ("Checkout Core"):
1. Verified timeline — backend `webhooks/index.ts tatumCryptoWebHook` publishes "pending/detected" on receipt BEFORE the on-chain gate → move the publish after `gateIncomingTx` (processor) so the buyer never sees "detected" for a forged/unknown tx. Jest test.
2. Graceful expiry — expired card with clear "Start a new payment" CTA + what happened to funds sent late.
3. Exact under/over-payment copy — show received vs expected in coin + fiat, remaining amount, and what happens next (merchant credited / top-up instructions).
4. Mobile above-the-fold layout tweaks (measured from screenshots).
5. Receipt-email field present in awaiting + confirmed states, persisted with the session.
Test: jest (publish-after-gate), testing_agent frontend with mocked states, 390 + 1440.

### 1B Merchant dashboard + core pages
Audit (brand 1 rich, brand 228 empty): dashboard zones, pay-links, create-pay-link, invoices, transactions, wallet/payouts, customers, settings, developer keys, notifications — desktop/mobile, light/dark. Look for: misleading money states (deltas on lifetime metrics, fee-payer labels, pending vs settled), missing loading/empty/error states (error ≠ empty), mobile breakage, inconsistent labels (Company/Brand, Link/Pay link, Payout/Withdrawal).
Planned fixes ("Activation Core"):
1. Onboarding checklist — verify GettingStartedHero covers: brand → wallet → first link → share → (sandbox test) → first payment; fix any dead step.
2. Empty-state CTAs on pay-links / invoices / transactions / customers / products (create + share + "try sandbox").
3. Sandbox promotion — dashboard card for merchants with 0 live payments pointing to the sandbox simulator.
4. First-payment celebration — verify it fires (totalTransactions === 1 rule) and offers "share receipt / view payment".
5. One-click share (copy · Telegram · WhatsApp · X · email · QR) on pay-link rows/detail, invoice rows, and creation-success screens (reuse `CampaignShareTray` pattern).
Test: testing_agent frontend (brand 228 for empty states, brand 1 for rich).

### 1C SafeDeal (buyer + seller)
Audit: landing, signin, deals/new, deal page per state (invited / awaiting_payment / funded / delivered / completed / refunded / disputed) as BOTH parties, wallet (balances, statement, cashout), help. Mobile-first (Telegram users).
Planned fixes ("SafeDeal Core"):
1. Pre-signin explainer on `/safedeal/deal/[token]` for guests: what the deal is, amount, who pays the fee, 3-step "how it works", then sign-in CTA.
2. Simplified creation: fewer required fields up front, Telegram-first share sheet right after create (t.me share + copy + QR).
3. Fee transparency: fee line + net amount shown at funding and at cashout (use `/fee-preview`), no surprise deductions.
4. One obvious primary action per state per party (secondary actions collapsed under "More").
5. Wallet balance breakdown: Available · Held in escrow · Parked for payout · Pending cashout, each with a one-line explainer.
Test: testing_agent frontend with 2 throwaway example.com identities (funding simulated is disabled on this pod → funding UI audited with mocked responses); cleanup via `cleanup_r225.js`.

### 1D Admin console
Audit: overview, transactions, merchants, escrow/withdrawals, live console.
Planned fix ("Admin visibility"):
1. Backend `GET /api/admin/ops/attention` (read-only SQL): stuck payments (pending with detected tx / settlement failures, age, last journal error), failing webhooks (outbox rows with failures: endpoint, attempts, age, last error), pending withdrawals (SafeDeal + merchant payouts pending_approval/processing, age).
2. Admin Overview "Needs attention" panel: three lists with age + last error + deep links (transaction drawer / merchant / withdrawals tab). Refresh + counts in the admin nav badge.
Test: curl with admin token + testing_agent.

## Step 2 — Wrap-up
- Report finalised (every row has status), PRD.md + test_credentials.md updated, Phase 2 backlog (reminders at stall points, Telegram lifecycle alerts, notification-center parity, weekly merchant summary) listed with pointers.

## Ship cadence
Each surface = one batch. When a batch is green I say "ready to save" → user clicks Save to GitHub (deploy runs canary→swap→auto-rollback). I keep going on the next surface meanwhile.
