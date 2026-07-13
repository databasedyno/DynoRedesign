#!/usr/bin/env python3
"""
Session 40: Creator Support Widget (Tip / Buy-me-a-coffee) Backend Tests
Tests the new support_widget_* fields, POST /api/pay/tip, and tip-jar exclusion logic.
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional, List

# Preview URL from test_result.md Session 40
BASE_URL = "https://86e7ba10-df55-4649-b06f-88da6c8f2a67.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"

# Test credentials (hostbay - has company + wallet + claimed creator handle "hostbay")
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

# Track created resources for cleanup
created_tip_jar_id: Optional[int] = None
created_contribution_ids: List[int] = []
test_results = []

# Use a session to maintain cookies (for CSRF)
session = requests.Session()

def log(msg: str, level: str = "INFO"):
    """Log test messages"""
    print(f"[{level}] {msg}")

def get_csrf_token() -> Optional[str]:
    """Get CSRF token for public endpoints"""
    try:
        resp = session.get(f"{API_URL}/csrf-token")
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("csrf_token")  # Fixed: key is csrf_token not csrfToken
            if token:
                log(f"✓ CSRF token obtained: {token[:20]}...")
                return token
        log(f"Failed to get CSRF token: {resp.status_code}", "WARN")
        return None
    except Exception as e:
        log(f"Error getting CSRF token: {e}", "WARN")
        return None

def login() -> Optional[str]:
    """Login and return JWT token"""
    log("Using pre-minted JWT token for hostbay@moxx.co...")
    
    # Use pre-minted 30-day JWT token (from mint_ux_tokens.js)
    token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJuYW1lIjoiSG9zdEJheSIsImVtYWlsIjoiaG9zdGJheUBtb3h4LmNvIiwidXNlcm5hbWUiOm51bGwsIm1vYmlsZSI6bnVsbCwicGhvdG8iOiJpbWFnZXMvdXNlcl9pbWFnZS5wbmciLCJsb2dpbl90eXBlIjoiRU1BSUwiLCJjdXN0b21lcl9pZCI6bnVsbCwiZXh0ZXJuYWxfaWQiOm51bGwsInN0YXR1cyI6ImFjdGl2ZSIsInZlcmlmaWVkX290cCI6bnVsbCwib3RwX2V4cGlyZWQiOm51bGwsIm90cF9jdXJyZW5jeSI6bnVsbCwicmVzZXRfdG9rZW4iOm51bGwsInJlc2V0X3Rva2VuX2V4cGlyeSI6bnVsbCwiZ29vZ2xlX2lkIjpudWxsLCJ3YWxsZXRfcmVtaW5kZXJfc2VudCI6dHJ1ZSwicmVmZXJyYWxfY29kZSI6IkRZTk8tOVhWUFVZIiwicmVmZXJyYWxfY291bnQiOjAsInJlZmVycmFsX2JvbnVzX2Vhcm5lZCI6IjAuMDAiLCJyZWZlcnJlZF9ieV9jb2RlIjpudWxsLCJyZWZlcnJlZF9ieV9yZWZlcmVlX2NvZGUiOm51bGwsImZlZV9kaXNjb3VudF9wZXJjZW50IjoiMC4wMCIsImZlZV9kaXNjb3VudF9leHBpcmVzX2F0IjpudWxsLCJmZWVfZGlzY291bnRfcmVhc29uIjpudWxsLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibGFzdF9sb2dpbl9pcCI6IjEwNC4xOTguMjE0LjIyMyIsImxhc3RfY29tcGFueV9pZCI6bnVsbCwiY3VtdWxhdGl2ZV92b2x1bWVfdXNkIjoiMTgzODkuNzIiLCJmZWVfZnJlZV9yZW1haW5pbmdfdXNkIjoiMC4wMCIsImZlZV90aWVyIjoiZ3Jvd3RoIiwiY3JlYXRlZEF0IjoiMjAyNi0wNC0xOFQxODoxOToxMS44ODdaIiwidXBkYXRlZEF0IjoiMjAyNi0wNy0xM1QwMzowMDowMS40NjBaIiwibGFuZ3VhZ2UiOiJlbiIsImhhbmRsZSI6Imhvc3RiYXkiLCJiaW8iOiJCdWlsZGluZyB0aGUgZnV0dXJlIG9mIGNyeXB0byBwYXltZW50cy4gU3VwcG9ydCBteSB3b3JrIGJlbG93ISIsImNyZWF0b3JfcGFnZV9lbmFibGVkIjp0cnVlLCJjb3Zlcl9pbWFnZSI6bnVsbCwic29jaWFsX2xpbmtzIjp7fSwiaWF0IjoxNzgzOTMxMDQ4LCJleHAiOjE3ODY1MjMwNDh9.UqpXlx0Lxbm6Sd9VwewBu6jm5h2lp3NFMkheN0lmGUY"
    
    log("✓ JWT token loaded")
    return token

def get_company_id(token: str) -> Optional[int]:
    """Get the first company_id for the logged-in user"""
    resp = requests.get(
        f"{API_URL}/company/getCompany",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code != 200:
        log(f"Failed to get company: {resp.status_code}", "ERROR")
        return None
    
    data = resp.json()
    companies = data.get("data", [])
    
    if not companies:
        log("No companies found for user", "ERROR")
        return None
    
    company_id = companies[0].get("company_id")
    log(f"Using company_id: {company_id}")
    return company_id

# ═══════════════════════════════════════════════════════════════════════════
# TEST SCENARIO 1: PUT /api/user/creator/profile - support_widget_* validation
# ═══════════════════════════════════════════════════════════════════════════

def test_configure_widget_happy_path(token: str) -> bool:
    """T1: Configure support widget with valid fields → 200"""
    log("\n=== T1: Configure support widget (happy path) ===")
    
    payload = {
        "support_widget_enabled": True,
        "support_widget_style": "coffee",
        "support_widget_preset_amounts": [3, 5, 10, 25],
        "support_widget_currency": "USD",
        "support_widget_min_amount": 1,
        "support_widget_allow_message": True,
        "support_widget_show_supporters": True,
        "support_widget_thanks_message": "Thanks so much!"
    }
    
    resp = requests.put(
        f"{API_URL}/user/creator/profile",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code != 200:
        log(f"❌ T1 FAIL: Expected 200, got {resp.status_code}: {resp.text}", "ERROR")
        return False
    
    data = resp.json().get("data", {})
    
    # Verify all fields are echoed back
    checks = [
        (data.get("support_widget_enabled") == True, "support_widget_enabled"),
        (data.get("support_widget_style") == "coffee", "support_widget_style"),
        (data.get("support_widget_currency") == "USD", "support_widget_currency"),
        (data.get("support_widget_min_amount") == 1, "support_widget_min_amount"),
        (data.get("support_widget_allow_message") == True, "support_widget_allow_message"),
        (data.get("support_widget_show_supporters") == True, "support_widget_show_supporters"),
        (data.get("support_widget_thanks_message") == "Thanks so much!", "support_widget_thanks_message"),
    ]
    
    # Check preset_amounts (could be array or string)
    presets = data.get("support_widget_preset_amounts")
    if isinstance(presets, list):
        checks.append((presets == [3, 5, 10, 25], "support_widget_preset_amounts (array)"))
    elif isinstance(presets, str):
        checks.append((presets == "3,5,10,25", "support_widget_preset_amounts (string)"))
    else:
        checks.append((False, "support_widget_preset_amounts (unknown type)"))
    
    # min_amount might be returned as float (1.0) instead of int (1)
    min_amt = data.get("support_widget_min_amount")
    if min_amt is not None:
        checks[3] = (float(min_amt) == 1.0, "support_widget_min_amount")
    
    failed = [name for passed, name in checks if not passed]
    if failed:
        log(f"❌ T1 FAIL: Fields not echoed correctly: {', '.join(failed)}", "ERROR")
        log(f"   Response data: {json.dumps(data, indent=2)}")
        return False
    
    log("✅ T1 PASS: Widget configured successfully, all fields echoed")
    return True

def test_configure_widget_invalid_style(token: str) -> bool:
    """T2: Invalid style → 400"""
    log("\n=== T2: Configure widget with invalid style ===")
    
    payload = {
        "support_widget_enabled": True,
        "support_widget_style": "xyz"  # Invalid
    }
    
    resp = requests.put(
        f"{API_URL}/user/creator/profile",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code != 400:
        log(f"❌ T2 FAIL: Expected 400, got {resp.status_code}", "ERROR")
        return False
    
    log("✅ T2 PASS: Invalid style rejected with 400")
    return True

def test_configure_widget_too_many_presets(token: str) -> bool:
    """T3: More than 5 preset amounts → 400"""
    log("\n=== T3: Configure widget with >5 preset amounts ===")
    
    payload = {
        "support_widget_enabled": True,
        "support_widget_preset_amounts": [1, 2, 3, 4, 5, 6]  # 6 items
    }
    
    resp = requests.put(
        f"{API_URL}/user/creator/profile",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code != 400:
        log(f"❌ T3 FAIL: Expected 400, got {resp.status_code}", "ERROR")
        return False
    
    log("✅ T3 PASS: Too many presets rejected with 400")
    return True

def test_configure_widget_invalid_min_amount(token: str) -> bool:
    """T4: min_amount <= 0 → 400"""
    log("\n=== T4: Configure widget with min_amount=0 ===")
    
    payload = {
        "support_widget_enabled": True,
        "support_widget_min_amount": 0
    }
    
    resp = requests.put(
        f"{API_URL}/user/creator/profile",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code != 400:
        log(f"❌ T4 FAIL: Expected 400, got {resp.status_code}", "ERROR")
        return False
    
    log("✅ T4 PASS: min_amount=0 rejected with 400")
    return True

def test_configure_widget_invalid_currency(token: str) -> bool:
    """T5: Invalid currency (not 3-letter code) → 400"""
    log("\n=== T5: Configure widget with invalid currency ===")
    
    payload = {
        "support_widget_enabled": True,
        "support_widget_currency": "US"  # Only 2 letters
    }
    
    resp = requests.put(
        f"{API_URL}/user/creator/profile",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code != 400:
        log(f"❌ T5 FAIL: Expected 400, got {resp.status_code}", "ERROR")
        return False
    
    log("✅ T5 PASS: Invalid currency rejected with 400")
    return True

# ═══════════════════════════════════════════════════════════════════════════
# TEST SCENARIO 2: GET /api/pay/creator/:handle - support_widget + donations excluded
# ═══════════════════════════════════════════════════════════════════════════

def test_creator_profile_with_widget() -> bool:
    """T6: GET /api/pay/creator/hostbay returns support_widget object"""
    log("\n=== T6: GET /api/pay/creator/hostbay (widget enabled) ===")
    
    resp = requests.get(f"{API_URL}/pay/creator/hostbay")
    
    if resp.status_code != 200:
        log(f"❌ T6 FAIL: Expected 200, got {resp.status_code}: {resp.text}", "ERROR")
        return False
    
    data = resp.json().get("data", {})
    support_widget = data.get("support_widget")
    
    if not support_widget:
        log("❌ T6 FAIL: support_widget is null or missing", "ERROR")
        return False
    
    # Verify widget structure
    checks = [
        (support_widget.get("enabled") == True, "enabled"),
        (support_widget.get("style") == "coffee", "style"),
        (support_widget.get("currency") == "USD", "currency"),
        (support_widget.get("min_amount") == 1, "min_amount"),
        (support_widget.get("allow_message") == True, "allow_message"),
        (support_widget.get("show_supporters") == True, "show_supporters"),
        (isinstance(support_widget.get("preset_amounts"), list), "preset_amounts is list"),
    ]
    
    failed = [name for passed, name in checks if not passed]
    if failed:
        log(f"❌ T6 FAIL: Widget fields incorrect: {', '.join(failed)}", "ERROR")
        return False
    
    # Check that links[] has ZERO items with type==="donation"
    links = data.get("links", [])
    donation_links = [l for l in links if l.get("type") == "donation"]
    if donation_links:
        log(f"❌ T6 FAIL: Found {len(donation_links)} donation links in links[] (should be 0)", "ERROR")
        return False
    
    log("✅ T6 PASS: support_widget present, donations excluded from links[]")
    return True

def test_creator_profile_widget_disabled(token: str) -> bool:
    """T7: Disable widget → support_widget is null"""
    log("\n=== T7: Disable widget, verify support_widget=null ===")
    
    # Disable widget
    resp = requests.put(
        f"{API_URL}/user/creator/profile",
        json={"support_widget_enabled": False},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code != 200:
        log(f"❌ T7 FAIL: Failed to disable widget: {resp.status_code}", "ERROR")
        return False
    
    # Check creator profile
    resp = requests.get(f"{API_URL}/pay/creator/hostbay")
    
    if resp.status_code != 200:
        log(f"❌ T7 FAIL: Expected 200, got {resp.status_code}", "ERROR")
        return False
    
    data = resp.json().get("data", {})
    support_widget = data.get("support_widget")
    
    if support_widget is not None:
        log(f"❌ T7 FAIL: support_widget should be null, got: {support_widget}", "ERROR")
        return False
    
    log("✅ T7 PASS: Widget disabled, support_widget=null")
    
    # Re-enable for subsequent tests
    requests.put(
        f"{API_URL}/user/creator/profile",
        json={"support_widget_enabled": True},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    return True

# ═══════════════════════════════════════════════════════════════════════════
# TEST SCENARIO 3: POST /api/pay/tip - happy path + getData
# ═══════════════════════════════════════════════════════════════════════════

def test_tip_happy_path(csrf_token: Optional[str]) -> Dict[str, Any]:
    """T8: POST /api/pay/tip happy path → 200 + getData returns contribution"""
    log("\n=== T8: POST /api/pay/tip (happy path) ===")
    
    payload = {
        "handle": "hostbay",
        "amount": 5,
        "donor_name": "QA Tipper",
        "donor_message": "Love your work!",
        "is_anonymous": False
    }
    
    headers = {}
    if csrf_token:
        headers["x-csrf-token"] = csrf_token
    
    resp = session.post(f"{API_URL}/pay/tip", json=payload, headers=headers)
    
    if resp.status_code != 200:
        log(f"❌ T8 FAIL: Expected 200, got {resp.status_code}: {resp.text}", "ERROR")
        return {}
    
    data = resp.json().get("data", {})
    
    # Verify response structure
    checks = [
        ("d" in data, "d (uniqueRef)"),
        ("payment_link" in data, "payment_link"),
        (data.get("amount") == 5, "amount"),
        (data.get("currency") == "USD", "currency"),
    ]
    
    failed = [name for passed, name in checks if not passed]
    if failed:
        log(f"❌ T8 FAIL: Response fields incorrect: {', '.join(failed)}", "ERROR")
        return {}
    
    log(f"✅ T8 PASS: Tip started, d={data['d']}")
    
    # Now call getData to verify contribution block
    child_ref = data["d"]
    getData_resp = session.post(
        f"{API_URL}/pay/getData",
        json={"data": child_ref, "language": "en"}
    )
    
    if getData_resp.status_code != 200:
        log(f"❌ T8 FAIL: getData returned {getData_resp.status_code}", "ERROR")
        return {}
    
    getData_data = getData_resp.json().get("data", {})
    
    # Verify link_type === "contribution"
    if getData_data.get("link_type") != "contribution":
        log(f"❌ T8 FAIL: link_type should be 'contribution', got '{getData_data.get('link_type')}'", "ERROR")
        return {}
    
    # Verify contribution block
    contribution = getData_data.get("contribution")
    if not contribution:
        log("❌ T8 FAIL: contribution block missing", "ERROR")
        return {}
    
    contrib_checks = [
        (contribution.get("campaign_title") in ["Buy me a coffee", "Thanks so much!"], "campaign_title"),
        (contribution.get("donor_name") == "QA Tipper", "donor_name"),
        (contribution.get("donor_message") == "Love your work!", "donor_message"),
        (contribution.get("is_anonymous") == False, "is_anonymous"),
    ]
    
    failed_contrib = [name for passed, name in contrib_checks if not passed]
    if failed_contrib:
        log(f"❌ T8 FAIL: Contribution fields incorrect: {', '.join(failed_contrib)}", "ERROR")
        log(f"   contribution block: {json.dumps(contribution, indent=2)}")
        return {}
    
    log("✅ T8 PASS: getData returns link_type='contribution' with correct donor info")
    
    return data

# ═══════════════════════════════════════════════════════════════════════════
# TEST SCENARIO 4: Tip jar hidden from merchant list + creator page
# ═══════════════════════════════════════════════════════════════════════════

def test_tip_jar_hidden(token: str, company_id: int) -> bool:
    """T9: Verify tip jar (is_tip_jar=true) is hidden from getPaymentLinks and creator page"""
    log("\n=== T9: Verify tip jar is hidden ===")
    
    # Check merchant list
    resp = requests.get(
        f"{API_URL}/pay/getPaymentLinks?company_id={company_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code != 200:
        log(f"❌ T9 FAIL: getPaymentLinks returned {resp.status_code}", "ERROR")
        return False
    
    data = resp.json().get("data", [])
    
    # Check if any link has is_tip_jar=true or title contains "Buy me a coffee"
    tip_jars = [l for l in data if l.get("is_tip_jar") == True or "coffee" in str(l.get("title", "")).lower()]
    if tip_jars:
        log(f"❌ T9 FAIL: Found tip jar in merchant list: {tip_jars}", "ERROR")
        return False
    
    log("✅ T9 PASS (part 1): Tip jar not in merchant getPaymentLinks")
    
    # Check creator page
    resp = requests.get(f"{API_URL}/pay/creator/hostbay")
    
    if resp.status_code != 200:
        log(f"❌ T9 FAIL: creator page returned {resp.status_code}", "ERROR")
        return False
    
    data = resp.json().get("data", {})
    links = data.get("links", [])
    
    # Check if any link is a donation (tip jar is a donation with is_tip_jar=true)
    donation_links = [l for l in links if l.get("type") == "donation"]
    if donation_links:
        log(f"❌ T9 FAIL: Found donation links on creator page: {donation_links}", "ERROR")
        return False
    
    log("✅ T9 PASS (part 2): Tip jar not in creator page links[]")
    return True

# ═══════════════════════════════════════════════════════════════════════════
# TEST SCENARIO 5: Tip validation (amount=0, unknown handle, anonymous)
# ═══════════════════════════════════════════════════════════════════════════

def test_tip_validation_amount_zero(csrf_token: Optional[str]) -> bool:
    """T10: amount=0 → 400"""
    log("\n=== T10: Tip with amount=0 ===")
    
    payload = {
        "handle": "hostbay",
        "amount": 0,
        "donor_name": "QA Tipper"
    }
    
    headers = {}
    if csrf_token:
        headers["x-csrf-token"] = csrf_token
    
    resp = session.post(f"{API_URL}/pay/tip", json=payload, headers=headers)
    
    if resp.status_code != 400:
        log(f"❌ T10 FAIL: Expected 400, got {resp.status_code}", "ERROR")
        return False
    
    log("✅ T10 PASS: amount=0 rejected with 400")
    return True

def test_tip_validation_unknown_handle(csrf_token: Optional[str]) -> bool:
    """T11: unknown handle → 404"""
    log("\n=== T11: Tip with unknown handle ===")
    
    payload = {
        "handle": "nope_xyz_12345",
        "amount": 5,
        "donor_name": "QA Tipper"
    }
    
    headers = {}
    if csrf_token:
        headers["x-csrf-token"] = csrf_token
    
    resp = session.post(f"{API_URL}/pay/tip", json=payload, headers=headers)
    
    if resp.status_code != 404:
        log(f"❌ T11 FAIL: Expected 404, got {resp.status_code}", "ERROR")
        return False
    
    log("✅ T11 PASS: Unknown handle rejected with 404")
    return True

def test_tip_anonymous(csrf_token: Optional[str]) -> bool:
    """T12: Anonymous tip → getData returns is_anonymous=true"""
    log("\n=== T12: Anonymous tip ===")
    
    payload = {
        "handle": "hostbay",
        "amount": 3,
        "donor_name": "Anonymous Donor",
        "donor_message": "Keep up the great work!",
        "is_anonymous": True
    }
    
    headers = {}
    if csrf_token:
        headers["x-csrf-token"] = csrf_token
    
    resp = session.post(f"{API_URL}/pay/tip", json=payload, headers=headers)
    
    if resp.status_code != 200:
        log(f"❌ T12 FAIL: Expected 200, got {resp.status_code}: {resp.text}", "ERROR")
        return False
    
    data = resp.json().get("data", {})
    child_ref = data.get("d")
    
    if not child_ref:
        log("❌ T12 FAIL: No 'd' in response", "ERROR")
        return False
    
    # Call getData
    getData_resp = session.post(
        f"{API_URL}/pay/getData",
        json={"data": child_ref, "language": "en"}
    )
    
    if getData_resp.status_code != 200:
        log(f"❌ T12 FAIL: getData returned {getData_resp.status_code}", "ERROR")
        return False
    
    getData_data = getData_resp.json().get("data", {})
    contribution = getData_data.get("contribution")
    
    if not contribution:
        log("❌ T12 FAIL: contribution block missing", "ERROR")
        return False
    
    if contribution.get("is_anonymous") != True:
        log(f"❌ T12 FAIL: is_anonymous should be true, got {contribution.get('is_anonymous')}", "ERROR")
        return False
    
    log("✅ T12 PASS: Anonymous tip, getData returns is_anonymous=true")
    return True

# ═══════════════════════════════════════════════════════════════════════════
# TEST SCENARIO 6: Tip jar reuse (second tip uses same parent)
# ═══════════════════════════════════════════════════════════════════════════

def test_tip_jar_reuse(csrf_token: Optional[str]) -> bool:
    """T13: Second tip reuses the same tip-jar parent"""
    log("\n=== T13: Tip jar reuse (second tip) ===")
    
    headers = {}
    if csrf_token:
        headers["x-csrf-token"] = csrf_token
    
    # First tip
    payload1 = {
        "handle": "hostbay",
        "amount": 5,
        "donor_name": "First Tipper"
    }
    
    resp1 = session.post(f"{API_URL}/pay/tip", json=payload1, headers=headers)
    
    if resp1.status_code != 200:
        log(f"❌ T13 FAIL: First tip failed: {resp1.status_code}", "ERROR")
        return False
    
    data1 = resp1.json().get("data", {})
    child_ref1 = data1.get("d")
    
    # Get parent_link_id from first tip
    getData1_resp = session.post(
        f"{API_URL}/pay/getData",
        json={"data": child_ref1, "language": "en"}
    )
    
    if getData1_resp.status_code != 200:
        log(f"❌ T13 FAIL: getData for first tip failed", "ERROR")
        return False
    
    getData1_data = getData1_resp.json().get("data", {})
    contribution1 = getData1_data.get("contribution")
    parent_link_id1 = contribution1.get("parent_link_id") if contribution1 else None
    
    if not parent_link_id1:
        log("❌ T13 FAIL: No parent_link_id in first tip contribution", "ERROR")
        return False
    
    log(f"First tip parent_link_id: {parent_link_id1}")
    
    # Second tip
    time.sleep(1)  # Small delay
    payload2 = {
        "handle": "hostbay",
        "amount": 10,
        "donor_name": "Second Tipper"
    }
    
    resp2 = session.post(f"{API_URL}/pay/tip", json=payload2, headers=headers)
    
    if resp2.status_code != 200:
        log(f"❌ T13 FAIL: Second tip failed: {resp2.status_code}", "ERROR")
        return False
    
    data2 = resp2.json().get("data", {})
    child_ref2 = data2.get("d")
    
    # Get parent_link_id from second tip
    getData2_resp = session.post(
        f"{API_URL}/pay/getData",
        json={"data": child_ref2, "language": "en"}
    )
    
    if getData2_resp.status_code != 200:
        log(f"❌ T13 FAIL: getData for second tip failed", "ERROR")
        return False
    
    getData2_data = getData2_resp.json().get("data", {})
    contribution2 = getData2_data.get("contribution")
    parent_link_id2 = contribution2.get("parent_link_id") if contribution2 else None
    
    if not parent_link_id2:
        log("❌ T13 FAIL: No parent_link_id in second tip contribution", "ERROR")
        return False
    
    log(f"Second tip parent_link_id: {parent_link_id2}")
    
    # Verify they're the same
    if parent_link_id1 != parent_link_id2:
        log(f"❌ T13 FAIL: parent_link_id mismatch: {parent_link_id1} != {parent_link_id2}", "ERROR")
        return False
    
    log("✅ T13 PASS: Second tip reuses same tip-jar parent")
    
    # Store for cleanup
    global created_tip_jar_id
    created_tip_jar_id = parent_link_id1
    
    return True

# ═══════════════════════════════════════════════════════════════════════════
# CLEANUP
# ═══════════════════════════════════════════════════════════════════════════

def cleanup(token: str):
    """Clean up test data from LIVE Railway DB"""
    log("\n=== CLEANUP ===")
    
    # Note: We need to delete tip-jar parent + contribution children
    # The backend doesn't expose a direct DELETE endpoint for payment links by link_id
    # We'll need to use the deletePaymentLink endpoint if available
    
    if created_tip_jar_id:
        log(f"Attempting to delete tip-jar parent (link_id={created_tip_jar_id})...")
        resp = requests.delete(
            f"{API_URL}/pay/deletePaymentLink/{created_tip_jar_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        if resp.status_code == 200:
            log(f"✓ Deleted tip-jar parent {created_tip_jar_id}")
        else:
            log(f"⚠ Failed to delete tip-jar parent {created_tip_jar_id}: {resp.status_code}", "WARN")
    
    # Optionally disable the widget
    log("Setting support_widget_enabled back to false...")
    resp = requests.put(
        f"{API_URL}/user/creator/profile",
        json={"support_widget_enabled": False},
        headers={"Authorization": f"Bearer {token}"}
    )
    if resp.status_code == 200:
        log("✓ Widget disabled")
    else:
        log(f"⚠ Failed to disable widget: {resp.status_code}", "WARN")
    
    log("Cleanup complete (note: contribution children may remain if parent delete didn't cascade)")

# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

def main():
    log("=" * 80)
    log("Session 40: Creator Support Widget Backend Tests")
    log("=" * 80)
    
    # Login
    token = login()
    if not token:
        log("Failed to login", "ERROR")
        sys.exit(1)
    
    # Get company_id
    company_id = get_company_id(token)
    if not company_id:
        log("Failed to get company_id", "ERROR")
        sys.exit(1)
    
    # Get CSRF token for public endpoints
    csrf_token = get_csrf_token()
    if not csrf_token:
        log("Warning: No CSRF token obtained, tip tests may fail", "WARN")
    
    # Run tests
    results = []
    
    # Scenario 1: Widget configuration
    results.append(("T1: Configure widget (happy path)", test_configure_widget_happy_path(token)))
    results.append(("T2: Invalid style", test_configure_widget_invalid_style(token)))
    results.append(("T3: Too many presets", test_configure_widget_too_many_presets(token)))
    results.append(("T4: Invalid min_amount", test_configure_widget_invalid_min_amount(token)))
    results.append(("T5: Invalid currency", test_configure_widget_invalid_currency(token)))
    
    # Scenario 2: Creator profile
    results.append(("T6: Creator profile with widget", test_creator_profile_with_widget()))
    results.append(("T7: Widget disabled → null", test_creator_profile_widget_disabled(token)))
    
    # Scenario 3: Tip happy path
    results.append(("T8: Tip happy path + getData", bool(test_tip_happy_path(csrf_token))))
    
    # Scenario 4: Tip jar hidden
    results.append(("T9: Tip jar hidden", test_tip_jar_hidden(token, company_id)))
    
    # Scenario 5: Tip validation
    results.append(("T10: Tip amount=0", test_tip_validation_amount_zero(csrf_token)))
    results.append(("T11: Tip unknown handle", test_tip_validation_unknown_handle(csrf_token)))
    results.append(("T12: Tip anonymous", test_tip_anonymous(csrf_token)))
    
    # Scenario 6: Tip jar reuse
    results.append(("T13: Tip jar reuse", test_tip_jar_reuse(csrf_token)))
    
    # Cleanup
    cleanup(token)
    
    # Summary
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        log(f"{status}: {name}")
    
    log(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        log("\n🎉 ALL TESTS PASSED!", "INFO")
        sys.exit(0)
    else:
        log(f"\n⚠️  {total - passed} test(s) failed", "ERROR")
        sys.exit(1)

if __name__ == "__main__":
    main()
