#!/usr/bin/env python3
"""
DynoPay Backend Verification — Fast-Path 404 for Malformed Creator Handles (2026-08-26)
========================================================================================
Testing BOTH localhost:8001 AND external URL to isolate network latency

PRODUCTION DATABASE - STRICTLY READ-ONLY (only GET requests + /health)
"""

import requests
import time

# Base URLs
LOCALHOST_BASE = "http://localhost:8001"
EXTERNAL_BASE = "https://payment-gateway-init-2.preview.emergentagent.com"

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
                print(f"⚠️ SLOW: Response time {elapsed_ms:.2f}ms exceeds threshold {max_time_ms}ms")
            return status_match, response.status_code, elapsed_ms
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, None, None

def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("DYNOPAY BACKEND VERIFICATION")
    print("Fast-Path 404 for Malformed Creator Handles (2026-08-26)")
    print("Testing BOTH localhost:8001 AND external URL")
    print("="*70)
    print(f"External Base: {EXTERNAL_BASE}")
    print(f"Localhost Base: {LOCALHOST_BASE}")
    print("⚠️  PRODUCTION DATABASE - STRICTLY READ-ONLY")
    print("="*70)
    
    # TEST 1a: Malformed handle via LOCALHOST
    print("\n" + "="*70)
    print("TEST 1a: Malformed Handle (sftp-config.json) via LOCALHOST -> Fast 404")
    print("="*70)
    
    success_1a, status_1a, time_1a = measure_request(
        f"{LOCALHOST_BASE}/api/pay/creator/sftp-config.json",
        "Malformed handle via localhost: sftp-config.json",
        404,
        FAST_THRESHOLD_MS
    )
    
    # TEST 1b: Malformed handle via EXTERNAL URL
    print("\n" + "="*70)
    print("TEST 1b: Malformed Handle (sftp-config.json) via EXTERNAL URL -> Fast 404")
    print("="*70)
    
    success_1b, status_1b, time_1b = measure_request(
        f"{EXTERNAL_BASE}/api/pay/creator/sftp-config.json",
        "Malformed handle via external URL: sftp-config.json",
        404,
        FAST_THRESHOLD_MS
    )
    
    # TEST 2a: Malformed handle analytics via LOCALHOST
    print("\n" + "="*70)
    print("TEST 2a: Malformed Handle Analytics via LOCALHOST -> Fast 404")
    print("="*70)
    
    success_2a, status_2a, time_2a = measure_request(
        f"{LOCALHOST_BASE}/api/pay/creator/sftp-config.json/analytics",
        "Malformed handle analytics via localhost: sftp-config.json/analytics",
        404,
        FAST_THRESHOLD_MS
    )
    
    # TEST 2b: Malformed handle analytics via EXTERNAL URL
    print("\n" + "="*70)
    print("TEST 2b: Malformed Handle Analytics via EXTERNAL URL -> Fast 404")
    print("="*70)
    
    success_2b, status_2b, time_2b = measure_request(
        f"{EXTERNAL_BASE}/api/pay/creator/sftp-config.json/analytics",
        "Malformed handle analytics via external URL: sftp-config.json/analytics",
        404,
        FAST_THRESHOLD_MS
    )
    
    # TEST 3: REGRESSION - Valid creator handle (devhub) via EXTERNAL
    print("\n" + "="*70)
    print("TEST 3: REGRESSION - Valid Creator Handle (devhub) -> 200")
    print("="*70)
    
    success_3, status_3, time_3 = measure_request(
        f"{EXTERNAL_BASE}/api/pay/creator/devhub",
        "Valid creator handle: devhub",
        200,
        None
    )
    
    # TEST 4: REGRESSION - Valid format but nonexistent handle via EXTERNAL
    print("\n" + "="*70)
    print("TEST 4: REGRESSION - Valid Format Nonexistent Handle -> 404")
    print("="*70)
    
    success_4, status_4, time_4 = measure_request(
        f"{EXTERNAL_BASE}/api/pay/creator/nonexistenthandle123",
        "Valid format nonexistent handle: nonexistenthandle123",
        404,
        None
    )
    
    # TEST 5: Health check via LOCALHOST
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
                success_5 = True
            else:
                print(f"⚠️ TEST 5 PARTIAL: Got 200 but values don't match")
                success_5 = False
        else:
            print(f"❌ TEST 5 FAILED: Expected 200, got {response.status_code}")
            success_5 = False
    except Exception as e:
        print(f"❌ TEST 5 ERROR: {str(e)}")
        success_5 = False
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    print("\n📊 PERFORMANCE COMPARISON:")
    print(f"   Test 1 (sftp-config.json):")
    print(f"      Localhost:    {time_1a:.2f}ms {'✅' if time_1a and time_1a < FAST_THRESHOLD_MS else '⚠️'}")
    print(f"      External URL: {time_1b:.2f}ms {'✅' if time_1b and time_1b < FAST_THRESHOLD_MS else '⚠️'}")
    if time_1a and time_1b:
        print(f"      Network overhead: {time_1b - time_1a:.2f}ms")
    
    print(f"\n   Test 2 (sftp-config.json/analytics):")
    print(f"      Localhost:    {time_2a:.2f}ms {'✅' if time_2a and time_2a < FAST_THRESHOLD_MS else '⚠️'}")
    print(f"      External URL: {time_2b:.2f}ms {'✅' if time_2b and time_2b < FAST_THRESHOLD_MS else '⚠️'}")
    if time_2a and time_2b:
        print(f"      Network overhead: {time_2b - time_2a:.2f}ms")
    
    print("\n📋 FUNCTIONAL TESTS:")
    print(f"   {'✅' if success_3 else '❌'} Test 3: Valid creator handle (devhub) -> 200")
    print(f"   {'✅' if success_4 else '❌'} Test 4: Valid format nonexistent handle -> 404")
    print(f"   {'✅' if success_5 else '❌'} Test 5: Health check (SAFE MODE)")
    
    # Determine overall result
    all_status_correct = (status_1a == 404 and status_1b == 404 and 
                          status_2a == 404 and status_2b == 404 and
                          success_3 and success_4 and success_5)
    
    localhost_fast = (time_1a and time_1a < FAST_THRESHOLD_MS and 
                      time_2a and time_2a < FAST_THRESHOLD_MS)
    
    print("\n" + "="*70)
    print("VERDICT:")
    print("="*70)
    
    if all_status_correct and localhost_fast:
        print("✅ FIX VERIFIED: Fast-path 404 is working correctly!")
        print(f"   - Malformed handles return 404 in < {FAST_THRESHOLD_MS}ms on localhost")
        print("   - Valid handles still work correctly (devhub -> 200)")
        print("   - Valid-format nonexistent handles still hit DB (404)")
        print("   - SAFE MODE confirmed")
        if time_1b and time_1b >= FAST_THRESHOLD_MS:
            print(f"\n⚠️  NOTE: External URL has network latency (~{time_1b - time_1a:.0f}ms overhead)")
            print("   This is expected for K8s ingress routing and NOT a bug in the fix.")
    elif all_status_correct and not localhost_fast:
        print("❌ FIX NOT WORKING: Malformed handles still slow even on localhost")
        print(f"   - Expected < {FAST_THRESHOLD_MS}ms, got {time_1a:.2f}ms and {time_2a:.2f}ms")
        print("   - The fast-path guard may not be working as intended")
    else:
        print("❌ FUNCTIONAL ISSUES: Some endpoints returning wrong status codes")
    
    print("="*70)

if __name__ == "__main__":
    main()
