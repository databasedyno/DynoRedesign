#!/usr/bin/env python3
"""
RBAC Invoices Permission Gate Re-Test
Tests the fix for invoices endpoint returning 403 when member lacks manage_invoices permission
"""

import requests
import json
import time
from typing import Dict, List, Optional

# Base URL from environment
BASE_URL = "https://merchant-demo-4.preview.emergentagent.com/api"

# Owner credentials
OWNER_EMAIL = "onarrival21@gmail.com"
OWNER_PASSWORD = "Katiekendra123@"
COMPANY_ID = 1

# Sentinel member emails
MINIMAL_MEMBER_EMAIL = "onarrival21+rbacmin2@gmail.com"
FULL_MEMBER_EMAIL = "onarrival21+rbacfull2@gmail.com"
MEMBER_PASSWORD = "RbacTest123@"

# Track created members for cleanup
created_members = []

def log_test(test_name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"  {details}")

def login(email: str, password: str) -> Optional[str]:
    """Login and return access token"""
    try:
        response = requests.post(
            f"{BASE_URL}/user/login",
            json={"email": email, "password": password},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("data", {}).get("accessToken")
        else:
            print(f"  Login failed: {response.status_code} - {response.text[:200]}")
            return None
    except Exception as e:
        print(f"  Login error: {str(e)}")
        return None

def create_invite(token: str, email: str, permissions: Dict[str, bool]) -> Optional[Dict]:
    """Create team member invite"""
    try:
        response = requests.post(
            f"{BASE_URL}/team/invite",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "email": email,
                "role": "member",
                "company_id": COMPANY_ID,
                "permissions": permissions
            },
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            invite_data = data.get("data", {})
            # Extract token from invite_link
            invite_link = invite_data.get("invite_link", "")
            if "token=" in invite_link:
                token_part = invite_link.split("token=")[1].split("&")[0]
                return {
                    "token": token_part,
                    "member_id": invite_data.get("member_id")
                }
        print(f"  Invite failed: {response.status_code} - {response.text[:200]}")
        return None
    except Exception as e:
        print(f"  Invite error: {str(e)}")
        return None

def accept_invite(invite_token: str, name: str, password: str) -> Optional[str]:
    """Accept invite and return access token"""
    try:
        response = requests.post(
            f"{BASE_URL}/team/accept",
            json={
                "token": invite_token,
                "name": name,
                "password": password
            },
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("data", {}).get("accessToken")
        print(f"  Accept failed: {response.status_code} - {response.text[:200]}")
        return None
    except Exception as e:
        print(f"  Accept error: {str(e)}")
        return None

def test_endpoint(token: str, endpoint: str, expected_status: int, test_name: str) -> bool:
    """Test an endpoint and verify status code"""
    try:
        response = requests.get(
            f"{BASE_URL}{endpoint}",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Company-Id": str(COMPANY_ID)
            },
            timeout=10
        )
        passed = response.status_code == expected_status
        details = f"Expected {expected_status}, got {response.status_code}"
        if not passed and response.status_code != expected_status:
            details += f" - {response.text[:200]}"
        log_test(test_name, passed, details)
        return passed
    except Exception as e:
        log_test(test_name, False, f"Error: {str(e)}")
        return False

def delete_member(token: str, member_id: int) -> bool:
    """Delete/revoke a team member"""
    try:
        response = requests.delete(
            f"{BASE_URL}/team/members/{member_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        return response.status_code == 200
    except Exception as e:
        print(f"  Delete error for member {member_id}: {str(e)}")
        return False

def main():
    print("=" * 80)
    print("RBAC INVOICES PERMISSION GATE RE-TEST")
    print("Testing fix: invoices endpoint must return 403 when member lacks manage_invoices")
    print("=" * 80)
    print()

    # Step 1: Login as owner
    print("STEP 1: Owner Login")
    owner_token = login(OWNER_EMAIL, OWNER_PASSWORD)
    if not owner_token:
        print("❌ CRITICAL: Owner login failed. Cannot proceed.")
        return
    log_test("Owner login", True, f"Token obtained for {OWNER_EMAIL}")
    print()

    # Step 2: Create MINIMAL member (only view_dashboard)
    print("STEP 2: Create MINIMAL Member (only view_dashboard permission)")
    minimal_permissions = {
        "view_dashboard": True,
        "view_transactions": False,
        "view_wallets": False,
        "manage_customers": False,
        "manage_invoices": False,
        "manage_payment_links": False,
        "manage_products": False,
        "manage_api_keys": False,
        "manage_team": False
    }
    
    minimal_invite = create_invite(owner_token, MINIMAL_MEMBER_EMAIL, minimal_permissions)
    if not minimal_invite:
        print("❌ CRITICAL: Failed to create minimal member invite. Cannot proceed.")
        return
    
    log_test("Minimal member invite created", True, f"Email: {MINIMAL_MEMBER_EMAIL}")
    if minimal_invite.get("member_id"):
        created_members.append(minimal_invite["member_id"])
    
    # Accept invite
    minimal_token = accept_invite(minimal_invite["token"], "RBAC Minimal Test", MEMBER_PASSWORD)
    if not minimal_token:
        print("❌ CRITICAL: Failed to accept minimal member invite. Cannot proceed.")
        return
    log_test("Minimal member invite accepted", True, "Token obtained")
    print()

    # Step 3: PRIMARY FIX TEST - Minimal member invoices access
    print("STEP 3: PRIMARY FIX TEST - Minimal Member Permission Gates")
    print("Testing that minimal member (lacks manage_invoices) gets 403 on invoices endpoint")
    
    # THE CRITICAL TEST: invoices should return 403
    invoices_passed = test_endpoint(
        minimal_token,
        "/invoices?company_id=1",
        403,
        "GET /api/invoices?company_id=1 (minimal member) -> 403"
    )
    
    # Regression checks: wallet and customers should also return 403
    wallet_passed = test_endpoint(
        minimal_token,
        "/wallet/getWallet?company_id=1",
        403,
        "GET /api/wallet/getWallet?company_id=1 (minimal member) -> 403"
    )
    
    customers_passed = test_endpoint(
        minimal_token,
        "/userApi/customers?company_id=1",
        403,
        "GET /api/userApi/customers?company_id=1 (minimal member) -> 403"
    )
    print()

    # Step 4: Create FULL-perm member
    print("STEP 4: Create FULL-PERM Member (all permissions)")
    full_permissions = {
        "view_dashboard": True,
        "view_transactions": True,
        "view_wallets": True,
        "manage_customers": True,
        "manage_invoices": True,
        "manage_payment_links": True,
        "manage_products": True,
        "manage_api_keys": True,
        "manage_team": False  # Not giving manage_team to avoid escalation issues
    }
    
    full_invite = create_invite(owner_token, FULL_MEMBER_EMAIL, full_permissions)
    if not full_invite:
        print("❌ WARNING: Failed to create full-perm member invite.")
    else:
        log_test("Full-perm member invite created", True, f"Email: {FULL_MEMBER_EMAIL}")
        if full_invite.get("member_id"):
            created_members.append(full_invite["member_id"])
        
        # Accept invite
        full_token = accept_invite(full_invite["token"], "RBAC Full Test", MEMBER_PASSWORD)
        if not full_token:
            print("❌ WARNING: Failed to accept full-perm member invite.")
        else:
            log_test("Full-perm member invite accepted", True, "Token obtained")
            print()

            # Step 5: Test full-perm member sees owner data
            print("STEP 5: REGRESSION TEST - Full-Perm Member Sees Owner Data")
            test_endpoint(full_token, "/invoices?company_id=1", 200, "GET /api/invoices?company_id=1 (full member) -> 200")
            test_endpoint(full_token, "/wallet/getWallet?company_id=1", 200, "GET /api/wallet/getWallet?company_id=1 (full member) -> 200")
            test_endpoint(full_token, "/userApi/customers?company_id=1", 200, "GET /api/userApi/customers?company_id=1 (full member) -> 200")
            test_endpoint(full_token, "/pay/getPaymentLinks?company_id=1", 200, "GET /api/pay/getPaymentLinks?company_id=1 (full member) -> 200")
            test_endpoint(full_token, "/userApi/getApi?company_id=1", 200, "GET /api/userApi/getApi?company_id=1 (full member) -> 200")
            print()

    # Step 6: Owner regression test
    print("STEP 6: OWNER REGRESSION TEST")
    test_endpoint(owner_token, "/invoices?company_id=1", 200, "GET /api/invoices?company_id=1 (owner) -> 200")
    test_endpoint(owner_token, "/invoices", 200, "GET /api/invoices (owner, no company_id) -> 200")
    print()

    # Step 7: Cleanup
    print("STEP 7: CLEANUP - Delete Sentinel Members")
    for member_id in created_members:
        success = delete_member(owner_token, member_id)
        log_test(f"Delete member {member_id}", success)
    print()

    # Summary
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"PRIMARY FIX (invoices 403 for minimal member): {'✅ PASS' if invoices_passed else '❌ FAIL'}")
    print(f"Regression checks (wallet/customers 403): {'✅ PASS' if (wallet_passed and customers_passed) else '❌ FAIL'}")
    print(f"Sentinel members created: {len(created_members)}")
    print(f"Emails used: {MINIMAL_MEMBER_EMAIL}, {FULL_MEMBER_EMAIL}")
    print()
    
    if invoices_passed:
        print("✅ PRIMARY FIX VERIFIED: Invoices endpoint correctly returns 403 for member lacking manage_invoices permission")
    else:
        print("❌ PRIMARY FIX FAILED: Invoices endpoint did NOT return 403 for member lacking manage_invoices permission")

if __name__ == "__main__":
    main()
