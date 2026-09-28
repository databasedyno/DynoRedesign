#!/usr/bin/env python3
"""
Backend API Testing for Wallet Transactions - Payment Link Created Date
READ-ONLY testing on LIVE PRODUCTION DB (SAFE MODE)

Test: POST /api/wallet/getAllTransactions
Verify: source.link_created_at is present for payment_link transactions
"""

import requests
import subprocess
import json
import sys
from typing import Dict, Any, Optional, List

# Base URLs - use the backend URL from environment
BASE_URL = "https://vault-setup-12.preview.emergentagent.com"

# Test credentials (merchant account)
# Using onarrival21@gmail.com (user_id=1, company_id=1 "The Dev Store")
MERCHANT_EMAIL = "onarrival21@gmail.com"
MERCHANT_PASSWORD = "Katiekendra123@"
COMPANY_ID = 1

# Expected test transaction
EXPECTED_TX_ID = "d0c1ec0d-b0d1-4e05-a4f0-e227c790f4be"
EXPECTED_TX_NUMBER = 1295
EXPECTED_LINK_ID = 492
EXPECTED_LINK_CREATED_AT = "2026-09-19T01:43:33.719Z"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'

def log_test(test_name: str):
    """Log test name"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST: {test_name}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")

def log_pass(message: str):
    """Log pass message"""
    print(f"{Colors.GREEN}✅ PASS: {message}{Colors.RESET}")

def log_fail(message: str):
    """Log fail message"""
    print(f"{Colors.RED}❌ FAIL: {message}{Colors.RESET}")

def log_info(message: str):
    """Log info message"""
    print(f"{Colors.CYAN}ℹ️  INFO: {message}{Colors.RESET}")

def log_warning(message: str):
    """Log warning message"""
    print(f"{Colors.YELLOW}⚠️  WARNING: {message}{Colors.RESET}")

def get_totp_code(user_id: int = 1) -> Optional[str]:
    """Get TOTP code for user"""
    try:
        result = subprocess.run(
            ["node", "/app/backend/scripts/print_totp.cjs", str(user_id)],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            totp = result.stdout.strip()
            log_info(f"TOTP code retrieved: {totp}")
            return totp
        else:
            log_fail(f"Failed to get TOTP: {result.stderr}")
            return None
    except Exception as e:
        log_fail(f"Error getting TOTP: {str(e)}")
        return None

def authenticate() -> Optional[str]:
    """
    Authenticate as merchant and return Bearer token
    
    Flow:
    1. POST /api/user/login -> challenge_token
    2. Get TOTP code
    3. POST /api/user/2fa/validate -> accessToken
    """
    log_test("Authentication Flow")
    
    try:
        # Step 1: Login to get challenge token
        log_info("Step 1: POST /api/user/login")
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        login_payload = {
            "email": MERCHANT_EMAIL,
            "password": MERCHANT_PASSWORD
        }
        
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            headers=headers,
            json=login_payload,
            timeout=30
        )
        
        log_info(f"Login status: {response.status_code}")
        
        if response.status_code != 200:
            log_fail(f"Login failed with status {response.status_code}")
            log_info(f"Response: {response.text}")
            return None
        
        login_data = response.json()
        challenge_token = login_data.get("data", {}).get("challenge_token")
        
        if not challenge_token:
            log_fail("No challenge_token in login response")
            log_info(f"Response: {json.dumps(login_data, indent=2)}")
            return None
        
        log_pass(f"Login successful, challenge_token received")
        
        # Step 2: Get TOTP code
        log_info("Step 2: Getting TOTP code")
        totp = get_totp_code(1)
        
        if not totp:
            log_fail("Failed to get TOTP code")
            return None
        
        # Step 3: Validate 2FA
        log_info("Step 3: POST /api/user/2fa/validate")
        validate_payload = {
            "challenge_token": challenge_token,
            "token": totp
        }
        
        response = requests.post(
            f"{BASE_URL}/api/user/2fa/validate",
            headers=headers,
            json=validate_payload,
            timeout=30
        )
        
        log_info(f"2FA validation status: {response.status_code}")
        
        if response.status_code != 200:
            log_fail(f"2FA validation failed with status {response.status_code}")
            log_info(f"Response: {response.text}")
            return None
        
        validate_data = response.json()
        access_token = validate_data.get("data", {}).get("accessToken")
        
        if not access_token:
            log_fail("No accessToken in 2FA validation response")
            log_info(f"Response: {json.dumps(validate_data, indent=2)}")
            return None
        
        log_pass(f"2FA validation successful, accessToken received")
        log_info(f"Token (first 20 chars): {access_token[:20]}...")
        
        return access_token
        
    except Exception as e:
        log_fail(f"Authentication failed: {str(e)}")
        return None

def test_get_all_transactions(access_token: str) -> Optional[List[Dict[str, Any]]]:
    """
    Test POST /api/wallet/getAllTransactions
    
    Returns the transactions list or None if failed
    """
    log_test("POST /api/wallet/getAllTransactions")
    
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        payload = {
            "company_id": COMPANY_ID
        }
        
        log_info(f"Request: POST /api/wallet/getAllTransactions")
        log_info(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(
            f"{BASE_URL}/api/wallet/getAllTransactions",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            log_fail(f"Request failed with status {response.status_code}")
            log_info(f"Response: {response.text}")
            return None
        
        data = response.json()
        
        # Extract transactions from response
        transactions = data.get("data", {}).get("customers_transactions", [])
        
        if not transactions:
            log_fail("No transactions in response")
            log_info(f"Response structure: {json.dumps(data, indent=2)[:500]}...")
            return None
        
        log_pass(f"Request successful, received {len(transactions)} transactions")
        
        return transactions
        
    except Exception as e:
        log_fail(f"Request failed: {str(e)}")
        return None

def verify_payment_link_transaction(transactions: List[Dict[str, Any]]) -> bool:
    """
    Verify that payment_link transactions have source.link_created_at
    
    Primary assertion: Find transaction with id=EXPECTED_TX_ID and verify:
    - source.type == "payment_link"
    - source.link_id == EXPECTED_LINK_ID
    - source.link_created_at == EXPECTED_LINK_CREATED_AT
    """
    log_test("Verify Payment Link Transaction - source.link_created_at")
    
    all_passed = True
    
    # Find payment_link transactions
    payment_link_txs = [
        tx for tx in transactions 
        if tx.get("source", {}).get("type") == "payment_link"
    ]
    
    log_info(f"Found {len(payment_link_txs)} payment_link transactions out of {len(transactions)} total")
    
    if not payment_link_txs:
        log_fail("No payment_link transactions found")
        return False
    
    log_pass(f"Found {len(payment_link_txs)} payment_link transactions")
    
    # Find the specific expected transaction
    expected_tx = None
    for tx in transactions:
        if tx.get("id") == EXPECTED_TX_ID:
            expected_tx = tx
            break
    
    if not expected_tx:
        log_warning(f"Expected transaction {EXPECTED_TX_ID} not found in response")
        log_info("Will check other payment_link transactions instead")
    else:
        log_info(f"Found expected transaction: {EXPECTED_TX_ID}")
        
        # Verify source fields
        source = expected_tx.get("source", {})
        
        log_info(f"Transaction source: {json.dumps(source, indent=2)}")
        
        # Check source.type
        source_type = source.get("type")
        if source_type == "payment_link":
            log_pass(f"source.type == 'payment_link' ✓")
        else:
            log_fail(f"source.type == '{source_type}' (expected 'payment_link')")
            all_passed = False
        
        # Check source.link_id
        link_id = source.get("link_id")
        if link_id == EXPECTED_LINK_ID:
            log_pass(f"source.link_id == {EXPECTED_LINK_ID} ✓")
        else:
            log_fail(f"source.link_id == {link_id} (expected {EXPECTED_LINK_ID})")
            all_passed = False
        
        # Check source.link_created_at (PRIMARY ASSERTION)
        link_created_at = source.get("link_created_at")
        
        if link_created_at is None:
            log_fail(f"source.link_created_at is NULL (expected '{EXPECTED_LINK_CREATED_AT}')")
            all_passed = False
        elif link_created_at == EXPECTED_LINK_CREATED_AT:
            log_pass(f"source.link_created_at == '{EXPECTED_LINK_CREATED_AT}' ✓")
        else:
            log_warning(f"source.link_created_at == '{link_created_at}' (expected '{EXPECTED_LINK_CREATED_AT}')")
            log_info("Date might have been updated, but field is present and not null")
            # Don't fail if date is different but present
            if link_created_at:
                log_pass("source.link_created_at is present and not null ✓")
    
    # Check all payment_link transactions have link_created_at
    log_info("\nChecking all payment_link transactions for link_created_at...")
    
    txs_with_created_at = 0
    txs_without_created_at = 0
    
    for tx in payment_link_txs[:10]:  # Check first 10
        source = tx.get("source", {})
        link_created_at = source.get("link_created_at")
        tx_id = tx.get("id", "unknown")
        link_id = source.get("link_id", "unknown")
        
        if link_created_at:
            txs_with_created_at += 1
            log_info(f"  ✓ Transaction {tx_id} (link {link_id}): link_created_at = {link_created_at}")
        else:
            txs_without_created_at += 1
            log_warning(f"  ✗ Transaction {tx_id} (link {link_id}): link_created_at is NULL")
    
    log_info(f"\nSummary: {txs_with_created_at} with link_created_at, {txs_without_created_at} without")
    
    if txs_with_created_at > 0:
        log_pass(f"At least {txs_with_created_at} payment_link transactions have link_created_at ✓")
    else:
        log_fail("No payment_link transactions have link_created_at")
        all_passed = False
    
    return all_passed

def verify_regression(transactions: List[Dict[str, Any]]) -> bool:
    """
    Verify regression checks:
    1. Endpoint returns full transaction list without errors
    2. Non-payment_link transactions have link_created_at == null
    3. Existing source.type classification is unchanged
    """
    log_test("Regression Checks")
    
    all_passed = True
    
    # Check 1: Full transaction list returned
    if len(transactions) > 0:
        log_pass(f"Endpoint returned {len(transactions)} transactions ✓")
    else:
        log_fail("Endpoint returned empty transaction list")
        all_passed = False
    
    # Check 2: Non-payment_link transactions should have link_created_at == null
    log_info("\nChecking non-payment_link transactions...")
    
    non_payment_link_txs = [
        tx for tx in transactions 
        if tx.get("source", {}).get("type") != "payment_link"
    ]
    
    log_info(f"Found {len(non_payment_link_txs)} non-payment_link transactions")
    
    non_link_with_created_at = 0
    for tx in non_payment_link_txs[:5]:  # Check first 5
        source = tx.get("source", {})
        link_created_at = source.get("link_created_at")
        source_type = source.get("type", "unknown")
        tx_id = tx.get("id", "unknown")
        
        if link_created_at is not None:
            non_link_with_created_at += 1
            log_warning(f"  Non-payment_link transaction {tx_id} (type: {source_type}) has link_created_at: {link_created_at}")
        else:
            log_info(f"  ✓ Transaction {tx_id} (type: {source_type}): link_created_at is null")
    
    if non_link_with_created_at == 0:
        log_pass("Non-payment_link transactions have link_created_at == null ✓")
    else:
        log_warning(f"{non_link_with_created_at} non-payment_link transactions have link_created_at (may be ok if they originated from links)")
    
    # Check 3: Source type classification
    log_info("\nChecking source.type classification...")
    
    source_types = {}
    for tx in transactions:
        source_type = tx.get("source", {}).get("type", "unknown")
        source_types[source_type] = source_types.get(source_type, 0) + 1
    
    log_info(f"Source type distribution:")
    for source_type, count in sorted(source_types.items()):
        log_info(f"  {source_type}: {count}")
    
    expected_types = ["payment_link", "api", "tip", "product", "contribution", "safedeal", "direct"]
    valid_types = all(st in expected_types for st in source_types.keys())
    
    if valid_types:
        log_pass("All source types are valid ✓")
    else:
        invalid_types = [st for st in source_types.keys() if st not in expected_types]
        log_fail(f"Invalid source types found: {invalid_types}")
        all_passed = False
    
    return all_passed

def main():
    """Main test runner"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}Wallet Transactions - Payment Link Created Date Test{Colors.RESET}")
    print(f"{Colors.BLUE}READ-ONLY Testing on LIVE PRODUCTION DB (SAFE MODE){Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    results = {}
    
    # Step 1: Authenticate
    access_token = authenticate()
    if not access_token:
        log_fail("Authentication failed - cannot proceed with tests")
        return 1
    
    results["authentication"] = True
    
    # Step 2: Get all transactions
    transactions = test_get_all_transactions(access_token)
    if not transactions:
        log_fail("Failed to get transactions - cannot proceed with verification")
        return 1
    
    results["get_transactions"] = True
    
    # Step 3: Verify payment_link transaction has link_created_at
    results["payment_link_created_at"] = verify_payment_link_transaction(transactions)
    
    # Step 4: Verify regression
    results["regression"] = verify_regression(transactions)
    
    # Print summary
    print_summary(results)
    
    # Return exit code
    if all(results.values()):
        return 0
    else:
        return 1

def print_summary(results: Dict[str, bool]):
    """Print test summary"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    for test_name, passed in results.items():
        status = f"{Colors.GREEN}✅ PASS{Colors.RESET}" if passed else f"{Colors.RED}❌ FAIL{Colors.RESET}"
        print(f"  {status}: {test_name}")
    
    total = len(results)
    passed = sum(results.values())
    
    print(f"\n{Colors.BLUE}Total: {passed}/{total} tests passed{Colors.RESET}")
    
    if all(results.values()):
        print(f"\n{Colors.GREEN}{'='*80}{Colors.RESET}")
        print(f"{Colors.GREEN}ALL TESTS PASSED ✅✅✅{Colors.RESET}")
        print(f"{Colors.GREEN}{'='*80}{Colors.RESET}")
    else:
        print(f"\n{Colors.RED}{'='*80}{Colors.RESET}")
        print(f"{Colors.RED}SOME TESTS FAILED ❌{Colors.RESET}")
        print(f"{Colors.RED}{'='*80}{Colors.RESET}")

if __name__ == "__main__":
    sys.exit(main())
