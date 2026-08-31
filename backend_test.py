#!/usr/bin/env python3
"""
DynoPay Fee Source Fallback - BCH satPerByte Cache Bug Fix Verification
========================================================================
Tests the network-fees endpoint to verify:
1. BCH returns satPerByte==1 on BOTH fresh and cached calls
2. POLYGON returns feeInUSD > 0, nativeSymbol == "POL"
3. USDT_POLYGON returns feeInUSD > 0, nativeSymbol == "POL"
4. ETH returns feeInUSD > 0 (control/regression)

All requests include browser-like User-Agent and Origin header (Cloudflare requirement).
"""

import requests
import json
import sys
import time

# Base URL for the preview environment
BASE_URL = "https://dynopay-preview-15.preview.emergentagent.com"

# Headers required for Cloudflare
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Origin": BASE_URL,
    "Accept": "application/json"
}

def test_network_fees(chain, test_name, expected_checks):
    """
    Test GET /api/pay/network-fees?chain=<CHAIN>
    
    Args:
        chain: Chain identifier (e.g., 'BCH', 'POLYGON')
        test_name: Human-readable test name
        expected_checks: Dict of field->expected_value checks
    
    Returns:
        Tuple of (passed: bool, response_data: dict, error_msg: str)
    """
    url = f"{BASE_URL}/api/pay/network-fees?chain={chain}"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        
        # Check HTTP status
        if response.status_code != 200:
            return False, None, f"HTTP {response.status_code} (expected 200)"
        
        # Parse JSON
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            return False, None, f"Invalid JSON response: {e}"
        
        # Extract the actual fee data
        if 'data' not in data:
            return False, data, "Response missing 'data' field"
        
        fee_data = data['data']
        
        # Run expected checks
        errors = []
        for field, expected in expected_checks.items():
            if field not in fee_data:
                errors.append(f"Missing field '{field}'")
            elif callable(expected):
                # Custom check function
                if not expected(fee_data[field]):
                    errors.append(f"Field '{field}' check failed: {fee_data[field]}")
            elif fee_data[field] != expected:
                errors.append(f"Field '{field}' = {fee_data[field]} (expected {expected})")
        
        if errors:
            return False, fee_data, "; ".join(errors)
        
        return True, fee_data, None
        
    except requests.exceptions.RequestException as e:
        return False, None, f"Request failed: {e}"


def main():
    print("=" * 80)
    print("DynoPay Fee Source Fallback - BCH satPerByte Cache Bug Fix Verification")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Endpoint: GET /api/pay/network-fees?chain=<CHAIN>")
    print(f"Headers: User-Agent={HEADERS['User-Agent'][:50]}...")
    print(f"         Origin={HEADERS['Origin']}")
    print("=" * 80)
    print()
    
    all_passed = True
    test_results = []
    
    # TEST 1: BCH - First call (fresh, not cached)
    print("TEST 1: BCH - First call (fresh, should populate cache)")
    print("-" * 80)
    passed, data, error = test_network_fees(
        "BCH",
        "BCH First Call",
        {
            "feeInUSD": lambda x: isinstance(x, (int, float)) and x > 0,
            "satPerByte": 1
        }
    )
    
    if passed:
        print(f"✅ PASSED")
        print(f"   - HTTP 200")
        print(f"   - feeInUSD: {data['feeInUSD']} (> 0) ✓")
        print(f"   - satPerByte: {data['satPerByte']} (== 1) ✓")
        test_results.append(("TEST 1: BCH First Call", True, data))
    else:
        print(f"❌ FAILED: {error}")
        if data:
            print(f"   Response data: {json.dumps(data, indent=2)}")
        all_passed = False
        test_results.append(("TEST 1: BCH First Call", False, error))
    
    print()
    
    # TEST 2: BCH - Second call (should be cached)
    # Wait a moment to ensure the first call is fully processed
    time.sleep(0.5)
    
    print("TEST 2: BCH - Second call (cached, THE CRITICAL BUG FIX TEST)")
    print("-" * 80)
    passed, data, error = test_network_fees(
        "BCH",
        "BCH Second Call (Cached)",
        {
            "feeInUSD": lambda x: isinstance(x, (int, float)) and x > 0,
            "satPerByte": 1  # THIS WAS THE BUG - satPerByte disappeared on cached response
        }
    )
    
    if passed:
        print(f"✅ PASSED - THE BUG IS FIXED!")
        print(f"   - HTTP 200")
        print(f"   - feeInUSD: {data['feeInUSD']} (> 0) ✓")
        print(f"   - satPerByte: {data['satPerByte']} (== 1) ✓ [CRITICAL: Present in cached response]")
        test_results.append(("TEST 2: BCH Second Call (Cached)", True, data))
    else:
        print(f"❌ FAILED - THE BUG STILL EXISTS: {error}")
        if data:
            print(f"   Response data: {json.dumps(data, indent=2)}")
            if 'satPerByte' not in data:
                print(f"   ⚠️  CRITICAL: satPerByte field is MISSING from cached response!")
        all_passed = False
        test_results.append(("TEST 2: BCH Second Call (Cached)", False, error))
    
    print()
    
    # TEST 3: POLYGON
    print("TEST 3: POLYGON - Fee source fallback verification")
    print("-" * 80)
    passed, data, error = test_network_fees(
        "POLYGON",
        "POLYGON",
        {
            "feeInUSD": lambda x: isinstance(x, (int, float)) and x > 0,
            "nativeSymbol": "POL"
        }
    )
    
    if passed:
        print(f"✅ PASSED")
        print(f"   - HTTP 200")
        print(f"   - feeInUSD: {data['feeInUSD']} (> 0) ✓")
        print(f"   - nativeSymbol: {data['nativeSymbol']} (== 'POL') ✓")
        test_results.append(("TEST 3: POLYGON", True, data))
    else:
        print(f"❌ FAILED: {error}")
        if data:
            print(f"   Response data: {json.dumps(data, indent=2)}")
        all_passed = False
        test_results.append(("TEST 3: POLYGON", False, error))
    
    print()
    
    # TEST 4: USDT_POLYGON
    print("TEST 4: USDT_POLYGON - Fee source fallback verification")
    print("-" * 80)
    passed, data, error = test_network_fees(
        "USDT_POLYGON",
        "USDT_POLYGON",
        {
            "feeInUSD": lambda x: isinstance(x, (int, float)) and x > 0,
            "nativeSymbol": "POL"
        }
    )
    
    if passed:
        print(f"✅ PASSED")
        print(f"   - HTTP 200")
        print(f"   - feeInUSD: {data['feeInUSD']} (> 0) ✓")
        print(f"   - nativeSymbol: {data['nativeSymbol']} (== 'POL') ✓")
        test_results.append(("TEST 4: USDT_POLYGON", True, data))
    else:
        print(f"❌ FAILED: {error}")
        if data:
            print(f"   Response data: {json.dumps(data, indent=2)}")
        all_passed = False
        test_results.append(("TEST 4: USDT_POLYGON", False, error))
    
    print()
    
    # TEST 5: ETH (control/regression check)
    print("TEST 5: ETH - Control/regression check")
    print("-" * 80)
    passed, data, error = test_network_fees(
        "ETH",
        "ETH",
        {
            "feeInUSD": lambda x: isinstance(x, (int, float)) and x > 0
        }
    )
    
    if passed:
        print(f"✅ PASSED")
        print(f"   - HTTP 200")
        print(f"   - feeInUSD: {data['feeInUSD']} (> 0) ✓")
        test_results.append(("TEST 5: ETH (Control)", True, data))
    else:
        print(f"❌ FAILED: {error}")
        if data:
            print(f"   Response data: {json.dumps(data, indent=2)}")
        all_passed = False
        test_results.append(("TEST 5: ETH (Control)", False, error))
    
    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    passed_count = sum(1 for _, passed, _ in test_results if passed)
    total_count = len(test_results)
    
    for test_name, passed, result in test_results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
        if passed and isinstance(result, dict):
            # Show key fields for passed tests
            if 'satPerByte' in result:
                print(f"       satPerByte={result['satPerByte']}, feeInUSD={result['feeInUSD']}")
            elif 'nativeSymbol' in result:
                print(f"       nativeSymbol={result['nativeSymbol']}, feeInUSD={result['feeInUSD']}")
            else:
                print(f"       feeInUSD={result['feeInUSD']}")
    
    print()
    print(f"RESULT: {passed_count}/{total_count} tests passed")
    
    if all_passed:
        print()
        print("🎉 ALL TESTS PASSED!")
        print("✅ BCH returns satPerByte==1 on BOTH fresh and cached calls")
        print("✅ POLYGON returns feeInUSD > 0, nativeSymbol == 'POL'")
        print("✅ USDT_POLYGON returns feeInUSD > 0, nativeSymbol == 'POL'")
        print("✅ ETH returns feeInUSD > 0 (no regression)")
        print()
        print("The BCH cached-path satPerByte bug fix is VERIFIED and WORKING CORRECTLY.")
        return 0
    else:
        print()
        print("❌ SOME TESTS FAILED")
        print("Please review the failures above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
