#!/usr/bin/env python3
"""
Backend test for BUG E and BUG F verification
Session 54 - Deep fix verification for getTransactions and payment link amount update
"""

import requests
import json
import sys
from typing import Dict, List, Any

BASE_URL = "https://payment-hub-622.preview.emergentagent.com"
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"
COMPANY_ID = 1

class TestResult:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, test_name: str, details: str = ""):
        self.passed.append(f"✅ {test_name}: PASS" + (f" - {details}" if details else ""))
    
    def add_fail(self, test_name: str, details: str):
        self.failed.append(f"❌ {test_name}: FAIL - {details}")
    
    def add_warning(self, test_name: str, details: str):
        self.warnings.append(f"⚠️  {test_name}: WARNING - {details}")
    
    def print_summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        if self.failed:
            print("\n🔴 FAILED TESTS:")
            for fail in self.failed:
                print(f"  {fail}")
        
        if self.warnings:
            print("\n🟡 WARNINGS:")
            for warn in self.warnings:
                print(f"  {warn}")
        
        if self.passed:
            print("\n🟢 PASSED TESTS:")
            for pass_test in self.passed:
                print(f"  {pass_test}")
        
        print("\n" + "="*80)
        total = len(self.passed) + len(self.failed)
        print(f"TOTAL: {len(self.passed)}/{total} tests passed")
        print("="*80 + "\n")
        
        return len(self.failed) == 0

def get_csrf_token(session: requests.Session) -> str:
    """Get CSRF token from the API"""
    print("🔑 Getting CSRF token...")
    resp = session.get(f"{BASE_URL}/api/csrf-token")
    resp.raise_for_status()
    data = resp.json()
    csrf_token = data.get("csrf_token") or data.get("csrfToken")
    print(f"   ✓ CSRF token obtained: {csrf_token[:20]}...")
    return csrf_token

def login(session: requests.Session, csrf_token: str) -> str:
    """Login and get access token"""
    print(f"🔐 Logging in as {EMAIL}...")
    headers = {
        "x-csrf-token": csrf_token,
        "Origin": BASE_URL,
        "Content-Type": "application/json"
    }
    payload = {
        "email": EMAIL,
        "password": PASSWORD
    }
    resp = session.post(f"{BASE_URL}/api/user/login", json=payload, headers=headers)
    resp.raise_for_status()
    data = resp.json()
    access_token = data.get("data", {}).get("accessToken")
    if not access_token:
        raise Exception(f"No accessToken in response: {data}")
    print(f"   ✓ Login successful, token length: {len(access_token)}")
    return access_token

def test_bug_e(session: requests.Session, access_token: str, result: TestResult):
    """
    BUG E — GET /api/company/getTransactions/1
    
    Assert:
    1. Total count > 384 (should be 413)
    2. At least 3 transactions with source.type === "payment_link"
    3. Specific transaction IDs have correct source.type and link_id
    4. No duplicate transaction IDs
    5. HTTP 200 with valid transaction objects
    """
    print("\n" + "="*80)
    print("🧪 TESTING BUG E - getTransactions with payment_link source")
    print("="*80)
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    print(f"\n📡 GET /api/company/getTransactions/{COMPANY_ID}")
    resp = session.get(f"{BASE_URL}/api/company/getTransactions/{COMPANY_ID}", headers=headers)
    
    # Test 1: HTTP 200
    if resp.status_code != 200:
        result.add_fail("BUG E - HTTP Status", f"Expected 200, got {resp.status_code}")
        print(f"   Response: {resp.text[:500]}")
        return
    result.add_pass("BUG E - HTTP Status", "200 OK")
    
    data = resp.json()
    transactions = data.get("data", {}).get("transactions", [])
    
    if not transactions:
        result.add_fail("BUG E - Response Structure", "No transactions array in response")
        return
    
    print(f"\n📊 Total transactions returned: {len(transactions)}")
    
    # Test 2: Total count > 384 (should be 413)
    if len(transactions) <= 384:
        result.add_fail("BUG E - Transaction Count", 
                       f"Expected > 384 (ideally 413), got {len(transactions)}")
    elif len(transactions) == 413:
        result.add_pass("BUG E - Transaction Count", f"Exactly 413 as expected")
    else:
        result.add_pass("BUG E - Transaction Count", 
                       f"{len(transactions)} (> 384, expected 413)")
        result.add_warning("BUG E - Transaction Count", 
                          f"Got {len(transactions)} instead of expected 413")
    
    # Test 3: Check source.type distribution
    source_types = {}
    payment_link_txs = []
    
    for tx in transactions:
        if "source" not in tx:
            result.add_fail("BUG E - Source Object", f"Transaction {tx.get('id')} missing source object")
            continue
        
        source = tx["source"]
        source_type = source.get("type", "unknown")
        source_types[source_type] = source_types.get(source_type, 0) + 1
        
        if source_type == "payment_link":
            payment_link_txs.append({
                "id": tx.get("id"),
                "link_id": source.get("link_id"),
                "title": source.get("title"),
                "ref": source.get("ref")
            })
    
    print(f"\n📈 Source type distribution:")
    for stype, count in sorted(source_types.items(), key=lambda x: -x[1]):
        percentage = (count / len(transactions)) * 100
        print(f"   {stype}: {count} ({percentage:.1f}%)")
    
    # Test 4: At least 3 payment_link transactions
    payment_link_count = source_types.get("payment_link", 0)
    if payment_link_count < 3:
        result.add_fail("BUG E - Payment Link Count", 
                       f"Expected at least 3 payment_link transactions, got {payment_link_count}")
    else:
        result.add_pass("BUG E - Payment Link Count", 
                       f"{payment_link_count} payment_link transactions found")
    
    # Test 5: Check specific transaction IDs
    expected_payment_links = {
        "a404a62b-d9f8-46e1-89f8-2d76ee7b80fc": 1,
        "8f95581c-2aca-4b66-a265-9dfaf7f1719d": 2,
        "1c0885d6-b0bc-47d8-b3e4-1dda8b68b464": 83
    }
    
    print(f"\n🔍 Checking specific transaction IDs:")
    for tx_id, expected_link_id in expected_payment_links.items():
        found = False
        for tx in transactions:
            if tx.get("id") == tx_id:
                found = True
                source = tx.get("source", {})
                actual_type = source.get("type")
                actual_link_id = source.get("link_id")
                
                print(f"   Transaction {tx_id[:8]}...")
                print(f"      source.type: {actual_type}")
                print(f"      source.link_id: {actual_link_id}")
                print(f"      source.title: {source.get('title', 'N/A')}")
                
                if actual_type != "payment_link":
                    result.add_fail(f"BUG E - TX {tx_id[:8]} Type", 
                                   f"Expected 'payment_link', got '{actual_type}'")
                elif actual_link_id != expected_link_id:
                    result.add_fail(f"BUG E - TX {tx_id[:8]} Link ID", 
                                   f"Expected link_id={expected_link_id}, got {actual_link_id}")
                else:
                    result.add_pass(f"BUG E - TX {tx_id[:8]}", 
                                   f"Correct source.type='payment_link' and link_id={expected_link_id}")
                break
        
        if not found:
            result.add_fail(f"BUG E - TX {tx_id[:8]} Missing", 
                           f"Transaction {tx_id} not found in response")
    
    # Test 6: No duplicate transaction IDs
    tx_ids = [tx.get("id") for tx in transactions]
    unique_ids = set(tx_ids)
    
    if len(tx_ids) != len(unique_ids):
        duplicates = [tid for tid in tx_ids if tx_ids.count(tid) > 1]
        result.add_fail("BUG E - Duplicate IDs", 
                       f"Found {len(tx_ids) - len(unique_ids)} duplicate transaction IDs: {set(duplicates)}")
    else:
        result.add_pass("BUG E - No Duplicates", "All transaction IDs are unique")
    
    # Test 7: Valid transaction objects
    sample_tx = transactions[0] if transactions else None
    if sample_tx:
        required_fields = ["id", "base_amount", "status", "source"]
        missing_fields = [f for f in required_fields if f not in sample_tx]
        
        if missing_fields:
            result.add_fail("BUG E - Transaction Structure", 
                           f"Sample transaction missing fields: {missing_fields}")
        else:
            result.add_pass("BUG E - Transaction Structure", 
                           "All required fields present (id, base_amount, status, source)")

def test_bug_f(session: requests.Session, access_token: str, csrf_token: str, result: TestResult):
    """
    BUG F — PUT /api/pay/links/87 amount update
    
    Steps:
    1. GET current amount
    2. PUT amount=9
    3. GET verify amount=9
    4. PUT restore to 5
    5. GET verify amount=5
    """
    print("\n" + "="*80)
    print("🧪 TESTING BUG F - Payment link amount update")
    print("="*80)
    
    link_id = 87
    headers = {
        "Authorization": f"Bearer {access_token}",
        "x-csrf-token": csrf_token,
        "Origin": BASE_URL,
        "Content-Type": "application/json"
    }
    
    # Step 1: Get current amount
    print(f"\n📡 GET /api/pay/links/{link_id}")
    resp = session.get(f"{BASE_URL}/api/pay/links/{link_id}", 
                       headers={"Authorization": f"Bearer {access_token}"})
    
    if resp.status_code != 200:
        result.add_fail("BUG F - Initial GET", f"Expected 200, got {resp.status_code}")
        print(f"   Response: {resp.text[:500]}")
        return
    
    initial_data = resp.json()
    initial_amount = initial_data.get("data", {}).get("base_amount")
    print(f"   ✓ Current base_amount: {initial_amount}")
    
    # Step 2: Update to 9
    print(f"\n📡 PUT /api/pay/links/{link_id} (amount=9)")
    payload = {
        "amount": 9,
        "currency": "USD"
    }
    resp = session.put(f"{BASE_URL}/api/pay/links/{link_id}", json=payload, headers=headers)
    
    if resp.status_code != 200:
        result.add_fail("BUG F - PUT amount=9", 
                       f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
        return
    
    result.add_pass("BUG F - PUT amount=9", "200 OK")
    print(f"   ✓ Update response: {resp.json().get('message', 'OK')}")
    
    # Step 3: Verify amount=9
    print(f"\n📡 GET /api/pay/links/{link_id} (verify amount=9)")
    resp = session.get(f"{BASE_URL}/api/pay/links/{link_id}", 
                       headers={"Authorization": f"Bearer {access_token}"})
    
    if resp.status_code != 200:
        result.add_fail("BUG F - GET after update", f"Expected 200, got {resp.status_code}")
        return
    
    updated_data = resp.json()
    updated_amount = updated_data.get("data", {}).get("base_amount")
    print(f"   Current base_amount: {updated_amount}")
    
    if updated_amount == 9:
        result.add_pass("BUG F - Verify amount=9", f"base_amount correctly updated to 9")
    else:
        result.add_fail("BUG F - Verify amount=9", 
                       f"Expected base_amount=9, got {updated_amount}")
        return
    
    # Step 4: Restore to 5
    print(f"\n📡 PUT /api/pay/links/{link_id} (restore to amount=5)")
    payload = {
        "amount": 5,
        "currency": "USD"
    }
    resp = session.put(f"{BASE_URL}/api/pay/links/{link_id}", json=payload, headers=headers)
    
    if resp.status_code != 200:
        result.add_fail("BUG F - PUT restore amount=5", 
                       f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
        return
    
    result.add_pass("BUG F - PUT restore amount=5", "200 OK")
    print(f"   ✓ Restore response: {resp.json().get('message', 'OK')}")
    
    # Step 5: Verify amount=5
    print(f"\n📡 GET /api/pay/links/{link_id} (verify restored to 5)")
    resp = session.get(f"{BASE_URL}/api/pay/links/{link_id}", 
                       headers={"Authorization": f"Bearer {access_token}"})
    
    if resp.status_code != 200:
        result.add_fail("BUG F - GET after restore", f"Expected 200, got {resp.status_code}")
        return
    
    restored_data = resp.json()
    restored_amount = restored_data.get("data", {}).get("base_amount")
    print(f"   Current base_amount: {restored_amount}")
    
    if restored_amount == 5:
        result.add_pass("BUG F - Verify restored to 5", f"base_amount correctly restored to 5")
    else:
        result.add_fail("BUG F - Verify restored to 5", 
                       f"Expected base_amount=5, got {restored_amount}")

def main():
    print("="*80)
    print("BACKEND TEST - BUG E & F VERIFICATION")
    print("Session 54 - Deep fix verification")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Account: {EMAIL}")
    print(f"Company ID: {COMPANY_ID}")
    print("="*80)
    
    result = TestResult()
    session = requests.Session()
    
    try:
        # Auth flow
        csrf_token = get_csrf_token(session)
        access_token = login(session, csrf_token)
        
        # Test BUG E
        test_bug_e(session, access_token, result)
        
        # Test BUG F
        test_bug_f(session, access_token, csrf_token, result)
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        result.add_fail("Test Execution", str(e))
    
    # Print summary
    success = result.print_summary()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
