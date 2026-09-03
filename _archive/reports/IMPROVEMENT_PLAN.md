# DynoPay Improvement Plan — Based on BlockBee Competitive Analysis
> Generated: March 10, 2026
> Reference: BlockBee Dashboard (dash.blockbee.io) vs DynoPay

---

## Executive Summary

After a page-by-page analysis of BlockBee's crypto payment dashboard against DynoPay, we identified 5 critical improvement areas and 8 additional enhancements. DynoPay already leads in transaction management, payment links UX, and navigation design. The biggest gaps are in the dashboard experience, settings page, and wallet visibility.

---

## Priority 1: CRITICAL — Fix Settings Page (Currently 404)

**Problem**: `/settings` returns "Page not found". No way for merchants to manage their profile, wallet addresses, payment configurations, or notifications from a central place.

**BlockBee Reference**: Beautiful 3×3 card grid with 9 settings categories, each with title + description:
- Set Your Wallet Addresses
- Payment Settings
- API Key
- Point of Sale (PoS) Users
- Storefront Settings
- Subscription Settings
- Profile Sharing
- Notifications
- Manage Profile

**Implementation Plan**:
- Create `/pages/settings/index.tsx` with card grid layout
- Each card links to a sub-page or opens a modal
- Cards for DynoPay: Wallet Addresses, Payment Settings, API Keys, Company Profile, Notification Preferences, Security (2FA/Password), Auto-Conversion Settings, Webhook Configuration
- Use existing DynoPay design system (Material UI + Tailwind)
- Responsive: 3 columns on desktop, 2 on tablet, 1 on mobile

**Estimated Effort**: Medium
**Files to create/modify**: `pages/settings/index.tsx`, `Components/Page/Settings/`

---

## Priority 2: HIGH — Dashboard "Today" Summary Strip

**Problem**: DynoPay's dashboard doesn't show at-a-glance daily activity. Merchants need to immediately see how their business is performing today.

**BlockBee Reference**: "Today" section at top of dashboard showing:
- Volume (today)
- Yesterday's volume
- Payouts (today)
- Yesterday's payouts

**Implementation Plan**:
- Add a summary strip/row at the top of the Dashboard page
- 4 stat cards in a row: "Volume Today", "Volume Yesterday", "Payouts Today", "Pending Transactions"
- Each card shows the value + percentage change from yesterday
- Pull data from existing `getTransactions` and `getDashboardStats` endpoints
- Color coding: green for positive change, red for negative

**Estimated Effort**: Medium
**Files to modify**: `Components/Page/Dashboard/`, backend may need a new `/api/company/getDashboardSummary` endpoint

---

## Priority 3: HIGH — Dashboard Information Panel

**Problem**: No central place showing current fee rate, available balance, or platform announcements.

**BlockBee Reference**: Right-side info panel showing:
- Current Fee: 1.00%
- Balance: $32.08
- Credits usage: 0.19%
- Latest News feed with clickable links and timestamps

**Implementation Plan**:
- Add an "Information" card/panel to the right side of the dashboard (or below the summary strip)
- Show: Current Fee %, Available Balance (sum across wallets), Recent Platform News
- Fee and balance data likely available from existing APIs
- News/announcements could be a simple static section initially, or pulled from a backend collection

**Estimated Effort**: Medium
**Files to modify**: `Components/Page/Dashboard/`, possibly new `Components/UI/InfoPanel.tsx`

---

## Priority 4: HIGH — Wallets Page Enhancement

**Problem**: Wallets page only displays 1 wallet card (Bitcoin) despite the merchant having multiple crypto wallets configured. Cards look sparse — no current balance, no QR code.

**BlockBee Reference**: Has "Self-Custodial Wallet" and "Generated Addresses" as separate concepts. Wallets are a core feature.

**Implementation Plan**:
- Ensure ALL configured wallets render as cards (BTC, ETH, LTC, DOGE, BCH, TRX, USDT variants, SOL, XRP, etc.)
- Investigate why only Bitcoin shows — likely a data issue or rendering bug
- Add to each wallet card:
  - Current balance (not just "total processed")
  - QR code for the wallet address (using a QR library)
  - Copy address button (already exists)
  - "View Transactions" button (already implemented with filtering ✅)
  - Receive/Deposit action
- Add a summary row at top: "Total Portfolio Value: $X,XXX.XX"

**Estimated Effort**: Medium-High
**Files to modify**: `Components/Page/Wallet/index.tsx`, `hooks/useWalletData.ts`, possibly backend wallet endpoints

---

## Priority 5: MEDIUM — Payment Links Date Range Filter

**Problem**: Payment Links page has search but no date range filter, unlike Transactions page which has full filtering.

**BlockBee Reference**: Consistent search + date range + status filter pattern across ALL list pages.

**Implementation Plan**:
- Add date range picker to Payment Links page (reuse `TransactionsTopBar` date range component)
- Add status filter dropdown (All, Active, Completed, Expired, Pending)
- Filter payment links client-side or add query params to backend `getPaymentLinks`

**Estimated Effort**: Low-Medium
**Files to modify**: `Components/Page/Payment-link/index.tsx`, `Components/Page/Payment-link/PaymentLinksTable.tsx`

---

## Additional Enhancements (Lower Priority)

### 6. Subscriptions / Recurring Payments Page
**BlockBee has**: Dedicated Subscriptions page with status tracking
**DynoPay**: No subscription management
**Recommendation**: Consider adding recurring payment support as a future feature

### 7. Payout Requests Management
**BlockBee has**: Two tabs — Payouts + Payout Requests with export
**DynoPay**: No visible payout management page
**Recommendation**: Add a Payouts page if merchant-initiated payouts are supported

### 8. Developer Quick Access
**BlockBee has**: "Developers" CTA button in header bar for quick API docs access
**DynoPay**: Has "API" in sidebar navigation
**Recommendation**: Consider adding a "Developers" quick-link in the top header bar

### 9. Usage/Credits Tracking
**BlockBee has**: "0 Credits" badge in header showing API usage
**DynoPay**: No visible usage tracking
**Recommendation**: Low priority — add if API rate limiting or usage-based pricing is planned

### 10. Empty State Improvements
**BlockBee has**: Friendly messages like "I'm sorry, but I am unable to find any data that matches your query 😔"
**DynoPay**: Has empty state component but could be more engaging
**Recommendation**: Add friendly copy + illustrations to empty states across all pages

### 11. Status Filter Dots (Quick Filters)
**BlockBee has**: Green/Red dots next to search for quick status filtering on Subscriptions, Invoices
**DynoPay**: Uses dropdown for wallet filter on Transactions
**Recommendation**: Add quick-filter dots/chips for status on Transactions and Payment Links pages

### 12. Footer Branding
**BlockBee has**: "BlockBee 2026 · v4.0.5" footer with logo on authenticated pages
**DynoPay**: No version/footer on authenticated pages
**Recommendation**: Low priority — add subtle version footer for brand consistency

---

## What DynoPay Already Does Better Than BlockBee

✅ **Modern, clean UI** — Material UI + Tailwind gives a more polished look
✅ **Transaction table** — Wallet filter, auto-convert indicator, richer status badges
✅ **Payment Links** — Full CRUD with contextual action buttons (Copy/View/Edit/Delete)
✅ **Navigation** — Flat, clean sidebar without confusing sub-hierarchies
✅ **Multi-language support** — 6 languages (EN, PT, FR, ES, DE, NL)
✅ **Referral code visibility** — Shown directly in sidebar
✅ **Help & Support** — Accessible from footer and sidebar
✅ **Login UX** — Beautiful split-screen with marketing + multi-method auth
✅ **Auto-conversion** — Stablecoin auto-conversion feature (unique to DynoPay)
✅ **Dark mode toggle** — Available in header

---

## Implementation Order (Suggested Sprints)

### Sprint 1 (Quick Wins):
- Fix Settings page (Priority 1)
- Payment Links date range filter (Priority 5)

### Sprint 2 (Dashboard Overhaul):
- Dashboard "Today" summary strip (Priority 2)
- Dashboard Information panel (Priority 3)

### Sprint 3 (Wallet Enhancement):
- Wallets page — show all wallets, balances, QR codes (Priority 4)
- Empty state improvements

### Sprint 4 (Future Features):
- Subscriptions management
- Payout requests
- Developer quick access
- Status quick-filter dots

---

*This plan is based on a visual analysis conducted on March 10, 2026, comparing BlockBee dash.blockbee.io with DynoPay. Screenshots saved in `/tmp/bb_*.jpg` (BlockBee) and `/tmp/dp_*.png` (DynoPay).*
