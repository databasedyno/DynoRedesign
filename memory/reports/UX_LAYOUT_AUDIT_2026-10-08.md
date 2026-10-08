# In-app UX audit — layout, hierarchy & usability across desktop, large screens, tablets, iOS & Android
**Date:** 2026-10-08 · **Scope:** merchant app (every signed-in page + the shell: sidebar / rail, top bar, page header,
banners & tips, phone bottom bar, hamburger drawer, "More" sheet, create hub, account menu, detail drawers, chat button, footer)
**Account:** owner `onarrival21@gmail.com` (user 1, brand "The Dev Store", 4 brands) — **read-only**: every non-GET API call was
answered by a local mock (only `track/attribution` + `track/onboarding` were attempted and blocked). **No product code was changed.**
Follows up `memory/reports/INAPP_UX_AUDIT_2026-10-05.md` (page-level clutter at 1920 + 390). This audit adds the shell,
the full device matrix, platform behaviour (Safari/WebKit + Android Chrome) and a target blueprint.

---------------------------------------------------------------------------------------------------------------------
## 0. TL;DR

**Overall:** desktop at 1440–1920 is in good shape: calm shell, consistent sidebar, compact tables. Most problems live at the
**edges of the size range** (phones, the 768–1194 tablet band, ultra-wide) and in the **shell components that only exist on
touch devices**. The ten things that matter most:

| # | Sev | Finding | Where |
|---|---|---|---|
| 1 | **CRITICAL** | **Money amounts lose their leading digits** in the Transactions table: "170.10 USDT-ERC20" shows as "‖70.10" (1280) or ".10 USDT-ERC20" (1024). On a payments product this is a trust bug. | desktop 1280, iPad 768–1194 |
| 2 | **HIGH** | The phone **"More" sheet is broken on every phone width (360–440)**. Items are clipped on both edges ("me", "page", "Custo…", "Chat wit…") and labels run together ("ReferralsNotificationsSettings"). The Language icon renders as a black disc and "Chat with support" as an empty circle. | all phones |
| 3 | **HIGH** | **Three competing phone navs**: the hamburger drawer, the bottom bar and the "More" sheet. Each has a different item set, order and labels. | all phones |
| 4 | **HIGH** | **Tablet band breaks:** the Transactions header wraps and columns are cut (768/834); the brand cell is clipped to "Dy" (1024); the Payout-address row ⋯ actions are **off-screen** (1024/1194); the 72 px rail is icon-only on touch (no tooltips on touch); a 712 px Android tablet gets the phone UI. | iPad mini/Pro, Galaxy Tab |
| 5 | **HIGH** | **Cold-start blank dashboard**: "?" brand avatar, no brand name, no skeleton. The sidebar is missing 4 items until brand data arrives, then they pop in. | first load, any device |
| 6 | **HIGH** | **Settings → Security is 23,730 px tall.** It lists ~280 active sessions, each with a 23 px "Sign out" button. | all |
| 7 | **HIGH** | **Phones show only 54–67 % content at first paint.** Top bar 56 + pinned page header 81–165 + floating bottom bar 86 px. The first data row of Transactions / Payment links sits at 67–75 % of the screen. | all phones |
| 8 | MED | **Page tips never retire.** 14 of 17 pages still show their tip to a long-time owner: ~150 px on phones, 200–293 characters per line at 1920/2560. | all |
| 9 | MED | **The sidebar does not fit ≤ 840 px-tall screens** (1280×800, iPad Pro landscape): "Help & Support" is hidden with no scroll cue. Nav rows are `div role="link"`, so there's no ⌘/middle-click/long-press "open in new tab". | laptops, tablets |
| 10 | MED | **Android / iOS back gesture leaves the page** instead of closing the open drawer, sheet or dialog (no history entries). In the installed PWA there is no browser back at all. | Android, iOS PWA |

**Recommended direction (detail in §8):** one navigation IA rendered three ways:
- **Phones:** solid bottom tab bar plus a bottom-sheet "More"; drop the hamburger.
- **Touch tablets:** a labelled navigation rail; content-driven table→card switching.
- **Desktop:** today's sidebar, made height-aware, with a utility footer.

Plus, on every page:
- a collapsible "large title" page header on phones;
- tips moved behind an ⓘ;
- bottom sheets for every phone overlay, with back-gesture support;
- one breakpoint token set driven by width **and** pointer type.

---------------------------------------------------------------------------------------------------------------------
## 1. Method

- **Harness:** `scripts/qa/ux_layout_audit.mjs` (Playwright 1.63). For each device × route it captures:
  - a fold screenshot, a scrolled screenshot and, on phones, an end-of-page screenshot;
  - shell overlays;
  - a DOM metrics JSON (chrome budget, sidebar/column widths, clipped-right elements, horizontal scrollers, truncated text,
    font-size histogram, line length, tap targets < 24 / < 44 px with the MUI 44 px hit-area accounted for, inputs < 16 px,
    fixed elements, h1 / active nav, JS and API errors).
- **Aggregator:** `scripts/qa/ux_layout_audit_summary.py [--detail <page>] [--device <id>]`.
- **API routing:** API calls were re-targeted from `localhost:3000/api/*` to the local backend (`:8001`), avoiding Cloudflare.
  The data is real production data.
- **Output:** `test_reports/ux_layout_audit_2026-10-08/<device>/` (≈ 700 screenshots + `results*.json`); contact sheets in `_sheets/`.

| Class | Device profile | Engine | Viewport (CSS px) |
|---|---|---|---|
| Ultra-wide | desktop-2560 | Chromium | 2560×1440 |
| Large | desktop-1920 | Chromium | 1920×1080 |
| Laptop | desktop-1440 (+ dark) | Chromium | 1440×900 |
| Small laptop | desktop-1280 | Chromium | 1280×800 |
| Tablet landscape | iPad Pro 11 / iPad mini | **WebKit** (Safari engine) | 1194×834 / 1024×768 |
| Tablet portrait | iPad Pro 11 / iPad mini | **WebKit** | 834×1194 / 768×1024 |
| Android tablet | Galaxy Tab S4 | Chromium | 712×1138 |
| Large phone | iPhone 16 Pro Max | **WebKit** | 440×763 |
| Phone | iPhone 15 Pro (+ dark) | **WebKit** | 393×659 |
| Small phone | iPhone SE (3rd gen) | **WebKit** | 375×667 |
| Android phone | Pixel 8 / Galaxy S24 | Chromium | 412×839 / 360×780 |

**Routes (17 in-app):** /dashboard, /pay-links, /create-pay-link, /pay-links/products (→ /storefront?tab=products), /storefront,
/payouts, /transactions, /invoices, /wallet, /customers, /referrals, /settings, /developer-keys, /notifications, /help-support,
/brands, /kyc.
**Second pass:** Settings sections (security / company / payments / team / notifications), /wallet/security (→ settings),
/get-started, and the payment-link / transaction detail drawers.
**Excluded:** `/saved` and `/wallet-security` (public, token-based pages without the app shell).

**Caveats:**
- WebKit/Chromium **emulation**, not real devices. Safe areas, the on-screen keyboard, rubber-banding and the real Safari
  toolbar collapse are not reproduced; these items were reviewed in code instead.
- Load times under emulation are not product metrics.

---------------------------------------------------------------------------------------------------------------------
## 2. Device scorecard

`content %` is the share of the viewport left for page content at first paint, after the top bar, banners, the pinned page header
and the phone bottom bar (17-page average).

| Device | Nav model shown | content % | Main issues |
|---|---|---|---|
| 2560×1440 | sidebar 240 | **88** | content column centred (max 2040) while the top bar spans full width, so edges misalign; tables stretch ~2000 px with 10 rows (≈ 40 % of the screen empty); tip text 293 chars per line |
| 1920×1080 | sidebar 240 | 85 | tips ~200 chars per line; otherwise good |
| 1440×900 | sidebar 240 | 80 | good; chat button covers row ⋯ actions on Payout addresses; type scale sprawl |
| 1280×800 | sidebar 240 | 78 | **money clipping** in Transactions; Payment-links table still scrolls sideways (1071/974 px); Help & Support hidden at the bottom of the sidebar |
| iPad Pro 11 landscape 1194×834 | sidebar 240 (touch!) | 79 | **⋯ actions off-screen** (Payout addresses); amounts / headers truncated (24); 435 targets < 44 px with desktop density on touch; sidebar clipped at the bottom |
| iPad mini landscape 1024×768 | 72 px rail | 77 | **brand cell clipped to "Dy"**; ".10 USDT-ERC20"; rail hides Developers + Help; ⋯ actions off-screen |
| iPad Pro 11 portrait 834×1194 | 72 px rail | 89 | **Transactions table broken** (header on 2 lines, USD / Customer / Date cut); icon-only rail on touch; inputs 13–14 px |
| iPad mini portrait 768×1024 | 72 px rail | 87 | same table break; brand-switcher chevron floats far from the name; chat button covers "View all" |
| Galaxy Tab S4 712×1138 | **phone** bottom bar + hamburger | 80 | a 10-inch tablet gets the phone shell (cut-off is a hard 768 px); blank dashboard on cold start |
| iPhone 16 Pro Max 440×763 | bottom bar + hamburger | 69 | More sheet clipped; see phone findings |
| Pixel 8 412×839 | bottom bar + hamburger | 72 | More sheet clipped; account menu misaligned |
| iPhone 15 Pro 393×659 | bottom bar + hamburger | **64** | first Transactions row at ~75 % of the screen; bottom bar over forms |
| Galaxy S24 360×780 | bottom bar + hamburger | 69 | Create-link elements clipped on the right (2) |
| iPhone SE 375×667 | bottom bar + hamburger | **65** (Payout addresses **54**) | no payout address visible on the first screen; More sheet badly clipped |

---------------------------------------------------------------------------------------------------------------------
## 3. Shell findings (the frame around every page)

### 3.1 Desktop sidebar (≥ 1024 px, `Components/Layout/NewSidebar`)
- **Good:** the IA (Dashboard · Sell · Money · Grow · Settings), collapsible groups, neutral icons, the active group always open,
  the gold active pill, and the dark rail is calm.
- **S9 — does not fit short viewports.** 13 rows plus 4 group labels need ~800 px:
  - 1280×800 and 1194×834: "Help & Support" sits under the collapse bar;
  - 1024×768 rail: Developers + Help hidden;
  - `Menu` scrolls (`overflowY:auto`, styled.tsx L28) but there is no fade or scroll cue;
  - many Windows laptops (1366×768, ~650 px usable height) are affected.
- **S10 — not real links.** `MenuItem` is a `div role="link"` with `router.push` (index.tsx L232-249). As a result:
  - no ⌘/Ctrl-click or middle-click to open in a new tab;
  - no long-press "Open in new tab" on iPad;
  - no URL preview.
  The bottom-bar items are `role="button"`.
- **Reveal-on-relevance rows pop in** (Brands, Receipts & Tax, Customers, Developers) after `getCompany` resolves (~1.4 s), so the
  nav shifts under the cursor (§3.10).
- **No utility footer:** the bottom of the sidebar is only a collapse chevron. Status, Docs, Terms/Privacy and the app version
  are not reachable from inside the app (S21).

### 3.2 Tablet rail (768–1024 px, forced by `Containers/Client/index.tsx` L50)
- **S4d — icon-only on touch.** Labels exist only as hover tooltips (`Tooltip placement="right"`), which never show on touch.
  Twelve near-identical glyphs are guesswork.
- **S4b — brand cell clipped at 1024 px.** `LogoContainer` is hidden below `lg` (1024) but shown at exactly 1024, where the rail
  is forced. Its `data-rail` uses the user's manual preference (`sidebarCollapsed`), not the forced rail, so the 134 px wordmark
  renders inside a 72 px cell ("Dy").
  - Pointer: `NewHeader/index.tsx` L153 + `NewHeader/styled.tsx` L22-61.
  - Below 1024 the brand cell disappears and a separate wordmark is shown, so the top bar never aligns with the rail.
- **S4e — hard 768 px cut-off.** A 712 px Android tablet (Galaxy Tab S4, Tab S9 at 640) gets the phone shell. iPad Pro 11
  portrait (834) gets a rail but the desktop table.

### 3.3 Top bar (`Components/Layout/NewHeader`)
- **Desktop:** brand switcher · search · + New · bell · theme toggle · avatar. It is well aligned up to 1920.
- **S13 — ultra-wide misalignment.** At ≥ 2000 px the content column is capped (1720 / 2040) and centred, while the top bar
  spans the full width. The brand switcher and right-hand controls no longer line up with the content edges.
- **Duplication:**
  - The theme toggle appears both in the top bar and in the account menu.
  - "+ New" carries a dropdown chevron but opens a centred **modal** (expectation mismatch).
  - The bell is a link to /notifications with no preview popover.
- **Tablet (768–1023):**
  - the brand-switcher chevron is pushed ~260 px away from the name by a flex spacer;
  - a "?" placeholder avatar shows while brands load.
- **Phones:** hamburger · brand switcher · search · bell · avatar. The product logo disappears (fine), but the brand switcher has
  no chevron or affordance.

### 3.4 Page header (`Containers/Client/styled.tsx` `MainPageHeader`, position: sticky)
- **Good:** title + description + actions; a hairline/shadow appears on scroll (Oct 5 finding X2 fixed).
- **S7 — pinned on phones too.** It stays at 81–101 px (Payout addresses 145–165 px with its two buttons) for the entire scroll,
  i.e. 12–25 % of an iPhone screen permanently.
- Below 900 px, `PageHeader` switches to `justifyContent:start; gap:64px` (styled.tsx L12-21). Actions then drop under the
  description at an arbitrary offset.

### 3.5 Banners & page tips (`Components/UX/PageTip`, `pageTips.ts` — 14 routes)
- **S8 — tips never retire.** Dismissal is now account-wide (good), but tips only go away on an explicit "Got it". For this
  long-time owner, **14 of 17 pages** still open with a tip:
  - phones: 120–150 px, a 4–5 line card above the toolbar;
  - 1920 px: ~200 characters per line;
  - 2560 px: ~293 characters per line.
- The account-level banners (email verification, MFA soft banner, fee-free progress) were not active for this account. They stack
  above the page header and would push content further down.

### 3.6 Phone bottom bar + "More" sheet (`Components/Layout/MobileNavigationBar`)
- **The bar:** a floating 86 px pill (5 slots: Home · Sell · [+] · Money · More), yellow-tinted, over content.
  - The active state is a gold label only; icon circles stay white, so it is hard to read at a glance.
  - In dark mode the circles turn blue-grey (#2B2D3A-ish, off-palette).
  - It stays visible on create / edit forms and covers fields (Create Payment Link: the currency field sits under it).
- **S2 — "More" sheet broken everywhere.**
  - `SecondRow` is `display:flex; justifyContent:center; width:100%` **without wrapping** (styled.tsx L152-158), so the 5–7
    items per row overflow equally off both edges. On 360–440 px phones the first and last items are cut ("me", "page",
    "Custo…", "Chat wit… supp…") and labels collide.
  - Language shows a solid black disc (flag image).
  - "Chat with support" has **no icon**: the `chat` key has no case in the icon switch (index.tsx L577-585 falls through to
    `SidebarIcon name="chat"`).
  - The KYC / setup / wallet warnings are rendered *inside* the bar container (L621-665), so they appear at the bottom of the
    screen.
- **S3 — three navs on phones:**

  | | Hamburger drawer | Bottom bar | "More" sheet |
  |---|---|---|---|
  | Items | the full sidebar (incl. Brands, Balances & Settlement) + Appearance + account row | Home, Sell→/pay-links, +, Money→/payouts, More | Your page, Transactions, Receipts, Payout addresses, Customers, Developers, Referrals, **Notifications**, Settings, **Language**, Help, **Chat** |
  | Missing | Notifications, Language, Chat | — | Brands, Balances |

  Labels also differ: "Balances & Settlement" vs "Money"; "Refer & earn" vs "Referrals".
  - Mobile active matching uses `startsWith(path)` (L241-245), so "/wallet" also lights up on "/wallet-security".
  - **Drawer contrast:** the active row "Dashboard" is #FFD100 text on a pale-yellow pill (≈ 1.3:1).
  - **Drawer sizing:** the close button is 36×36, and the height is hard-coded `calc(100dvh - 138px)`.

### 3.7 Create hub (`NewHeader/CreateHub.tsx`)
- Clear content (Payment link · Fundraiser · Product · Creator page + settlement note).
- **On phones it is a centred modal**; it should be a bottom sheet (thumb reach, swipe-to-dismiss).
- **Contrast:** yellow text on white for "Full options: taxes, expiry, accepted coins" and the "Auto-convert settings" link
  (≈ 1.4:1).

### 3.8 Account menu (`Components/UI/UserMenu`)
- **S12 — layout:**
  - Rows mix `justifyContent:"center"` ("View my creator page", "Settings": L288-292, L319-323) with left-aligned rows, plus a
    stray vertical divider, so the column looks broken.
  - Hover is forced transparent, so there is no pointer feedback.
- **Placement:** the menu is an absolute box at `top:0; right:0`. It covers its own trigger and half of "+ New".
- **Missing content:** no email, plan or brand context, and no Help or Refer & earn. It holds the third copy of the theme toggle.

### 3.9 Chat button (`Components/Common/SupportChatWidget`)
- Docked into "More" on phones (good).
- **S17 — overlaps on ≥ 768 px.** The 56 px button sits over right-edge actions:
  - Dashboard "View all" (768);
  - Payout-address row ⋯ (1440);
  - notification delete icons.
  The auto-tuck heuristic does not trigger at these sizes.

### 3.10 Loading & first paint
- **S5 — blank cold start.** The first load in a fresh session showed:
  - only the greeting and an empty canvas;
  - the brand switcher with a "?" avatar and no name;
  - a 9-item sidebar instead of 13;
  - no skeletons.
- This came after `networkidle` (1280 desktop, Galaxy Tab). `/api/company/getCompany` alone takes ~1.4 s (remote DB) and the
  page waterfalls auth → profile → brands → data.

### 3.11 Footer
- There is **no in-app footer** on any device. That's fine for the canvas, but the utility links (status page, docs, legal,
  version / build, keyboard shortcuts) have no home inside the app (S21).

---------------------------------------------------------------------------------------------------------------------
## 4. Responsive system (breakpoints)

| Source | Values |
|---|---|
| MUI theme (`styles/theme.ts` L62-69) | xs 0 · sm 600 · md 900 · lg 1024 · xl 1600 |
| Shell: sidebar vs phone bar (`Containers/Client` L254, MobileNavigationBar wrapper L397) | hard-coded **768** |
| Shell: forced rail (`Containers/Client` L50) | **768–1024 inclusive** |
| Top-bar height 56 vs 64 (`useIsMobile("md")`) | **900** |
| Brand cell (`LogoContainer`) | **< lg (1024)** hidden |
| Table ↔ card lists (`hooks/useTableCardView`) | **768** |
| iOS no-zoom input rule (`globals.css` L122-127) | **max-width 768** |
| Content column max (`Containers/Client` L289-294) | 1440 → 1720 (≥ 2000) → 2040 (≥ 2400) |

Five different cut-offs (600 / 768 / 900 / 1024 / 1600) decide parts of the same frame, so the frame changes piecemeal:
- **768–899:** rail + 56 px top bar + phone paddings;
- **900–1023:** rail + 64 px top bar, no brand cell;
- **1024:** rail + clipped brand cell;
- **1025+:** full sidebar.

Nothing uses **pointer type** or **viewport height**, which is why touch iPads get hover-only labels and desktop density, and why
short laptops lose sidebar rows.

---------------------------------------------------------------------------------------------------------------------
## 5. Platform specifics

### iOS / iPadOS (Safari engine)
- **OK:** `viewport-fit=cover`; the body pads the top / left / right safe areas; the shell height is
  `calc(100dvh - env(safe-area-inset-top))`; the bottom bar pads `safe-area-inset-bottom`; `-webkit-tap-highlight` is off;
  pull-to-refresh is disabled in standalone mode; `maximum-scale=5` (zoom allowed).
- **S16 — iPad input zoom risk.** Inputs are 13–14 px at 810–1194 px on 10 of 17 pages (search fields, Create-link fields, profile
  names) because the 16 px rule only applies ≤ 768 px. Safari zooms on focus of < 16 px inputs when it uses the mobile layout. To
  be verified on a device, but the fix is cheap: scope the rule to `(pointer:coarse)`.
- **S11 — back gesture.** The iOS edge-swipe / back in standalone PWA mode cannot close drawers or sheets: no `pushState` /
  `popstate` handling exists anywhere.
- **Installed PWA:** `apple-mobile-web-app-capable` is set, but nested pages (settings sections, product edit) rely on the browser
  back button, which doesn't exist in standalone mode. In-app back affordances are needed for every nested view.

### Android (Chrome)
- **S11:** the system back gesture with the hamburger drawer, the More sheet, the Create hub or a detail drawer open navigates to
  the previous **page** instead of closing the overlay. This is the #1 expectation on Android.
- **S4e:** 600–767 px Android tablets and foldables (Galaxy Tab S9 640, Tab S4 712, Fold inner ~ 600–700) get the phone shell
  with an 86 px floating bar on a 10-inch screen.
- The on-screen keyboard plus the fixed bottom bar: the bar stays fixed above the keyboard on forms. Hide the bar while an input
  has focus.

---------------------------------------------------------------------------------------------------------------------
## 6. Page patterns (cross-page)

- **Lists / tables (Transactions, Payment links, Receipts, Customers, Payout addresses):**
  - **S1 — money clipping.** `TransactionsTableCell` is a flex box with `justifyContent:"flex-end"` + hidden overflow
    (`TransactionsTable.tsx` L926-940). Overflowing content spills out on the **left** and the leading digits are cut. It must
    never truncate an amount: use `justify-content: safe flex-end` / `margin-left:auto`, wrap the unit onto a second line, or
    give the column a content-based min-width.
  - **S4a — tablet tables.** 768–1023 renders the desktop table in ~700 px. The Transactions header wraps (Status under
    Transaction ID) and USD / Customer / Date fall off the right. Payment links already switches to a 2-column card grid at
    tablet width, so the card breakpoint is inconsistent between lists.
  - **S13 — large screens.** 10 rows by default at 1080–1440 px height leaves 30–40 % of the screen empty. Columns stretch to
    fill 2040 px, so the eye jumps ~1,500 px between Amount and Status.
  - **Phones:**
    - the amount unit wraps mid-token ("USDT-⏎ERC20");
    - invoice IDs are truncated ("INV-20260926-…");
    - **tapping a payment-link card's title area ticks its bulk-select checkbox** instead of opening the detail;
    - each card has 4 unlabeled icon actions.
- **Toolbars / filters (S15).** On phones Payment links stacks three filter rows in **three different control styles**:
  segmented Links/Orders, a pill "Period" dropdown with a divider, and an MUI outlined "All Statuses" select. Transactions has
  search + Filters, a period strip, a results card with export, and a tip before the first row.
- **Forms / create flows (S14):** on phones the bottom tab bar (incl. "+") overlays the form, there is no sticky primary action,
  and the first input (Value) appears at ~80 % of the screen under the type cards and the preview toggle.
- **Detail drawers:** desktop uses a 481 px right drawer (good); phones go full-screen. Back-gesture support is missing (S11).
- **Settings IA (S20):**
  - three levels: the app sidebar → the settings sub-nav (Account / Business / Payments) → sections;
  - "Developers" sits in both the main sidebar and the settings sub-nav;
  - "Account" (group) vs "Account details" (Business);
  - notification preferences live in **two places** (Notifications → Settings tab, and Settings → Notifications);
  - on phones the sub-nav becomes "Profile + 8 more tabs…". The same "N more tabs…" pattern is on Receipts ("2 more tabs…") and
    Developers ("3 more tabs…").
- **Security (S6):** ~280 sessions with no cap, no "Sign out all other sessions" summary and no paging. The 2FA actions "New
  backup codes" / "Switch to email codes" are 21 px tall, and the destructive one only differs by red text.
- **Charts (S24):** the first x-axis label is clipped at every width ("› 8", "t 1").
- **/get-started** still opens for an account with 5/5 steps done; it should redirect to the dashboard.

### Status of the Oct 5 findings (re-verified)
| Oct 5 item | Now |
|---|---|
| Payout addresses: 90 buttons, rainbow cards | **Fixed** — compact table, "Options" menu merges Security + Manage, stat tiles wrap |
| Notifications: card per item, wrong subtitle | **Fixed** — single list with dividers, new subtitle |
| "Your page" vs "Storefront" naming | **Fixed** (sidebar, title, bottom bar) |
| X2 pinned title hard cut | **Fixed** (hairline + shadow on scroll) |
| Payment-links table hidden under the sticky Actions column at 1440 | **Fixed at 1440**; still scrolls sideways at **1280** (1071 / 974 px) |
| X1 tips per browser | Partly fixed (per account) — but no auto-retire (S8) |
| X3 five selected styles | **Open** — gold sidebar pill, black pill (settings / tabs / notification chips), yellow segmented, black "All N" chip |
| X7 type-scale sprawl | **Open** — 26 sizes across pages at 1440 (9.5–36 incl. 10.5 / 11.5 / 12.5 / 13.5 / 14.5); up to 16 on Your page |
| Storefront funnel Views 5 → Checkouts 8 | **Open** |
| Amounts truncated on phones | Phones now wrap (OK); **tablet / laptop clipping is new and worse (S1)** |

---------------------------------------------------------------------------------------------------------------------
## 7. Ergonomics & accessibility

**Tap targets (touch devices, after the global 44 px MUI hit-area):**
- 12×12 "ⓘ" hint buttons: wallet-total-hint, customers-stat-revenue-hint, invoices-tile-collected-hint,
  your-page-funnel-checkouts-hint;
- 14×14 "View on explorer";
- 22×22 copy buttons (your-page-copy, copy-referral-code-btn);
- rows-per-page trigger 36×14;
- 15 px-tall text links (payouts-autoconvert-settings-link, profile-brand-logo-link);
- 18 px "Used on N networks" chips;
- segmented tabs 32–36 px;
- the drawer close button 36 px.

iPad Pro landscape uses the desktop density with fingers: 435 targets under 44 px across 17 pages.

**Desktop (WCAG 2.2 AA 2.5.8, 24×24):** ~60 offenders across pages, the same list plus the 2FA buttons (21 px).

**Contrast:**
- yellow #FFD100 text on white or pale yellow: drawer active row, Create-hub "Full options", "Auto-convert settings";
- gold section labels on cream (the Oct 5 Receipts finding).

**Type:**
- the 26-size scale above;
- 11 px and below on Your page (12 nodes), Payout addresses (11), Developers (4);
- line length: tips and long notification / KYC paragraphs run 200–333 characters per line at ≥ 1920 (target ≤ 75ch).

**Semantics:** nav rows / tabs are `div`s with ARIA roles (not anchors). The skip link, landmarks (header / nav / main) and h1 are
present on every page (good).

---------------------------------------------------------------------------------------------------------------------
## 8. Recommended target UX (blueprint)

### 8.1 One IA, three presentations
**Destinations:** Home · **Sell** (Payment links, Your page, Products) · **Money** (Balances & settlement, Transactions,
Receipts & tax, Payout addresses) · **Grow** (Customers, Refer & earn) · **Settings** (Settings, Developers, Help).
**Utilities (always in the top bar):** Search ⌘K · Create (+) · Notifications · Account. One `navSections.ts` feeds every
presentation, with the same labels everywhere (pick "Balances" or "Money", "Refer & earn" or "Referrals" — not both).

| Width × pointer | Shell | Notes |
|---|---|---|
| **< 600** (phones) | **Solid bottom tab bar** 56 px + safe-area: Home · Sell · (+) · Money · More | Remove the hamburger drawer. "More" opens a **bottom sheet**: a grouped vertical list (Grow, Settings, Notifications, Help & chat, Language, Appearance, Sign out) with the utility footer at the end. Active tab = filled icon + bold label + indicator. The bar hides on scroll-down and while an input has focus, and is replaced by a sticky action bar in create / edit flows. |
| **600–1023, coarse pointer** (tablets, foldables) | **Labelled navigation rail** 88–96 px (icon + 11–12 px caption) for the 5 groups; the group opens a fly-out list | No hover-only labels. Content uses cards or condensed tables (8.4). |
| **600–1023, fine pointer** (small browser windows) | 72 px icon rail with tooltips (today) | Keep the brand cell = rail width. |
| **1024–1279** | Sidebar 240, compact density when height < 860 | |
| **≥ 1280** | Sidebar 240 (today) | Add the scroll fade, the height-aware density (rows 36 px when `max-height:860px`) and a **utility footer** pinned at the bottom: Help · Status · Docs · Terms · Privacy · v-build · collapse. |
| **≥ 2000** | Sidebar 240 + content left-aligned up to 1720; ≥ 2400 adds an optional right context panel (activity / notifications) | Or constrain the top bar's inner container to the content max-width. Either way the edges line up. |

Use **real `<Link>`s** for every nav row and tab (keep the prefetch-on-hover). Active matching on segment boundaries everywhere.

### 8.2 Top bar
- **Desktop:** `[brand cell = sidebar width] [brand switcher] ··· [search field (expands at ≥ 1440)] [+ New ▾ menu] [🔔 popover] [avatar]`.
  - Move the theme toggle into the account menu only.
  - Make "+ New" a menu (or drop its chevron).
- **Phone (56 px):** `[brand switcher: avatar · name · ▾] ··· [search] [🔔] [avatar]`. The brand switcher opens a bottom sheet.

### 8.3 Page header
- **Desktop:** title (28) + one-line description + actions right. Not sticky; once scrolled, a **compact sticky title bar**
  (48 px, title + primary action) slides in.
- **Phones:** **large-title pattern.**
  - The 24–28 px title scrolls away and collapses into the top bar.
  - The description is hidden behind an ⓘ.
  - Show at most one full-width primary action; other actions go into a ⋯ menu.
  - Target ≥ 75 % content at first paint, with the first list row above the fold.

### 8.4 Lists & tables
- **Breakpoint by container width, not viewport:** card list < 720 px container; **condensed table** 720–1100 px
  (merge ID + source, Amount, Status, Date; the rest in the detail drawer); full table ≥ 1100 px.
- **Amounts are never truncated:** right-aligned with `safe` alignment; the coin unit may wrap to a second line; tabular numerals.
- **Large screens:** `rows-per-page` defaults to the viewport (≈ 25 at ≥ 1080 px tall); tables get column max-widths or a
  1600 px max table width.
- **Phone cards:**
  - the whole card opens the detail;
  - selection via long-press or a "Select" toolbar button;
  - one inline primary action (Copy link) + ⋯ menu;
  - no per-card checkbox.
- **One toolbar pattern:**
  - desktop: `[search (flex)] [period segmented] [Filters ▾ popover] [Export]` + status tabs above the list;
  - phone: `[search] [Filters]`, where Filters opens a bottom sheet with Period / Status / Source / Address.

### 8.5 Overlays
- **Phones:** every overlay (Create hub, Filters, Period, Brand switcher, Account, More) is a **bottom sheet** with a drag handle,
  safe-area padding and 44 px rows.
- **Desktop:** anchored menus / popovers. Dialogs only for confirmations.
- **History integration:** opening an overlay pushes a shallow history entry (`router.push({query:{sheet:'more'}}, undefined,
  {shallow:true})` or `history.pushState`). Back / swipe closes it.

### 8.6 Create / edit flows
- **Phones:** focus mode.
  - Hide the bottom bar and the chat button.
  - Sticky footer with the primary CTA (+ secondary), 16 px inputs, steps as an accordion.
  - The type picker becomes a compact segmented control, with the preview behind a "Preview" button.
- **Desktop:** keep the 2-column form + live preview and add a sticky action bar.

### 8.7 Tips, banners, help
- **Tips:**
  - render as an **ⓘ next to the page title** (popover);
  - auto-expand only on the first 2 visits;
  - auto-retire when the page's core action is used;
  - max-width 72ch.
- **Account banners:** collapse into one stacked "Action needed (n)" strip, with a single line on phones.
- **Chat:**
  - ≥ 768: move into the top bar (Help ? → chat), or reserve an 88 px right gutter at the bottom so it never covers row actions;
  - phones: keep it in More.

### 8.8 Account menu
- Header: name, email, plan / fee tier, current brand.
- Left-aligned 44 px rows: Your page ↗ · Settings · Help & support · Refer & earn · Appearance (Light / Dark / System segmented)
  · Language · Sign out.
- Anchored *below* the trigger, with hover / focus states.

### 8.9 Settings
- **Desktop:** keep the left sub-nav. Remove Developers from it (it's in the sidebar); rename "Account details" → "Business
  profile"; one home for notification preferences (Settings → Notifications; the Notifications page links there).
- **Phones:** a Settings **index list** (iOS Settings pattern) → push to the section page with a back chevron. Remove the
  "N more tabs…" overflow on Settings, Receipts and Developers (use scrollable tabs or a list).
- **Security:** show 5 recent sessions + "Sign out all other sessions" + "View all (280)" paged dialog; 36–44 px buttons; the
  destructive action as an outlined-red button with a confirm.

### 8.10 Foundations
- **Breakpoint tokens** (replace hard-coded 768 / 1024 / 900):
  - `phone < 600`, `tablet 600–1023`, `laptop 1024–1439`, `desktop 1440–1999`, `wide ≥ 2000`;
  - plus `coarse` / `fine` pointer and a `short` (max-height 860) query;
  - the shell components read one `useShellMode()` hook.
- **Type:** 7 steps — 12 · 13 · 14 · 16 · 20 · 24 · 32 (+ mono for amounts). No half-pixels; nothing under 12 px; amounts
  ≥ 14 px on phones.
- **Targets:** ≥ 44×44 on coarse pointers (turn ⓘ icons into tappable labels; copy buttons 40 px with an 8 px slop), ≥ 24×24
  on fine pointers.
- **Selected states:** one Tabs (underline or black pill) + one SegmentedControl (yellow) + the nav pill (gold) — documented in
  `design_guidelines.json`.
- **Loading:** a skeleton shell for every page while the brand context loads; persist the brand list + nav-reveal flags in
  localStorage (stale-while-revalidate) so the full nav and the brand name render instantly.
- **Dark mode:** bottom bar / sheet surfaces from the warm-black palette (no blue-grey); the same avatar treatment in both modes.

---------------------------------------------------------------------------------------------------------------------
## 9. Prioritised roadmap

### P0 — bugs (≈ 1–2 days, low risk)
1. **S1 money clipping:** `TransactionsTable.tsx` amount / fiat cells → safe right-alignment + wrap the unit; audit the other
   `justifyContent:"flex-end"` money cells (Payouts, Receipts, Customers, Payment links). Verify at 1024 / 1194 / 1280.
2. **S2 More sheet:** wrap / grid the rows (`SecondRow` → `grid-template-columns: repeat(4, 1fr)` or a vertical list), fix the
   Language flag + the missing Chat icon, move the warnings out of the bar.
3. **S4c Payout-address ⋯ off-screen** at 1024–1194 (row width / actions column).
4. **S4b brand cell:** pass the effective `railed` state (incl. the forced tablet band) to `LogoContainer` `data-rail`.
5. **S4a Transactions at 768–1023:** use the card list (or condensed columns) until the container ≥ 1100 px.
6. **S6 sessions list:** cap at 5 + "Sign out all others" + "View all".
7. **S12 account menu:** left-align the rows, remove the stray divider, add hover, anchor below the trigger.
8. **Contrast:** yellow-on-white links in the Create hub; the drawer active row.
9. **S24** chart first-label clipping; **/get-started** redirect when setup is complete.

### P1 — shell (≈ 1 week)
1. **S3 one phone nav:** bottom bar + "More" bottom sheet; remove the hamburger drawer. Same labels as the sidebar.
2. **S7 vertical budget:** large-title collapsing header on phones; hide the bottom bar on scroll-down and on input focus.
3. **S11 back gesture** for every overlay; in-app back on nested views (PWA).
4. **S14 create / edit focus mode** on phones + sticky action bar.
5. **S8 tips → ⓘ** + auto-retire + 72ch.
6. **S9 / S21 sidebar:** height-aware density, scroll fade, utility footer.
7. **S10 real links** for nav rows / tabs.
8. **S5 cold start:** skeletons + cached brand / nav reveal.
9. **S16** iOS no-zoom rule → `(pointer:coarse)`.
10. **S17** chat-button placement on ≥ 768.

### P2 — system (≈ 1–2 weeks)
1. Breakpoint tokens + `useShellMode()`; **labelled rail for touch tablets** (S4d / e) and the 600–767 tablet shell.
2. Large-screen layout: left-aligned content / aligned top bar, auto rows-per-page, table max-width (S13).
3. One toolbar / filter pattern + bottom-sheet filters (S15); phone card interaction model.
4. Settings IA + phone settings index (S20).
5. Type scale (S19), tap targets (S18), selected-state system (S22), dark-mode bottom-bar palette (S23).

### Acceptance metrics (re-run the harness)
- 0 clipped or truncated money values, 320–2560 px.
- More sheet: 0 clipped items at 320–440.
- Phones: content ≥ 75 % at first paint on list pages; first Transactions / Payment-links row visible without scrolling on
  iPhone 15 Pro.
- 0 elements clipped on the right at 768 / 834 / 1024 / 1194.
- Touch: 0 interactive targets < 44 px outside running text. Desktop: 0 < 24 px.
- ≤ 8 font sizes per page, none < 12 px.
- No input < 16 px on any coarse-pointer device.
- Sidebar: every item reachable without hidden scroll at 1280×720.

---------------------------------------------------------------------------------------------------------------------
## 10. Appendix

**Re-run:**
```bash
cd /app
node scripts/qa/ux_layout_audit.mjs --devices=desktop-1440,iphone-15-pro,ipad-mini-portrait   # any subset (ids in the script)
node scripts/qa/ux_layout_audit.mjs --devices=desktop-1440 --themes=dark --overlays=0
node scripts/qa/ux_layout_audit.mjs --devices=iphone-15-pro --extra=1 --drawers=1 --overlays=0  # settings sections + drawers
python3 scripts/qa/ux_layout_audit_summary.py                     # cross-device tables + flags
python3 scripts/qa/ux_layout_audit_summary.py --detail transactions --device ipad
```
The harness needs `memory/tmp/merchant_token.txt` (a valid owner JWT). It routes `/api/*` to `:8001` and mocks every non-GET.

**Key screenshots** (`test_reports/ux_layout_audit_2026-10-08/`):

| Finding | Screenshot |
|---|---|
| S1 money clipping | `desktop-1280/transactions__fold.jpg`, `ipad-mini-landscape/transactions__fold.jpg` |
| S2 More sheet | `iphone-se3/overlay__bottom-more.jpg`, `pixel-8/overlay__bottom-more.jpg` |
| S3 drawer | `iphone-se3/overlay__drawer.jpg` |
| Create hub (phone) | `iphone-se3/overlay__create.jpg` |
| S4a tablet table | `ipad-pro11-portrait/transactions__fold.jpg` |
| S4b brand cell | `ipad-mini-landscape/dashboard__fold.jpg` |
| S4c ⋯ off-screen | `ipad-pro11-landscape/wallet__scrolled.jpg` |
| S4d rail | `ipad-mini-portrait/dashboard__fold.jpg` |
| S5 cold start | `desktop-1280/dashboard__fold.jpg`, `galaxy-tab-s4/dashboard__fold.jpg` |
| S6 Security | `desktop-1440/settings-security__fold.jpg` (page 23,730 px) |
| S7 phone budget | `iphone-15-pro/transactions__fold.jpg`, `iphone-se3/wallet__fold.jpg` |
| S12 account menu | `desktop-1440/overlay__user-menu.jpg`, `pixel-8/overlay__user-menu.jpg` |
| S13 ultra-wide | `desktop-2560/transactions__fold.jpg`, `desktop-2560/dashboard__fold.jpg` |
| S14 phone form | `iphone-15-pro/create-pay-link__fold.jpg` |
| S15 phone filters / card tap | `iphone-15-pro/pay-links__fold.jpg`, `iphone-15-pro/overlay__paylink-drawer.jpg` |
| S20 phone settings | `iphone-15-pro/settings__fold.jpg` |
| Dark mode | `desktop-1440-dark/*`, `iphone-15-pro-dark/*` |
| Contact sheets | `_sheets/*.jpg` |
