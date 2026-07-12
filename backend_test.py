#!/usr/bin/env python3
"""
Backend Test Suite for Session 37: Invoice fixed_fee = $0.00 bug fix
Tests the NEW read-only endpoint GET /api/transactions/:id/invoice-preview
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Base URL
BASE_URL = "https://62fabf57-7aa4-49d7-b5cf-93ca135cec6b.preview.emergentagent.com/api"

# Test credentials
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

# User-Agent header (required)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json"
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def log(message: str, color: str = Colors.RESET):
    print(f"{color}{message}{Colors.RESET}")

def login() -> Optional[str]:
    """Login and return access token"""
    log("\n=== AUTHENTICATION ===", Colors.BLUE)
    
    try:
        response = requests.post(
            f"{BASE_URL}/user/login",
            headers=HEADERS,
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=30
        )
        
        log(f"POST /api/user/login: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("data", {}).get("accessToken")
            if token:
                log(f"✓ Login successful (user_id: {data.get('data', {}).get('userData', {}).get('user_id')})", Colors.GREEN)
                return token
            else:
                log("✗ No accessToken in response", Colors.RED)
                return None
        else:
            log(f"✗ Login failed: {response.text}", Colors.RED)
            return None
            
    except Exception as e:
        log(f"✗ Login error: {str(e)}", Colors.RED)
        return None

def test_invoice_preview(token: str, tx_id: int, expected_fixed_fee: float, description: str) -> bool:
    """Test invoice-preview endpoint for a transaction"""
    log(f"\n--- Test: {description} (tx {tx_id}) ---", Colors.YELLOW)
    
    try:
        headers = {**HEADERS, "Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BASE_URL}/transactions/{tx_id}/invoice-preview",
            headers=headers,
            timeout=30
        )
        
        log(f"GET /api/transactions/{tx_id}/invoice-preview: {response.status_code}")
        
        if response.status_code != 200:
            log(f"✗ Expected 200, got {response.status_code}: {response.text}", Colors.RED)
            return False
        
        data = response.json().get("data", {})
        
        # Extract key fields
        fixed_fee = data.get("fixed_fee")
        transaction_fee_percent = data.get("transaction_fee_percent")
        transaction_fee_amount = data.get("transaction_fee_amount")
        unit_price = data.get("unit_price")
        base_currency = data.get("base_currency")
        usd_value = data.get("usd_value")
        
        log(f"  fixed_fee: {fixed_fee}")
        log(f"  transaction_fee_percent: {transaction_fee_percent}")
        log(f"  transaction_fee_amount: {transaction_fee_amount}")
        log(f"  unit_price: {unit_price}")
        log(f"  base_currency: {base_currency}")
        log(f"  usd_value: {usd_value}")
        
        # Primary assertion: fixed_fee must be 1.00 (NOT 0.00)
        if fixed_fee is None:
            log(f"✗ fixed_fee is None", Colors.RED)
            return False
        
        if abs(float(fixed_fee) - expected_fixed_fee) > 0.01:
            log(f"✗ FAIL: fixed_fee = {fixed_fee}, expected {expected_fixed_fee}", Colors.RED)
            return False
        
        log(f"✓ PASS: fixed_fee = {fixed_fee} (expected {expected_fixed_fee})", Colors.GREEN)
        return True
        
    except Exception as e:
        log(f"✗ Error: {str(e)}", Colors.RED)
        return False

def test_security_no_auth(tx_id: int) -> bool:
    """Test that endpoint requires authentication"""
    log(f"\n--- Test: Security - No Authorization header (tx {tx_id}) ---", Colors.YELLOW)
    
    try:
        response = requests.get(
            f"{BASE_URL}/transactions/{tx_id}/invoice-preview",
            headers=HEADERS,  # No Authorization header
            timeout=30
        )
        
        log(f"GET /api/transactions/{tx_id}/invoice-preview (no auth): {response.status_code}")
        
        if response.status_code == 401:
            log(f"✓ PASS: Correctly returned 401 Unauthorized", Colors.GREEN)
            return True
        else:
            log(f"✗ FAIL: Expected 401, got {response.status_code}", Colors.RED)
            return False
            
    except Exception as e:
        log(f"✗ Error: {str(e)}", Colors.RED)
        return False

def test_regression_invoices(token: str) -> bool:
    """Test that existing invoice endpoints still work"""
    log(f"\n--- Test: Regression - GET /api/invoices ---", Colors.YELLOW)
    
    try:
        headers = {**HEADERS, "Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BASE_URL}/invoices",
            headers=headers,
            timeout=30
        )
        
        log(f"GET /api/invoices: {response.status_code}")
        
        if response.status_code != 200:
            log(f"✗ FAIL: Expected 200, got {response.status_code}", Colors.RED)
            return False
        
        data = response.json().get("data", {})
        invoices = data.get("invoices", [])
        log(f"  Found {len(invoices)} invoices")
        log(f"✓ PASS: Invoice list endpoint working", Colors.GREEN)
        return True
        
    except Exception as e:
        log(f"✗ Error: {str(e)}", Colors.RED)
        return False

def test_regression_invoice_detail(token: str) -> bool:
    """Test GET /api/invoices/:id endpoint"""
    log(f"\n--- Test: Regression - GET /api/invoices/:id ---", Colors.YELLOW)
    
    try:
        # First get list to find an invoice ID
        headers = {**HEADERS, "Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BASE_URL}/invoices",
            headers=headers,
            timeout=30
        )
        
        if response.status_code != 200:
            log(f"✗ Could not get invoice list", Colors.RED)
            return False
        
        data = response.json().get("data", {})
        invoices = data.get("invoices", [])
        
        if not invoices:
            log(f"⚠ No invoices found, skipping detail test", Colors.YELLOW)
            return True
        
        invoice_id = invoices[0].get("invoice_id")
        log(f"Testing with invoice_id: {invoice_id}")
        
        # Test detail endpoint
        response = requests.get(
            f"{BASE_URL}/invoices/{invoice_id}",
            headers=headers,
            timeout=30
        )
        
        log(f"GET /api/invoices/{invoice_id}: {response.status_code}")
        
        if response.status_code != 200:
            log(f"✗ FAIL: Expected 200, got {response.status_code}", Colors.RED)
            return False
        
        invoice_data = response.json().get("data", {})
        
        # Check for provider_vat_id field (BUG E fix verification)
        if "provider_vat_id" in invoice_data:
            log(f"  provider_vat_id: {invoice_data.get('provider_vat_id')}")
            log(f"✓ PASS: Invoice detail endpoint working, provider_vat_id present", Colors.GREEN)
        else:
            log(f"⚠ provider_vat_id field missing (expected from BUG E fix)", Colors.YELLOW)
            log(f"✓ PASS: Invoice detail endpoint working", Colors.GREEN)
        
        return True
        
    except Exception as e:
        log(f"✗ Error: {str(e)}", Colors.RED)
        return False

def test_regression_invoice_pdf(token: str) -> bool:
    """Test GET /api/invoices/:id/pdf endpoint"""
    log(f"\n--- Test: Regression - GET /api/invoices/:id/pdf ---", Colors.YELLOW)
    
    try:
        # First get list to find an invoice ID
        headers = {**HEADERS, "Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BASE_URL}/invoices",
            headers=headers,
            timeout=30
        )
        
        if response.status_code != 200:
            log(f"✗ Could not get invoice list", Colors.RED)
            return False
        
        data = response.json().get("data", {})
        invoices = data.get("invoices", [])
        
        if not invoices:
            log(f"⚠ No invoices found, skipping PDF test", Colors.YELLOW)
            return True
        
        invoice_id = invoices[0].get("invoice_id")
        log(f"Testing with invoice_id: {invoice_id}")
        
        # Test PDF endpoint
        response = requests.get(
            f"{BASE_URL}/invoices/{invoice_id}/pdf",
            headers=headers,
            timeout=30
        )
        
        log(f"GET /api/invoices/{invoice_id}/pdf: {response.status_code}")
        
        if response.status_code != 200:
            log(f"✗ FAIL: Expected 200, got {response.status_code}", Colors.RED)
            return False
        
        # Check Content-Type
        content_type = response.headers.get("Content-Type", "")
        if "application/pdf" not in content_type:
            log(f"✗ FAIL: Expected Content-Type application/pdf, got {content_type}", Colors.RED)
            return False
        
        # Check PDF magic bytes
        if not response.content.startswith(b"%PDF"):
            log(f"✗ FAIL: Response does not start with %PDF", Colors.RED)
            return False
        
        log(f"  Content-Type: {content_type}")
        log(f"  PDF size: {len(response.content)} bytes")
        log(f"✓ PASS: PDF endpoint working", Colors.GREEN)
        return True
        
    except Exception as e:
        log(f"✗ Error: {str(e)}", Colors.RED)
        return False

def main():
    log("=" * 80, Colors.BLUE)
    log("Session 37: Invoice fixed_fee = $0.00 Bug Fix - Backend Test Suite", Colors.BLUE)
    log("=" * 80, Colors.BLUE)
    
    # Login
    token = login()
    if not token:
        log("\n✗ FATAL: Could not authenticate", Colors.RED)
        sys.exit(1)
    
    results = []
    
    # PRIMARY TESTS - New invoice-preview endpoint
    log("\n" + "=" * 80, Colors.BLUE)
    log("PRIMARY TESTS - Invoice Preview Endpoint", Colors.BLUE)
    log("=" * 80, Colors.BLUE)
    
    # Test 1: tx 383 (BTC, $37.35 - the reported bug case)
    results.append(("T1: tx 383 (BTC $37.35 - reported bug)", 
                    test_invoice_preview(token, 383, 1.00, "BTC $37.35 (reported bug case)")))
    
    # Test 2: tx 382 (ETH, $58.14)
    results.append(("T2: tx 382 (ETH $58.14)", 
                    test_invoice_preview(token, 382, 1.00, "ETH $58.14")))
    
    # Test 3: tx 388 (BTC, $100.22 - tier gap case)
    results.append(("T3: tx 388 (BTC $100.22 - tier gap)", 
                    test_invoice_preview(token, 388, 1.00, "BTC $100.22 (tier gap fallback)")))
    
    # Test 4: tx 390 (USDT-TRC20, $24.62 - control)
    results.append(("T4: tx 390 (USDT-TRC20 $24.62 - control)", 
                    test_invoice_preview(token, 390, 1.00, "USDT-TRC20 $24.62 (control)")))
    
    # SECURITY TEST
    log("\n" + "=" * 80, Colors.BLUE)
    log("SECURITY TEST", Colors.BLUE)
    log("=" * 80, Colors.BLUE)
    
    # Test 5: No auth should return 401
    results.append(("T5: Security - No auth returns 401", 
                    test_security_no_auth(383)))
    
    # REGRESSION TESTS
    log("\n" + "=" * 80, Colors.BLUE)
    log("REGRESSION TESTS - Existing Invoice Endpoints", Colors.BLUE)
    log("=" * 80, Colors.BLUE)
    
    # Test 6: GET /api/invoices
    results.append(("T6: Regression - GET /api/invoices", 
                    test_regression_invoices(token)))
    
    # Test 7: GET /api/invoices/:id
    results.append(("T7: Regression - GET /api/invoices/:id", 
                    test_regression_invoice_detail(token)))
    
    # Test 8: GET /api/invoices/:id/pdf
    results.append(("T8: Regression - GET /api/invoices/:id/pdf", 
                    test_regression_invoice_pdf(token)))
    
    # Summary
    log("\n" + "=" * 80, Colors.BLUE)
    log("TEST SUMMARY", Colors.BLUE)
    log("=" * 80, Colors.BLUE)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = f"{Colors.GREEN}✓ PASS{Colors.RESET}" if result else f"{Colors.RED}✗ FAIL{Colors.RESET}"
        log(f"{status} - {test_name}")
    
    log("\n" + "=" * 80, Colors.BLUE)
    if passed == total:
        log(f"ALL TESTS PASSED: {passed}/{total}", Colors.GREEN)
        log("=" * 80, Colors.BLUE)
        sys.exit(0)
    else:
        log(f"SOME TESTS FAILED: {passed}/{total} passed", Colors.RED)
        log("=" * 80, Colors.BLUE)
        sys.exit(1)

if __name__ == "__main__":
    main()
