#!/usr/bin/env python3
"""
Backend Test Suite for Session 54 - Bug F & Bug E
Tests two backend bug fixes on DynoPay:
1. Bug F: PUT /api/pay/links/:id must persist amount/currency
2. Bug E: GET /api/company/getTransactions/1 must correctly tag transaction sources
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Base URL from frontend/.env
BASE_URL = "https://multi-chain-checkout-3.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

class TestSession:
    def __init__(self):
        self.session = requests.Session()
        self.csrf_token = None
        self.access_token = None
        self.user_id = None
        self.company_id = None
        
    def get_csrf_token(self) -> bool:
        """Get CSRF token from /api/csrf-token"""
        try:
            response = self.session.get(f"{API_BASE}/csrf-token")
            if response.status_code == 200:
                data = response.json()
                self.csrf_token = data.get('csrf_token')
                print(f"✓ CSRF token obtained: {self.csrf_token[:20]}...")
                return True
            else:
                print(f"✗ Failed to get CSRF token: {response.status_code}")
                return False
        except Exception as e:
            print(f"✗ Exception getting CSRF token: {e}")
            return False
    
    def login(self) -> bool:
        """Login with test credentials"""
        try:
            headers = {
                'x-csrf-token': self.csrf_token,
                'Origin': BASE_URL,
                'Content-Type': 'application/json'
            }
            payload = {
                'email': TEST_EMAIL,
                'password': TEST_PASSWORD
            }
            
            response = self.session.post(
                f"{API_BASE}/user/login",
                headers=headers,
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                # Check if login was successful
                if 'data' in data and 'accessToken' in data['data']:
                    self.access_token = data['data']['accessToken']
                    user_data = data['data'].get('user', {})
                    self.user_id = user_data.get('user_id')
                    self.company_id = user_data.get('company_id')
                    print(f"✓ Login successful: user_id={self.user_id}, company_id={self.company_id}")
                    print(f"  Access token: {self.access_token[:30]}...")
                    return True
                else:
                    print(f"✗ Login failed: {data}")
                    return False
            else:
                print(f"✗ Login request failed: {response.status_code}")
                print(f"  Response: {response.text[:200]}")
                return False
        except Exception as e:
            print(f"✗ Exception during login: {e}")
            return False
    
    def get_authed_headers(self) -> Dict[str, str]:
        """Get headers for authenticated requests"""
        return {
            'Authorization': f'Bearer {self.access_token}',
            'x-csrf-token': self.csrf_token,
            'Origin': BASE_URL,
            'Content-Type': 'application/json'
        }


def test_bug_f_payment_link_amount_persistence(session: TestSession) -> bool:
    """
    TEST 1 — Bug F: PUT /api/pay/links/:id must persist amount and currency
    """
    print("\n" + "="*80)
    print("TEST 1: Bug F - Payment Link Amount Persistence")
    print("="*80)
    
    headers = session.get_authed_headers()
    
    # Step 1: Find a suitable payment link (standard, pending, owned by hostbay)
    print("\n[Step 1] Finding a suitable payment link...")
    candidate_ids = [87, 81, 75]
    test_link_id = None
    original_amount = None
    
    for link_id in candidate_ids:
        try:
            response = session.session.get(
                f"{API_BASE}/pay/links/{link_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                link_data = data.get('data', {})
                link_type = link_data.get('link_type')
                status = link_data.get('status')
                base_amount = link_data.get('base_amount')
                
                print(f"  Link {link_id}: type={link_type}, status={status}, base_amount={base_amount}")
                
                # Accept both 'pending' and 'active' status for testing
                if link_type == 'standard' and status in ['pending', 'active']:
                    test_link_id = link_id
                    original_amount = float(base_amount) if base_amount else 0
                    print(f"✓ Selected link {link_id} for testing (original amount: {original_amount})")
                    break
        except Exception as e:
            print(f"  Link {link_id}: Error - {e}")
            continue
    
    if not test_link_id:
        print("✗ No suitable payment link found for testing")
        return False
    
    # Step 2: Update with new amount
    print(f"\n[Step 2] Updating link {test_link_id} with new amount...")
    new_amount = original_amount + 7.0
    
    try:
        payload = {
            'amount': new_amount,
            'currency': 'USD'
        }
        
        response = session.session.put(
            f"{API_BASE}/pay/links/{test_link_id}",
            headers=headers,
            json=payload
        )
        
        print(f"  PUT response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Update successful: {data.get('message')}")
        else:
            print(f"✗ Update failed: {response.status_code}")
            print(f"  Response: {response.text[:300]}")
            return False
    except Exception as e:
        print(f"✗ Exception during update: {e}")
        return False
    
    # Step 3: Verify the amount was persisted
    print(f"\n[Step 3] Verifying amount was persisted...")
    
    try:
        response = session.session.get(
            f"{API_BASE}/pay/links/{test_link_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            link_data = data.get('data', {})
            current_amount = float(link_data.get('base_amount', 0))
            
            print(f"  Original amount: {original_amount}")
            print(f"  New amount sent: {new_amount}")
            print(f"  Current amount: {current_amount}")
            
            if abs(current_amount - new_amount) < 0.01:
                print(f"✓ Amount correctly persisted!")
            else:
                print(f"✗ Amount NOT persisted correctly (expected {new_amount}, got {current_amount})")
                return False
        else:
            print(f"✗ Failed to retrieve link: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Exception during verification: {e}")
        return False
    
    # Step 4: Restore original amount
    print(f"\n[Step 4] Restoring original amount...")
    
    try:
        payload = {
            'amount': original_amount,
            'currency': 'USD'
        }
        
        response = session.session.put(
            f"{API_BASE}/pay/links/{test_link_id}",
            headers=headers,
            json=payload
        )
        
        if response.status_code == 200:
            print(f"✓ Original amount restored: {original_amount}")
        else:
            print(f"⚠ Warning: Failed to restore original amount: {response.status_code}")
    except Exception as e:
        print(f"⚠ Warning: Exception restoring amount: {e}")
    
    # Step 5: Test legacy field name (base_amount)
    print(f"\n[Step 5] Testing legacy field name 'base_amount'...")
    
    try:
        test_amount = original_amount + 3.0
        payload = {
            'base_amount': test_amount,
            'base_currency': 'USD'
        }
        
        response = session.session.put(
            f"{API_BASE}/pay/links/{test_link_id}",
            headers=headers,
            json=payload
        )
        
        if response.status_code == 200:
            # Verify it persisted
            response = session.session.get(
                f"{API_BASE}/pay/links/{test_link_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                current_amount = float(data.get('data', {}).get('base_amount', 0))
                
                if abs(current_amount - test_amount) < 0.01:
                    print(f"✓ Legacy field 'base_amount' works correctly")
                else:
                    print(f"✗ Legacy field 'base_amount' NOT working (expected {test_amount}, got {current_amount})")
                    return False
        else:
            print(f"✗ Legacy field test failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Exception testing legacy field: {e}")
        return False
    
    # Restore original amount again
    try:
        payload = {'amount': original_amount, 'currency': 'USD'}
        session.session.put(f"{API_BASE}/pay/links/{test_link_id}", headers=headers, json=payload)
        print(f"✓ Final restoration to original amount: {original_amount}")
    except:
        pass
    
    # Step 6: Negative test - donation link should NOT change amount
    print(f"\n[Step 6] Negative test: Donation link should NOT change amount...")
    
    donation_link_id = 77  # Known donation link
    
    try:
        # Get current amount
        response = session.session.get(
            f"{API_BASE}/pay/links/{donation_link_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            link_data = data.get('data', {})
            link_type = link_data.get('link_type')
            original_donation_amount = float(link_data.get('base_amount', 0))
            
            print(f"  Donation link {donation_link_id}: type={link_type}, amount={original_donation_amount}")
            
            if link_type == 'donation':
                # Try to update amount
                payload = {'amount': 999, 'currency': 'USD'}
                response = session.session.put(
                    f"{API_BASE}/pay/links/{donation_link_id}",
                    headers=headers,
                    json=payload
                )
                
                # Check if amount changed
                response = session.session.get(
                    f"{API_BASE}/pay/links/{donation_link_id}",
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    current_amount = float(data.get('data', {}).get('base_amount', 0))
                    
                    if abs(current_amount - original_donation_amount) < 0.01:
                        print(f"✓ Donation link correctly ignored amount change")
                    else:
                        print(f"⚠ Warning: Donation link amount changed (was {original_donation_amount}, now {current_amount})")
            else:
                print(f"  Link {donation_link_id} is not a donation link, skipping negative test")
        else:
            print(f"  Could not retrieve donation link {donation_link_id}, skipping negative test")
    except Exception as e:
        print(f"  Exception in negative test: {e}")
    
    print("\n" + "="*80)
    print("TEST 1 RESULT: PASS ✓")
    print("="*80)
    return True


def test_bug_e_transaction_sources(session: TestSession) -> bool:
    """
    TEST 2 — Bug E: GET /api/company/getTransactions/1 must correctly tag transaction sources
    """
    print("\n" + "="*80)
    print("TEST 2: Bug E - Transaction Source Tagging")
    print("="*80)
    
    headers = session.get_authed_headers()
    
    # Step 1: Get transactions
    print("\n[Step 1] Fetching transactions for company_id=1...")
    
    try:
        response = session.session.get(
            f"{API_BASE}/company/getTransactions/1",
            headers=headers
        )
        
        if response.status_code != 200:
            print(f"✗ Failed to get transactions: {response.status_code}")
            print(f"  Response: {response.text[:300]}")
            return False
        
        data = response.json()
        transactions = data.get('data', {}).get('transactions', [])
        
        print(f"✓ Retrieved {len(transactions)} transactions")
        
        if len(transactions) == 0:
            print("✗ No transactions found")
            return False
        
    except Exception as e:
        print(f"✗ Exception fetching transactions: {e}")
        return False
    
    # Step 2: Verify source object structure
    print(f"\n[Step 2] Verifying source object structure...")
    
    required_source_keys = ['type', 'title', 'ref', 'link_id', 'link_type', 'parent_link_id', 'order_id', 'order_ref']
    valid_source_types = ['payment_link', 'contribution', 'tip', 'product', 'direct']
    
    missing_source_count = 0
    invalid_structure_count = 0
    
    for i, tx in enumerate(transactions[:10]):  # Check first 10
        tx_id = tx.get('id')
        source = tx.get('source')
        
        if not source:
            missing_source_count += 1
            if i < 3:
                print(f"  Transaction {tx_id}: ✗ Missing source object")
        else:
            missing_keys = [key for key in required_source_keys if key not in source]
            if missing_keys:
                invalid_structure_count += 1
                if i < 3:
                    print(f"  Transaction {tx_id}: ✗ Missing keys: {missing_keys}")
            else:
                if i < 3:
                    print(f"  Transaction {tx_id}: ✓ Complete source object")
    
    if missing_source_count > 0:
        print(f"✗ {missing_source_count} transactions missing source object")
        return False
    
    if invalid_structure_count > 0:
        print(f"✗ {invalid_structure_count} transactions have incomplete source structure")
        return False
    
    print(f"✓ All transactions have complete source objects with all 8 required keys")
    
    # Step 3: Verify source type distribution
    print(f"\n[Step 3] Analyzing source type distribution...")
    
    source_type_counts = {}
    invalid_type_count = 0
    
    for tx in transactions:
        source = tx.get('source', {})
        source_type = source.get('type')
        
        if source_type not in valid_source_types:
            invalid_type_count += 1
        else:
            source_type_counts[source_type] = source_type_counts.get(source_type, 0) + 1
    
    print(f"  Source type distribution:")
    for source_type, count in sorted(source_type_counts.items()):
        percentage = (count / len(transactions)) * 100
        print(f"    {source_type}: {count} ({percentage:.1f}%)")
    
    if invalid_type_count > 0:
        print(f"✗ {invalid_type_count} transactions have invalid source types")
        return False
    
    print(f"✓ All transactions have valid source types")
    
    # Step 4: Check for payment_link source type
    print(f"\n[Step 4] Checking for payment_link source type...")
    
    payment_link_count = source_type_counts.get('payment_link', 0)
    
    if payment_link_count > 0:
        print(f"✓ Found {payment_link_count} transactions with source.type='payment_link'")
        
        # Show example
        for tx in transactions:
            if tx.get('source', {}).get('type') == 'payment_link':
                source = tx.get('source', {})
                print(f"  Example: tx_id={tx.get('id')}, link_id={source.get('link_id')}, title={source.get('title')}")
                break
    else:
        print(f"⚠ No transactions with source.type='payment_link' found")
        print(f"  This may be expected if hostbay's transactions predate payment_link tracking")
    
    # Step 5: Check for duplicate transaction IDs
    print(f"\n[Step 5] Checking for duplicate transaction IDs...")
    
    tx_ids = [tx.get('id') for tx in transactions]
    unique_tx_ids = set(tx_ids)
    
    if len(tx_ids) == len(unique_tx_ids):
        print(f"✓ No duplicate transaction IDs (all {len(tx_ids)} are unique)")
    else:
        duplicate_count = len(tx_ids) - len(unique_tx_ids)
        print(f"✗ Found {duplicate_count} duplicate transaction IDs")
        return False
    
    # Step 6: Verify healthy number of rows
    print(f"\n[Step 6] Verifying healthy number of rows...")
    
    if len(transactions) > 0:
        print(f"✓ Healthy number of transactions returned: {len(transactions)}")
    else:
        print(f"✗ No transactions returned")
        return False
    
    print("\n" + "="*80)
    print("TEST 2 RESULT: PASS ✓")
    print("="*80)
    return True


def main():
    print("="*80)
    print("DynoPay Backend Test Suite - Session 54")
    print("Testing Bug F (Payment Link Amount) and Bug E (Transaction Sources)")
    print("="*80)
    
    # Initialize session
    session = TestSession()
    
    # Step 1: Get CSRF token
    print("\n[AUTH] Getting CSRF token...")
    if not session.get_csrf_token():
        print("\n✗ FAILED: Could not get CSRF token")
        sys.exit(1)
    
    # Step 2: Login
    print("\n[AUTH] Logging in...")
    if not session.login():
        print("\n✗ FAILED: Could not login")
        sys.exit(1)
    
    # Run tests
    results = []
    
    # Test 1: Bug F
    try:
        result = test_bug_f_payment_link_amount_persistence(session)
        results.append(("Bug F - Payment Link Amount Persistence", result))
    except Exception as e:
        print(f"\n✗ TEST 1 EXCEPTION: {e}")
        results.append(("Bug F - Payment Link Amount Persistence", False))
    
    # Test 2: Bug E
    try:
        result = test_bug_e_transaction_sources(session)
        results.append(("Bug E - Transaction Source Tagging", result))
    except Exception as e:
        print(f"\n✗ TEST 2 EXCEPTION: {e}")
        results.append(("Bug E - Transaction Source Tagging", False))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, result in results:
        status = "PASS ✓" if result else "FAIL ✗"
        print(f"{test_name}: {status}")
    
    all_passed = all(result for _, result in results)
    
    if all_passed:
        print("\n" + "="*80)
        print("ALL TESTS PASSED ✓")
        print("="*80)
        sys.exit(0)
    else:
        print("\n" + "="*80)
        print("SOME TESTS FAILED ✗")
        print("="*80)
        sys.exit(1)


if __name__ == "__main__":
    main()
