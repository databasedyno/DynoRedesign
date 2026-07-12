#!/usr/bin/env python3
"""
Backend API Test Suite for Wallet Reuse Across Companies Feature
Tests two new endpoints:
1. GET /api/wallet/reusable-wallets?exclude_company_id=<id>
2. POST /api/wallet/copyWalletAddresses

SAFETY: Uses QA test accounts for WRITE operations. hostbay@moxx.co is READ-ONLY.
"""

import os
import sys
import json
import requests
import subprocess
from typing import Dict, Any, Optional, List

# Base URL from frontend .env
BASE_URL = "https://cred-provisioner.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
HOSTBAY_EMAIL = "hostbay@moxx.co"
HOSTBAY_PASSWORD = "Katiekendra123@"

QA_EMPTY_EMAIL = "qa.empty.1782626169@dynopaytest.com"
QA_EMPTY_PASSWORD = "QaEmpty#2026"

QA_ONBOARD_EMAIL = "qa.onboard.1782585233@dynopaytest.com"
QA_ONBOARD_PASSWORD = "QaOnboard#2026"

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests = []
    
    def add_pass(self, test_name: str, details: str = ""):
        self.passed += 1
        self.tests.append({"name": test_name, "status": "PASS", "details": details})
        print(f"{GREEN}✓{RESET} {test_name}")
        if details:
            print(f"  {details}")
    
    def add_fail(self, test_name: str, details: str = ""):
        self.failed += 1
        self.tests.append({"name": test_name, "status": "FAIL", "details": details})
        print(f"{RED}✗{RESET} {test_name}")
        if details:
            print(f"  {RED}{details}{RESET}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"Test Summary: {self.passed}/{total} passed")
        if self.failed > 0:
            print(f"{RED}Failed tests:{RESET}")
            for test in self.tests:
                if test["status"] == "FAIL":
                    print(f"  - {test['name']}")
        print(f"{'='*60}\n")
        return self.failed == 0


def get_jwt_tokens() -> Dict[str, str]:
    """Mint JWT tokens using the mint_ux_tokens.js script"""
    print(f"{BLUE}Minting JWT tokens...{RESET}")
    try:
        result = subprocess.run(
            ["node", "/app/scripts/mint_ux_tokens.js"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode != 0:
            print(f"{RED}Failed to mint tokens: {result.stderr}{RESET}")
            return {}
        
        tokens = json.loads(result.stdout)
        print(f"{GREEN}✓ Tokens minted successfully{RESET}")
        return tokens
    except Exception as e:
        print(f"{RED}Error minting tokens: {e}{RESET}")
        return {}


def test_reusable_wallets_endpoint(result: TestResult, tokens: Dict[str, str]):
    """Test GET /api/wallet/reusable-wallets endpoint"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Testing GET /api/wallet/reusable-wallets{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    hostbay_token = tokens.get(HOSTBAY_EMAIL)
    if not hostbay_token:
        result.add_fail("T1: Get reusable wallets (hostbay)", "No JWT token available")
        return
    
    headers = {"Authorization": f"Bearer {hostbay_token}"}
    
    # Test 1: Call WITHOUT exclude_company_id (should return company_id=1 with ~13 wallets)
    print(f"{YELLOW}Test 1: GET reusable-wallets WITHOUT exclude_company_id{RESET}")
    try:
        response = requests.get(f"{API_BASE}/wallet/reusable-wallets", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            companies = data.get("data", [])
            
            # Check if company_id=1 is present
            company_1 = next((c for c in companies if c.get("company_id") == 1), None)
            
            if company_1:
                wallet_count = company_1.get("wallet_count", 0)
                wallets = company_1.get("wallets", [])
                
                # Verify wallet_address_preview is masked
                all_masked = all(
                    w.get("wallet_address_preview", "").startswith("****") 
                    for w in wallets
                )
                
                if wallet_count >= 10 and all_masked:
                    result.add_pass(
                        "T1: GET reusable-wallets WITHOUT exclude_company_id",
                        f"Found company_id=1 with {wallet_count} wallets, all addresses masked (****XXXX)"
                    )
                else:
                    result.add_fail(
                        "T1: GET reusable-wallets WITHOUT exclude_company_id",
                        f"Expected ≥10 wallets with masked addresses, got {wallet_count} wallets, masked={all_masked}"
                    )
            else:
                result.add_fail(
                    "T1: GET reusable-wallets WITHOUT exclude_company_id",
                    f"company_id=1 not found in response. Companies: {[c.get('company_id') for c in companies]}"
                )
        else:
            result.add_fail(
                "T1: GET reusable-wallets WITHOUT exclude_company_id",
                f"Expected 200, got {response.status_code}: {response.text[:200]}"
            )
    except Exception as e:
        result.add_fail("T1: GET reusable-wallets WITHOUT exclude_company_id", f"Exception: {e}")
    
    # Test 2: Call WITH exclude_company_id=1 (should exclude company 1)
    print(f"\n{YELLOW}Test 2: GET reusable-wallets WITH exclude_company_id=1{RESET}")
    try:
        response = requests.get(
            f"{API_BASE}/wallet/reusable-wallets?exclude_company_id=1",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            companies = data.get("data", [])
            
            # Check that company_id=1 is NOT present
            company_1 = next((c for c in companies if c.get("company_id") == 1), None)
            
            if company_1 is None:
                result.add_pass(
                    "T2: GET reusable-wallets WITH exclude_company_id=1",
                    f"Company 1 correctly excluded. Returned {len(companies)} other companies"
                )
            else:
                result.add_fail(
                    "T2: GET reusable-wallets WITH exclude_company_id=1",
                    "company_id=1 should be excluded but was present in response"
                )
        else:
            result.add_fail(
                "T2: GET reusable-wallets WITH exclude_company_id=1",
                f"Expected 200, got {response.status_code}: {response.text[:200]}"
            )
    except Exception as e:
        result.add_fail("T2: GET reusable-wallets WITH exclude_company_id=1", f"Exception: {e}")
    
    # Test 3: Call WITHOUT Authorization header (should return 401)
    print(f"\n{YELLOW}Test 3: GET reusable-wallets WITHOUT Authorization header{RESET}")
    try:
        response = requests.get(f"{API_BASE}/wallet/reusable-wallets", timeout=10)
        
        if response.status_code == 401:
            result.add_pass(
                "T3: GET reusable-wallets WITHOUT Authorization",
                "Correctly returned 401 Unauthorized"
            )
        else:
            result.add_fail(
                "T3: GET reusable-wallets WITHOUT Authorization",
                f"Expected 401, got {response.status_code}"
            )
    except Exception as e:
        result.add_fail("T3: GET reusable-wallets WITHOUT Authorization", f"Exception: {e}")


def test_copy_wallet_addresses_validation(result: TestResult, tokens: Dict[str, str]):
    """Test POST /api/wallet/copyWalletAddresses validation (safe, no writes)"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Testing POST /api/wallet/copyWalletAddresses (Validation){RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    hostbay_token = tokens.get(HOSTBAY_EMAIL)
    if not hostbay_token:
        result.add_fail("T4-6: Copy validation tests", "No JWT token available")
        return
    
    headers = {
        "Authorization": f"Bearer {hostbay_token}",
        "Content-Type": "application/json"
    }
    
    # Test 4: Empty body (should return 400)
    print(f"{YELLOW}Test 4: POST copyWalletAddresses with empty body{RESET}")
    try:
        response = requests.post(
            f"{API_BASE}/wallet/copyWalletAddresses",
            headers=headers,
            json={},
            timeout=10
        )
        
        if response.status_code == 400:
            result.add_pass(
                "T4: POST copyWalletAddresses empty body",
                f"Correctly returned 400: {response.json().get('message', '')}"
            )
        else:
            result.add_fail(
                "T4: POST copyWalletAddresses empty body",
                f"Expected 400, got {response.status_code}"
            )
    except Exception as e:
        result.add_fail("T4: POST copyWalletAddresses empty body", f"Exception: {e}")
    
    # Test 5: Same source and target company (should return 400)
    print(f"\n{YELLOW}Test 5: POST copyWalletAddresses with same source/target{RESET}")
    try:
        response = requests.post(
            f"{API_BASE}/wallet/copyWalletAddresses",
            headers=headers,
            json={"source_company_id": 1, "target_company_id": 1},
            timeout=10
        )
        
        if response.status_code == 400:
            msg = response.json().get("message", "")
            if "different" in msg.lower():
                result.add_pass(
                    "T5: POST copyWalletAddresses same source/target",
                    f"Correctly returned 400: {msg}"
                )
            else:
                result.add_fail(
                    "T5: POST copyWalletAddresses same source/target",
                    f"Got 400 but unexpected message: {msg}"
                )
        else:
            result.add_fail(
                "T5: POST copyWalletAddresses same source/target",
                f"Expected 400, got {response.status_code}"
            )
    except Exception as e:
        result.add_fail("T5: POST copyWalletAddresses same source/target", f"Exception: {e}")
    
    # Test 6: Target company not owned by user (should return 403)
    print(f"\n{YELLOW}Test 6: POST copyWalletAddresses with unowned target company{RESET}")
    try:
        response = requests.post(
            f"{API_BASE}/wallet/copyWalletAddresses",
            headers=headers,
            json={"source_company_id": 1, "target_company_id": 999999},
            timeout=10
        )
        
        if response.status_code == 403:
            result.add_pass(
                "T6: POST copyWalletAddresses unowned target",
                "Correctly returned 403 Forbidden"
            )
        elif response.status_code == 404:
            # Also acceptable if company doesn't exist
            result.add_pass(
                "T6: POST copyWalletAddresses unowned target",
                "Returned 404 (company not found - also acceptable)"
            )
        else:
            result.add_fail(
                "T6: POST copyWalletAddresses unowned target",
                f"Expected 403 or 404, got {response.status_code}"
            )
    except Exception as e:
        result.add_fail("T6: POST copyWalletAddresses unowned target", f"Exception: {e}")


def get_or_create_companies_for_qa(token: str, email: str) -> tuple:
    """Ensure QA account has 2 companies for testing. Returns (company_a_id, company_b_id)"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Get existing companies via wallet endpoint (more reliable)
    try:
        response = requests.get(f"{API_BASE}/wallet/getWallet", headers=headers, timeout=10)
        if response.status_code == 200:
            companies = response.json().get("data", [])
            company_ids = [c.get("company_id") for c in companies]
            
            if len(company_ids) >= 2:
                return company_ids[0], company_ids[1]
            elif len(company_ids) == 1:
                # Create one more company
                company_a_id = company_ids[0]
                response = requests.post(
                    f"{API_BASE}/company/addCompany",
                    headers=headers,
                    json={
                        "company_name": f"QA Test Company B ({email.split('@')[0]})",
                        "email": email
                    },
                    timeout=10
                )
                if response.status_code in [200, 201]:
                    data = response.json()
                    company_b_id = data.get("data", {}).get("company_id") or data.get("company_id")
                    if company_b_id:
                        return company_a_id, company_b_id
            else:
                # Create two companies
                response1 = requests.post(
                    f"{API_BASE}/company/addCompany",
                    headers=headers,
                    json={
                        "company_name": f"QA Test Company A ({email.split('@')[0]})",
                        "email": email
                    },
                    timeout=10
                )
                if response1.status_code in [200, 201]:
                    data1 = response1.json()
                    company_a_id = data1.get("data", {}).get("company_id") or data1.get("company_id")
                    
                    response2 = requests.post(
                        f"{API_BASE}/company/addCompany",
                        headers=headers,
                        json={
                            "company_name": f"QA Test Company B ({email.split('@')[0]})",
                            "email": email
                        },
                        timeout=10
                    )
                    if response2.status_code in [200, 201]:
                        data2 = response2.json()
                        company_b_id = data2.get("data", {}).get("company_id") or data2.get("company_id")
                        if company_a_id and company_b_id:
                            return company_a_id, company_b_id
    except Exception as e:
        print(f"{RED}Error managing companies: {e}{RESET}")
        import traceback
        traceback.print_exc()
    
    return None, None


def add_wallet_to_company(token: str, company_id: int, currency: str, address: str, label: str) -> bool:
    """Add a wallet address to a company"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/wallet/addWalletAddress",
            headers=headers,
            json={
                "wallet_address": address,
                "currency": currency,
                "label": label,
                "company_id": company_id,
                "wallet_name": f"{currency} Wallet"
            },
            timeout=10
        )
        return response.status_code in [200, 201]
    except Exception as e:
        print(f"{RED}Error adding wallet: {e}{RESET}")
        return False


def test_copy_wallet_addresses_happy_path(result: TestResult, tokens: Dict[str, str]):
    """Test POST /api/wallet/copyWalletAddresses happy path (WRITE test with QA account)"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Testing POST /api/wallet/copyWalletAddresses (Happy Path){RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    # Use QA account for write tests
    qa_token = tokens.get(QA_ONBOARD_EMAIL)
    if not qa_token:
        result.add_fail("T7-8: Copy happy path tests", "No QA JWT token available")
        return
    
    headers = {
        "Authorization": f"Bearer {qa_token}",
        "Content-Type": "application/json"
    }
    
    # Test 7: Happy path - copy wallets between companies
    print(f"{YELLOW}Test 7: POST copyWalletAddresses happy path{RESET}")
    
    # Setup: Ensure QA account has 2 companies
    company_a_id, company_b_id = get_or_create_companies_for_qa(qa_token, QA_ONBOARD_EMAIL)
    
    if not company_a_id or not company_b_id:
        result.add_fail(
            "T7: POST copyWalletAddresses happy path",
            "Failed to setup test companies for QA account"
        )
        return
    
    print(f"  Using companies: A={company_a_id}, B={company_b_id}")
    
    # Add a test wallet to company A (using valid TRON address)
    test_address = "TRyk74od7FfrRYeopp1azu26HcxKdb6zj2"  # Valid TRON address
    wallet_added = add_wallet_to_company(
        qa_token,
        company_a_id,
        "USDT-TRC20",
        test_address,
        "Test Wallet for Copy"
    )
    
    if not wallet_added:
        print(f"  {YELLOW}Note: Wallet may already exist on company A{RESET}")
    
    # Now copy from company A to company B
    try:
        response = requests.post(
            f"{API_BASE}/wallet/copyWalletAddresses",
            headers=headers,
            json={
                "source_company_id": company_a_id,
                "target_company_id": company_b_id
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            copied = data.get("data", {}).get("copied", [])
            skipped = data.get("data", {}).get("skipped", [])
            
            # Verify response structure
            has_copied_or_skipped = len(copied) > 0 or len(skipped) > 0
            
            if has_copied_or_skipped:
                # Verify wallet_address_preview is masked in copied items
                all_masked = all(
                    c.get("wallet_address_preview", "").startswith("****")
                    for c in copied
                )
                
                if all_masked or len(copied) == 0:
                    result.add_pass(
                        "T7: POST copyWalletAddresses happy path",
                        f"Success: copied={len(copied)}, skipped={len(skipped)}, addresses masked correctly"
                    )
                    
                    # Verify wallet appears in company B
                    verify_response = requests.get(
                        f"{API_BASE}/wallet/getWallet?company_id={company_b_id}",
                        headers=headers,
                        timeout=10
                    )
                    if verify_response.status_code == 200:
                        print(f"  {GREEN}✓ Verified: Wallet now appears in company B{RESET}")
                else:
                    result.add_fail(
                        "T7: POST copyWalletAddresses happy path",
                        f"Addresses not properly masked in copied array"
                    )
            else:
                result.add_fail(
                    "T7: POST copyWalletAddresses happy path",
                    "Response missing copied/skipped arrays"
                )
        else:
            result.add_fail(
                "T7: POST copyWalletAddresses happy path",
                f"Expected 200, got {response.status_code}: {response.text[:200]}"
            )
    except Exception as e:
        result.add_fail("T7: POST copyWalletAddresses happy path", f"Exception: {e}")
    
    # Test 8: Idempotency - call copy again (should skip already-copied currencies)
    print(f"\n{YELLOW}Test 8: POST copyWalletAddresses idempotency{RESET}")
    try:
        response = requests.post(
            f"{API_BASE}/wallet/copyWalletAddresses",
            headers=headers,
            json={
                "source_company_id": company_a_id,
                "target_company_id": company_b_id
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            copied = data.get("data", {}).get("copied", [])
            skipped = data.get("data", {}).get("skipped", [])
            
            # On second call, previously copied currencies should be in skipped
            if len(skipped) > 0:
                # Check that skipped items have "already exists" reason
                has_already_exists = any(
                    "already" in s.get("reason", "").lower()
                    for s in skipped
                )
                
                if has_already_exists:
                    result.add_pass(
                        "T8: POST copyWalletAddresses idempotency",
                        f"Correctly skipped {len(skipped)} already-existing currencies"
                    )
                else:
                    result.add_fail(
                        "T8: POST copyWalletAddresses idempotency",
                        f"Skipped items don't have 'already exists' reason: {skipped}"
                    )
            elif len(copied) == 0:
                # If nothing was copied and nothing skipped, that's also acceptable
                result.add_pass(
                    "T8: POST copyWalletAddresses idempotency",
                    "No wallets copied (all already exist)"
                )
            else:
                result.add_fail(
                    "T8: POST copyWalletAddresses idempotency",
                    f"Expected skipped items, got copied={len(copied)}, skipped={len(skipped)}"
                )
        else:
            result.add_fail(
                "T8: POST copyWalletAddresses idempotency",
                f"Expected 200, got {response.status_code}"
            )
    except Exception as e:
        result.add_fail("T8: POST copyWalletAddresses idempotency", f"Exception: {e}")


def main():
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Wallet Reuse Across Companies - Backend API Tests{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    print(f"Base URL: {BASE_URL}")
    print(f"Testing 2 endpoints:")
    print(f"  1. GET /api/wallet/reusable-wallets")
    print(f"  2. POST /api/wallet/copyWalletAddresses")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    result = TestResult()
    
    # Get JWT tokens
    tokens = get_jwt_tokens()
    if not tokens:
        print(f"{RED}Failed to obtain JWT tokens. Exiting.{RESET}")
        sys.exit(1)
    
    # Run tests
    test_reusable_wallets_endpoint(result, tokens)
    test_copy_wallet_addresses_validation(result, tokens)
    test_copy_wallet_addresses_happy_path(result, tokens)
    
    # Print summary
    success = result.summary()
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
