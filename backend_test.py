#!/usr/bin/env python3
"""
DynoPay Phase 1 Backend Verification — R1 (DB retry resilience) + A2 (getFeeTiers owner-remap)
STRICTLY READ-ONLY against LIVE PRODUCTION database (SAFE MODE)
"""

import requests
import json
import sys

# Base URL through ingress
BASE_URL = "https://0e929189-e8a6-44b7-ae69-e900656450ab.preview.emergentagent.com/api"
BACKEND_HEALTH_URL = "http://localhost:8001/health"

# Test credentials
EMAIL = "onarrival21@gmail.com"
PASSWORD = "Katiekendra123@"

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print('='*80)

def print_test(test_name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"  → {details}")

def login():
    """Authenticate and get Bearer token"""
    print_section("AUTHENTICATION")
    
    url = f"{BASE_URL}/user/login"
    payload = {
        "email": EMAIL,
        "password": PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"POST /user/login → {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("data", {}).get("accessToken")
            if token:
                print_test("Login successful", True, f"Token length: {len(token)} chars")
                return token
            else:
                print_test("Login failed", False, "No accessToken in response")
                return None
        else:
            print_test("Login failed", False, f"Status {response.status_code}: {response.text[:200]}")
            return None
    except Exception as e:
        print_test("Login failed", False, f"Exception: {str(e)}")
        return None

def test_r1_db_reads(token):
    """R1 regression — DB reads healthy (Sequelize retry changes)"""
    print_section("R1 REGRESSION — DB READS HEALTHY")
    
    headers = {"Authorization": f"Bearer {token}"}
    results = []
    
    # Test 1: GET /api/dashboard/fee-tiers?company_id=1
    print("\n[Test 1] GET /api/dashboard/fee-tiers?company_id=1")
    try:
        response = requests.get(f"{BASE_URL}/dashboard/fee-tiers?company_id=1", headers=headers, timeout=30)
        status = response.status_code
        print(f"  Status: {status}")
        
        if status == 200:
            data = response.json()
            print_test("Fee tiers endpoint", True, "200 OK")
            results.append(("Fee tiers endpoint", True, status))
        else:
            print_test("Fee tiers endpoint", False, f"Expected 200, got {status}")
            results.append(("Fee tiers endpoint", False, status))
    except Exception as e:
        print_test("Fee tiers endpoint", False, f"Exception: {str(e)}")
        results.append(("Fee tiers endpoint", False, str(e)))
    
    # Test 2: GET /api/dashboard/recent-transactions?company_id=1
    print("\n[Test 2] GET /api/dashboard/recent-transactions?company_id=1")
    try:
        response = requests.get(f"{BASE_URL}/dashboard/recent-transactions?company_id=1", headers=headers, timeout=30)
        status = response.status_code
        print(f"  Status: {status}")
        
        if status == 200:
            data = response.json()
            transactions = data.get("data", {}).get("transactions", [])
            print(f"  Transactions count: {len(transactions)}")
            print_test("Recent transactions endpoint", True, f"200 OK, {len(transactions)} transactions")
            results.append(("Recent transactions endpoint", True, status))
        else:
            print_test("Recent transactions endpoint", False, f"Expected 200, got {status}")
            results.append(("Recent transactions endpoint", False, status))
    except Exception as e:
        print_test("Recent transactions endpoint", False, f"Exception: {str(e)}")
        results.append(("Recent transactions endpoint", False, str(e)))
    
    # Test 3: GET backend health directly (localhost:8001/health)
    print("\n[Test 3] GET http://localhost:8001/health")
    try:
        response = requests.get(BACKEND_HEALTH_URL, timeout=10)
        status = response.status_code
        print(f"  Status: {status}")
        
        if status == 200:
            data = response.json()
            db_status = data.get("database")
            redis_status = data.get("redis")
            overall_status = data.get("status")
            
            print(f"  Overall status: {overall_status}")
            print(f"  Database: {db_status}")
            print(f"  Redis: {redis_status}")
            
            if overall_status == "healthy" and db_status == "connected" and redis_status == "connected":
                print_test("Backend health check", True, "healthy, db+redis connected")
                results.append(("Backend health check", True, status))
            else:
                print_test("Backend health check", False, f"Status: {overall_status}, DB: {db_status}, Redis: {redis_status}")
                results.append(("Backend health check", False, f"{overall_status}/{db_status}/{redis_status}"))
        else:
            print_test("Backend health check", False, f"Expected 200, got {status}")
            results.append(("Backend health check", False, status))
    except Exception as e:
        print_test("Backend health check", False, f"Exception: {str(e)}")
        results.append(("Backend health check", False, str(e)))
    
    return results

def test_a2_owner_regression(token):
    """A2 owner regression — getFeeTiers returns owner's tier (Growth/1%/$28k), not Starter/$0"""
    print_section("A2 OWNER REGRESSION — FEE TIER REMAP")
    
    headers = {"Authorization": f"Bearer {token}"}
    results = []
    
    print("\n[Test 4] GET /api/dashboard/fee-tiers?company_id=1 (owner tier check)")
    try:
        response = requests.get(f"{BASE_URL}/dashboard/fee-tiers?company_id=1", headers=headers, timeout=30)
        status = response.status_code
        print(f"  Status: {status}")
        
        if status == 200:
            data = response.json().get("data", {})
            user_tier = data.get("user_tier", {})
            
            current_tier = user_tier.get("current_tier")
            current_tier_percent = user_tier.get("current_tier_percent")
            total_volume = user_tier.get("total_volume")
            
            print(f"  current_tier: {current_tier}")
            print(f"  current_tier_percent: {current_tier_percent}")
            print(f"  total_volume: {total_volume}")
            
            # Check if it's Growth tier with 1% and ~$28k volume (NOT Starter/$0)
            is_growth = current_tier == "Growth"
            is_one_percent = current_tier_percent == 1
            is_high_volume = total_volume and float(total_volume) > 20000  # ~$28k, allow some variance
            
            if is_growth and is_one_percent and is_high_volume:
                print_test("Owner sees Growth tier", True, f"Growth/1%/${total_volume} (NOT Starter/$0)")
                results.append(("Owner sees Growth tier", True, f"{current_tier}/{current_tier_percent}%/${total_volume}"))
            else:
                print_test("Owner sees Growth tier", False, f"Expected Growth/1%/~$28k, got {current_tier}/{current_tier_percent}%/${total_volume}")
                results.append(("Owner sees Growth tier", False, f"{current_tier}/{current_tier_percent}%/${total_volume}"))
        else:
            print_test("Owner sees Growth tier", False, f"Expected 200, got {status}")
            results.append(("Owner sees Growth tier", False, status))
    except Exception as e:
        print_test("Owner sees Growth tier", False, f"Exception: {str(e)}")
        results.append(("Owner sees Growth tier", False, str(e)))
    
    return results

def test_a2_access_control(token):
    """A2 access control — company_id=999999 (not owned) returns 403"""
    print_section("A2 ACCESS CONTROL — NON-OWNED COMPANY")
    
    headers = {"Authorization": f"Bearer {token}"}
    results = []
    
    print("\n[Test 5] GET /api/dashboard/fee-tiers?company_id=999999 (expect 403)")
    try:
        response = requests.get(f"{BASE_URL}/dashboard/fee-tiers?company_id=999999", headers=headers, timeout=30)
        status = response.status_code
        print(f"  Status: {status}")
        
        if status == 403:
            print_test("Non-owned company blocked", True, "403 Forbidden as expected")
            results.append(("Non-owned company blocked", True, status))
        else:
            print_test("Non-owned company blocked", False, f"Expected 403, got {status}")
            results.append(("Non-owned company blocked", False, status))
    except Exception as e:
        print_test("Non-owned company blocked", False, f"Exception: {str(e)}")
        results.append(("Non-owned company blocked", False, str(e)))
    
    return results

def main():
    print_section("DYNOPAY PHASE 1 BACKEND VERIFICATION")
    print("READ-ONLY testing against LIVE PRODUCTION database (SAFE MODE)")
    print(f"Base URL: {BASE_URL}")
    print(f"Auth: {EMAIL}")
    
    # Step 1: Login
    token = login()
    if not token:
        print("\n❌ CRITICAL: Authentication failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Step 2: R1 regression tests (DB reads healthy)
    r1_results = test_r1_db_reads(token)
    
    # Step 3: A2 owner regression (fee tier remap)
    a2_owner_results = test_a2_owner_regression(token)
    
    # Step 4: A2 access control (403 for non-owned company)
    a2_access_results = test_a2_access_control(token)
    
    # Summary
    all_results = r1_results + a2_owner_results + a2_access_results
    passed = sum(1 for _, result, _ in all_results if result)
    total = len(all_results)
    
    print_section("SUMMARY")
    print(f"Total tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success rate: {(passed/total)*100:.1f}%")
    
    print("\nDetailed results:")
    for test_name, result, details in all_results:
        status = "✅" if result else "❌"
        print(f"  {status} {test_name}: {details}")
    
    print("\n" + "="*80)
    if passed == total:
        print("✅ ALL TESTS PASSED — Phase 1 backend verification SUCCESSFUL")
    else:
        print(f"❌ {total - passed} TEST(S) FAILED — Phase 1 backend verification INCOMPLETE")
    print("="*80)
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
