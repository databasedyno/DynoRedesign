# Dynopay — Create Flows Redesign & Discovery

A ground-up rework of how merchants discover and complete the four things they can create in Dynopay —
a payment link, a fundraiser, a product, and a creator page — plus honest, consistent messaging about how
funds settle. One obvious place to start, one clear path through each flow, and no capability left hidden.

## Who it's for
- Merchants who have signed up but can't find the right starting point for what they came to do —
  e.g. a fundraiser/nonprofit (like "Oasis Animal Protocol") who sees only "Payment link" and "Product"
  under "+ New" and can't tell how to launch the advertised fundraising campaign.
- Returning merchants who create regularly and want the fastest route to the type they use most.
- Merchants newer to crypto who need plain-language guidance on what each type does — and a truthful
  explanation of which coin they'll actually receive.

## Core features and experience
This initiative does not add new product capabilities. Fundraisers (goal, progress bar, donor wall,
supporter updates), the creator page, products, and the advanced payment-link options already exist.
The work makes them discoverable, makes each flow clear to complete, and corrects misleading messaging.

- **One Create hub.** A single entry point (reached from "+ New" and from the app's empty states/CTAs)
  that lists all four creatable types, each with an icon and a one-line "what it's for." Nothing is hidden
  behind a footnote. The list is ordered by what this account has created before, with a sensible default
  order for brand-new accounts, and the Creator page shown to everyone.
- **Quick vs. full options, made explicit.** For a payment link, both the fast path and the complete path
  (taxes, expiry, redirects, accepted coins, product shortcut) are clearly labeled and reachable — instead
  of the complete path being buried behind an "All options" link.
- **Fundraiser as a first-class flow.** Named up front, with its capabilities (funding goal, progress bar,
  donor wall, supporter updates, suggested amounts) visible, guided section by section, and previewed as
  the merchant builds it.
- **Every creation flow redesigned for clarity.** A consistent layout and section/step order across all
  four, plain-language labels and helper text that say what each flow is for, and a live preview of what
  the payer or visitor will see.
- **Honest settlement messaging.** Everywhere the product currently implies funds convert automatically,
  the wording is corrected: a merchant receives the coin that was paid *unless* they switch on auto-convert.
  The place to turn auto-convert on is easy to reach from these flows, and the public landing hero/FAQ is
  aligned to the same truth.
- **Post-creation clarity** (introduced in later phases): after making something, it is obvious where it
  lives and how to edit, share, and track it.

## User flow
1. A merchant wants to create something and opens the Create hub from "+ New" (or arrives at it from an
   empty state or call-to-action).
2. They see all four options with plain descriptions, ordered by their own usage, and pick one — a
   fundraiser/nonprofit immediately finds "Fundraiser."
3. They enter a redesigned flow that states what it's for, offers a quick path and a full-options path,
   and previews the result as they go.
4. They complete creation; the settlement wording makes clear which coin they'll receive and how to switch
   on auto-convert if they want fiat/stablecoin settlement.
5. On return visits, the hub surfaces their most-used type first.

## UI/UX feel
Calm, guided, plain-English, and consistent with the current dark-first brand. One obvious next step at
each point; capabilities are named rather than hidden; confident but honest — no implied guarantee that
payments convert on their own. The four flows share one visual language, so learning one teaches the rest.

## Implementation phases

### Phase 1 — MVP (built now)
The Create hub plus the **Payment link** and **Fundraiser** flows reimagined: the hub lists all four types
(ordered by prior usage, Creator page visible to all), the quick-vs-full-options distinction is made
explicit, and the Fundraiser becomes a clearly named, self-explanatory, previewed flow. Includes the
settlement/auto-convert clarity fix across the app and the landing hero/FAQ, and routes the relevant empty
states and CTAs into the hub. New/changed copy is written in English and propagated to supported languages.

### Phase 2 — Product and Creator page
Reimagine the **Product** creation flow and the **Creator page** ("your page") setup/edit experience with
the same clarity, and integrate both fully into the hub. Make the Creator page discoverable and claimable
for every merchant. Add post-creation clarity: where each item lives, and how to edit, share, and track it.

### Phase 3 — Consistency, education, and propagation
Cross-flow consistency polish, deeper in-context tips and education, refined usage-based ordering and
recommendations, mobile/responsive refinement, and full propagation of all new copy to every currently
supported language.

## Assumptions
- Scope is the four creation types only — Payment link, Fundraiser, Product, Creator page. Storefront/Store,
  Invoice/Receipt, Developer/API keys, and SafeDeal/Escrow are out of scope for this initiative.
- No new capabilities are added; the fundraiser, creator page, and advanced link options already exist.
  This makes them discoverable and easier to complete and corrects the messaging around them.
- The Create hub replaces the current two-item "+ New" menu as the single create entry point across the app.
- "Ordered by what the account has used before" means the hub ranks the four types by this account's own
  creation history; new accounts see a sensible default order with all four visible.
- The Creator page is shown to every merchant as a clearly optional action, regardless of signup type.
- Settlement wording is corrected to state that auto-convert is opt-in; no regulated or guaranteed-outcome
  claims are introduced, and "non-custodial" / "no chargebacks" remain as factual differentiators.
- This corrects the same landing hero/FAQ auto-convert wording touched by the earlier copy work; the two
  are kept consistent.
- English is the source of truth; new/changed copy is propagated to all currently supported languages within
  each phase, with full propagation completed in Phase 3.
- Routes and URLs for created items do not change — this reworks entry points, flow layout, and copy, not the
  underlying links or stored data.
- The visual language stays within the current brand (dark-first, left-aligned, hairline style); no color or
  brand overhaul is part of this work.
