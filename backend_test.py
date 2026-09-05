#!/usr/bin/env python3
"""
Backend test for QA Quality Center API endpoints.
Tests all /api/quality/* endpoints with proper passcode authentication.
"""

import requests
import json
import sys
from typing import Dict, Any, List

# Base URL for the backend
BASE_URL = "http://localhost:8001"

# QA passcode (shared secret)
QA_PASSCODE = "Dynopay123@"

# Headers with correct passcode
HEADERS_WITH_PASSCODE = {
    "x-qa-passcode": QA_PASSCODE,
    "Content-Type": "application/json"
}

# Headers without passcode (for negative testing)
HEADERS_WITHOUT_PASSCODE = {
    "Content-Type": "application/json"
}

# Headers with wrong passcode (for negative testing)
HEADERS_WRONG_PASSCODE = {
    "x-qa-passcode": "WrongPassword123",
    "Content-Type": "application/json"
}

# Track created items for cleanup
created_comment_ids: List[int] = []
created_custom_ids: List[int] = []

def log_test(test_name: str, status: str, details: str = ""):
    """Log test results"""
    symbol = "✓" if status == "PASS" else "✗"
    print(f"{symbol} {test_name}: {status}")
    if details:
        print(f"  {details}")

def test_auth_with_correct_passcode():
    """Test 1: POST /api/quality/auth with correct passcode"""
    try:
        response = requests.post(
            f"{BASE_URL}/api/quality/auth",
            headers=HEADERS_WITH_PASSCODE,
            json={}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") == True:
                log_test("Auth with correct passcode", "PASS", f"Status: {response.status_code}, Response: {data}")
                return True
            else:
                log_test("Auth with correct passcode", "FAIL", f"Expected ok:true, got: {data}")
                return False
        else:
            log_test("Auth with correct passcode", "FAIL", f"Expected 200, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        log_test("Auth with correct passcode", "FAIL", f"Exception: {str(e)}")
        return False

def test_auth_without_passcode():
    """Test 2: POST /api/quality/auth without passcode (should fail)"""
    try:
        response = requests.post(
            f"{BASE_URL}/api/quality/auth",
            headers=HEADERS_WITHOUT_PASSCODE,
            json={}
        )
        
        if response.status_code in [401, 403]:
            log_test("Auth without passcode (should reject)", "PASS", f"Status: {response.status_code} (correctly rejected)")
            return True
        else:
            log_test("Auth without passcode (should reject)", "FAIL", f"Expected 401/403, got {response.status_code}")
            return False
    except Exception as e:
        log_test("Auth without passcode (should reject)", "FAIL", f"Exception: {str(e)}")
        return False

def test_auth_with_wrong_passcode():
    """Test 3: POST /api/quality/auth with wrong passcode (should fail)"""
    try:
        response = requests.post(
            f"{BASE_URL}/api/quality/auth",
            headers=HEADERS_WRONG_PASSCODE,
            json={}
        )
        
        if response.status_code in [401, 403]:
            log_test("Auth with wrong passcode (should reject)", "PASS", f"Status: {response.status_code} (correctly rejected)")
            return True
        else:
            log_test("Auth with wrong passcode (should reject)", "FAIL", f"Expected 401/403, got {response.status_code}")
            return False
    except Exception as e:
        log_test("Auth with wrong passcode (should reject)", "FAIL", f"Exception: {str(e)}")
        return False

def test_get_data_without_passcode():
    """Test 4: GET /api/quality/data without passcode (should fail)"""
    try:
        response = requests.get(
            f"{BASE_URL}/api/quality/data",
            headers=HEADERS_WITHOUT_PASSCODE
        )
        
        if response.status_code in [401, 403]:
            log_test("GET /data without passcode (should reject)", "PASS", f"Status: {response.status_code} (correctly rejected)")
            return True
        else:
            log_test("GET /data without passcode (should reject)", "FAIL", f"Expected 401/403, got {response.status_code}")
            return False
    except Exception as e:
        log_test("GET /data without passcode (should reject)", "FAIL", f"Exception: {str(e)}")
        return False

def test_get_data_with_passcode():
    """Test 5: GET /api/quality/data with correct passcode"""
    try:
        response = requests.get(
            f"{BASE_URL}/api/quality/data",
            headers=HEADERS_WITH_PASSCODE
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") == True and "commentsByItem" in data and "customItems" in data:
                log_test("GET /data with passcode", "PASS", f"Status: {response.status_code}, Keys: {list(data.keys())}")
                return True, data
            else:
                log_test("GET /data with passcode", "FAIL", f"Missing expected keys in response: {data}")
                return False, None
        else:
            log_test("GET /data with passcode", "FAIL", f"Expected 200, got {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        log_test("GET /data with passcode", "FAIL", f"Exception: {str(e)}")
        return False, None

def test_create_comment():
    """Test 6: POST /api/quality/comment - create a test comment"""
    try:
        comment_data = {
            "item_key": "public::1.1",
            "section_id": "public",
            "section_title": "Public Pages",
            "case_title": "Landing Page",
            "tester": "Backend Tester",
            "status": "fail",
            "note": "Test note from backend tester - automated test"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/quality/comment",
            headers=HEADERS_WITH_PASSCODE,
            json=comment_data
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") == True and "comment" in data:
                comment = data["comment"]
                comment_id = comment.get("id")
                if comment_id:
                    created_comment_ids.append(comment_id)
                    log_test("POST /comment (create)", "PASS", f"Created comment ID: {comment_id}")
                    return True, comment_id
                else:
                    log_test("POST /comment (create)", "FAIL", f"No ID in response: {data}")
                    return False, None
            else:
                log_test("POST /comment (create)", "FAIL", f"Unexpected response: {data}")
                return False, None
        else:
            log_test("POST /comment (create)", "FAIL", f"Expected 200, got {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        log_test("POST /comment (create)", "FAIL", f"Exception: {str(e)}")
        return False, None

def test_comment_appears_in_data(comment_id: int):
    """Test 7: Verify created comment appears in GET /api/quality/data"""
    try:
        response = requests.get(
            f"{BASE_URL}/api/quality/data",
            headers=HEADERS_WITH_PASSCODE
        )
        
        if response.status_code == 200:
            data = response.json()
            comments_by_item = data.get("commentsByItem", {})
            
            # Look for our comment in public::1.1
            public_comments = comments_by_item.get("public::1.1", [])
            found = any(c.get("id") == comment_id for c in public_comments)
            
            if found:
                log_test("Comment appears in GET /data", "PASS", f"Comment ID {comment_id} found in commentsByItem['public::1.1']")
                return True
            else:
                log_test("Comment appears in GET /data", "FAIL", f"Comment ID {comment_id} not found in data")
                return False
        else:
            log_test("Comment appears in GET /data", "FAIL", f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        log_test("Comment appears in GET /data", "FAIL", f"Exception: {str(e)}")
        return False

def test_create_comment_with_bad_status():
    """Test 8: POST /api/quality/comment with invalid status (should coerce to not_tested)"""
    try:
        comment_data = {
            "item_key": "public::1.2",
            "section_id": "public",
            "section_title": "Public Pages",
            "case_title": "Pricing Page",
            "tester": "Backend Tester",
            "status": "invalid_status_xyz",
            "note": "Testing status coercion"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/quality/comment",
            headers=HEADERS_WITH_PASSCODE,
            json=comment_data
        )
        
        if response.status_code == 200:
            data = response.json()
            comment = data.get("comment", {})
            status = comment.get("status")
            comment_id = comment.get("id")
            
            if comment_id:
                created_comment_ids.append(comment_id)
            
            if status == "not_tested":
                log_test("POST /comment with bad status (coercion)", "PASS", f"Status coerced to 'not_tested'")
                return True
            else:
                log_test("POST /comment with bad status (coercion)", "FAIL", f"Expected 'not_tested', got '{status}'")
                return False
        else:
            log_test("POST /comment with bad status (coercion)", "FAIL", f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        log_test("POST /comment with bad status (coercion)", "FAIL", f"Exception: {str(e)}")
        return False

def test_create_comment_without_item_key():
    """Test 9: POST /api/quality/comment without item_key (should fail with 400)"""
    try:
        comment_data = {
            "section_id": "public",
            "tester": "Backend Tester",
            "status": "pass",
            "note": "Missing item_key"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/quality/comment",
            headers=HEADERS_WITH_PASSCODE,
            json=comment_data
        )
        
        if response.status_code == 400:
            log_test("POST /comment without item_key (should reject)", "PASS", f"Status: {response.status_code} (correctly rejected)")
            return True
        else:
            log_test("POST /comment without item_key (should reject)", "FAIL", f"Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        log_test("POST /comment without item_key (should reject)", "FAIL", f"Exception: {str(e)}")
        return False

def test_create_custom_item():
    """Test 10: POST /api/quality/custom - create a custom test item"""
    try:
        custom_data = {
            "area": "Payments",
            "title": "Refund via TRC20",
            "description": "Verify refund flow for TRC20 USDT payments",
            "created_by": "Backend Tester"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/quality/custom",
            headers=HEADERS_WITH_PASSCODE,
            json=custom_data
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") == True and "item" in data:
                item = data["item"]
                item_id = item.get("id")
                item_key = item.get("item_key")
                
                if item_id and item_key and item_key.startswith("custom::"):
                    created_custom_ids.append(item_id)
                    expected_key = f"custom::{item_id}"
                    if item_key == expected_key:
                        log_test("POST /custom (create)", "PASS", f"Created custom item ID: {item_id}, item_key: {item_key}")
                        return True, item_id, item_key
                    else:
                        log_test("POST /custom (create)", "FAIL", f"item_key mismatch: expected {expected_key}, got {item_key}")
                        return False, None, None
                else:
                    log_test("POST /custom (create)", "FAIL", f"Missing or invalid ID/item_key: {item}")
                    return False, None, None
            else:
                log_test("POST /custom (create)", "FAIL", f"Unexpected response: {data}")
                return False, None, None
        else:
            log_test("POST /custom (create)", "FAIL", f"Expected 200, got {response.status_code}: {response.text}")
            return False, None, None
    except Exception as e:
        log_test("POST /custom (create)", "FAIL", f"Exception: {str(e)}")
        return False, None, None

def test_custom_item_appears_in_data(item_key: str):
    """Test 11: Verify custom item appears in GET /api/quality/data"""
    try:
        response = requests.get(
            f"{BASE_URL}/api/quality/data",
            headers=HEADERS_WITH_PASSCODE
        )
        
        if response.status_code == 200:
            data = response.json()
            custom_items = data.get("customItems", [])
            
            found = any(item.get("item_key") == item_key for item in custom_items)
            
            if found:
                log_test("Custom item appears in GET /data", "PASS", f"Custom item {item_key} found in customItems")
                return True
            else:
                log_test("Custom item appears in GET /data", "FAIL", f"Custom item {item_key} not found")
                return False
        else:
            log_test("Custom item appears in GET /data", "FAIL", f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        log_test("Custom item appears in GET /data", "FAIL", f"Exception: {str(e)}")
        return False

def test_create_custom_item_without_title():
    """Test 12: POST /api/quality/custom without title (should fail with 400)"""
    try:
        custom_data = {
            "area": "Payments",
            "description": "Missing title",
            "created_by": "Backend Tester"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/quality/custom",
            headers=HEADERS_WITH_PASSCODE,
            json=custom_data
        )
        
        if response.status_code == 400:
            log_test("POST /custom without title (should reject)", "PASS", f"Status: {response.status_code} (correctly rejected)")
            return True
        else:
            log_test("POST /custom without title (should reject)", "FAIL", f"Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        log_test("POST /custom without title (should reject)", "FAIL", f"Exception: {str(e)}")
        return False

def test_export_csv():
    """Test 13: GET /api/quality/export?format=csv"""
    try:
        response = requests.get(
            f"{BASE_URL}/api/quality/export?format=csv",
            headers=HEADERS_WITH_PASSCODE
        )
        
        if response.status_code == 200:
            content_type = response.headers.get("Content-Type", "")
            if "text/csv" in content_type:
                content = response.text
                # Check for CSV header row
                if "id,item_key,section_title,case_title,status,tester,note,created_at" in content:
                    log_test("GET /export?format=csv", "PASS", f"CSV export successful, {len(content)} bytes")
                    return True
                else:
                    log_test("GET /export?format=csv", "FAIL", f"CSV header not found in response")
                    return False
            else:
                log_test("GET /export?format=csv", "FAIL", f"Expected text/csv, got {content_type}")
                return False
        else:
            log_test("GET /export?format=csv", "FAIL", f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        log_test("GET /export?format=csv", "FAIL", f"Exception: {str(e)}")
        return False

def test_export_json():
    """Test 14: GET /api/quality/export?format=json"""
    try:
        response = requests.get(
            f"{BASE_URL}/api/quality/export?format=json",
            headers=HEADERS_WITH_PASSCODE
        )
        
        if response.status_code == 200:
            content_type = response.headers.get("Content-Type", "")
            if "application/json" in content_type:
                data = response.json()
                if "comments" in data and "exported_at" in data:
                    log_test("GET /export?format=json", "PASS", f"JSON export successful, {len(data['comments'])} comments")
                    return True
                else:
                    log_test("GET /export?format=json", "FAIL", f"Missing expected keys in JSON: {list(data.keys())}")
                    return False
            else:
                log_test("GET /export?format=json", "FAIL", f"Expected application/json, got {content_type}")
                return False
        else:
            log_test("GET /export?format=json", "FAIL", f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        log_test("GET /export?format=json", "FAIL", f"Exception: {str(e)}")
        return False

def test_delete_comment(comment_id: int):
    """Test 15: DELETE /api/quality/comment/:id"""
    try:
        response = requests.delete(
            f"{BASE_URL}/api/quality/comment/{comment_id}",
            headers=HEADERS_WITH_PASSCODE
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") == True and data.get("deleted") >= 1:
                log_test(f"DELETE /comment/{comment_id}", "PASS", f"Deleted {data.get('deleted')} row(s)")
                return True
            else:
                log_test(f"DELETE /comment/{comment_id}", "FAIL", f"Unexpected response: {data}")
                return False
        else:
            log_test(f"DELETE /comment/{comment_id}", "FAIL", f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        log_test(f"DELETE /comment/{comment_id}", "FAIL", f"Exception: {str(e)}")
        return False

def test_delete_custom_item(custom_id: int):
    """Test 16: DELETE /api/quality/custom/:id"""
    try:
        response = requests.delete(
            f"{BASE_URL}/api/quality/custom/{custom_id}",
            headers=HEADERS_WITH_PASSCODE
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") == True:
                log_test(f"DELETE /custom/{custom_id}", "PASS", f"Deleted {data.get('deleted')} row(s)")
                return True
            else:
                log_test(f"DELETE /custom/{custom_id}", "FAIL", f"Unexpected response: {data}")
                return False
        else:
            log_test(f"DELETE /custom/{custom_id}", "FAIL", f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        log_test(f"DELETE /custom/{custom_id}", "FAIL", f"Exception: {str(e)}")
        return False

def verify_cleanup():
    """Test 17: Verify all created items are deleted"""
    try:
        response = requests.get(
            f"{BASE_URL}/api/quality/data",
            headers=HEADERS_WITH_PASSCODE
        )
        
        if response.status_code == 200:
            data = response.json()
            comments_by_item = data.get("commentsByItem", {})
            custom_items = data.get("customItems", [])
            
            # Check if any of our created comments still exist
            all_comments = []
            for item_comments in comments_by_item.values():
                all_comments.extend(item_comments)
            
            remaining_comment_ids = [c.get("id") for c in all_comments if c.get("id") in created_comment_ids]
            remaining_custom_ids = [item.get("id") for item in custom_items if item.get("id") in created_custom_ids]
            
            if not remaining_comment_ids and not remaining_custom_ids:
                log_test("Cleanup verification", "PASS", "All created items successfully deleted")
                return True
            else:
                log_test("Cleanup verification", "FAIL", f"Remaining comments: {remaining_comment_ids}, customs: {remaining_custom_ids}")
                return False
        else:
            log_test("Cleanup verification", "FAIL", f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        log_test("Cleanup verification", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("=" * 80)
    print("QA QUALITY CENTER BACKEND API TEST")
    print("=" * 80)
    print()
    
    results = []
    
    # Test 1-3: Auth endpoint
    print("--- Authentication Tests ---")
    results.append(test_auth_with_correct_passcode())
    results.append(test_auth_without_passcode())
    results.append(test_auth_with_wrong_passcode())
    print()
    
    # Test 4-5: GET /data endpoint
    print("--- GET /data Tests ---")
    results.append(test_get_data_without_passcode())
    success, initial_data = test_get_data_with_passcode()
    results.append(success)
    print()
    
    # Test 6-9: POST /comment endpoint
    print("--- POST /comment Tests ---")
    success, comment_id = test_create_comment()
    results.append(success)
    if comment_id:
        results.append(test_comment_appears_in_data(comment_id))
    else:
        results.append(False)
    results.append(test_create_comment_with_bad_status())
    results.append(test_create_comment_without_item_key())
    print()
    
    # Test 10-12: POST /custom endpoint
    print("--- POST /custom Tests ---")
    success, custom_id, item_key = test_create_custom_item()
    results.append(success)
    if item_key:
        results.append(test_custom_item_appears_in_data(item_key))
    else:
        results.append(False)
    results.append(test_create_custom_item_without_title())
    print()
    
    # Test 13-14: Export endpoints
    print("--- Export Tests ---")
    results.append(test_export_csv())
    results.append(test_export_json())
    print()
    
    # Test 15-16: Delete endpoints (cleanup)
    print("--- Delete Tests (Cleanup) ---")
    for cid in created_comment_ids:
        results.append(test_delete_comment(cid))
    for cid in created_custom_ids:
        results.append(test_delete_custom_item(cid))
    print()
    
    # Test 17: Verify cleanup
    print("--- Cleanup Verification ---")
    results.append(verify_cleanup())
    print()
    
    # Summary
    print("=" * 80)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"SUMMARY: {passed}/{total} tests passed")
    print("=" * 80)
    
    if passed == total:
        print("✓ ALL TESTS PASSED")
        return 0
    else:
        print(f"✗ {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
