#!/usr/bin/env python3
"""
Test script for POST /api/pay/receipt endpoint (Session 2026-08-13/14)
CRITICAL SAFETY: STRICT READ-ONLY on DB rows. Redis-only simulation allowed.
"""

import requests
import json
import jwt
import time
import random
import string
from datetime import datetime, timedelta
import redis
import os
import sys

# Configuration
BASE_URL = "http://localhost:8001"
API_BASE = f"{BASE_URL}/api"

# Load secrets from backend .env
ACCESS_TOKEN_SECRET = "REDACTED_ACCESS_TOKEN_SECRET"
REDIS_URL = "redis://default:REDACTED_REDIS_PASSWORD@nozomi.proxy.rlwy.net:15794"

# Test credentials
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

def random_string(length=8):
    """Generate random alphanumeric string"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def get_redis_client():
    """Connect to Redis"""
    return redis.from_url(REDIS_URL, decode_responses=True)

def login():
    """Login as hostbay to get JWT token for regression tests"""
    print("\n=== LOGIN ===")
    
    # Step 1: Get CSRF token
    csrf_resp = requests.get(f"{API_BASE}/csrf-token")
    if csrf_resp.status_code != 200:
        print(f"❌ CSRF token fetch failed: {csrf_resp.status_code}")
        return None, None
    
    csrf_data = csrf_resp.json()
    csrf_token = csrf_data.get("csrf_token") or csrf_data.get("data", {}).get("csrfToken")
    if not csrf_token:
        print(f"❌ No CSRF token in response: {csrf_data}")
        return None, None
    
    print(f"✅ CSRF token obtained")
    
    # Step 2: Check email
    check_resp = requests.get(
        f"{API_BASE}/user/checkEmail",
        params={"email": TEST_EMAIL},
        headers={"x-csrf-token": csrf_token}
    )
    if check_resp.status_code != 200:
        print(f"❌ Email check failed: {check_resp.status_code}")
        return None, None
    
    print(f"✅ Email check passed")
    
    # Step 3: Login
    login_resp = requests.post(
        f"{API_BASE}/user/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        headers={"x-csrf-token": csrf_token}
    )
    
    if login_resp.status_code != 200:
        print(f"❌ Login failed: {login_resp.status_code} - {login_resp.text}")
        return None, None
    
    data = login_resp.json().get("data", {})
    access_token = data.get("accessToken")
    
    if not access_token:
        print(f"❌ No access token in login response")
        return None, None
    
    print(f"✅ Login successful")
    return access_token, csrf_token

def test_1_no_auth():
    """Test 1: POST /api/pay/receipt with NO Authorization header → 403"""
    print("\n=== TEST 1: No Authorization Header ===")
    
    resp = requests.post(
        f"{API_BASE}/pay/receipt",
        json={"address": "TESTADDR"}
    )
    
    if resp.status_code == 403:
        print(f"✅ PASS: Got 403 as expected (no auth)")
        return True
    else:
        print(f"❌ FAIL: Expected 403, got {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        return False

def test_2_invalid_token():
    """Test 2: POST /api/pay/receipt with invalid Bearer token → 403"""
    print("\n=== TEST 2: Invalid Bearer Token ===")
    
    resp = requests.post(
        f"{API_BASE}/pay/receipt",
        json={"address": "TESTADDR"},
        headers={"Authorization": "Bearer invalid.token.here"}
    )
    
    if resp.status_code == 403:
        print(f"✅ PASS: Got 403 as expected (invalid token)")
        return True
    else:
        print(f"❌ FAIL: Expected 403, got {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        return False

def test_3_valid_jwt_404():
    """Test 3: Valid JWT but non-existent address → 404"""
    print("\n=== TEST 3: Valid JWT, Non-existent Address ===")
    
    # Sign a customer-session JWT
    rand = random_string(8)
    payload = {
        "ref": f"test-receipt-{rand}",
        "exp": datetime.utcnow() + timedelta(minutes=10)
    }
    
    token = jwt.encode(payload, ACCESS_TOKEN_SECRET, algorithm="HS256")
    
    resp = requests.post(
        f"{API_BASE}/pay/receipt",
        json={"address": "TESTNOSUCHADDR"},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if resp.status_code == 404:
        print(f"✅ PASS: Got 404 as expected (address not found)")
        return True
    else:
        print(f"❌ FAIL: Expected 404, got {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        return False

def test_4_happy_path_and_409():
    """Test 4: Happy path via Redis simulation + 409 test"""
    print("\n=== TEST 4: Happy Path + 409 (Redis Simulation) ===")
    
    rand = random_string(8)
    address = f"TESTRECEIPT{rand}"
    ref = f"test-receipt-ref-{rand}"
    payment_id = f"TESTRCPT-{rand}"
    
    redis_client = get_redis_client()
    
    try:
        # Create Redis hash for crypto payment
        crypto_key = f"crypto-{address}"
        current_time = datetime.utcnow().isoformat() + "Z"
        
        crypto_data = {
            "status": "successful",
            "amount": "0.005",
            "receivedAmount": "0.005",
            "currency": "LTC",
            "base_currency": "USD",
            "base_amount": "10.00",
            "payment_id": payment_id,
            "txId": "e2e-test-tx",
            "completedAt": current_time,
            "ref": ref
        }
        
        print(f"Creating Redis hash: {crypto_key}")
        for key, value in crypto_data.items():
            redis_client.hset(crypto_key, key, value)
        redis_client.expire(crypto_key, 300)
        
        # Create Redis hash for customer session
        customer_key = ref
        customer_data = {
            "company_id": "1",
            "base_currency": "USD",
            "base_amount": "10.00",
            "customer_email": "buyer@example.dev",
            "lang": "en"
        }
        
        print(f"Creating Redis hash: {customer_key}")
        for key, value in customer_data.items():
            redis_client.hset(customer_key, key, value)
        redis_client.expire(customer_key, 300)
        
        # Sign JWT with ref
        payload = {
            "ref": ref,
            "exp": datetime.utcnow() + timedelta(minutes=10)
        }
        token = jwt.encode(payload, ACCESS_TOKEN_SECRET, algorithm="HS256")
        
        # Test 4a: Happy path - expect 200 with PDF
        print(f"\n--- Test 4a: Happy Path (200 PDF) ---")
        resp = requests.post(
            f"{API_BASE}/pay/receipt",
            json={"address": address},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        success_4a = False
        if resp.status_code == 200:
            content_type = resp.headers.get("Content-Type", "")
            content_disp = resp.headers.get("Content-Disposition", "")
            body_start = resp.content[:10]
            
            if content_type == "application/pdf":
                print(f"✅ Content-Type: application/pdf")
            else:
                print(f"❌ Content-Type: {content_type} (expected application/pdf)")
            
            if "attachment" in content_disp and "Dynopay_Receipt_" in content_disp:
                print(f"✅ Content-Disposition: {content_disp}")
            else:
                print(f"❌ Content-Disposition: {content_disp}")
            
            if body_start.startswith(b"%PDF"):
                print(f"✅ Body starts with %PDF")
            else:
                print(f"❌ Body starts with: {body_start}")
            
            print(f"✅ Response size: {len(resp.content)} bytes")
            
            if (content_type == "application/pdf" and 
                "attachment" in content_disp and 
                body_start.startswith(b"%PDF")):
                print(f"✅ PASS: 200 PDF response with correct headers")
                success_4a = True
            else:
                print(f"❌ FAIL: 200 but headers/body incorrect")
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
        
        # Test 4b: Change status to waiting, expect 409
        print(f"\n--- Test 4b: Status=waiting (409) ---")
        redis_client.hset(crypto_key, "status", "waiting")
        
        resp = requests.post(
            f"{API_BASE}/pay/receipt",
            json={"address": address},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        success_4b = False
        if resp.status_code == 409:
            print(f"✅ PASS: Got 409 as expected (payment not confirmed)")
            success_4b = True
        else:
            print(f"❌ FAIL: Expected 409, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
        
        return success_4a and success_4b
        
    finally:
        # MANDATORY CLEANUP
        print(f"\n--- Cleanup ---")
        deleted_crypto = redis_client.delete(crypto_key)
        deleted_customer = redis_client.delete(customer_key)
        print(f"Deleted {crypto_key}: {deleted_crypto}")
        print(f"Deleted {customer_key}: {deleted_customer}")

def test_5_regression(token):
    """Test 5: Regression tests (read-only)"""
    print("\n=== TEST 5: Regression Tests (Read-Only) ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 5a: action-counts with nav_reveal and parity
    print("\n--- Test 5a: action-counts (nav_reveal + parity) ---")
    
    action_counts_resp = requests.get(
        f"{API_BASE}/dashboard/action-counts",
        params={"company_id": "1"},
        headers=headers
    )
    
    success_5a = False
    if action_counts_resp.status_code == 200:
        data = action_counts_resp.json().get("data", {})
        nav_reveal = data.get("nav_reveal", {})
        transactions_pending = data.get("transactions_pending")
        
        print(f"✅ Status: 200")
        print(f"nav_reveal: {nav_reveal}")
        print(f"transactions_pending: {transactions_pending}")
        
        if isinstance(nav_reveal, dict) and len(nav_reveal) == 3:
            print(f"✅ nav_reveal has 3 booleans")
        else:
            print(f"❌ nav_reveal structure incorrect")
        
        # Get dashboard pending_count for parity check
        dashboard_resp = requests.get(
            f"{API_BASE}/dashboard/",
            params={"company_id": "1"},
            headers=headers
        )
        
        if dashboard_resp.status_code == 200:
            dashboard_data = dashboard_resp.json().get("data", {})
            today_summary = dashboard_data.get("today_summary", {})
            pending_count = today_summary.get("pending_count")
            
            print(f"dashboard pending_count: {pending_count}")
            
            if transactions_pending == pending_count:
                print(f"✅ PARITY CHECK PASS: transactions_pending ({transactions_pending}) == pending_count ({pending_count})")
                success_5a = True
            else:
                print(f"❌ PARITY CHECK FAIL: transactions_pending ({transactions_pending}) != pending_count ({pending_count})")
        else:
            print(f"❌ Dashboard request failed: {dashboard_resp.status_code}")
    else:
        print(f"❌ action-counts failed: {action_counts_resp.status_code}")
    
    # Test 5b: getWallet - 13 wallets, exactly one USDT-ERC20 and one USDC-ERC20
    print("\n--- Test 5b: getWallet (13 wallets, USDT/USDC check) ---")
    
    wallet_resp = requests.get(
        f"{API_BASE}/wallet/getWallet",
        params={"company_id": "1"},
        headers=headers
    )
    
    success_5b = False
    if wallet_resp.status_code == 200:
        resp_json = wallet_resp.json()
        # Response can be either a list directly or wrapped in data
        data = resp_json if isinstance(resp_json, list) else resp_json.get("data", [])
        
        # The response is grouped by company, extract wallets from the first company group
        wallets = []
        if data and isinstance(data, list) and len(data) > 0:
            if isinstance(data[0], dict) and "wallets" in data[0]:
                wallets = data[0].get("wallets", [])
            else:
                wallets = data
        
        wallet_count = len(wallets)
        
        print(f"✅ Status: 200")
        print(f"Total wallets: {wallet_count}")
        
        # Count USDT-ERC20 and USDC-ERC20
        usdt_erc20_count = sum(1 for w in wallets if w.get("wallet_type") == "USDT-ERC20")
        usdc_erc20_count = sum(1 for w in wallets if w.get("wallet_type") == "USDC-ERC20")
        
        print(f"USDT-ERC20 count: {usdt_erc20_count}")
        print(f"USDC-ERC20 count: {usdc_erc20_count}")
        
        if wallet_count == 13:
            print(f"✅ Wallet count is 13")
        else:
            print(f"⚠️ Wallet count is {wallet_count} (expected 13)")
        
        if usdt_erc20_count == 1:
            print(f"✅ Exactly ONE USDT-ERC20 wallet")
        else:
            print(f"❌ USDT-ERC20 count is {usdt_erc20_count} (expected 1)")
        
        if usdc_erc20_count == 1:
            print(f"✅ Exactly ONE USDC-ERC20 wallet")
        else:
            print(f"❌ USDC-ERC20 count is {usdc_erc20_count} (expected 1)")
        
        if wallet_count == 13 and usdt_erc20_count == 1 and usdc_erc20_count == 1:
            print(f"✅ PASS: Wallet structure correct (proves no data-level duplication)")
            success_5b = True
        else:
            print(f"❌ FAIL: Wallet structure incorrect")
    else:
        print(f"❌ getWallet failed: {wallet_resp.status_code}")
    
    return success_5a and success_5b

def test_6_safe_mode():
    """Test 6: Check safe mode in logs"""
    print("\n=== TEST 6: Safe Mode Check ===")
    
    # Check backend logs for safe mode indicators (look at more lines)
    result = os.popen("tail -n 2000 /var/log/supervisor/backend.*.log 2>/dev/null | grep -i 'BACKGROUND JOBS DISABLED\\|Skipping BullMQ webhook worker\\|ENABLE_BACKGROUND_JOBS=false' | head -5").read()
    
    if result.strip():
        print(f"✅ PASS: Safe mode indicators found in logs:")
        for line in result.strip().split('\n')[:3]:
            print(f"  {line[:150]}")
        return True
    else:
        print(f"⚠️ WARNING: No safe mode indicators found in recent logs")
        print(f"Checking for any 500 errors...")
        errors = os.popen("tail -n 500 /var/log/supervisor/backend.*.log 2>/dev/null | grep -i 'error 500\\|500 Internal' | head -3").read()
        if errors.strip():
            print(f"❌ Found 500 errors:")
            print(errors)
        else:
            print(f"✅ No 500 errors in recent logs")
        return False

def main():
    """Run all tests"""
    print("=" * 80)
    print("POST /api/pay/receipt ENDPOINT TESTING")
    print("Session 2026-08-13/14 - STRICT READ-ONLY on prod DB")
    print("=" * 80)
    
    results = {}
    
    # Tests 1-3: Auth tests (no login needed)
    results["test_1_no_auth"] = test_1_no_auth()
    results["test_2_invalid_token"] = test_2_invalid_token()
    results["test_3_valid_jwt_404"] = test_3_valid_jwt_404()
    
    # Test 4: Happy path (no login needed, uses customer JWT)
    results["test_4_happy_path"] = test_4_happy_path_and_409()
    
    # Tests 5-6: Regression tests (need login)
    token, csrf = login()
    if token:
        results["test_5_regression"] = test_5_regression(token)
        results["test_6_safe_mode"] = test_6_safe_mode()
    else:
        print("\n❌ Login failed, skipping regression tests")
        results["test_5_regression"] = False
        results["test_6_safe_mode"] = False
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED")
        return 0
    else:
        print(f"\n⚠️ {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
