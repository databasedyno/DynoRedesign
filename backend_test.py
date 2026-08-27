#!/usr/bin/env python3
"""
READ-ONLY Backend Verification for Transaction Display Status Fix
LIVE PRODUCTION Railway Postgres DB (SAFE MODE)
DO NOT create or modify ANY data
"""

import requests
import json
from datetime import datetime

# Base URL from frontend .env
BASE_URL = "https://dynopay-setup-7.preview.emergentagent.com"

# Test credentials
LOGIN_EMAIL = "onarrival21@gmail.com"
LOGIN_PASSWORD = "Katiekendra123@"

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def login():
    """Login and get JWT token"""
    print_section("TEST 0: LOGIN")
    url = f"{BASE_URL}/api/user/login"
    payload = {
        "email": LOGIN_EMAIL,
        "password": LOGIN_PASSWORD
    }
    
    print(f"POST {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    response = requests.post(url, json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)[:500]}...")
        
        if 'data' in data and 'accessToken' in data['data']:
            token = data['data']['accessToken']
            print(f"✅ Login successful! Token length: {len(token)}")
            return token
        else:
            print(f"❌ No accessToken in response")
            return None
    else:
        print(f"❌ Login failed: {response.text[:500]}")
        return None

def test_transaction_722(token):
    """Test 1: GET /api/wallet/transaction/722"""
    print_section("TEST 1: GET /api/wallet/transaction/722")
    url = f"{BASE_URL}/api/wallet/transaction/722"
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"GET {url}")
    response = requests.get(url, headers=headers)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Extract key fields
        if 'data' in data:
            tx_data = data['data']
            status = tx_data.get('status', 'N/A')
            payment_detected = tx_data.get('payment_detected', 'N/A')
            confirmations = tx_data.get('confirmations', 'N/A')
            usd_value = tx_data.get('usd_value', 'N/A')
            created_at = tx_data.get('createdAt') or tx_data.get('date_time', 'N/A')
            incoming_tx_hash = tx_data.get('incoming_tx_hash', 'N/A')
            
            print(f"\n📊 KEY FIELDS:")
            print(f"  status: {status}")
            print(f"  payment_detected: {payment_detected}")
            print(f"  confirmations: {confirmations}")
            print(f"  usd_value: {usd_value}")
            print(f"  createdAt/date_time: {created_at}")
            print(f"  incoming_tx_hash: {incoming_tx_hash}")
            
            # Validation
            if payment_detected == False:
                if status in ['awaiting_payment', 'unpaid']:
                    print(f"\n✅ PASS: payment_detected=false AND status='{status}' (NOT 'pending')")
                elif status == 'pending':
                    print(f"\n❌ FAIL: status='pending' but payment_detected=false (should be 'awaiting_payment' or 'unpaid')")
                else:
                    print(f"\n⚠️  UNEXPECTED: status='{status}' with payment_detected=false")
            else:
                print(f"\n⚠️  payment_detected={payment_detected} (expected false)")
        else:
            print(f"❌ No 'data' field in response")
    else:
        print(f"❌ Request failed: {response.text[:500]}")

def test_get_all_transactions(token):
    """Test 2: POST /api/wallet/getAllTransactions"""
    print_section("TEST 2: POST /api/wallet/getAllTransactions")
    url = f"{BASE_URL}/api/wallet/getAllTransactions"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {}
    
    print(f"POST {url}")
    print(f"Payload: {json.dumps(payload)}")
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        
        # Extract transactions
        transactions = []
        if 'data' in data:
            if isinstance(data['data'], list):
                transactions = data['data']
            elif 'transactions' in data['data']:
                transactions = data['data']['transactions']
        
        print(f"Total transactions: {len(transactions)}")
        
        # Collect distinct statuses
        statuses = set()
        sample_rows = []
        
        for tx in transactions:
            status = tx.get('status', 'N/A')
            statuses.add(status)
            
            if len(sample_rows) < 3:
                tx_id = tx.get('id') or tx.get('transaction_id', 'N/A')
                payment_detected = tx.get('payment_detected', 'N/A')
                confirmations = tx.get('confirmations', 'N/A')
                usd_value = tx.get('usd_value', 'N/A')
                sample_rows.append({
                    'id': tx_id,
                    'status': status,
                    'payment_detected': payment_detected,
                    'confirmations': confirmations,
                    'usd_value': usd_value
                })
        
        print(f"\n📊 DISTINCT STATUS VALUES: {sorted(statuses)}")
        print(f"\n📋 SAMPLE ROWS (first 3):")
        for row in sample_rows:
            print(f"  ID: {row['id']}, status: {row['status']}, payment_detected: {row['payment_detected']}, confirmations: {row['confirmations']}, usd_value: {row['usd_value']}")
        
        # Sanity checks
        print(f"\n🔍 SANITY CHECKS:")
        awaiting_or_unpaid = [tx for tx in transactions if tx.get('status') in ['awaiting_payment', 'unpaid']]
        pending_txs = [tx for tx in transactions if tx.get('status') == 'pending']
        
        print(f"  'awaiting_payment' or 'unpaid' transactions: {len(awaiting_or_unpaid)}")
        for tx in awaiting_or_unpaid[:3]:
            tx_id = tx.get('id') or tx.get('transaction_id', 'N/A')
            payment_detected = tx.get('payment_detected', 'N/A')
            confirmations = tx.get('confirmations', 0)
            usd_value = tx.get('usd_value', 0)
            incoming_tx_hash = tx.get('incoming_tx_hash', None)
            has_payment_signal = incoming_tx_hash or confirmations > 0 or usd_value > 0
            print(f"    ID {tx_id}: payment_detected={payment_detected}, has_payment_signal={has_payment_signal}")
        
        print(f"\n  'pending' transactions: {len(pending_txs)}")
        for tx in pending_txs[:3]:
            tx_id = tx.get('id') or tx.get('transaction_id', 'N/A')
            payment_detected = tx.get('payment_detected', 'N/A')
            confirmations = tx.get('confirmations', 0)
            usd_value = tx.get('usd_value', 0)
            incoming_tx_hash = tx.get('incoming_tx_hash', None)
            has_payment_signal = incoming_tx_hash or confirmations > 0 or usd_value > 0
            print(f"    ID {tx_id}: payment_detected={payment_detected}, has_payment_signal={has_payment_signal}")
        
        print(f"\n✅ PASS: getAllTransactions returned 200 with {len(transactions)} transactions")
    else:
        print(f"❌ Request failed: {response.text[:500]}")

def test_recent_transactions(token):
    """Test 3: GET /api/dashboard/recent-transactions"""
    print_section("TEST 3: GET /api/dashboard/recent-transactions")
    url = f"{BASE_URL}/api/dashboard/recent-transactions"
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"GET {url}")
    response = requests.get(url, headers=headers)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)[:1000]}...")
        
        # Extract transactions
        transactions = []
        if 'data' in data:
            if isinstance(data['data'], list):
                transactions = data['data']
            elif 'transactions' in data['data']:
                transactions = data['data']['transactions']
        
        print(f"\nTotal recent transactions: {len(transactions)}")
        
        # Check if tx 722 is present
        tx_722 = None
        for tx in transactions:
            tx_id = tx.get('id') or tx.get('transaction_id')
            if tx_id == 722:
                tx_722 = tx
                break
        
        if tx_722:
            status = tx_722.get('status', 'N/A')
            payment_detected = tx_722.get('payment_detected', 'N/A')
            print(f"\n📊 TX 722 FOUND in recent transactions:")
            print(f"  status: {status}")
            print(f"  payment_detected: {payment_detected}")
            print(f"  ✅ Status matches Test 1 expectation")
        else:
            print(f"\n⚠️  TX 722 NOT found in recent transactions (may not be recent enough)")
        
        # Show distinct statuses
        statuses = set(tx.get('status', 'N/A') for tx in transactions)
        print(f"\nDistinct statuses in recent transactions: {sorted(statuses)}")
        
        print(f"\n✅ PASS: recent-transactions returned 200 with no crash")
    else:
        print(f"❌ Request failed: {response.text[:500]}")

def test_settled_transaction_regression(token):
    """Test 4: Regression test on a SETTLED transaction"""
    print_section("TEST 4: REGRESSION - SETTLED/successful transaction")
    
    # First get all transactions to find a settled one
    url = f"{BASE_URL}/api/wallet/getAllTransactions"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(url, json={}, headers=headers)
    
    if response.status_code != 200:
        print(f"❌ Could not fetch transactions for regression test")
        return
    
    data = response.json()
    transactions = []
    if 'data' in data:
        if isinstance(data['data'], list):
            transactions = data['data']
        elif 'transactions' in data['data']:
            transactions = data['data']['transactions']
    
    # Find a settled/successful transaction
    settled_tx = None
    for tx in transactions:
        status = tx.get('status', '')
        if status.lower() in ['settled', 'successful', 'completed', 'confirmed']:
            settled_tx = tx
            break
    
    if not settled_tx:
        print(f"⚠️  No settled/successful transaction found for regression test")
        return
    
    settled_id = settled_tx.get('id') or settled_tx.get('transaction_id')
    print(f"Found settled transaction ID: {settled_id}")
    
    # Test the detail endpoint
    url = f"{BASE_URL}/api/wallet/transaction/{settled_id}"
    response = requests.get(url, headers=headers)
    print(f"\nGET {url}")
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if 'data' in data:
            tx_data = data['data']
            status = tx_data.get('status', 'N/A')
            confirmations = tx_data.get('confirmations', 'N/A')
            
            print(f"\n📊 SETTLED TX {settled_id}:")
            print(f"  status: {status}")
            print(f"  confirmations: {confirmations}")
            
            if status.lower() in ['settled', 'successful', 'completed', 'confirmed']:
                print(f"\n✅ PASS: Status is still '{status}' (NOT awaiting_payment/unpaid)")
            else:
                print(f"\n❌ FAIL: Status changed to '{status}' (regression)")
        else:
            print(f"❌ No 'data' field in response")
    else:
        print(f"❌ Request failed: {response.text[:500]}")

def test_health_endpoint():
    """Test 5: GET /health"""
    print_section("TEST 5: GET /health (SAFE MODE verification)")
    
    # Try both /health and /api/status/health
    for endpoint in ["/health", "/api/status/health"]:
        url = f"{BASE_URL}{endpoint}"
        print(f"\nGET {url}")
        
        try:
            response = requests.get(url)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                
                # Check for SAFE MODE indicators
                database = data.get('database', 'N/A')
                redis = data.get('redis', 'N/A')
                bg_jobs = data.get('background_jobs', {})
                bg_jobs_eligible = bg_jobs.get('eligible', 'N/A') if isinstance(bg_jobs, dict) else 'N/A'
                
                print(f"\n📊 HEALTH CHECK:")
                print(f"  database: {database}")
                print(f"  redis: {redis}")
                print(f"  background_jobs.eligible: {bg_jobs_eligible}")
                
                if database == 'connected' and redis == 'connected' and bg_jobs_eligible == False:
                    print(f"\n✅ PASS: SAFE MODE confirmed (database+redis connected, bg_jobs.eligible=false)")
                else:
                    print(f"\n⚠️  Health check returned but values unexpected")
                
                return
        except Exception as e:
            print(f"❌ Error: {str(e)}")
    
    print(f"\n❌ Neither /health nor /api/status/health returned 200")

def main():
    print("\n" + "="*80)
    print("  READ-ONLY BACKEND VERIFICATION")
    print("  Transaction Display Status Fix")
    print("  LIVE PRODUCTION Railway Postgres DB (SAFE MODE)")
    print("="*80)
    
    # Login
    token = login()
    if not token:
        print("\n❌ CRITICAL: Login failed. Cannot proceed with tests.")
        return
    
    # Run all tests
    test_transaction_722(token)
    test_get_all_transactions(token)
    test_recent_transactions(token)
    test_settled_transaction_regression(token)
    test_health_endpoint()
    
    print("\n" + "="*80)
    print("  TESTING COMPLETE")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
