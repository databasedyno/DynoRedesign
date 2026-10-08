# PUBLIC-FACING UX AUDIT — Layout / Hierarchy / Usability
**Date:** 2026-10-08 · **Scope:** checkout, creator pages, storefront, landing & other public pages
**Surfaces across:** desktop (1440), large screen (2560), tablet (iPad Pro 11, iOS/WebKit), iOS phones (iPhone 15 Pro, iPhone SE — WebKit), Android phones (Pixel 8, Galaxy S24 — Chromium).

Evidence: `scripts/qa/public_ux_audit.mjs` → `test_reports/public_ux_audit/` (75 screenshots + `metrics.json`).
Captured as a real public visitor (no auth) against the live preview + real data (`/devhub` = "The Dev Store", product `talk-to-a-developer`, `/pay/demo`, `/pay/donation-demo`).

> **Caveat:** the external preview host sits behind Cloudflare; `safedeal` (desktop) and `creator @2560`
> hit the "verify you are human" interstitial during capture, so those two cells are excluded (not real UX).

---

## 0. Executive summary — the cross-cutting issues (ranked)

| # | Issue | Where | Severity | Evidence |
|---|-------|-------|----------|----------|
| 1 | **Content clipped off the right edge on phones** — cards, coin/chain chips and the "customer picks how to pay" showcase render ~420–490px wide inside a 360–393px viewport and get cut off (not scrollable). | Landing (66–76 elems), Documentation (56), SafeDeal (2), Donation (1) | **P0** | `clippedRightCount`; drops to 2 on iPad, 0 on desktop |
| 2 | **Type-scale sprawl** — 17–30 distinct font sizes per public page, incl. 8–11px micro-text. No capped scale → weak, noisy hierarchy. | Landing 26–30, Fees 26, About 22, SafeDeal 20, Donation/Docs 17, Creator 17 | **P0** | `distinctFontSizes`, `fontSizes` |
| 3 | **Extreme page length on mobile** — very long linear scrolls with thin sectioning and no jump-nav. | Docs 49 folds, Fees 15.6, Landing 16, Trust 10.5, About 8.1 | **P1** | `pageHeight / viewport` |
| 4 | **Touch targets < 44px** — primary CTAs 40–41px tall; doc/safedeal controls 27–32px. | Landing 17–18, Docs 63, SafeDeal 15, Creator/Donation 8 | **P1** | `small44` |
| 5 | **First-visit language bar overlaps content** (full chip row EN·PT·FR·ES·DE·NL pinned bottom; clips on iPad). | Landing (all touch) | **P1** | screenshot + `clippedRight` NL button |
| 6 | **Sticky action bars overlap body copy** (no bottom safe-area padding on the scroll area). | Donation checkout, product detail (mild) | **P1** | screenshot |
| 7 | **Desktop/large-screen width wasted** — checkout is a narrow centered card island; big empty gutters at 1440/2560. | Hosted checkout, product-detail right column | **P2** | screenshots; checkout 1.6 folds |
| 8 | **Oversized/distracting chrome on checkout** — large theme-toggle switch + hamburger compete with the pay focus. | Hosted + donation checkout header | **P2** | screenshots |

**The good news:** the **hosted checkout** is the most disciplined surface (0 clipping, 11 font sizes, only 3 sub-44 targets) and the **desktop product page** and **desktop creator page** have clean two-column hierarchy. The problems are concentrated on (a) phone widths and (b) the long marketing/doc pages.

---

## A. Landing page ( / )

**Works:** strong desktop hero (clear value prop "Accept crypto payments. Settle to your wallet.", email + Start free + Google, animated checkout mock, proof stats 1,032 / 124 / 15 / 99.94%). Clear top nav (Product / Developers / Resources / Pricing). Good dark-on-light contrast.

**Issues**
- **Phone (iOS + Android): 66–76 elements clipped at the right edge.** Offenders: the *"Customer picks how to pay · 15 coins"* showcase, the coin/chain chips (`USDC/TRX/POL`), and "Accept payments / Bitcoin, Ethereum, USDT, USDC / Learn more" feature cards render at 423–440px in a 360–393px viewport. `overflowPx = 0`, so the page doesn't scroll sideways — the content is simply **cut off**. (iPad 834px → only 2; desktop → 0.)
- **26–30 distinct font sizes** incl. 8px, 8.5px, 9px micro-text and a 64px hero — the widest sprawl of any page.
- **Tap targets 40–41px:** `header-search-button` 40×40, `hero-google-auth-btn` 215×**41**, `product-showcase-cta` 140×**41**, `device-cta-dashboard` 220×**41** — all just under the 44px touch minimum.
- **First-visit language bar** (EN·PT·FR·ES·DE·NL + ✕) is pinned across the bottom on mobile, overlapping the hero CTA zone; on iPad the "Nederlands" button overflows the viewport (r=900 @834).
- **16-fold scroll** on phones (10.6k px) — a lot of marketing to wade through with weak visual "chapter" breaks.

**Recommendations**
1. **P0** Audit every below-the-fold landing section for phone width: cards/strips must `max-width:100%` and wrap, OR become a *deliberate* horizontal carousel (`overflow-x:auto; scroll-snap; -webkit-overflow-scrolling:touch` + an edge-fade cue) so content is reachable, never clipped.
2. **P0** Collapse to a capped type scale (≤ 8 steps), body/caption floor 12px, eyebrows 11–12px min.
3. **P1** Bump the four 40–41px CTAs to ≥44px (48px recommended for the Google/Start-free pair).
4. **P1** Replace the bottom language chip-row with a single globe control (or a slim, dismissible, non-overlapping banner) that remembers the choice.
5. **P2** Tighten section rhythm (consistent vertical spacing tokens) to shorten the mobile scroll and sharpen "chapters".

## B. Other public pages (Fees, About, Trust, System-status, SafeDeal, Documentation)

**Works:** Fees hero ("1.5% → 0.5% as you grow", Calculate-my-fee CTA) and Docs hero (API reference + live code sample + 4 capability cards + a left nav/search) are clear and on-brand.

**Issues**
- **Documentation is the weakest mobile surface:** **49 folds** (32k px) one linear page; **56 clipped** code/table nodes (`x-api-key: …` r=403, "Publishable Key" chips, endpoint paths spill past 393px); **63 controls < 44px** (lang toggles cURL/Node 58–72×**27**, "Copy" 72×27, "Sections" 102×31, pager buttons). The desktop left-nav/search appears *below* the hero rather than sticky.
- **Fees / About / Trust** are very long on mobile (15.6 / 8.1 / 10.5 folds) with 19–26 font sizes — same type-scale + length pattern as landing.
- **SafeDeal (mobile):** 20 font sizes; `Release funds` 259×**32**, nav items down to 36px, a 52×32 icon button; a "Litecoin" chip clips (r=413). Desktop couldn't be measured (Cloudflare).

**Recommendations**
1. **P0 (Docs)** Make code blocks horizontally **scrollable, never clipped**; raise all doc controls (lang tabs, Copy, pager, Sections) to ≥44px; make the section nav/search a **sticky left rail (desktop) / persistent top "Sections" + search (mobile)**; paginate or lazy-load long sections.
2. **P1** Apply the shared type scale + section-spacing tokens to Fees/About/Trust/SafeDeal to cut length and noise.
3. **P1 (SafeDeal)** Raise action buttons to ≥44px; fix the clipped coin chip; re-verify desktop once off Cloudflare.

## C. Creator page & storefront ( /devhub , product detail )

**Works:** **best-balanced surface.** Desktop = clean two-column (identity/bio/socials left, "Buy me a coffee" amount card right with $10/$25/$50/$100/Custom, message, name, anonymous). Mobile stacks well with a **sticky "Support …" CTA** (good for conversion). Product page: strong two-column (gallery + DIGITAL badge, title/price/One-off, Add-to-cart / Buy-now, trust bullets) with a sticky buy-bar on mobile. **0 right-edge clipping** on the creator page.

**Issues**
- **Support-chat FAB overlaps content** — the floating chat button sits over the "Find … on / Telegram" row and near the sticky CTA on phones.
- **17 distinct font sizes**; the "Want a receipt?" toggle is 213×**32** and the header share button 36×36 (sub-44).
- **Custom accent (cyan) vs brand yellow** — fine as a creator theme, but the sticky CTA, verified badge and links mix accent systems; confirm contrast of cyan CTA text.
- **Product-detail sticky bar** faintly overlaps the title/price behind it on phones (needs a touch more scroll-area bottom padding / stronger backdrop).

**Recommendations**
1. **P1** Give the support FAB a collision-aware offset (raise above the sticky CTA; hide while the CTA/sheet is open).
2. **P1** Raise the receipt toggle + share button to ≥44px; apply the shared type scale.
3. **P2** Add bottom safe-area padding to the product/creator scroll area so sticky bars never cover copy; verify cyan-CTA contrast ≥ 4.5:1.

## D. Checkout (hosted /pay , donation , store checkout)

**Works:** **hosted checkout is the cleanest surface** — one focused card, clear status ("WAITING / Waiting for your payment"), "TOTAL YOU PAY $20.00", Network/Currency selectors, "SEND EXACTLY 0.407 LTC", optional receipt email, sandbox badge. **0 clipping, 11 font sizes, only 3 sub-44 targets.** Donation checkout has a compelling campaign layout (hero image, "Ends in 5d 2h", organizer, goal, sticky Donate bar).

**Issues**
- **Desktop wastes space:** the pay card is a narrow, vertically-floating island with large empty gutters at 1440 and especially 2560 — no order/merchant/trust context to anchor it.
- **Checkout header chrome competes with the task:** an oversized theme-toggle switch + hamburger sit prominently above a payment flow.
- **Donation checkout:** 17 font sizes, **45 sub-12px** caption nodes; the **sticky "Donate" bar overlaps the campaign description**; share icons are 38×38 (sub-44); the demo's tab strip clips at the right edge.
- **Store checkout** (`/devhub/checkout`) renders an empty-cart state (expected for a fresh visitor) — flag to verify the funded-cart layout separately.

**Recommendations**
1. **P1 (conversion-critical)** On desktop, use a **two-column checkout**: left = order/merchant summary + trust (non-custodial, receipt, secured-by), right = the pay panel; vertically centre and cap the column. Reclaims the empty gutters and builds confidence.
2. **P1** Demote the theme toggle to a small icon in a overflow/footer; keep the checkout header minimal (brand + language + security lock only).
3. **P1 (donation)** Add bottom safe-area padding so the sticky Donate bar never covers copy; raise share icons to ≥44px; fold the 45 sub-12 captions into the shared scale (≥12px).
4. **P2** Keep a single "SEND EXACTLY" emphasis and one money type-treatment across both checkout variants.

---

## Cross-cutting system fixes (do once, benefits every public page)

1. **Mobile width contract (P0):** nothing may exceed `100vw`; opt-in horizontal carousels only, with scroll-snap + edge fade. Add a CI check (reuse `public_ux_audit.mjs` `clippedRightCount` == 0 on phones as a gate).
2. **One capped type scale (P0):** ≤ 8 sizes, 12px floor for body/caption (11–12px eyebrows), define as tokens; retire the 8–11px and half-pixel sizes. (The authenticated app already adopted `styles/shellTokens.ts TYPE_SCALE` — extend it to the public/landing/marketing components.)
3. **44px touch minimum (P1):** every link/button/toggle ≥44×44 on `(pointer:coarse)`; raise the many 27–41px controls. (Mirror the app's `data-touch-44` / `styles/tapTarget.ts` helpers into public components.)
4. **Inputs ≥16px (P1):** avoids iOS zoom-on-focus (seen on landing email + donation inputs).
5. **Sticky-bar safe areas (P1):** any fixed bottom bar must add matching `padding-bottom` (incl. `env(safe-area-inset-bottom)`) to its scroll container; FABs must avoid colliding with sticky CTAs.
6. **Page-length & sectioning (P1/P2):** shared vertical-rhythm tokens + a sticky in-page nav / "jump to" for the long pages (Docs, Fees, About, Trust) to cut the 8–49-fold mobile scrolls.
7. **Desktop/large-screen use (P2):** give single-column pages (checkout, some marketing) a max-width + supporting column so 1440–2560 isn't empty gutters.

## Suggested roadmap
- **P0 (correctness/legibility):** landing+docs phone clipping; capped type scale on public components.
- **P1 (usability/conversion):** 44px targets; language-bar redesign; two-column desktop checkout; sticky-bar safe areas; docs mobile nav + scrollable code; inputs ≥16px.
- **P2 (polish):** desktop width usage; section rhythm/jump-nav; checkout header minimisation; creator accent-contrast + FAB collision.

## Appendix — key metrics (page × device)
`H-OVERFLOW` here = elements clipped at the right edge; `fs` = distinct font sizes; `tap<44` = sub-44 targets on touch.

| Page | desktop-1440 | iPhone 15 Pro | Pixel 8 | iPad Pro 11 |
|------|-------------|---------------|---------|-------------|
| Landing | 7.1 folds, fs30 | clip70, fs26, tap18, 16f | clip66, fs26, tap17 | clip2, fs27, tap17 |
| Creator /devhub | 2.5f, fs17 | clip0, fs17, tap8, 5.8f | clip0, fs17 | clip0?, fs16, tap8 |
| Product detail | 2.1f, fs13 | clip1, fs14, tap8 | clip1, fs14 | — |
| Checkout hosted | 1.6f, fs13 | clip0, fs11, tap3 | clip0, fs11 | fs11, tap3 |
| Checkout donation | 2.9f, fs18, 44×<12 | clip1, fs17, tap8, 5f | clip1, fs17 | — |
| Fees | 8.6f, fs26 | fs23, tap10, 15.6f | fs23, tap9 | — |
| Documentation | 22.9f, fs18, clip1 | clip56, fs17, tap63, 49f | — | — |
| SafeDeal | (Cloudflare) | clip2, fs20, tap15, 8.5f | — | — |
