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
- Dynopay dashboard: Customers → available/held + statement (GET /api/safedeal/brand/:companyId/customers/:customerId/statement), brand totals, admin withdrawals queue (Admin → Escrow).
- Remove merchant escrow UI (nav item `escrow` in navSections.ts, pages/escrow/*).
