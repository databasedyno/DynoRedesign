# DynoPay — End-to-End UX Audit (Session 108)

Product type: self-serve **crypto payment gateway** for two overlapping merchant types
(1) businesses accepting crypto, (2) creators/donation/storefront), plus a
**buyer-facing checkout**. Comparables to benchmark against: Stripe Dashboard/Checkout,
Coinbase Commerce, Wise, Gumroad, GoFundMe/Kickstarter (donation), Vercel (dev/API UX).

Grounded in current code (not aspirational): auth = password-first + OTP fallback + Google/GitHub
OAuth; register = passwordless OTP; onboarding = 4-step resumable checklist (company→wallet→link→payment);
checkout = 3-step stepper with resume; theme = per-context (in-app dark / public light).

---

## 0. Journey map (as built)
Discover (SEO/landing) → Register (OTP) → [auto] Onboarding checklist → Company → Wallet →
Create pay link → Share → Buyer checkout (/pay) → Payment confirm → Settlement/convert →
Dashboard/Transactions → Payouts/wallets → Grow (referrals, products, creator page, API).

---

## 1. What's already strong (keep)
- Passwordless OTP signup + password-first login with "use a code instead" — matches best-in-class, low friction.
- Non-blocking, **resumable** onboarding checklist derived from real account data (survives reload), with analytics + celebration. This is genuinely good.
- "Create first link" never hard-blocks — navigates and gates only the Save action → preserves momentum/aha.
- Per-context theming (tool = dark, brand = light) with pre-hydration no-flash script.
- Checkout stepper persists across language change; "already paid" guard; donation variant.
- Empty states with a single clear CTA on dashboard/recent-txns.

---

## 2. Findings by flow (severity: P0 blocker/frustration · P1 high-value · P2 polish)

### A. Discovery → Register
- **P1** No visible value-recap on the register card (what you get, "no setup fee", supported coins, "settles to your wallet"). OTP-only cards feel thin for a money product where trust must be earned before asking for contact info. Add a compact trust strip (coins, non-custodial messaging, "used by N merchants", security badge).
- **P1** Passwordless-only signup means returning users on a new device must always wait for an email/SMS OTP; no passkey/WebAuthn option. For a payments tool, add **passkeys** as an accelerator (also reduces OTP cost/deliverability risk).
- **P2** Referral code is behind a "have a code?" toggle (good), but no auto-capture from `?ref=` URL surfaced as a confirmed chip ("Referred by X — bonus applied").
- **P2** SEO-source prefill exists but the success step doesn't set an explicit expectation of the next 3 steps (company→wallet→link). Prime the onboarding before the dashboard loads.

### B. Authentication (returning / recovery)
- **P1** OTP deliverability is a single point of failure (email/SMS). No fallback messaging ("didn't get it? check spam / resend in Ns / try password"). Resend countdown exists; make the fallbacks explicit and add a support escape hatch.
- **P1** "Remember me" defaults true + JWT in localStorage. For a payments product, consider session inactivity timeout + "you'll stay signed in on this device" clarity, and step-up auth (re-verify) before sensitive actions (change payout wallet, withdraw, reveal API key).
- **P2** OAuth (Google/GitHub) only completes on the production domain (redirect URIs). On preview it silently won't work — acceptable, but the button gives no hint. (Env-specific, not a prod bug.)
- **P2** Login page is 1900 lines — many modes (password, email-OTP, SMS-OTP, forgot). Great flexibility but risk of decision paralysis; make the primary path obvious and progressively disclose the rest (mostly already done).

### C. Activation / Onboarding
- **P0-ish (activation risk)** The 4 steps are the right ones, but there's no **time-to-value estimate** or single "Accept your first payment in ~2 min" promise, and no sample/test-mode link to feel the flow without a real wallet. Add a **"Try a test payment"** (testnet/sandbox) so a merchant reaches the aha before configuring a payout wallet.
- **P1** Company step auto-opens as a **modal**. Modals for a required multi-field form on first run can feel heavy; consider an inline first-run panel or a two-field minimal company (name + country) with the rest deferred to Settings.
- **P1** Wallet step demands a real payout address up front — highest drop-off point for crypto products (users may not have an address handy). Offer: "I'll add this later" + a guided "how to get a wallet address" helper + validation with human-readable errors per chain.
- **P2** Checklist disappears once core is done; consider a persistent, collapsible "Grow" checklist (verify email, add product, claim handle, connect API, invite via referral) so activation → expansion is continuous.

### D. Core merchant surfaces
- **Dashboard**
  - **P1** Good hero + skeletons now, but 3 metric tiles + wallets + chart + right-rail (fee tier, creator card, grow) is dense. Establish a clearer visual hierarchy: one primary number (net volume / to be settled), then progressive detail. Coinbase leads with ONE number + timeframe.
  - **P2** "Transaction Volume" mock fallback data can render before real data — ensure it never shows plausible-looking fake numbers (trust risk on a money dashboard).
- **Pay Links (list)** 
  - **P1** This is the merchant's core object. Ensure per-row: status, amount, # payments, conversion, quick "copy link", "open checkout", QR, and share (email/WhatsApp/embed). Make "Create" a persistent primary action.
  - **P1** (Just fixed the theme leak here.) Verify sort/filter/search + empty state with a template gallery (invoice, donation, product, subscription-like).
- **Create Pay Link**
  - **P1** Live preview panel exists (good). Ensure the form uses smart defaults (merchant's display currency, last-used coins), inline validation, and a "test this link" affordance. Reduce the number of visible advanced options via progressive disclosure (tax, post-payment redirect, expiry are power-user).
- **Products / Storefront** (`/pay-links/products`, public `/[handle]/shop`)
  - **P1** Product detail glow-up is queued per STOREFRONT_UX_ROADMAP; buyer-facing shop is "visually thin". Prioritize product card imagery, trust, and a frictionless add→pay path.
- **Transactions**
  - **P1** Ensure powerful filtering (status, coin, date, amount, customer), CSV/accounting export, and a clear status taxonomy (pending/confirming/settled/converted/refunded) with tooltips — crypto states confuse first-timers. Skeleton verified in prior sessions.
  - **P2** Row → detail modal should show on-chain tx hash + explorer link + confirmations + fee breakdown (transparency = trust).
- **Wallets / Payouts**
  - **P1** Show per-chain balance, "available to settle", sweep/threshold status in plain language, and a clear "change payout address" flow with step-up auth + confirmation (irreversible-money guardrail).
- **Customers** — currently "soon" in nav. Either hide until ready or show a compelling empty state (don't ship a dead nav item as the 8th row; "soon" badges erode trust if long-lived).
- **Developer / API keys**
  - **P1** Dev UX matters (persona: Dana). Provide: create/rotate/revoke keys, scoped keys, test vs live, copy-once secret with reveal + step-up, webhook setup with test-send + delivery logs, and inline code samples (curl/JS) + link to `/documentation`. Ensure secrets never render in full after creation.
- **Referrals** — make the share asset one-tap (prefilled message, link, QR) and show earnings + payout status; tie into the "Grow" checklist.
- **Settings/Profile** — consolidate: business/company, payout wallets, display currency, notifications, security (password/2FA/passkeys/sessions), team (future). Today company name/contact logic is subtle; make "who gets emails / what name shows on receipts" explicit.
- **Fees** — the volume-tier model is a differentiator; visualize "you're $X from the next lower rate" (already a GrowPanel nudge) and show effective fee on each transaction.

### E. Buyer checkout (/pay) + receipt
- **P0 (conversion-critical)** Crypto checkout abandons on: (1) unclear coin/network choice, (2) exact-amount + address copy friction, (3) expiry anxiety, (4) "did it work?" uncertainty. Ensure: big QR + one-tap copy w/ confirmation, network shown explicitly (e.g., USDT-TRC20 vs ERC20 mistakes lose funds), a live **"waiting for payment → detected → confirming (n/m) → done"** status with reassuring microcopy, and a visible but calm expiry timer with "need more time?" re-quote.
- **P1** Wrong-network / underpayment / overpayment handling must be explicit and non-scary with recovery guidance (this is the #1 crypto support ticket).
- **P1** Post-payment: branded receipt, "return to merchant" CTA (redirect exists), optional email receipt, and for donations a thank-you + share.
- **P2** Mobile: wallet deep-links ("Open in Metamask/Trust/Coinbase Wallet") to remove manual copy on phones.

### F. Cross-cutting
- **P1 Navigation/IA**: sidebar mixes core (dashboard, pay links, transactions, wallets) with grow (creator, referrals, products) and admin (settings, API). Group into sections ("Overview / Get paid / Grow / Developer / Account") with labels; you already fixed the theme classification — align IA with those groups.
- **P1 Empty states**: standardize an illustrated, single-CTA empty state pattern across ALL pages (some have it, some likely don't).
- **P1 Error & money-safety microcopy**: consistent, human, recovery-oriented; extra confirmation on irreversible/money-moving actions.
- **P2 Perf**: just removed the full-screen spinner gate; next add per-route skeletons + hover prefetch on sidebar links so section switches feel instant.
- **P2 Trust/compliance**: surface AML/terms, non-custodial vs custodial clarity, and security posture where money decisions happen (checkout, payout change, API).
- **P2 i18n**: 6 languages supported — verify no hardcoded strings leak on the newest surfaces (products, API, referrals).
- **P2 Accessibility**: verify focus order, 44px targets (partly done), contrast in both themes, and reduced-motion for confetti/celebration.

---

## 3. Prioritized shortlist (impact ÷ effort)
1. **Buyer checkout confidence** (status timeline + network clarity + copy/QR + wrong-network recovery) — biggest revenue lever. [P0]
2. **Test/sample payment in onboarding** (reach aha before wallet config) — biggest activation lever. [P0/P1]
3. **Wallet step "add later" + guided helper** — cut the top activation drop-off. [P1]
4. **Pay Links list power features** (copy/QR/share/embed per row + template gallery empty state). [P1]
5. **Developer surface** (rotate/scope keys, webhook test + logs, code samples). [P1]
6. **Nav IA grouping + standardized empty states + money-safety confirms**. [P1]
7. **Passkeys + step-up auth on sensitive actions**. [P1]
8. **Dashboard hierarchy (one primary number) + kill mock chart data**. [P1/P2]
9. **Per-route skeletons + sidebar hover prefetch**. [P2]

---

## 4. Measurement to add (so UX changes are provable)
Funnel: register_start → otp_verified → company_done → wallet_done → link_created → link_shared →
checkout_view → payment_detected → payment_settled. Onboarding events already exist (trackOnboarding) —
extend to checkout + activation and watch drop-off per step, time-to-first-payment, and checkout
completion by coin/network/device.

---

## VERIFICATION UPDATE (Session 108 — code-checked against the running app)
IMPORTANT: the initial audit above was written from flow-level inference and OVERSTATED several gaps.
Code verification shows this app is much more mature than assumed. Already-implemented (do NOT rebuild):
- Sidebar IA: already grouped into sections (Main/Payments/Account) with dividers + labels (NewSidebar).
- Route prefetch: NewSidebar already `router.prefetch()`es all routes on mount.
- Perceived speed: NProgress route bar wired in _app.tsx + a `Components/Common/RouteTransitionLoader` skeleton on transitions. (Plus S107 removed the withAuth full-screen spinner gate.)
- Empty states: reusable `Components/UI/EmptyDataModel` already used by Wallet, Transactions, API, Pay-Links; plus EmptyStatePanel (dashboard) + ShopEmpty.
- Checkout confidence: /pay already has a per-second expiry countdown + an incomplete-payment grace timer w/ auto-unlock; `/order/[publicRef]` status page already models states incl. `underpaid`/`overpaid`; QR + copy exist in CryptoComponent.

GENUINE fix made this session:
- DashboardLeftSection TransactionVolumeChart no longer fabricates a ~$8k–$15k sample series when apiChartData is empty; it now zero-fills the date range (honest flat baseline). Trust fix. Lint+compile clean.

RE-SCOPING NOTE: Because so much already exists, "All" is far smaller than the audit implied. Recommended next step
is a precise GAP-VERIFICATION pass (live walkthrough) per area to implement ONLY real gaps — candidates that still
look genuinely missing/weak and worth checking live: wallet deep-links on mobile checkout; explicit network label
adjacency to the address; developer webhook test-send + delivery logs; step-up re-auth on payout-wallet change;
funnel analytics beyond onboarding. Verify each against the live app before building.

---

## BUILT (Session 108) — G1 wallet deep-links / tap-to-pay (frontend-only, prod-safe)
File: Components/Page/Pay3Components/CleanCheckoutV2.tsx
- Added exported pure helper `buildPaymentUri(networkCode, address, amount, cryptoBase)`.
  * Emits a URI ONLY for native-coin chains where the amount is unambiguous:
    BTC→`bitcoin:`, LTC→`litecoin:`, DOGE→`dogecoin:`, BCH→`bitcoincash:` (cashaddr
    prefix normalized so it's never doubled), SOL→`solana:` — all with `?amount=` in
    whole-coin units, formatted with the SAME formatCryptoAmount used by the on-screen
    AMOUNT row (so link & display can't drift).
  * Returns null for token/EVM/TRON/XRP (USDT/USDC/ETH/POL/TRX/XRP/RLUSD) to avoid
    risky wei/smallest-unit/token-transfer encoding — those keep the existing copy+QR flow.
- `paymentUri` useMemo derives the URI from cryptoInfo (via CRYPTO_INFO[crypto_display].network).
- QR: when paymentUri exists, the QR is rendered client-side with `QRCodeSVG` (qrcode.react
  v4.2.0) encoding the URI so a scanning wallet pre-fills address+amount; otherwise the
  existing backend address-QR <img> is kept unchanged. Tap-to-copy-address behaviour unchanged.
- Added an "Open in wallet app" deep-link button (anchor href=URI) below the AMOUNT row,
  shown only when paymentUri exists, with i18n defaultValue strings
  (checkout.openInWallet / checkout.openInWalletHint).
VERIFICATION: lint clean (only 3 pre-existing exhaustive-deps warnings); /pay compiles clean;
buildPaymentUri validated via a temporary isolation harness (/pay/deeplink-test, since removed)
whose SSR HTML asserted correct URIs for BTC/LTC/DOGE/SOL, single-prefix BCH (0 double-prefixes),
and NULL for USDT-TRC20 + ETH. In-context live crypto screen NOT exercised on purpose (reaching
it reserves a real address from the live merchant pool). Next candidates: G5 detected/confirming
state (needs backend confirmations field), G3 webhook mgmt (backend).
