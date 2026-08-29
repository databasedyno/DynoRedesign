#!/usr/bin/env python3
"""
DynoPay Backend Verification — Fast-Path 404 for Malformed Creator Handles (2026-08-26)
========================================================================================
PRODUCTION DATABASE - STRICTLY READ-ONLY (only GET requests + /health)

Test Cases (per review_request):
1. GET /api/pay/creator/sftp-config.json -> 404 AND fast (well under 300ms; was ~600ms)
2. GET /api/pay/creator/sftp-config.json/analytics -> 404 AND fast (was ~600ms)
3. REGRESSION: GET /api/pay/creator/devhub -> 200 (valid creator page still resolves)
4. REGRESSION: GET /api/pay/creator/nonexistenthandle123 -> 404 (valid FORMAT, still DB-checked)
5. GET http://localhost:8001/health -> healthy (db+redis connected, background_jobs.eligible=false)

DO NOT log in and mutate data, DO NOT trigger emails/payments/sweeps. Read-only GETs + /health only.
"""

import requests
import time

# Base URLs
LOCALHOST_BASE = "http://localhost:8001"
EXTERNAL_BASE = "https://dynopay-preview-14.preview.emergentagent.com"
API_BASE = f"{EXTERNAL_BASE}/api"

# Performance threshold
FAST_THRESHOLD_MS = 300  # Well under 300ms

def measure_request(url, description, expected_status, max_time_ms=None):
    """
    Make a GET request and measure response time
    Returns: (success: bool, status_code: int, time_ms: float)
    """
    print(f"\n[TEST] {description}")
    print(f"GET {url}")
    print(f"Expected: HTTP {expected_status}", end="")
    if max_time_ms:
        print(f" AND response time < {max_time_ms}ms")
    else:
        print()
    
    try:
        start_time = time.time()
        response = requests.get(url, timeout=10)
        end_time = time.time()
        
        elapsed_ms = (end_time - start_time) * 1000
        
        print(f"Actual Status: {response.status_code}")
        print(f"Response Time: {elapsed_ms:.2f}ms")
        
        status_match = response.status_code == expected_status
        time_ok = True if max_time_ms is None else elapsed_ms < max_time_ms
        
        if status_match and time_ok:
            if max_time_ms:
                print(f"✅ PASS: Got {response.status_code} in {elapsed_ms:.2f}ms (< {max_time_ms}ms)")
            else:
                print(f"✅ PASS: Got {response.status_code}")
            return True, response.status_code, elapsed_ms
        else:
            if not status_match:
                print(f"❌ FAIL: Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text[:500]}")
            if not time_ok:
                print(f"❌ FAIL: Response time {elapsed_ms:.2f}ms exceeds threshold {max_time_ms}ms")
            return False, response.status_code, elapsed_ms
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, None, None

def test_health_check():
    """
    TEST 5: Health check
    Expected: status=healthy, database=connected, redis=connected, background_jobs.eligible=false
    """
    print("\n" + "="*70)
    print("TEST 5: Health Check (SAFE MODE verification)")
    print("="*70)
    
    url = f"{LOCALHOST_BASE}/health"
    
    print(f"\n[TEST 5] GET {url}")
    print(f"Expected: status=healthy, database=connected, redis=connected, background_jobs.eligible=false")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"\nActual Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {data}")
            
            status = data.get('status')
            database = data.get('database')
            redis = data.get('redis')
            bg_jobs = data.get('background_jobs', {}).get('eligible')
            
            if status == 'healthy' and database == 'connected' and redis == 'connected' and bg_jobs == False:
                print(f"✅ TEST 5 PASSED: Health check returned all expected values")
                print(f"   - status: {status}")
                print(f"   - database: {database}")
                print(f"   - redis: {redis}")
                print(f"   - background_jobs.eligible: {bg_jobs} (SAFE MODE confirmed)")
                return True
            else:
                print(f"⚠️ TEST 5 PARTIAL: Got 200 but values don't match:")
                print(f"   - status: {status} (expected: healthy)")
                print(f"   - database: {database} (expected: connected)")
                print(f"   - redis: {redis} (expected: connected)")
                print(f"   - background_jobs.eligible: {bg_jobs} (expected: false)")
                return False
        else:
            print(f"❌ TEST 5 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 5 ERROR: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("DYNOPAY BACKEND VERIFICATION")
    print("Fast-Path 404 for Malformed Creator Handles (2026-08-26)")
    print("="*70)
    print(f"External Base: {EXTERNAL_BASE}")
    print(f"Localhost Base: {LOCALHOST_BASE}")
    print("⚠️  PRODUCTION DATABASE - STRICTLY READ-ONLY")
    print("="*70)
    
    results = {}
    
    # TEST 1: Malformed handle (sftp-config.json) -> fast 404
    print("\n" + "="*70)
    print("TEST 1: Malformed Handle (sftp-config.json) -> Fast 404")
    print("="*70)
    print("BUG: Previously ~600ms because it did a remote Railway DB lookup")
    print("FIX: Fast-path guard rejects malformed handles BEFORE any DB query")
    
    success, status, time_ms = measure_request(
        f"{API_BASE}/pay/creator/sftp-config.json",
        "Malformed handle: sftp-config.json",
        404,
        FAST_THRESHOLD_MS
    )
    results["Test 1: Malformed handle (sftp-config.json)"] = success
    
    # TEST 2: Malformed handle analytics endpoint -> fast 404
    print("\n" + "="*70)
    print("TEST 2: Malformed Handle Analytics (sftp-config.json/analytics) -> Fast 404")
    print("="*70)
    print("BUG: Previously ~600ms because getCreatorPublicAnalytics did a DB query")
    print("FIX: Inline guard rejects malformed handles BEFORE any DB query")
    
    success, status, time_ms = measure_request(
        f"{API_BASE}/pay/creator/sftp-config.json/analytics",
        "Malformed handle analytics: sftp-config.json/analytics",
        404,
        FAST_THRESHOLD_MS
    )
    results["Test 2: Malformed handle analytics (sftp-config.json/analytics)"] = success
    
    # TEST 3: REGRESSION - Valid creator handle (devhub) -> 200
    print("\n" + "="*70)
    print("TEST 3: REGRESSION - Valid Creator Handle (devhub) -> 200")
    print("="*70)
    print("This is a real creator page/handle in the prod DB")
    print("The JSON should contain creator/storefront data")
    
    success, status, time_ms = measure_request(
        f"{API_BASE}/pay/creator/devhub",
        "Valid creator handle: devhub",
        200,
        None
    )
    results["Test 3: Valid creator handle (devhub)"] = success
    
    # TEST 4: REGRESSION - Valid format but nonexistent handle -> 404
    print("\n" + "="*70)
    print("TEST 4: REGRESSION - Valid Format Nonexistent Handle -> 404")
    print("="*70)
    print("This is a VALID-FORMAT handle so it correctly still hits the DB")
    print("and is simply not found — this is expected/correct behavior, NOT a bug")
    
    success, status, time_ms = measure_request(
        f"{API_BASE}/pay/creator/nonexistenthandle123",
        "Valid format nonexistent handle: nonexistenthandle123",
        404,
        None
    )
    results["Test 4: Valid format nonexistent handle (nonexistenthandle123)"] = success
    
    # TEST 5: Health check (SAFE MODE)
    results["Test 5: Health check (SAFE MODE)"] = test_health_check()
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({int(passed/total*100)}% pass rate)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Fast-path 404 bug fix verified successfully!")
        print("\nFIX GOAL MET:")
        print("✅ Malformed handles (bot scans) now return 404 in well under 300ms")
        print("✅ No regression for valid handles (devhub still returns 200)")
        print("✅ Valid-format nonexistent handles still correctly hit DB and return 404")
        print("✅ SAFE MODE confirmed (background_jobs.eligible=false)")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed - Bug fix incomplete or issues detected")
    
    print("="*70)

if __name__ == "__main__":
    main()
