# DynoPay Marketing Site — Bybit-Tier Redesign

DynoPay is a non-custodial crypto payments platform where merchants and creators accept 40+ coins, auto-convert to stablecoins, and get paid their way.
This project rebuilds its public marketing site — beginning with a fully reimagined homepage — to the visual and motion quality of a top-tier exchange site like Bybit.

## Who it's for
- Merchants and businesses evaluating a crypto checkout.
- Creators and freelancers who want fast crypto payouts.
- Developers judging whether the API is worth integrating.
- Investors, partners, and press forming a first impression of credibility.

## Core features and experience (Phase 1 homepage)
- **Live crypto price ticker** — a moving band of real market prices (BTC, ETH, USDT and more) with live percentage changes, used as a signature "this is alive" element.
- **Animated count-up stat band** — headline numbers that count up on scroll (payments settled, countries served, assets supported, uptime).
- **Reimagined hero** — bold value proposition paired with a polished, layered live checkout mockup that has real depth, glow, and subtle parallax.
- **Interactive product showcase** — tabbed/stacked cards that switch with motion between DynoPay's pillars: Accept payments, Auto-convert, Payouts, and Checkout. (SafeDeal escrow is a separate product and is intentionally excluded.)
- **Trust & social-proof band** — supported coins, country count, app/service rating, security and compliance badges, and partner/press logos.
- **"How it works" flow** — a clean, animated 3-step explanation of getting paid in crypto.
- **App / widget showcase** — device and widget mockups with a QR code and store badges.
- **Motion throughout** — scroll-triggered reveals, parallax layers, and tasteful hover micro-interactions that feel expensive but never janky.
- **Closing CTA + redesigned footer** — strong final conversion moment and a complete, organized footer.
- **Fully responsive** — designed for desktop and mobile, light-first with dark data and mockup panels.

## User flow
Visitor lands → immediately sees live market data and a confident value proposition → scrolls through the product showcase, proof band, and how-it-works → reaches the closing call-to-action → taps **Start free** or **Sign in**. Secondary paths lead to Pricing, Product, and Developers from the top navigation.

## UI/UX feel
Premium fintech. Confident, high-contrast, and spacious. DynoPay's gold accent sits on near-black data/mockup panels that punctuate otherwise light, airy sections (closely mirroring both Bybit and DynoPay's current identity). Crisp modern sans-serif type with a clear hierarchy, subtle gradient glows and fine grain for depth, and smooth 60fps scroll reveals and parallax. Every interaction has a small, deliberate response. Motion stays tasteful and accessible, and contrast remains readable.

## Implementation phases

**Phase 1 — MVP, built now: the reimagined homepage + the design/motion system it establishes.**
Rebuild the homepage from scratch to Bybit tier: live price ticker, animated count-up stats, hero with layered live mockup, interactive product showcase (Accept / Auto-convert / Payouts / Checkout — no SafeDeal), trust/proof band, how-it-works, app showcase, closing CTA, and redesigned footer — light-first with dark panels, fully responsive. This phase also creates the reusable building blocks (color/type/spacing tokens, animated reveal components, the live-data and count-up components) that the rest of the site will inherit.

**Phase 2 — later: highest-intent conversion pages.**
Elevate Pricing/Fees, the Product overview, and one flagship product page (e.g. Checkout) to the same system, reusing Phase 1 components.

**Phase 3 — later: the rest of the marketing site + polish.**
Roll the system across Developers, Resources/Blog/Help/Status, the remaining product and solutions pages, plus full motion, performance tuning, and multi-language polish.

## Assumptions
- Scope is a full-site redesign, but only the **homepage** ships in Phase 1; the rest follows in Phases 2–3.
- The homepage is rebuilt from scratch rather than restyled.
- Marketing stats use **aspirational, plausible figures** in the Bybit style. For sincerity: these are marketing numbers and should be swapped for verified figures before any legal/production sign-off.
- The live price ticker uses DynoPay's existing public market-data feed; if a symbol is unavailable it degrades gracefully to a last-known/placeholder value.
- Primary CTAs point to the existing **Start free / Sign in** flows; no authentication or backend changes are made.
- Visual identity stays DynoPay's current gold/black (already close to Bybit); this is not a rebrand.
- Layout is light-first with dark data/mockup panels; the homepage ships English-first, with existing translations carried where present and full multi-language coverage handled in Phase 3.
- New imagery and mockups may be generated or sourced to achieve the premium look; product mockups are rendered to reflect the real product.
- Motion is tasteful and performance-budgeted, and respects reduced-motion preferences.
- No new third-party integrations are required for Phase 1 (it uses only the existing market-data feed).
- SafeDeal escrow is treated as a separate product and is excluded from the homepage, its product showcase, and the Phase 2 flagship page.
