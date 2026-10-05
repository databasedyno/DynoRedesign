# DynoPay — Conversion Copy Rewrite

A research-backed rewrite of DynoPay's user-facing copy to turn more visitors into
signed-up, integrated merchants. Same pages and layout — sharper words, clearer promise, stronger proof.

## Who it's for
- Primary: crypto-native businesses and developers evaluating a payments provider, whose
  next step is to sign up and start integrating the API.
- Secondary: mainstream businesses/SMBs newer to crypto, who need plain-English reassurance
  (no custody, no chargebacks, settle to what they want) before they trust it.
- The payers who land on a merchant's checkout (addressed in a later phase).

## Core features and experience
This is a copy initiative, not a redesign. Every page keeps its current structure, images,
and components; only the text changes — headlines, subheads, body, button labels, in-context
microcopy, and the page titles/descriptions that affect click-through.

The rewrite follows a consistent conversion method on every page:
- **One goal per page.** Each page drives a single primary action (sign up / start building),
  with secondary links kept visually and verbally subordinate.
- **Problem → Promise → Proof → Path.** Name the merchant's pain, state the payoff, back it
  with real proof, then point to the obvious next step.
- **A value-proposition stack that reads in under five seconds:** headline + a one–two line
  benefit subhead + a single dominant call-to-action + one micro trust cue.
- **Verb-led, intent-matched CTAs** — e.g. "Start free" / "Get API keys" / "Start building"
  for developer intent, instead of vague labels.
- **Trust cues in the decision zone.** Security, non-custodial, uptime and coverage proof sit
  next to the CTA and signup form, not buried in the footer.
- **Objection handling.** The copy pre-answers the questions that stall a signup (fees,
  custody/security, settlement, chargebacks, volatility, going live).
- **Specificity over fluff.** Concrete numbers, assets, chains and timeframes replace generic
  marketing claims; filler is cut.

Directional examples (final wording refined during the build, not locked here):
- Hero headline today: "Accept crypto payments. Get paid your way." →
  direction: keep the plain promise but tighten the subhead around the three decisive
  differentiators (40+ assets, auto-settlement to the currency/wallet of choice, non-custodial
  with no chargebacks) and add a one-line micro trust cue beside the CTA.
- Developer surface: lead with "Start building in minutes" energy — get-API-keys CTA,
  a credible 3-step integration framing, and proof aimed at technical buyers.
- Proof: keep and foreground the existing metrics (payments settled, uptime, countries served)
  rather than generic testimonials.

## User flow
The copy guides each visitor along one path:
1. Land on a marketing page (home, pricing, product, developers, resources).
2. Within five seconds understand what DynoPay does, who it's for, and why it's trustworthy.
3. Have the top objection answered in-line (fees / custody / settlement / chargebacks).
4. See proof positioned next to the decision point.
5. Click the single primary CTA → sign up → (developer path) get API keys and start integrating.

Later phases extend the same discipline into the signup/onboarding funnel and the payer-facing
checkout so momentum isn't lost after the click.

## UI/UX feel
Clear, trustworthy, plain-English. Confident but not hypey; precise enough to earn a
developer's trust while staying readable for a business owner new to crypto. Short sentences,
concrete nouns, active voice. The DynoPay name and existing brand terminology stay consistent.
No layout, color, or component changes — the page should feel the same, just read sharper.

## Implementation phases

### Phase 1 — MVP (built now): the marketing/landing surface
Rewrite the copy on the public marketing pages — home (hero, how-it-works, proof, features,
supported assets, pricing teaser, developer teaser, final CTA), pricing, product pages,
developers page, and the resources/marketing pages. Apply the method above, keep and
foreground the real proof points, sharpen all CTAs and trust microcopy, and update the page
titles/descriptions that affect click-through. English is rewritten as the source of truth and
the new copy is propagated to every currently supported language.

### Phase 2 — the acquisition funnel
Rewrite signup, login, and the get-started / onboarding wizard copy, plus verification steps
and key in-app empty-state nudges — reducing friction, reassuring at each step, and keeping
forward momentum from click to activated account. Propagated to all languages.

### Phase 3 — payer-facing checkout + in-app microcopy
Rewrite the checkout/payment pages payers see and the remaining in-app system microcopy
(confirmations, errors, status messages) to reduce payer drop-off and support merchant trust.
Propagated to all languages.

## Assumptions
- Phase 1 covers only the public marketing pages. The signup/onboarding funnel is Phase 2 and
  the payer checkout + in-app microcopy is Phase 3 — so all four surface areas you selected are
  covered, staged by conversion impact with landing first.
- Primary conversion target is crypto-native businesses/developers; the #1 action is sign up
  and start integrating the API. Mainstream businesses are addressed as a secondary audience
  through plain-English reassurance, not a separate page set.
- The existing proof points ("1,011+ payments settled", "99.93% uptime", "119 countries",
  "no chargebacks", "non-custodial") are accurate and approved for use; they will be kept and
  emphasized. If any are placeholders, they can be swapped for current numbers on request.
- No regulated or guaranteed-outcome claims will be introduced; "non-custodial" and
  "no chargebacks" framing is preserved as factual differentiators.
- English is the source of truth and the new copy is translated/propagated to all currently
  supported languages within each phase; brand names and legal terms stay consistent across
  locales.
- Pages, routes, layout, components, and visuals are unchanged — this is a text-only change.
  No new pages are created. Page titles/meta descriptions may change for click-through, but
  URLs do not.
- This is a copy change only: no A/B-testing framework or new analytics instrumentation is
  added in these phases.
