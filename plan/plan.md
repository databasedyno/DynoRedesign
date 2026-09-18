# Brands overview page

## What this adds
A new page that lists every brand on the account in one view, each with a compact
stats summary, plus a one-click way to jump into a brand and manage it. Today the
only way to see a brand's numbers is to switch to it via the top brand selector and
read its dashboard one brand at a time. This page makes the whole portfolio visible
at a glance and turns "which brand needs me?" into a single screen.

## Who sees it
Every brand the logged-in user can access — the same list already shown in the top
brand switcher (brands they own, plus any they were added to as a team member).

## Layout

### Top: all-brands summary strip
A small row of combined totals across all the user's brands for the selected time range:
- Total settled volume
- Total payments
- Total pending / awaiting confirmation
- Total items needing attention (stuck payouts, failed conversions, config gaps)

### Below: one card per brand
Each brand shown as a card with:
- Brand logo + name + status (active / new-not-set-up)
- **Settled volume** in the selected range
- **Payments** count in the range
- **Pending** (money awaiting on-chain confirmation)
- **Needs attention** — a highlighted count when the brand has stuck/failed/config issues, muted "All clear" when none
- **Last activity** (e.g. "last payment 3h ago")
- A **Manage** button

New/empty brands (no payments yet) still appear, showing a "Finish setup" state instead
of zeros, so nothing is hidden.

### Time range
A range selector on the page (Today / 7D / 30D / 90D / 1Y / All), defaulting to **30 days**,
matching the range control used elsewhere in the app. Changing it updates the summary
strip and every brand card.

### Ordering
Brands are sorted by settled volume in the range (busiest first), with new/empty brands
listed last. Attention-flagged brands are visually marked wherever they sit.

### Finding a brand (only if the list is long)
A simple name search/filter appears above the cards when the account has many brands.

## The "Manage" action
Clicking **Manage** on a brand selects that brand as the active brand (the same selection
the top switcher controls) and opens that brand's **Dashboard**, so the user lands ready
to work in it. The brand's name is data-driven; the card itself is also clickable.

## How the page is reached
- A new left-nav item labelled **Brands**.
- An entry in the existing top brand switcher (e.g. "View all brands") that opens this page.

## Currency note
Brands can have different display currencies. For comparability, the summary strip and each
card show amounts converted to the account's display currency; a brand's own native currency
is not mixed into the combined totals.

## Out of scope (for this page)
- Editing brand settings inline (that stays in the existing brand settings screen; the card
  can deep-link there later if wanted).
- Creating a new brand (already handled by the existing "add brand" flow).
- Cross-brand exports/reports.

## Decisions to confirm or push back on
1. **The per-brand metrics** listed above (settled volume, payments, pending, needs-attention,
   last activity). If a different set matters more — e.g. completion rate, refunds, top coin,
   payout wallet coverage — say so; it changes what each card shows.
2. **What "Manage" does** — assumed to switch the active brand and open its Dashboard. Alternative:
   just switch context and stay on this page.
3. **Include new/empty brands** — assumed yes, shown with a "Finish setup" state. Alternative:
   hide brands with no activity.
4. **Default landing** — this page is added as an extra destination; the app still lands on the
   single-brand dashboard as it does today. It could instead become the default landing for
   accounts with more than one brand — not assumed, flag if wanted.
