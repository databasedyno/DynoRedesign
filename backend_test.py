#!/usr/bin/env python3
"""
REGRESSION TEST: Referral service refactor (maybeSendPostPaymentInvite extraction)
READ-ONLY against LIVE PROD DB in SAFE MODE.
Tests 7 endpoints to confirm no import cycle or runtime errors after the refactor.
"""
import requests
import json
import sys

BASE_URL = "https://87e6bc11-1888-4816-af91-aff395d8e903.preview.emergentagent.com/api"
EMAIL = "onarrival21@gmail.com"
PASSWORD = "Katiekendra123@"

def test_health():
    """Step 1: GET /health → healthy (db + redis connected)"""
    print("\n[1/7] Testing GET /health...")
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"  Response: {json.dumps(data, indent=2)}")
            if data.get('status') == 'healthy' and data.get('database') == 'connected' and data.get('redis') == 'connected':
                print("  ✅ PASS: Backend healthy, db + redis connected")
                return True
            else:
                print(f"  ❌ FAIL: Backend not fully healthy: {data}")
                return False
        else:
            print(f"  ❌ FAIL: Expected 200, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return False

def test_login():
    """Step 2: POST /user/login → 200 + accessToken"""
    print("\n[2/7] Testing POST /user/login...")
    try:
        resp = requests.post(
            f"{BASE_URL}/user/login",
            json={"email": EMAIL, "password": PASSWORD},
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            token = data.get('data', {}).get('accessToken')
            if token:
                print(f"  ✅ PASS: Login successful, token length: {len(token)}")
                return token
            else:
                print(f"  ❌ FAIL: No accessToken in response: {json.dumps(data, indent=2)}")
                return None
        else:
            print(f"  ❌ FAIL: Expected 200, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return None
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return None

def test_referral_my_code(token):
    """Step 3: GET /referral/my-code (Bearer) → 200, data.referral_code present"""
    print("\n[3/7] Testing GET /referral/my-code...")
    try:
        resp = requests.get(
            f"{BASE_URL}/referral/my-code",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            referral_code = data.get('data', {}).get('referral_code')
            if referral_code:
                print(f"  ✅ PASS: referral_code present: {referral_code}")
                print(f"  Response snippet: {json.dumps(data.get('data', {}), indent=2)[:300]}")
                return True
            else:
                print(f"  ❌ FAIL: No referral_code in response: {json.dumps(data, indent=2)}")
                return False
        else:
            print(f"  ❌ FAIL: Expected 200, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return False

def test_referral_earnings(token):
    """Step 4: GET /referral/earnings (Bearer) → 200, data.summary + data.commission present"""
    print("\n[4/7] Testing GET /referral/earnings...")
    try:
        resp = requests.get(
            f"{BASE_URL}/referral/earnings",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            summary = data.get('data', {}).get('summary')
            commission = data.get('data', {}).get('commission')
            if summary and commission:
                print(f"  ✅ PASS: summary + commission present")
                print(f"  Summary: {json.dumps(summary, indent=2)[:200]}")
                print(f"  Commission: {json.dumps(commission, indent=2)[:200]}")
                return True
            else:
                print(f"  ❌ FAIL: Missing summary or commission: {json.dumps(data, indent=2)}")
                return False
        else:
            print(f"  ❌ FAIL: Expected 200, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return False

def test_dashboard_transactions(token):
    """Step 5: GET /dashboard/recent-transactions?company_id=1 (Bearer) → 200, transactions include usd_value"""
    print("\n[5/7] Testing GET /dashboard/recent-transactions?company_id=1...")
    try:
        resp = requests.get(
            f"{BASE_URL}/dashboard/recent-transactions?company_id=1",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            transactions = data.get('data', {}).get('transactions', [])
            if transactions:
                # Check if usd_value is present in transactions
                has_usd_value = all('usd_value' in tx for tx in transactions)
                if has_usd_value:
                    print(f"  ✅ PASS: {len(transactions)} transactions, all have usd_value")
                    print(f"  Sample transaction: {json.dumps(transactions[0], indent=2)[:300]}")
                    return True
                else:
                    print(f"  ❌ FAIL: Some transactions missing usd_value")
                    return False
            else:
                print(f"  ⚠️  PASS (no transactions): Empty transactions array (expected for test account)")
                return True
        else:
            print(f"  ❌ FAIL: Expected 200, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return False

def test_kyc_webhook_no_auth():
    """Step 6: POST /kyc/webhook with garbage/no signature headers → 401 (not 500/404)"""
    print("\n[6/7] Testing POST /kyc/webhook (no auth headers)...")
    try:
        resp = requests.post(
            f"{BASE_URL}/kyc/webhook",
            json={"verification": {"id": "test"}},
            headers={},  # No X-HMAC-SIGNATURE or X-AUTH-CLIENT
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 401:
            print(f"  ✅ PASS: Correctly rejected with 401 (not 500/404)")
            print(f"  Response: {resp.text[:200]}")
            return True
        else:
            print(f"  ❌ FAIL: Expected 401, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return False

def test_verify_otp_invalid():
    """Step 7: POST /user/registerEmail/verify-otp with invalid OTP → 400 (not 500)"""
    print("\n[7/7] Testing POST /user/registerEmail/verify-otp (invalid OTP)...")
    try:
        import random
        random_suffix = random.randint(10000, 99999)
        fake_email = f"qa-donotcreate-{random_suffix}@example.com"
        
        resp = requests.post(
            f"{BASE_URL}/user/registerEmail/verify-otp",
            json={"email": fake_email, "otp": "000000"},
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 400:
            print(f"  ✅ PASS: Correctly rejected with 400 (not 500)")
            print(f"  Response: {resp.text[:200]}")
            return True
        else:
            print(f"  ❌ FAIL: Expected 400, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return False

def main():
    print("=" * 80)
    print("REGRESSION TEST: Referral service refactor")
    print("Testing maybeSendPostPaymentInvite extraction (no import cycle)")
    print("BASE URL:", BASE_URL)
    print("=" * 80)
    
    results = []
    
    # Step 1: Health check
    results.append(("Health check", test_health()))
    
    # Step 2: Login
    token = test_login()
    results.append(("Login", token is not None))
    
    if not token:
        print("\n❌ CRITICAL: Login failed, cannot continue with authenticated tests")
        print_summary(results)
        sys.exit(1)
    
    # Steps 3-5: Authenticated endpoints
    results.append(("Referral my-code", test_referral_my_code(token)))
    results.append(("Referral earnings", test_referral_earnings(token)))
    results.append(("Dashboard transactions", test_dashboard_transactions(token)))
    
    # Steps 6-7: Public endpoints (security checks)
    results.append(("KYC webhook (no auth)", test_kyc_webhook_no_auth()))
    results.append(("Verify OTP (invalid)", test_verify_otp_invalid()))
    
    print_summary(results)
    
    # Exit with appropriate code
    passed = sum(1 for _, result in results if result)
    total = len(results)
    sys.exit(0 if passed == total else 1)

def print_summary(results):
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print("-" * 80)
    print(f"TOTAL: {passed}/{total} tests passed ({100*passed//total}%)")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED - No regression detected after refactor")
    else:
        print(f"\n❌ {total - passed} test(s) failed - Regression detected")
    print("=" * 80)

if __name__ == "__main__":
    main()
