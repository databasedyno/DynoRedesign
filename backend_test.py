#!/usr/bin/env python3
"""
DynoPay Backend Retest - BUG 1: Stale pending → unpaid derivation
Focus: walletController.getAllTransactions + getTransactionDetails
READ-ONLY testing on LIVE production DB
"""

import requests
import json
from datetime import datetime, timedelta

# Base URL from environment
BASE_URL = "http://localhost:8001"

# Test credentials
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

def login():
    """Login and get Bearer token"""
    print("=" * 80)
    print("STEP 1: LOGIN")
    print("=" * 80)
    
    url = f"{BASE_URL}/api/user/login"
    payload = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    response = requests.post(url, json=payload)
    print(f"POST {url}")
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        # Check for accessToken in data object
        if 'data' in data and 'accessToken' in data['data']:
            token = data['data']['accessToken']
            print(f"✅ Login successful, token obtained")
            return token
        else:
            print(f"❌ Login response missing accessToken: {json.dumps(data, indent=2)}")
            return None
    else:
        print(f"❌ Login failed: {response.text}")
        return None

def test_get_all_transactions(token):
    """
    TEST A: POST /api/wallet/getAllTransactions
    Assert:
    - ZERO rows with status='pending' AND createdAt older than 60 minutes
    - 'unpaid' rows PRESENT
    - 'successful' rows untouched
    - pagination.total ≈ 575
    """
    print("\n" + "=" * 80)
    print("TEST A: POST /api/wallet/getAllTransactions")
    print("=" * 80)
    
    url = f"{BASE_URL}/api/wallet/getAllTransactions"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "company_id": 1,
        "rowsPerPage": 50,
        "page": 1
    }
    
    response = requests.post(url, json=payload, headers=headers)
    print(f"POST {url}")
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Request failed: {response.text}")
        return None
    
    data = response.json()
    
    # Extract transactions
    if 'data' in data and 'customers_transactions' in data['data']:
        transactions = data['data']['customers_transactions']
        pagination = data['data'].get('pagination', {})
        total = pagination.get('total', 0)
        
        print(f"\n📊 Total transactions: {total}")
        print(f"📊 Transactions in current page: {len(transactions)}")
        
        # Check for stale pending (older than 60 minutes)
        now = datetime.utcnow()
        sixty_min_ago = now - timedelta(minutes=60)
        
        stale_pending_count = 0
        unpaid_count = 0
        successful_count = 0
        pending_count = 0
        
        stale_pending_examples = []
        unpaid_examples = []
        
        for tx in transactions:
            status = tx.get('status', '')
            created_at_str = tx.get('createdAt', '')
            tx_id = tx.get('id') or tx.get('transaction_id') or tx.get('_id')
            
            # Parse createdAt
            try:
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                created_at = None
            
            # Count by status
            if status == 'pending':
                pending_count += 1
                if created_at and created_at < sixty_min_ago:
                    stale_pending_count += 1
                    stale_pending_examples.append({
                        'id': tx_id,
                        'status': status,
                        'createdAt': created_at_str,
                        'age_minutes': int((now - created_at).total_seconds() / 60)
                    })
            elif status == 'unpaid':
                unpaid_count += 1
                if len(unpaid_examples) < 3:
                    # Debug: print all ID fields
                    if unpaid_count == 1:
                        print(f"\n   🔍 DEBUG: First unpaid transaction fields:")
                        for key in ['id', 'transaction_id', '_id', 'transaction_id_display']:
                            if key in tx:
                                print(f"      - {key}: {tx.get(key)}")
                    
                    unpaid_examples.append({
                        'id': tx_id,
                        'status': status,
                        'createdAt': created_at_str,
                        'full_tx': tx  # Store full transaction for debugging
                    })
            elif status in ['successful', 'completed', 'done']:
                successful_count += 1
        
        print(f"\n📈 Status breakdown (page 1):")
        print(f"   - Pending (fresh): {pending_count}")
        print(f"   - Stale pending (>60 min): {stale_pending_count}")
        print(f"   - Unpaid: {unpaid_count}")
        print(f"   - Successful/completed: {successful_count}")
        
        # Assertions
        print(f"\n🔍 ASSERTIONS:")
        
        # 1. Zero stale pending
        if stale_pending_count == 0:
            print(f"   ✅ ZERO stale pending (>60 min) transactions")
        else:
            print(f"   ❌ FAIL: Found {stale_pending_count} stale pending transactions")
            for ex in stale_pending_examples[:3]:
                print(f"      - ID {ex['id']}: {ex['status']}, created {ex['createdAt']} ({ex['age_minutes']} min ago)")
        
        # 2. Unpaid rows present
        if unpaid_count > 0:
            print(f"   ✅ 'unpaid' rows PRESENT ({unpaid_count} found)")
            # Debug: print first unpaid transaction details
            if unpaid_examples:
                print(f"   📝 First unpaid transaction for TEST B:")
                first_unpaid = unpaid_examples[0]
                print(f"      - ID: {first_unpaid['id']}")
                print(f"      - Status: {first_unpaid['status']}")
                print(f"      - Created: {first_unpaid['createdAt']}")
        else:
            print(f"   ❌ FAIL: NO 'unpaid' rows found")
        
        # 3. Successful rows present
        if successful_count > 0:
            print(f"   ✅ 'successful' rows present ({successful_count} found)")
        else:
            print(f"   ⚠️  WARNING: NO successful rows in page 1")
        
        # 4. Total ≈ 575
        if 550 <= total <= 600:
            print(f"   ✅ pagination.total ≈ 575 (actual: {total})")
        else:
            print(f"   ⚠️  WARNING: pagination.total = {total} (expected ≈ 575)")
        
        # Return unpaid example for next test
        return unpaid_examples[0] if unpaid_examples else None
    else:
        print(f"❌ Unexpected response structure: {json.dumps(data, indent=2)[:500]}")
        return None

def test_get_transaction_details(token, unpaid_tx):
    """
    TEST B: GET /api/wallet/transaction/<id>?company_id=1
    Assert: response data.status === 'unpaid'
    
    NOTE: The endpoint expects the NUMERIC transaction_id, not the UUID 'id' field
    """
    print("\n" + "=" * 80)
    print("TEST B: GET /api/wallet/transaction/<id>")
    print("=" * 80)
    
    if not unpaid_tx:
        print("❌ No unpaid transaction available from TEST A")
        return False
    
    # Extract the numeric transaction_id from the full transaction object
    full_tx = unpaid_tx.get('full_tx', {})
    numeric_tx_id = full_tx.get('transaction_id')
    uuid_id = unpaid_tx['id']
    
    if not numeric_tx_id:
        print(f"❌ No numeric transaction_id found in transaction")
        return False
    
    print(f"Testing with numeric transaction_id: {numeric_tx_id} (UUID: {uuid_id})")
    
    url = f"{BASE_URL}/api/wallet/transaction/{numeric_tx_id}"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    params = {
        "company_id": 1
    }
    
    print(f"GET {url}?company_id=1")
    
    response = requests.get(url, headers=headers, params=params)
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Request failed: {response.text}")
        return False
    
    data = response.json()
    
    if 'data' in data:
        tx_data = data['data']
        status = tx_data.get('status', '')
        
        print(f"\n📋 Transaction details:")
        print(f"   - Transaction ID (from response): {tx_data.get('transaction_id')}")
        print(f"   - Status: {status}")
        print(f"   - Created: {tx_data.get('date_time')}")
        
        if status == 'unpaid':
            print(f"\n   ✅ Status is 'unpaid' as expected")
            return True
        else:
            print(f"\n   ❌ FAIL: Status is '{status}', expected 'unpaid'")
            return False
    else:
        print(f"❌ Unexpected response structure: {json.dumps(data, indent=2)[:500]}")
        return False

def test_regression_checks(token):
    """
    TEST C: Regression spot-checks
    - GET /api/company/getTransactions/1
    - GET /api/dashboard/?company_id=1 vs /api/dashboard/action-counts?company_id=1
    - GET /health
    """
    print("\n" + "=" * 80)
    print("TEST C: REGRESSION SPOT-CHECKS")
    print("=" * 80)
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # C1: GET /api/company/getTransactions/1
    print("\n📌 C1: GET /api/company/getTransactions/1")
    url = f"{BASE_URL}/api/company/getTransactions/1"
    response = requests.get(url, headers=headers)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if 'data' in data and 'transactions' in data['data']:
            transactions = data['data']['transactions']
            
            unpaid_count = sum(1 for tx in transactions if tx.get('status') == 'unpaid')
            successful_count = sum(1 for tx in transactions if tx.get('status') in ['successful', 'completed', 'done'])
            
            # Check for stale pending
            now = datetime.utcnow()
            sixty_min_ago = now - timedelta(minutes=60)
            stale_pending_count = 0
            
            for tx in transactions:
                if tx.get('status') == 'pending':
                    created_at_str = tx.get('createdAt', '')
                    try:
                        created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                        if created_at < sixty_min_ago:
                            stale_pending_count += 1
                    except (ValueError, AttributeError):
                        pass
            
            print(f"   - Total transactions: {len(transactions)}")
            print(f"   - Unpaid: {unpaid_count}")
            print(f"   - Successful: {successful_count}")
            print(f"   - Stale pending (>60 min): {stale_pending_count}")
            
            if stale_pending_count == 0:
                print(f"   ✅ ZERO stale pending")
            else:
                print(f"   ❌ FAIL: Found {stale_pending_count} stale pending")
            
            if unpaid_count > 0:
                print(f"   ✅ 'unpaid' rows present ({unpaid_count})")
            else:
                print(f"   ⚠️  WARNING: NO unpaid rows")
            
            if successful_count > 0:
                print(f"   ✅ 'successful' rows present ({successful_count})")
    else:
        print(f"   ❌ Request failed: {response.text}")
    
    # C2: Dashboard pending_count vs action-counts transactions_pending
    print("\n📌 C2: Dashboard pending_count parity check")
    
    # Get dashboard
    url_dashboard = f"{BASE_URL}/api/dashboard/"
    params = {"company_id": 1}
    response_dashboard = requests.get(url_dashboard, headers=headers, params=params)
    print(f"GET {url_dashboard}?company_id=1")
    print(f"Status: {response_dashboard.status_code}")
    
    pending_count_dashboard = None
    if response_dashboard.status_code == 200:
        data = response_dashboard.json()
        if 'data' in data:
            # Look for pending_count in various possible locations
            dashboard_data = data['data']
            if 'today_summary' in dashboard_data:
                pending_count_dashboard = dashboard_data['today_summary'].get('pending_count')
            elif 'counts' in dashboard_data:
                pending_count_dashboard = dashboard_data['counts'].get('pending_count')
            elif 'pending_count' in dashboard_data:
                pending_count_dashboard = dashboard_data['pending_count']
            
            print(f"   Dashboard pending_count: {pending_count_dashboard}")
    
    # Get action-counts
    url_action_counts = f"{BASE_URL}/api/dashboard/action-counts"
    response_action_counts = requests.get(url_action_counts, headers=headers, params=params)
    print(f"GET {url_action_counts}?company_id=1")
    print(f"Status: {response_action_counts.status_code}")
    
    transactions_pending = None
    if response_action_counts.status_code == 200:
        data = response_action_counts.json()
        if 'data' in data:
            transactions_pending = data['data'].get('transactions_pending')
            print(f"   Action-counts transactions_pending: {transactions_pending}")
    
    # Check parity
    if pending_count_dashboard is not None and transactions_pending is not None:
        if pending_count_dashboard == transactions_pending:
            print(f"   ✅ PARITY ACHIEVED: {pending_count_dashboard} == {transactions_pending}")
            if pending_count_dashboard == 0:
                print(f"   ✅ Both are 0 (expected, all stale)")
        else:
            print(f"   ❌ FAIL: PARITY BROKEN: {pending_count_dashboard} != {transactions_pending}")
    else:
        print(f"   ⚠️  WARNING: Could not verify parity (missing data)")
    
    # C3: Health check
    print("\n📌 C3: GET /health")
    url_health = f"{BASE_URL}/health"
    response_health = requests.get(url_health)
    print(f"Status: {response_health.status_code}")
    
    if response_health.status_code == 200:
        data = response_health.json()
        print(f"   - Status: {data.get('status')}")
        print(f"   - Database: {data.get('database')}")
        print(f"   - Redis: {data.get('redis')}")
        
        if 'background_jobs' in data:
            bg_jobs = data['background_jobs']
            print(f"   - Background jobs eligible: {bg_jobs.get('eligible')}")
            
            if bg_jobs.get('eligible') == False:
                print(f"   ✅ SAFE MODE active (background_jobs.eligible=false)")
            else:
                print(f"   ⚠️  WARNING: SAFE MODE may not be active")
        
        if data.get('status') == 'healthy' and data.get('database') == 'connected' and data.get('redis') == 'connected':
            print(f"   ✅ System healthy")
    else:
        print(f"   ❌ Health check failed: {response_health.text}")

def main():
    print("DynoPay Backend Retest - BUG 1: Stale pending → unpaid")
    print("Focus: walletController.getAllTransactions + getTransactionDetails")
    print("READ-ONLY testing on LIVE production DB")
    print()
    
    # Step 1: Login
    token = login()
    if not token:
        print("\n❌ FATAL: Cannot proceed without authentication token")
        return
    
    # Step 2: Test A - getAllTransactions
    unpaid_tx = test_get_all_transactions(token)
    
    # Step 3: Test B - getTransactionDetails
    test_get_transaction_details(token, unpaid_tx)
    
    # Step 4: Test C - Regression checks
    test_regression_checks(token)
    
    print("\n" + "=" * 80)
    print("RETEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    main()
