# DynoPay — End-to-End Responsive (Cross-Device) Testing Plan

_Last updated: 2026-07-29 · Owner: engineering · Trigger: mobile menu lag reported on iPhone 14 Pro Max_

## 1. Objective
Validate that **every user-facing flow works and looks correct across all target screen sizes**, with special attention to touch responsiveness (the reported "menu doesn't respond immediately" issue). Catch layout breaks, overflow, tap-target problems, and interaction lag before release.

## 2. Device / Breakpoint Matrix
Test each area at these viewports (portrait unless noted). MUI breakpoints in this app: xs<600, sm 600–899, md 900–1199 (mobile menu cutoff is `max-width:1025px`), lg 1200–1535, xl≥1536.

| # | Device (emulation) | Viewport (CSS px) | DPR | Class | Why |
|---|---|---|---|---|---|
| 1 | iPhone SE (2nd/3rd) | 375 × 667 | 2 | Small phone | Smallest common phone; tightest layout |
| 2 | iPhone 14 / 13 | 390 × 844 | 3 | Phone | Baseline modern iPhone |
| 3 | **iPhone 14 Pro Max** | **430 × 932** | **3** | Large phone | **Reported bug device** |
| 4 | Pixel 7 / Galaxy S22 | 360–412 × 800+ | 2.6–3 | Android phone | Android Chrome quirks |
| 5 | iPad Mini / Air (portrait) | 768 × 1024 | 2 | Tablet | md breakpoint edge; menu still hamburger (<1025) |
| 6 | iPad Pro 11" (landscape) | 1194 × 834 | 2 | Tablet landscape | Just above 1025 → desktop nav appears |
| 7 | Laptop | 1366 × 768 | 1 | Desktop | Most common desktop |
| 8 | Desktop wide | 1920 × 1080 | 1 | Desktop | Full desktop layout |

Also test **landscape** for phones (3 & 4) on checkout + login (keyboard overlap).

## 3. Functional Areas & Test Cases

### A. Global chrome (every breakpoint)
- [ ] Header renders; below 1025px the **hamburger** shows and desktop nav hides; above 1025px the reverse.
- [ ] **Mobile menu opens on first tap with no perceptible delay** (reported bug). Drawer slides in <200ms, backdrop appears, body scroll locks, no double scrollbar shift.
- [ ] Menu links navigate + close the drawer; close (X) works; tapping backdrop closes.
- [ ] Theme toggle (dark/light) works on all sizes; no FOUC.
- [ ] Language switcher opens and switches (EN/PT/ES/FR/DE/NL).
- [ ] No horizontal scroll / content overflow at any width. No overlapping elements.
- [ ] Tap targets ≥ 44×44px (icons, buttons, nav items).
- [ ] Safe-area insets respected on notched devices (no content under status bar / home indicator).

### B. Marketing / public pages
Pages: `/`, `/fees`, `/documentation`, `/blog`, `/blog/[slug]`, `/for/[vertical]`, `/terms-conditions`, `/privacy-policy`, `/aml-policy`, `/QA`, `/pay/demo`, `/pay/donation-demo`.
- [ ] Hero, cards, tables, FAQ accordions reflow correctly; images scale (no cropping/overflow).
- [ ] Fee calculator / tip widget interactive on touch.
- [ ] Footer columns stack on mobile.

### C. Auth
Pages: `/auth/login`, `/auth/register`, `/reset-password`, `/auth/secure-account`.
- [ ] 2-step login (email → password) usable; inputs not obscured by on-screen keyboard.
- [ ] OTP / "use a code instead" panel usable on mobile.
- [ ] Google/GitHub buttons render (note: OAuth won't complete in preview — email/password path is the test path).
- [ ] Validation errors visible without layout jump.

### D. Merchant dashboard (authenticated — `hostbay@moxx.co`)
Pages: `/dashboard`, `/transactions`, `/wallet`, `/create-pay-link`, Products, Creator page, `/settings`, `/company`, Referrals, Notifications, API, Invoices & Tax.
- [ ] Desktop: left `NewSidebar` visible. Mobile: **bottom `MobileNavigationBar`**; expand/collapse toggle responds on first tap.
- [ ] KPI cards, charts (recharts), and tables become horizontally scrollable or stack — no clipping.
- [ ] Create-payment-link and settings forms usable; date pickers / selects open correctly on touch.
- [ ] Modals/dialogs (company settings, webhook config) fit small screens and scroll internally.
- [ ] Copy-to-clipboard, QR code, and "View" creator link work on touch.

### E. Checkout / payment (customer-facing)
Pages: `/pay?d=...`, `/pay/verify`, `/order/[publicRef]`, `/[handle]` creator page, inline tip.
- [ ] Amount selector chips, crypto/coin picker, QR + address copy usable on mobile.
- [ ] Countdown timer + status polling render; no layout shift on state change.
- [ ] Success/expired/failed states fit small screens.

## 4. Reported-Bug Focus: Mobile Menu Responsiveness
Root cause identified & fixed in code: full-screen `backdrop-filter: blur(10px)` (GPU jank on high-DPR) reduced to `blur(4px)` + own compositor layer; removed the redundant MUI Modal scroll-lock (kept the lightweight manual lock); snappier drawer transition (180/140ms).
Verification:
- [ ] On iPhone 14 Pro Max emulation: tap hamburger → drawer visible & interactive within ~200ms, repeatable 5× with no missed taps.
- [ ] No double scroll-lock jump (body padding shift) on open/close.
- [ ] Menu open/close/navigate works on devices 1–5; desktop nav (no hamburger) on 6–8.

## 5. Methodology & Tooling
- **Automated**: Playwright device emulation via the frontend testing agent — sets real device descriptors (viewport + DPR + touch), performs tap→visible timing, screenshots each breakpoint, checks `document.documentElement.scrollWidth <= innerWidth` (no h-scroll), and verifies element visibility per breakpoint.
- **Login for authenticated areas**: `hostbay@moxx.co` / `Katiekendra123@` (live Railway data).
- **Manual spot-check** (optional): real iOS Safari for perceived blur/scroll smoothness, since headless browsers don't fully reproduce GPU compositing.

## 6. Pass/Fail Criteria
- **Pass**: flow completes, no horizontal overflow, no overlap/clipping, tap targets adequate, menu opens on first tap <200ms, no console errors that block interaction.
- **Fail**: any broken layout, unreachable control, obscured input, missed/delayed taps, or JS error breaking the flow.

## 7. Regression Checklist (run after any UI change)
- [ ] Home loads at 375 / 430 / 1366 / 1920 with no overflow.
- [ ] Mobile menu opens on first tap (iPhone 14 Pro Max).
- [ ] Login → dashboard works on mobile + desktop.
- [ ] Theme + language switch on mobile + desktop.
