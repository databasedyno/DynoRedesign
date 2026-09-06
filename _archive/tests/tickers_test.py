#!/usr/bin/env python3
"""
Backend Test Script for Tatum Fallback on /api/public/tickers
Tests the Tatum-backed fallback when Binance WebSocket cache is empty (geo-blocked region)
READ-ONLY testing - no auth required for public endpoints
"""

import requests
import json
from datetime import datetime
import sys

# Configuration - using the external preview URL as specified
BASE_URL = "https://onboard-app-11.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test results
results = {
    "passed": [],
    "failed": [],
    "warnings": []
}

def log(message, level="INFO"):
    """Log test messages"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")

def test_1_public_tickers():
    """
    Test 1: GET /api/public/tickers
    - MUST return HTTP 200 with JSON { "status": "success", "data": [ ... ] }
    - The data array MUST be NON-EMPTY (expect ~10 entries)
    - Each entry MUST have "symbol" (string) and "price" (number > 0)
    - Confirm BTC and ETH are present with realistic positive USD prices
    """
    log("\n=== TEST 1: GET /api/public/tickers (Tatum fallback) ===")
    
    try:
        response = requests.get(
            f"{API_BASE}/public/tickers",
            timeout=30
        )
        
        # Check HTTP 200
        if response.status_code != 200:
            results["failed"].append(f"Test 1: Expected 200, got {response.status_code}")
            log(f"❌ FAILED: Status {response.status_code}", "ERROR")
            log(f"Response: {response.text[:500]}", "ERROR")
            return False
        
        log(f"✅ HTTP 200 OK")
        
        # Parse JSON
        try:
            data = response.json()
        except Exception as e:
            results["failed"].append(f"Test 1: Invalid JSON response: {e}")
            log(f"❌ FAILED: Invalid JSON - {e}", "ERROR")
            return False
        
        # Check status field
        if data.get("status") != "success":
            results["failed"].append(f"Test 1: Expected status='success', got '{data.get('status')}'")
            log(f"❌ FAILED: status != 'success'", "ERROR")
            return False
        
        log(f"✅ status='success'")
        
        # Check data array exists
        tickers = data.get("data", [])
        if not isinstance(tickers, list):
            results["failed"].append(f"Test 1: data is not an array")
            log(f"❌ FAILED: data is not an array", "ERROR")
            return False
        
        # Check NON-EMPTY (critical - this is the Tatum fallback test)
        if len(tickers) == 0:
            results["failed"].append(f"Test 1: CRITICAL - data array is EMPTY (Tatum fallback not working)")
            log(f"❌ FAILED: data array is EMPTY - Tatum fallback did not populate prices", "ERROR")
            return False
        
        log(f"✅ data array is NON-EMPTY: {len(tickers)} entries")
        
        # Check each entry has required fields
        btc_found = False
        eth_found = False
        btc_price = None
        eth_price = None
        
        for i, ticker in enumerate(tickers):
            symbol = ticker.get("symbol")
            price = ticker.get("price")
            
            # Check symbol exists and is string
            if not symbol or not isinstance(symbol, str):
                results["failed"].append(f"Test 1: Entry {i} missing or invalid 'symbol'")
                log(f"❌ FAILED: Entry {i} has invalid symbol: {ticker}", "ERROR")
                return False
            
            # Check price exists and is number > 0
            if not isinstance(price, (int, float)) or price <= 0:
                results["failed"].append(f"Test 1: Entry {i} ({symbol}) has invalid price: {price}")
                log(f"❌ FAILED: Entry {i} ({symbol}) has invalid price: {price}", "ERROR")
                return False
            
            # Track BTC and ETH
            if symbol == "BTC":
                btc_found = True
                btc_price = price
            elif symbol == "ETH":
                eth_found = True
                eth_price = price
        
        log(f"✅ All {len(tickers)} entries have valid 'symbol' (string) and 'price' (number > 0)")
        
        # Check BTC present with realistic price
        if not btc_found:
            results["failed"].append(f"Test 1: BTC not found in tickers")
            log(f"❌ FAILED: BTC not found in tickers", "ERROR")
            return False
        
        # BTC should be in tens of thousands (e.g., 40000-100000)
        if btc_price < 10000 or btc_price > 200000:
            results["warnings"].append(f"Test 1: BTC price ${btc_price:,.2f} seems unrealistic (expected 10k-200k)")
            log(f"⚠️  WARNING: BTC price ${btc_price:,.2f} seems unrealistic", "WARN")
        else:
            log(f"✅ BTC found with realistic price: ${btc_price:,.2f}")
        
        # Check ETH present with realistic price
        if not eth_found:
            results["failed"].append(f"Test 1: ETH not found in tickers")
            log(f"❌ FAILED: ETH not found in tickers", "ERROR")
            return False
        
        # ETH should be in hundreds/thousands (e.g., 1000-10000)
        if eth_price < 100 or eth_price > 20000:
            results["warnings"].append(f"Test 1: ETH price ${eth_price:,.2f} seems unrealistic (expected 100-20k)")
            log(f"⚠️  WARNING: ETH price ${eth_price:,.2f} seems unrealistic", "WARN")
        else:
            log(f"✅ ETH found with realistic price: ${eth_price:,.2f}")
        
        # Log sample of tickers
        log(f"\n📊 Sample tickers (first 5):")
        for ticker in tickers[:5]:
            log(f"   {ticker['symbol']}: ${ticker['price']:,.2f}")
        
        results["passed"].append("Test 1: /api/public/tickers returns non-empty data with BTC and ETH")
        log(f"\n✅ TEST 1 PASSED", "SUCCESS")
        return True
        
    except Exception as e:
        results["failed"].append(f"Test 1: Exception - {e}")
        log(f"❌ FAILED: Exception - {e}", "ERROR")
        import traceback
        traceback.print_exc()
        return False

def test_2_tickers_stability():
    """
    Test 2: Call /api/public/tickers 3 times in a row
    - Must be stable (no 500/errors)
    - Consistent shape each time
    """
    log("\n=== TEST 2: /api/public/tickers stability (3 calls) ===")
    
    try:
        responses = []
        for i in range(3):
            log(f"\nCall {i+1}/3...")
            response = requests.get(
                f"{API_BASE}/public/tickers",
                timeout=30
            )
            
            if response.status_code != 200:
                results["failed"].append(f"Test 2: Call {i+1} returned {response.status_code}")
                log(f"❌ FAILED: Call {i+1} returned {response.status_code}", "ERROR")
                return False
            
            try:
                data = response.json()
            except Exception as e:
                results["failed"].append(f"Test 2: Call {i+1} invalid JSON: {e}")
                log(f"❌ FAILED: Call {i+1} invalid JSON", "ERROR")
                return False
            
            if data.get("status") != "success":
                results["failed"].append(f"Test 2: Call {i+1} status != 'success'")
                log(f"❌ FAILED: Call {i+1} status != 'success'", "ERROR")
                return False
            
            tickers = data.get("data", [])
            if not isinstance(tickers, list) or len(tickers) == 0:
                results["failed"].append(f"Test 2: Call {i+1} returned empty or invalid data")
                log(f"❌ FAILED: Call {i+1} returned empty or invalid data", "ERROR")
                return False
            
            responses.append({
                "count": len(tickers),
                "symbols": [t.get("symbol") for t in tickers],
                "btc_price": next((t.get("price") for t in tickers if t.get("symbol") == "BTC"), None),
                "eth_price": next((t.get("price") for t in tickers if t.get("symbol") == "ETH"), None)
            })
            
            log(f"✅ Call {i+1}: {len(tickers)} tickers, BTC=${responses[-1]['btc_price']:,.2f}, ETH=${responses[-1]['eth_price']:,.2f}")
        
        # Check consistency
        counts = [r["count"] for r in responses]
        if len(set(counts)) > 1:
            results["warnings"].append(f"Test 2: Ticker counts vary across calls: {counts}")
            log(f"⚠️  WARNING: Ticker counts vary: {counts}", "WARN")
        else:
            log(f"✅ Consistent ticker count across all calls: {counts[0]}")
        
        # Check BTC/ETH present in all calls
        for i, r in enumerate(responses):
            if not r["btc_price"]:
                results["failed"].append(f"Test 2: Call {i+1} missing BTC")
                log(f"❌ FAILED: Call {i+1} missing BTC", "ERROR")
                return False
            if not r["eth_price"]:
                results["failed"].append(f"Test 2: Call {i+1} missing ETH")
                log(f"❌ FAILED: Call {i+1} missing ETH", "ERROR")
                return False
        
        log(f"✅ BTC and ETH present in all 3 calls")
        
        results["passed"].append("Test 2: /api/public/tickers is stable across 3 calls")
        log(f"\n✅ TEST 2 PASSED", "SUCCESS")
        return True
        
    except Exception as e:
        results["failed"].append(f"Test 2: Exception - {e}")
        log(f"❌ FAILED: Exception - {e}", "ERROR")
        import traceback
        traceback.print_exc()
        return False

def test_3_health_endpoint():
    """
    Test 3: GET /health
    - MUST return HTTP 200
    - status "healthy"
    - database "connected"
    - redis "connected"
    - tatum_api.operational should be true
    
    Note: Health endpoint is on the backend server (localhost:8001), not routed through frontend
    """
    log("\n=== TEST 3: GET /health ===")
    
    try:
        # Health endpoint is on backend server directly (not routed through Next.js frontend)
        response = requests.get(
            "http://localhost:8001/health",
            timeout=30
        )
        
        # Check HTTP 200
        if response.status_code != 200:
            results["failed"].append(f"Test 3: Expected 200, got {response.status_code}")
            log(f"❌ FAILED: Status {response.status_code}", "ERROR")
            log(f"Response: {response.text[:500]}", "ERROR")
            return False
        
        log(f"✅ HTTP 200 OK")
        
        # Parse JSON
        try:
            data = response.json()
        except Exception as e:
            results["failed"].append(f"Test 3: Invalid JSON response: {e}")
            log(f"❌ FAILED: Invalid JSON - {e}", "ERROR")
            return False
        
        log(f"📊 Health response: {json.dumps(data, indent=2)}")
        
        # Check status
        if data.get("status") != "healthy":
            results["failed"].append(f"Test 3: Expected status='healthy', got '{data.get('status')}'")
            log(f"❌ FAILED: status != 'healthy'", "ERROR")
            return False
        
        log(f"✅ status='healthy'")
        
        # Check database
        if data.get("database") != "connected":
            results["failed"].append(f"Test 3: Expected database='connected', got '{data.get('database')}'")
            log(f"❌ FAILED: database != 'connected'", "ERROR")
            return False
        
        log(f"✅ database='connected'")
        
        # Check redis
        if data.get("redis") != "connected":
            results["failed"].append(f"Test 3: Expected redis='connected', got '{data.get('redis')}'")
            log(f"❌ FAILED: redis != 'connected'", "ERROR")
            return False
        
        log(f"✅ redis='connected'")
        
        # Check tatum_api (optional but expected)
        tatum_api = data.get("tatum_api", {})
        if isinstance(tatum_api, dict):
            if tatum_api.get("operational") == True:
                log(f"✅ tatum_api.operational=true")
            else:
                results["warnings"].append(f"Test 3: tatum_api.operational != true")
                log(f"⚠️  WARNING: tatum_api.operational != true", "WARN")
        else:
            results["warnings"].append(f"Test 3: tatum_api field missing or invalid")
            log(f"⚠️  WARNING: tatum_api field missing", "WARN")
        
        results["passed"].append("Test 3: /health returns healthy status with database and redis connected")
        log(f"\n✅ TEST 3 PASSED", "SUCCESS")
        return True
        
    except Exception as e:
        results["failed"].append(f"Test 3: Exception - {e}")
        log(f"❌ FAILED: Exception - {e}", "ERROR")
        import traceback
        traceback.print_exc()
        return False

def test_4_csrf_token_sanity():
    """
    Test 4: GET /api/csrf-token
    - MUST return HTTP 200
    - Confirms backend routing healthy
    """
    log("\n=== TEST 4: GET /api/csrf-token (sanity check) ===")
    
    try:
        response = requests.get(
            f"{API_BASE}/csrf-token",
            timeout=30
        )
        
        # Check HTTP 200
        if response.status_code != 200:
            results["failed"].append(f"Test 4: Expected 200, got {response.status_code}")
            log(f"❌ FAILED: Status {response.status_code}", "ERROR")
            log(f"Response: {response.text[:500]}", "ERROR")
            return False
        
        log(f"✅ HTTP 200 OK")
        
        # Parse JSON
        try:
            data = response.json()
        except Exception as e:
            results["failed"].append(f"Test 4: Invalid JSON response: {e}")
            log(f"❌ FAILED: Invalid JSON - {e}", "ERROR")
            return False
        
        # Check for csrf token (field name may vary)
        csrf = data.get("csrf_token") or data.get("csrfToken") or data.get("token")
        if csrf:
            log(f"✅ CSRF token present: {csrf[:20]}...")
        else:
            results["warnings"].append(f"Test 4: CSRF token field not found in response")
            log(f"⚠️  WARNING: CSRF token field not found", "WARN")
        
        results["passed"].append("Test 4: /api/csrf-token returns 200 (backend routing healthy)")
        log(f"\n✅ TEST 4 PASSED", "SUCCESS")
        return True
        
    except Exception as e:
        results["failed"].append(f"Test 4: Exception - {e}")
        log(f"❌ FAILED: Exception - {e}", "ERROR")
        import traceback
        traceback.print_exc()
        return False

def print_summary():
    """Print test summary"""
    log("\n" + "="*80)
    log("TEST SUMMARY")
    log("="*80)
    
    total = len(results["passed"]) + len(results["failed"])
    log(f"\nTotal Tests: {total}")
    log(f"Passed: {len(results['passed'])}")
    log(f"Failed: {len(results['failed'])}")
    log(f"Warnings: {len(results['warnings'])}")
    
    if results["passed"]:
        log("\n✅ PASSED TESTS:")
        for test in results["passed"]:
            log(f"  ✅ {test}")
    
    if results["failed"]:
        log("\n❌ FAILED TESTS:")
        for test in results["failed"]:
            log(f"  ❌ {test}")
    
    if results["warnings"]:
        log("\n⚠️  WARNINGS:")
        for warning in results["warnings"]:
            log(f"  ⚠️  {warning}")
    
    log("\n" + "="*80)
    
    if len(results["failed"]) == 0:
        log("🎉 ALL TESTS PASSED!", "SUCCESS")
        return 0
    else:
        log("❌ SOME TESTS FAILED", "ERROR")
        return 1

def main():
    """Run all tests"""
    log("="*80)
    log("BACKEND TEST: Tatum Fallback on /api/public/tickers")
    log("="*80)
    log(f"Base URL: {BASE_URL}")
    log(f"API Base: {API_BASE}")
    log("="*80)
    
    # Run tests (no auth needed - all public endpoints)
    test_1_public_tickers()
    test_2_tickers_stability()
    test_3_health_endpoint()
    test_4_csrf_token_sanity()
    
    # Print summary
    exit_code = print_summary()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
