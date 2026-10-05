# ============================================================================
# SESSION HANDOFF (2026-09-20) — 2 backend refinements IMPLEMENTED, NOT YET TESTED
# ============================================================================
# STATUS: code complete, `tsc --noEmit` = 0 errors, backend restarted healthy. NO testing-agent
#   run yet. NEXT AGENT: run deep_testing_backend_v2 with the 2 scenarios below; then, with user
#   OK, run the frontend flow. Preview: https://vault-setup-17.preview.emergentagent.com
#   >>> ALSO SEE memory/ESCROW_PLAN.md TOP: "FUNDS / FEES / PAYOUTS ACCURACY AUDIT" — the next
#       agent must verify EVERY funds/fee/payout calculation & invariant, not just these 2 changes.
#
# WHAT CHANGED (file-level detail is in test_result.md top block):
#  1) AUTO-WITHDRAW SWEEP-ON-ENABLE — services/safedeal/safedealWithdrawals.ts::
#     sweepBalanceToAutoWithdraw(), called from safedealController.updateProfile after
#     releaseParkedPayouts. Turning auto-withdraw ON now also pushes the CURRENT available
#     balance out (not just future/parked). Cooling address -> PARK whole balance; else normal
#     withdrawal (fee applies, >$1000 -> pending_approval).
#  2) CANCELLATION FEE WAIVER — escrow/escrowShared.ts computeFeeBreakdown(waiveEscrowFee) +
#     escrowController.ts isCancellationRefund()/authorizeOutcome/attemptPayouts/serializeDeal.
#     A mutually-agreed cancellation (refund proposal kind='cancellation' that the OTHER party
#     dispute-accepts) waives the 5% escrow fee; only real network/exchange/withdrawal costs kept.
#     Buyer refund = custody_held - real costs. Plain dispute-refund / admin ruling STILL keeps
#     the fee. Derived from persisted deal.dispute_proposal.kind — NO DB migration.
#
# TEST PLAN  (SafeDeal API base = <preview>/api/safedeal ; auth: POST auth/send-code {email}
#   returns preview_code -> POST auth/verify-code {email,code} -> {token}; header x-safedeal-token.
#   New customers via this API land on brand company_id=262. Throwaway emails: sd_qa_*@example.com.
#   Read-only DB checks: node /app/backend/scripts/ro_query.js "SELECT ...").
#
#  SCENARIO A — cancellation fee waiver (PRIMARY):
#   1. Seller signup; POST /deals {title, amount:200, price_currency:"USD",
#      counterparty_email:<buyerEmail>, my_role:"seller", fee_payer:"buyer"} -> deal_token.
#   2. Buyer signup; POST /deals/:token/action {action:"accept"}.
#   3. Buyer POST /deals/:token/action {action:"fund", coin:"USDT-TRC20"} (simulated while
#      ESCROW_LIVE_SETTLEMENT is off; if it errors, POST /deals/:token/funding {coin} first).
#      Record custody_amount_stable (=held) + cost breakdown.
#   4. Buyer POST /deals/:token/action {action:"cancel"} -> expect {requested:true}.
#   5. Seller POST /deals/:token/action {action:"dispute-accept"} -> settles as refund.
#   ASSERT: buyer wallet (GET /wallet as buyer) credited ~= held - (network+exchange+conversion+
#      withdrawal); escrow fee NOT deducted. getDeal breakdown shows "Escrow fee (waived)" = 0.
#      tbl_customer_ledger (where escrow_id=<id>) has NO escrow_fee debit. For a $200
#      buyer-pays-fee deal the refund is ~$10 (the 5% fee) higher than a normal refund.
#   CONTROL: repeat but use a NORMAL dispute refund instead of cancel
#      (action:"dispute" {proposed_outcome:"refund", reason:"x"} -> seller "dispute-accept") ->
#      escrow fee IS still deducted. Confirms the waiver is cancellation-only.
#
#  SCENARIO B — auto-withdraw sweep-on-enable:
#   Use the Scenario-A buyer (holds a refund balance) OR seller cid607 (has $250 available).
#   1. POST /wallet/addresses (inspect createAddress for coin/network/address fields). Any NEW
#      address is in its 24h cooling-off.
#   2. POST /profile {auto_withdraw:true, auto_withdraw_address_id:<id>}.
#   3. ASSERT: address is cooling -> balance is PARKED not sent: tbl_safedeal_profile.parked_payout_usd
#      == available (ro_query); available unchanged; GET /wallet reflects it. (The 'sent' path needs
#      an address >24h old which can't be freshly created -> known coverage gap; the hourly
#      releaseParkedPayouts job sends it once usable.)
#   4. POST /profile {auto_withdraw:false} -> parked_payout_usd back to 0.
#
# CLEANUP: reset any touched customer to auto_withdraw=false, parked=0 (cid607/608 are throwaway
#   SafeDeal-brand QA customers; safe to mutate, but reset the toggle).
# ============================================================================


# ============================================================================
# >>> CONSOLIDATED PENDING TASKS (compiled on pod setup) <<<
#   Pod set up from env.vault.enc (passphrase Katiekendra123@). All services healthy:
#   backend db+redis connected, SAFE MODE (background jobs OFF), frontend 200, external 200.
#   SAFE MODE = wired to PRODUCTION DB, money SIMULATED (ESCROW_LIVE_SETTLEMENT off) -> prefer
#   READ-ONLY; only mutate throwaway sd_qa_*/cid607/cid608 SafeDeal-brand (company_id=262) rows.
# ============================================================================

## P0 — VERIFIED ✅ (deep_testing_backend_v2 this session: 23/23 pytest PASS + Scenario A/B/control PASS + money-model invariants reconciled against the ledger, no bugs)
- [ ] **Test the 2 implemented-but-UNTESTED backend refinements** via `deep_testing_backend_v2`.
      Code complete, `tsc --noEmit` = 0 errors, backend healthy — but NO testing-agent run yet.
  - [ ] **Scenario A — cancellation escrow-fee waiver** (+ CONTROL): a mutually-agreed cancellation
        (dispute_proposal.kind='cancellation' dispute-accepted by the other party) WAIVES the 5%
        escrow fee; only real network/exchange/conversion/withdrawal costs are kept. CONTROL: a
        plain dispute-refund / admin ruling STILL keeps the fee. Full steps at top of this file.
  - [ ] **Scenario B — auto-withdraw sweep-on-enable**: turning auto-withdraw ON also pushes the
        CURRENT available balance out; if the address is in its 24h cooling-off the whole balance
        is PARKED (parked_payout_usd) for hourly release. Full steps at top of this file.
- [ ] **Full FUNDS / FEES / PAYOUTS accuracy audit** (memory/ESCROW_PLAN.md invariants 1-14, not
      just the 2 new paths). Reconcile tbl_customer_ledger + wallet balances for release /
      normal-refund / cancellation-refund / split, for BOTH fee_payer=buyer and fee_payer=seller.
      Key invariant: custody conservation (held == seller_credit + buyer_credit + escrowFee +
      exchangeFee + passThroughCosts, +/- $0.01) and "what the user saw == what they get".

## P1
- [ ] Admin dispute queue **filters** (In negotiation / Escalated / All).
- [ ] **PROD go-live ops for SafeDeal brand (company_id=262)** — ops config, not code:
      add Dynopay-custody crypto wallets per coin to brand 262 (buyer funds must forward to
      Dynopay, never a 3rd party); enable auto-convert -> USDT on the brand; set
      ESCROW_LIVE_SETTLEMENT=true and SAFEDEAL_URL=https://safedeal.sh in prod.
- [ ] **safedeal.sh DNS cutover** — owner must switch Namecheap nameservers to DigitalOcean
      (DO zone already created: A @ -> 134.209.94.115, CNAME www -> @). ROTATE the DO API token
      that was pasted in chat during setup.
- [ ] **Purge ~65 legacy test deals** from tbl_escrow_deal.

## P2
- [ ] "Escrow protection" toggle on Dynopay payment links.
- [ ] KYC gating for large volumes.

## NON-BLOCKING housekeeping — BOTH DONE this session ✅
- [x] Refreshed 6 stale legacy pytest expectations to the new 24h cooling-off + 12-key readiness
      contract: test_safedeal_api.py::test_add_address_and_withdraw, test_safedeal_iter203.py
      withdraw tests, and test_admin_readiness. (withdraw tests backdate the payout address past
      the cooling-off via scripts/_pgq.js; readiness now expects 12 keys and no longer hard-asserts
      wallets.ok=False since brand 262 now has 13 funding wallets.) 23/23 pytest green.
- [x] Added data-testid="sd-new-currency-select" to the /safedeal/deals/new currency combobox
      (Components/SafeDeal/NewDeal.tsx, via SelectProps.SelectDisplayProps). Options already had
      data-testid="sd-new-currency-<CODE>". Frontend E2E re-verification pending (optional).

## Already DONE / verified (do NOT redo)
- SafeDeal buyer<->seller E2E (fund -> deliver -> release) — PASSED (frontend testing agent).
  Deal e79888ff… is now COMPLETED/consumed; mint a fresh deal to re-run.
- iteration_207 direct-API funding, iteration_208 wallet top-ups/exchange-fee/auto-withdraw/invoices
  — implemented & verified (see build-notes sections below).
# ============================================================================





# ============================================================================
# >>> SESSION LOG — email deliverability RCA + fee-copy waiver update <<<
#
# 1) PROD EMAIL "OTP never arrived" (moxxcompany -> testsafe@dyno.pt, deal escrow_id 180,
#    source=safedeal brand 262) — ROOT CAUSE: NOT an app bug. Brevo transactional event log
#    (GET https://api.brevo.com/v3/smtp/statistics/events?email=<addr>) shows the invite AND both
#    SafeDeal sign-in codes were "delivered" (accepted by the recipient MX) from hi@safedeal.sh.
#    Recipient dyno.pt = iCloud (mx01/02.mail.icloud.com), which junks new/low-rep domains.
#    safedeal.sh had DKIM (mail._domainkey) + DMARC (p=none) but NO SPF record.
#    FIX APPLIED: added apex TXT `v=spf1 include:spf.brevo.com ~all` to the safedeal.sh DO DNS zone
#    (record id 1832809556; Brevo sending IPs 77.32.148.22/185.41.28.5 are within spf.brevo.com).
#    safedeal.sh now has SPF+DKIM+DMARC. Remaining: new-domain reputation warm-up; recipients should
#    check Junk. NOTE: SafeDeal sign-in send is fire-and-forget (void sendSafeDealCodeEmail) so a
#    Brevo rejection would be swallowed (API still returns "We emailed you a sign-in code") — not the
#    cause here (Brevo delivered), but a future hardening candidate.
#    ⚠️ The DigitalOcean API token was pasted in chat — OWNER MUST ROTATE IT.
#
# 2) FEE COPY — mutually-agreed cancellation WAIVES the escrow fee. Updated 6 copy spots so the UI
#    no longer says the fee is "charged on every outcome": Components/SafeDeal/{Landing.tsx (fee
#    bullet + "Cancel after funding — both agree" card), LandingSections.tsx (cost FAQ),
#    legalContent.ts (Terms §3), NewDealReview.tsx (quote footnote), DealPage.tsx (Money-panel note,
#    now tense-aware: pending-cancellation vs settled vs normal)}. Backend already emitted
#    "Escrow fee (waived)" costItem; no backend change. Verified by auto_frontend_testing_agent
#    (landing + terms live w/ screenshots; currency selector testid + deal-page note by source).
#    Also added data-testid="sd-new-currency-select" to the /safedeal/deals/new currency combobox.
# ============================================================================


# SafeDeal build notes (agent memory)

## Decisions (approved by user)
- SafeDeal frontend lives INSIDE the Next.js app under `pages/safedeal/*` (layout "none", own shell). Preview: `<preview>/safedeal`. Prod: middleware maps host `safedeal.sh` → `/safedeal/*`.
- Auth: Dynopay issues SafeDeal sessions (email OTP → JWT `kind:'safedeal'`, header `x-safedeal-token`). Brand = `SAFEDEAL_COMPANY_ID=262` ("SafeDeal" company under user 1).
- Wallet accounting: `tbl_customer_wallet.amount`=Available, `held_amount`=Held. Statement rows in `tbl_customer_transaction` with `meta` JSON (kind/bucket/escrow_id). Types CREDIT/DEBIT/HOLD/UNHOLD.
  Funding → CREDIT(held). Settlement (buyer): UNHOLD X, DEBIT paid_to_seller, DEBIT escrow_fee, DEBIT escrow_costs; seller: CREDIT release_received.
- Live funding: `services/safedeal/safedealCheckout.ts` creates a payment link (link_type 'escrow') + chainVerification fan-out `onPaymentLinkPaid` → `actFundFromCheckout`. NOT testable in preview.
- Withdrawals: min $10, > $1000 → pending_approval (admin approve/reject). Simulated send unless ESCROW_LIVE_SETTLEMENT=true (then Binance submitWithdrawal).

## Backend (done, smoke-tested via scripts/safedeal_smoke.sh)
- Migration 0038_safedeal (bootMigrations.ts). Engine export `escrowEngine` from escrowController.ts.
- Routes `/api/safedeal/*` (routes/safedealRouter.ts); CSRF exemptions added for safedeal user routes.
- Backend is ts-node WITHOUT watch → `sudo supervisorctl restart backend` after backend edits (~25s).

## Frontend
- Reuse: DisputePanel, EscrowProgress, StatusChip, escrowUtils from Components/Page/Escrow.
- SafeDeal components in Components/SafeDeal/*, API client api/safedeal.ts.

## Pending after frontend
- DONE (iteration_202/203): Customers page brand 262 totals + statement; admin withdrawals queue; merchant escrow UI removed.

## 2026-06 DIRECT-API FUNDING (iteration_207) — DONE & VERIFIED (BE 100% / FE 100%, retest_needed=false)
- Funding switched HOSTED checkout → DIRECT API. services/safedeal/safedealCheckout.ts uses cryptoPayment Direct API +
  SafeDeal brand key (dpk_live_UA63…) → temp addresses on the SafeDeal brand mempool. Dynopay NETWORK fee = 0% for SafeDeal;
  5% escrow fee kept as USDT profit; non-stable inbound auto-converts on Binance.
- Endpoints: POST /api/safedeal/deals/:token/funding (create); GET /api/safedeal/deals/:token/funding (IDEMPOTENT — FundPanel
  rehydrates the reserved address on reload). Webhooks: HMAC-v2 (openssl timestamped), meta_data raw-object OR JSON-string,
  idempotent (repeat events never flip status back), bad-sig → 401.
- UI: Components/SafeDeal/{FundPanel,PayoutDestinationCard,StepUpDialog,DealPage}.tsx. FundPanel = 13-coin picker with
  stablecoin ordering (USDT-TRC20→USDT-POLYGON→USDC-ERC20→USDT-ERC20→BTC→ETH…), QR/amount/address/expiry/copy, mobile sticky.
- 24h new-address cooling-off (manual withdrawal on a fresh address → 400 "usable in 24h", INTENTIONAL).
- Admin readiness expanded 8→12 checks: {brand,api_key,webhook,url,live,wallets,custody,pool,fee_exempt,autoconvert,fees,email}.
- Legacy action=checkout REMOVED.
- Tests: backend/tests/test_safedeal_iter207_funding.py (9/9) + scripts/safedeal_api_funding_smoke.sh.

## PENDING (next agent)
- NON-BLOCKING: refresh 6 stale legacy pytest expectations (test_safedeal_api.py::test_add_address_and_withdraw +
  test_safedeal_iter203.py withdraw tests + test_admin_readiness) to the new 24h cooling-off + 12-key readiness contract.
- OPTIONAL: data-testid on the /safedeal/deals/new Currency selector (currently role='combobox' only).
- P1: Admin dispute queue filters (In negotiation / Escalated / All). PROD go-live ops on brand 262 (custody wallets +
  auto-convert→USDT + ESCROW_LIVE_SETTLEMENT=true + SAFEDEAL_URL). Purge 65 legacy test deals from tbl_escrow_deal.
- P2: "Escrow protection" toggle on Dynopay payment links; KYC gating for large volumes.

## Production readiness (added this session, verified iteration_203 + self-test)
- Admin → Escrow → "SafeDeal setup" tab = GET /api/safedeal/admin/readiness (8 checks: brand,url,live,wallets,custody,autoconvert,fees,email).
- PROD BLOCKERS surfaced by the check (ops, not code): brand 262 has NO crypto wallets → hosted checkout ("Pay with crypto") cannot create a payment link. Brand wallets MUST be Dynopay custody addresses (= admin wallet per coin, env BTC/ETH/USDT_TRC20…) so buyer funds forward to Dynopay, never a third party; enable auto-convert → USDT on the brand so BTC/ETH funding lands in stablecoin custody. Set ESCROW_LIVE_SETTLEMENT=true + SAFEDEAL_URL=https://safedeal.sh in prod.
- CORS: server.ts now trusts the SAFEDEAL_URL apex (safedeal.sh frontend calls the Dynopay API cross-origin).
- Host rewrite: middleware.ts maps safedeal.sh/* → /safedeal/* (verified with curl -H 'Host: safedeal.sh'); DNS for safedeal.sh must point at the same Next deployment.
- Live funding path: createFundingLink (link_type 'escrow', fee_payer company, redirect → SAFEDEAL_URL/deal/<token>?funded=1) → chainVerification post-commit fan-out onPaymentLinkPaid → actFundFromCheckout (idempotent, status guard). Not testable in preview.
- Emails: baseEmailTemplate has brand:'safedeal' (text wordmark, "The SafeDeal team", SafeDeal "why" footer, no socials). escrowEmails.ts is brand-aware via deal.source; safedealEmails.ts (code / address / withdrawal sent|review|rejected). Render all: `EMAIL_DUMP_DIR=/tmp/x node_modules/.bin/ts-node --transpile-only scripts/render_safedeal_emails.ts` (16 files).
- Bug fixed: escrowController.dealUrl recursed infinitely for non-SafeDeal deals (legacy admin list / emails) → now inviteUrl().
- API: GET /wallet exposes balances top-level AND under data.wallet; POST /wallet/withdraw → 201. Admin approve/reject now email the customer.

## safedeal.sh go-live (DNS/hosting) — configured 2026-06 (this fork)
- Prod host = droplet `dynopay-prod-ams3` 134.209.94.115 (Caddy → nginx:8001 → Next+Express in one container). No SSH key on this pod.
- DO DNS zone `safedeal.sh` CREATED via API: A @ → 134.209.94.115 (ttl 60), CNAME www → @. NS = ns1/2/3.digitalocean.com.
- Registrar is Namecheap (current NS dns1/dns2.registrar-servers.com, parked A 192.64.119.252) → OWNER must switch nameservers to DO.
- `.github/workflows/deploy-droplet.yml` SSH step now idempotently: appends SAFEDEAL_COMPANY_ID=262 + SAFEDEAL_URL=https://safedeal.sh to /opt/dynopay/.env,
  appends Caddy blocks (www → 301 apex; apex → reverse_proxy 127.0.0.1:8001), `caddy validate` + `systemctl reload caddy`; plus a non-blocking
  post-deploy check that https://safedeal.sh serves `sd-landing`. Triggered by "Save to GitHub" (push to `Improvement`).
- DO API token pasted in chat on 2026-06 → owner should ROTATE it.

## 2026-06 safedeal.sh showed the Dynopay home (after nginx fix) — ROOT CAUSE
- Dockerfile frontend-builder stage COPYs an explicit allow-list of dirs; root `middleware.ts` was never copied → prod `next build` had NO
  middleware → no Host rewrite (and the dev-page guard was also absent in prod). Fixed: `COPY middleware.ts ./` in Dockerfile.
- Verify after deploy: `curl -s https://safedeal.sh/ | grep -c sd-landing` (>0) and `curl -sI https://safedeal.sh/deals` → 200.

## 2026-06 iteration_208 — wallet top-ups / exchange fee / auto-withdraw / invoices (all verified)
- Exchange fee 2% (env ESCROW_EXCHANGE_FEE_PCT) on non-stable funding, own cost line `exchange_fee`, separate from 0.1% conversion cost. Ledger DEBIT kind `exchange_fee` at settlement.
- Auto-withdraw OFF ⇒ settlement `{mode:'kept'}` (Available balance, no parking). ON ⇒ pays to auto_withdraw_address_id (cooling ⇒ parked, hourly release). Deal-level payout address still always pays out. Toggling OFF clears parked_payout_usd.
- Top-ups: tbl_safedeal_topup (migration 0042), service safedealTopup.ts, routes /api/safedeal/wallet/topup*, webhook meta.topup_id branch, CREDIT kind `topup` payment_mode `TOPUP`. Preview: POST /wallet/topup/:id/simulate.
- Invoices: GET /api/safedeal/invoices + summary.pdf becomes "Invoice SD-<id>" for closed deals (viewer-addressed, final costs, payouts).
- Tests: backend/tests/test_safedeal_iter208_wallet.py (25/25), scripts/safedeal_wallet_smoke.sh. Min deal is $30 (5% fee, $10 floor) — use amount>=30 in tests.

## 2026-06 math audit follow-up — regression suites green (this fork)
- Pre-funding quote assumes a STABLECOIN (exchange fee 0) by design; `nonStableSurchargeUsd` is the hint. Tests must NOT expect 2.00 exchange fee on fee-preview without a funding coin.
- 24h address cooling-off is OFF (SAFEDEAL_ADDRESS_COOLING_HOURS default 0, commit 4cf6b0cbf). Auto-withdraw ON ⇒ release pays the address at once (simulated when live settlement is off). Tests branch on GET /api/safedeal/config `address_cooling_hours`.
- Admin readiness api_key detail shows the CURRENT key prefix (`dpk_live_oA0S…` here) — never hard-code the suffix.
- Withdraw quote now returns `below_min`.
