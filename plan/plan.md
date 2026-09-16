# Landing page at Stripe quality — proposal

Reference: https://stripe.com/pt-pt · Target: dynopay.com homepage (and the header/footer every public page shares).

## 1. What "Stripe quality" actually is

Stripe's page is not better because it has more sections — the current Dynopay homepage already tells the same story (hero, live demo, proof, how it works, products, pricing, trust, developers, coins, FAQ, global, CTA). The gap is in six things:

| Dimension | Stripe | Dynopay today |
|---|---|---|
| Signature visual | Animated gradient wave behind a two-line statement headline; the page is instantly recognisable | Flat hero; the sandbox checkout is strong but sits on a plain background |
| Product shown as product | Every product is a high-fidelity UI vignette in a "bento" grid (billing meter, card, terminal, phone) | Products are a tab strip with one flat screenshot; most surfaces have no visual at all |
| Motion & craft | Every card, number and image moves with intent; consistent spacing and type scale; nothing flickers | Stat counters render broken values before the page hydrates ("-3954.89% uptime", "-41,714 payments", "Payments from 0+ countries") — visible to crawlers and briefly to users; uneven section rhythm |
| Proof | Real numbers (US$1.9T), named customer stories with metrics, logo wall | Real numbers and verifiable on-chain settlements (a genuine differentiator) but no human voice — zero quotes, zero named merchants |
| Navigation & footer | Mega-menu (Products / Solutions / Developers / Resources / Pricing), dense footer, locale switcher | Simple header; thin footer |
| Localisation | Native-quality copy per market (the linked page is European Portuguese) | 6 languages exist; copy quality is uneven and the Portuguese leans Brazilian |

Speed, accessibility, share cards and dark mode are already close and only need a final pass.

## 2. What gets built

### 2.1 Immediate fixes (ship first, independent of the redesign)
- Live statistics show their real value on first paint and only then animate; no negative or zero placeholder is ever visible or indexable.
- "Payments from 0+ countries" reads the real count without JavaScript.
- The duplicated CTA row at the page end is collapsed into one.

### 2.2 Visual direction — sign-off checkpoint before the rest is built
A one-page mock: the new hero with the animated indigo gradient, one bento product card, the type scale, the section rhythm, light and dark. Nothing further is built until this is approved — the same way the icon concepts were approved.

Proposed direction:
- **Signature**: a slow, animated indigo "conversion" gradient (brand indigo → deep navy → a mint accent meaning "settled"), full-bleed behind the hero; dimmed in dark mode; a static image fallback for reduced-motion and slow devices.
- **Type**: statement headline in the existing Manrope, two lines, first clause emphasised (Stripe's italic-lead pattern); a larger, tighter scale across the whole page.
- **Imagery**: no stock photos of people. Product UI vignettes built from the real dashboard and checkout, plus abstract brand renders. The new Bold Loop coin used as a recurring motif.
- **Motion**: staggered reveals on scroll, hover lift on cards, live counters, animated hero; honours the OS "reduce motion" setting; mobile gets lighter motion.

### 2.3 Page structure (top to bottom)
1. **Header** — mega-menu: Products (7 surfaces), Solutions (by business type — reuses the existing /for pages), Developers, Resources (blog, guides, status, press), Pricing; Sign in; "Start now" and "Sign up with Google". Blur-on-scroll sticky bar. Language switcher.
2. **Hero** — statement headline + one-sentence sub + two CTAs (Start now · Try a live checkout) over the animated gradient; the existing interactive sandbox checkout stays, restyled as a floating device card. Live strip underneath: "Settled through Dynopay this month: $X · N payments" (our version of Stripe's "GDP running on Stripe").
3. **Product bento** — replaces the tab strip. Seven cards in a Stripe-style grid, each with a real UI vignette: Payment links, Hosted checkout, Storefront, Donations & tips, Invoices, Embeds / buy button, API. Each card links to its existing deep page or demo.
4. **The conversion story** — a dedicated visual for the one thing Stripe cannot say: "Buyer pays in BTC, you receive USDC, in your own wallet." Animated coin-in / stablecoin-out sequence — Stripe's "stablecoins & crypto" card, but as our centrepiece.
5. **Numbers band** — four live stats (uptime, median settle time, payments this month, countries) with a data visual (settlements by chain, last 30 days).
6. **Proof** — two halves:
   - *Verify it yourself*: the on-chain settlement cards and live status (kept, restyled).
   - *Merchant stories*: 3–4 named merchants with a quote, a metric and a link to their public storefront or creator page. **Content dependency — see §3.**
7. **Global by default** — world map of merchant countries, 6 languages, "no country list, no bank approval"; the coins & chains grid folds in here.
8. **Developers** — Stripe's three-path pattern: No-code (links / dashboard), Pre-built (buy button / embeds), Build your own (API); the live request/response block and sandbox-key note are kept.
9. **Pricing teaser** — the four tiers and the savings calculator kept, condensed; the comparison table moves to /fees.
10. **Trust & security** — the current nine controls as a tighter grid.
11. **Resources** — carousel of the latest blog posts and guides (already-published content).
12. **FAQ** — trimmed to the eight most-asked questions; the rest move to /help-support.
13. **Final CTA** — headline + two cards (See pricing · Start building), Stripe's closing pattern.
14. **Footer** — five columns (Products, Solutions, Developers, Company, Legal), status badge, language switcher, social links, the new lockup.

### 2.4 Localisation
The English copy is rewritten first. The five other languages are re-translated from the final English with a native-quality review pass. Portuguese is written as European Portuguese (pt-PT) — see assumptions.

### 2.5 Acceptance criteria — what "done" means
- Visual-direction mock approved before build; the final page matches it.
- Lighthouse mobile ≥ 90 performance / 100 accessibility / 100 SEO; LCP under 2.5 s; no layout shift (CLS < 0.05); zero colour-contrast violations in light and dark.
- No placeholder or broken number is ever rendered, with or without JavaScript.
- Correct at 390 / 768 / 1366 / 1920 widths, light and dark, all six languages, reduced-motion on and off.
- Every section links to a destination that exists today — no dead ends.

## 3. What only you can supply

1. **Merchant stories** — 3–4 merchants willing to be named: a one- or two-sentence quote, name/role, one metric if possible (payments processed, countries, time saved), and permission to show their public storefront or creator page. Without these, the "Merchant stories" half of §2.3-6 ships hidden and the page keeps only verifiable proof.
2. **Any hard "don'ts"** — anything the page must not claim (regulatory wording, country lists, fee comparisons naming competitors).
3. **Sign-off** at the visual-direction checkpoint.

## 4. Assumptions — push back on any of these

- Scope is the homepage plus the shared header and footer. Secondary pages (/fees, /about, /how-to, /for/*, /compare/*) inherit the new chrome immediately; their bodies are a follow-up.
- No borrowed or aspirational logos, no stock photography of people, no invented metrics — every number stays live and real.
- The interactive sandbox checkout stays in the hero; it is a real advantage over Stripe's static hero.
- "Sign up with Google" appears as a secondary hero CTA because Google login already exists.
- Portuguese targets European Portuguese (pt-PT); the single "pt" locale is kept rather than splitting pt-PT / pt-BR.
- The competitor-comparison table leaves the homepage and lives on /fees and the /compare pages.
- The marketing page keeps light and dark modes; the animated gradient is toned down in dark mode.
- Delivery is in shippable slices, with a sign-off after the visual direction and another after the hero + bento go live; the rest follows without further approval unless something in §3 changes.

## 5. Out of scope

- Enterprise logo wall, conferences, publishing imprint, sales-team CTA, startup programmes — Stripe-specific and not truthful for Dynopay today.
- Redesign of the logged-in dashboard, checkout or storefront (unchanged).
- New product features; the page only shows what already ships.
