#!/usr/bin/env python3
"""
Backend test for DynoPay company name bug fix verification.

Bug: Creating a company wrote the company-form's first/last name into the account holder's 
GLOBAL `tbl_user.name` on EVERY company creation. So creating a SECOND company with a 
different first/last name OVERWROTE the account name.

Fix: (A) Account `user.name` is only seeded the FIRST time (when empty) and NEVER overwritten 
by later company creation; (B) Each company now stores its own `contact_first_name` / 
`contact_last_name` (new columns on tbl_company).
"""

import requests
import json
import time
from datetime import datetime

# Base URL
BASE_URL = "https://5a08d09d-24f7-4f72-942d-454f2d1c9727.preview.emergentagent.com"

# Test configuration
USE_FRESH_USER = True  # Try to register a fresh user first
FALLBACK_EMAIL = "hostbay@moxx.co"
FALLBACK_PASSWORD = "Katiekendra123@"

# Session state
session = requests.Session()
csrf_token = None
jwt_token = None
test_companies = []  # Track companies to delete


def log(msg):
    """Print timestamped log message."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def get_csrf_token():
    """Get CSRF token."""
    global csrf_token
    log("Getting CSRF token...")
    resp = session.get(f"{BASE_URL}/api/csrf-token")
    resp.raise_for_status()
    data = resp.json()
    csrf_token = data.get("csrf_token") or data.get("csrfToken")
    log(f"✓ CSRF token obtained: {csrf_token[:20]}...")
    return csrf_token


def register_user():
    """Try to register a fresh throwaway user."""
    timestamp = int(time.time())
    email = f"qa.namebug.{timestamp}@dynopaytest.com"
    password = "QaNameBug#2026"
    name = ""  # Start with empty name to test first-time seeding
    
    log(f"Attempting to register fresh user: {email} (with empty name)")
    
    # Get fresh CSRF token
    get_csrf_token()
    
    payload = {
        "email": email,
        "password": password,
        "name": name
    }
    
    headers = {
        "Content-Type": "application/json",
        "x-csrf-token": csrf_token
    }
    
    try:
        resp = session.post(
            f"{BASE_URL}/api/user/registerUser",
            json=payload,
            headers=headers
        )
        
        if resp.status_code == 200 or resp.status_code == 201:
            log(f"✓ Registration successful for {email}")
            return email, password
        else:
            log(f"✗ Registration failed: {resp.status_code} - {resp.text[:200]}")
            return None, None
    except Exception as e:
        log(f"✗ Registration error: {e}")
        return None, None


def login(email, password):
    """Login and get JWT token."""
    global jwt_token
    
    log(f"Logging in as {email}...")
    
    # Get fresh CSRF token
    get_csrf_token()
    
    payload = {
        "email": email,
        "password": password
    }
    
    headers = {
        "Content-Type": "application/json",
        "x-csrf-token": csrf_token
    }
    
    resp = session.post(
        f"{BASE_URL}/api/user/login",
        json=payload,
        headers=headers
    )
    
    if resp.status_code != 200:
        log(f"✗ Login failed: {resp.status_code} - {resp.text[:200]}")
        return False
    
    data = resp.json()
    # Try multiple possible locations for the token
    jwt_token = (
        data.get("data", {}).get("accessToken") or
        data.get("data", {}).get("token") or 
        data.get("token") or 
        data.get("accessToken")
    )
    
    if not jwt_token:
        log(f"✗ No JWT token in response")
        log(f"Response data: {json.dumps(data)[:500]}")
        return False
    
    log(f"✓ Login successful, JWT: {jwt_token[:30]}...")
    return True


def get_profile():
    """Get user profile to check account name."""
    log("Getting user profile...")
    
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "x-csrf-token": csrf_token
    }
    
    resp = session.get(
        f"{BASE_URL}/api/user/profile",
        headers=headers
    )
    
    if resp.status_code != 200:
        log(f"✗ Profile fetch failed: {resp.status_code} - {resp.text[:200]}")
        return None
    
    data = resp.json()
    profile = data.get("data") or data
    name = profile.get("name") or ""
    
    log(f"✓ Profile name: '{name}'")
    return name


def create_company(company_name, email, first_name, last_name):
    """Create a company with given details."""
    log(f"Creating company: {company_name} (contact: {first_name} {last_name})...")
    
    # Get fresh CSRF token
    get_csrf_token()
    
    payload = {
        "company_name": company_name,
        "email": email,
        "first_name": first_name,
        "last_name": last_name
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
        "x-csrf-token": csrf_token
    }
    
    resp = session.post(
        f"{BASE_URL}/api/company/addCompany",
        json=payload,
        headers=headers
    )
    
    if resp.status_code not in [200, 201]:
        log(f"✗ Company creation failed: {resp.status_code} - {resp.text[:300]}")
        return None
    
    data = resp.json()
    company = data.get("data") or data.get("company") or data
    company_id = company.get("company_id") or company.get("id")
    
    if company_id:
        test_companies.append(company_id)
        log(f"✓ Company created: ID={company_id}")
    else:
        log(f"⚠ Company created but no ID found in response: {json.dumps(data)[:200]}")
    
    return company_id


def get_companies():
    """Get list of companies."""
    log("Getting company list...")
    
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "x-csrf-token": csrf_token
    }
    
    resp = session.get(
        f"{BASE_URL}/api/company/getCompany",
        headers=headers
    )
    
    if resp.status_code != 200:
        log(f"✗ Company list fetch failed: {resp.status_code} - {resp.text[:200]}")
        return []
    
    data = resp.json()
    companies = data.get("data") or data.get("companies") or []
    
    log(f"✓ Found {len(companies)} companies")
    return companies


def update_company(company_id, first_name, last_name, company_name=None):
    """Update company contact details."""
    log(f"Updating company {company_id} to: {first_name} {last_name}...")
    
    # Get fresh CSRF token
    get_csrf_token()
    
    payload = {
        "first_name": first_name,
        "last_name": last_name
    }
    
    # Add company_name if provided to ensure we have valid update data
    if company_name:
        payload["company_name"] = company_name
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
        "x-csrf-token": csrf_token
    }
    
    resp = session.put(
        f"{BASE_URL}/api/company/updateCompany/{company_id}",
        json=payload,
        headers=headers
    )
    
    if resp.status_code != 200:
        log(f"✗ Company update failed: {resp.status_code} - {resp.text[:200]}")
        return False
    
    log(f"✓ Company updated")
    return True


def delete_company(company_id):
    """Delete a company."""
    log(f"Deleting company {company_id}...")
    
    # Get fresh CSRF token
    get_csrf_token()
    
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "x-csrf-token": csrf_token
    }
    
    resp = session.delete(
        f"{BASE_URL}/api/company/deleteCompany/{company_id}",
        headers=headers
    )
    
    if resp.status_code != 200:
        log(f"✗ Company deletion failed: {resp.status_code} - {resp.text[:200]}")
        return False
    
    log(f"✓ Company deleted")
    return True


def cleanup():
    """Delete all test companies."""
    if not test_companies:
        log("No test companies to clean up")
        return
    
    log(f"\n{'='*60}")
    log("CLEANUP: Deleting test companies...")
    log(f"{'='*60}")
    
    for company_id in test_companies:
        try:
            delete_company(company_id)
        except Exception as e:
            log(f"✗ Error deleting company {company_id}: {e}")


def run_tests():
    """Run the bug verification tests."""
    log(f"\n{'='*60}")
    log("DYNOPAY COMPANY NAME BUG FIX VERIFICATION")
    log(f"{'='*60}\n")
    
    # Step 1: Setup - Register or use fallback
    email, password = None, None
    
    if USE_FRESH_USER:
        email, password = register_user()
    
    if not email:
        log(f"Using fallback account: {FALLBACK_EMAIL}")
        email = FALLBACK_EMAIL
        password = FALLBACK_PASSWORD
    
    # Step 2: Login
    if not login(email, password):
        log("\n✗ FATAL: Login failed, cannot continue")
        return False
    
    # Step 3: Record initial account name (name0)
    log(f"\n{'='*60}")
    log("TEST STEP 1: Record initial account name")
    log(f"{'='*60}")
    
    name0 = get_profile()
    if name0 is None:
        log("✗ FATAL: Could not get initial profile")
        return False
    
    log(f"✓ Initial account name (name0): '{name0}'")
    
    # Step 4: Create Company A
    log(f"\n{'='*60}")
    log("TEST STEP 2: Create Company A (Alice Anderson)")
    log(f"{'='*60}")
    
    timestamp = int(time.time())
    company_a_id = create_company(
        company_name=f"QA Alpha {timestamp}",
        email=f"qa.alpha.{timestamp}@dynopaytest.com",
        first_name="Alice",
        last_name="Anderson"
    )
    
    if not company_a_id:
        log("✗ FATAL: Could not create Company A")
        cleanup()
        return False
    
    # Step 5: Check account name after Company A
    log(f"\n{'='*60}")
    log("TEST STEP 3: Check account name after Company A")
    log(f"{'='*60}")
    
    nameAfterA = get_profile()
    if nameAfterA is None:
        log("✗ FATAL: Could not get profile after Company A")
        cleanup()
        return False
    
    log(f"✓ Account name after Company A (nameAfterA): '{nameAfterA}'")
    
    # For fresh account, name should now be "Alice Anderson"
    # For hostbay, name should remain "hostbay" or original name
    if name0 == "":
        expected_after_a = "Alice Anderson"
        if nameAfterA != expected_after_a:
            log(f"⚠ WARNING: Fresh account name should be '{expected_after_a}' but got '{nameAfterA}'")
    else:
        log(f"✓ Existing account - name remains: '{nameAfterA}'")
    
    # Step 6: Create Company B
    log(f"\n{'='*60}")
    log("TEST STEP 4: Create Company B (Bob Brown)")
    log(f"{'='*60}")
    
    company_b_id = create_company(
        company_name=f"QA Bravo {timestamp}",
        email=f"qa.bravo.{timestamp}@dynopaytest.com",
        first_name="Bob",
        last_name="Brown"
    )
    
    if not company_b_id:
        log("✗ FATAL: Could not create Company B")
        cleanup()
        return False
    
    # Step 7: PRIMARY ASSERTION - Check account name after Company B
    log(f"\n{'='*60}")
    log("TEST STEP 5: PRIMARY ASSERTION - Account name after Company B")
    log(f"{'='*60}")
    
    nameAfterB = get_profile()
    if nameAfterB is None:
        log("✗ FATAL: Could not get profile after Company B")
        cleanup()
        return False
    
    log(f"✓ Account name after Company B (nameAfterB): '{nameAfterB}'")
    
    # PRIMARY ASSERTION: nameAfterB MUST EQUAL nameAfterA
    log(f"\n{'*'*60}")
    log("PRIMARY ASSERTION CHECK:")
    log(f"  nameAfterA: '{nameAfterA}'")
    log(f"  nameAfterB: '{nameAfterB}'")
    log(f"  Expected: nameAfterB == nameAfterA")
    
    if nameAfterB == nameAfterA:
        log(f"✅ PASS: Account name unchanged after creating Company B")
        primary_pass = True
    else:
        log(f"❌ FAIL: Account name changed from '{nameAfterA}' to '{nameAfterB}'")
        log(f"❌ BUG NOT FIXED: Creating Company B overwrote the account name!")
        primary_pass = False
    log(f"{'*'*60}\n")
    
    # Step 8: Verify company contact fields
    log(f"\n{'='*60}")
    log("TEST STEP 6: Verify company contact fields")
    log(f"{'='*60}")
    
    companies = get_companies()
    
    company_a = None
    company_b = None
    
    for company in companies:
        cid = company.get("company_id") or company.get("id")
        if cid == company_a_id:
            company_a = company
        elif cid == company_b_id:
            company_b = company
    
    contact_fields_pass = True
    
    company_b_name = None  # Store for later update
    
    if company_a:
        a_first = company_a.get("contact_first_name", "")
        a_last = company_a.get("contact_last_name", "")
        log(f"Company A contact: first_name='{a_first}', last_name='{a_last}'")
        
        if a_first == "Alice" and a_last == "Anderson":
            log(f"✅ PASS: Company A has correct contact fields")
        else:
            log(f"❌ FAIL: Company A contact fields incorrect (expected Alice Anderson)")
            contact_fields_pass = False
    else:
        log(f"✗ WARNING: Could not find Company A in list")
        contact_fields_pass = False
    
    if company_b:
        b_first = company_b.get("contact_first_name", "")
        b_last = company_b.get("contact_last_name", "")
        company_b_name = company_b.get("company_name")  # Store for update
        log(f"Company B contact: first_name='{b_first}', last_name='{b_last}'")
        
        if b_first == "Bob" and b_last == "Brown":
            log(f"✅ PASS: Company B has correct contact fields")
        else:
            log(f"❌ FAIL: Company B contact fields incorrect (expected Bob Brown)")
            contact_fields_pass = False
    else:
        log(f"✗ WARNING: Could not find Company B in list")
        contact_fields_pass = False
    
    # Step 9: Update Company B
    log(f"\n{'='*60}")
    log("TEST STEP 7: Update Company B (Carol Clark)")
    log(f"{'='*60}")
    
    if not update_company(company_b_id, "Carol", "Clark", company_b_name):
        log("✗ WARNING: Could not update Company B")
    
    # Step 10: Verify updated contact fields
    log(f"\n{'='*60}")
    log("TEST STEP 8: Verify updated Company B contact fields")
    log(f"{'='*60}")
    
    companies = get_companies()
    company_b_updated = None
    
    for company in companies:
        cid = company.get("company_id") or company.get("id")
        if cid == company_b_id:
            company_b_updated = company
            break
    
    update_pass = True
    
    if company_b_updated:
        b_first = company_b_updated.get("contact_first_name", "")
        b_last = company_b_updated.get("contact_last_name", "")
        log(f"Company B updated contact: first_name='{b_first}', last_name='{b_last}'")
        
        if b_first == "Carol" and b_last == "Clark":
            log(f"✅ PASS: Company B contact fields updated correctly")
        else:
            log(f"❌ FAIL: Company B contact fields not updated (expected Carol Clark)")
            update_pass = False
    else:
        log(f"✗ WARNING: Could not find Company B after update")
        update_pass = False
    
    # Step 11: Verify account name still unchanged after update
    log(f"\n{'='*60}")
    log("TEST STEP 9: Verify account name unchanged after update")
    log(f"{'='*60}")
    
    nameAfterUpdate = get_profile()
    if nameAfterUpdate is None:
        log("✗ WARNING: Could not get profile after update")
    else:
        log(f"✓ Account name after update: '{nameAfterUpdate}'")
        
        if nameAfterUpdate == nameAfterB:
            log(f"✅ PASS: Account name unchanged after Company B update")
        else:
            log(f"❌ FAIL: Account name changed from '{nameAfterB}' to '{nameAfterUpdate}' after update")
            update_pass = False
    
    # Cleanup
    cleanup()
    
    # Final summary
    log(f"\n{'='*60}")
    log("FINAL TEST SUMMARY")
    log(f"{'='*60}")
    
    log(f"Test account: {email}")
    log(f"Initial name (name0): '{name0}'")
    log(f"Name after Company A: '{nameAfterA}'")
    log(f"Name after Company B: '{nameAfterB}'")
    log(f"Name after update: '{nameAfterUpdate}'")
    log("")
    
    all_pass = primary_pass and contact_fields_pass and update_pass
    
    if primary_pass:
        log("✅ PRIMARY ASSERTION: PASS - Account name not overwritten by second company")
    else:
        log("❌ PRIMARY ASSERTION: FAIL - Account name was overwritten")
    
    if contact_fields_pass:
        log("✅ CONTACT FIELDS: PASS - Companies store their own contact names")
    else:
        log("❌ CONTACT FIELDS: FAIL - Contact fields incorrect")
    
    if update_pass:
        log("✅ UPDATE TEST: PASS - Update doesn't affect account name")
    else:
        log("❌ UPDATE TEST: FAIL - Update test failed")
    
    log("")
    if all_pass:
        log("🎉 ALL TESTS PASSED - BUG FIX VERIFIED")
    else:
        log("⚠️  SOME TESTS FAILED - BUG MAY NOT BE FULLY FIXED")
    
    log(f"{'='*60}\n")
    
    return all_pass


if __name__ == "__main__":
    try:
        success = run_tests()
        exit(0 if success else 1)
    except Exception as e:
        log(f"\n✗ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        cleanup()
        exit(1)
