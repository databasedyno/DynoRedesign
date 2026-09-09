# DynoPay — Next Actions & Backlog

_Last updated: 2026-08-14. Context: this session shipped (1) the USDC-icon bug fix ("duplicate USDT ERC20" on /wallet), (2) the buyer **Download receipt** button on the checkout paid card (`POST /api/pay/receipt`), and (3) **IA Batch B** — `/developer-keys` → **Developers** with tabs *Keys · Webhooks · Events log · Docs*, and Settings regrouped into **Account · Business · Payments** with the *Account details* rename + legacy redirects. Backend 6/6 and frontend all-pass by the testing agents. Full history: `memory/CHANGELOG.md`. Audit source of truth: `docs/IA_TAB_ARCHITECTURE_AUDIT.md` (STATUS table updated)._

⚠️ **Standing safety rule for every item below:** this preview runs against the merchant's **LIVE** Railway Postgres/Redis. STRICT READ-ONLY on real rows; SAFE MODE (`ENABLE_BACKGROUND_JOBS=false`, `WORKER_ROLE=secondary`) must never be flipped in the preview.

---

## 0 · Payment-architecture items (source of truth: `memory/CRYPTO_ARCHITECTURE_IMPLEMENTATION.md`, 2026-08-21)

These outrank the product items below — they are money-path correctness, not polish.

- **P0 — Missing webhook events** ✅ **SHIPPED 2026-08-21**: `payment.created`, `payment.expired`, `payment.overpaid` live, opt-in per merchant (Developers → Webhooks checkboxes / `webhook_events`). `refund.*` still blocked on the deferred refund flow (#1).
- **P0 — Ledger rollout** ✅ **COMPLETE 2026-08-21**: all 3 flags now ON in the prod DO `dynopay` app (`ENABLE_LEDGER`/`LEDGER_DUAL_WRITE`/`LEDGER_INVARIANT_CRON`=true, deploy `713cc109` ACTIVE). Runtime log confirms dualWrite+invariantCron on; first invariant sweep OK (1612 rows / 407 batches, zero drift).
- **P1 — Secret rotation + Binance key scoping** (Tier 3): live keys have been pasted into chat across 10+ pods. Rotation is genuinely overdue.
- **P1 — Chain reorg handling** (Tier 2, not started): no reorg/rollback path on confirmed deposits.
- **P2 — Signing isolation + withdrawal controls** (Tier 3, not started).
- **Blocked on you — KYC/AML activation** (Tier 2): ✅ **ACTIVATED IN PREVIEW 2026-08-21** with real Veriff
  creds — session-create verified (live 201), webhook hardened+verified (raw-body HMAC + x-auth-client,
  CSRF-exempt, idempotent, 4/4), `/kyc/complete` redirect page added, hostbay exempt
  (`KYC_EXEMPT_COMPANY_IDS=1`). PROD PENDING: Save-to-GitHub → flip DO env → set Veriff Station webhook URL.
  AML address-screening (Chainalysis/TRM) still deferred.
- **Deferred by you — Refund execution flow** (Tier 1, 2026-08-21).

---

## 1 · Next actions (prioritized)

### P1 — IA Batch C: product sales inline _(audit F1 / N2 — the last big IA batch)_
Show product sales inline on the Payment-links / Transactions surfaces and **retire the third order surface**, so a sale is one object seen in one place instead of link + order + transaction fragments.
- Files to start from: `Components/Page/Payment-link/PaymentLinksTable.tsx`, `Components/Page/Transactions/*`, order surfaces under `pages/order/` + `Components/Page/Storefront/ProductsTab`.
- Definition of done mirrors Batch A/B: `tsc --noEmit` clean · testing agent green · no route left homeless (law 6) · `memory/CHANGELOG.md` + audit STATUS updated.

### P1 — Expired-link rescue _(audit §7 I1 — highest-value revenue idea, effort S)_
The expired-unpaid links are the only genuine receivable signal in the product. Add one-tap **Extend** / **Resend** on an expired link (fields `expires_at`, reminder infra and Brevo email already exist — no new object needed). Founder already ruled real invoicing out of scope (audit §8 Q2); this delivers most of its value without inventing a new object.

### P1 — Shareable receipt page _(audit §7 I7, second half)_
The paid card now downloads a PDF receipt; the remaining half is a **shareable receipt URL** (`/receipt/<publicRef>` style) so a buyer can prove payment without keeping a file. Reuse the same data resolution as `downloadReceipt` in `backend/controller/payment/cryptoSettlement.ts`; add OG tags for link previews. Reduces "did it go through?" support.

### P2 — Storefront share nudge _(audit §7 I2, effort S)_
One-time prompt on Storefront → Share after the first product goes live ("your page has something to sell — post it"), reusing the pre-built social targets. Publishing is the moment of highest intent.

### P2 — Offline QR pack _(audit §7 I4, effort S)_
Print-ready PNG/PDF export of the page QR (stall, flyer, video overlay) from Storefront → Share. The QR exists; only the export is missing.

### P2 — Plain-English dashboard KPI read _(audit §7 I3, effort S)_
"Busier than yesterday: 3 more payments, smaller baskets" next to the KPI delta. Complements the low-base delta rule already shipped.

### P2 — Payment health widget _(spark from 2026-08 sessions)_
Small live status strip on the dashboard (rates fresh? chains available?) so merchants instantly see gateway health. Backend already exposes `/api/status` + tickers.

### P3 — "Sell this again" _(audit §7 I5, effort M)_
One tap on a settled transaction regenerates the same link/product. Reuses link duplication.

### P3 — Storefront SEO / OG polish _(audit §7 I6, effort M)_
Per-product OG images, structured data. (Sitemap entries for live `{handle}` creator pages DONE 2026-09-03.)

---

## 2 · IA audit — remaining items (docs/IA_TAB_ARCHITECTURE_AUDIT.md)

| Item | State |
|---|---|
| Batches A + B (N1/F13 · N3/F3 · F4 · F6 · F7 · F8 · F9 · **N4/F5** · **F11** · F14) | ✅ shipped & verified |
| **F1 / N2** product sales inline + retire 3rd order surface | ⏳ Batch C (P1 above) |
| **F2** storefront analytics → one deep-link strip | ⏳ Batch C |
| **F10** Payout wallets: rename ✅ shipped in Batch A; remaining nuance = "never place remove next to add" consequence-test pass | ⏳ small |
| **F12** dashboard dock — RULE to hold (dock may only contain nav destinations), not a build | 📏 enforce in reviews |
| Naming sprawl (audit §8 Q1): dashboard tile says *Your page*, legacy route says *creator* — one name should win everywhere | ⏳ small sweep |
| Sidebar footer space hog (~240px: referral card + Help & Support) — audit flagged before adding any new nav row | ⏳ consider with Batch C |

---

## 3 · Verification / QA backlog (read-only, cheap)

- **Multi-coin checkout proof**: exercise the coin picker with ETH / USDT-TRC20 / LTC on a test link (existing live test link is BTC-only). Confirm coin brand colors + indigo selection highlight.
- **Paid-state UI without paying**: recipe now documented — intercept `**/pay/verifyCryptoPayment` with `{status:true,data:{status:"confirmed",paidAmount:0.005,paidAmountUsd:10,baseCurrency:"USD",remaining_seconds:0}}`; receipt-button 200 path via the fake-Redis-hash recipe in `memory/test_credentials.md`.
- **Storefront public look**: publish a demo product on a **throwaway** handle to verify Shop/ProductCard/sold-chip styling live (hostbay's shop page is unpublished → branded "Page Unavailable").
- **Settings `?section=api-keys` redirect timing**: frontend agent noted a minor timing wobble on this one redirect (the webhooks variant verified clean). Re-check once; likely just test timing.

---

## 4 · Ops / environment backlog

- **Product asset storage**: GCS/Spaces creds not provided → uploads land on pod-local disk and die with the pod. Ask user for storage creds and wire `backend` asset service to them.
- **Binance direct prices**: geo-blocked (HTTP 451) and the SOCKS tunnel needs `sshpass` (not installed). Rates flow via Tatum/CoinGecko fallback — fine for preview; revisit only if the user wants Binance-sourced rates in preview.
- **OAuth in preview**: Google/GitHub buttons render but consoles only whitelist dynopay.com origins; email/password login is the preview path. (NextAuth's own /api/auth/* is also shadowed by the ingress.)
- ~~**Pod rebuilds**~~ ✅ **SOLVED 2026-08-21** — one command: `bash scripts/pod-bootstrap.sh --pass '<vault passphrase>'`. Deps self-heal, env restores from the git-tracked `env.vault.enc`, URLs/SAFE MODE auto-set. Recipe: `memory/POD_SETUP.md`.

---

## 5 · Intentional leftovers (NOT bugs — do not "re-fix")

- **Landing/marketing** (`Components/Page/Home/v3/*`, `swiss.ts`, `homeTheme.ts`) keep cyber-lime on purpose.
- **Creator theme picker "Lime" swatch** (`constants/creatorTheme.ts`) — user-selectable page color.
- **`developers` vertical volt-lime accents** (`useVerticalAccent`) — deliberately untouched (P2 decision pending: unify to indigo or keep).
- **Auth surfaces** (register confetti, ForgotPasswordDialog) — own design system.
- **Admin panel headers** (`AdminHeader/*`) + `UI/DatePicker/styled.tsx` — light-only by design, excluded from the dark-mode brandFg rollout.
- **`Bill` absent from `+ New`** — founder decision (audit §8 Q2): the product is "share a link, get paid now".

---

## 6 · Done recently (context — do not redo)

- 2026-08-13/14: USDC icon fix (5 mappings + new `USDC-icon.svg`) · `POST /api/pay/receipt` + paid-card Download receipt · IA Batch B (Developers tabs, Settings groups, Account-details rename, redirects, 6 locales).
- 2026-08-13: IA Batch A (persona nav + reveal-on-relevance, one `+ New`, Receipts & Tax rename, bell/referrals out of nav) · env restored on 4th pod.
- 2026-08-12: dark-mode brandFg rollout Batches 1–5 · ETH icon fix · brand tokens file · payout/digest email refresh · `/about` page.

---

## 7 · Reference

- Test login: `hostbay@moxx.co` / `Katiekendra123@` (2-step; testids in `memory/test_credentials.md`).
- Current preview: `https://kendra-vault.preview.emergentagent.com` (pod-specific — re-verify after any rebuild).
- $10 BTC test link (Invoice INV-2026-172): `/pay?d=dd7cf1523088ee313c0e57118e11661ebf3436469930dbab` (also on `https://checkout.dynopay.com`).
- Key docs: `docs/IA_TAB_ARCHITECTURE_AUDIT.md` (IA plan + laws) · `memory/CHANGELOG.md` (shipped) · `memory/test_credentials.md` (env recipe, testids, receipt-test recipe) · `/app/test_result.md` (testing protocol + history).
