# Responsive / §7 Follow-up Backlog (2026-08-23)

Deferred items from the §7 responsive acceptance sweep (blueprint: `UI_REDESIGN_BLUEPRINT_2026-08.md`).
The sweep itself was run and the 5 top layout defects were fixed + verified (testing agent
iteration_56 → iteration_57, 5/5 PASS). The items below were intentionally scoped as a dedicated
follow-up rather than rushed alongside the layout fixes, because they are cross-cutting changes on
live payment surfaces. None are blockers.

---

## ✅ DONE 2026-08-23g (verified iterations 59–61)
- **P1 Responsive Tables — DONE.** Shared `hooks/useTableCardView.ts` (single 768px breakpoint):
  transactions + pay-links swapped `useIsMobile("md")`→`useTableCardView()` (were showing cards at
  768; now tables ≥768, cards <768); invoices (`pages/invoices.tsx`) + customers
  (`Components/Page/Customers/index.tsx`) got NEW mobile card lists (testids
  invoices-card-list/invoice-card-<id>, customers-card-list/customer-card-<id>). No 390 clipping.
  Verified PASS all 4 pages × light/dark.
- **P1 Mobile Header 44px — DONE.** In-app header 40→48px (`Containers/Client/index.tsx`); hamburger,
  +New (`CreateNewButton`), bell (`NotificationsBell`), avatar (`UserMenu` UserTrigger), company-
  selector trigger all ≥44px; ThemeToggle already 44. Hid the decorative mobile wordmark <600px so
  the company name still fits.
- **Popover polish — DONE.** Company dropdown flush under trigger (mt 0.5), divider hidden <600 so the
  short name shows.
- **Multi-company switch + persistence — DONE + BUG FIXED.** Removed CompanySelector's auto-select-
  first effect that raced CompanyDataContext and clobbered the persisted company to the newest on every
  load; CompanyDataContext is now the sole owner of default selection. Removed 2 duplicate
  last-company PUTs (now exactly one per switch). Verified persistence holds both directions.
  NOTE: a temp company **QA-DELETE-ME (id 55)** was created on the LIVE prod DB to test switching —
  the user intends to delete it.
- Also fixed: `📄` emoji → MUI icon in invoices empty state; `<h6>`-in-`<h2>` DOM warning in the
  Customers detail dialog; removed orphaned imports.

### Still open (lower priority)
- **transactions sticky first/ID column** (custom flex table — not converted; horizontal scroll works).
- Scroll-affordance fade on `/settings` rail + `/transactions` chip row. Landing hero right-edge bleed.
- Bottom-tab tab set. Recharts `width(-1)` console warning on dashboard. Invoice-preview drawer:
  Esc-to-close + PDF loading state (pre-existing drawer).

---

## P1 — Responsive Tables (shared table→card primitive) — ✅ DONE (see above)
Build **one** shared table→card primitive so **transactions, pay-links, invoices and customers**
all behave correctly on tablets and phones.

Current state / why it matters:
- **Customers/Invoices** already drop columns on mobile, but the remaining columns still overflow a
  phone width — they're horizontally *scrollable* but **not cards**. This is a §4.2 spec gap (lower
  severity than silent clipping, since content is reachable via scroll).
- **transactions / pay-links** currently show **cards at 768** where the spec wants tables ≥768.
- **transactions** ID/first column is **not sticky**, so rows become unidentifiable when scrolling.

Target behavior (§4.2):
- `≥768`: stays a **table** with horizontal-scroll affordance + **sticky first/ID column** (never
  silently hide columns).
- `≤640/390`: becomes a **card list**.

Note: this is a substantial, cross-cutting refactor on **live payment tables** — do it as its own
pass with a single shared primitive, with careful before/after QA. Do not bundle with unrelated
layout tweaks.

## P1 — Mobile Header Height (44px tap targets)
Raise the mobile in-app header height a touch so the top-bar buttons (+ New, notifications bell,
etc.) comfortably hit the **≥44px** tap-target minimum at `≤1024`.

Why deferred: header controls are currently constrained by the **40px** mobile header height
(`Containers/Client/index.tsx`), so a spot `minHeight` bump can't reach 44px without overflowing the
header. Needs a header-height decision, not a per-button patch.

## P2 — Scroll Hints (edge-fade affordance)
Add a **soft edge-fade** (or subtle arrows) on horizontally-scrollable strips so users know there's
more to swipe:
- `/settings` tab rail (overflowX:auto, no affordance at 390/768).
- `/transactions` source/filter **chip row** (overflowX:auto, no affordance at 768).
Both are scrollable today (not clipped) — this is a discoverability/affordance improvement.

## P2 — Testid Coverage (dashboard quick-actions)
Give the **dashboard quick-action buttons** stable `data-testid`s (e.g.
`dashboard-quick-action-transactions`) so future responsive/geometry checks can assert them by
selector instead of matching by visible text.

## P3 — Misc polish (observed, low severity)
- Landing **hero image** right-edge bleed at some widths (crop/contain).
- Phone **bottom tab bar** tab set vs the intended Dashboard / Payments / Wallet / More.
- Nice-to-have: centralise the **768/1024 rail band** and the **1360 landing breakpoint** into
  shared tokens/constants (avoids the off-by-one regressing; the 1360 media query is currently
  duplicated across two styled components).

---

### Already fixed & verified in the 2026-08-23e sweep (for reference)
1. 1024 off-by-one breakpoint (`isTabletRail` 1023.95→1024px) — icon rail at 1024 + dashboard
   right-column clip.
2. 390 in-app header avatar clip — CompanySelector wrapper `flex:'1 1 auto'`, `minWidth:0`,
   `overflow:hidden`.
3. Landing 1280 CTA clip — HomeHeader `LeftGroup` gap 72→36px + `StatusPillWrap` hidden <1360px.
4. `pages/payment/failed.tsx` 390 buttons — stacked full-width + `minHeight:44`.
5. Sidebar section-label dark contrast — `text.disabled`→`text.secondary` (3.67:1 → 6.91:1, WCAG AA).
