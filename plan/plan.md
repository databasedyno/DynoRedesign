# Landing Page Improvement — Analysis & Plan

## Goal
Make the DynoPay landing page convert better and stand out against crypto‑payment
competitors (benchmarked against BlockBee, plus NOWPayments / Cryptomus / CoinGate).
This is a targeted improvement of the existing landing page, not a full rebuild, and
it uses only claims we can substantiate (no fabricated stats or testimonials).

## What the current page already does (and should keep)
The landing today is already fairly complete: an interactive hero with a live checkout
demo, a 3‑step "how it works", audience doors (Merchants / Fundraisers / Creators /
Developers), feature cards (Checkout / Auto‑convert / API), a "ways to get paid" band,
a "who pays the fee" explainer, a supported‑coins showcase, a refunds/non‑custodial
trust block, a stats + compliance band, a docs/learn band, an FAQ, a referral band, and
a final CTA.

Genuine strengths vs BlockBee worth amplifying, not replacing:
- An **interactive** hero demo (BlockBee uses static screenshots).
- **Multi‑audience** positioning (BlockBee is merchant‑only B2B).
- **One‑click on‑chain refunds** and **non‑custodial + auto‑convert to stablecoin**.
- **Fee transparency** (who pays, customer vs merchant).

## Where competitors are stronger (the gaps this plan closes)
1. **Quantified trust, high on the page.** BlockBee leads with "$100M+ processed,
   10K+ merchants, 70+ coins," a Trustpilot score, and award/press badges. Our stats
   band is present but modest and lower down.
2. **Real customer testimonials with sources.** BlockBee shows many; our landing shows
   **none** (a testimonials section exists in the codebase but is currently switched off).
3. **A pain → solution narrative.** BlockBee opens the mid‑page with "Frustrated by slow
   transactions, clunky UX, unreliable support?" then answers it. We have no such framing.
4. **Real product screenshots** (checkout, API, plugins, payouts) instead of abstract cards.
5. **An explicit security & compliance block** (2FA, KYC, AML, custody model) — expected by
   higher‑ticket merchants; competitors call this out, we don't clearly.
6. **A clear "why us vs the alternatives" moment.**
7. **Developer credibility**: a real code snippet, sandbox/test mode, webhook signature
   verification, SDKs/plugins. We link to docs but don't *show* developer proof.
8. **Fee framing.** Competitors advertise very low headline fees (BlockBee "as low as
   0.25%"). Ours is higher (1.5% down to 0.5% at scale), so leading on price is a race we
   lose — we should lead on differentiators + "first payment free / no monthly or setup fees."

## Proposed improvements (scope — approve or trim per group)
**A. Trust & social proof**
- Turn on a testimonials/reviews section, populated only with real quotes you provide
  (and a rating/badge if you have a public review profile).
- Tighten the stats band to only defensible metrics, and add a compact **security &
  compliance strip** (2FA, KYC, AML policy, non‑custodial by design).

**B. Messaging & narrative**
- Add a short **pain → solution** section (speed, clarity, refunds, custody).
- Sharpen the hero promise and CTAs; keep the interactive demo. Optionally add a
  secondary "Book a demo / Contact sales" CTA for larger merchants.
- Add a concise **"Why DynoPay"** differentiator moment (value‑led, not price‑led).

**C. Product & developer proof**
- Replace/augment abstract feature cards with **real product visuals** (checkout,
  dashboard, pay link, storefront).
- Add a **developer band**: a real code snippet + callouts for test/sandbox mode,
  webhook signature verification, and available SDKs/plugins — only for what exists today.

**D. Fee positioning**
- Reframe the fee section to lead with "first payment free + no monthly/setup fees +
  non‑custodial + auto‑convert," and present the % inside the volume‑tier context rather
  than as a headline number.

## Decisions needed from you
1. **Testimonials & hard numbers:** Can you provide real customer quotes and any metrics
   we're allowed to publish (volume processed, # of merchants, uptime)? If not, we drop
   testimonials for now and lean on technical/trust claims only.
2. **Sales path:** Add a "Book a demo / Contact sales" CTA for larger merchants? (yes/no)
3. **Comparison framing:** A named side‑by‑side table vs BlockBee/others, or a generic
   "why us"? (Default: generic — many brands avoid naming rivals.)
4. **Plugins/integrations:** Do e‑commerce plugins (WooCommerce/Shopify/etc.) exist or are
   they roadmap only? This decides whether we can claim "no‑code plugins."
5. **Fee display:** OK to keep the 1.5%→0.5% tiers but present them value‑first as above?
6. **Ambition:** Targeted improvements to the current design, or open to a bolder visual
   refresh? (An alternate landing design already exists in the codebase and could be A/B'd in.)

## Assumptions if you don't weigh in
- Improve the existing landing (no full redesign); no fabricated stats/testimonials; lead on
  differentiators, not price; keep the interactive hero; add "Book a demo" as a secondary CTA;
  generic "why us" (no named competitor table); every claim limited to features that exist today.

## Out of scope
- Pricing/fee *logic* changes, new product capabilities (e.g., building plugins or recurring
  billing), and any checkout/auth flow changes. This work is landing‑page presentation and copy
  only.
