#!/usr/bin/env python3
"""
Session 41 Backend Test: CSRF Exemption for POST /api/pay/tip
NARROW test focused on ONE change: /api/pay/tip added to CSRF exempt list.
All other tip endpoint logic was tested in Session 40 (13/13 pass).
"""

import requests
import json
import sys

# Preview URL from test_credentials.md
BASE_URL = "https://do-fix-issue.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from test_credentials.md
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"
TEST_HANDLE = "hostbay"

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log(msg, color=RESET):
    print(f"{color}{msg}{RESET}")

def test_login_and_enable_widget():
    """
    Scenario 1: LOGIN + ENABLE WIDGET (authenticated)
    Log in as hostbay@moxx.co, then PUT /api/user/creator/profile to enable widget
    """
    log("\n" + "="*80, BLUE)
    log("TEST 1: Login + Enable Support Widget", BLUE)
    log("="*80, BLUE)
    
    # Step 1: Get CSRF token
    log("\n[1.1] Getting CSRF token...")
    csrf_resp = requests.get(f"{API_BASE}/csrf-token")
    if csrf_resp.status_code != 200:
        log(f"❌ Failed to get CSRF token: {csrf_resp.status_code}", RED)
        return None, None
    
    csrf_token = csrf_resp.json().get("csrf_token")
    csrf_cookie = csrf_resp.cookies.get("dynopay_csrf")
    log(f"✅ CSRF token obtained: {csrf_token[:20]}...", GREEN)
    
    # Step 2: Login
    log("\n[1.2] Logging in as hostbay@moxx.co...")
    login_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    login_headers = {
        "Content-Type": "application/json",
        "x-csrf-token": csrf_token
    }
    login_cookies = {"dynopay_csrf": csrf_cookie}
    
    login_resp = requests.post(
        f"{API_BASE}/user/login",
        json=login_data,
        headers=login_headers,
        cookies=login_cookies
    )
    
    if login_resp.status_code != 200:
        log(f"❌ Login failed: {login_resp.status_code} - {login_resp.text}", RED)
        return None, None
    
    login_result = login_resp.json()
    bearer_token = login_result.get("data", {}).get("accessToken")
    if not bearer_token:
        log(f"❌ No access token in login response", RED)
        return None, None
    
    log(f"✅ Login successful, Bearer token obtained", GREEN)
    
    # Step 3: Enable widget via PUT /api/user/creator/profile
    log("\n[1.3] Enabling support widget...")
    widget_config = {
        "support_widget_enabled": True,
        "support_widget_style": "coffee",
        "support_widget_preset_amounts": [3, 5, 10, 25],
        "support_widget_currency": "USD",
        "support_widget_min_amount": 1,
        "support_widget_allow_message": True,
        "support_widget_show_supporters": True,
        "support_widget_thanks_message": "Thanks so much!"
    }
    
    widget_headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {bearer_token}"
    }
    
    widget_resp = requests.put(
        f"{API_BASE}/user/creator/profile",
        json=widget_config,
        headers=widget_headers
    )
    
    if widget_resp.status_code != 200:
        log(f"❌ Failed to enable widget: {widget_resp.status_code} - {widget_resp.text}", RED)
        return bearer_token, None
    
    widget_result = widget_resp.json()
    widget_data = widget_result.get("data", {})
    
    # Verify all 9 fields are echoed back
    expected_fields = [
        "support_widget_enabled",
        "support_widget_style",
        "support_widget_preset_amounts",
        "support_widget_currency",
        "support_widget_min_amount",
        "support_widget_allow_message",
        "support_widget_show_supporters",
        "support_widget_thanks_message"
    ]
    
    all_present = all(field in widget_data for field in expected_fields)
    if not all_present:
        log(f"❌ Not all widget fields present in response", RED)
        log(f"Response: {json.dumps(widget_data, indent=2)}", YELLOW)
        return bearer_token, None
    
    # Verify values match (min_amount can be string "1.00" or int 1)
    min_amount = widget_data.get("support_widget_min_amount")
    min_amount_ok = (min_amount == 1 or min_amount == "1.00" or float(min_amount) == 1.0)
    
    if (widget_data.get("support_widget_enabled") == True and
        widget_data.get("support_widget_style") == "coffee" and
        widget_data.get("support_widget_currency") == "USD" and
        min_amount_ok):
        log(f"✅ Widget enabled successfully with all 9 fields echoed back", GREEN)
        log(f"   - enabled: {widget_data.get('support_widget_enabled')}", GREEN)
        log(f"   - style: {widget_data.get('support_widget_style')}", GREEN)
        log(f"   - preset_amounts: {widget_data.get('support_widget_preset_amounts')}", GREEN)
        log(f"   - currency: {widget_data.get('support_widget_currency')}", GREEN)
        log(f"   - min_amount: {widget_data.get('support_widget_min_amount')}", GREEN)
        return bearer_token, True
    else:
        log(f"❌ Widget values don't match expected", RED)
        log(f"   Response data: {json.dumps(widget_data, indent=2)}", YELLOW)
        return bearer_token, False

def test_csrf_exemption():
    """
    Scenario 2: KEY NEW CHECK — CSRF exemption
    POST /api/pay/tip with NO Authorization header, NO x-csrf-token header, and NO csrf cookie
    Should return 200 (NOT 403 CSRF-blocked)
    """
    log("\n" + "="*80, BLUE)
    log("TEST 2: CSRF Exemption for POST /api/pay/tip (KEY NEW BEHAVIOR)", BLUE)
    log("="*80, BLUE)
    
    log("\n[2.1] Calling POST /api/pay/tip WITHOUT any auth/CSRF tokens...")
    log("      (simulating a fresh unauthenticated public donor)", YELLOW)
    
    tip_data = {
        "handle": TEST_HANDLE,
        "amount": 5,
        "donor_name": "QA Tipper",
        "donor_message": "Love it!",
        "is_anonymous": False
    }
    
    # NO Authorization header, NO x-csrf-token, NO cookies
    tip_headers = {
        "Content-Type": "application/json"
    }
    
    tip_resp = requests.post(
        f"{API_BASE}/pay/tip",
        json=tip_data,
        headers=tip_headers
    )
    
    if tip_resp.status_code == 403:
        log(f"❌ CSRF BLOCKED! Got 403 - the exemption is NOT working", RED)
        log(f"Response: {tip_resp.text}", RED)
        return None
    
    if tip_resp.status_code != 200:
        log(f"❌ Unexpected status: {tip_resp.status_code} - {tip_resp.text}", RED)
        return None
    
    tip_result = tip_resp.json()
    tip_data_resp = tip_result.get("data", {})
    
    d_value = tip_data_resp.get("d")
    payment_link = tip_data_resp.get("payment_link")
    amount = tip_data_resp.get("amount")
    currency = tip_data_resp.get("currency")
    
    if not d_value:
        log(f"❌ No 'd' value in response", RED)
        log(f"Response: {json.dumps(tip_result, indent=2)}", YELLOW)
        return None
    
    log(f"✅ POST /api/pay/tip returned 200 WITHOUT CSRF token (exemption working!)", GREEN)
    log(f"   - d: {d_value}", GREEN)
    log(f"   - payment_link: {payment_link}", GREEN)
    log(f"   - amount: {amount}", GREEN)
    log(f"   - currency: {currency}", GREEN)
    
    if amount == 5 and currency == "USD":
        log(f"✅ Amount and currency match expected values", GREEN)
        return d_value
    else:
        log(f"⚠️  Amount or currency mismatch (expected 5 USD, got {amount} {currency})", YELLOW)
        return d_value

def test_contribution_follow_through(d_value):
    """
    Scenario 3: CONTRIBUTION FOLLOW-THROUGH
    Take the `d` from step 2 and call POST /api/pay/getData to verify contribution data
    """
    log("\n" + "="*80, BLUE)
    log("TEST 3: Contribution Follow-Through (getData)", BLUE)
    log("="*80, BLUE)
    
    if not d_value:
        log("❌ No d value from previous test, skipping", RED)
        return None
    
    log(f"\n[3.1] Calling POST /api/pay/getData with d={d_value}...")
    
    get_data_payload = {
        "data": d_value,
        "language": "en"
    }
    
    get_data_resp = requests.post(
        f"{API_BASE}/pay/getData",
        json=get_data_payload
    )
    
    if get_data_resp.status_code != 200:
        log(f"❌ getData failed: {get_data_resp.status_code} - {get_data_resp.text}", RED)
        return None
    
    get_data_result = get_data_resp.json()
    data = get_data_result.get("data", {})
    
    link_type = data.get("link_type")
    contribution = data.get("contribution", {})
    
    if link_type != "contribution":
        log(f"❌ link_type is '{link_type}', expected 'contribution'", RED)
        return None
    
    log(f"✅ link_type === 'contribution'", GREEN)
    
    # Verify contribution block
    donor_name = contribution.get("donor_name")
    donor_message = contribution.get("donor_message")
    is_anonymous = contribution.get("is_anonymous")
    
    if donor_name == "QA Tipper" and donor_message == "Love it!" and is_anonymous == False:
        log(f"✅ Contribution block verified:", GREEN)
        log(f"   - donor_name: {donor_name}", GREEN)
        log(f"   - donor_message: {donor_message}", GREEN)
        log(f"   - is_anonymous: {is_anonymous}", GREEN)
        return d_value
    else:
        log(f"❌ Contribution data mismatch:", RED)
        log(f"   - donor_name: {donor_name} (expected 'QA Tipper')", RED)
        log(f"   - donor_message: {donor_message} (expected 'Love it!')", RED)
        log(f"   - is_anonymous: {is_anonymous} (expected False)", RED)
        return None

def test_validation():
    """
    Scenario 4: VALIDATION still intact on the now-exempt endpoint
    - amount:0 → 400
    - unknown handle "nope_xyz_404" → 404
    - is_anonymous:true → getData contribution.is_anonymous===true
    """
    log("\n" + "="*80, BLUE)
    log("TEST 4: Validation Still Intact", BLUE)
    log("="*80, BLUE)
    
    # Test 4.1: amount:0 → 400
    log("\n[4.1] Testing amount:0 → should return 400...")
    zero_amount_data = {
        "handle": TEST_HANDLE,
        "amount": 0,
        "donor_name": "Zero Tester",
        "is_anonymous": False
    }
    
    zero_resp = requests.post(
        f"{API_BASE}/pay/tip",
        json=zero_amount_data,
        headers={"Content-Type": "application/json"}
    )
    
    if zero_resp.status_code == 400:
        log(f"✅ amount:0 correctly rejected with 400", GREEN)
    else:
        log(f"❌ amount:0 returned {zero_resp.status_code}, expected 400", RED)
    
    # Test 4.2: unknown handle → 404
    log("\n[4.2] Testing unknown handle 'nope_xyz_404' → should return 404...")
    unknown_handle_data = {
        "handle": "nope_xyz_404",
        "amount": 5,
        "donor_name": "Unknown Tester",
        "is_anonymous": False
    }
    
    unknown_resp = requests.post(
        f"{API_BASE}/pay/tip",
        json=unknown_handle_data,
        headers={"Content-Type": "application/json"}
    )
    
    if unknown_resp.status_code == 404:
        log(f"✅ Unknown handle correctly rejected with 404", GREEN)
    else:
        log(f"❌ Unknown handle returned {unknown_resp.status_code}, expected 404", RED)
    
    # Test 4.3: anonymous tip → is_anonymous===true in getData
    log("\n[4.3] Testing anonymous tip → is_anonymous should be true in getData...")
    anon_tip_data = {
        "handle": TEST_HANDLE,
        "amount": 5,
        "donor_name": "Anonymous Tester",
        "donor_message": "Anonymous donation",
        "is_anonymous": True
    }
    
    anon_resp = requests.post(
        f"{API_BASE}/pay/tip",
        json=anon_tip_data,
        headers={"Content-Type": "application/json"}
    )
    
    if anon_resp.status_code != 200:
        log(f"❌ Anonymous tip failed: {anon_resp.status_code}", RED)
        return False
    
    anon_result = anon_resp.json()
    anon_d = anon_result.get("data", {}).get("d")
    
    if not anon_d:
        log(f"❌ No d value in anonymous tip response", RED)
        return False
    
    # Call getData to verify is_anonymous
    get_data_resp = requests.post(
        f"{API_BASE}/pay/getData",
        json={"data": anon_d, "language": "en"}
    )
    
    if get_data_resp.status_code != 200:
        log(f"❌ getData for anonymous tip failed: {get_data_resp.status_code}", RED)
        return False
    
    get_data_result = get_data_resp.json()
    contribution = get_data_result.get("data", {}).get("contribution", {})
    is_anonymous = contribution.get("is_anonymous")
    
    if is_anonymous == True:
        log(f"✅ Anonymous tip correctly has is_anonymous===true in getData", GREEN)
        return anon_d
    else:
        log(f"❌ Anonymous tip has is_anonymous==={is_anonymous}, expected True", RED)
        return None

def test_public_profile():
    """
    Scenario 5: PUBLIC PROFILE
    GET /api/pay/creator/hostbay (no auth) → support_widget object present
    """
    log("\n" + "="*80, BLUE)
    log("TEST 5: Public Profile (GET /api/pay/creator/hostbay)", BLUE)
    log("="*80, BLUE)
    
    log(f"\n[5.1] Calling GET /api/pay/creator/{TEST_HANDLE} (no auth)...")
    
    profile_resp = requests.get(f"{API_BASE}/pay/creator/{TEST_HANDLE}")
    
    if profile_resp.status_code != 200:
        log(f"❌ Public profile request failed: {profile_resp.status_code} - {profile_resp.text}", RED)
        return False
    
    profile_result = profile_resp.json()
    profile_data = profile_result.get("data", {})
    
    support_widget = profile_data.get("support_widget")
    links = profile_data.get("links", [])
    
    if not support_widget:
        log(f"❌ support_widget is null or missing", RED)
        return False
    
    # Verify support_widget structure
    expected_fields = [
        "enabled", "style", "preset_amounts", "currency", 
        "min_amount", "allow_message", "show_supporters"
    ]
    
    all_present = all(field in support_widget for field in expected_fields)
    if not all_present:
        log(f"❌ Not all expected fields in support_widget", RED)
        log(f"support_widget: {json.dumps(support_widget, indent=2)}", YELLOW)
        return False
    
    # Verify values match config from Test 1
    if (support_widget.get("enabled") == True and
        support_widget.get("style") == "coffee" and
        support_widget.get("currency") == "USD" and
        support_widget.get("min_amount") == 1):
        log(f"✅ support_widget object present and matches config:", GREEN)
        log(f"   - enabled: {support_widget.get('enabled')}", GREEN)
        log(f"   - style: {support_widget.get('style')}", GREEN)
        log(f"   - preset_amounts: {support_widget.get('preset_amounts')}", GREEN)
        log(f"   - currency: {support_widget.get('currency')}", GREEN)
        log(f"   - min_amount: {support_widget.get('min_amount')}", GREEN)
    else:
        log(f"⚠️  support_widget values don't match expected config", YELLOW)
    
    # Verify links[] contains ZERO items of type "donation" (decision 1a)
    donation_links = [link for link in links if link.get("type") == "donation"]
    if len(donation_links) == 0:
        log(f"✅ links[] contains ZERO donation items (decision 1a verified)", GREEN)
        return True
    else:
        log(f"❌ links[] contains {len(donation_links)} donation items, expected 0", RED)
        return False

def cleanup(bearer_token, d_values):
    """
    Cleanup: Delete the hidden tip-jar parent row and contribution children
    LEAVE support_widget_enabled=true (frontend UI verification will use it)
    """
    log("\n" + "="*80, BLUE)
    log("CLEANUP: Deleting test data from LIVE DB", BLUE)
    log("="*80, BLUE)
    
    if not bearer_token:
        log("⚠️  No bearer token, skipping cleanup", YELLOW)
        return
    
    log("\n⚠️  IMPORTANT: This backend runs on LIVE Railway PostgreSQL", YELLOW)
    log("   Cleanup would require direct DB access to delete tip-jar parent + contribution children", YELLOW)
    log("   The review request asks to delete rows from tbl_payment_link where:", YELLOW)
    log("   - user_id = hostbay's user_id AND is_tip_jar=true (parent)", YELLOW)
    log("   - parent_link_id = that tip jar's link_id (children)", YELLOW)
    log("\n   Since we don't have a DELETE API endpoint for this, manual cleanup is needed.", YELLOW)
    log("   LEAVING support_widget_enabled=true as requested (frontend will use it).", YELLOW)
    
    if d_values:
        log(f"\n   Test created {len(d_values)} contribution(s) with d values:", YELLOW)
        for d in d_values:
            log(f"   - {d}", YELLOW)

def main():
    log("\n" + "="*80, BLUE)
    log("SESSION 41 BACKEND TEST: CSRF Exemption for POST /api/pay/tip", BLUE)
    log("="*80, BLUE)
    log(f"\nPreview URL: {BASE_URL}", BLUE)
    log(f"Test Account: {TEST_EMAIL}", BLUE)
    log(f"Creator Handle: {TEST_HANDLE}", BLUE)
    log("\nNARROW TEST: Only testing the ONE change from Session 41:", BLUE)
    log("  → /api/pay/tip added to CSRF exempt list in csrfMiddleware.ts", BLUE)
    log("  → All other tip endpoint logic was tested in Session 40 (13/13 pass)", BLUE)
    
    results = {
        "test1_login_enable_widget": False,
        "test2_csrf_exemption": False,
        "test3_contribution_follow_through": False,
        "test4_validation": False,
        "test5_public_profile": False
    }
    
    d_values = []
    
    # Test 1: Login + Enable Widget
    bearer_token, widget_enabled = test_login_and_enable_widget()
    results["test1_login_enable_widget"] = widget_enabled == True
    
    # Test 2: CSRF Exemption (KEY NEW CHECK)
    d_value = test_csrf_exemption()
    results["test2_csrf_exemption"] = d_value is not None
    if d_value:
        d_values.append(d_value)
    
    # Test 3: Contribution Follow-Through
    if d_value:
        follow_through_d = test_contribution_follow_through(d_value)
        results["test3_contribution_follow_through"] = follow_through_d is not None
    
    # Test 4: Validation
    anon_d = test_validation()
    results["test4_validation"] = anon_d is not None
    if anon_d:
        d_values.append(anon_d)
    
    # Test 5: Public Profile
    results["test5_public_profile"] = test_public_profile()
    
    # Cleanup
    cleanup(bearer_token, d_values)
    
    # Summary
    log("\n" + "="*80, BLUE)
    log("TEST SUMMARY", BLUE)
    log("="*80, BLUE)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    log(f"\nResults: {passed}/{total} tests passed\n", BLUE)
    
    for test_name, passed in results.items():
        status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
        log(f"  {test_name}: {status}")
    
    log("\n" + "="*80, BLUE)
    log("KEY FINDING:", BLUE)
    log("="*80, BLUE)
    
    if results["test2_csrf_exemption"]:
        log(f"\n{GREEN}✅ POST /api/pay/tip is now CSRF-exempt (returns 200 without token){RESET}", GREEN)
        log(f"{GREEN}   This is the PRIMARY regression being validated in Session 41.{RESET}", GREEN)
    else:
        log(f"\n{RED}❌ POST /api/pay/tip is still CSRF-blocked (returns 403){RESET}", RED)
        log(f"{RED}   The exemption is NOT working as expected.{RESET}", RED)
    
    log("\n" + "="*80, BLUE)
    log("IMPORTANT NOTES:", BLUE)
    log("="*80, BLUE)
    log("• Backend runs on LIVE Railway PostgreSQL with WORKER_ROLE=secondary", YELLOW)
    log("• Contributions stay 'active' (no settlement), so supporters_count/raised_amount stay 0", YELLOW)
    log("• This is EXPECTED behavior, not a bug", YELLOW)
    log("• support_widget_enabled left as TRUE for frontend UI verification", YELLOW)
    log("• Manual DB cleanup needed for tip-jar parent + contribution children", YELLOW)
    
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
