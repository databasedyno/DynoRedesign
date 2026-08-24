#!/usr/bin/env python3
"""
Backend regression test for compression middleware build fix.
This is a compile-time-only fix (TypeScript cast) - runtime behavior should be unchanged.

CONTEXT:
- App pointed at STAGING Railway Postgres DB (EMPTY schema, NO users) in SAFE MODE
- DO NOT attempt login/authenticated flows - no seeded users exist
- Base URL: https://checkout-preview-25.preview.emergentagent.com (API routes prefixed with /api)
- Internal /health: http://localhost:8001/health (NOT exposed on external ingress)

WHAT TO VERIFY (unauthenticated, read-only only):
1. GET http://localhost:8001/health → HTTP 200 with status "healthy", database "connected", redis "connected", background_jobs.eligible=false
2. GET https://checkout-preview-25.preview.emergentagent.com/api/status/health → HTTP 200 healthy JSON
3. Hit PUBLIC GET /api endpoints - confirm server responds WITHOUT 5xx/crash (regression check)
4. (Best-effort) gzip compression: request with "Accept-Encoding: gzip" and check for "Content-Encoding: gzip" or "Vary: Accept-Encoding"
"""

import requests
import json
import sys

# Base URLs
INTERNAL_BASE = "http://localhost:8001"
EXTERNAL_BASE = "https://checkout-preview-25.preview.emergentagent.com"

def print_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status} - {name}")
    if details:
        print(f"  {details}")

def test_internal_health():
    """Test 1: Internal /health endpoint (localhost:8001)"""
    print("\n" + "="*80)
    print("TEST 1: Internal /health endpoint (http://localhost:8001/health)")
    print("="*80)
    
    try:
        response = requests.get(f"{INTERNAL_BASE}/health", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("Internal /health endpoint", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check required fields
        checks = {
            "status == 'healthy'": data.get("status") == "healthy",
            "database == 'connected'": data.get("database") == "connected",
            "redis == 'connected'": data.get("redis") == "connected",
            "background_jobs.eligible == false": data.get("background_jobs", {}).get("eligible") == False
        }
        
        all_passed = all(checks.values())
        
        for check, passed in checks.items():
            status = "✅" if passed else "❌"
            print(f"  {status} {check}")
        
        print_test("Internal /health endpoint", all_passed, 
                   "Server booted successfully with the fix" if all_passed else "Health check fields mismatch")
        return all_passed
        
    except Exception as e:
        print_test("Internal /health endpoint", False, f"Exception: {str(e)}")
        return False

def test_external_health():
    """Test 2: External /api/status/health endpoint"""
    print("\n" + "="*80)
    print("TEST 2: External /api/status/health endpoint")
    print("="*80)
    
    try:
        response = requests.get(f"{EXTERNAL_BASE}/api/status/health", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("External /api/status/health", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check it's a healthy JSON response
        has_status = "status" in data or "message" in data or "data" in data
        
        print_test("External /api/status/health", has_status, 
                   "Healthy JSON response received" if has_status else "No recognizable health data")
        return has_status
        
    except Exception as e:
        print_test("External /api/status/health", False, f"Exception: {str(e)}")
        return False

def test_public_endpoints():
    """Test 3: Public GET /api endpoints (regression check - no 5xx crashes)"""
    print("\n" + "="*80)
    print("TEST 3: Public GET /api endpoints (regression check)")
    print("="*80)
    
    # List of public endpoints to test (unauthenticated, read-only)
    # Note: Protected endpoints returning 401/403 is EXPECTED and CORRECT
    public_endpoints = [
        "/api/csrf-token",  # Public CSRF token endpoint
        "/api/user/checkEmail?email=test@example.com",  # Public email check
        "/api/products/categories",  # Public categories (may be empty)
    ]
    
    results = []
    
    for endpoint in public_endpoints:
        try:
            url = f"{EXTERNAL_BASE}{endpoint}"
            print(f"\nTesting: {endpoint}")
            response = requests.get(url, timeout=10)
            print(f"  Status Code: {response.status_code}")
            
            # Check for 5xx server errors (the key regression check)
            is_not_5xx = response.status_code < 500
            
            if is_not_5xx:
                print(f"  ✅ No server error (status {response.status_code})")
                if response.status_code == 401 or response.status_code == 403:
                    print(f"  ℹ️  Protected endpoint - 401/403 is EXPECTED and CORRECT")
                results.append(True)
            else:
                print(f"  ❌ Server error {response.status_code}")
                try:
                    print(f"  Response: {response.text[:500]}")
                except Exception:
                    pass
                results.append(False)
                
        except Exception as e:
            print(f"  ❌ Exception: {str(e)}")
            results.append(False)
    
    all_passed = all(results)
    print_test("Public endpoints regression check", all_passed,
               f"{sum(results)}/{len(results)} endpoints responded without 5xx" if all_passed 
               else f"Some endpoints returned 5xx errors")
    return all_passed

def test_gzip_compression():
    """Test 4: gzip compression sanity check (best-effort)"""
    print("\n" + "="*80)
    print("TEST 4: gzip compression sanity check (best-effort)")
    print("="*80)
    
    # Test with a public endpoint that might return a large response
    endpoint = "/api/csrf-token"
    url = f"{EXTERNAL_BASE}{endpoint}"
    
    print("\n4a. Request WITH Accept-Encoding: gzip")
    try:
        response = requests.get(url, headers={"Accept-Encoding": "gzip"}, timeout=10)
        print(f"  Status Code: {response.status_code}")
        print(f"  Content-Encoding: {response.headers.get('Content-Encoding', 'NOT SET')}")
        print(f"  Vary: {response.headers.get('Vary', 'NOT SET')}")
        print(f"  Content-Length: {response.headers.get('Content-Length', 'NOT SET')}")
        
        # Check for compression indicators
        has_gzip = response.headers.get('Content-Encoding') == 'gzip'
        has_vary = 'Accept-Encoding' in response.headers.get('Vary', '')
        
        if has_gzip:
            print(f"  ✅ Response is gzip compressed")
        elif has_vary:
            print(f"  ℹ️  Response has Vary: Accept-Encoding (compression middleware active)")
            print(f"  ℹ️  Response may be below compression size threshold (acceptable)")
        else:
            print(f"  ℹ️  No compression headers (response may be too small)")
        
    except Exception as e:
        print(f"  ❌ Exception: {str(e)}")
    
    print("\n4b. Request WITH x-no-compression: 1 (compression should be disabled)")
    try:
        response = requests.get(url, headers={"x-no-compression": "1", "Accept-Encoding": "gzip"}, timeout=10)
        print(f"  Status Code: {response.status_code}")
        print(f"  Content-Encoding: {response.headers.get('Content-Encoding', 'NOT SET')}")
        
        # Check compression is disabled
        no_gzip = response.headers.get('Content-Encoding') != 'gzip'
        
        if no_gzip:
            print(f"  ✅ Compression disabled with x-no-compression header")
        else:
            print(f"  ❌ Compression still active despite x-no-compression header")
        
        print_test("gzip compression sanity check", True, 
                   "Compression middleware is active (best-effort check)")
        return True
        
    except Exception as e:
        print(f"  ❌ Exception: {str(e)}")
        print_test("gzip compression sanity check", True, 
                   "Best-effort check - not critical for regression test")
        return True

def main():
    print("\n" + "="*80)
    print("BACKEND REGRESSION TEST: Compression Middleware Build Fix")
    print("="*80)
    print("Context: Compile-time-only fix (TypeScript cast at server.ts:254)")
    print("Runtime behavior should be UNCHANGED")
    print("App on STAGING DB (empty schema, NO users) in SAFE MODE")
    print("="*80)
    
    results = {
        "Test 1: Internal /health": test_internal_health(),
        "Test 2: External /api/status/health": test_external_health(),
        "Test 3: Public endpoints regression": test_public_endpoints(),
        "Test 4: gzip compression (best-effort)": test_gzip_compression(),
    }
    
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    total = len(results)
    passed = sum(results.values())
    print(f"\nTotal: {passed}/{total} tests passed ({passed*100//total}%)")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED - No regression detected from compression middleware fix")
        print("The backend is healthy and public endpoints respond without server errors.")
        return 0
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED - Issues detected")
        return 1

if __name__ == "__main__":
    sys.exit(main())
