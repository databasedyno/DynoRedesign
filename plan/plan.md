# DynoPay — UI/UX Reimagining for Clarity, Simplicity & Usability
### Desktop · Tablet · Mobile — recommendation for approval

---

## Where the UI stands today (why this plan looks the way it does)

A full visual redesign ("Quiet Money": one indigo accent, 3 typefaces, dot-status, hairline
cards, slimmed header, tablet icon-rail, mobile bottom tabs) already shipped across the app,
checkout and marketing. Two information-architecture cleanups also shipped. The app scores
well visually — what still hurts day-to-day usability is **structure**: inconsistent
table behavior across screen sizes, page-hopping to do simple tasks, a sale being split
across three different screens, and a handful of known mobile/tablet rough edges that were
deliberately parked during the visual push.

**This plan is therefore NOT a re-skin.** It is a usability restructuring in 6 moves,
ordered by impact. Nothing that already shipped gets redone.

---

## The 6 moves

### 1. One responsive rulebook for every list (the single biggest win)
Today each data page behaves differently as the screen shrinks: Transactions and Pay-links
collapse into cards already at tablet size (wasting a 768–1024px canvas), while Invoices and
Customers stay as cramped side-scrolling tables even on a 390px phone. There is no consistent
rule, so nothing feels predictable.

**Proposed rule, applied to Transactions, Pay-links, Invoices, Customers, Wallet:**
- **Desktop & tablet (≥768px):** always a real table. If columns don't fit: the first
  (identifying) column stays pinned, the rest scroll sideways with a visible fade hint —
  columns are never silently hidden. Least-important columns (e.g. VAT, exact timestamps)
  drop first, in a defined order.
- **Mobile (<768px):** always a card list — one card per row: who/what + status dot on
  line 1, money (right-aligned) on line 2, relative time on line 3. Tap opens the detail.
- Every row/tap target is at least 44px tall on touch devices, including the header
  buttons (the mobile header grows slightly, from 40px to 48px, to make this possible).

### 2. Stay in context: side-panels instead of page-hops and pop-ups
Creating a payment link currently navigates away to a separate page and ends in a pop-up;
adding a wallet and editing company details open modal windows that hide the list behind
them. Every one of these breaks the user's place.

**Proposed:** creation and editing happen in a **right-side panel** that slides over the
list (full-screen sheet on mobile). Create a pay-link → panel with a live preview, and the
success state (copy link + QR + share) appears inside the same panel — no navigation, no
pop-up. Same pattern for add-wallet and quick product edits. The existing full-page link
creator stays reachable for the complex cases (taxes, expiry, redirects) via an
"all options" link in the panel.

### 3. One story per sale (kill the three-screens problem)
A single product sale currently appears as fragments in three places: the payment link, an
"order", and a transaction. Merchants must mentally join them.

**Proposed:** retire the separate orders screen. Product sales appear inline on
Transactions (with a "product" label) and per-link performance (payments, revenue,
conversion) shows on each pay-link row. Clicking any of them opens one unified detail
panel showing the full story: link → buyer → payment → on-chain confirmation → settlement.
Old order URLs quietly redirect so nothing breaks.

### 4. Jump anywhere: global search (⌘K / search icon)
The app has ~15 sections; today the only wayfinding is the sidebar. **Proposed:** a search
field in the header (⌘K on desktop, magnifier icon on mobile) that finds pages
("settings", "webhooks"), actions ("create payment link"), and records (transaction IDs,
customer emails, link names). This is the single fastest usability upgrade for power users
and rescues lost new users; it's a standard in Stripe/Linear-class products.

### 5. Mobile & tablet finishing pass (the parked items)
- Anything scrollable gets a visible hint (edge fade) — settings sections and filter rows
  currently scroll invisibly.
- Dashboard KPI cards on phones become a swipeable row instead of a tall stack.
- Time-range pickers (7D/30D/90D/1Y) become a single dropdown on phones.
- The mobile bottom tab set is confirmed as: **Home · Payments · Wallet · More**
  (Payments = pay-links + transactions; everything else lives under More).

### 6. Clarity microcopy (small, high-trust touches)
- Dashboard gets one plain-English line under the main number, e.g. "Busier than
  yesterday — 3 more payments, smaller average".
- Crypto statuses (pending / confirming / settled / converted) get one-line tooltips —
  first-time merchants find these terms confusing.
- One consistent name for the public creator page everywhere (today it's called "Your
  page" in one place and "creator" in another). Proposed winning name: **"Your page"**.

---

## Explicitly NOT in this plan (already good, or deliberately excluded)

- No new color scheme, fonts, or component styling — the shipped design system stays.
- The buyer checkout (/pay) is already best-in-class and handles real money on the live
  database — untouched except: it inherits nothing from this plan. (A separate, optional
  follow-up could add wallet-app deep-links on mobile; excluded here to keep risk low.)
- Onboarding flow, auth screens, landing/marketing pages — recently rebuilt, untouched.
- Admin pages — out of scope.
- All 6 languages are preserved; new labels get translated into all of them.

---

## Decisions needed from you

1. **Default theme.** The design system was built light-first (reads "bank", not "trading
   terminal"), but the app still defaults to dark. Flip the default to light for everyone
   (existing users' saved preference is honored), or keep dark?
   a. Flip to light (recommended — matches Coinbase/Stripe trust posture)
   b. Keep dark default
2. **Side-panel link creation (move 2).** OK to make the panel the default way to create a
   pay-link, with the full page demoted to "all options"?
   a. Yes, panel-first (recommended)
   b. Keep the full page as default; panel only for quick-create
3. **Retiring the orders screen (move 3).** This removes a screen some users may know.
   a. Retire it with redirects (recommended)
   b. Keep it but also show sales inline (duplication stays)
4. **Scope/order.** Approve all 6 moves, or start with a subset? Recommended build order
   if phased: 1 → 2 → 4 → 3 → 5 → 6 (each is independently shippable and testable).

---

## Assumptions (will proceed on these unless you object)

- The preview runs against your **live production database**, so everything here is
  frontend/structural — no payment logic, no money-path code, and verification is
  read-only (no test payments, no record creation against real data).
- "Payments" as the umbrella term for pay-links + transactions in mobile navigation.
- Existing keyboard users are few, so ⌘K ships without a settings toggle.
- Old bookmarked URLs (orders, legacy routes) keep working via redirects.

---

## What you'll see when it's done

- Every list behaves identically on every device — tables that never hide data on
  desktop/tablet, clean tap-friendly cards on phones.
- Creating a link takes ~5 fewer seconds and never loses your place; link + QR + share
  appear right where you clicked.
- A sale is one object in one place, with its whole story on one panel.
- ⌘K jumps you anywhere in two keystrokes.
- Phones and tablets feel finished: nothing hidden, nothing cramped, everything tappable.
