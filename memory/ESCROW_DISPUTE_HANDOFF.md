# ESCROW DISPUTE — HANDOFF FOR NEXT AGENT (2026-09)

> Purpose: finish the ONE remaining item — a green **escrow frontend E2E** — and (optionally) pick up
> the backlog below. Backend is fully implemented & tested; frontend is built + `tsc`/eslint clean.
> Read this top-to-bottom before touching anything; it is self-contained.

---

## 0) FIRST: make sure the app is up

- This is an Emergent preview pod: React/Next.js frontend at repo ROOT (`/app`, served via a
  `/app/frontend` bridge → `scripts/start-frontend.sh`), Node/TS backend at `/app/backend`
  (Python `server.py` proxy on :8001 launches the real Node backend), Postgres + Redis + Tatum.
- **SAFE MODE, wired to the LIVE production DB, money is SIMULATED.** Prefer read-only; only ever
  create throwaway escrow deals with counterparty emails prefixed `escrow_e2e_` / `escrow_test_`
  on brand/`company_id=1` ("The Dev Store"). Do NOT mutate other merchants' data.
- If services are down / env missing (fresh pod), restore from the vault and restart everything:
  ```
  bash /app/scripts/pod-bootstrap.sh --pass 'Katiekendra123@'
  ```
- Health check: `curl -s localhost:8001/health` → expect `status:healthy, db/redis connected,
  tatum operational, background_jobs eligible=false` (SAFE MODE). Frontend: `curl -I localhost:3000`.
- **Preview URL** (source of truth = `APP_URL` in `/etc/supervisor/conf.d/*.conf`):
  `https://ux-handoff-app.preview.emergentagent.com`

### Known preview gotcha (already mitigated)
Next **dev** server recycles under memory pressure → a ~5s edge **502** occasionally. We raised the
dev heap to 8 GB in `scripts/start-frontend.sh` (`--max-old-space-size=8192`), which makes this rare.
If a request 502s: it's a transient recycle — **wait ~15s and retry**, do NOT treat it as a code bug.
Before running E2E, warm the routes: `for r in / /auth/login /escrow /escrow/1 /admin/escrow
"/escrow/invite/testtoken"; do curl -s -o /dev/null -w "$r %{http_code}\n" --max-time 120
localhost:3000$r; done`.

---

## 1) WHAT WAS DONE THIS SESSION (context)

Reimagined the escrow dispute into a **two-tier P2P flow** (Bybit/Binance-style): parties settle
themselves first; an admin is only the fallback. Plus fee-model + create-dialog UX fixes.

**Backend (DONE + tested):**
- Raise dispute **requires a proposal** (`release | refund | split`+`split_percent_seller`) + optional
  `message`/`reason`. Full negotiation loop: **counter** (turn flips), **message** (evidence thread),
  **accept** (auto-resolves via the two-phase engine, NO admin), **escalate** (manual + 72h auto).
  You cannot accept/counter your OWN live proposal.
- Fee model (owner decisions): **fees ALWAYS charged on every outcome** — settlement distributes the
  NET POOL `P = breakdown.sellerReceives` (= buyerPays − totalCost); platform always keeps totalCost.
  refund now returns `P` (fee NOT waived). Custody **always USDT** (`CUSTODY_STABLECOIN`); inbound
  conversion skipped when funded in USDT; **USDC payout merges USDT→USDC conversion into the single
  withdrawal_fee line** (costItems stays length 4).
- Escrow fee is **admin-only via .env**: `ESCROW_FEE_PERCENT=5`, `ESCROW_FEE_MIN_USD=1` (client values
  ignored in createDeal + fee-preview). `auto_release_days` clamps to `{3,5,7,14}` default 3.
  Auto-escalate window: `ESCROW_DISPUTE_AUTO_ESCALATE_HOURS` (default 72).
- Migration **0037_escrow_dispute_negotiation** added: `dispute_stage`, `dispute_proposal`(JSONB),
  `dispute_proposal_by`, `dispute_escalated_at`, `dispute_auto_escalate_at`, `dispute_thread`(JSONB).
- Backend test results: dispute suite **29/31** (2 "fails" were a different-network fee comparison,
  not bugs); fee/auto-release **7/7**.

**Frontend (BUILT, `tsc` 0 errors, eslint clean, all escrow routes 200 — E2E NOT yet run green):**
- NEW `Components/Page/Escrow/DisputePanel.tsx` — shared; takes an injected API adapter so the SAME UI
  drives merchant (Bearer) and public (OTP) flows.
- Wired into `Components/Page/Escrow/EscrowDetail.tsx` (merchant), `.../Public/EscrowInvite.tsx`
  (OTP counterparty), and `Components/Page/Admin/Escrow/index.tsx` (stage chip + proposal + thread +
  "Run auto-escalations" button).
- `CreateEscrowDialog.tsx`: removed the editable fee % input → **read-only** line
  (`escrow-create-fee-info`, "Escrow fee: 5% …"); auto-release is now a **3/5/7/14-day dropdown**
  (`escrow-create-autorelease-select`); "who pays" (buyer/seller/split) stays a merchant choice.
- API client `api/escrow.ts`: `escrowApi.{dispute(body), counterDispute, acceptDispute,
  disputeMessage, escalateDispute}`, `escrowAdminApi.{disputes(stage?), runDisputeEscalations}`,
  public `action` union extended with `dispute-counter/-accept/-message/-escalate` + proposal fields.

Nothing committed yet → use **Save to GitHub** when satisfied.

---

## 2) THE REMAINING TASK — run the escrow FRONTEND E2E to green

Use the `auto_frontend_testing_agent`. It only got blocked previously by a transient 502; the flow
itself is untested in-browser. SAFE MODE, throwaway `escrow_e2e_*` emails, company 1.

### Login (2-step + mandatory 2FA on a fresh browser) — THE historical snag
- `/auth/login` → `login-email-input` = `onarrival21@gmail.com` → click button "Continue" (exact) →
  `password-input` = `Katiekendra123@` → `signin-submit-btn`.
- A 2FA dialog `login-2fa-dialog` appears. **Its 6 OTP boxes have NO data-testid** (the panel is
  rendered without a testIdPrefix). Get a live code (rotates every 30s, generate right before typing):
  `node /app/backend/scripts/print_totp.cjs 1`
  Then fill the six `input`s inside `[data-testid="login-2fa-dialog"]` (inputmode="numeric"), one digit
  each in order — the panel **auto-submits** on the 6th digit (no verify button). Retry with a fresh
  code up to 3x if it errors. Once in, the browser is trusted (no more 2FA that session).

### Public invite OTP is EASY (shown in-UI)
On the invite page, `escrow-invite-send-otp` reveals the code at `escrow-invite-preview-otp` and
**auto-fills** it; just click `escrow-invite-verify-otp`. (Outbound email is off in preview.)

### Flows to verify (full detail — the agent can follow this)
- **A. Create dialog UX**: from `/escrow` → `escrow-new-btn`; assert NO `escrow-create-feepercent-input`
  exists, `escrow-create-fee-info` shows "Escrow fee: 5%"; `escrow-create-autorelease-select` has
  3/5/7/14; `escrow-create-payout-coin` changing between a USDT and a USDC option changes the quote's
  withdrawal line; quote lists 4 cost items; submit `escrow-create-submit` → `escrow-created-qr` +
  `escrow-created-invite-url` (capture it) → `escrow-created-done`.
- **B. Full negotiation across BOTH parties** (merchant=seller, counterparty=buyer):
  buyer opens invite URL (separate/incognito context) → verify OTP → `escrow-invite-accept` → fund
  (`escrow-invite-fund-open`/`escrow-invite-fund-coin`/confirm; status→funded) → **open dispute**
  `escrow-dispute-open-btn` → dialog `escrow-dispute-proposal-dialog` → `escrow-dispute-outcome-split`
  → move `escrow-dispute-split-slider` → message → `escrow-dispute-submit`. Then merchant (`/escrow/<id>`,
  row `escrow-row-<id>`) sees the proposal, clicks **Counter** `escrow-dispute-counter-btn` (turn flips;
  `escrow-dispute-waiting` shows), posts a thread message (`escrow-dispute-thread-msg-input` +
  `escrow-dispute-thread-send`). Buyer reloads → **Accept** `escrow-dispute-accept-btn` → deal
  AUTO-RESOLVES (status completed/refunded/split), panel shows resolved. This is the key proof.
- **C. Escalate**: second throwaway deal, fund, buyer raises `refund` dispute, seller clicks
  `escrow-dispute-escalate-btn` → `escrow-dispute-stage` = "With admin"; accept/counter now closed.
- **D. Admin (best-effort)**: `/admin/login` with `moxxcompany@gmail.com` / `Katiekendra123@`. NOTE: admin
  may require its own 2FA — if you can't get its TOTP, SKIP D (endpoints already API-tested). If in:
  `escrow-admin-list` rows show `escrow-admin-stage-<id>` + `escrow-admin-thread-<id>`; click
  `escrow-admin-run-escalations` (success toast); resolve dialog `escrow-admin-resolve-<id>` renders.

Key test-ids also: `escrow-dispute-panel`, `escrow-dispute-outcome-{release,refund,split}`,
`escrow-dispute-message-input`, `escrow-dispute-reason-input`, `escrow-dispute-thread`,
`escrow-invite-preview-otp`, `escrow-created-invite-url`.

If E2E surfaces a real bug: fix in the relevant file (below), re-lint/tsc, re-run. If it's a 502,
it's the dev-server recycle — retry, don't "fix".

---

## 3) FILES CHANGED THIS SESSION (where to look)

Backend:
- `backend/controller/escrowController.ts` — dispute actions (actRaiseDispute/Counter/Accept/Message/
  Escalate + wrappers + publicAction cases + adminRunDisputeEscalations + adminResolveDispute update),
  fee env constants (`ESCROW_FEE_PERCENT/MIN`, `clampAutoReleaseDays`, `CUSTODY_STABLECOIN` usage),
  serializeDeal dispute fields.
- `backend/controller/escrow/escrowShared.ts` — `computeSettlementAmounts` (net-pool, fees always),
  `computeFeeBreakdown` (USDT custody, inbound-skip, USDC merge), `deriveSettlement` dispute label,
  `CUSTODY_STABLECOIN`.
- `backend/models/escrowDealModel.ts` — dispute columns. `backend/migrations/bootMigrations.ts` — 0037.
- `backend/services/email/escrowEmails.ts` — proposal/escalated/agreed emails (no-ops in preview).
- `backend/routes/escrowRouter.ts` — new dispute + admin routes. `backend/.env` — `ESCROW_FEE_*`.

Frontend:
- `api/escrow.ts`; `Components/Page/Escrow/DisputePanel.tsx` (new); `.../EscrowDetail.tsx`;
  `.../Public/EscrowInvite.tsx`; `.../Admin/Escrow/index.tsx`; `.../CreateEscrowDialog.tsx`.
- `scripts/start-frontend.sh` — dev heap 8192.

Verify commands: `cd /app && node_modules/.bin/tsc --noEmit` (expect 0);
`cd /app/backend && npx tsc --noEmit -p tsconfig.json` boots via ts-node (health check is the real proof).

---

## 4) CREDENTIALS (see also memory/test_credentials.md)
- Merchant: `onarrival21@gmail.com` / `Katiekendra123@` (user_id=1, company_id=1). TOTP:
  `node /app/backend/scripts/print_totp.cjs 1`. API: POST /api/user/login → challenge_token →
  POST /api/user/2fa/validate {challenge_token, token} → accessToken.
- Admin: `moxxcompany@gmail.com` / `Katiekendra123@` at `/admin/login`.
- Read-only SQL: `node /app/backend/scripts/ro_query.js "select ..."`.

---

## 5) BACKLOG / NICE-TO-HAVE (only after E2E is green)
- Dispute chat **attachments** (screenshot/file evidence in the thread — currently text only).
- **Countdown** to the 72h auto-escalation shown to each party.
- Admin queue **filters** (In-negotiation vs Escalated tabs; `escrowAdminApi.disputes(stage)` already
  supports `?stage=`).
- Optional backend refinement: `authorizeOutcome` already uses the deal's payout/funding coin;
  `refreshEscrowCostRates()` is best-effort with static fallback (fine in SAFE MODE).

## 6) TESTING PROTOCOL REMINDERS
- Update `test_result.md` before invoking a testing agent; never edit its protocol sections.
- Backend changes → `deep_testing_backend_v2`. Frontend testing → ONLY with explicit user permission.
- After creating/altering any auth creds or seed users, update `memory/test_credentials.md`.
