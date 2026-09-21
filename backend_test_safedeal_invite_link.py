#!/usr/bin/env python3
"""
SafeDeal Invite-by-Link + Add-Email Feature Test
Tests the new Telegram-friendly invitation model:
- Invite-by-link create (no counterparty_email required)
- Public preview (open_seat, claimed status)
- Claim flow (idempotency, creator self-claim, already-claimed)
- Regenerate link (new token, old token dead)
- Add-email (start, verify, collision, pending-invite connect)
- me() endpoint (email_is_placeholder)
- Regression (standard email invite still works)

Environment: SAFE MODE, LIVE prod DB, money SIMULATED (ESCROW_LIVE_SETTLEMENT off)
Base URL: http://localhost:8001/api/safedeal
"""

import requests
import json
import time
import random
from typing import Dict, Any, Optional

BASE_URL = "http://localhost:8001"
SAFEDEAL_API = f"{BASE_URL}/api/safedeal"

# Generate unique throwaway emails
RANDOM_ID = int(time.time())
CREATOR_EMAIL = f"sd_qa_link_creator_{RANDOM_ID}@example.com"
CLAIMANT_EMAIL = f"sd_qa_link_claimant_{RANDOM_ID}@example.com"
THIRD_PARTY_EMAIL = f"sd_qa_link_third_{RANDOM_ID}@example.com"
ADD_EMAIL_NEW = f"sd_qa_add_{RANDOM_ID}@example.com"
PENDING_INVITE_EMAIL = f"sd_qa_pending_{RANDOM_ID}@example.com"

class TestResults:
    def __init__(self):
        self.tests = []
        self.passed = 0
        self.failed = 0
        self.deal_tokens = []
    
    def add(self, name: str, passed: bool, details: str = "", deal_token: str = ""):
        self.tests.append({
            "name": name,
            "passed": passed,
            "details": details,
            "deal_token": deal_token
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        if deal_token:
            self.deal_tokens.append(deal_token)
    
    def summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY - SAFEDEAL INVITE-BY-LINK + ADD-EMAIL")
        print("="*80)
        for test in self.tests:
            status = "✅ PASS" if test["passed"] else "❌ FAIL"
            print(f"{status}: {test['name']}")
            if test["details"]:
                print(f"  → {test['details']}")
            if test["deal_token"]:
                print(f"  → deal_token: {test['deal_token']}")
        print(f"\nTotal: {self.passed} passed, {self.failed} failed")
        if self.deal_tokens:
            print(f"\nDeal tokens used: {', '.join(self.deal_tokens)}")
        print("="*80)

results = TestResults()

def safedeal_auth(email: str) -> Optional[str]:
    """Authenticate with SafeDeal and return token"""
    try:
        # Send code
        resp = requests.post(f"{SAFEDEAL_API}/auth/send-code", json={"email": email}, timeout=10)
        if resp.status_code != 200:
            print(f"❌ Send code failed for {email}: {resp.status_code} {resp.text}")
            return None
        
        data = resp.json()
        code = data.get("data", {}).get("preview_code")
        if not code:
            print(f"❌ No preview_code in response: {data}")
            return None
        
        print(f"✓ Code sent to {email}: {code}")
        
        # Verify code
        resp = requests.post(f"{SAFEDEAL_API}/auth/verify-code", 
                           json={"email": email, "code": code}, timeout=10)
        if resp.status_code != 200:
            print(f"❌ Verify code failed: {resp.status_code} {resp.text}")
            return None
        
        data = resp.json()
        token = data.get("data", {}).get("token")
        if not token:
            print(f"❌ No token in response: {data}")
            return None
        
        print(f"✓ Authenticated {email}")
        return token
    except Exception as e:
        print(f"❌ Auth error: {e}")
        return None

def test_1_invite_by_link_create():
    """Test 1: Create invite-by-link deal (no counterparty_email required)"""
    print("\n" + "="*80)
    print("TEST 1: INVITE-BY-LINK CREATE")
    print("="*80)
    
    token_a = safedeal_auth(CREATOR_EMAIL)
    if not token_a:
        results.add("1. Invite-by-link create", False, "Failed to authenticate creator")
        return None
    
    try:
        # Create deal with invite_by_link=true
        resp = requests.post(
            f"{SAFEDEAL_API}/deals",
            headers={"x-safedeal-token": token_a},
            json={
                "title": "QA link deal",
                "amount": 100,
                "my_role": "seller",
                "invite_by_link": True
            },
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code != 201:
            results.add("1. Invite-by-link create", False, f"Expected 201, got {resp.status_code}")
            return None
        
        data = resp.json().get("data", {})
        
        # Verify required fields (data is the deal directly, not data.deal)
        checks = []
        checks.append(("invite_kind === 'link'", data.get("invite_kind") == "link"))
        checks.append(("counterparty_email is null", data.get("counterparty_email") is None))
        checks.append(("invite_url is non-empty", bool(data.get("invite_url"))))
        checks.append(("status === 'invited'", data.get("status") == "invited"))
        
        all_passed = all(check[1] for check in checks)
        details = "; ".join([f"{check[0]}: {'✓' if check[1] else '✗'}" for check in checks])
        
        deal_token = data.get("deal_token", "")
        results.add("1. Invite-by-link create", all_passed, details, deal_token)
        
        if all_passed:
            print(f"✅ Deal created successfully")
            print(f"   deal_token: {deal_token}")
            print(f"   invite_url: {data.get('invite_url')}")
            return deal_token
        else:
            print(f"❌ Validation failed: {details}")
            return None
            
    except Exception as e:
        results.add("1. Invite-by-link create", False, f"Exception: {str(e)}")
        return None

def test_2_public_preview(deal_token: str):
    """Test 2: Public preview (no auth required)"""
    print("\n" + "="*80)
    print("TEST 2: PUBLIC PREVIEW")
    print("="*80)
    
    if not deal_token:
        results.add("2. Public preview", False, "No deal_token from test 1")
        return
    
    try:
        # GET preview without auth
        resp = requests.get(f"{SAFEDEAL_API}/deals/{deal_token}/preview", timeout=10)
        
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code != 200:
            results.add("2. Public preview", False, f"Expected 200, got {resp.status_code}")
            return
        
        data = resp.json().get("data", {})
        
        # Verify required fields
        checks = []
        checks.append(("invite_kind === 'link'", data.get("invite_kind") == "link"))
        checks.append(("open_seat === true", data.get("open_seat") is True))
        checks.append(("claimed === false", data.get("claimed") is False))
        checks.append(("counterparty_email_hint === null", data.get("counterparty_email_hint") is None))
        checks.append(("title present", bool(data.get("title"))))
        checks.append(("amount present", data.get("amount") is not None))
        
        all_passed = all(check[1] for check in checks)
        details = "; ".join([f"{check[0]}: {'✓' if check[1] else '✗'}" for check in checks])
        
        results.add("2. Public preview", all_passed, details, deal_token)
        
        if all_passed:
            print(f"✅ Preview verified successfully")
        else:
            print(f"❌ Validation failed: {details}")
            
    except Exception as e:
        results.add("2. Public preview", False, f"Exception: {str(e)}")

def test_3_claim_flow(deal_token: str):
    """Test 3: Claim flow (idempotency, self-claim, already-claimed)"""
    print("\n" + "="*80)
    print("TEST 3: CLAIM FLOW")
    print("="*80)
    
    if not deal_token:
        results.add("3a. Claim by claimant", False, "No deal_token from test 1")
        results.add("3b. Idempotency check", False, "No deal_token from test 1")
        results.add("3c. Creator self-claim", False, "No deal_token from test 1")
        results.add("3d. Already-claimed by third party", False, "No deal_token from test 1")
        return
    
    # 3a: Claimant claims the deal
    print("\n--- 3a: Claimant claims the deal ---")
    token_b = safedeal_auth(CLAIMANT_EMAIL)
    if not token_b:
        results.add("3a. Claim by claimant", False, "Failed to authenticate claimant")
        return
    
    try:
        resp = requests.post(
            f"{SAFEDEAL_API}/deals/{deal_token}/claim",
            headers={"x-safedeal-token": token_b},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code != 200:
            results.add("3a. Claim by claimant", False, f"Expected 200, got {resp.status_code}")
            return
        
        data = resp.json().get("data", {})
        
        # Verify claim succeeded (data is the deal directly)
        checks = []
        checks.append(("my_role === 'buyer'", data.get("my_role") == "buyer"))
        checks.append(("counterparty_claimed_at set", data.get("counterparty_claimed_at") is not None))
        checks.append(("status === 'invited'", data.get("status") == "invited"))
        
        all_passed = all(check[1] for check in checks)
        details = "; ".join([f"{check[0]}: {'✓' if check[1] else '✗'}" for check in checks])
        
        results.add("3a. Claim by claimant", all_passed, details, deal_token)
        
        if all_passed:
            print(f"✅ Claim succeeded")
        else:
            print(f"❌ Validation failed: {details}")
            
    except Exception as e:
        results.add("3a. Claim by claimant", False, f"Exception: {str(e)}")
        return
    
    # 3b: Idempotency - same claimant claims again
    print("\n--- 3b: Idempotency check (same claimant claims again) ---")
    try:
        resp = requests.post(
            f"{SAFEDEAL_API}/deals/{deal_token}/claim",
            headers={"x-safedeal-token": token_b},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        
        passed = resp.status_code == 200
        details = f"Status {resp.status_code} (expected 200 for idempotent claim)"
        results.add("3b. Idempotency check", passed, details, deal_token)
        
        if passed:
            print(f"✅ Idempotency verified")
        else:
            print(f"❌ Expected 200, got {resp.status_code}")
            
    except Exception as e:
        results.add("3b. Idempotency check", False, f"Exception: {str(e)}")
    
    # 3c: Creator self-claim (should fail with 400)
    print("\n--- 3c: Creator self-claim (should fail) ---")
    token_a = safedeal_auth(CREATOR_EMAIL)
    if not token_a:
        results.add("3c. Creator self-claim", False, "Failed to authenticate creator")
        return
    
    try:
        resp = requests.post(
            f"{SAFEDEAL_API}/deals/{deal_token}/claim",
            headers={"x-safedeal-token": token_a},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        
        passed = resp.status_code == 400
        details = f"Status {resp.status_code} (expected 400 for creator self-claim)"
        results.add("3c. Creator self-claim", passed, details, deal_token)
        
        if passed:
            print(f"✅ Creator self-claim correctly rejected")
        else:
            print(f"❌ Expected 400, got {resp.status_code}")
            
    except Exception as e:
        results.add("3c. Creator self-claim", False, f"Exception: {str(e)}")
    
    # 3d: Third party tries to claim already-claimed deal (should fail with 409)
    print("\n--- 3d: Third party claims already-claimed deal (should fail) ---")
    token_c = safedeal_auth(THIRD_PARTY_EMAIL)
    if not token_c:
        results.add("3d. Already-claimed by third party", False, "Failed to authenticate third party")
        return
    
    try:
        resp = requests.post(
            f"{SAFEDEAL_API}/deals/{deal_token}/claim",
            headers={"x-safedeal-token": token_c},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        
        passed = resp.status_code == 409
        details = f"Status {resp.status_code} (expected 409 for already-claimed)"
        results.add("3d. Already-claimed by third party", passed, details, deal_token)
        
        if passed:
            print(f"✅ Already-claimed correctly rejected")
        else:
            print(f"❌ Expected 409, got {resp.status_code}")
            
    except Exception as e:
        results.add("3d. Already-claimed by third party", False, f"Exception: {str(e)}")

def test_4_regenerate_link():
    """Test 4: Regenerate link (new token, old token dead)"""
    print("\n" + "="*80)
    print("TEST 4: REGENERATE LINK")
    print("="*80)
    
    # Create a new link deal for regeneration test
    token_a = safedeal_auth(CREATOR_EMAIL)
    if not token_a:
        results.add("4a. Regenerate link", False, "Failed to authenticate creator")
        results.add("4b. Old token dead", False, "Failed to authenticate creator")
        results.add("4c. Non-creator regenerate", False, "Failed to authenticate creator")
        return
    
    try:
        # Create second link deal
        resp = requests.post(
            f"{SAFEDEAL_API}/deals",
            headers={"x-safedeal-token": token_a},
            json={
                "title": "QA regenerate test",
                "amount": 50,
                "my_role": "seller",
                "invite_by_link": True
            },
            timeout=10
        )
        
        if resp.status_code != 201:
            results.add("4a. Regenerate link", False, f"Failed to create deal: {resp.status_code}")
            return
        
        data = resp.json().get("data", {})
        old_token = data.get("deal_token", "")
        
        print(f"Created deal with token: {old_token}")
        
        # 4a: Regenerate link
        print("\n--- 4a: Regenerate link ---")
        resp = requests.post(
            f"{SAFEDEAL_API}/deals/{old_token}/action",
            headers={"x-safedeal-token": token_a},
            json={"action": "regenerate-link"},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code != 200:
            results.add("4a. Regenerate link", False, f"Expected 200, got {resp.status_code}")
            return
        
        data = resp.json().get("data", {})
        new_token = data.get("deal_token", "")
        
        checks = []
        checks.append(("new_token different from old", new_token != old_token))
        checks.append(("new_token non-empty", bool(new_token)))
        checks.append(("counterparty cleared", data.get("counterparty_email") is None))
        
        all_passed = all(check[1] for check in checks)
        details = "; ".join([f"{check[0]}: {'✓' if check[1] else '✗'}" for check in checks])
        
        results.add("4a. Regenerate link", all_passed, details, new_token)
        
        if all_passed:
            print(f"✅ Link regenerated successfully")
            print(f"   old_token: {old_token}")
            print(f"   new_token: {new_token}")
        else:
            print(f"❌ Validation failed: {details}")
            return
        
        # 4b: Old token should be dead (404)
        print("\n--- 4b: Old token should be dead ---")
        resp = requests.get(f"{SAFEDEAL_API}/deals/{old_token}/preview", timeout=10)
        
        print(f"Status: {resp.status_code}")
        
        passed = resp.status_code == 404
        details = f"Status {resp.status_code} (expected 404 for old token)"
        results.add("4b. Old token dead", passed, details, old_token)
        
        if passed:
            print(f"✅ Old token correctly dead")
        else:
            print(f"❌ Expected 404, got {resp.status_code}")
        
        # 4c: Non-creator tries to regenerate (should fail with 403)
        print("\n--- 4c: Non-creator tries to regenerate ---")
        token_b = safedeal_auth(CLAIMANT_EMAIL)
        if not token_b:
            results.add("4c. Non-creator regenerate", False, "Failed to authenticate non-creator")
            return
        
        resp = requests.post(
            f"{SAFEDEAL_API}/deals/{new_token}/action",
            headers={"x-safedeal-token": token_b},
            json={"action": "regenerate-link"},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        
        passed = resp.status_code == 403
        details = f"Status {resp.status_code} (expected 403 for non-creator)"
        results.add("4c. Non-creator regenerate", passed, details, new_token)
        
        if passed:
            print(f"✅ Non-creator correctly rejected")
        else:
            print(f"❌ Expected 403, got {resp.status_code}")
            
    except Exception as e:
        results.add("4a. Regenerate link", False, f"Exception: {str(e)}")

def test_5_add_email():
    """Test 5: Add-email flow (start, verify, collision, pending-invite connect)"""
    print("\n" + "="*80)
    print("TEST 5: ADD-EMAIL FLOW")
    print("="*80)
    
    print("\n⚠️  SKIPPING: Add-email endpoints require CSRF token")
    print("   The /api/safedeal/account/email/* endpoints are not in the CSRF exempt list")
    print("   but SafeDeal uses JWT tokens in x-safedeal-token header (not cookies)")
    print("   This appears to be a configuration issue - SafeDeal endpoints should be")
    print("   exempt from CSRF since they use explicit header-based auth, not cookies.")
    print("   ")
    print("   RECOMMENDATION: Add '/api/safedeal/account/' to EXEMPT_PATHS in")
    print("   /app/backend/middleware/csrfMiddleware.ts")
    
    results.add("5a. Add email", False, "CSRF token required (config issue)")
    results.add("5b. Email collision", False, "CSRF token required (config issue)")
    results.add("5c. Pending-invite connect", False, "CSRF token required (config issue)")

def test_6_me_endpoint():
    """Test 6: me() endpoint returns email_is_placeholder"""
    print("\n" + "="*80)
    print("TEST 6: ME() ENDPOINT")
    print("="*80)
    
    token_a = safedeal_auth(CREATOR_EMAIL)
    if not token_a:
        results.add("6. me() endpoint", False, "Failed to authenticate")
        return
    
    try:
        resp = requests.get(
            f"{SAFEDEAL_API}/me",
            headers={"x-safedeal-token": token_a},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code != 200:
            results.add("6. me() endpoint", False, f"Expected 200, got {resp.status_code}")
            return
        
        data = resp.json().get("data", {})
        user = data.get("user", {})
        
        has_field = "email_is_placeholder" in user
        is_boolean = isinstance(user.get("email_is_placeholder"), bool)
        
        passed = has_field and is_boolean
        details = f"email_is_placeholder present: {has_field}, is boolean: {is_boolean}"
        results.add("6. me() endpoint", passed, details)
        
        if passed:
            print(f"✅ me() endpoint verified")
            print(f"   email_is_placeholder: {user.get('email_is_placeholder')}")
        else:
            print(f"❌ Validation failed: {details}")
            
    except Exception as e:
        results.add("6. me() endpoint", False, f"Exception: {str(e)}")

def test_7_regression_email_invite():
    """Test 7: Regression - standard EMAIL invite still works"""
    print("\n" + "="*80)
    print("TEST 7: REGRESSION - EMAIL INVITE")
    print("="*80)
    
    # Create new accounts for regression test
    seller_email = f"sd_qa_reg_seller_{RANDOM_ID}@example.com"
    buyer_email = f"sd_qa_reg_buyer_{RANDOM_ID}@example.com"
    
    token_seller = safedeal_auth(seller_email)
    if not token_seller:
        results.add("7. Regression email invite", False, "Failed to authenticate seller")
        return
    
    try:
        # Seller creates deal with counterparty_email
        resp = requests.post(
            f"{SAFEDEAL_API}/deals",
            headers={"x-safedeal-token": token_seller},
            json={
                "title": "QA regression test",
                "amount": 75,
                "my_role": "seller",
                "counterparty_email": buyer_email
            },
            timeout=10
        )
        
        print(f"Create status: {resp.status_code}")
        
        if resp.status_code != 201:
            results.add("7. Regression email invite", False, f"Create failed: {resp.status_code}")
            return
        
        data = resp.json().get("data", {})
        deal_token = data.get("deal_token", "")
        
        print(f"✓ Deal created: {deal_token}")
        
        # Buyer authenticates and gets the deal
        token_buyer = safedeal_auth(buyer_email)
        if not token_buyer:
            results.add("7. Regression email invite", False, "Failed to authenticate buyer")
            return
        
        resp = requests.get(
            f"{SAFEDEAL_API}/deals/{deal_token}",
            headers={"x-safedeal-token": token_buyer},
            timeout=10
        )
        
        print(f"Get deal status: {resp.status_code}")
        
        if resp.status_code != 200:
            results.add("7. Regression email invite", False, f"Get deal failed: {resp.status_code}")
            return
        
        # Buyer accepts the deal
        resp = requests.post(
            f"{SAFEDEAL_API}/deals/{deal_token}/action",
            headers={"x-safedeal-token": token_buyer},
            json={"action": "accept"},
            timeout=10
        )
        
        print(f"Accept status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code != 200:
            results.add("7. Regression email invite", False, f"Accept failed: {resp.status_code}")
            return
        
        data = resp.json().get("data", {})
        status = data.get("status")
        
        passed = status == "awaiting_payment"
        details = f"Status after accept: {status} (expected 'awaiting_payment')"
        results.add("7. Regression email invite", passed, details, deal_token)
        
        if passed:
            print(f"✅ Email invite flow works correctly")
        else:
            print(f"❌ Expected status 'awaiting_payment', got '{status}'")
            
    except Exception as e:
        results.add("7. Regression email invite", False, f"Exception: {str(e)}")

def main():
    print("\n" + "="*80)
    print("SAFEDEAL INVITE-BY-LINK + ADD-EMAIL FEATURE TEST")
    print("="*80)
    print(f"Base URL: {SAFEDEAL_API}")
    print(f"Environment: SAFE MODE, LIVE prod DB, money SIMULATED")
    print(f"Test accounts:")
    print(f"  Creator: {CREATOR_EMAIL}")
    print(f"  Claimant: {CLAIMANT_EMAIL}")
    print(f"  Third party: {THIRD_PARTY_EMAIL}")
    print("="*80)
    
    # Run tests
    deal_token_1 = test_1_invite_by_link_create()
    test_2_public_preview(deal_token_1)
    test_3_claim_flow(deal_token_1)
    test_4_regenerate_link()
    test_5_add_email()
    test_6_me_endpoint()
    test_7_regression_email_invite()
    
    # Print summary
    results.summary()
    
    # Exit with appropriate code
    exit(0 if results.failed == 0 else 1)

if __name__ == "__main__":
    main()
