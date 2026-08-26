# REFACTOR STATUS

_Last updated: 2026-06_

## Context
The husky `pre-commit` hook (`backend/scripts/check-file-size.mjs`, R2 budget from
`memory/ENGINEERING_STRATEGY_REVIEW_2026-08.md`) blocks any commit / Save-to-GitHub when a
**NEW** backend `.ts` file exceeds **500 lines**. Legacy files listed in
`backend/scripts/file-size-baseline.json` are grandfathered and only WARN when they grow.

## DONE — Save-to-GitHub blocker fix (2026-06)
- **Problem:** `backend/controller/customerDirectoryController.ts` = 583 lines → hook exit 1 → GitHub save blocked.
- **Fix (strangler pattern — split, do NOT grandfather):**
  - Extracted the data layer into `backend/controller/customerDirectoryService.ts` (398 lines):
    types, constants, helpers, `resolveCompanyScope`, `TX_QUERY`, `buildDirectory` (all exported).
  - Controller reduced to the two route handlers + imports (204 lines).
- **Behavior:** identical — pure code move, no route/logic/API-shape change; `apiRouter.ts` default import unchanged.
- **Verified:** `tsc --noEmit` clean · full `.husky/pre-commit` green (preflight-tsc OK, file-size OK, secrets OK) →
  EXIT 0 · both endpoints work read-only on live prod DB (`hostbay@moxx.co`):
  `GET /api/userApi/customers/directory` (total 9, aggregates present),
  `GET /api/userApi/customers/directory/detail?key=anon:api` (payments_total 533).

## NEXT ACTION ITEMS (from finish handoff — not started)
Priority order; each is independently shippable.

- [ ] **P0 — Frontend Verification (Customers page):** Run the frontend testing agent on the
      re-imagined Customers page to confirm all UI states, the detail drawer (bottom sheet on mobile),
      search + sort + CSV export, segment chips, and the "Request payment" → `/create-pay-link?email=<x>`
      prefill. Verify at 390 / 768 / 1024 / 1920 in dark + light. (Was awaiting user approval.)
- [ ] **P1 — Status Page Polish:** Add 90-day uptime history bars to the public status page so
      customers see per-service reliability at a glance.
- [ ] **P2 — Checkout Currency Memory:** Let returning buyers see prices in the currency they picked
      last time without re-selecting it.
- [ ] **Spark — Referral Earnings Card:** Show merchants their pending 50% referral rewards right on
      the dashboard.

## Watchlist — legacy files that grew past baseline (WARN-only, non-blocking)
These do NOT block commits, but each is a candidate to refactor down and remove from
`file-size-baseline.json` (never let them regress once reduced). Extract a module instead of extending:
- `controller/dashboardController.ts` — 1441 (baseline 1334)  ← largest drift
- `services/webhookProcessor.ts` / `webhooks/index.ts` — grew (~736 vs 717)
- `controller/product/productController.ts` — 873 (baseline 784)
- `controller/product/cartController.ts` — 890 (baseline 832)
- `controller/payment/settlement/settleTransaction.ts` — 1110 (baseline 1082)
- plus small +1..+7 drifts across apis/tatumApi.ts, adminController, apiController, companyController,
  invoiceController, kycController, cryptoCheckout, feeController, chainVerification, paymentController,
  publishableKeyController, referralController.
- Rule: only files NOT in the baseline block; the above are all grandfathered.

## How to re-check locally
```
cd /app/backend && node scripts/check-file-size.mjs        # exits 1 on a NEW >500-line file
cd /app && git add -A && sh .husky/pre-commit              # full hook (tsc + size + secrets + contrast)
```
