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

## Production readiness (added this session, verified iteration_203 + self-test)
- Admin → Escrow → "SafeDeal setup" tab = GET /api/safedeal/admin/readiness (8 checks: brand,url,live,wallets,custody,autoconvert,fees,email).
- PROD BLOCKERS surfaced by the check (ops, not code): brand 262 has NO crypto wallets → hosted checkout ("Pay with crypto") cannot create a payment link. Brand wallets MUST be Dynopay custody addresses (= admin wallet per coin, env BTC/ETH/USDT_TRC20…) so buyer funds forward to Dynopay, never a third party; enable auto-convert → USDT on the brand so BTC/ETH funding lands in stablecoin custody. Set ESCROW_LIVE_SETTLEMENT=true + SAFEDEAL_URL=https://safedeal.sh in prod.
- CORS: server.ts now trusts the SAFEDEAL_URL apex (safedeal.sh frontend calls the Dynopay API cross-origin).
- Host rewrite: middleware.ts maps safedeal.sh/* → /safedeal/* (verified with curl -H 'Host: safedeal.sh'); DNS for safedeal.sh must point at the same Next deployment.
- Live funding path: createFundingLink (link_type 'escrow', fee_payer company, redirect → SAFEDEAL_URL/deal/<token>?funded=1) → chainVerification post-commit fan-out onPaymentLinkPaid → actFundFromCheckout (idempotent, status guard). Not testable in preview.
- Emails: baseEmailTemplate has brand:'safedeal' (text wordmark, "The SafeDeal team", SafeDeal "why" footer, no socials). escrowEmails.ts is brand-aware via deal.source; safedealEmails.ts (code / address / withdrawal sent|review|rejected). Render all: `EMAIL_DUMP_DIR=/tmp/x node_modules/.bin/ts-node --transpile-only scripts/render_safedeal_emails.ts` (16 files).
- Bug fixed: escrowController.dealUrl recursed infinitely for non-SafeDeal deals (legacy admin list / emails) → now inviteUrl().
- API: GET /wallet exposes balances top-level AND under data.wallet; POST /wallet/withdraw → 201. Admin approve/reject now email the customer.
