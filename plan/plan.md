# Dynopay Landing Page — Trust & Clarity Restructure

A rebuild of the public homepage so it reads like a transparent, well-run payments company: calm, evidence-led, and visually identical in spirit to the signed-in app.
It replaces today's glow-heavy, centered "exchange-style" landing with a left-aligned, flat, hairline-separated page where every section answers one buyer question and backs it with proof.

## Who it's for
Prospective merchants deciding whether to accept crypto with Dynopay — online sellers, creators, freelancers and developers who are skeptical by default and trust-sensitive about money. Secondary audiences: a merchant's own customers who land on dynopay.com after paying, journalists/partners checking legitimacy, and search engines reading the page.

## The problem being solved
The current landing (v7) borrows a crypto-exchange aesthetic: large centered statements, yellow aurora glows, gradient text, a perspective-tilted mockup and an expressive display font. The signed-in app has since moved to a quiet, Mercury-style operations console — flat surfaces, hairline borders, Manrope + IBM Plex Sans, gold used only for the primary action, left-aligned data. The two no longer feel like the same company: the landing promises "hype", the product delivers "calm". Visitors evaluating a payments provider read that mismatch as risk. Trust signals (live metrics, status, policies, fees) also sit scattered or below the fold instead of being the backbone of the page.

## Core features and experience
One visual language shared with the app, and a page structure organised around trust:

- **Same design system as the app** — the app's canvas/surface/ink colours, Manrope headings, IBM Plex Sans body, tabular numerals for every figure, hairline separators instead of cards-on-cards, 12–16px radii, gold strictly for the primary CTA and key highlights. No aurora glows, no gradient text, no tilted mockups, no display-face headlines.
- **Left-aligned editorial layout** — a consistent content column with eyebrow → headline → one-sentence explanation → proof/visual, repeated section after section so the page is predictable and scannable.
- **Hero that shows the real product** — plain-language promise ("accept crypto payments, get paid in the coin you choose, see every payment in one place" tone), one primary CTA (Start free) and one quiet secondary (See a live checkout), and beside it the actual hosted-checkout mock restyled to the app's system — no illustration, no stock imagery.
- **Live proof strip directly under the hero** — the existing real, server-rendered metrics (uptime, median settlement time, payments this month, countries) shown as a quiet "ledger" with a link to the public status page. Numbers are what the system reports; placeholders when unavailable.
- **How it works — 3 numbered steps** with small product UI vignettes in app styling (create a link / customer pays / funds and record appear).
- **Transparent pricing block** — the headline fee stated plainly, what is and isn't charged, and a link to the fee calculator and chain-time table. No marketing qualifiers.
- **New: Security & compliance section** — how customer funds flow, what Dynopay does and does not hold, verification (KYC/AML), and direct links to the existing AML policy, wallet-security, terms and privacy pages. Only statements already published on the site are used; nothing is invented.
- **Three ways to use Dynopay** — No-code (payment links, storefront), Hosted checkout, API — each with a short description and a real code/UI sample; links to Products and Documentation.
- **Merchant stories** — the two existing testimonials, re-set as quiet quotes with name, business and outcome, no decorative cards.
- **FAQ** — the existing four questions, restyled as a hairline accordion; structured-data markup preserved.
- **Final CTA** — a restrained closing band with Start free and a reassurance line (no card required / takes minutes — matching today's copy).
- **Public header/footer alignment** — the sticky top bar becomes the app's glass top-bar style with one clear CTA; footer link groups restyled to the same tokens.

Preserved behaviour: signed-in visitors still redirect straight to the dashboard; `?view=landing` still forces the marketing page; anchor links (#how-it-works, #products, #pricing, #faq) keep working; SEO/structured data, server-rendered metrics, visitor tracking and all translations continue to work.

## User flow
1. Visitor lands → reads one clear promise and sees the real checkout UI; primary CTA is unmistakable.
2. Eyes drop to the live proof strip → real uptime/settlement/volume numbers and a link to the status page answer "is this real and running?".
3. Scrolls through **How it works** → understands the product in three steps without jargon.
4. Reaches **Pricing** → sees the fee stated plainly; can open the calculator for their exact case.
5. Reaches **Security & compliance** → sees how funds are handled and the policies that govern it; can read the full documents.
6. Picks a path in **Three ways to use** (no-code / checkout / API) → goes to Products or Docs, or
7. Reads merchant stories and FAQ → closes remaining doubts → **Start free**.

## UI/UX feel
Calm, confident, financial. Dark-first (deep warm near-black canvas, off-white ink) with the refined light mode following the site's existing theme toggle. Manrope for headlines at medium weight with tight tracking; IBM Plex Sans for body at generous line-height; IBM Plex Mono only for code samples and hashes. Sections are separated by hairlines and whitespace, not by alternating coloured bands. Gold appears on the primary button, the active nav item and one or two key figures — nowhere else. Visuals are the product itself (checkout, dashboard rows, a payment link) rendered in the app's own component style, so what the visitor sees on the landing is what they'll see after signing up. Motion is fast and functional: staggered fade-up on scroll, 150–200ms hovers, counting numbers in the proof strip; nothing bouncy, no parallax. Icons are a single consistent set (Lucide). Fully responsive; on mobile the hero stacks (copy, CTA, then product UI) and every section remains readable in one column.

## Implementation phases

**Phase 1 — MVP (built now): the homepage, end to end**
- New landing design system layer mapped to the app's tokens (colours, type, spacing, radii, motion).
- All eleven homepage sections rebuilt in the new structure and style: Hero, Live proof, How it works, Pricing, Security & compliance (new), Three ways, Merchant stories, FAQ, Final CTA, plus header and footer alignment.
- Dark and light themes, desktop and mobile. Existing redirects, anchors, SEO markup, metrics feed and translations preserved; new copy added in English and to the other supported languages.

**Phase 2 — carry the system across the public marketing pages**
- Fees, Products, Documentation landing, About, Company, Press, the industry pages (/for/*) and comparison pages (/compare/*) re-skinned onto the Phase-1 system so the whole public site matches the homepage and the app.

**Phase 3 — deeper trust assets**
- A dedicated Trust Centre page combining live status, security practices, compliance documents and incident history.
- Expanded merchant case-study pages behind the homepage quotes.
- Inline fee calculator in the Pricing section and a short embedded product walkthrough in the Hero.

## Assumptions
- "In-app pages" means the app's current Mercury-style operations-console design system (flat hairline surfaces, Manrope + IBM Plex Sans, warm near-black canvas, gold reserved for primary actions, left-aligned). The landing adopts that system rather than creating a third look.
- The rebuild is a restructure and re-skin, not a repositioning: the product promise, CTAs (Start free / live checkout demo), pricing facts and the two merchant stories stay; copy is tightened for plain language and one new section (Security & compliance) is added.
- Section order is changed so proof sits directly under the hero and pricing precedes the usage paths; the nine existing questions are kept and one ("Is my money safe?") is added — eleven sections including header/footer alignment.
- The Security & compliance section uses only claims already published on existing Dynopay pages (AML policy, wallet security, terms, privacy, status). No new guarantees (insurance, licences, audits) are asserted.
- Hero and step visuals are the real product UI rendered in the app's component style — no stock photography or abstract illustration.
- Dark mode is the default presentation, as in the app; light mode follows the existing site toggle.
- The live metrics continue to come from the existing server-rendered feed; when a figure is unavailable the strip shows a neutral placeholder rather than a fabricated number.
- Header and footer are shared public components; they are restyled to match in Phase 1, but other marketing pages that use them are only fully aligned in Phase 2.
- Existing behaviours are retained unchanged: signed-in redirect to dashboard, `?view=landing` override, anchor ids, FAQ structured data, visitor tracking, multi-language support.
- No new third-party integrations are needed.
