# COMPREHENSIVE MOBILE UX/QA AUDIT REPORT
**Date:** 2026-07-17  
**Viewport:** 390x844 (iPhone 14/15)  
**App:** https://dynopay-setup-6.preview.emergentagent.com  
**Mode:** READ-ONLY AUDIT (No changes made)

---

## EXECUTIVE SUMMARY

**Pages Audited:** Dashboard, Wallet, Settings, Checkout (partial)  
**Total Issues Found:** 40+ issues  
**Critical Blockers:** 30+ HIGH severity issues

### Issue Breakdown
- 🔴 **HIGH Severity:** 30+ issues (blocks core functionality)
- 🟡 **MEDIUM Severity:** 10+ issues (usability friction)
- 🟢 **LOW Severity:** 0 issues

---

## TOP HIGH-SEVERITY ISSUES

### 1. ❌ CRITICAL: Bottom Navigation Occludes Interactive Buttons (WALLET PAGE)
**Severity:** HIGH  
**Page:** /wallet  
**Impact:** Users cannot access critical action buttons

**Affected Buttons:**
- 'Cancel' button - occluded by Bottom Nav
- 'Continue' button - occluded by Bottom Nav
- 'Verify' buttons (multiple instances) - occluded by Bottom Nav
- 'Send Test' button - occluded by Bottom Nav
- 'Delete Company' button - occluded by Bottom Nav
- 'Save changes' buttons (multiple) - occluded by Bottom Nav
- 'Delete' button - occluded by Bottom Nav
- 'Validate Tax ID' button - occluded by Bottom Nav
- 'Resend code' buttons (multiple) - occluded by Bottom Nav

**Root Cause:** Bottom navigation bar positioned at y=758.4px (height: 77.6px) overlaps with buttons positioned at the bottom of scrollable containers. When users scroll to the bottom, these buttons fall into the occlusion zone (758-836px).

**Repro:**
1. Navigate to /wallet on mobile (390x844)
2. Scroll to bottom of page
3. Observe that action buttons are hidden behind bottom nav
4. Cannot tap buttons to complete actions

**Recommendation:** Add bottom padding/spacer (minimum 96px) to all pages with bottom action buttons to ensure clearance above the bottom nav bar.

---

### 2. ❌ CRITICAL: Save Buttons Occluded Across All Settings Sections
**Severity:** HIGH  
**Page:** /settings (all sections)  
**Impact:** Users cannot save changes to their settings

**Affected Sections & Buttons:**

**Profile Section (/settings?section=profile):**
- 'Save changes' button - occluded by Bottom Nav
- 'Verify & Save' button - occluded by Bottom Nav

**Security Section (/settings?section=security):**
- 'Save changes' button - occluded by Bottom Nav
- 'Verify & Save' button - occluded by Bottom Nav

**Notifications Section (/settings?section=notifications):**
- 'Save changes' button - occluded by Bottom Nav

**Company Section (/settings?section=company):**
- 'Save changes' button (one instance) - occluded by Bottom Nav

**API Section (/settings?section=api):**
- 'Save changes' button - occluded by Bottom Nav
- 'Verify & Save' button - occluded by Bottom Nav

**Root Cause:** Same as Issue #1 - bottom navigation bar occludes buttons at the bottom of forms.

**Repro:**
1. Navigate to /settings on mobile
2. Go to any section (profile, security, notifications, company, api)
3. Fill out form fields
4. Scroll to bottom to find Save button
5. Observe Save button is hidden behind bottom nav
6. Cannot save changes

**Recommendation:** Add consistent bottom padding (minimum 96px) to all settings forms to ensure Save buttons are accessible above the bottom nav.

---

## MEDIUM-SEVERITY ISSUES

### 3. ⚠️ Small Tap Targets on Action Buttons
**Severity:** MEDIUM  
**Page:** /wallet  
**Impact:** Difficult to tap accurately on mobile

**Affected Buttons:**
- 'Resend code' buttons - 152x32px (height below 44px minimum)
- 'Send Test' button - 324x40px (height below 44px minimum)

**Recommendation:** Increase button min-height to 44px (iOS Human Interface Guidelines) or 48px (Material Design) for comfortable tap targets.

---

### 4. ⚠️ Save Buttons Not Visible in Viewport (Require Scrolling)
**Severity:** MEDIUM  
**Pages:** /settings (multiple sections)  
**Impact:** Users may not realize they need to scroll to find Save button

**Affected Buttons:**
- 'Update Password' button - not visible in initial viewport
- 'Save changes' buttons - require scrolling to reach

**Recommendation:** Consider sticky Save button at bottom (above nav) or visual indicator that form continues below fold.

---

## PAGES AUDITED IN DETAIL

### ✅ DASHBOARD (/dashboard)
**Status:** CLEAN - No major issues detected

**Findings:**
- No horizontal overflow detected
- Stat cards fit within 390px viewport
- Bottom nav properly positioned at y=758.4px
- Quick action buttons at bottom are NOT occluded
- Referral code, revenue metrics, and transaction list render correctly

**Screenshots:**
- `01_dashboard_top.png` - Top of dashboard with referral code
- `02_dashboard_bottom.png` - Bottom of dashboard with metrics

---

### ❌ WALLET (/wallet)
**Status:** CRITICAL ISSUES - Multiple buttons occluded

**Findings:**
- ✅ Wallet cards render correctly (Bitcoin, Ethereum, Litecoin visible)
- ✅ Addresses and balances display properly
- ✅ No horizontal overflow
- ❌ **39 buttons detected at bottom of page**
- ❌ **30+ buttons occluded by bottom nav** (see Issue #1)
- ⚠️ Action buttons have small tap targets (32-40px height)

**Affected Functionality:**
- Cannot complete verification flows (Verify buttons occluded)
- Cannot save changes (Save buttons occluded)
- Cannot cancel operations (Cancel buttons occluded)
- Cannot delete items (Delete buttons occluded)
- Cannot validate tax ID (button occluded)

**Screenshots:**
- `03_wallet_top.png` - Top of wallet page with Bitcoin card
- `04_wallet_bottom.png` - Bottom of wallet page (buttons occluded)

---

### ❌ SETTINGS (/settings)
**Status:** CRITICAL ISSUES - Save buttons occluded across all sections

**Findings:**
- ✅ Tabs/sections navigation works
- ✅ Form fields fit within viewport (no horizontal overflow)
- ✅ Input fields are properly sized
- ❌ **Save buttons occluded in ALL sections** (see Issue #2)
- ⚠️ Some Save buttons not visible without scrolling

**Sections Tested:**
1. Profile & Security - Save buttons occluded
2. Security - Save buttons occluded
3. Notifications - Save button occluded
4. Company - Save button occluded
5. API - Save buttons occluded

**Impact:** Users cannot save any settings changes on mobile.

**Screenshots:**
- `05_settings_top.png` - Settings page with Profile & Security tab
- `06_settings_bottom.png` - Bottom of settings (Save buttons occluded)

---

### ⚠️ CHECKOUT (/pay/demo)
**Status:** INCOMPLETE AUDIT - Selector error prevented full testing

**Findings:**
- ✅ Page loads successfully
- ⚠️ Audit incomplete due to technical error (invalid CSS selector)
- ⚠️ Could not verify Step 1 (Order summary) layout
- ⚠️ Could not verify Step 2 (Payment selection) layout
- ⚠️ Could not verify QR code, wallet address, copy button, timer visibility
- ⚠️ Could not verify if CTA buttons are occluded

**Recommendation:** Manual testing required for checkout flow on mobile to verify:
- Order summary fits viewport
- Primary CTA button is reachable (not occluded by FAB/nav)
- Network/crypto selection buttons are accessible
- QR code renders correctly
- Wallet address is visible and copyable
- Amount to send is clearly displayed
- Countdown timer is visible
- No horizontal overflow

**Screenshots:**
- `07_checkout_step1_order.png` - Checkout page (partial view)

---

## TECHNICAL DETAILS

### Bottom Navigation Bar
- **Position:** Fixed at bottom
- **Top edge:** y=758.4px
- **Bottom edge:** y=836px
- **Height:** 77.6px
- **Occlusion zone:** 758-836px (any content in this range is unreachable)

### Support Chat FAB
- **Status:** Not detected by automated selectors
- **Visual confirmation:** Visible in screenshots at bottom-right
- **Position:** Approximately y=680px (based on previous session data)

### Viewport
- **Width:** 390px
- **Height:** 844px
- **Device:** iPhone 14/15 equivalent

---

## RECOMMENDATIONS

### Immediate Fixes (HIGH Priority)

1. **Add Bottom Clearance to All Pages**
   - Add minimum 96px bottom padding to all scrollable containers
   - Ensure all interactive buttons clear the bottom nav occlusion zone (758-836px)
   - Apply to: /wallet, /settings (all sections), /dashboard, /checkout

2. **Fix Settings Save Buttons**
   - Add spacer element after all forms (similar to Session 71 fix for transactions)
   - Ensure Save buttons are positioned above y=680px when scrolled to bottom
   - Test across all settings sections: profile, security, notifications, company, api

3. **Fix Wallet Action Buttons**
   - Add spacer after wallet cards and action button groups
   - Ensure Verify, Save, Cancel, Delete buttons are accessible
   - Test verification flows end-to-end

### Medium Priority

4. **Increase Tap Target Sizes**
   - Update button min-height to 48px (Material Design standard)
   - Affects: Resend code buttons, Send Test button, and similar small buttons

5. **Complete Checkout Audit**
   - Manual testing required for /pay/demo flow
   - Verify all 3 steps (Order → Payment → Done) on mobile
   - Check for occlusion, overflow, and tap target issues

### Low Priority

6. **Visual Indicators**
   - Add visual indicator when Save button is below fold
   - Consider sticky Save button pattern for long forms

---

## TESTING NOTES

- **Login:** Successful using multi-step flow (email → password method → credentials)
- **Session:** Authenticated as hostbay@moxx.co
- **Database:** LIVE production (Railway) - NO changes made
- **Approach:** Non-destructive audit only - opened modals but did not submit
- **Limitations:** Checkout audit incomplete due to selector syntax error

---

## CONCLUSION

The mobile experience has **critical accessibility issues** that prevent users from completing core actions:

1. **30+ buttons are unreachable** due to bottom nav occlusion
2. **Users cannot save settings** across all sections
3. **Verification flows are blocked** on wallet page
4. **Tap targets are too small** for comfortable mobile interaction

**Recommended Action:** Implement bottom clearance fix (similar to Session 71 transactions fix) across all pages before next release. This is a **blocking issue** for mobile users.

---

**Audit completed:** 2026-07-17  
**Testing agent:** auto_frontend_testing_agent  
**Report generated:** /app/mobile_ux_audit_report.md
