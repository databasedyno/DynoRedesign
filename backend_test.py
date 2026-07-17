#!/usr/bin/env python3
"""
Session 67 — CORS Domain Guardrail Testing
Test the new CORS callback validator on DynoPay backend (preview environment)
"""

import requests
import json
from typing import Dict, List, Tuple

# Backend base URL
BACKEND_URL = "https://crypto-payment-hub-30.preview.emergentagent.com"

def test_cors_preflight(origin: str, endpoint: str = "/api/csrf-token") -> Tuple[bool, str, Dict]:
    """
    Send OPTIONS preflight request with Origin header
    Returns: (is_allowed, access_control_allow_origin_value, all_headers)
    """
    url = f"{BACKEND_URL}{endpoint}"
    headers = {
        "Origin": origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "content-type"
    }
    
    try:
        response = requests.options(url, headers=headers, timeout=10)
        response_headers = dict(response.headers)
        
        # Check if access-control-allow-origin header is present
        allow_origin = response_headers.get("access-control-allow-origin", None)
        
        if allow_origin and allow_origin == origin:
            return (True, allow_origin, response_headers)
        else:
            return (False, allow_origin or "none", response_headers)
    except Exception as e:
        return (False, f"ERROR: {str(e)}", {})

def test_normal_api(endpoint: str) -> Tuple[int, str]:
    """
    Test normal API endpoint (GET request)
    Returns: (status_code, response_text)
    """
    url = f"{BACKEND_URL}{endpoint}"
    try:
        response = requests.get(url, timeout=10)
        return (response.status_code, response.text[:200])
    except Exception as e:
        return (0, f"ERROR: {str(e)}")

def main():
    print("=" * 80)
    print("SESSION 67 — CORS DOMAIN GUARDRAIL TESTING")
    print("=" * 80)
    print(f"Backend URL: {BACKEND_URL}")
    print()
    
    # Test matrix
    test_cases = [
        # (test_number, origin, expected_result, description)
        (1, "https://dynopay.com", "ALLOWED", "Apex domain of trusted base"),
        (2, "https://checkout.dynopay.com", "ALLOWED", "Subdomain of trusted base (in explicit list)"),
        (3, "https://api.dynopay.com", "ALLOWED", "***KEY TEST*** Subdomain NOT in explicit list (guardrail auto-includes)"),
        (4, "https://random-sub.dynopay.com", "ALLOWED", "Any subdomain of trusted base"),
        (5, "https://crypto-payment-hub-30.preview.emergentagent.com", "ALLOWED", "Preview pattern"),
        (6, "https://evil-attacker-site.com", "BLOCKED", "Untrusted origin"),
        (7, "https://dynopay.com.evil.com", "BLOCKED", "Lookalike suffix attack"),
    ]
    
    results = []
    
    print("CORS PREFLIGHT TESTS (OPTIONS /api/csrf-token)")
    print("-" * 80)
    
    for test_num, origin, expected, description in test_cases:
        print(f"\nTest {test_num}: {description}")
        print(f"  Origin: {origin}")
        print(f"  Expected: {expected}")
        
        is_allowed, allow_origin_value, headers = test_cors_preflight(origin)
        
        actual = "ALLOWED" if is_allowed else "BLOCKED"
        status = "✅ PASS" if actual == expected else "❌ FAIL"
        
        print(f"  Actual: {actual}")
        print(f"  access-control-allow-origin: {allow_origin_value}")
        print(f"  Result: {status}")
        
        results.append({
            "test": test_num,
            "origin": origin,
            "expected": expected,
            "actual": actual,
            "allow_origin": allow_origin_value,
            "status": status
        })
    
    print("\n" + "=" * 80)
    print("NORMAL API TESTS")
    print("-" * 80)
    
    # Test 8: GET /api/csrf-token
    print("\nTest 8: GET /api/csrf-token")
    status_code, response_text = test_normal_api("/api/csrf-token")
    print(f"  Status Code: {status_code}")
    print(f"  Response: {response_text}")
    
    test8_pass = status_code == 200 and "csrf" in response_text.lower()
    test8_status = "✅ PASS" if test8_pass else "❌ FAIL"
    print(f"  Result: {test8_status}")
    
    results.append({
        "test": 8,
        "endpoint": "/api/csrf-token",
        "expected": "HTTP 200 with JSON csrf token",
        "actual": f"HTTP {status_code}",
        "status": test8_status
    })
    
    # Test 9: GET /health
    print("\nTest 9: GET /health")
    status_code, response_text = test_normal_api("/health")
    print(f"  Status Code: {status_code}")
    print(f"  Response: {response_text}")
    
    test9_pass = status_code == 200
    test9_status = "✅ PASS" if test9_pass else "❌ FAIL"
    print(f"  Result: {test9_status}")
    
    results.append({
        "test": 9,
        "endpoint": "/health",
        "expected": "HTTP 200 status healthy",
        "actual": f"HTTP {status_code}",
        "status": test9_status
    })
    
    # Summary table
    print("\n" + "=" * 80)
    print("SUMMARY TABLE")
    print("=" * 80)
    print()
    print(f"{'Test':<6} {'Origin/Endpoint':<50} {'Expected':<10} {'Actual':<10} {'Status':<10}")
    print("-" * 90)
    
    for result in results:
        if "origin" in result:
            identifier = result["origin"]
        else:
            identifier = result["endpoint"]
        
        print(f"{result['test']:<6} {identifier:<50} {result['expected']:<10} {result['actual']:<10} {result['status']:<10}")
    
    # Overall verdict
    print("\n" + "=" * 80)
    print("OVERALL VERDICT")
    print("=" * 80)
    
    passed = sum(1 for r in results if "✅" in r["status"])
    total = len(results)
    
    print(f"\nTests Passed: {passed}/{total}")
    
    # Check specific requirements
    tests_1_5_pass = all(r["status"] == "✅ PASS" for r in results[:5])
    tests_6_7_pass = all(r["status"] == "✅ PASS" for r in results[5:7])
    tests_8_9_pass = all(r["status"] == "✅ PASS" for r in results[7:9])
    
    print(f"\nTests 1-5 (ALLOWED origins): {'✅ PASS' if tests_1_5_pass else '❌ FAIL'}")
    print(f"Tests 6-7 (BLOCKED origins): {'✅ PASS' if tests_6_7_pass else '❌ FAIL'}")
    print(f"Tests 8-9 (Normal API): {'✅ PASS' if tests_8_9_pass else '❌ FAIL'}")
    
    overall_pass = tests_1_5_pass and tests_6_7_pass and tests_8_9_pass
    
    print("\n" + "=" * 80)
    if overall_pass:
        print("🎉 OVERALL: ✅ ✅ ✅ PASS ✅ ✅ ✅")
        print("CORS Domain Guardrail is working correctly!")
    else:
        print("❌ OVERALL: FAIL")
        print("Some tests did not meet expectations.")
    print("=" * 80)
    
    return overall_pass

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
