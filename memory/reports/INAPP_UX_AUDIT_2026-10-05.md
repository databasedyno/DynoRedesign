# In-app UX audit + Payment Links polish test — 2026-10-05

Scope: (A) test the recently polished Payment Links list (`/pay-links`, commit 0e575fa16 — spacing only, never
browser-verified); (B) audit every other signed-in page for clutter / roughness and rank what to improve.
Method: testing_agent run (iteration_265, frontend only, READ-ONLY on the live prod DB) + main-agent screenshot
sweep of 15 in-app pages at 1920×800 (top + scrolled) and 390×844 mobile, plus DOM "clutter metrics"
(`scripts/qa/inapp_audit_metrics.js`: interactive elements, distinct font sizes, bordered boxes, banners, clipped text).
Screenshots: `/app/test_reports/inapp_audit_2026-10-05/` (19 files). Account: merchant user 1 / company 1 "The Dev Store".
NOTE: the audit browser had fresh localStorage, so every one-time "page tip" banner was visible (see X1).
NO CODE WAS CHANGED in this session.

---------------------------------------------------------------------------------------------------------
## A. Payment Links (`/pay-links`) — test result

### What works (15/15 functional flows PASS, 0 console errors, 0 failed API calls)
- Polish is live: rows are a uniform 64 px (desktop) even with 2-line cells (donation progress, created+expiry);
  no page-level horizontal overflow at 1920/1440/1366/1280/1024/390/360.
- Links / Orders segment (43 / 9) and status filter counts match the API (52 links: 12 active, 14 paid, 26 expired).
- Search (by description + ID), date range picker, pagination (prev disabled on page 1), rows-per-page.
- Detail drawer (480 px, sticky footer visible at 1366×768, Esc closes), copy toast, share, QR popover, ⋯ menu.
- Bulk selection bar + "Export CSV" (correct header + rows) + "Copy links" + Clear.
- Dark mode readable; phone card layout renders 10 cards.

### ❌ HIGH — Status / "Last 30 days" hidden under the sticky Actions column at ≤ 1440 px (regression)
- At 1440 the table needs ~1354 px but the content area is 1134 px. The table scrolls sideways inside its card and the
  opaque sticky ACTIONS column sits on top of the overflow → header reads "STAT", badges read "Ac / Pa / Ex",
  LAST 30 DAYS is invisible. At 1280 even CREATED is cut ("Oct 04,"). The scroll-hint shadow is too faint to notice.
  Only 1920-wide screens are unaffected. Screens: `1440_light.jpeg`, `1440_dark.jpeg`, `1280_light.jpeg`.
- Root cause: column natural widths (ID 90 + Description 327 + USD 120 + Coins 169 + Created 184 + Status 108 +
  Last-30 156 + Actions 200). The polish added +12 px horizontal padding to every cell (≈ +96 px) — but even the
  pre-polish table (~1258 px) did not fit 1440, so simply reverting the padding does NOT fix it.
- Code: `Components/Page/Payment-link/PaymentLinksTable.tsx` (table `width:max-content` L652, sticky actions L685-705 /
  L823-845, status cell L796-819, last-30 cell L821), `styled.tsx` TableBodyCell padding L80-98.
- Fix options (needs a layout decision):
  1. RECOMMENDED — "fit at 1440, keep everything": stack the 30-day activity as a 2nd line under Status (same pattern
     already used for Created + Expiry; `Last30Cell` already has a `compact` mode), shorten the coins chip in the table
     to "All 14 coins" (full list stays in the tooltip/drawer), cap Description at ~240 px with ellipsis (full text on
     hover), 14 px gutters (still roomier than the original 10 px; vertical rhythm kept). Est. ~1100 px → fits 1440.
  2. "Fewer buttons": also drop the per-row "View" eye (row click already opens the drawer) → fits 1366 too.
  3. Minimal: keep the layout, make the scroll edge-shadow obvious + add a sideways-scroll hint (still scrolls at 1440).

### Other Payment Links findings
| Sev | Finding | Pointer |
|---|---|---|
| MED | Donation row #704 shows "0.00 EUR" under a column titled "USD VALUE" (other rows "$50.00 USD") | PaymentLinksTable L783 (`row.usdValue`) |
| MED | Actions column ragged: active rows 4 buttons, expired rows 2 — centered, so no common right edge | L846-853 `justifyContent:center` |
| MED | Filter controls not all 42 px after the polish: Links/Orders segment + date trigger still 40 px; date text 15 px vs 13 px elsewhere | PaymentLinksTopBar L136, Transactions/styled.tsx L698 (shared) |
| LOW | "Accepts all 14 coins" green chip repeated on every row (noise, 169 px) | LinkCoinsBadge.tsx L69 |
| LOW | Status select text is gold while the date trigger is dark; search "button" next to the field is decorative (aria-hidden, pointer-events none) but looks clickable | PaymentLinksTopBar L201, L251 |
| LOW | Phone cards: created date wraps to 4 lines beside up to 6 action buttons incl. a red delete; filter text is 10 px | PaymentLinksTable mobile branch; TopBar `inputSx` fontSize |
| LOW | 1024 px tablets get the full desktop table with sideways scroll (no compact set) | `useTableCardView` breakpoint |

---------------------------------------------------------------------------------------------------------
## B. Other in-app pages — ranked by clutter (worst first)

DOM metrics (1920 wide): `int` = interactive elements in content, `fs` = distinct font sizes, `box` = bordered cards,
`len` = scroll length in px.

| # | Page (route) | int | fs | box | len | Verdict |
|---|---|---|---|---|---|---|
| 1 | Payout addresses (`/wallet`) | **106** | 11 | 20 | 2377 | Most cluttered page |
| 2 | Your page / Storefront (`/storefront`) | 55 | **16** | **32** | **4874** | Longest, densest editor |
| 3 | Refer & earn (`/referrals`) | 11 | 13 | 20 | 2538 | Repetitive, zero-state heavy |
| 4 | Transactions (`/transactions`) | 39 | 9 | 2 | 1022 | Filter overload before data |
| 5 | Developers (`/developer-keys`) | 33 | 12 | 14 | 2385 | Busy key cards, layout holes |
| 6 | Notifications (`/notifications`) | 50 | 7 | 22 | 2789 | Card-per-item feed |
| 7 | Customers (`/customers`) | 11 | 9 | 3 | 1468 | Confusing data mix |
| 8 | Settings (`/settings`) | 27 | 10 | 4 | 1464 | Duplicated sections |
| 9 | Receipts & Tax (`/invoices`) | 17 | 8 | 5 | 1592 | Mostly fine, contrast issue |
| 10 | Payouts (`/payouts`) | 31 | 13 | 9 | 2086 | Dead rows |
| 11 | Dashboard (`/dashboard`) | 24 | 12 | 7 | 1669 | Good; small polish |
| 12 | Help & Support (`/help-support`) | 15 | 8 | 10 | 899 | Fine |
| 13 | Brands (`/brands`) | 11 | 8 | 5 | 805 | Clean — no action |

### 1. Payout addresses — HIGH
- 15 coin cards × 6 controls (eye, copy, "View Transactions", edit, delete + address field) = 90 buttons; a different
  coloured top border per chain (rainbow), "Format OK" + "Used on N networks" chips on every card, 15 identical gold
  "View Transactions" buttons → no visual hierarchy.
- Header has 3 buttons (Security, Manage payout addresses, Add payout address) + tip banner + hero + protection strip
  before the first address.
- Formatting bug: "$1,962.4" next to "$16,414.97", "$0" instead of "$0.00" (`Components/Page/Wallet/index.tsx` L493/L525
  `formatNumberWithComma` without fixed decimals).
- Mobile: "Manage payout addresses" text overflows its button; stat tiles clip to "ACTIVE…", "SUPPOR…", "COVERA…".
- Recommend: compact list/table (Coin · masked address + copy · networks · total processed · last payout · ⋯ menu),
  one neutral accent, a single ✓ for format, merge Security + Manage into one menu.

### 2. Your page / Storefront — HIGH
- 4874 px editor (Page tab): theme, cover, accent colours, sections… 16 font sizes, 16 texts under 11 px.
- Sidebar says "Your page", page title says "Storefront".
- Products tab toolbar is rough: actions float top-right of an otherwise empty card, grey-filled search box (every
  other search is white + hairline), "Status" floating label sits on the card edge, 5 unlabeled icon actions per product.
- Funnel shows Views 5 → Checkouts 8 (more checkouts than views) with "0.0%" — reads like a bug.
- A third primary-button colour appears here (dark gold "Edit page").
- Recommend: collapsible editor sections with a sticky save bar, align the name, rebuild the Products toolbar to the
  shared table-toolbar pattern, put product actions behind a labeled ⋯ menu.

### 3. Refer & earn — MED-HIGH
- $0.00 repeated in three overlapping cards (Total earnings; Earnings breakdown Credited/Pending/Withdrawn;
  Revenue share Available/Accrued/Paid out/Active windows) + 4 zero stat tiles.
- 4 yellow primary buttons + brand-coloured WhatsApp/Telegram/X buttons; "How it works" + two big coloured
  "You get / They get" panels always shown.
- Recommend: one "Your link" hero + one "Earnings" card; collapse "How it works" after the first share; when there
  are 0 referrals show a single empty state instead of ~10 zero values.

### 4. Transactions — MED-HIGH
- Tip banner + 3 filter rows (source pills, search + separate search button, period pills, payout-address select,
  status tabs, "Export settled only", Export) ≈ 230 px before the first row.
- "All payout add…" select is truncated. VAT / TAX column is "—" on every row.
- Mobile: crypto amount truncated ("0.00022996 B…") — never acceptable on a money screen; period pills run off-screen.
- Recommend: one toolbar row (search · period · "Filters" popover for source/address · Export); hide the VAT column
  when the page has no tax; never truncate amounts (wrap the unit instead).

### 5. Developers — MED
- Live + Test key cards sit in a 3-column grid → empty third slot; small gold outlined Regenerate/Disable buttons with
  "Created on Sep 16, 2026 at 21:25" wrapping beside them; three badge styles ("LIVE" filled, "Active" check,
  "Auto-Created · Sandbox" orange text).
- Recommend: keys as a table (env · key · currency · last used · created · ⋯), one badge style.

### 6. Notifications — MED
- Every notification is its own bordered card (22 cards, 2789 px); subtitle "Manage how you receive updates…" describes
  settings, not the inbox; "Inbox | Settings" toggle is yet another tab style.
- Recommend: one list container with hairline dividers and denser rows; fix the subtitle.

### 7. Customers — MED
- KPI says "12 customers", list says "16 customers"; subtitle "Everyone who has paid you" but the top rows are "Invited"
  people with 0 payments / $0.00 / — / —; aggregate buckets ("API payments — No contact details captured") mixed in with
  real people.
- Recommend: separate an "Unidentified payments" summary from the people list; default filter = paying customers.

### 8. Settings — MED
- Sub-nav has both "Profile & Security" and "Security"; the profile shows an "Add Phone" button AND a separate
  "Add Phone Number" card; read-only fields are heavy grey blocks.
- Recommend: rename to "Profile", one phone flow, lighter read-only styling (plain text + "Change" link).

### 9. Receipts & Tax — LOW-MED
- Gold month headers ("AUGUST 2026") on a cream band = poor contrast in light mode; VAT column all "—"; tab style
  (black pill) differs from other pages.

### 10. Payouts — LOW-MED
- "By payout address" lists 8+ greyed "No payouts yet / none in range" rows. Recommend "Show 8 inactive" collapse.

### 11. Dashboard — LOW (good page)
- "1 checkouts expired unpaid today" — missing plural forms (`langs/locales/en/dashboardLayout.json:800` `expiredToday`,
  also shown on Notifications).
- Section headings mix title case ("Recent transactions") and eyebrow caps ("TOP LINKS & PRODUCTS · 30 DAYS") on the same
  row; right column ends early leaving a large blank area.
- Mobile: cards are flush with the screen edge while text has a 16 px gutter; filter icon cut off at the right edge.

### 12-13. Help & Support, Brands — LOW / none
- Help: tip banner repeats what the search box below already says. Brands: clean.

---------------------------------------------------------------------------------------------------------
## C. Cross-cutting issues (fix once, improves every page)
- X1. One-time "page tip" banners on 14 pages (`Components/UX/PageTip`, rendered by `Containers/Client/index.tsx:367`,
  dismissal stored per browser in localStorage) → ~70 px desktop / ~120 px mobile on every page for every new
  device. Option: remember dismissal per account, or turn tips into an "ⓘ" next to the page title.
- X2. Pinned page title: content scrolls under the title with a hard cut and no divider (Dashboard chart axis sliced).
  Add a hairline/shadow on scroll, or let the title scroll away.
- X3. Five different "selected" styles: yellow pill (period pickers), black pill (Receipts / Developers / Storefront /
  Settings nav), dark-gold pill (Transactions source "All"), yellow rectangle (Notifications Inbox), outlined chip
  (Customers "All"). Standardise on one SegmentedControl + one Tabs component.
- X4. Button hierarchy diluted: bright-yellow primary, dark-gold filled primary ("Edit page"), and many gold-outlined
  secondaries ("View all", "Export", "View Transactions", "Regenerate", "Remove").
- X5. Dropdown values rendered in gold ("All Statuses", "All Time", "Most recent", "English", "USD") — reads like a link;
  other selects are dark.
- X6. Decorative gold search squares beside search inputs (Payment Links, Transactions, Help) look like buttons.
- X7. Type scale sprawl: 7-16 font sizes per page incl. half-pixels (11.5 / 12.5 / 13.5). Target ~6 steps.
- X8. Money formatting: "$1,962.4", "$0", "0.00 EUR" under a USD header, truncated crypto amounts on mobile.
- X9. Totals disagree across pages for the same brand: Customers revenue $34,075.29 · Receipts "Collected" $35,052.58 ·
  Payout addresses "Total processed" $34,055.30 · Dashboard tier $34,055. Either reconcile or label precisely
  (gross vs net vs settled) with a tooltip — this is a trust issue on a payments product.
- X10. Empty columns shown everywhere: VAT/TAX (Transactions), VAT (Receipts), Pays with / Last paid (Customers).
- X11. Naming mismatches between sidebar and page titles: "Your page" vs "Storefront", "Payouts" vs "Payouts &
  settlements", "Payout addresses" lives at `/wallet`.

---------------------------------------------------------------------------------------------------------
## D. Suggested order of work
1. Payment Links regression fix (option 1 above) + its MED items (EUR label, action alignment, control heights).
2. Quick wins, low risk: plural forms (X-Dashboard), money formatting (X8), mobile clipping (Transactions amounts,
   Payout-address buttons/labels, Dashboard gutters).
3. System consistency pass: one tab/segment style (X3), select text colour (X5), search icon inside field (X6),
   button hierarchy (X4), tip-banner behaviour (X1), scroll divider (X2).
4. Page redesigns, worst first: Payout addresses → Storefront editor/Products → Referrals → Transactions toolbar →
   Notifications list → Developers keys table → Customers / Settings clean-ups.
