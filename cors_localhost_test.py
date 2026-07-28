#!/usr/bin/env python3
"""
CORS Domain Guardrail Test - Direct Localhost Testing

Tests the backend CORS implementation by hitting http://localhost:8001 DIRECTLY
(bypassing Cloudflare edge which adds wildcard access-control-allow-origin: *).

The backend listens on 127.0.0.1:8001 inside this container.
All API routes are under /api; the health route is at /health (root).
"""

import subprocess
import json
import sys

# Test matrix
TESTS = [
    {
        "id": 1,
        "origin": "https://dynopay.com",
        "expected": "ALLOWED",
        "description": "Exact origin in allow-list"
    },
    {
        "id": 2,
        "origin": "https://checkout.dynopay.com",
        "expected": "ALLOWED",
        "description": "Subdomain of trusted base"
    },
    {
        "id": 3,
        "origin": "https://api.dynopay.com",
        "expected": "ALLOWED",
        "description": "KEY TEST - NOT in explicit list, auto-included via subdomain guardrail"
    },
    {
        "id": 4,
        "origin": "https://random-sub.dynopay.com",
        "expected": "ALLOWED",
        "description": "Random subdomain of trusted base"
    },
    {
        "id": 5,
        "origin": "https://rapid-launch-hub.preview.emergentagent.com",
        "expected": "ALLOWED",
        "description": "Preview pattern"
    },
    {
        "id": 6,
        "origin": "https://evil-attacker-site.com",
        "expected": "BLOCKED",
        "description": "Untrusted origin"
    },
    {
        "id": 7,
        "origin": "https://dynopay.com.evil.com",
        "expected": "BLOCKED",
        "description": "Lookalike suffix attack"
    },
    {
        "id": 8,
        "origin": "https://notdynopay.com",
        "expected": "BLOCKED",
        "description": "Similar but different domain"
    }
]

# Normal API tests
API_TESTS = [
    {
        "id": 9,
        "method": "GET",
        "url": "http://localhost:8001/api/csrf-token",
        "expected_status": 200,
        "description": "GET /api/csrf-token should return 200 with JSON"
    },
    {
        "id": 10,
        "method": "GET",
        "url": "http://localhost:8001/health",
        "expected_status": 200,
        "description": "GET /health should return 200"
    }
]

def run_preflight_test(test):
    """Run OPTIONS preflight request and extract access-control-allow-origin header."""
    origin = test["origin"]
    
    # curl OPTIONS preflight
    cmd = [
        "curl", "-s", "-i", "-X", "OPTIONS",
        "http://localhost:8001/api/csrf-token",
        "-H", f"Origin: {origin}",
        "-H", "Access-Control-Request-Method: GET",
        "-H", "Access-Control-Request-Headers: content-type"
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        response = result.stdout
        
        # Extract status code
        status_line = response.split('\n')[0] if response else ""
        status_code = None
        if "HTTP" in status_line:
            parts = status_line.split()
            if len(parts) >= 2:
                try:
                    status_code = int(parts[1])
                except:
                    pass
        
        # Extract access-control-allow-origin header
        allow_origin = None
        for line in response.split('\n'):
            if line.lower().startswith('access-control-allow-origin:'):
                allow_origin = line.split(':', 1)[1].strip()
                break
        
        # Determine if ALLOWED or BLOCKED
        # ALLOWED = header echoes the exact Origin
        # BLOCKED = no access-control-allow-origin header
        actual = "BLOCKED"
        if allow_origin:
            if allow_origin == origin:
                actual = "ALLOWED"
            elif allow_origin == "*":
                actual = "ALLOWED (wildcard)"
            else:
                actual = f"ALLOWED (mismatch: {allow_origin})"
        
        return {
            "status_code": status_code,
            "allow_origin": allow_origin or "none",
            "actual": actual,
            "passed": actual == test["expected"]
        }
    except Exception as e:
        return {
            "status_code": None,
            "allow_origin": "error",
            "actual": f"ERROR: {str(e)}",
            "passed": False
        }

def run_api_test(test):
    """Run normal API request and check status code."""
    cmd = [
        "curl", "-s", "-i", "-X", test["method"],
        test["url"]
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        response = result.stdout
        
        # Extract status code
        status_line = response.split('\n')[0] if response else ""
        status_code = None
        if "HTTP" in status_line:
            parts = status_line.split()
            if len(parts) >= 2:
                try:
                    status_code = int(parts[1])
                except:
                    pass
        
        # Check if response body contains JSON (for csrf-token test)
        body = response.split('\r\n\r\n', 1)[1] if '\r\n\r\n' in response else ""
        has_json = False
        if body.strip():
            try:
                json.loads(body.strip())
                has_json = True
            except:
                pass
        
        passed = status_code == test["expected_status"]
        
        return {
            "status_code": status_code,
            "has_json": has_json,
            "passed": passed
        }
    except Exception as e:
        return {
            "status_code": None,
            "has_json": False,
            "passed": False,
            "error": str(e)
        }

def main():
    print("=" * 80)
    print("CORS DOMAIN GUARDRAIL TEST - DIRECT LOCALHOST")
    print("Testing backend at http://localhost:8001")
    print("=" * 80)
    print()
    
    # Run preflight tests
    print("PREFLIGHT TESTS (OPTIONS /api/csrf-token)")
    print("-" * 80)
    
    results = []
    for test in TESTS:
        print(f"\nTest {test['id']}: {test['description']}")
        print(f"  Origin: {test['origin']}")
        print(f"  Expected: {test['expected']}")
        
        result = run_preflight_test(test)
        results.append({**test, **result})
        
        print(f"  Status: {result['status_code']}")
        print(f"  access-control-allow-origin: {result['allow_origin']}")
        print(f"  Actual: {result['actual']}")
        print(f"  Result: {'✅ PASS' if result['passed'] else '❌ FAIL'}")
    
    # Run API tests
    print("\n" + "=" * 80)
    print("NORMAL API TESTS")
    print("-" * 80)
    
    api_results = []
    for test in API_TESTS:
        print(f"\nTest {test['id']}: {test['description']}")
        print(f"  {test['method']} {test['url']}")
        print(f"  Expected: HTTP {test['expected_status']}")
        
        result = run_api_test(test)
        api_results.append({**test, **result})
        
        print(f"  Status: {result['status_code']}")
        if test['id'] == 9:
            print(f"  Has JSON: {result['has_json']}")
        print(f"  Result: {'✅ PASS' if result['passed'] else '❌ FAIL'}")
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    preflight_passed = sum(1 for r in results if r['passed'])
    api_passed = sum(1 for r in api_results if r['passed'])
    total_passed = preflight_passed + api_passed
    total_tests = len(results) + len(api_results)
    
    print(f"\nPreflight Tests: {preflight_passed}/{len(results)} PASSED")
    print(f"API Tests: {api_passed}/{len(api_results)} PASSED")
    print(f"Total: {total_passed}/{total_tests} PASSED")
    
    # Detailed table
    print("\n" + "-" * 80)
    print("DETAILED RESULTS TABLE")
    print("-" * 80)
    print(f"{'ID':<4} {'Origin/Endpoint':<50} {'Expected':<15} {'Actual':<20} {'Status':<10}")
    print("-" * 80)
    
    for r in results:
        origin_short = r['origin'][:47] + "..." if len(r['origin']) > 50 else r['origin']
        status = "✅ PASS" if r['passed'] else "❌ FAIL"
        print(f"{r['id']:<4} {origin_short:<50} {r['expected']:<15} {r['actual']:<20} {status:<10}")
    
    for r in api_results:
        endpoint = f"{r['method']} {r['url'].replace('http://localhost:8001', '')}"
        endpoint_short = endpoint[:47] + "..." if len(endpoint) > 50 else endpoint
        expected = f"HTTP {r['expected_status']}"
        actual = f"HTTP {r['status_code']}" if r['status_code'] else "ERROR"
        status = "✅ PASS" if r['passed'] else "❌ FAIL"
        print(f"{r['id']:<4} {endpoint_short:<50} {expected:<15} {actual:<20} {status:<10}")
    
    # Overall verdict
    print("\n" + "=" * 80)
    if total_passed == total_tests:
        print("✅ ✅ ✅ OVERALL: PASS ✅ ✅ ✅")
        print("CORS Domain Guardrail is working correctly!")
    else:
        print("❌ ❌ ❌ OVERALL: FAIL ❌ ❌ ❌")
        print(f"{total_tests - total_passed} test(s) failed")
    print("=" * 80)
    
    # Exit code
    sys.exit(0 if total_passed == total_tests else 1)

if __name__ == "__main__":
    main()
