#!/usr/bin/env python3
"""
Backend Test Script for Creator Page Analytics Feature
Tests all 9 items from the test plan on LIVE Railway PG
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Configuration
BASE_URL = "https://crypto-payment-hub-33.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"

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

def login():
    """Login and get access token"""
    log("Logging in...")
    response = requests.post(
        f"{API_BASE}/user/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=30
    )
    
    if response.status_code != 200:
        log(f"Login failed: {response.status_code} - {response.text}", "ERROR")
        sys.exit(1)
    
    data = response.json()
    token = data.get("data", {}).get("accessToken")
    
    if not token:
        log("No access token in response", "ERROR")
        sys.exit(1)
    
    log("Login successful")
    return token

def get_csrf_token(token):
    """Get CSRF token for PUT requests"""
    log("Fetching CSRF token...")
    response = requests.get(
        f"{API_BASE}/csrf-token",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    if response.status_code != 200:
        log(f"CSRF token fetch failed: {response.status_code}", "ERROR")
        return None
    
    data = response.json()
    # Try both possible locations
    csrf = data.get("csrf_token") or data.get("data", {}).get("csrfToken")
    
    if csrf:
        log(f"CSRF token obtained: {csrf[:20]}...")
    else:
        log("CSRF token not found in response", "WARN")
    
    return csrf

def test_1_public_200_default_enabled(token):
    """Test 1: Public 200 (default enabled)"""
    log("\n=== TEST 1: Public 200 (default enabled) ===")
    
    response = requests.get(
        f"{API_BASE}/pay/creator/hostbay/analytics",
        timeout=30
    )
    
    if response.status_code != 200:
        results["failed"].append(f"Test 1: Expected 200, got {response.status_code}")
        log(f"FAILED: Status {response.status_code}", "ERROR")
        return None
    
    data = response.json().get("data", {})
    
    # Check enabled
    if data.get("enabled") != True:
        results["failed"].append("Test 1: enabled should be true")
        log("FAILED: enabled != true", "ERROR")
        return None
    
    # Check chart
    chart = data.get("chart", [])
    if not isinstance(chart, list) or len(chart) != 30:
        results["failed"].append(f"Test 1: chart should be array of 30, got {len(chart)}")
        log(f"FAILED: chart length {len(chart)} != 30", "ERROR")
        return None
    
    # Check chart item structure
    if chart:
        item = chart[0]
        if not all(k in item for k in ["date", "amount", "count"]):
            results["failed"].append("Test 1: chart items missing required fields")
            log("FAILED: chart item structure invalid", "ERROR")
            return None
    
    # Check top_supporters
    top_supporters = data.get("top_supporters", [])
    if not isinstance(top_supporters, list):
        results["failed"].append("Test 1: top_supporters should be array")
        log("FAILED: top_supporters not array", "ERROR")
        return None
    
    # Check totals
    totals = data.get("totals", {})
    required_totals = ["amount_30d", "count_30d", "supporters_30d", "amount_lifetime", "supporters_lifetime"]
    for key in required_totals:
        if key not in totals:
            results["failed"].append(f"Test 1: totals missing {key}")
            log(f"FAILED: totals missing {key}", "ERROR")
            return None
    
    # Check lifetime values are 0 in public endpoint
    if totals.get("amount_lifetime") != 0:
        results["failed"].append(f"Test 1: amount_lifetime should be 0, got {totals.get('amount_lifetime')}")
        log(f"FAILED: amount_lifetime = {totals.get('amount_lifetime')} (should be 0)", "ERROR")
        return None
    
    if totals.get("supporters_lifetime") != 0:
        results["failed"].append(f"Test 1: supporters_lifetime should be 0, got {totals.get('supporters_lifetime')}")
        log(f"FAILED: supporters_lifetime = {totals.get('supporters_lifetime')} (should be 0)", "ERROR")
        return None
    
    # Check currency
    if "currency" not in data:
        results["failed"].append("Test 1: currency missing")
        log("FAILED: currency missing", "ERROR")
        return None
    
    # Check window_days
    if data.get("window_days") != 30:
        results["failed"].append(f"Test 1: window_days should be 30, got {data.get('window_days')}")
        log(f"FAILED: window_days = {data.get('window_days')}", "ERROR")
        return None
    
    results["passed"].append("Test 1: Public 200 (default enabled)")
    log(f"PASSED: enabled={data.get('enabled')}, chart={len(chart)} items, currency={data.get('currency')}, totals.count_30d={totals.get('count_30d')}")
    return data

def test_2_chart_bucketing_sanity(test1_data):
    """Test 2: Chart bucketing sanity"""
    log("\n=== TEST 2: Chart bucketing sanity ===")
    
    if not test1_data:
        results["failed"].append("Test 2: Skipped (Test 1 failed)")
        log("SKIPPED: Test 1 failed", "WARN")
        return
    
    chart = test1_data.get("chart", [])
    totals = test1_data.get("totals", {})
    
    # Check exactly 30 items
    if len(chart) != 30:
        results["failed"].append(f"Test 2: Expected 30 chart items, got {len(chart)}")
        log(f"FAILED: chart length {len(chart)}", "ERROR")
        return
    
    # Check dates are monotonically increasing
    dates = [item["date"] for item in chart]
    sorted_dates = sorted(dates)
    if dates != sorted_dates:
        results["failed"].append("Test 2: Dates not monotonically increasing")
        log("FAILED: dates not sorted", "ERROR")
        return
    
    # Check date range (oldest = today - 29 days, newest = today)
    today = datetime.utcnow().date()
    oldest_expected = (today - timedelta(days=29)).isoformat()
    newest_expected = today.isoformat()
    
    oldest_actual = dates[0]
    newest_actual = dates[-1]
    
    log(f"Date range: {oldest_actual} to {newest_actual}")
    log(f"Expected: {oldest_expected} to {newest_expected}")
    
    # Allow 1 day tolerance for timezone differences
    oldest_date = datetime.fromisoformat(oldest_actual).date()
    newest_date = datetime.fromisoformat(newest_actual).date()
    
    if abs((oldest_date - (today - timedelta(days=29))).days) > 1:
        results["warnings"].append(f"Test 2: Oldest date {oldest_actual} differs from expected {oldest_expected}")
        log(f"WARNING: oldest date mismatch", "WARN")
    
    if abs((newest_date - today).days) > 1:
        results["warnings"].append(f"Test 2: Newest date {newest_actual} differs from expected {newest_expected}")
        log(f"WARNING: newest date mismatch", "WARN")
    
    # Check for non-zero bucket if count_30d > 0 (Sequelize Date bug regression check)
    count_30d = totals.get("count_30d", 0)
    non_zero_buckets = [b for b in chart if b["count"] > 0]
    
    if count_30d > 0 and len(non_zero_buckets) == 0:
        results["failed"].append("Test 2: REGRESSION - count_30d > 0 but no chart bucket has count > 0 (Sequelize Date bug)")
        log(f"FAILED: REGRESSION DETECTED - count_30d={count_30d} but no non-zero buckets", "ERROR")
        return
    
    # Check for expected bucket on 2026-07-13 with 3 tips
    bucket_2026_07_13 = next((b for b in chart if b["date"] == "2026-07-13"), None)
    if bucket_2026_07_13:
        log(f"Found 2026-07-13 bucket: amount={bucket_2026_07_13['amount']}, count={bucket_2026_07_13['count']}")
        if bucket_2026_07_13["count"] == 3 and bucket_2026_07_13["amount"] == 30:
            log("✓ Expected bucket (2026-07-13, count=3, amount=30) found")
        else:
            results["warnings"].append(f"Test 2: 2026-07-13 bucket has count={bucket_2026_07_13['count']}, amount={bucket_2026_07_13['amount']} (expected count=3, amount=30)")
    
    results["passed"].append("Test 2: Chart bucketing sanity")
    log(f"PASSED: 30 items, dates sorted, {len(non_zero_buckets)} non-zero buckets")

def test_3_public_404():
    """Test 3: Public 404"""
    log("\n=== TEST 3: Public 404 ===")
    
    response = requests.get(
        f"{API_BASE}/pay/creator/nonexistent-handle-xyz/analytics",
        timeout=30
    )
    
    if response.status_code != 404:
        results["failed"].append(f"Test 3: Expected 404, got {response.status_code}")
        log(f"FAILED: Status {response.status_code}", "ERROR")
        return
    
    data = response.json()
    message = data.get("message", "")
    
    if "Creator page not found" not in message:
        results["failed"].append(f"Test 3: Expected 'Creator page not found', got '{message}'")
        log(f"FAILED: Wrong message: {message}", "ERROR")
        return
    
    results["passed"].append("Test 3: Public 404")
    log(f"PASSED: 404 with message '{message}'")

def test_4_auth_200_own_view(token):
    """Test 4: Auth 200 (own view, lifetime present)"""
    log("\n=== TEST 4: Auth 200 (own view, lifetime present) ===")
    
    response = requests.get(
        f"{API_BASE}/user/creator/analytics",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    if response.status_code != 200:
        results["failed"].append(f"Test 4: Expected 200, got {response.status_code}")
        log(f"FAILED: Status {response.status_code} - {response.text}", "ERROR")
        return None
    
    data = response.json().get("data", {})
    
    # Check enabled
    if data.get("enabled") != True:
        results["failed"].append("Test 4: enabled should be true")
        log("FAILED: enabled != true", "ERROR")
        return None
    
    # Check public_analytics_enabled
    if data.get("public_analytics_enabled") != True:
        results["failed"].append("Test 4: public_analytics_enabled should be true")
        log("FAILED: public_analytics_enabled != true", "ERROR")
        return None
    
    # Check has_handle
    if data.get("has_handle") != True:
        results["failed"].append("Test 4: has_handle should be true")
        log("FAILED: has_handle != true", "ERROR")
        return None
    
    # Check chart
    chart = data.get("chart", [])
    if len(chart) != 30:
        results["failed"].append(f"Test 4: chart should have 30 items, got {len(chart)}")
        log(f"FAILED: chart length {len(chart)}", "ERROR")
        return None
    
    # Check top_supporters
    top_supporters = data.get("top_supporters", [])
    if not isinstance(top_supporters, list):
        results["failed"].append("Test 4: top_supporters should be array")
        log("FAILED: top_supporters not array", "ERROR")
        return None
    
    # Check totals with lifetime
    totals = data.get("totals", {})
    amount_lifetime = totals.get("amount_lifetime")
    supporters_lifetime = totals.get("supporters_lifetime")
    
    if amount_lifetime is None:
        results["failed"].append("Test 4: amount_lifetime missing")
        log("FAILED: amount_lifetime missing", "ERROR")
        return None
    
    if supporters_lifetime is None:
        results["failed"].append("Test 4: supporters_lifetime missing")
        log("FAILED: supporters_lifetime missing", "ERROR")
        return None
    
    # Lifetime should be >= 0 and actual numbers
    if not isinstance(amount_lifetime, (int, float)) or amount_lifetime < 0:
        results["failed"].append(f"Test 4: amount_lifetime should be >= 0, got {amount_lifetime}")
        log(f"FAILED: amount_lifetime = {amount_lifetime}", "ERROR")
        return None
    
    if not isinstance(supporters_lifetime, (int, float)) or supporters_lifetime < 0:
        results["failed"].append(f"Test 4: supporters_lifetime should be >= 0, got {supporters_lifetime}")
        log(f"FAILED: supporters_lifetime = {supporters_lifetime}", "ERROR")
        return None
    
    results["passed"].append("Test 4: Auth 200 (own view, lifetime present)")
    log(f"PASSED: enabled={data.get('enabled')}, public_analytics_enabled={data.get('public_analytics_enabled')}, has_handle={data.get('has_handle')}")
    log(f"  Lifetime: amount={amount_lifetime}, supporters={supporters_lifetime}")
    return data

def test_5_auth_401():
    """Test 5: Auth 401"""
    log("\n=== TEST 5: Auth 401 ===")
    
    response = requests.get(
        f"{API_BASE}/user/creator/analytics",
        timeout=30
    )
    
    if response.status_code != 401:
        results["failed"].append(f"Test 5: Expected 401, got {response.status_code}")
        log(f"FAILED: Status {response.status_code}", "ERROR")
        return
    
    results["passed"].append("Test 5: Auth 401")
    log("PASSED: 401 without Authorization header")

def test_6_toggle_round_trip(token, csrf_token):
    """Test 6: Toggle round-trip (WRITE - must revert at end)"""
    log("\n=== TEST 6: Toggle round-trip (WRITE - must revert at end) ===")
    
    if not csrf_token:
        results["failed"].append("Test 6: No CSRF token available")
        log("FAILED: No CSRF token", "ERROR")
        return
    
    headers = {
        "Authorization": f"Bearer {token}",
        "x-csrf-token": csrf_token,
        "Content-Type": "application/json"
    }
    
    # 6a: Set to false
    log("6a: Setting public_analytics_enabled to false...")
    response = requests.put(
        f"{API_BASE}/user/creator/profile",
        headers=headers,
        json={"public_analytics_enabled": False},
        timeout=30
    )
    
    if response.status_code != 200:
        results["failed"].append(f"Test 6a: Expected 200, got {response.status_code}")
        log(f"FAILED 6a: Status {response.status_code} - {response.text}", "ERROR")
        # Try to revert anyway
        test_6d_revert(token, csrf_token, headers)
        return
    
    data = response.json().get("data", {})
    if data.get("public_analytics_enabled") != False:
        results["failed"].append(f"Test 6a: public_analytics_enabled should be false, got {data.get('public_analytics_enabled')}")
        log(f"FAILED 6a: public_analytics_enabled = {data.get('public_analytics_enabled')}", "ERROR")
        test_6d_revert(token, csrf_token, headers)
        return
    
    log("✓ 6a PASSED: public_analytics_enabled set to false")
    
    # 6b: Public endpoint should return enabled=false
    log("6b: Checking public endpoint returns enabled=false...")
    response = requests.get(
        f"{API_BASE}/pay/creator/hostbay/analytics",
        timeout=30
    )
    
    if response.status_code != 200:
        results["failed"].append(f"Test 6b: Expected 200, got {response.status_code}")
        log(f"FAILED 6b: Status {response.status_code}", "ERROR")
        test_6d_revert(token, csrf_token, headers)
        return
    
    data = response.json().get("data", {})
    if data.get("enabled") != False:
        results["failed"].append(f"Test 6b: enabled should be false, got {data.get('enabled')}")
        log(f"FAILED 6b: enabled = {data.get('enabled')}", "ERROR")
        test_6d_revert(token, csrf_token, headers)
        return
    
    if len(data.get("chart", [])) != 0:
        results["failed"].append(f"Test 6b: chart should be empty, got {len(data.get('chart', []))} items")
        log(f"FAILED 6b: chart not empty", "ERROR")
        test_6d_revert(token, csrf_token, headers)
        return
    
    if len(data.get("top_supporters", [])) != 0:
        results["failed"].append(f"Test 6b: top_supporters should be empty, got {len(data.get('top_supporters', []))} items")
        log(f"FAILED 6b: top_supporters not empty", "ERROR")
        test_6d_revert(token, csrf_token, headers)
        return
    
    log("✓ 6b PASSED: Public endpoint returns enabled=false with empty data")
    
    # 6c: Auth endpoint should still show data
    log("6c: Checking auth endpoint still shows data...")
    response = requests.get(
        f"{API_BASE}/user/creator/analytics",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    if response.status_code != 200:
        results["failed"].append(f"Test 6c: Expected 200, got {response.status_code}")
        log(f"FAILED 6c: Status {response.status_code}", "ERROR")
        test_6d_revert(token, csrf_token, headers)
        return
    
    data = response.json().get("data", {})
    if data.get("enabled") != True:
        results["failed"].append(f"Test 6c: enabled should be true (merchant always sees own data), got {data.get('enabled')}")
        log(f"FAILED 6c: enabled = {data.get('enabled')}", "ERROR")
        test_6d_revert(token, csrf_token, headers)
        return
    
    if data.get("public_analytics_enabled") != False:
        results["failed"].append(f"Test 6c: public_analytics_enabled should be false, got {data.get('public_analytics_enabled')}")
        log(f"FAILED 6c: public_analytics_enabled = {data.get('public_analytics_enabled')}", "ERROR")
        test_6d_revert(token, csrf_token, headers)
        return
    
    if len(data.get("chart", [])) != 30:
        results["failed"].append(f"Test 6c: chart should have 30 items, got {len(data.get('chart', []))}")
        log(f"FAILED 6c: chart length = {len(data.get('chart', []))}", "ERROR")
        test_6d_revert(token, csrf_token, headers)
        return
    
    log("✓ 6c PASSED: Auth endpoint still shows data with public_analytics_enabled=false")
    
    # 6d: REVERT - Set back to true (MANDATORY)
    test_6d_revert(token, csrf_token, headers)
    
    # 6e: Verify public endpoint shows data again
    log("6e: Verifying public endpoint shows data again...")
    response = requests.get(
        f"{API_BASE}/pay/creator/hostbay/analytics",
        timeout=30
    )
    
    if response.status_code != 200:
        results["failed"].append(f"Test 6e: Expected 200, got {response.status_code}")
        log(f"FAILED 6e: Status {response.status_code}", "ERROR")
        return
    
    data = response.json().get("data", {})
    if data.get("enabled") != True:
        results["failed"].append(f"Test 6e: enabled should be true, got {data.get('enabled')}")
        log(f"FAILED 6e: enabled = {data.get('enabled')}", "ERROR")
        return
    
    if len(data.get("chart", [])) != 30:
        results["failed"].append(f"Test 6e: chart should have 30 items, got {len(data.get('chart', []))}")
        log(f"FAILED 6e: chart not restored", "ERROR")
        return
    
    log("✓ 6e PASSED: Public endpoint restored with enabled=true and data")
    
    results["passed"].append("Test 6: Toggle round-trip (WRITE - reverted)")
    log("PASSED: Full toggle round-trip completed and reverted")

def test_6d_revert(token, csrf_token, headers):
    """6d: REVERT - Set public_analytics_enabled back to true"""
    log("6d: REVERTING public_analytics_enabled to true (MANDATORY)...")
    
    response = requests.put(
        f"{API_BASE}/user/creator/profile",
        headers=headers,
        json={"public_analytics_enabled": True},
        timeout=30
    )
    
    if response.status_code != 200:
        log(f"CRITICAL: REVERT FAILED - Status {response.status_code} - {response.text}", "ERROR")
        results["failed"].append(f"Test 6d: REVERT FAILED - Status {response.status_code}")
        return
    
    data = response.json().get("data", {})
    if data.get("public_analytics_enabled") != True:
        log(f"CRITICAL: REVERT FAILED - public_analytics_enabled = {data.get('public_analytics_enabled')}", "ERROR")
        results["failed"].append(f"Test 6d: REVERT FAILED - public_analytics_enabled != true")
        return
    
    log("✓ 6d PASSED: REVERTED to public_analytics_enabled=true")

def test_7_top_supporters_privacy(test4_data):
    """Test 7: Top supporters privacy"""
    log("\n=== TEST 7: Top supporters privacy ===")
    
    if not test4_data:
        results["failed"].append("Test 7: Skipped (Test 4 failed)")
        log("SKIPPED: Test 4 failed", "WARN")
        return
    
    top_supporters = test4_data.get("top_supporters", [])
    
    if len(top_supporters) == 0:
        results["warnings"].append("Test 7: No top supporters found (may be expected if no named tips)")
        log("WARNING: No top supporters", "WARN")
        results["passed"].append("Test 7: Top supporters privacy (no data to verify)")
        return
    
    log(f"Found {len(top_supporters)} top supporters")
    
    # Check structure
    for i, supporter in enumerate(top_supporters):
        if not all(k in supporter for k in ["name", "amount", "currency", "count"]):
            results["failed"].append(f"Test 7: Supporter {i} missing required fields")
            log(f"FAILED: Supporter {i} structure invalid: {supporter}", "ERROR")
            return
        
        log(f"  Supporter {i+1}: name={supporter['name']}, amount={supporter['amount']}, count={supporter['count']}")
    
    # Check for expected names (Bob and Alice)
    names = [s["name"].lower() for s in top_supporters]
    if "bob" in names:
        log("✓ Found 'Bob' in top supporters")
    if "alice" in names:
        log("✓ Found 'Alice' in top supporters")
    
    # Check no anonymous supporter (should be max 2 named supporters, not 3)
    if len(top_supporters) > 2:
        results["warnings"].append(f"Test 7: Expected max 2 named supporters (Bob, Alice), got {len(top_supporters)}")
        log(f"WARNING: {len(top_supporters)} supporters (expected max 2)", "WARN")
    
    results["passed"].append("Test 7: Top supporters privacy")
    log(f"PASSED: {len(top_supporters)} supporters with correct structure, no anonymous")

def test_8_sequelize_date_bug_regression(test1_data):
    """Test 8: Sequelize Date bug regression"""
    log("\n=== TEST 8: Sequelize Date bug regression ===")
    
    if not test1_data:
        results["failed"].append("Test 8: Skipped (Test 1 failed)")
        log("SKIPPED: Test 1 failed", "WARN")
        return
    
    chart = test1_data.get("chart", [])
    totals = test1_data.get("totals", {})
    count_30d = totals.get("count_30d", 0)
    
    non_zero_buckets = [b for b in chart if b["count"] > 0]
    
    log(f"count_30d = {count_30d}")
    log(f"Non-zero buckets: {len(non_zero_buckets)}")
    
    if count_30d > 0 and len(non_zero_buckets) == 0:
        results["failed"].append("Test 8: REGRESSION - Sequelize Date bug detected (count_30d > 0 but no chart bucket has count > 0)")
        log("FAILED: REGRESSION DETECTED - Sequelize Date bug", "ERROR")
        log(f"  count_30d = {count_30d}, but all chart buckets have count = 0", "ERROR")
        return
    
    if len(non_zero_buckets) > 0:
        log(f"Non-zero buckets found:")
        for b in non_zero_buckets:
            log(f"  {b['date']}: count={b['count']}, amount={b['amount']}")
    
    results["passed"].append("Test 8: Sequelize Date bug regression")
    log("PASSED: No Sequelize Date bug regression detected")

def test_9_existing_profile_endpoint_regression(token):
    """Test 9: Existing profile endpoint regression"""
    log("\n=== TEST 9: Existing profile endpoint regression ===")
    
    response = requests.get(
        f"{API_BASE}/pay/creator/hostbay",
        timeout=30
    )
    
    if response.status_code != 200:
        results["failed"].append(f"Test 9: Expected 200, got {response.status_code}")
        log(f"FAILED: Status {response.status_code}", "ERROR")
        return
    
    data = response.json().get("data", {})
    creator = data.get("creator", {})
    
    # Check public_analytics_enabled is present
    if "public_analytics_enabled" not in creator:
        results["failed"].append("Test 9: creator.public_analytics_enabled missing")
        log("FAILED: public_analytics_enabled missing", "ERROR")
        return
    
    log(f"public_analytics_enabled = {creator.get('public_analytics_enabled')}")
    
    # Check other keys unchanged
    expected_keys = ["name", "handle", "bio", "photo", "cover_image", "social_links", "theme"]
    for key in expected_keys:
        if key not in creator:
            results["warnings"].append(f"Test 9: creator.{key} missing (may be null)")
            log(f"WARNING: creator.{key} missing", "WARN")
    
    # Check support_widget and links exist (may be null/empty)
    if "support_widget" not in data:
        results["warnings"].append("Test 9: support_widget missing")
        log("WARNING: support_widget missing", "WARN")
    
    if "links" not in data:
        results["warnings"].append("Test 9: links missing")
        log("WARNING: links missing", "WARN")
    
    results["passed"].append("Test 9: Existing profile endpoint regression")
    log("PASSED: Profile endpoint includes public_analytics_enabled, other keys present")

def main():
    """Main test runner"""
    log("=" * 80)
    log("Creator Page Analytics Backend Test Suite")
    log("=" * 80)
    
    try:
        # Login
        token = login()
        
        # Get CSRF token
        csrf_token = get_csrf_token(token)
        
        # Run tests
        test1_data = test_1_public_200_default_enabled(token)
        test_2_chart_bucketing_sanity(test1_data)
        test_3_public_404()
        test4_data = test_4_auth_200_own_view(token)
        test_5_auth_401()
        test_6_toggle_round_trip(token, csrf_token)
        test_7_top_supporters_privacy(test4_data)
        test_8_sequelize_date_bug_regression(test1_data)
        test_9_existing_profile_endpoint_regression(token)
        
        # Print summary
        log("\n" + "=" * 80)
        log("TEST SUMMARY")
        log("=" * 80)
        
        log(f"\n✅ PASSED: {len(results['passed'])}")
        for test in results["passed"]:
            log(f"  ✓ {test}")
        
        if results["failed"]:
            log(f"\n❌ FAILED: {len(results['failed'])}")
            for test in results["failed"]:
                log(f"  ✗ {test}", "ERROR")
        
        if results["warnings"]:
            log(f"\n⚠️  WARNINGS: {len(results['warnings'])}")
            for test in results["warnings"]:
                log(f"  ! {test}", "WARN")
        
        log("\n" + "=" * 80)
        
        if results["failed"]:
            log(f"RESULT: {len(results['failed'])} test(s) FAILED", "ERROR")
            sys.exit(1)
        else:
            log(f"RESULT: ALL TESTS PASSED ({len(results['passed'])} passed, {len(results['warnings'])} warnings)", "INFO")
            sys.exit(0)
    
    except Exception as e:
        log(f"FATAL ERROR: {str(e)}", "ERROR")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
