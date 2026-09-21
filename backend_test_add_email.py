#!/usr/bin/env python3
"""
SafeDeal Add-Email Feature Test (Re-test after CSRF exemption fix)
Tests ONLY the add-email portion that was previously blocked by CSRF:
- 5a) ADD-EMAIL happy path
- 5b) COLLISION (email belongs to another account)
- 5c) PENDING-INVITE CONNECT (add email with pending deal)
- 6) me() endpoint returns email_is_placeholder

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

class TestResults:
    def __init__(self):
        self.tests = []
        self.passed = 0
        self.failed = 0
        self.deal_tokens = []
    
    def add(self, name: str, passed: bool, details: str = "", status_code: int = 0):
        self.tests.append({
            "name": name,
            "passed": passed,
            "details": details,
            "status_code": status_code
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY - SAFEDEAL ADD-EMAIL FEATURE")
        print("="*80)
        for test in self.tests:
            status = "✅ PASS" if test["passed"] else "❌ FAIL"
            print(f"{status}: {test['name']}")
            if test["details"]:
                print(f"  → {test['details']}")
            if test["status_code"]:
                print(f"  → Status code: {test['status_code']}")
        print(f"\nTotal: {self.passed} passed, {self.failed} failed")
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
        
        print(f"✓ Authenticated: {email}")
        return token
        
    except Exception as e:
        print(f"❌ Auth exception for {email}: {str(e)}")
        return None

def test_5a_add_email_happy_path():
    """Test 5a: ADD-EMAIL happy path"""
    print("\n" + "="*80)
    print("TEST 5a: ADD-EMAIL HAPPY PATH")
    print("="*80)
    
    # Create account B with a throwaway email
    account_b_email = f"sd_qa_b_{RANDOM_ID}@example.com"
    token_b = safedeal_auth(account_b_email)
    if not token_b:
        results.add("5a. Add-email happy path", False, "Failed to authenticate account B")
        return
    
    try:
        # Generate a new email to add
        new_email = f"sd_qa_add_{random.randint(1000, 9999)}@example.com"
        
        print(f"\n--- Step 1: POST /account/email/start ---")
        print(f"Adding email: {new_email}")
        
        resp = requests.post(
            f"{SAFEDEAL_API}/account/email/start",
            headers={"x-safedeal-token": token_b},
            json={"email": new_email},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code != 200:
            results.add("5a. Add-email happy path", False, 
                       f"POST /account/email/start failed with {resp.status_code}: {resp.text[:200]}", 
                       resp.status_code)
            return
        
        data = resp.json().get("data", {})
        preview_code = data.get("preview_code")
        
        if not preview_code:
            results.add("5a. Add-email happy path", False, 
                       f"No preview_code in response: {data}", 
                       resp.status_code)
            return
        
        print(f"✓ preview_code received: {preview_code}")
        
        print(f"\n--- Step 2: POST /account/email/verify ---")
        
        resp = requests.post(
            f"{SAFEDEAL_API}/account/email/verify",
            headers={"x-safedeal-token": token_b},
            json={"code": preview_code},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code != 200:
            results.add("5a. Add-email happy path", False, 
                       f"POST /account/email/verify failed with {resp.status_code}: {resp.text[:200]}", 
                       resp.status_code)
            return
        
        data = resp.json().get("data", {})
        
        # Verify response fields
        checks = []
        checks.append(("token present", "token" in data))
        checks.append(("user.email_is_placeholder is false", 
                      data.get("user", {}).get("email_is_placeholder") == False))
        checks.append(("connected_deals is number", 
                      isinstance(data.get("connected_deals"), int)))
        
        all_passed = all(check[1] for check in checks)
        details = "; ".join([f"{check[0]}: {'✓' if check[1] else '✗'}" for check in checks])
        
        results.add("5a. Add-email happy path", all_passed, details, resp.status_code)
        
        if all_passed:
            print(f"✅ Add-email happy path passed")
            print(f"   token: {data.get('token')[:20]}...")
            print(f"   email_is_placeholder: {data.get('user', {}).get('email_is_placeholder')}")
            print(f"   connected_deals: {data.get('connected_deals')}")
        else:
            print(f"❌ Validation failed: {details}")
            
    except Exception as e:
        results.add("5a. Add-email happy path", False, f"Exception: {str(e)}")

def test_5b_email_collision():
    """Test 5b: COLLISION - email belongs to another account"""
    print("\n" + "="*80)
    print("TEST 5b: EMAIL COLLISION")
    print("="*80)
    
    # Create account A
    account_a_email = f"sd_qa_a_{RANDOM_ID}@example.com"
    token_a = safedeal_auth(account_a_email)
    if not token_a:
        results.add("5b. Email collision", False, "Failed to authenticate account A")
        return
    
    # Create account B
    account_b_email = f"sd_qa_b2_{RANDOM_ID}@example.com"
    token_b = safedeal_auth(account_b_email)
    if not token_b:
        results.add("5b. Email collision", False, "Failed to authenticate account B")
        return
    
    try:
        print(f"\n--- Account A: {account_a_email} ---")
        print(f"--- Account B: {account_b_email} ---")
        print(f"--- Account B tries to add Account A's email ---")
        
        resp = requests.post(
            f"{SAFEDEAL_API}/account/email/start",
            headers={"x-safedeal-token": token_b},
            json={"email": account_a_email},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        passed = resp.status_code == 409
        details = f"Expected 409 (conflict), got {resp.status_code}"
        
        if passed:
            response_data = resp.json()
            error_msg = response_data.get("error", "")
            if "belongs to another" in error_msg.lower() or "already" in error_msg.lower():
                details += f" with correct error message: '{error_msg}'"
            else:
                details += f" but unexpected error message: '{error_msg}'"
        
        results.add("5b. Email collision", passed, details, resp.status_code)
        
        if passed:
            print(f"✅ Email collision correctly rejected with 409")
        else:
            print(f"❌ Expected 409, got {resp.status_code}")
            
    except Exception as e:
        results.add("5b. Email collision", False, f"Exception: {str(e)}")

def test_5c_pending_invite_connect():
    """Test 5c: PENDING-INVITE CONNECT - add email with pending deal"""
    print("\n" + "="*80)
    print("TEST 5c: PENDING-INVITE CONNECT")
    print("="*80)
    
    # Create account A (will create the deal)
    account_a_email = f"sd_qa_creator_{RANDOM_ID}@example.com"
    token_a = safedeal_auth(account_a_email)
    if not token_a:
        results.add("5c. Pending-invite connect", False, "Failed to authenticate account A")
        return
    
    try:
        # Account A creates an EMAIL deal with a pending email
        pending_email = f"sd_qa_pending_{random.randint(1000, 9999)}@example.com"
        
        print(f"\n--- Step 1: Account A creates deal with counterparty_email ---")
        print(f"Pending email: {pending_email}")
        
        resp = requests.post(
            f"{SAFEDEAL_API}/deals",
            headers={"x-safedeal-token": token_a},
            json={
                "title": "QA pending invite connect",
                "amount": 50,
                "my_role": "seller",
                "counterparty_email": pending_email
            },
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code != 201:
            results.add("5c. Pending-invite connect", False, 
                       f"Failed to create deal: {resp.status_code}", 
                       resp.status_code)
            return
        
        data = resp.json().get("data", {})
        deal_token = data.get("deal_token", "")
        print(f"✓ Deal created: {deal_token}")
        
        # Create account C with a DIFFERENT email
        account_c_email = f"sd_qa_c_{random.randint(1000, 9999)}@example.com"
        token_c = safedeal_auth(account_c_email)
        if not token_c:
            results.add("5c. Pending-invite connect", False, "Failed to authenticate account C")
            return
        
        print(f"\n--- Step 2: Account C ({account_c_email}) adds the pending email ---")
        
        # Account C: POST /account/email/start with the pending email
        resp = requests.post(
            f"{SAFEDEAL_API}/account/email/start",
            headers={"x-safedeal-token": token_c},
            json={"email": pending_email},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code != 200:
            results.add("5c. Pending-invite connect", False, 
                       f"POST /account/email/start failed: {resp.status_code}", 
                       resp.status_code)
            return
        
        data = resp.json().get("data", {})
        preview_code = data.get("preview_code")
        
        if not preview_code:
            results.add("5c. Pending-invite connect", False, 
                       f"No preview_code in response", 
                       resp.status_code)
            return
        
        print(f"✓ preview_code received: {preview_code}")
        
        print(f"\n--- Step 3: Account C verifies the code ---")
        
        resp = requests.post(
            f"{SAFEDEAL_API}/account/email/verify",
            headers={"x-safedeal-token": token_c},
            json={"code": preview_code},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code != 200:
            results.add("5c. Pending-invite connect", False, 
                       f"POST /account/email/verify failed: {resp.status_code}", 
                       resp.status_code)
            return
        
        data = resp.json().get("data", {})
        connected_deals = data.get("connected_deals", 0)
        new_token = data.get("token", "")
        
        print(f"✓ connected_deals: {connected_deals}")
        
        # Verify connected_deals >= 1
        if connected_deals < 1:
            results.add("5c. Pending-invite connect", False, 
                       f"Expected connected_deals >= 1, got {connected_deals}", 
                       resp.status_code)
            return
        
        print(f"\n--- Step 4: GET /deals as account C (using new token) ---")
        
        resp = requests.get(
            f"{SAFEDEAL_API}/deals",
            headers={"x-safedeal-token": new_token},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            results.add("5c. Pending-invite connect", False, 
                       f"GET /deals failed: {resp.status_code}", 
                       resp.status_code)
            return
        
        data = resp.json().get("data", [])
        deals = data if isinstance(data, list) else []
        
        # Check if the pending deal is in the list
        deal_found = any(d.get("deal_token") == deal_token for d in deals)
        
        checks = []
        checks.append(("connected_deals >= 1", connected_deals >= 1))
        checks.append(("pending deal in GET /deals", deal_found))
        
        all_passed = all(check[1] for check in checks)
        details = "; ".join([f"{check[0]}: {'✓' if check[1] else '✗'}" for check in checks])
        details += f" (connected_deals={connected_deals}, deal_token={deal_token})"
        
        results.add("5c. Pending-invite connect", all_passed, details, resp.status_code)
        
        if all_passed:
            print(f"✅ Pending-invite connect passed")
            print(f"   Account C is now the counterparty for deal {deal_token}")
        else:
            print(f"❌ Validation failed: {details}")
            
    except Exception as e:
        results.add("5c. Pending-invite connect", False, f"Exception: {str(e)}")

def test_6_me_endpoint():
    """Test 6: me() endpoint returns email_is_placeholder"""
    print("\n" + "="*80)
    print("TEST 6: ME() ENDPOINT")
    print("="*80)
    
    test_email = f"sd_qa_me_{RANDOM_ID}@example.com"
    token = safedeal_auth(test_email)
    if not token:
        results.add("6. me() endpoint", False, "Failed to authenticate")
        return
    
    try:
        resp = requests.get(
            f"{SAFEDEAL_API}/me",
            headers={"x-safedeal-token": token},
            timeout=10
        )
        
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code != 200:
            results.add("6. me() endpoint", False, 
                       f"Expected 200, got {resp.status_code}", 
                       resp.status_code)
            return
        
        data = resp.json().get("data", {})
        user = data.get("user", {})
        
        has_field = "email_is_placeholder" in user
        is_boolean = isinstance(user.get("email_is_placeholder"), bool)
        
        passed = has_field and is_boolean
        details = f"email_is_placeholder present: {has_field}, is boolean: {is_boolean}"
        if passed:
            details += f", value: {user.get('email_is_placeholder')}"
        
        results.add("6. me() endpoint", passed, details, resp.status_code)
        
        if passed:
            print(f"✅ me() endpoint verified")
            print(f"   email_is_placeholder: {user.get('email_is_placeholder')}")
        else:
            print(f"❌ Validation failed: {details}")
            
    except Exception as e:
        results.add("6. me() endpoint", False, f"Exception: {str(e)}")

def main():
    print("\n" + "="*80)
    print("SAFEDEAL ADD-EMAIL FEATURE TEST (RE-TEST AFTER CSRF FIX)")
    print("="*80)
    print(f"Base URL: {SAFEDEAL_API}")
    print(f"Environment: SAFE MODE, LIVE prod DB, money SIMULATED")
    print(f"Random ID: {RANDOM_ID}")
    print("="*80)
    
    # Run tests
    test_5a_add_email_happy_path()
    test_5b_email_collision()
    test_5c_pending_invite_connect()
    test_6_me_endpoint()
    
    # Print summary
    results.summary()
    
    # Exit with appropriate code
    exit(0 if results.failed == 0 else 1)

if __name__ == "__main__":
    main()
