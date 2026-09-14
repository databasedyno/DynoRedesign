# DynoPay Landing Copy Audit
_Deliverable: written audit only. Applying the approved copy to the live site (6 languages) is a separate follow-up (Decision A = doc only)._
_Author: main agent · Date: 2026-08-28 · Working language: English · Brand spelling: **Dynopay**._
_Scope: home page (`v3` landing) + the **Products** nav mega-menu. Out of scope: layout redesign, new pages/sections, changing product features to fit copy._
_Prior rewrite history preserved in **`COPY_AUDIT_ARCHIVE_2026-06.md`**. ⚠️ That 2026-06 log claimed the speed claims ("four seconds", "on-chain in seconds") were already reworded — but they are STILL live in `landing.json` (lines 143, 204), so they did not stick and are re-flagged below._

---

## 1. Method & standards

The copy was checked, claim by claim, against the **actual product configuration** in this codebase (fee logic, wallet/network config, conversion, custody model, compliance integrations) and against current advertising-honesty norms for payments/crypto companies:

- **FTC Act §5** (US) — no deceptive or unsubstantiated claims; disclose the **total** price, not a cherry-picked floor.
- **ASA / CAP Code** (UK) and **CMA** guidance — prices must include **mandatory fixed fees**; "from X" must be an entry price a meaningful number of users actually get.
- **EU UCPD** (Unfair Commercial Practices) — no misleading omissions (e.g. a compulsory per-transaction fee hidden from the headline).
- **Crypto-specific**: describe settlement timing honestly (network-dependent), never imply funds are guaranteed "instant"; be precise about custody; only name a rate source if it is always true.

**Principles the recommended copy follows**
1. One plain-language value proposition — who it's for + what it does. No Web3 hype.
2. Pricing stated **completely**: percentage **and** the fixed per-payment fee, the honest **entry** rate (not just the floor), plus who pays network fees.
3. No "instant / free / no fees" unless literally true in **every** case; settlement timing described by network.
4. Trust signals **only where real**: "non-custodial", "KYC/AML", "GDPR" are fine; SOC 2 only at the level actually true; no fabricated totals.
5. Concrete, defensible asset/network numbers.
6. FAQ answers the real buying questions: custody, timing, total cost, refunds, fiat/subscriptions, integration.
7. **Consistency** — the same fee, the same asset count, the same claims everywhere on the page.

---

## 2. Product truth (source of truth)

Verified from code/config on 2026-08-28. Cited files in **Implementation map** (§7).

### 2.1 Fees — the real model
Every payment carries **two** platform charges:

| Component | Value | Source |
|---|---|---|
| **Percentage** (by all-time confirmed USD volume) | Starter **1.5%** (0–$10k) · Growth **1.0%** ($10k–$100k) · Scale **0.7%** ($100k–$500k) · Enterprise **0.5%** ($500k+) | `backend/utils/volumeTierUtils.ts`, `.env VOLUME_TIER_*` |
| **Fixed fee** | **$1.00 per payment** (all amount tiers) | `backend/utils/feeConfigUtils.ts`, `.env FEE_TIER_*_FIXED=1.00`; shown in live checkout as "Processing fee" |
| **First-payment waiver (trial)** | The merchant's **first payment is entirely platform-fee-free** (both % and $1, any size, no cap), then the account graduates to Starter 1.5% | `backend/services/feeFreeService.ts` (rule dated 2026-08) |
| **Referral offer** | **50% off platform fees for 30 days** | `calculateTransactionFeesWithDiscount` |
| No monthly fee · no setup fee · no chargebacks | true | — |

- **Tier is decided by ALL-TIME confirmed USD volume** (see `volumeTierUtils` + `dashboardController`). ⚠️ The FAQ currently says **"based on 30-day volume"** — that is **factually wrong** and must change.
- The honest headline entry price is **"1.5% + $1 per payment"**, dropping to as low as **0.5% + $1** at enterprise volume. "from 0.5%" alone is the floor almost no merchant starts on.
- **Network (gas) fees:** the $1 shown at checkout is the platform "Processing fee". Who bears the on-chain network fee (buyer vs merchant vs Dynopay sweep wallets) is **not conclusively provable from copy-level review** → **Open question O-1**.

### 2.2 Supported networks & assets
**9 networks**, carrying **12 distinct assets** across **15 chain-specific options** (`utils/networkLabels.ts`, `.env` wallet config):

- **Networks (9):** Bitcoin · Ethereum · Litecoin · Dogecoin · Bitcoin Cash · Tron · Solana · XRP Ledger · Polygon.
- **Distinct assets (12):** BTC, ETH, LTC, DOGE, BCH, TRX, SOL, XRP, POL, **USDT**, **USDC**, **RLUSD**.
- **Chain-specific options (15):** the 9 native coins + USDT-ERC20, USDC-ERC20, RLUSD-ERC20, USDT-TRC20, USDT-POLYGON, RLUSD (XRPL).

➡️ **There are 9 networks, not "15+".** The "15+ networks / 15+ chains" claim conflates *wallet types* (15) with *networks* (9). Recommended public number: **"9 blockchains"** and **"12 coins & stablecoins"** (or "15 payment options across 9 chains"). Exact advertised wording → **Decision D**.

### 2.3 Auto-convert
- Incoming coin can be **kept** or **auto-converted to USDT / USDC**. Conversion runs via **Binance Convert** (`.env BINANCE_CONVERT_INTERVAL_MINUTES=10`, `binanceConvert`).
- Honest timing: **"automatically, the moment the payment confirms on-chain"** — not "four seconds" and not "instant".
- Naming "**Binance**" as the rate source is stated as fact in How-it-works. It is true in production today, but couples the copy to one vendor → recommend generic **"live market rates"** unless the source is guaranteed → **Open question O-2**.

### 2.4 Custody, compliance, chargebacks, refunds
- **Non-custodial:** payments settle as real on-chain transfers **to a wallet the merchant controls**; Dynopay never holds funds. ✅ true — keep.
- **Compliance posture (true & advertisable):** Encrypted · **KYC/AML** (Veriff integration) · **GDPR**.
- **SOC 2:** legacy copy shows a badge **"SOC2 track"**. Only claim SOC 2 if a report/audit is genuinely in progress; otherwise remove → **Open question O-3**.
- **Chargebacks: 0** — crypto settlement is final. ✅ true.
- **Refunds:** one-click **on-chain reversal** back to the buyer's address. ✅ true.

### 2.5 Payouts (scope)
- The `/payouts` product is **"Balances & payouts"** — the merchant's own settled volume, pending funds, auto-conversion, and **where their payouts land** (settlement/withdrawal to a wallet they control). It is **not** an outbound "send money to anyone, anywhere" remittance product.
- ➡️ Menu desc "**Send stablecoins and crypto to anyone, anywhere**" **overstates scope** and contradicts the non-custodial settlement story. Confirm before shipping reframed copy → **Open question O-4**.

### 2.6 What is NOT offered (state plainly, don't imply otherwise)
- ❌ Fiat / card payments.
- ❌ Recurring / auto-charged subscriptions (every charge is a one-time crypto payment; reshare the link for repeats). _(FAQ a5 already says this correctly — keep.)_
- Company founded **2024** (SEO boilerplate).

### 2.7 Feature inventory (live, advertisable)
Payment links · hosted checkout (Clean Checkout V2) · product catalog / storefront · invoices · creator tip pages · fundraising campaigns · one-click refunds · REST API + webhooks · KYC/AML · multi-company · referral program (50% off fees / 30 days).

---

## 3. Voice & copy rules (the do/don't the rewrite must obey)

**Do**
- Lead the fee with the **full** price: percentage **+ $1 fixed**, honest entry rate first.
- Say **"as soon as the payment confirms on-chain"** for settlement/convert timing.
- Use **"9 blockchains"** / **"12 coins & stablecoins"** everywhere (one number, page-wide).
- Keep **non-custodial · KYC/AML · GDPR · no chargebacks** — all true.
- Describe payouts as **settlement to a wallet you control**.

**Don't**
- ❌ "from 0.5%" as the headline (floor, not entry).
- ❌ Hide the **$1 fixed fee**.
- ❌ "instant / instant payouts / in about four seconds / on-chain in seconds".
- ❌ "15+ networks / 15+ chains".
- ❌ Name "Binance" as the rate source unless approved (O-2).
- ❌ "SOC2 track" unless real (O-3).
- ❌ "public beta" (Decision C default = drop it).
- ❌ Fabricated trust totals (settled $, median settle time, uptime) unless real.

---

## 4. Section-by-section audit

> Format: **Current** → _Issue (standard/fact broken)_ → **Recommended (EN)**.

### 4.1 Hero
- **Eyebrow — Current:** "Dynopay · Now in public beta"
  → _Positioning risk; product serves real merchants (Decision C)._ →
  **Recommended:** "Dynopay · Crypto payments for real businesses" _(drop "public beta")._
- **Body — Current:** "Take Bitcoin, Ethereum and stablecoins … settle to a wallet you control. **No chargebacks, from 0.5%.**"
  → _Cherry-picked floor; omits the mandatory $1 fixed fee (FTC/ASA/CMA)._ →
  **Recommended:** "Take Bitcoin, Ethereum and stablecoins on a hosted checkout or payment link. Keep the original coin or auto-convert to USDC or USDT — your choice — and settle to a wallet you control. No chargebacks. **1.5% + $1 per payment, dropping to as low as 0.5% as your volume grows.**"
- **Bullets — Current:** "Free to start · No card · **15+ networks**"
  → _Inflated network count; "Free to start" is vague._ →
  **Recommended:** "First payment fee-free · No card required · **9 blockchains, 12 coins & stablecoins**"
- **metaSettle — Current:** "Settles to the coin you choose · **from 0.5%**"
  → _Same floor-only issue._ →
  **Recommended:** "Settles to the coin you choose · **1.5% + $1, as low as 0.5% at scale**"
- **trustLine — Current:** "Non-custodial · Encrypted · GDPR / AML" → ✅ accurate — keep.

### 4.2 How it works (3 steps)
- **Step "Accept" — Current:** "Your buyer picks any of **15+ chains** — BTC, ETH, USDC, USDT, XRP, TRON — and pays."
  → _9 networks, not 15+._ →
  **Recommended:** "Your buyer picks from **9 blockchains** — BTC, ETH, USDC, USDT, XRP, Tron and more — and pays."
- **Step "Convert" — Current:** "Live **Binance** rates, **on-chain in seconds**, no manual conversion."
  → _Names a specific vendor as fact; overstates speed._ →
  **Recommended:** "**Live market rates**, converted automatically **once the payment confirms on-chain** — no manual steps." _(Name Binance only if O-2 approved.)_
- **Step "Settle" — Current:** "Payout goes straight to the wallet address you control … **From 0.5% flat**, no monthly, no chargebacks."
  → _"0.5% flat" is doubly wrong (not flat; not the entry rate); omits $1._ →
  **Recommended:** "Payout goes straight to a wallet you control — never held by us. **1.5% + $1 to start, as low as 0.5% at scale.** No monthly fee, no chargebacks."

### 4.3 Feature cards
- **Payment Links — Current:** "Customers pay in any of **15+ chains** — auto-converted to the coin you actually keep."
  → _Count; also implies auto-convert is automatic/default._ →
  **Recommended:** "Share one link. Customers pay across **9 blockchains** — keep the coin or auto-convert to USDC/USDT, your choice."
- **Checkout / auto-convert card — Current:** "Accept BTC or ETH, settle to USDT or USDC **in about four seconds**. Get paid without the price swing."
  → _Fabricated fixed speed; settlement is network-dependent._ →
  **Recommended:** "Accept BTC or ETH and settle to USDT or USDC **automatically once the payment confirms** — no price-swing exposure."
- **Creator Pages — Current:** "…no chargebacks, **instant payouts**."
  → _"Instant payouts" not guaranteed._ →
  **Recommended:** "…no chargebacks; funds settle **straight to your wallet as soon as the payment confirms**."

### 4.4 Trust / Numbers band (`NumbersTrustBand.tsx`, active v3)
Current stats: **0.5%** (Lowest fee / as volume grows) · **15+** (Networks) · **0** (Chargebacks) · **24/7** (Always on). Badges: Encrypted · KYC/AML · GDPR · Non-custodial.
- **0.5% stat** → _reads as THE fee; it's the enterprise floor._ → **Recommended:** show **"1.5%"** as the headline number, label **"Starter fee"**, sub **"as low as 0.5% at scale"** — OR a range **"1.5% → 0.5%"**. Never present 0.5% as the standalone fee.
- **15+ stat** → _only 9 networks._ → **Recommended:** **"9"** / label "Blockchains" / sub "12 coins & stablecoins".
- **0 chargebacks / 24/7** → ✅ keep.
- ✅ **Good:** the active band shows **no fabricated $-settled / median-settle / uptime** numbers. _(Legacy keys `numbers.settled*`, `numbers.settleLabel`, `numbers.badgeSOC2` still exist in `landing.json` but are not rendered by the v3 band — remove the stale keys during implementation so they can't be reused; especially "SOC2 track", O-3.)_

### 4.5 FAQ
- **A3 (fees) — Current:** "Between 1.5% (Starter) and 0.5% (Enterprise), based on **30-day volume**. No monthly fee… See the Fees page…"
  → _Wrong basis (it's **all-time** volume) and omits the **$1 fixed** fee._ →
  **Recommended:** "Every payment is a percentage **plus a flat $1**. The percentage runs from **1.5% (Starter)** down to **0.5% (Enterprise)** based on your **all-time settled volume**; your **first payment is fee-free**. No monthly or setup fee, no chargebacks. Full tiers on the Fees page."
- **A1 (do I need an exchange) — Current:** "…any of **15+ supported coins**…" → **Recommended:** "…any of our **12 supported coins & stablecoins across 9 chains**…" _(rest is accurate — keep.)_
- **A2 (custody)** → ✅ accurate (non-custodial, on-chain to your address) — keep.
- **A4 (settlement timing)** → ✅ already honest ("depends on the network… BTC/ETH can take longer… funds land the moment the payment confirms") — keep; it's the model for the rest of the page.
- **A5 (refunds / no fiat / no subscriptions)** → ✅ accurate — keep.

### 4.6 Learn / Docs cards
- **Fees card — Current:** "**From 1.5% down to 0.5%** as you grow. No monthly fee, no setup fee, no chargebacks — ever."
  → _Best on the page (shows the real ceiling) but still omits the $1._ →
  **Recommended:** "**1.5% + $1 per payment, down to 0.5%** as you grow. No monthly fee, no setup fee, no chargebacks."

### 4.7 Final CTA / "Start free"
- **Featured menu / CTA — Current:** "We waive our platform fee on your first payment — no card required." → ✅ **accurate** (matches `feeFreeService`) — keep; use as the model for all "free to start" wording.

### 4.8 Footer / SEO boilerplate & JSON-LD (`seo.*`)
- **boilerplateBody — Current:** "…accepting Bitcoin, Ethereum, stablecoins and **15+ other networks** … **fees from 0.5%** and no chargebacks."
  → _Count + floor-only fee (feeds press/JSON-LD, so it propagates)._ →
  **Recommended:** "…accepting Bitcoin, Ethereum, stablecoins and **12 assets across 9 blockchains**. Payments settle directly to a wallet the merchant controls, with optional auto-conversion to USDT/USDC. **Fees are 1.5% + $1 per payment, as low as 0.5% at scale**, with no chargebacks."
- **seo.facts.fee — Current:** "From 0.5% per transaction — no monthly fees" → **Recommended:** "1.5% + $1 per transaction, as low as 0.5% at scale — no monthly fees".
- **seo.facts.networks — Current:** "15+ blockchains, including Bitcoin, Ethereum, Solana, XRP and major stablecoins" → **Recommended:** "9 blockchains (Bitcoin, Ethereum, Solana, XRP, Tron, Polygon, Litecoin, Dogecoin, Bitcoin Cash) and 12 coins & stablecoins".

### 4.9 Products nav mega-menu (`menuData.tsx` + `nav.mega.*`)
- **Payment Links — Current:** "Shareable links that get you paid in crypto **in seconds**" → _"in seconds" speed implication._ → **Recommended:** "Shareable links that get you paid in crypto — no account needed for buyers."
- **Checkout — Current:** "Drop-in hosted checkout for any store" → ✅ accurate — keep.
- **Creator Pages — Current:** "Your own branded tip and payment page" → ✅ accurate — keep.
- **Crypto Payouts — Current:** "**Send stablecoins and crypto to anyone, anywhere**" → _Overstates scope; implies outbound remittance (O-4)._ → **Recommended:** "Track balances and settle your funds to a wallet you control." _(consider renaming the item "Balances & Payouts".)_
- **API Reference — Current:** "REST API for payments **and payouts**" → _"payouts" inherits the scope question._ → **Recommended:** "REST API for payments, links and webhooks." _(pending O-4.)_
- **Webhooks / Docs / Fees** → ✅ accurate — keep.

---

## 4A. Fees page (`/fees`) + calculator — extended audit
_Live page renders only the `v3.*` keys in `fees.json` (verified in `pages/fees.tsx`). The old top-level keys (`heroTitle` "Instantly Forwarded", `step1` "only one blockchain network fee", `feeFreeBanner*` "far below PayPal or Stripe") are **DEAD / not rendered** — recommend deleting them so those misleading strings can never resurface._

**The core problem: the page is built around "one number", which structurally hides the $1 fixed fee.**
- **`v3.heroTitleLead` — Current:** "**One number to remember.**" (+ tail "…as you grow.")
  → _The fee is **two** numbers (% + $1). "One number" is the wrong mental model and omits the fixed fee._ →
  **Recommended:** "Simple pricing that shrinks as you grow." (tail keeps "…as you grow.")
- **`v3.tiersTitle` — Current:** "Four tiers. **One number that shrinks.**"
  → _Same "one number" framing._ → **Recommended:** "Four tiers. Your rate shrinks as you grow."
- **Calculator (`pages/fees.tsx` L59) — Current:** `fee = volume × tier.pct / 100` — shows **only the percentage**, and the slider is labelled **"Monthly volume / 30-day volume"** (`v3.monthlyVolume`, `v3.vol30d`).
  → _Two bugs: (1) **omits the mandatory $1 per-payment fee** entirely — understates real cost, badly for many small payments; (2) tiers by **30-day** volume, but the backend tiers by **ALL-TIME** confirmed volume (`volumeTierUtils`), so the calculator can show the wrong tier._ →
  **Recommended:** add a line "**+ $1 per payment**" to the result and a note ("Your % tier is based on all-time settled volume"). Relabel the slider to reflect that the % preview is illustrative, or switch the basis to all-time to match the backend. → ties to **Open question O-8** (calculator basis).
- **`v3.perPayment` / `v3.youdPay`** ("per successful payment" / "You'd pay") → the "you'd pay" figure must include the $1 component (or clearly state "% only, plus $1 per payment").
- **`v3.headTitle` (SEO) — Current:** "Fees · Dynopay — **From 0.5% flat**, no monthly, no chargebacks."
  → _Floor-only + "flat" (it is neither flat nor the entry rate); omits $1._ →
  **Recommended:** "Fees · Dynopay — 1.5% + $1 per payment, as low as 0.5% at scale. No monthly. No chargebacks."
- **`v3.calcCta` — Current:** "**Start earning — free**"
  → _Stale CTA variant (the 2026-06 log said this was "killed" and unified — it did not stick)._ →
  **Recommended:** unify to "Start accepting payments" (`v3.hero.primaryCta`) or "Start free".
- **`v3.cmpInstantForward` — Current:** "**Instant** on-chain forwarding"
  → _Speed claim; on-chain timing is network-dependent._ → **Recommended:** "Settles on-chain to your wallet as soon as it confirms".
- **`v3.heroSubtitle` / `v3.sec1*` / comparison "others" table** → ✅ mostly honest ("you only pay when you get paid", non-custodial, no chargebacks, generic "others" — does NOT name PayPal/Stripe on the live page). Keep, minus the speed word above.

**Fees-page adds one open question:**
- **O-8 — Calculator basis:** the % calculator uses a **30-day/monthly** volume slider, but tiers are decided by **all-time** volume. Confirm which basis to present (recommend: all-time, to match the product) and confirm the $1 line should be added.

---

## 5. Global fixes (apply consistently, everywhere)
1. **One fee statement:** "**1.5% + $1 per payment, as low as 0.5% as volume grows**" (hero, how-it-works, feature cards, FAQ, learn card, SEO boilerplate, trust band). Never "from 0.5%" alone; never omit the $1.
2. **One asset number:** "**9 blockchains · 12 coins & stablecoins**" (replace every "15+ networks/chains").
3. **Settlement/convert timing:** "**as soon as the payment confirms on-chain**" (replace "four seconds", "in seconds", "instant", "instant payouts").
4. **Rate source:** "**live market rates**" (remove "Binance" unless O-2 approves naming it).
5. **Positioning:** drop "**public beta**" → live/GA (Decision C).
6. **Stats policy:** trust band shows only **real/defensible** values (fee range, 9 chains, 0 chargebacks, 24/7); delete stale legacy keys (`numbers.settled*`, `numbers.settleLabel`, `numbers.badgeSOC2`).
7. **Payouts framing:** settlement/withdrawal to a wallet the merchant controls (pending O-4).

---

## 6. Open questions (need a product owner's confirmation)
- **O-1 — Network fees:** who bears the on-chain gas fee (buyer / merchant / Dynopay)? Needed so the copy can state it next to the $1 processing fee.
- **O-2 — Name the rate source?** Is "Binance" guaranteed as the conversion source? If yes we may name it; default is generic "live market rates".
- **O-3 — SOC 2:** is a SOC 2 report/audit genuinely underway? If not, remove "SOC2 track" entirely.
- **O-4 — Payouts scope:** confirm payouts = settlement/withdrawal to the merchant's own wallet only (no arbitrary outbound "send to anyone"). Governs the menu + API-Reference copy.
- **O-5 — First-payment trial wording:** confirm "first payment entirely fee-free" (per the 2026-08 rule) is the line to advertise; the legacy `FREE_TRIAL_VOLUME_USD=500` still lingers in status displays — should any "$500 fee-free" language be used at all? (Recommend: no — use "first payment fee-free".)
- **O-6 — Decision B figure:** confirm the fixed fee to publish is exactly **$1.00**.
- **O-7 — Decision D list:** confirm the exact 9 networks / 12 assets to advertise (e.g. is RLUSD promoted publicly?).

## Decisions taken (plan defaults, unless you override)
- **A** = deliver **this document only**; live-site rewrite is the follow-up.
- **B** = lead with the **honest full price** (1.5% + $1 → 0.5%), fixed fee shown; pending O-6.
- **C** = **drop "public beta"**, present as live.
- **D** = advertise **9 networks / 12 assets** (not "15+"); pending O-7.
- **E** = keep only **real** trust signals; the live band already avoids fabricated totals — just fix the 0.5% and 15+ stats.

---

## 7. Implementation map (for the follow-up rewrite)
All keys in `langs/locales/en/landing.json` unless noted; the same keys exist in `de/es/fr/nl/pt` and must be translated during implementation.

| Change | Key(s) / file | ~line |
|---|---|---|
| Hero eyebrow (drop beta) | `v3.hero.eyebrow` | 108 |
| Hero body (fee + $1) | `v3.hero.body` | 112 |
| Hero bullets (9 chains) | `v3.hero.bullets` | 116 |
| Hero metaSettle (fee) | `v3.hero.metaSettle` | 121 |
| How-it-works accept/convert/settle | `v3.how.*.body` | 139, 143, 147 |
| Trust band stat values (0.5→1.5 range, 15+→9) | `Components/Page/Home/v3/NumbersTrustBand.tsx` `STATS[]` | 67–68 |
| Trust band labels/subs | `v3.numbers.feeLabel/feeSub/chainsLabel/chainsSub` | — |
| Feature cards (links/checkout/creator) | feature card `desc` keys | 198, 204, 247 |
| FAQ a1/a3 (count, fee basis + $1) | `faq.a1`, `faq.a3` | 271, 275 |
| Learn "Fees" card | learn `fees.desc` | 301 |
| SEO boilerplate + facts | `seo.boilerplateBody`, `seo.facts.fee`, `seo.facts.networks` | 743, 756, 760 |
| Products menu descs | `nav.mega.paymentLinks.desc` (15), `nav.mega.payouts.desc` (27), `nav.mega.api.desc` (35); routes in `Components/Layout/HomeHeader/menuData.tsx` | — |
| Remove stale legacy keys | `numbers.settled*`, `numbers.settleLabel`, `numbers.badgeSOC2` | 173–180 |

**Product-truth source files:** fees `backend/utils/volumeTierUtils.ts` + `backend/utils/feeConfigUtils.ts` + `.env`; trial `backend/services/feeFreeService.ts`; networks/assets `utils/networkLabels.ts` + `.env` wallet vars; auto-convert `.env BINANCE_CONVERT_INTERVAL_MINUTES` + `binanceConvert`; custody/refunds settlement controllers; payouts `pages/payouts.tsx` + `Components/Page/Payouts`.
