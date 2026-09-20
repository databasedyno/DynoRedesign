#!/usr/bin/env python3
"""
SafeDeal Post-PURGE Verification Test
Brand 262 was purged to clean state (0 deals, 0 customers)
Verify all core functionality still works
"""

import requests
import json
import time
import random
import subprocess
from typing import Dict, Any, Optional

BASE_URL = "http://localhost:8001"
SAFEDEAL_API = f"{BASE_URL}/api/safedeal"
ADMIN_API = f"{BASE_URL}/api/admin"

# Generate unique throwaway emails
RANDOM_ID = random.randint(1000000, 9999999)
SELLER_EMAIL = f"sd_qa_purge_seller_{RANDOM_ID}@example.com"
BUYER_EMAIL = f"sd_qa_purge_buyer_{RANDOM_ID}@example.com"
FRESH_USER_EMAIL = f"sd_qa_purge_fresh_{RANDOM_ID}@example.com"

# Admin credentials
ADMIN_EMAIL = "moxxcompany@gmail.com"
ADMIN_PASSWORD = "Katiekendra123@"

class TestResults:
    def __init__(self):
        self.tests = []
        self.passed = 0
        self.failed = 0
    
    def add(self, name: str, passed: bool, details: str = ""):
        self.tests.append({
            "name": name,
            "passed": passed,
            "details": details
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        for test in self.tests:
            status = "✅ PASS" if test["passed"] else "❌ FAIL"
            print(f"{status}: {test['name']}")
            if test["details"]:
                print(f"  → {test['details']}")
        print(f"\nTotal: {self.passed} passed, {self.failed} failed")
        print("="*80)

results = TestResults()

def safedeal_auth(email: str) -> Optional[str]:
    """Authenticate with SafeDeal and return token"""
    try:
        # Send code
        resp = requests.post(f"{SAFEDEAL_API}/auth/send-code", json={"email": email}, timeout=10)
        if resp.status_code != 200:
            print(f"❌ Send code failed: {resp.status_code} {resp.text}")
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

def admin_login() -> Optional[str]:
    """Login as admin and return access token"""
    try:
        resp = requests.post(f"{ADMIN_API}/login", 
                           json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, 
                           timeout=10)
        if resp.status_code != 200:
            print(f"❌ Admin login failed: {resp.status_code} {resp.text}")
            return None
        
        data = resp.json()
        token = data.get("data", {}).get("accessToken")
        if not token:
            print(f"❌ No accessToken in admin response: {data}")
            return None
        
        print(f"✓ Admin authenticated")
        return token
    except Exception as e:
        print(f"❌ Admin login error: {e}")
        return None

def test_1_fresh_signin_wallet():
    """TEST 1: Fresh sign-in + wallet (brand-new email gets fresh wallet with 0 balances)"""
    print("\n" + "="*80)
    print("TEST 1: FRESH SIGN-IN + WALLET")
    print("="*80)
    
    try:
        # Sign in with brand-new email
        token = safedeal_auth(FRESH_USER_EMAIL)
        if not token:
            results.add("Test 1: Fresh sign-in + wallet", False, "Failed to authenticate")
            return
        
        # Get wallet
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{SAFEDEAL_API}/wallet", headers=headers, timeout=10)
        
        if resp.status_code != 200:
            results.add("Test 1: Fresh sign-in + wallet", False, 
                       f"Wallet GET failed: {resp.status_code} {resp.text}")
            return
        
        data = resp.json()
        wallet = data.get("data", {})
        
        available = wallet.get("available", -1)
        held = wallet.get("held", -1)
        total = wallet.get("total", -1)
        
        print(f"✓ Wallet response: available={available}, held={held}, total={total}")
        
        # Verify all are 0
        if available == 0 and held == 0 and total == 0:
            results.add("Test 1: Fresh sign-in + wallet", True, 
                       f"Fresh wallet created: available=0, held=0, total=0")
        else:
            results.add("Test 1: Fresh sign-in + wallet", False, 
                       f"Expected all 0, got available={available}, held={held}, total={total}")
    
    except Exception as e:
        results.add("Test 1: Fresh sign-in + wallet", False, f"Exception: {e}")

def test_2_full_happy_path():
    """TEST 2: Full happy path (create → fund → deliver → release)"""
    print("\n" + "="*80)
    print("TEST 2: FULL HAPPY PATH")
    print("="*80)
    
    try:
        # Seller signs up
        seller_token = safedeal_auth(SELLER_EMAIL)
        if not seller_token:
            results.add("Test 2: Full happy path", False, "Seller auth failed")
            return
        
        # Buyer signs up
        buyer_token = safedeal_auth(BUYER_EMAIL)
        if not buyer_token:
            results.add("Test 2: Full happy path", False, "Buyer auth failed")
            return
        
        # Seller creates deal
        seller_headers = {"Authorization": f"Bearer {seller_token}"}
        deal_data = {
            "title": "purge check",
            "amount": 100,
            "price_currency": "USD",
            "counterparty_email": BUYER_EMAIL,
            "my_role": "seller",
            "fee_payer": "buyer",
            "auto_release_days": 5
        }
        
        resp = requests.post(f"{SAFEDEAL_API}/deals", json=deal_data, 
                           headers=seller_headers, timeout=10)
        
        if resp.status_code not in [200, 201]:
            results.add("Test 2: Full happy path", False, 
                       f"Create deal failed: {resp.status_code} {resp.text}")
            return
        
        data = resp.json()
        deal_token = data.get("data", {}).get("deal_token")
        if not deal_token:
            results.add("Test 2: Full happy path", False, 
                       f"No deal_token in response: {data}")
            return
        
        print(f"✓ Deal created: {deal_token}")
        
        # Buyer accepts
        buyer_headers = {"Authorization": f"Bearer {buyer_token}"}
        resp = requests.post(f"{SAFEDEAL_API}/deals/{deal_token}/action", 
                           json={"action": "accept"}, 
                           headers=buyer_headers, timeout=10)
        
        if resp.status_code != 200:
            results.add("Test 2: Full happy path", False, 
                       f"Buyer accept failed: {resp.status_code} {resp.text}")
            return
        
        print(f"✓ Buyer accepted")
        
        # Buyer funds (simulated)
        resp = requests.post(f"{SAFEDEAL_API}/deals/{deal_token}/action", 
                           json={"action": "fund", "coin": "USDT-TRC20"}, 
                           headers=buyer_headers, timeout=10)
        
        if resp.status_code != 200:
            results.add("Test 2: Full happy path", False, 
                       f"Buyer fund failed: {resp.status_code} {resp.text}")
            return
        
        print(f"✓ Buyer funded (simulated)")
        
        # Seller delivers
        resp = requests.post(f"{SAFEDEAL_API}/deals/{deal_token}/action", 
                           json={"action": "deliver", "note": "done"}, 
                           headers=seller_headers, timeout=10)
        
        if resp.status_code != 200:
            results.add("Test 2: Full happy path", False, 
                       f"Seller deliver failed: {resp.status_code} {resp.text}")
            return
        
        print(f"✓ Seller delivered")
        
        # Buyer releases
        resp = requests.post(f"{SAFEDEAL_API}/deals/{deal_token}/action", 
                           json={"action": "release"}, 
                           headers=buyer_headers, timeout=10)
        
        if resp.status_code != 200:
            results.add("Test 2: Full happy path", False, 
                       f"Buyer release failed: {resp.status_code} {resp.text}")
            return
        
        print(f"✓ Buyer released")
        
        # Check seller wallet (should have ~100)
        time.sleep(1)  # Give it a moment to settle
        resp = requests.get(f"{SAFEDEAL_API}/wallet", headers=seller_headers, timeout=10)
        
        if resp.status_code != 200:
            results.add("Test 2: Full happy path", False, 
                       f"Seller wallet check failed: {resp.status_code} {resp.text}")
            return
        
        data = resp.json()
        seller_wallet = data.get("data", {})
        seller_available = seller_wallet.get("available", 0)
        
        print(f"✓ Seller wallet available: ${seller_available}")
        
        # Check buyer wallet (should be 0)
        resp = requests.get(f"{SAFEDEAL_API}/wallet", headers=buyer_headers, timeout=10)
        
        if resp.status_code != 200:
            results.add("Test 2: Full happy path", False, 
                       f"Buyer wallet check failed: {resp.status_code} {resp.text}")
            return
        
        data = resp.json()
        buyer_wallet = data.get("data", {})
        buyer_available = buyer_wallet.get("available", 0)
        buyer_held = buyer_wallet.get("held", 0)
        
        print(f"✓ Buyer wallet: available=${buyer_available}, held=${buyer_held}")
        
        # Verify amounts
        if seller_available >= 95 and seller_available <= 105:  # ~100 (allow for rounding)
            if buyer_available == 0 and buyer_held == 0:
                results.add("Test 2: Full happy path", True, 
                           f"Deal completed: seller received ${seller_available}, buyer at 0")
            else:
                results.add("Test 2: Full happy path", False, 
                           f"Buyer wallet not cleared: available=${buyer_available}, held=${buyer_held}")
        else:
            results.add("Test 2: Full happy path", False, 
                       f"Seller received ${seller_available}, expected ~100")
    
    except Exception as e:
        results.add("Test 2: Full happy path", False, f"Exception: {e}")

def test_3_wallet_withdraw_plumbing():
    """TEST 3: Wallet/withdraw plumbing (step-up, add address, withdraw quote)"""
    print("\n" + "="*80)
    print("TEST 3: WALLET/WITHDRAW PLUMBING")
    print("="*80)
    
    try:
        # Use seller from test 2 (who now has balance)
        seller_token = safedeal_auth(SELLER_EMAIL)
        if not seller_token:
            results.add("Test 3: Wallet/withdraw plumbing", False, "Seller auth failed")
            return
        
        seller_headers = {"Authorization": f"Bearer {seller_token}"}
        
        # Step-up for add_address
        resp = requests.post(f"{SAFEDEAL_API}/auth/step-up", 
                           json={"purpose": "add_address"}, 
                           headers=seller_headers, timeout=10)
        
        if resp.status_code != 200:
            results.add("Test 3: Wallet/withdraw plumbing", False, 
                       f"Step-up failed: {resp.status_code} {resp.text}")
            return
        
        data = resp.json()
        step_up_code = data.get("data", {}).get("preview_code")
        if not step_up_code:
            results.add("Test 3: Wallet/withdraw plumbing", False, 
                       f"No preview_code in step-up: {data}")
            return
        
        print(f"✓ Step-up code: {step_up_code}")
        
        # Add payout address
        address_data = {
            "payout_key": "USDT-TRON",
            "address": "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR",
            "label": "t",
            "code": step_up_code
        }
        
        resp = requests.post(f"{SAFEDEAL_API}/wallet/addresses", 
                           json=address_data, 
                           headers=seller_headers, timeout=10)
        
        if resp.status_code not in [200, 201]:
            results.add("Test 3: Wallet/withdraw plumbing", False, 
                       f"Add address failed: {resp.status_code} {resp.text}")
            return
        
        data = resp.json()
        address_id = data.get("data", {}).get("address_id") or data.get("data", {}).get("id")
        if not address_id:
            results.add("Test 3: Wallet/withdraw plumbing", False, 
                       f"No address id in response: {data}")
            return
        
        print(f"✓ Address added: id={address_id}")
        
        # Get withdraw quote
        quote_data = {
            "address_id": address_id,
            "amount": 50
        }
        
        resp = requests.post(f"{SAFEDEAL_API}/wallet/withdraw/quote", 
                           json=quote_data, 
                           headers=seller_headers, timeout=10)
        
        if resp.status_code == 400:
            # Expected: 24h cooling-off
            error_data = resp.json()
            error_msg = error_data.get("error", {}).get("message", "")
            if "cooling" in error_msg.lower() or "24" in error_msg:
                print(f"✓ Withdraw quote returned 400 (expected: 24h cooling-off): {error_msg}")
                results.add("Test 3: Wallet/withdraw plumbing", True, 
                           "Step-up, add address, withdraw quote all working (cooling-off expected)")
            else:
                results.add("Test 3: Wallet/withdraw plumbing", False, 
                           f"Unexpected 400 error: {error_msg}")
        elif resp.status_code == 200:
            data = resp.json()
            quote = data.get("data", {})
            print(f"✓ Withdraw quote: {quote}")
            results.add("Test 3: Wallet/withdraw plumbing", True, 
                       "Step-up, add address, withdraw quote all working")
        else:
            results.add("Test 3: Wallet/withdraw plumbing", False, 
                       f"Withdraw quote failed: {resp.status_code} {resp.text}")
    
    except Exception as e:
        results.add("Test 3: Wallet/withdraw plumbing", False, f"Exception: {e}")

def test_4_admin_readiness():
    """TEST 4: Admin readiness check"""
    print("\n" + "="*80)
    print("TEST 4: ADMIN READINESS")
    print("="*80)
    
    try:
        # Admin login
        admin_token = admin_login()
        if not admin_token:
            results.add("Test 4: Admin readiness", False, "Admin login failed")
            return
        
        # Get readiness
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{SAFEDEAL_API}/admin/readiness", 
                          headers=admin_headers, timeout=10)
        
        if resp.status_code != 200:
            results.add("Test 4: Admin readiness", False, 
                       f"Readiness check failed: {resp.status_code} {resp.text}")
            return
        
        data = resp.json()
        readiness = data.get("data", {})
        checks = readiness.get("checks", [])
        totals = readiness.get("totals", {})
        
        print(f"✓ Readiness response received")
        print(f"  Checks count: {len(checks)}")
        print(f"  Totals: {totals}")
        
        # Verify 12 checks
        if len(checks) != 12:
            results.add("Test 4: Admin readiness", False, 
                       f"Expected 12 checks, got {len(checks)}")
            return
        
        # Find brand, api_key, wallets checks
        brand_check = next((c for c in checks if c.get("key") == "brand"), None)
        api_key_check = next((c for c in checks if c.get("key") == "api_key"), None)
        wallets_check = next((c for c in checks if c.get("key") == "wallets"), None)
        
        issues = []
        
        if not brand_check:
            issues.append("brand check missing")
        elif not brand_check.get("ok"):
            issues.append(f"brand check failed: {brand_check.get('message')}")
        else:
            print(f"  ✓ brand check: ok")
        
        if not api_key_check:
            issues.append("api_key check missing")
        elif not api_key_check.get("ok"):
            issues.append(f"api_key check failed: {api_key_check.get('message')}")
        else:
            print(f"  ✓ api_key check: ok")
        
        if not wallets_check:
            issues.append("wallets check missing")
        elif not wallets_check.get("ok"):
            issues.append(f"wallets check failed: {wallets_check.get('message')}")
        else:
            print(f"  ✓ wallets check: ok")
        
        # Print all checks
        for check in checks:
            status = "✓" if check.get("ok") else "✗"
            print(f"  {status} {check.get('key')}: {check.get('message', '')}")
        
        if issues:
            results.add("Test 4: Admin readiness", False, 
                       f"Issues: {', '.join(issues)}")
        else:
            results.add("Test 4: Admin readiness", True, 
                       f"12 checks present, brand/api_key/wallets all ok")
    
    except Exception as e:
        results.add("Test 4: Admin readiness", False, f"Exception: {e}")

def test_5_regression_pytest():
    """TEST 5: Regression pytest"""
    print("\n" + "="*80)
    print("TEST 5: REGRESSION PYTEST")
    print("="*80)
    
    try:
        # Run pytest
        cmd = [
            "python3", "-m", "pytest",
            "tests/test_safedeal_api.py",
            "tests/test_safedeal_iter203.py",
            "-q", "--tb=short"
        ]
        
        print(f"Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, cwd="/app/backend", 
                              capture_output=True, text=True, timeout=300)
        
        print("\n--- PYTEST OUTPUT ---")
        print(result.stdout)
        if result.stderr:
            print("--- STDERR ---")
            print(result.stderr)
        print("--- END PYTEST OUTPUT ---\n")
        
        # Check result
        if result.returncode == 0:
            # Parse output for pass count
            output = result.stdout
            if "passed" in output:
                results.add("Test 5: Regression pytest", True, 
                           f"All tests passed (exit code 0)")
            else:
                results.add("Test 5: Regression pytest", True, 
                           f"Exit code 0 (check output for details)")
        else:
            results.add("Test 5: Regression pytest", False, 
                       f"Exit code {result.returncode} (see output above)")
    
    except subprocess.TimeoutExpired:
        results.add("Test 5: Regression pytest", False, "Timeout (>300s)")
    except Exception as e:
        results.add("Test 5: Regression pytest", False, f"Exception: {e}")

def main():
    print("="*80)
    print("SAFEDEAL POST-PURGE VERIFICATION TEST")
    print("Brand 262 purged to clean state (0 deals, 0 customers)")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"SafeDeal API: {SAFEDEAL_API}")
    print(f"Fresh user: {FRESH_USER_EMAIL}")
    print(f"Seller: {SELLER_EMAIL}")
    print(f"Buyer: {BUYER_EMAIL}")
    print("="*80)
    
    # Run all tests
    test_1_fresh_signin_wallet()
    test_2_full_happy_path()
    test_3_wallet_withdraw_plumbing()
    test_4_admin_readiness()
    test_5_regression_pytest()
    
    # Print summary
    results.summary()
    
    # Exit with appropriate code
    if results.failed > 0:
        exit(1)
    else:
        exit(0)

if __name__ == "__main__":
    main()
