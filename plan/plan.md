# DynoPay Landing Copy Audit — Plan

## What this is
The landing page (dynopay.com home + the nav "Products" menu) makes claims that
don't line up with what DynoPay actually ships, and some claims break current
advertising-honesty norms for payments companies. This work produces a single
written deliverable — **`/app/memory/COPY_AUDIT.md`** — that:

1. States the product truth (what DynoPay really offers, and on what terms).
2. Lists every place the current landing copy is inaccurate, inconsistent, or
   off-standard, with the reason.
3. Gives the recommended replacement copy for each, written to current
   industry standards.

This round delivers the **document**. Rewriting the live site with the approved
copy is a separate follow-up (see "Decisions", item A).

## Why now
Reviewing the live copy against the actual configuration surfaced concrete
mismatches. The headline ones:

- **Fee claim is cherry-picked and inconsistent.** The hero leads with
  "from **0.5%**". The real published tiers are **1.5% (Starter) → 1.0% →
  0.7% → 0.5% (Enterprise, 500k+/mo volume)** — so 0.5% is the best-case floor
  almost no one starts on. The FAQ and Fees blurb already say "1.5% down to
  0.5%", so the site contradicts itself.
- **A mandatory fee is never disclosed.** Every payment also carries a **fixed
  ~$1 charge** on top of the percentage. It appears in the live checkout
  ("Processing fee") but nowhere in the marketing copy. Current standards
  (FTC / ASA / CMA) require the real total cost — percentage **and** fixed — to
  be visible next to any price claim, not buried.
- **Speed hyperbole.** "Auto-convert … in about **four seconds**", "on-chain in
  seconds", "**instant** payouts". On-chain settlement time depends on the
  network (BTC/ETH can be minutes). The product's own email voice was already
  moved off "instant" to confirmation-based wording; the landing wasn't.
- **Names a third party that may not be accurate.** "Live **Binance** rates" is
  stated as fact in How-it-works. Conversion pricing should be described
  generically ("live market rates") unless naming the source is guaranteed true.
- **Asset/network count looks inflated.** "**15+ networks / 15+ chains**" is
  repeated throughout. The configured set is ~**9 networks** (BTC, Litecoin,
  Dogecoin, Bitcoin Cash, Ethereum, Polygon, Tron, Solana, XRP) carrying ~**13
  assets** (incl. USDT/USDC/RLUSD variants). The number needs to match reality.
- **Unproven trust numbers.** The trust band shows "Settled / since launch",
  "Median settle", etc. If these are placeholders, they are a credibility risk;
  standards say metrics must be real or removed.
- **"Public beta" positioning** in the hero eyebrow — a stance decision that
  colours the whole page's trust tone.
- **Service descriptions may overstate scope.** The Products menu lists "Crypto
  Payouts — send stablecoins and crypto to anyone, anywhere", which reads like
  an outbound remittance product and sits awkwardly next to the core
  non-custodial story ("funds land in a wallet you control"). Descriptions for
  Payment Links, Checkout, Creator Pages, Payouts, API, Webhooks, product
  catalog, invoices, fundraisers, refunds and the referral offer all need to be
  checked against what actually ships and how it behaves.

## Standards the recommended copy will follow
Drawn from current crypto-payments and fintech-pricing guidance:

- One plain-language value proposition (who it's for + what it does), no Web3
  hype or jargon.
- Pricing stated plainly and completely: the percentage **and** the fixed fee,
  who pays network fees, and the honest entry rate (not just the floor).
- No "instant / free / no fees / all-in" unless literally true in every case;
  settlement timing described honestly by network.
- Trust signals only where real (compliance posture stated precisely — e.g.
  "non-custodial", "KYC/AML", and only claim SOC 2 / GDPR at the level actually
  true; no "certified" unless certified).
- Concrete, defensible numbers for supported assets/networks.
- FAQ answers the real buying questions: custody, settlement timing, total cost,
  refunds, fiat/subscriptions, integration.
- Consistency: the same fee, asset count, and claims everywhere on the page.

### Direction samples (illustrative — full set lands in the document)
- Hero fee line: "from 0.5%" -> **"1.5% + $1 per payment, dropping to as low as
  0.5% as your volume grows — no monthly fee, no chargebacks."**
- Auto-convert: "settle to USDT or USDC in about four seconds" -> **"settle to
  USDT or USDC automatically the moment the payment confirms on-chain."**
- Payouts menu item: reframed to match the real model (settlement/withdrawal to
  a wallet the merchant controls) rather than "send to anyone, anywhere" —
  pending the scope confirmation below.

## Deliverable: `/app/memory/COPY_AUDIT.md`
Sections:
1. **Method & standards** — the principles above, with sources.
2. **Product truth** — a source-of-truth table: services offered, supported
   networks/assets, fee tiers + fixed fee + first-payment waiver + referral
   offer, custody model, compliance posture, refunds, what is NOT offered
   (fiat cards, recurring subscriptions).
3. **Voice & copy rules** — the do/don't list the copy must obey.
4. **Section-by-section audit** — for Hero, How-it-works, Audience doors,
   Product feature cards, Trust/Numbers band, Learn/Docs, FAQ, Final CTA,
   Footer, and the Products nav menu: current copy -> issue (which standard or
   fact it breaks) -> recommended copy (English).
5. **Global fixes** — one agreed fee statement, one asset/network number, remove
   the Binance name, beta-vs-GA decision, stats policy — applied consistently.
6. **Open questions** — anything still needing a product owner's confirmation.
7. **Implementation map** (for the follow-up) — which copy keys each change
   touches, so the rewrite is mechanical once approved.

English is the working language of the document. Translation into the other five
site languages happens only during implementation, if that follow-up is approved.

## Decisions to confirm
**A. Deliverable scope.** Default: this round produces `COPY_AUDIT.md` only;
applying the copy to the live site (all six languages) is a separate follow-up
after the document is reviewed. Alternative: also implement the approved copy in
the same pass.

**B. Fee headline.** Default: lead with the honest full price
("1.5% + $1, as low as 0.5% as volume grows"), including the fixed fee, and make
it consistent everywhere. Confirm the exact fixed-fee figure to publish
(configuration shows $1.00) and whether network fees are paid by buyer or
merchant so the copy can state it.

**C. Positioning.** Keep the "public beta" framing, or present DynoPay as
generally available? Default assumption: drop "public beta" and present it as
live, since the product is serving real merchants.

**D. Supported-assets number.** Default: state the real figure (~9 networks /
~13 assets) instead of "15+". Confirm the exact list to advertise.

**E. Trust-band metrics.** Default: replace any placeholder stats with real
figures where available, otherwise remove them and keep only claims that are
true (non-custodial, no chargebacks, compliance posture). Confirm whether real
totals (amount settled, median settle time, uptime) can be published.

## Facts to confirm (drive accuracy of the copy)
- **Auto-convert scope:** which incoming coins can be auto-converted, to which
  stablecoins/chains, and the real timing wording to use.
- **Payouts product:** is there an outbound "send to anyone" capability, or is
  it settlement/withdrawal to the merchant's own wallet only?
- **Feature list to advertise:** confirm which are live and how to name them —
  payment links, hosted checkout, product catalog/storefront, invoices, creator
  tip pages, fundraising campaigns, refunds, API + webhooks, KYC/AML, multi-
  company, referral program (currently "50% off fees for 30 days").
- **Compliance claims allowed:** GDPR, KYC/AML, and the exact SOC 2 wording
  (current copy says "SOC2 track").

## Assumptions (unless corrected)
- Scope is the marketing copy on the home page and the Products nav menu; other
  pages (dedicated Fees, About, Docs, per-product pages) are out of scope unless
  added.
- The recommended copy stays within the existing page structure and sections —
  this is a wording change, not a redesign.
- Brand spelling stays "Dynopay" (as already standardised across the site).

## Out of scope
- Visual/layout redesign of the landing page.
- New pages or new sections.
- Building or changing any product feature to match the copy (the copy is made
  to match the product, not the reverse).
