# Escrow experience — design polish (end to end)

## Why
The escrow feature works but doesn't yet feel native to DynoPay:
- Coins are shown as plain text with no currency icons (create dialog, coin pickers, settlement).
- The escrow header uses a generic "handshake" glyph instead of the DynoPay brand logo.
- The create form and the deal/invite screens read as functional rather than polished.

This is a presentation pass across all three escrow surfaces — merchant dashboard, deal detail, and the public (account‑less) invite page. No changes to escrow rules, money movement, or the API. All money stays simulated (safe mode).

## What changes

### 1. Brand & logo consistency
- Replace the handshake icon in every escrow header/brand bar with the real DynoPay logo/mark (the same one used in the top navigation).
- Give all three surfaces one consistent header: DynoPay mark + an "Escrow" product label; the public invite page also keeps a "Secure escrow" trust cue.

### 2. Crypto currency icons everywhere coins appear
- Show a coin icon next to every coin/stablecoin: the "coins the buyer can pay with" selector, the funding‑coin picker, the payout/refund stablecoin pickers, and in deal detail (custody + settlement).
- Turn the "coins the buyer can pay with" control from a plain comma list into selectable icon chips so options are scannable at a glance.
- Where a coin has no available icon, show a neutral token badge with the ticker so nothing looks broken.

### 3. Create‑escrow dialog — clearer layout
- Reorganize into clean sections with stronger visual hierarchy.
- Present the two roles ("I'm the seller" / "I'm the buyer") as two clickable cards with a one‑line explanation each, instead of plain radio text.
- Add a persistent, **itemized** cost summary: deal amount, escrow fee, and the network / conversion / withdrawal estimates, then the total, who pays it, and the resulting "buyer pays" / "seller receives". (This also surfaces the fee detail the backend already calculates.)
- Improve the post‑create success panel: copy‑link, a QR code of the invite link, and a clear "invitation sent" confirmation.

### 4. Deal detail (merchant) & public invite — progress + clarity
- Add a horizontal progress tracker for the escrow lifecycle (Invited → Accepted → Funded → Delivered → Released / Settled, with dispute, refund and split branches indicated).
- Show amounts and settlement as clean cards with coin icons and obvious "in custody / released / refunded" states.
- Rework the public invite page into a mobile‑first, trust‑building layout: brand header, progress tracker, itemized costs, coin icons, and a clearer "verify → act" sequence.

### 5. Cashout stablecoin choice
- Let the party being paid choose their cashout stablecoin + network — USDT on Tron / Ethereum / Polygon, and USDC on Ethereum / Polygon — each shown with its icon, and reflect the matching withdrawal‑fee estimate in the totals.

### 6. Consistency & states
- Consistent status colors/legend, empty states, loading placeholders, and dark‑mode parity across all three surfaces.

## Assumptions (change these if wrong)
- Stay inside the current DynoPay look (indigo, existing component style) — this is polish, not a new visual identity.
- Reuse the coin icons already used elsewhere in the product for brand consistency; neutral ticker badge as fallback. No new paid service or keys required.
- The create flow stays a single modal (with a sticky summary), not a full‑page multi‑step wizard.
- Include a QR code on the invite share panel.
- Copy stays in English; no new translation scope in this pass.

## Out of scope
- Escrow business logic, state machine, fee math, and the API contract stay as they are.
- No live on‑chain settlement is enabled; money remains simulated.
