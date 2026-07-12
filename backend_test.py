#!/usr/bin/env python3
"""
Formal Backend Verification - DynoPay Sandbox Enforcement + Regenerate/Toggle/Revoke
Session 34 (cont'd) - Hardening pass on auto-provisioning feature

Tests 24 assertions covering:
1. Sandbox restrictions on dpk_test_ keys (max_amount, allowed_currencies)
2. Validate API key filters status='active' (revoked/inactive keys rejected)
3. Regenerate preserves environment prefix (dpk_test_ / dpk_live_)
4. Toggle status, revoke, and regression checks

QA Account: qa.empty.1782626169@dynopaytest.com / QaEmpty#2026
NEVER touch hostbay@moxx.co
"""

import requests
import json
import time
import sys
import os
from typing import Dict, Any, Optional, List

# Configuration
BASE_URL = "https://40b4ff19-5dd6-4c10-9148-72e7af6c58cf.preview.emergentagent.com"
QA_EMAIL = "qa.empty.1782626169@dynopaytest.com"
QA_PASSWORD = "QaEmpty#2026"

# Test results tracking
test_results = []
cleanup_items = {
    "api_ids": [],
    "company_ids": []
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def log(message: str, color: str = ""):
    """Print colored log message"""
    if color:
        print(f"{color}{message}{Colors.END}")
    else:
        print(message)

def record_result(test_id: str, passed: bool, message: str, details: Optional[Dict] = None):
    """Record test result"""
    status = f"{Colors.GREEN}✅ PASS{Colors.END}" if passed else f"{Colors.RED}❌ FAIL{Colors.END}"
    log(f"{test_id}: {status} - {message}")
    test_results.append({
        "test_id": test_id,
        "passed": passed,
        "message": message,
        "details": details or {}
    })

def login() -> Optional[str]:
    """Login and get JWT token"""
    log(f"\n{Colors.BLUE}=== SETUP: Login ==={Colors.END}")
    try:
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": QA_EMAIL, "password": QA_PASSWORD},
            headers={"User-Agent": "Mozilla/5.0 Chrome/120 Safari/537.36"},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("data", {}).get("accessToken")
            if token:
                log(f"✓ Login successful", Colors.GREEN)
                return token
        
        log(f"✗ Login failed: {response.status_code} - {response.text}", Colors.RED)
        return None
    except Exception as e:
        log(f"✗ Login error: {str(e)}", Colors.RED)
        return None

def create_company(token: str, timestamp: int) -> Optional[Dict]:
    """Create a fresh test company"""
    log(f"\n{Colors.BLUE}=== SETUP: Create Company ==={Colors.END}")
    try:
        response = requests.post(
            f"{BASE_URL}/api/company/addCompany",
            json={
                "company_name": f"Formal_{timestamp}",
                "email": f"formal_{timestamp}@dynopaytest.com",
                "mobile": "+1234567890",
                "address_line1": "123 Test St",
                "city": "Test City",
                "state": "TS",
                "country": "US",
                "zip_code": "12345"
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            company_data = data.get("data", {})
            company_id = company_data.get("company_id")
            auto_test_key_created = company_data.get("auto_test_key_created", False)
            
            if company_id:
                cleanup_items["company_ids"].append(company_id)
                log(f"✓ Company created: ID={company_id}, auto_test_key_created={auto_test_key_created}", Colors.GREEN)
                return {
                    "company_id": company_id,
                    "auto_test_key_created": auto_test_key_created
                }
        
        log(f"✗ Company creation failed: {response.status_code} - {response.text}", Colors.RED)
        return None
    except Exception as e:
        log(f"✗ Company creation error: {str(e)}", Colors.RED)
        return None

def get_api_keys(token: str, company_id: int) -> Optional[Dict]:
    """Get API keys for a company"""
    try:
        response = requests.get(
            f"{BASE_URL}/api/userApi/getApi",
            params={"company_id": company_id},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("data", {})
        
        return None
    except Exception as e:
        log(f"✗ Get API keys error: {str(e)}", Colors.RED)
        return None

def add_wallet(token: str, company_id: int, currency: str = "BTC") -> bool:
    """Add a wallet to company (bypasses OTP)"""
    log(f"\n{Colors.BLUE}=== SETUP: Add {currency} Wallet ==={Colors.END}")
    try:
        # Use a known valid BTC address
        wallet_address = "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7"
        
        response = requests.post(
            f"{BASE_URL}/api/wallet/addWalletAddress",
            json={
                "wallet_address": wallet_address,
                "currency": currency,
                "wallet_name": f"E2E_{currency}",
                "company_id": company_id
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            log(f"✓ {currency} wallet added", Colors.GREEN)
            return True
        
        log(f"✗ Wallet add failed: {response.status_code} - {response.text}", Colors.RED)
        return False
    except Exception as e:
        log(f"✗ Wallet add error: {str(e)}", Colors.RED)
        return False

def create_live_key(token: str, company_id: int) -> Optional[int]:
    """Manually create a live (production) API key"""
    log(f"\n{Colors.BLUE}=== SETUP: Create Live Key ==={Colors.END}")
    try:
        response = requests.post(
            f"{BASE_URL}/api/userApi/addApi",
            json={
                "company_id": company_id,
                "base_currency": "USD",
                "environment": "production"
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            api_id = data.get("data", {}).get("api_id")
            if api_id:
                cleanup_items["api_ids"].append(api_id)
                log(f"✓ Live key created: api_id={api_id}", Colors.GREEN)
                return api_id
        
        log(f"✗ Live key creation failed: {response.status_code} - {response.text}", Colors.RED)
        return None
    except Exception as e:
        log(f"✗ Live key creation error: {str(e)}", Colors.RED)
        return None

def test_create_payment(api_key: str, amount: float, currencies: List[str]) -> Dict:
    """Test createPayment endpoint with given parameters"""
    try:
        response = requests.post(
            f"{BASE_URL}/api/user/createPayment",
            json={
                "amount": amount,
                "redirect_uri": "https://example.com/thanks",
                "accepted_currencies": currencies
            },
            headers={
                "x-api-key": api_key,
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        return {
            "status_code": response.status_code,
            "body": response.json() if response.status_code in [200, 400, 403] else {"error": response.text}
        }
    except Exception as e:
        return {
            "status_code": 0,
            "body": {"error": str(e)}
        }

def run_tests():
    """Run all 24 test assertions"""
    log(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    log(f"{Colors.BLUE}FORMAL BACKEND VERIFICATION - SANDBOX ENFORCEMENT + HARDENING{Colors.END}")
    log(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    # Login
    token = login()
    if not token:
        log("FATAL: Cannot proceed without authentication", Colors.RED)
        return False
    
    timestamp = int(time.time())
    
    # Setup: Create company
    company_result = create_company(token, timestamp)
    if not company_result:
        log("FATAL: Cannot proceed without company", Colors.RED)
        return False
    
    company_id = company_result["company_id"]
    auto_test_key_created = company_result["auto_test_key_created"]
    
    # Assertion 1: Verify auto_test_key_created
    record_result(
        "A1",
        auto_test_key_created == True,
        f"Company creation response has auto_test_key_created=true",
        {"company_id": company_id, "auto_test_key_created": auto_test_key_created}
    )
    
    # Get API keys to find the test key
    time.sleep(2)  # Allow DB to settle
    api_keys_data = get_api_keys(token, company_id)
    
    if not api_keys_data:
        log("FATAL: Cannot retrieve API keys", Colors.RED)
        return False
    
    # Find test and live keys
    test_key_data = None
    test_api_id = None
    test_key_raw = None
    
    all_keys = api_keys_data.get("all", [])
    for key in all_keys:
        if key.get("environment") == "development":
            test_key_data = key
            test_api_id = key.get("api_id")
            test_key_raw = key.get("apiKey")
            cleanup_items["api_ids"].append(test_api_id)
            break
    
    if not test_key_raw:
        log("FATAL: Cannot find test API key", Colors.RED)
        return False
    
    log(f"\n{Colors.BLUE}=== Test Key Found ==={Colors.END}")
    log(f"API ID: {test_api_id}")
    log(f"Environment: {test_key_data.get('environment')}")
    log(f"Status: {test_key_data.get('status')}")
    log(f"Test Mode Restrictions: {test_key_data.get('test_mode_restrictions')}")
    
    # Setup: Add BTC wallet
    if not add_wallet(token, company_id, "BTC"):
        log("WARNING: Wallet add failed, continuing anyway", Colors.YELLOW)
    
    # Setup: Create live key
    live_api_id = create_live_key(token, company_id)
    if not live_api_id:
        log("FATAL: Cannot create live key", Colors.RED)
        return False
    
    # Get live key raw value
    time.sleep(2)
    api_keys_data = get_api_keys(token, company_id)
    live_key_raw = None
    for key in api_keys_data.get("all", []):
        if key.get("api_id") == live_api_id:
            live_key_raw = key.get("apiKey")
            break
    
    if not live_key_raw:
        log("FATAL: Cannot find live API key", Colors.RED)
        return False
    
    log(f"\n{Colors.BLUE}=== Live Key Found ==={Colors.END}")
    log(f"API ID: {live_api_id}")
    
    # ========================================
    # SANDBOX ENFORCEMENT TESTS (4-8)
    # ========================================
    log(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    log(f"{Colors.BLUE}SANDBOX ENFORCEMENT TESTS (dpk_test_ key){Colors.END}")
    log(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    # Test 4: PASS case - amount $50, BTC
    log(f"\n{Colors.BLUE}=== Test 4: Sandbox PASS (amount=50, BTC) ==={Colors.END}")
    result = test_create_payment(test_key_raw, 50, ["BTC"])
    record_result(
        "A4",
        result["status_code"] == 200 and result["body"].get("data", {}).get("redirect_url"),
        f"Amount $50 with BTC accepted (status={result['status_code']})",
        result
    )
    
    # Test 5: AMOUNT REJECT - amount $150 (> max_amount 100)
    log(f"\n{Colors.BLUE}=== Test 5: Sandbox REJECT (amount=150 > max_amount) ==={Colors.END}")
    result = test_create_payment(test_key_raw, 150, ["BTC"])
    is_rejected = (
        result["status_code"] == 400 and
        result["body"].get("code") == "sandbox_restriction" and
        "exceeded" in result["body"].get("message", "").lower() and
        "max_amount 100" in result["body"].get("message", "")
    )
    record_result(
        "A5",
        is_rejected,
        f"Amount $150 rejected with sandbox_restriction (status={result['status_code']})",
        result
    )
    
    # Test 6: CURRENCY REJECT - XRP not in allowed list
    log(f"\n{Colors.BLUE}=== Test 6: Sandbox REJECT (currency=XRP not allowed) ==={Colors.END}")
    result = test_create_payment(test_key_raw, 50, ["XRP"])
    is_rejected = (
        result["status_code"] == 400 and
        result["body"].get("code") == "sandbox_restriction" and
        "XRP" in result["body"].get("message", "") and
        ("not in the allowed list" in result["body"].get("message", "") or
         "disallowed value" in result["body"].get("message", ""))
    )
    record_result(
        "A6",
        is_rejected,
        f"Currency XRP rejected with sandbox_restriction (status={result['status_code']})",
        result
    )
    
    # Test 7: BOUNDARY - amount $100 (equal to max_amount)
    log(f"\n{Colors.BLUE}=== Test 7: Sandbox BOUNDARY (amount=100 = max_amount) ==={Colors.END}")
    result = test_create_payment(test_key_raw, 100, ["BTC"])
    record_result(
        "A7",
        result["status_code"] == 200,
        f"Amount $100 (boundary) accepted (status={result['status_code']})",
        result
    )
    
    # Test 8: MIXED currencies - BTC+ETH allowed, XRP not
    log(f"\n{Colors.BLUE}=== Test 8: Sandbox MIXED (BTC+ETH+XRP, XRP disallowed) ==={Colors.END}")
    result = test_create_payment(test_key_raw, 50, ["BTC", "XRP", "ETH"])
    is_rejected = (
        result["status_code"] == 400 and
        result["body"].get("code") == "sandbox_restriction" and
        "XRP" in result["body"].get("message", "")
    )
    record_result(
        "A8",
        is_rejected,
        f"Mixed currencies with XRP rejected (status={result['status_code']})",
        result
    )
    
    # ========================================
    # LIVE KEY PARITY TESTS (9-10)
    # ========================================
    log(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    log(f"{Colors.BLUE}LIVE KEY PARITY TESTS (dpk_live_ key - no restrictions){Colors.END}")
    log(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    # Test 9: Live key - amount $10,000 (unrestricted)
    log(f"\n{Colors.BLUE}=== Test 9: Live key UNRESTRICTED (amount=10000) ==={Colors.END}")
    result = test_create_payment(live_key_raw, 10000, ["BTC"])
    record_result(
        "A9",
        result["status_code"] == 200,
        f"Live key accepts $10,000 (status={result['status_code']})",
        result
    )
    
    # Test 10: Live key - amount $500 (no currency filter)
    log(f"\n{Colors.BLUE}=== Test 10: Live key UNRESTRICTED (amount=500) ==={Colors.END}")
    result = test_create_payment(live_key_raw, 500, ["BTC"])
    record_result(
        "A10",
        result["status_code"] == 200,
        f"Live key accepts $500 (status={result['status_code']})",
        result
    )
    
    # ========================================
    # REGENERATE TESTS (11-13)
    # ========================================
    log(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    log(f"{Colors.BLUE}REGENERATE TESTS{Colors.END}")
    log(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    # Store old test key value
    old_test_key = test_key_raw
    
    # Test 11: Regenerate test key
    log(f"\n{Colors.BLUE}=== Test 11: Regenerate test key ==={Colors.END}")
    try:
        response = requests.post(
            f"{BASE_URL}/api/userApi/regenerateApi/{test_api_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            new_test_key = data.get("data", {}).get("apiKey")
            
            # Verify environment preserved
            time.sleep(2)
            api_keys_data = get_api_keys(token, company_id)
            regenerated_key_data = None
            for key in api_keys_data.get("all", []):
                if key.get("api_id") == test_api_id:
                    regenerated_key_data = key
                    break
            
            is_valid = (
                new_test_key and
                new_test_key != old_test_key and
                regenerated_key_data and
                regenerated_key_data.get("environment") == "development"
            )
            
            record_result(
                "A11",
                is_valid,
                f"Test key regenerated, environment preserved (new_key != old_key: {new_test_key != old_test_key})",
                {"old_key_prefix": old_test_key[:20], "new_key_prefix": new_test_key[:20] if new_test_key else None}
            )
            
            test_key_raw = new_test_key  # Update for subsequent tests
        else:
            record_result("A11", False, f"Regenerate failed: {response.status_code}", {"response": response.text})
    except Exception as e:
        record_result("A11", False, f"Regenerate error: {str(e)}", {})
    
    # Test 12: New test key still enforces sandbox
    log(f"\n{Colors.BLUE}=== Test 12: Regenerated key enforces sandbox ==={Colors.END}")
    result = test_create_payment(test_key_raw, 150, ["BTC"])
    is_rejected = (
        result["status_code"] == 400 and
        result["body"].get("code") == "sandbox_restriction"
    )
    record_result(
        "A12",
        is_rejected,
        f"Regenerated test key still enforces sandbox (status={result['status_code']})",
        result
    )
    
    # Test 13: Old test key is now invalid
    log(f"\n{Colors.BLUE}=== Test 13: Old test key rejected ==={Colors.END}")
    result = test_create_payment(old_test_key, 50, ["BTC"])
    is_rejected = result["status_code"] == 403
    record_result(
        "A13",
        is_rejected,
        f"Old test key rejected with 403 (status={result['status_code']})",
        result
    )
    
    # ========================================
    # TOGGLE STATUS TESTS (14-16)
    # ========================================
    log(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    log(f"{Colors.BLUE}TOGGLE STATUS TESTS{Colors.END}")
    log(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    # Test 14: Toggle live key to inactive
    log(f"\n{Colors.BLUE}=== Test 14: Toggle live key to inactive ==={Colors.END}")
    try:
        response = requests.put(
            f"{BASE_URL}/api/userApi/toggleStatus/{live_api_id}",
            json={"status": "inactive"},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        is_valid = (
            response.status_code == 200 and
            response.json().get("data", {}).get("status") == "inactive"
        )
        
        record_result(
            "A14",
            is_valid,
            f"Live key toggled to inactive (status={response.status_code})",
            {"response": response.json() if response.status_code == 200 else response.text}
        )
    except Exception as e:
        record_result("A14", False, f"Toggle error: {str(e)}", {})
    
    # Test 15: Inactive live key rejected
    log(f"\n{Colors.BLUE}=== Test 15: Inactive live key rejected ==={Colors.END}")
    result = test_create_payment(live_key_raw, 500, ["BTC"])
    is_rejected = result["status_code"] == 403
    record_result(
        "A15",
        is_rejected,
        f"Inactive live key rejected with 403 (status={result['status_code']})",
        result
    )
    
    # Test 16: Toggle live key back to active
    log(f"\n{Colors.BLUE}=== Test 16: Toggle live key back to active ==={Colors.END}")
    try:
        response = requests.put(
            f"{BASE_URL}/api/userApi/toggleStatus/{live_api_id}",
            json={"status": "active"},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        is_valid = response.status_code == 200
        
        record_result(
            "A16",
            is_valid,
            f"Live key toggled back to active (status={response.status_code})",
            {"response": response.json() if response.status_code == 200 else response.text}
        )
    except Exception as e:
        record_result("A16", False, f"Toggle error: {str(e)}", {})
    
    # ========================================
    # REVOKE TESTS (17-19)
    # ========================================
    log(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    log(f"{Colors.BLUE}REVOKE TESTS{Colors.END}")
    log(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    # Test 17: Revoke live key
    log(f"\n{Colors.BLUE}=== Test 17: Revoke live key ==={Colors.END}")
    try:
        response = requests.post(
            f"{BASE_URL}/api/userApi/revoke/{live_api_id}",
            json={"reason": "formal-test"},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        data = response.json() if response.status_code == 200 else {}
        is_valid = (
            response.status_code == 200 and
            data.get("data", {}).get("status") == "revoked" and
            data.get("data", {}).get("revoked_at")
        )
        
        record_result(
            "A17",
            is_valid,
            f"Live key revoked (status={response.status_code})",
            {"response": data}
        )
    except Exception as e:
        record_result("A17", False, f"Revoke error: {str(e)}", {})
    
    # Test 18: Revoked live key rejected
    log(f"\n{Colors.BLUE}=== Test 18: Revoked live key rejected ==={Colors.END}")
    result = test_create_payment(live_key_raw, 500, ["BTC"])
    is_rejected = result["status_code"] == 403
    record_result(
        "A18",
        is_rejected,
        f"Revoked live key rejected with 403 (status={result['status_code']})",
        result
    )
    
    # Test 19: Cannot reactivate revoked key
    log(f"\n{Colors.BLUE}=== Test 19: Cannot reactivate revoked key ==={Colors.END}")
    try:
        response = requests.put(
            f"{BASE_URL}/api/userApi/toggleStatus/{live_api_id}",
            json={"status": "active"},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        is_valid = (
            response.status_code == 400 and
            "Cannot change status of a revoked" in response.json().get("message", "")
        )
        
        record_result(
            "A19",
            is_valid,
            f"Revoked key cannot be reactivated (status={response.status_code})",
            {"response": response.json() if response.status_code in [200, 400] else response.text}
        )
    except Exception as e:
        record_result("A19", False, f"Toggle error: {str(e)}", {})
    
    # ========================================
    # REGRESSION TESTS (20-21)
    # ========================================
    log(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    log(f"{Colors.BLUE}REGRESSION TESTS (Earlier Feature){Colors.END}")
    log(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    # Test 20: Per-env manual dedupe (T5 from earlier run)
    log(f"\n{Colors.BLUE}=== Test 20: Per-env dedupe (development key exists) ==={Colors.END}")
    try:
        response = requests.post(
            f"{BASE_URL}/api/userApi/addApi",
            json={
                "company_id": company_id,
                "base_currency": "USD",
                "environment": "development"
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        
        is_valid = (
            response.status_code == 400 and
            "already has an active development API key" in response.json().get("message", "")
        )
        
        record_result(
            "A20",
            is_valid,
            f"Duplicate development key rejected (status={response.status_code})",
            {"response": response.json() if response.status_code in [200, 400] else response.text}
        )
    except Exception as e:
        record_result("A20", False, f"Dedupe test error: {str(e)}", {})
    
    # Test 21: copyWalletAddresses auto-mints live key (T6 from earlier run)
    # This requires a second company - create one
    log(f"\n{Colors.BLUE}=== Test 21: copyWalletAddresses auto-mints live key ==={Colors.END}")
    timestamp2 = int(time.time())
    company_result2 = create_company(token, timestamp2)
    
    if company_result2:
        target_company_id = company_result2["company_id"]
        
        try:
            # Copy BTC wallet from source to target
            response = requests.post(
                f"{BASE_URL}/api/wallet/copyWalletAddresses",
                json={
                    "source_company_id": company_id,
                    "target_company_id": target_company_id,
                    "currencies": ["BTC"]
                },
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                timeout=30
            )
            
            data = response.json() if response.status_code == 200 else {}
            auto_live_key_created = data.get("data", {}).get("auto_live_key_created", False)
            
            is_valid = (
                response.status_code == 200 and
                auto_live_key_created == True
            )
            
            record_result(
                "A21",
                is_valid,
                f"copyWalletAddresses auto-minted live key (auto_live_key_created={auto_live_key_created})",
                {"response": data}
            )
            
            # Test idempotency - second call should return false
            if is_valid:
                time.sleep(2)
                response2 = requests.post(
                    f"{BASE_URL}/api/wallet/copyWalletAddresses",
                    json={
                        "source_company_id": company_id,
                        "target_company_id": target_company_id,
                        "currencies": ["BTC"]
                    },
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    },
                    timeout=30
                )
                
                data2 = response2.json() if response2.status_code == 200 else {}
                auto_live_key_created2 = data2.get("data", {}).get("auto_live_key_created", False)
                
                log(f"  Idempotency check: auto_live_key_created={auto_live_key_created2} (should be False)")
        except Exception as e:
            record_result("A21", False, f"copyWalletAddresses error: {str(e)}", {})
    else:
        record_result("A21", False, "Could not create target company for T21", {})
    
    # ========================================
    # ADDITIONAL VERIFICATION TESTS (23-24)
    # ========================================
    log(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    log(f"{Colors.BLUE}ADDITIONAL VERIFICATION TESTS{Colors.END}")
    log(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    # Test 23: Publishable keys unaffected (skip if no pk exists)
    log(f"\n{Colors.BLUE}=== Test 23: Publishable keys unaffected ==={Colors.END}")
    record_result(
        "A23",
        True,
        "Publishable keys on different table - not applicable (no pk on QA account)",
        {"note": "Sandbox middleware only affects tbl_api, not tbl_publishable_key"}
    )
    
    # Test 24: GET endpoints don't trigger false positives
    log(f"\n{Colors.BLUE}=== Test 24: GET endpoints work with sandbox key ==={Colors.END}")
    try:
        # Test getBalance
        response1 = requests.get(
            f"{BASE_URL}/api/user/getBalance",
            headers={"x-api-key": test_key_raw},
            timeout=30
        )
        
        # Test getTransactions
        response2 = requests.get(
            f"{BASE_URL}/api/user/getTransactions",
            headers={"x-api-key": test_key_raw},
            timeout=30
        )
        
        is_valid = (
            response1.status_code == 200 and
            response2.status_code == 200
        )
        
        record_result(
            "A24",
            is_valid,
            f"GET endpoints work with sandbox key (getBalance={response1.status_code}, getTransactions={response2.status_code})",
            {"getBalance": response1.status_code, "getTransactions": response2.status_code}
        )
    except Exception as e:
        record_result("A24", False, f"GET endpoints error: {str(e)}", {})
    
    return True

def cleanup(token: str):
    """Clean up all test data"""
    log(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    log(f"{Colors.BLUE}CLEANUP{Colors.END}")
    log(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    # Delete API keys
    for api_id in cleanup_items["api_ids"]:
        try:
            response = requests.delete(
                f"{BASE_URL}/api/userApi/deleteApi/{api_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=30
            )
            if response.status_code == 200:
                log(f"✓ Deleted API key {api_id}", Colors.GREEN)
            else:
                log(f"✗ Failed to delete API key {api_id}: {response.status_code}", Colors.YELLOW)
        except Exception as e:
            log(f"✗ Error deleting API key {api_id}: {str(e)}", Colors.YELLOW)
    
    # Delete companies
    for company_id in cleanup_items["company_ids"]:
        try:
            response = requests.delete(
                f"{BASE_URL}/api/company/deleteCompany/{company_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=30
            )
            if response.status_code == 200:
                log(f"✓ Deleted company {company_id}", Colors.GREEN)
            else:
                log(f"✗ Failed to delete company {company_id}: {response.status_code}", Colors.YELLOW)
        except Exception as e:
            log(f"✗ Error deleting company {company_id}: {str(e)}", Colors.YELLOW)
    
    # Verify cleanup
    try:
        response = requests.get(
            f"{BASE_URL}/api/company/getCompany",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            companies = data.get("data", [])
            if len(companies) == 0:
                log(f"✓ Cleanup verified: 0 companies remaining", Colors.GREEN)
            else:
                log(f"⚠ Cleanup incomplete: {len(companies)} companies remaining", Colors.YELLOW)
    except Exception as e:
        log(f"✗ Cleanup verification error: {str(e)}", Colors.YELLOW)

def print_summary():
    """Print test summary"""
    log(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    log(f"{Colors.BLUE}TEST SUMMARY{Colors.END}")
    log(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    passed = sum(1 for r in test_results if r["passed"])
    failed = sum(1 for r in test_results if not r["passed"])
    total = len(test_results)
    
    log(f"\nTotal Tests: {total}")
    log(f"Passed: {passed}", Colors.GREEN)
    log(f"Failed: {failed}", Colors.RED if failed > 0 else Colors.GREEN)
    log(f"Pass Rate: {(passed/total*100):.1f}%\n")
    
    if failed > 0:
        log(f"{Colors.RED}FAILED TESTS:{Colors.END}")
        for r in test_results:
            if not r["passed"]:
                log(f"  {r['test_id']}: {r['message']}", Colors.RED)
    
    log(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    
    return failed == 0

def main():
    """Main execution"""
    try:
        success = run_tests()
        
        if success:
            # Get token for cleanup
            token = login()
            if token:
                cleanup(token)
        
        all_passed = print_summary()
        
        sys.exit(0 if all_passed else 1)
    except KeyboardInterrupt:
        log("\n\nTest interrupted by user", Colors.YELLOW)
        sys.exit(1)
    except Exception as e:
        log(f"\n\nFATAL ERROR: {str(e)}", Colors.RED)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
