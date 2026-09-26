# SafeDeal Landing Page — Visual Redesign (3 Mockups to Choose From)

A refreshed, more visually striking SafeDeal landing page that borrows the polish of Dynopay.com and leads with custom AI-generated 3D artwork.
The first round delivers three full-page design directions on a private preview so one can be picked before anything goes live.

## Who it's for

People arriving at SafeDeal to run an escrow deal — buyers and sellers doing online transactions who need to trust that money is held safely until delivery. The page has to feel premium and reassuring within seconds, on both desktop and phone.

## Core features and experience

- **Three complete landing-page mockups**, each a full restyle of the SafeDeal page (hero, how-it-works, fees, trust/testimonial, FAQ, closing call-to-action) — not just the hero. All three keep the same message and the same working "start a deal" form; they differ in art direction, layout rhythm, and the 3D artwork.
- **Custom AI-generated 3D illustrations** as the centerpiece art (glossy gold-and-black vault, shield, and deal/handshake motifs), generated once and used as crisp static images.
- **Dynopay-inspired sections**, adapted to escrow rather than copied: a scrolling row of supported coins, a compact stats/trust strip, floating status "pills" and notification cards (e.g. *Funded → In escrow → Released*), numbered step cards, a testimonial, and a clean fees block.
- **A private compare page** where all three mockups can be scrolled through and viewed side by side, so a direction can be chosen. The current live SafeDeal page is left exactly as-is until a choice is made.
- **Gold + black SafeDeal identity preserved** throughout, kept visually distinct from Dynopay's own brand.

### The three directions (all full-page, all on-brand)

- **A — "The Vault" (dark & premium):** Dark hero built around a glowing 3D glass-and-gold vault, floating escrow status pills, a coin marquee, and a tight stats strip. The most dramatic, closest in spirit to the current look but far more polished.
- **B — "The Handshake" (light & editorial):** Brighter, airier layout with generous whitespace, a 3D "sealed deal / handshake-shield" illustration, soft gradients, and card-based sections. Friendlier and more approachable.
- **C — "The Flow" (Dynopay-style product mockup):** Hero pairs a realistic SafeDeal "deal card" UI mockup (a deal moving through funded → held → released) with a 3D accent illustration and floating notification cards — the most direct nod to Dynopay's checkout-mockup hero.

## User flow

1. A private preview link opens the compare page showing the three mockups stacked, each clearly labelled A / B / C.
2. Each mockup can be scrolled top-to-bottom as a real, full landing page and viewed on desktop and mobile widths.
3. A direction is chosen (whole design, or "A's hero with B's steps" style mix-and-match feedback is welcome).
4. In the next round, the chosen direction is applied to the real SafeDeal landing page and refined.

## UI/UX feel

Premium, trustworthy, modern fintech. Gold (#FFC61A) accents on near-black ink for drama, balanced with clean light sections. Big confident headlines, soft depth and glow behind the 3D art, subtle motion on reveal, floating glassy status/notification cards for a sense of a live product. Fast, uncluttered, and fully legible on a phone. The 3D artwork is the hero — polished renders rather than flat icons.

## Implementation phases

### Phase 1 — MVP (built now)
- Generate the custom 3D illustration assets with Nano Banana (Gemini 2.5 Flash Image) via the Emergent universal key.
- Build all three full-page mockups (A, B, C) and place them on a private compare page for review.
- Keep the working "start a deal" form and real fee/config values inside the mockups.
- Leave the live SafeDeal landing page untouched.
- Deliver the preview link so a direction can be chosen.

### Phase 2 — Promote the winner
- Apply the chosen direction (including any mix-and-match feedback) to the real SafeDeal landing page.
- Full responsive and accessibility polish; wire the new copy into the site's language system; retire the compare page.

### Phase 3 — Extended polish
- Richer scroll/motion, animated coin marquee, live stats and a testimonial carousel where real data exists.
- Refreshed share/preview (social) images, and carrying the new visual language into adjacent SafeDeal pages (sign-in, help) for consistency.

## Assumptions

- **Scope now** is producing three mockups to choose from; going live with the winner is Phase 2, not part of this round.
- **Full-page** restyle (not hero-only), per the choice made.
- **3D art is AI-generated** with Nano Banana (Gemini 2.5 Flash Image), billed to the Emergent universal key; images are produced once and stored as static files, so there are no per-visit generation costs or waits.
- **Brand stays gold + black**, distinct from Dynopay's brand, even while borrowing Dynopay's layout ideas.
- **The offer/copy is not being rewritten** — same escrow value proposition (money held in USDT until delivery, ~5% fee, email-code sign-in, no account setup). This is a visual redesign; any new section copy (stats, testimonial) will be written to fit SafeDeal, and illustrative figures will be clearly reasonable placeholders unless real numbers are available.
- **The three mockups share the same content and sections**, differing in art direction and layout so the comparison is about look and feel.
- **The compare page is private/unlinked** (not added to navigation, kept out of search engines).
- **The existing working deal form is reused** inside the mockups rather than rebuilt.
- **English first**; new copy is added in English and slotted into the existing translation system, with full multi-language translation handled as later polish.
- **Number of mockups: three**, viewed on one compare page.
