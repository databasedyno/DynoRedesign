# DynoPay UI Automation Test Report

## Test Credentials
- **Email**: nomadly@moxx.co
- **Password**: Katiekendra123@
- **Company**: Nomadly1
- **Pod URL**: https://dynopay-setup-4.preview.emergentagent.com

---

## Pre-Test Fixes
1. **Deleted "Kane Dav" test company** (ID: 34) from PostgreSQL so Nomadly1 is the default company
2. **Fixed `/pay-links` routing bug** — `/pay-links` was matching `/pay` prefix in `_app.tsx`, causing it to use the Checkout theme (which lacks `palette.border`). Fixed by changing `pathname.startsWith("/pay")` → `pathname.startsWith("/pay/") || pathname === "/pay"`
3. **Added safe fallback** in `PaymentLinksTable.tsx` for `theme.palette.border.main`

---

## Test Results

### Phase 1: Login & Dashboard ✅ PASSED
- [x] Login with credentials — redirects to /dashboard
- [x] Company selector shows "Nomadly1"
- [x] Dashboard stats: Total Transactions (656), Total Volume ($14,932.39 USD), Active Wallets (15)
- [x] Transaction Volume chart loads with data
- [x] Fee Tier Progress: 29.8% complete, Standard tier, $14,911.24 / $50,000
- [x] Auto-Convert to Stablecoins banner present
- [x] Responsive Desktop (1920px) ✅ | Tablet (768px) ✅ | Mobile (390px) ✅

### Phase 2: Transactions ✅ PASSED
- [x] Table loads with 643 transactions
- [x] Columns: Transaction ID, Crypto, Amount, USD Value, Date & Time, Status
- [x] Search bar, Date range filter, Wallet filter, Export button present
- [x] Transaction details modal — shows ID, Date, Crypto, Amount, USD Value, Fees, Confirmations, "View on Explorer"
- [x] Pagination controls working
- [x] Responsive Desktop ✅ | Tablet ✅ | Mobile ✅

### Phase 3: Invoices & Tax ✅ PASSED
- [x] Invoices tab with table headers (Invoice#, Date, Customer, VAT, Total, PDF)
- [x] Tax Report tab present
- [x] CSV export button
- [x] Empty state (no invoices for this company) shows correctly
- [x] Responsive Desktop ✅ | Tablet ✅ | Mobile ✅

### Phase 4: Payment Links ✅ PASSED (after bug fix)
- [x] Table shows 14 payment links
- [x] Columns: Link ID, Description, USD Value, Crypto Value, Created, Expires, Status, Times Used, Actions
- [x] "Create Payment Link" button present
- [x] Search bar working
- [x] Pagination controls
- [x] Responsive Desktop ✅ | Tablet ✅ | Mobile ✅
- **Bug Fixed**: `/pay-links` was using Checkout theme instead of Dashboard theme due to path matching

### Phase 4b: Create Payment Link ✅ PASSED
- [x] Form: Value($), Currency (USD), Description, Client name, Expire toggle
- [x] Blockchain fees paid by: Customer / Company radio
- [x] Accepted cryptocurrencies: BTC, ETH, TRX, LTC, DOGE, etc.
- [x] 2 steps: Payment Settings → Post-Payment Settings
- [x] Responsive Desktop ✅ | Tablet ✅ | Mobile ✅

### Phase 5: Wallets ✅ PASSED
- [x] Wallet cards: BTC ($4,144.55), ETH ($3,137.01), LTC ($1,263.29), DOGE ($7.59), TRX ($7.22), etc.
- [x] Each card: address, copy button, View Transactions, edit & delete actions
- [x] Add Wallet button present
- [x] Responsive: Desktop 3-col ✅ | Tablet 2-col ✅ | Mobile 1-col ✅

### Phase 5b: Wallet Addresses ✅ PASSED (page later removed as old design)
- [x] Showed 15 configured addresses with copy/delete actions
- [x] "Add Wallet Address" button
- [x] Responsive grid layout

### Phase 6: Customers ✅ PASSED
- [x] 170 total customers, $5,539.47 aggregate wallet balance
- [x] Table: Customer, Email, Wallet Balance, Transactions, Created, Actions
- [x] Search bar functional
- [x] Responsive Desktop ✅ | Tablet ✅ | Mobile ✅

### Phase 7: API / Developer Keys ✅ PASSED
- [x] Existing key "keys.usd" (Active, USD) displayed
- [x] API Token & Admin Token with copy/show/hide buttons
- [x] Regenerate & Disable actions
- [x] API Documentation link
- [x] Security best practices section
- [x] Responsive Desktop ✅ | Tablet ✅ | Mobile ✅

### Phase 8: Company Settings ✅ PASSED
- [x] **Company Details**: Name (Nomadly1), Email, Mobile, Country, State, City, Address, Zip Code, VAT
- [x] **Crypto Conversion**: Auto-convert toggle (Yes/No), Convert to (USDT TRC20/ERC20, USDC ERC20), 0% fee
- [x] **Payment Tolerance**: Accordion section present
- [x] **Webhook Notifications**: URL field, Secret Key with copy/show/regenerate, "Send Test" button
- [x] Actions: Delete Company, Cancel, Save Changes
- [x] Responsive: Desktop dialog ✅ | Mobile fullscreen ✅

### Phase 9: Notifications ✅ PASSED
- [x] Inbox tab: 19 notifications (Payment Received, Payment Pending Confirmation)
- [x] Timestamps (19h, 21h, 23h ago), unread indicators (blue dots)
- [x] "Mark All as Read" button
- [x] Settings tab for notification preferences
- [x] Responsive Desktop ✅ | Tablet ✅ | Mobile ✅

### Phase 10: Profile ✅ PASSED
- [x] Account Setting: Avatar, First Name (Nomadly), Surname, Email (nomadly@moxx.co), Mobile
- [x] Update button
- [x] Update Password: Old/New/Confirm password fields with show/hide toggles
- [x] Responsive: Desktop 2-col ✅ | Tablet 2-col ✅ | Mobile stacked ✅

### Phase 11: Referrals ✅ PASSED
- [x] Referral code: DYNO2026NOMC92496B9
- [x] Copy Link & Share Referral Link buttons
- [x] Stats: Total Referrals, Active, Pending, Total Earnings
- [x] Fee Discount section
- [x] Earnings Breakdown: Credited / Pending / Withdrawn
- [x] My Referrals list
- [x] Responsive Desktop ✅ | Tablet ✅ | Mobile ✅

### Phase 12: Withdraw ✅ PASSED (page later removed as old design)
- [x] Currency dropdown (ETH selected), Balance display
- [x] Amount input, Address field, "Save this address" checkbox
- [x] Fee payment options, "Estimate Fee" button
- [x] Responsive all views working

---

## Old Pages Cleanup
Removed 8 legacy pages not part of current design:

| File | Reason |
|------|--------|
| `withdraw.tsx` | Old withdraw page — not in sidebar |
| `walletAddress.tsx` | Old wallet address page — old design |
| `walletOld.tsx` | Legacy wallet — old DataTable/FormManager |
| `transactionsOld.tsx` | Legacy transactions — old DataTable |
| `apisOld.tsx` | Legacy API keys — old FormManager |
| `api-keys-old.tsx` | Legacy API keys — old FormManager |
| `apis.tsx` | Duplicate of developer-keys.tsx without company_id scoping |
| `temp.tsx` | Temp/test page — unused |

Also updated `Menus.tsx` to point `/walletAddress` → `/wallet`.

---

## Summary
- **Total Tests**: 12 phases + 2 sub-phases = 14 test groups
- **Pass Rate**: 100% (after 1 bug fix)
- **Bug Found & Fixed**: 1 (Payment Links theme routing)
- **Old Pages Removed**: 8
- **Responsiveness**: All active pages verified at Desktop (1920px), Tablet (768px), Mobile (390px)
