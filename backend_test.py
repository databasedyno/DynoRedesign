#!/usr/bin/env python3
"""
Backend API Testing for Volume-Based Fee Tier System
Test Date: 2026-07-07
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://blockchain-gateway-11.preview.emergentagent.com/api"
HOSTBAY_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJuYW1lIjoiSG9zdEJheSIsImVtYWlsIjoiaG9zdGJheUBtb3h4LmNvIiwidXNlcm5hbWUiOm51bGwsIm1vYmlsZSI6bnVsbCwicGhvdG8iOiJpbWFnZXMvdXNlcl9pbWFnZS5wbmciLCJsb2dpbl90eXBlIjoiRU1BSUwiLCJjdXN0b21lcl9pZCI6bnVsbCwiZXh0ZXJuYWxfaWQiOm51bGwsInN0YXR1cyI6ImFjdGl2ZSIsInZlcmlmaWVkX290cCI6bnVsbCwib3RwX2V4cGlyZWQiOm51bGwsIm90cF9jdXJyZW5jeSI6bnVsbCwicmVzZXRfdG9rZW4iOm51bGwsInJlc2V0X3Rva2VuX2V4cGlyeSI6bnVsbCwiZ29vZ2xlX2lkIjpudWxsLCJ3YWxsZXRfcmVtaW5kZXJfc2VudCI6dHJ1ZSwicmVmZXJyYWxfY29kZSI6IkRZTk8tOVhWUFVZIiwicmVmZXJyYWxfY291bnQiOjAsInJlZmVycmFsX2JvbnVzX2Vhcm5lZCI6IjAuMDAiLCJyZWZlcnJlZF9ieV9jb2RlIjpudWxsLCJyZWZlcnJlZF9ieV9yZWZlcmVlX2NvZGUiOm51bGwsImZlZV9kaXNjb3VudF9wZXJjZW50IjoiMC4wMCIsImZlZV9kaXNjb3VudF9leHBpcmVzX2F0IjpudWxsLCJmZWVfZGlzY291bnRfcmVhc29uIjpudWxsLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibGFzdF9sb2dpbl9pcCI6IjEwNC4xOTguMjE0LjIyMyIsImxhc3RfY29tcGFueV9pZCI6bnVsbCwiY3VtdWxhdGl2ZV92b2x1bWVfdXNkIjoiMTczNTcuNTUiLCJmZWVfZnJlZV9yZW1haW5pbmdfdXNkIjoiMC4wMCIsImZlZV90aWVyIjoic3RhbmRhcmQiLCJjcmVhdGVkQXQiOiIyMDI2LTA0LTE4VDE4OjE5OjExLjg4N1oiLCJ1cGRhdGVkQXQiOiIyMDI2LTA3LTA3VDEzOjAzOjQzLjM0NFoiLCJsYW5ndWFnZSI6ImVuIiwiaWF0IjoxNzgzNDQ5NDE5LCJleHAiOjE3ODYwNDE0MTl9.AGRoH624V3DpSvMiLOYPUo7mjMLVG8Po9BNd1peCK98"

# Test results storage
results = {
    "part1": {"status": "NOT_RUN", "details": {}},
    "part2": {"status": "NOT_RUN", "details": {}},
    "part6": {"status": "NOT_RUN", "details": {}},
}

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def test_part1_public_fee_calculator():
    """Part 1 - Public checkout fee endpoint (unchanged for public calculator)"""
    print_section("PART 1: Public Checkout Fee Endpoint")
    
    # Test 1: USD with BTC
    print("Test 1.1: POST /api/pay/calculateFees (USD, BTC, no paymentLinkId)")
    try:
        response = requests.post(
            f"{BASE_URL}/pay/calculateFees",
            json={"amount": 1000, "cryptocurrency": "BTC", "currency": "USD"},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response (first 500 chars): {json.dumps(data, indent=2)[:500]}")
            
            # Assertions
            if "data" in data and "fee_breakdown" in data["data"]:
                fee_breakdown = data["data"]["fee_breakdown"]
                platform_fee_percent = fee_breakdown.get("platform_fee_percent")
                platform_fee = fee_breakdown.get("platform_fee")
                
                print(f"\nAssertion checks:")
                print(f"  platform_fee_percent: {platform_fee_percent} (expected: 1.5)")
                print(f"  platform_fee: {platform_fee} (expected: 15)")
                
                if platform_fee_percent == 1.5 and platform_fee == 15:
                    results["part1"]["test1_usd_btc"] = "PASS"
                    print("  ✅ PASS")
                else:
                    results["part1"]["test1_usd_btc"] = f"FAIL - platform_fee_percent={platform_fee_percent}, platform_fee={platform_fee}"
                    print(f"  ❌ FAIL")
            else:
                results["part1"]["test1_usd_btc"] = "FAIL - Missing fee_breakdown in response"
                print("  ❌ FAIL - Missing fee_breakdown")
        else:
            results["part1"]["test1_usd_btc"] = f"FAIL - HTTP {response.status_code}"
            print(f"  ❌ FAIL - HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
    except Exception as e:
        results["part1"]["test1_usd_btc"] = f"ERROR - {str(e)}"
        print(f"  ❌ ERROR: {e}")
    
    # Test 2: EUR with ETH
    print("\n\nTest 1.2: POST /api/pay/calculateFees (EUR, ETH)")
    try:
        response = requests.post(
            f"{BASE_URL}/pay/calculateFees",
            json={"amount": 1000, "cryptocurrency": "ETH", "currency": "EUR"},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response (first 500 chars): {json.dumps(data, indent=2)[:500]}")
            
            if "data" in data and "fee_breakdown" in data["data"]:
                fee_breakdown = data["data"]["fee_breakdown"]
                platform_fee_percent = fee_breakdown.get("platform_fee_percent")
                
                print(f"\nAssertion checks:")
                print(f"  platform_fee_percent: {platform_fee_percent} (expected: 1.5)")
                
                if platform_fee_percent == 1.5:
                    results["part1"]["test2_eur_eth"] = "PASS"
                    print("  ✅ PASS")
                else:
                    results["part1"]["test2_eur_eth"] = f"FAIL - platform_fee_percent={platform_fee_percent}"
                    print(f"  ❌ FAIL")
            else:
                results["part1"]["test2_eur_eth"] = "FAIL - Missing fee_breakdown in response"
                print("  ❌ FAIL - Missing fee_breakdown")
        else:
            results["part1"]["test2_eur_eth"] = f"FAIL - HTTP {response.status_code}"
            print(f"  ❌ FAIL - HTTP {response.status_code}")
    except Exception as e:
        results["part1"]["test2_eur_eth"] = f"ERROR - {str(e)}"
        print(f"  ❌ ERROR: {e}")
    
    results["part1"]["status"] = "COMPLETED"

def test_part2_dashboard_fee_tiers():
    """Part 2 - Authenticated dashboard fee-tiers endpoint"""
    print_section("PART 2: Authenticated Dashboard Fee-Tiers Endpoint")
    
    print("Test 2.1: GET /api/dashboard/fee-tiers (with hostbay JWT)")
    try:
        response = requests.get(
            f"{BASE_URL}/dashboard/fee-tiers",
            headers={
                "Authorization": f"Bearer {HOSTBAY_JWT}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\nFull Response:\n{json.dumps(data, indent=2)}")
            
            # Detailed assertions
            print(f"\n{'='*60}")
            print("DETAILED ASSERTIONS:")
            print(f"{'='*60}")
            
            passed = True
            
            # Check tiers array
            if "data" in data and "tiers" in data["data"]:
                tiers = data["data"]["tiers"]
                print(f"\n✓ data.tiers exists: {len(tiers)} tiers found")
                
                if len(tiers) == 4:
                    print(f"✓ Exactly 4 tiers present")
                    
                    # Expected tier structure
                    expected_tiers = [
                        {"index": 0, "name": "starter", "display_name": "Starter", "percent": 1.5, "min_volume": 0, "max_volume": 10000},
                        {"index": 1, "name": "growth", "display_name": "Growth", "percent": 1.0, "min_volume": 10000, "max_volume": 100000},
                        {"index": 2, "name": "scale", "display_name": "Scale", "percent": 0.7, "min_volume": 100000, "max_volume": 500000},
                        {"index": 3, "name": "enterprise", "display_name": "Enterprise", "percent": 0.5, "min_volume": 500000, "max_volume": None}
                    ]
                    
                    print(f"\nTier-by-tier validation:")
                    for i, expected in enumerate(expected_tiers):
                        if i < len(tiers):
                            tier = tiers[i]
                            print(f"\n  Tier {i} ({expected['name']}):")
                            print(f"    name: {tier.get('name')} (expected: {expected['name']}) {'✓' if tier.get('name') == expected['name'] else '✗'}")
                            print(f"    display_name: {tier.get('display_name')} (expected: {expected['display_name']}) {'✓' if tier.get('display_name') == expected['display_name'] else '✗'}")
                            print(f"    percent: {tier.get('percent')} (expected: {expected['percent']}) {'✓' if tier.get('percent') == expected['percent'] else '✗'}")
                            print(f"    min_volume: {tier.get('min_volume')} (expected: {expected['min_volume']}) {'✓' if tier.get('min_volume') == expected['min_volume'] else '✗'}")
                            print(f"    max_volume: {tier.get('max_volume')} (expected: {expected['max_volume']}) {'✓' if tier.get('max_volume') == expected['max_volume'] else '✗'}")
                            
                            # Check if all fields match
                            if (tier.get('name') != expected['name'] or 
                                tier.get('display_name') != expected['display_name'] or
                                tier.get('percent') != expected['percent'] or
                                tier.get('min_volume') != expected['min_volume'] or
                                tier.get('max_volume') != expected['max_volume']):
                                passed = False
                else:
                    print(f"✗ Expected 4 tiers, got {len(tiers)}")
                    passed = False
            else:
                print(f"✗ data.tiers not found in response")
                passed = False
            
            # Check user_tier object
            if "data" in data and "user_tier" in data["data"]:
                user_tier = data["data"]["user_tier"]
                print(f"\n✓ data.user_tier exists")
                
                # hostbay has $17,357 lifetime volume, which should map to Growth tier (1.0%)
                # Note: The test request says it should be Growth based on volume, not the DB column
                print(f"\n  User tier details:")
                print(f"    current_tier: {user_tier.get('current_tier')} (expected: Growth)")
                print(f"    current_tier_key: {user_tier.get('current_tier_key')} (expected: growth)")
                print(f"    current_tier_percent: {user_tier.get('current_tier_percent')} (expected: 1.0)")
                print(f"    next_tier: {user_tier.get('next_tier')} (expected: Scale)")
                print(f"    next_tier_key: {user_tier.get('next_tier_key')} (expected: scale)")
                print(f"    next_tier_percent: {user_tier.get('next_tier_percent')} (expected: 0.7)")
                print(f"    total_volume: {user_tier.get('total_volume')} (expected: ~17357.55)")
                
                # Validate user_tier fields
                if (user_tier.get('current_tier') == "Growth" and
                    user_tier.get('current_tier_key') == "growth" and
                    user_tier.get('current_tier_percent') == 1.0 and
                    user_tier.get('next_tier') == "Scale" and
                    user_tier.get('next_tier_key') == "scale" and
                    user_tier.get('next_tier_percent') == 0.7 and
                    abs(float(user_tier.get('total_volume', 0)) - 17357.55) < 100):  # Allow some variance
                    print(f"\n  ✓ All user_tier fields match expected values")
                else:
                    print(f"\n  ✗ Some user_tier fields don't match expected values")
                    passed = False
            else:
                print(f"✗ data.user_tier not found in response")
                passed = False
            
            # Check for is_current flag
            if "data" in data and "tiers" in data["data"]:
                current_tiers = [t for t in data["data"]["tiers"] if t.get("is_current")]
                if len(current_tiers) == 1 and current_tiers[0].get("name") == "growth":
                    print(f"\n✓ Exactly ONE tier has is_current=true (growth tier)")
                else:
                    print(f"\n✗ Expected exactly one tier with is_current=true (growth), found {len(current_tiers)}")
                    if current_tiers:
                        print(f"  Current tiers: {[t.get('name') for t in current_tiers]}")
                    passed = False
            
            if passed:
                results["part2"]["status"] = "PASS"
                print(f"\n{'='*60}")
                print("✅ PART 2: PASS - All assertions passed")
                print(f"{'='*60}")
            else:
                results["part2"]["status"] = "FAIL"
                print(f"\n{'='*60}")
                print("❌ PART 2: FAIL - Some assertions failed")
                print(f"{'='*60}")
        else:
            results["part2"]["status"] = f"FAIL - HTTP {response.status_code}"
            print(f"  ❌ FAIL - HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
    except Exception as e:
        results["part2"]["status"] = f"ERROR - {str(e)}"
        print(f"  ❌ ERROR: {e}")

def test_part6_regression():
    """Part 6 - Regression: no existing endpoint broke"""
    print_section("PART 6: Regression Tests")
    
    endpoints = [
        {"method": "GET", "path": "/health", "auth": False},
        {"method": "GET", "path": "/api/", "auth": False},
        {"method": "GET", "path": "/api/csrf-token", "auth": False},
        {"method": "GET", "path": "/api/dashboard", "auth": True},
        {"method": "GET", "path": "/api/dashboard/recent-transactions", "auth": True},
        {"method": "POST", "path": "/api/pay/calculateFees", "auth": False, "body": {"amount": 100, "cryptocurrency": "BTC", "currency": "USD"}},
    ]
    
    regression_results = {}
    
    for endpoint in endpoints:
        path = endpoint["path"]
        method = endpoint["method"]
        auth = endpoint["auth"]
        body = endpoint.get("body")
        
        print(f"\nTesting: {method} {path}")
        
        try:
            headers = {"Content-Type": "application/json"}
            if auth:
                headers["Authorization"] = f"Bearer {HOSTBAY_JWT}"
            
            # Construct full URL
            if path.startswith("/api/"):
                url = f"{BASE_URL.rsplit('/api', 1)[0]}{path}"
            else:
                url = f"{BASE_URL.rsplit('/api', 1)[0]}{path}"
            
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method == "POST":
                response = requests.post(url, json=body, headers=headers, timeout=30)
            
            status = response.status_code
            print(f"  Status: {status}")
            
            if status == 200:
                regression_results[path] = "✅ 200"
            else:
                regression_results[path] = f"❌ {status}"
                print(f"  Response: {response.text[:200]}")
        except Exception as e:
            regression_results[path] = f"❌ ERROR: {str(e)}"
            print(f"  ERROR: {e}")
    
    print(f"\n{'='*60}")
    print("REGRESSION TEST SUMMARY:")
    print(f"{'='*60}")
    for path, result in regression_results.items():
        print(f"  {path}: {result}")
    
    # Check if all passed
    all_passed = all("✅" in result for result in regression_results.values())
    results["part6"]["status"] = "PASS" if all_passed else "FAIL"
    results["part6"]["details"] = regression_results

def main():
    print(f"\n{'#'*80}")
    print(f"#  VOLUME-BASED FEE TIER SYSTEM - BACKEND API TESTING")
    print(f"#  Test Date: 2026-07-07")
    print(f"#  Base URL: {BASE_URL}")
    print(f"{'#'*80}\n")
    
    # Run all tests
    test_part1_public_fee_calculator()
    test_part2_dashboard_fee_tiers()
    test_part6_regression()
    
    # Final summary
    print(f"\n\n{'#'*80}")
    print(f"#  FINAL TEST SUMMARY")
    print(f"{'#'*80}\n")
    
    print("PART 1 (Public Fee Calculator):")
    if "test1_usd_btc" in results["part1"]:
        print(f"  Test 1.1 (USD/BTC): {results['part1']['test1_usd_btc']}")
    if "test2_eur_eth" in results["part1"]:
        print(f"  Test 1.2 (EUR/ETH): {results['part1']['test2_eur_eth']}")
    
    print(f"\nPART 2 (Dashboard Fee Tiers): {results['part2']['status']}")
    
    print(f"\nPART 6 (Regression Tests): {results['part6']['status']}")
    if results["part6"].get("details"):
        for path, result in results["part6"]["details"].items():
            print(f"  {path}: {result}")
    
    print(f"\n{'#'*80}\n")

if __name__ == "__main__":
    main()
