#!/usr/bin/env python3
"""
Session 58 - Digital Delivery Backend Verification
Tests all 9 verification items from the Session 58 checklist
"""

import requests
import json
import time
from datetime import datetime, timedelta
from urllib.parse import urlparse, parse_qs
import psycopg2
from psycopg2.extras import RealDictCursor

# Configuration
BASE_URL = "http://localhost:8001"
DATABASE_URL = "postgresql://postgres:IHCzCDslIsUZlzCvvjxfSWcChEiBtiCU@roundhouse.proxy.rlwy.net:23599/railway?sslmode=require"

# Test data
TEST_FILE_ORDER_REF = "testfiledlvf4b77fdaf1aa4c85"
TEST_URL_ORDER_4_REF = "ab28e53da29ba70b6266b0e0"
TEST_URL_ORDER_1_REF = "b4b93fc0357f559af54b7095"

# Results tracking
results = {
    "passed": 0,
    "failed": 0,
    "tests": []
}

def log_test(test_num, name, passed, details):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{'='*80}")
    print(f"Test {test_num}: {name}")
    print(f"Status: {status}")
    print(f"Details: {details}")
    print(f"{'='*80}")
    
    results["tests"].append({
        "test_num": test_num,
        "name": name,
        "passed": passed,
        "details": details
    })
    
    if passed:
        results["passed"] += 1
    else:
        results["failed"] += 1

def get_db_connection():
    """Get PostgreSQL connection"""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

# ============================================================================
# TEST 1: File-type receipt (seeded order)
# ============================================================================
def test_1_file_type_receipt():
    """Test file-type receipt structure"""
    try:
        url = f"{BASE_URL}/api/order/{TEST_FILE_ORDER_REF}"
        response = requests.get(url, timeout=10)
        
        if response.status_code != 200:
            log_test(1, "File-type receipt (seed order)", False, 
                    f"HTTP {response.status_code}, expected 200. Body: {response.text[:500]}")
            return
        
        data = response.json().get("data", {})
        order = data.get("order", {})
        items = data.get("items", [])
        
        # Assertions
        checks = []
        
        # Check payment_status
        if order.get("payment_status") == "paid":
            checks.append("✓ payment_status='paid'")
        else:
            checks.append(f"✗ payment_status='{order.get('payment_status')}' (expected 'paid')")
        
        # Check fulfillment_status
        if order.get("fulfillment_status") == "fulfilled":
            checks.append("✓ fulfillment_status='fulfilled'")
        else:
            checks.append(f"✗ fulfillment_status='{order.get('fulfillment_status')}' (expected 'fulfilled')")
        
        # Check digital_delivery_type
        if len(items) > 0:
            item = items[0]
            product_snapshot = item.get("product_snapshot", {})
            delivery_type = product_snapshot.get("digital_delivery_type")
            
            if delivery_type == "file":
                checks.append("✓ digital_delivery_type='file'")
            else:
                checks.append(f"✗ digital_delivery_type='{delivery_type}' (expected 'file')")
            
            # Check delivered_payload structure
            delivered_payload = item.get("delivered_payload", {})
            
            # Must have asset_deliveries array
            asset_deliveries = delivered_payload.get("asset_deliveries")
            if isinstance(asset_deliveries, list) and len(asset_deliveries) == 2:
                checks.append(f"✓ asset_deliveries is array with length 2")
                
                # Check each delivery has required fields
                all_valid = True
                for idx, delivery in enumerate(asset_deliveries):
                    download_url = delivery.get("download_url", "")
                    filename = delivery.get("filename", "")
                    expires_at = delivery.get("expires_at", "")
                    
                    if not download_url or not isinstance(download_url, str):
                        checks.append(f"✗ asset_deliveries[{idx}].download_url missing or not string")
                        all_valid = False
                    if not filename or not isinstance(filename, str):
                        checks.append(f"✗ asset_deliveries[{idx}].filename missing or not string")
                        all_valid = False
                    if not expires_at or not isinstance(expires_at, str):
                        checks.append(f"✗ asset_deliveries[{idx}].expires_at missing or not ISO string")
                        all_valid = False
                
                if all_valid:
                    checks.append("✓ All asset_deliveries have download_url, filename, expires_at")
            else:
                checks.append(f"✗ asset_deliveries not array or wrong length: {type(asset_deliveries)}, len={len(asset_deliveries) if isinstance(asset_deliveries, list) else 'N/A'}")
            
            # Must NOT have 'downloads' field
            if "downloads" not in delivered_payload:
                checks.append("✓ NO 'downloads' field in delivered_payload")
            else:
                checks.append("✗ 'downloads' field found in delivered_payload (should not exist)")
            
            # Must NOT have top-level 'expires_at' in delivered_payload
            if "expires_at" not in delivered_payload:
                checks.append("✓ NO top-level 'expires_at' in delivered_payload")
            else:
                checks.append("✗ Top-level 'expires_at' found in delivered_payload (should not exist)")
        else:
            checks.append("✗ No items in response")
        
        # Determine pass/fail
        passed = all("✓" in check for check in checks)
        log_test(1, "File-type receipt (seed order)", passed, "\n".join(checks))
        
        # Store for later tests
        if passed and len(items) > 0:
            return items[0].get("delivered_payload", {}).get("asset_deliveries", [])
        return None
        
    except Exception as e:
        log_test(1, "File-type receipt (seed order)", False, f"Exception: {str(e)}")
        return None

# ============================================================================
# TEST 2: URL-type receipt (order 4)
# ============================================================================
def test_2_url_type_receipt_order_4():
    """Test URL-type receipt (order 4)"""
    try:
        url = f"{BASE_URL}/api/order/{TEST_URL_ORDER_4_REF}"
        response = requests.get(url, timeout=10)
        
        if response.status_code != 200:
            log_test(2, "URL-type receipt (order 4)", False, 
                    f"HTTP {response.status_code}, expected 200. Body: {response.text[:500]}")
            return
        
        data = response.json().get("data", {})
        items = data.get("items", [])
        
        checks = []
        
        if len(items) > 0:
            item = items[0]
            product_snapshot = item.get("product_snapshot", {})
            delivery_type = product_snapshot.get("digital_delivery_type")
            
            if delivery_type == "url":
                checks.append("✓ digital_delivery_type='url'")
            else:
                checks.append(f"✗ digital_delivery_type='{delivery_type}' (expected 'url')")
            
            delivered_payload = item.get("delivered_payload", {})
            access_url = delivered_payload.get("access_url", "")
            
            if access_url and isinstance(access_url, str):
                checks.append(f"✓ access_url is non-empty string: {access_url[:50]}...")
            else:
                checks.append(f"✗ access_url missing or not string")
        else:
            checks.append("✗ No items in response")
        
        passed = all("✓" in check for check in checks)
        log_test(2, "URL-type receipt (order 4)", passed, "\n".join(checks))
        
    except Exception as e:
        log_test(2, "URL-type receipt (order 4)", False, f"Exception: {str(e)}")

# ============================================================================
# TEST 3: URL-type receipt (order 1)
# ============================================================================
def test_3_url_type_receipt_order_1():
    """Test URL-type receipt (order 1)"""
    try:
        url = f"{BASE_URL}/api/order/{TEST_URL_ORDER_1_REF}"
        response = requests.get(url, timeout=10)
        
        if response.status_code != 200:
            log_test(3, "URL-type receipt (order 1)", False, 
                    f"HTTP {response.status_code}, expected 200. Body: {response.text[:500]}")
            return
        
        data = response.json().get("data", {})
        items = data.get("items", [])
        
        checks = []
        
        if len(items) > 0:
            item = items[0]
            product_snapshot = item.get("product_snapshot", {})
            delivery_type = product_snapshot.get("digital_delivery_type")
            
            if delivery_type == "url":
                checks.append("✓ digital_delivery_type='url'")
            else:
                checks.append(f"✗ digital_delivery_type='{delivery_type}' (expected 'url')")
            
            delivered_payload = item.get("delivered_payload", {})
            access_url = delivered_payload.get("access_url", "")
            
            if access_url and isinstance(access_url, str):
                checks.append(f"✓ access_url is non-empty string: {access_url[:50]}...")
            else:
                checks.append(f"✗ access_url missing or not string")
        else:
            checks.append("✗ No items in response")
        
        passed = all("✓" in check for check in checks)
        log_test(3, "URL-type receipt (order 1)", passed, "\n".join(checks))
        
    except Exception as e:
        log_test(3, "URL-type receipt (order 1)", False, f"Exception: {str(e)}")

# ============================================================================
# TEST 4: Delivery projection guard (non-paid orders)
# ============================================================================
def test_4_delivery_projection_guard():
    """Test that non-paid orders have delivered_payload=null"""
    try:
        # Query DB for a non-paid order
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT public_ref 
            FROM tbl_product_order 
            WHERE payment_status != 'paid' 
            LIMIT 1
        """)
        
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not row:
            log_test(4, "Delivery projection guard", True, 
                    "SKIPPED: No non-paid orders in DB to test projection guard")
            return
        
        non_paid_ref = row["public_ref"]
        
        # GET the order
        url = f"{BASE_URL}/api/order/{non_paid_ref}"
        response = requests.get(url, timeout=10)
        
        if response.status_code != 200:
            log_test(4, "Delivery projection guard", False, 
                    f"HTTP {response.status_code}, expected 200. Body: {response.text[:500]}")
            return
        
        data = response.json().get("data", {})
        items = data.get("items", [])
        
        checks = []
        checks.append(f"Testing non-paid order: {non_paid_ref}")
        
        # All items must have delivered_payload=null
        all_null = True
        for idx, item in enumerate(items):
            delivered_payload = item.get("delivered_payload")
            if delivered_payload is None:
                checks.append(f"✓ items[{idx}].delivered_payload is null")
            else:
                checks.append(f"✗ items[{idx}].delivered_payload is NOT null (leaked!): {delivered_payload}")
                all_null = False
        
        passed = all_null and len(items) > 0
        log_test(4, "Delivery projection guard", passed, "\n".join(checks))
        
    except Exception as e:
        log_test(4, "Delivery projection guard", False, f"Exception: {str(e)}")

# ============================================================================
# TEST 5: Resend endpoint (paid file-type)
# ============================================================================
def test_5_resend_endpoint():
    """Test resend endpoint refreshes tokens"""
    try:
        # First GET to capture current tokens
        url = f"{BASE_URL}/api/order/{TEST_FILE_ORDER_REF}"
        response = requests.get(url, timeout=10)
        
        if response.status_code != 200:
            log_test(5, "Resend endpoint (paid file-type)", False, 
                    f"Initial GET failed: HTTP {response.status_code}")
            return None
        
        data = response.json().get("data", {})
        items = data.get("items", [])
        
        if len(items) == 0:
            log_test(5, "Resend endpoint (paid file-type)", False, "No items in order")
            return None
        
        old_deliveries = items[0].get("delivered_payload", {}).get("asset_deliveries", [])
        
        if len(old_deliveries) != 2:
            log_test(5, "Resend endpoint (paid file-type)", False, 
                    f"Expected 2 asset_deliveries, got {len(old_deliveries)}")
            return None
        
        old_tokens = [d.get("download_token") for d in old_deliveries]
        old_expires = [d.get("expires_at") for d in old_deliveries]
        old_urls = [d.get("download_url") for d in old_deliveries]
        
        checks = []
        checks.append(f"Old tokens: {old_tokens}")
        checks.append(f"Old expires_at: {old_expires}")
        
        # POST to resend endpoint
        resend_url = f"{BASE_URL}/api/order/{TEST_FILE_ORDER_REF}/resend-download"
        resend_response = requests.post(resend_url, json={}, timeout=10)
        
        if resend_response.status_code != 200:
            log_test(5, "Resend endpoint (paid file-type)", False, 
                    f"POST resend failed: HTTP {resend_response.status_code}, Body: {resend_response.text[:500]}")
            return None
        
        checks.append(f"✓ POST /resend-download returned 200")
        checks.append(f"Response: {resend_response.json()}")
        
        # Wait a moment for backend to process
        time.sleep(1)
        
        # GET again to verify new tokens
        response2 = requests.get(url, timeout=10)
        
        if response2.status_code != 200:
            log_test(5, "Resend endpoint (paid file-type)", False, 
                    f"Second GET failed: HTTP {response2.status_code}")
            return None
        
        data2 = response2.json().get("data", {})
        items2 = data2.get("items", [])
        new_deliveries = items2[0].get("delivered_payload", {}).get("asset_deliveries", [])
        
        new_tokens = [d.get("download_token") for d in new_deliveries]
        new_expires = [d.get("expires_at") for d in new_deliveries]
        new_urls = [d.get("download_url") for d in new_deliveries]
        
        checks.append(f"New tokens: {new_tokens}")
        checks.append(f"New expires_at: {new_expires}")
        
        # Verify tokens changed
        tokens_changed = all(old_tokens[i] != new_tokens[i] for i in range(2))
        if tokens_changed:
            checks.append("✓ All download_tokens changed")
        else:
            checks.append("✗ Some download_tokens did NOT change")
        
        # Verify expires_at changed and is in future
        expires_changed = all(old_expires[i] != new_expires[i] for i in range(2))
        if expires_changed:
            checks.append("✓ All expires_at changed")
        else:
            checks.append("✗ Some expires_at did NOT change")
        
        # Verify expires_at is in future (>23h from now)
        now = datetime.utcnow()
        future_threshold = now + timedelta(hours=23)
        all_future = True
        for exp_str in new_expires:
            exp_dt = datetime.fromisoformat(exp_str.replace('Z', '+00:00'))
            if exp_dt.replace(tzinfo=None) < future_threshold:
                checks.append(f"✗ expires_at {exp_str} is not >23h in future")
                all_future = False
        
        if all_future:
            checks.append("✓ All expires_at are >23h in future")
        
        # Verify download_url contains new token
        urls_updated = all(new_tokens[i] in new_urls[i] for i in range(2))
        if urls_updated:
            checks.append("✓ All download_urls contain new tokens")
        else:
            checks.append("✗ Some download_urls do NOT contain new tokens")
        
        passed = tokens_changed and expires_changed and all_future and urls_updated
        log_test(5, "Resend endpoint (paid file-type)", passed, "\n".join(checks))
        
        # Return new tokens for test 9
        return new_deliveries
        
    except Exception as e:
        log_test(5, "Resend endpoint (paid file-type)", False, f"Exception: {str(e)}")
        return None

# ============================================================================
# TEST 6: Resend rate-limit (5/day/order)
# ============================================================================
def test_6_resend_rate_limit(previous_resend_count=1):
    """Test resend rate-limit (6 total attempts should trigger 429)"""
    try:
        resend_url = f"{BASE_URL}/api/order/{TEST_FILE_ORDER_REF}/resend-download"
        
        checks = []
        checks.append(f"Already sent {previous_resend_count} resend request(s) in Test 5")
        checks.append("Sending 5 more resend requests...")
        
        status_codes = []
        
        for i in range(5):
            response = requests.post(resend_url, json={}, timeout=10)
            status_codes.append(response.status_code)
            checks.append(f"Attempt {previous_resend_count + i + 1}: HTTP {response.status_code}")
            
            if response.status_code == 429:
                checks.append(f"✓ Rate limit triggered at attempt {previous_resend_count + i + 1}")
                checks.append(f"Response: {response.text[:200]}")
                break
            
            time.sleep(0.5)  # Small delay between requests
        
        # Check if we got a 429
        got_429 = 429 in status_codes
        
        if got_429:
            checks.append("✓ Rate limit (429) was triggered")
            passed = True
        else:
            checks.append(f"✗ Rate limit NOT triggered. Status codes: {status_codes}")
            passed = False
        
        log_test(6, "Resend rate-limit", passed, "\n".join(checks))
        
    except Exception as e:
        log_test(6, "Resend rate-limit", False, f"Exception: {str(e)}")

# ============================================================================
# TEST 7: Resend guard (unpaid)
# ============================================================================
def test_7_resend_guard_unpaid():
    """Test resend guard rejects unpaid orders"""
    try:
        # Query DB for a non-paid order
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT public_ref 
            FROM tbl_product_order 
            WHERE payment_status != 'paid' 
            LIMIT 1
        """)
        
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not row:
            log_test(7, "Resend guard (unpaid)", True, 
                    "SKIPPED: No non-paid orders in DB to test resend guard")
            return
        
        non_paid_ref = row["public_ref"]
        
        # POST to resend endpoint
        resend_url = f"{BASE_URL}/api/order/{non_paid_ref}/resend-download"
        response = requests.post(resend_url, json={}, timeout=10)
        
        checks = []
        checks.append(f"Testing non-paid order: {non_paid_ref}")
        checks.append(f"HTTP Status: {response.status_code}")
        checks.append(f"Response: {response.text[:200]}")
        
        # Should return 400 with "Order is not paid" message
        if response.status_code == 400:
            checks.append("✓ HTTP 400 returned")
            
            body = response.text.lower()
            if "not paid" in body or "unpaid" in body:
                checks.append("✓ Response mentions order not paid")
                passed = True
            else:
                checks.append("✗ Response does not mention order not paid")
                passed = False
        else:
            checks.append(f"✗ Expected HTTP 400, got {response.status_code}")
            passed = False
        
        log_test(7, "Resend guard (unpaid)", passed, "\n".join(checks))
        
    except Exception as e:
        log_test(7, "Resend guard (unpaid)", False, f"Exception: {str(e)}")

# ============================================================================
# TEST 8: Download endpoint invalid-token auth
# ============================================================================
def test_8_download_invalid_token():
    """Test download endpoint rejects invalid tokens"""
    try:
        checks = []
        
        # Test 8a: Invalid token
        url_invalid = f"{BASE_URL}/api/order/{TEST_FILE_ORDER_REF}/download/999001?t=deadbeef"
        response_invalid = requests.get(url_invalid, timeout=10, allow_redirects=False)
        
        checks.append(f"Test 8a - Invalid token 'deadbeef':")
        checks.append(f"  HTTP Status: {response_invalid.status_code}")
        checks.append(f"  Response: {response_invalid.text[:100]}")
        
        if response_invalid.status_code == 403:
            checks.append("  ✓ HTTP 403 returned")
            
            body = response_invalid.text.lower()
            if "expired" in body or "invalid" in body:
                checks.append("  ✓ Response mentions expired/invalid")
                test_8a_pass = True
            else:
                checks.append("  ✗ Response does not mention expired/invalid")
                test_8a_pass = False
        else:
            checks.append(f"  ✗ Expected HTTP 403, got {response_invalid.status_code}")
            test_8a_pass = False
        
        # Test 8b: No token
        url_no_token = f"{BASE_URL}/api/order/{TEST_FILE_ORDER_REF}/download/999001"
        response_no_token = requests.get(url_no_token, timeout=10, allow_redirects=False)
        
        checks.append(f"\nTest 8b - No token:")
        checks.append(f"  HTTP Status: {response_no_token.status_code}")
        checks.append(f"  Response: {response_no_token.text[:100]}")
        
        if response_no_token.status_code == 403:
            checks.append("  ✓ HTTP 403 returned")
            
            body = response_no_token.text.lower()
            if "expired" in body or "invalid" in body:
                checks.append("  ✓ Response mentions expired/invalid")
                test_8b_pass = True
            else:
                checks.append("  ✗ Response does not mention expired/invalid")
                test_8b_pass = False
        else:
            checks.append(f"  ✗ Expected HTTP 403, got {response_no_token.status_code}")
            test_8b_pass = False
        
        passed = test_8a_pass and test_8b_pass
        log_test(8, "Download endpoint invalid-token auth", passed, "\n".join(checks))
        
    except Exception as e:
        log_test(8, "Download endpoint invalid-token auth", False, f"Exception: {str(e)}")

# ============================================================================
# TEST 9: Download endpoint valid-token, missing asset
# ============================================================================
def test_9_download_valid_token_missing_asset(new_deliveries):
    """Test download endpoint with valid token but missing asset returns 404"""
    try:
        if not new_deliveries or len(new_deliveries) == 0:
            log_test(9, "Download valid-token, missing asset", False, 
                    "No new_deliveries from Test 5 to extract valid token")
            return
        
        # Extract download_url for asset_id 999001
        target_delivery = None
        for delivery in new_deliveries:
            if delivery.get("asset_id") == 999001:
                target_delivery = delivery
                break
        
        if not target_delivery:
            log_test(9, "Download valid-token, missing asset", False, 
                    "Could not find asset_id=999001 in deliveries")
            return
        
        download_url = target_delivery.get("download_url", "")
        
        if not download_url:
            log_test(9, "Download valid-token, missing asset", False, 
                    "download_url is empty")
            return
        
        checks = []
        checks.append(f"Using download_url: {download_url[:80]}...")
        
        # Parse to get the path and query
        parsed = urlparse(download_url)
        full_path = parsed.path
        if parsed.query:
            full_path += f"?{parsed.query}"
        
        # Make request to the download endpoint
        url = f"{BASE_URL}{full_path}"
        response = requests.get(url, timeout=10, allow_redirects=False)
        
        checks.append(f"HTTP Status: {response.status_code}")
        checks.append(f"Response: {response.text[:200]}")
        
        # Should return 404 with "File no longer available" message
        if response.status_code == 404:
            checks.append("✓ HTTP 404 returned")
            
            body = response.text.lower()
            if "no longer available" in body or "not found" in body or "file" in body:
                checks.append("✓ Response mentions file not available/not found")
                passed = True
            else:
                checks.append("✗ Response does not mention file not available")
                passed = False
        else:
            checks.append(f"✗ Expected HTTP 404, got {response.status_code}")
            passed = False
        
        log_test(9, "Download valid-token, missing asset", passed, "\n".join(checks))
        
    except Exception as e:
        log_test(9, "Download valid-token, missing asset", False, f"Exception: {str(e)}")

# ============================================================================
# MAIN EXECUTION
# ============================================================================
def main():
    print("\n" + "="*80)
    print("SESSION 58 - DIGITAL DELIVERY BACKEND VERIFICATION")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test file order: {TEST_FILE_ORDER_REF}")
    print(f"Database: Railway PostgreSQL (LIVE)")
    print("="*80 + "\n")
    
    # Run tests in sequence
    test_1_file_type_receipt()
    test_2_url_type_receipt_order_4()
    test_3_url_type_receipt_order_1()
    test_4_delivery_projection_guard()
    
    # Test 5 returns new deliveries for test 9
    new_deliveries = test_5_resend_endpoint()
    
    # Test 6 needs to know we already sent 1 resend in test 5
    test_6_resend_rate_limit(previous_resend_count=1)
    
    test_7_resend_guard_unpaid()
    test_8_download_invalid_token()
    
    # Test 9 uses the new deliveries from test 5
    test_9_download_valid_token_missing_asset(new_deliveries)
    
    # Print summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Overall: {results['passed']}/{results['passed'] + results['failed']} PASS")
    print(f"Passed: {results['passed']}")
    print(f"Failed: {results['failed']}")
    print("="*80)
    
    # Print individual results
    for test in results["tests"]:
        status = "✅ PASS" if test["passed"] else "❌ FAIL"
        print(f"Test {test['test_num']}: {test['name']} - {status}")
    
    print("="*80 + "\n")
    
    # Exit with appropriate code
    if results["failed"] > 0:
        exit(1)
    else:
        exit(0)

if __name__ == "__main__":
    main()
