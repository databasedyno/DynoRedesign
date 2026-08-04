#!/usr/bin/env python3
"""
Backend Test for Fiat Everywhere Export Math Consistency
Session: AUDIT - Fiat Everywhere Export math consistency check

CRITICAL TEST: Verify Tax Report CSV "Processing Fee" column fix for v2 invoices.
Before fix: CSV showed fixed_fee ($1.00) instead of unit_price ($1.87).
After fix: CSV should show unit_price for v2 invoices.

SAFETY: READ-ONLY tests + ONE narrow display_currency PATCH round-trip (MUST revert).
NO invoice/transaction/wallet mutations. NO email sends.
"""

import requests
import json
import sys
import csv
import io
from typing import Dict, Any, Tuple, Optional

# Preview URL from test_credentials.md
BASE_URL = "https://ef9cfbd5-49dc-47eb-a889-3ffe77508b90.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
MERCHANT_EMAIL = "hostbay@moxx.co"
MERCHANT_PASSWORD = "Katiekendra123@"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    END = '\033[0m'

def print_section(name: str):
    print(f"\n{Colors.CYAN}{'='*100}{Colors.END}")
    print(f"{Colors.CYAN}{name}{Colors.END}")
    print(f"{Colors.CYAN}{'='*100}{Colors.END}")

def print_test(name: str):
    print(f"\n{Colors.BLUE}{'─'*100}{Colors.END}")
    print(f"{Colors.BLUE}TEST: {name}{Colors.END}")
    print(f"{Colors.BLUE}{'─'*100}{Colors.END}")

def print_pass(message: str):
    print(f"{Colors.GREEN}✓ PASS: {message}{Colors.END}")

def print_fail(message: str):
    print(f"{Colors.RED}✗ FAIL: {message}{Colors.END}")

def print_info(message: str):
    print(f"{Colors.YELLOW}ℹ INFO: {message}{Colors.END}")

def print_data(label: str, data: Any):
    print(f"{Colors.MAGENTA}{label}:{Colors.END}")
    if isinstance(data, (dict, list)):
        print(json.dumps(data, indent=2))
    else:
        print(data)

def login() -> Tuple[bool, str, str]:
    """Login and get access token + CSRF token"""
    print_test("Login as hostbay@moxx.co")
    
    try:
        session = requests.Session()
        
        # Get CSRF token first
        csrf_response = session.get(f"{API_BASE}/csrf-token", timeout=10)
        csrf_token = ""
        if csrf_response.status_code == 200:
            csrf_data = csrf_response.json()
            csrf_token = csrf_data.get("data", {}).get("csrfToken", "")
            print_info(f"CSRF Token: {csrf_token[:20]}...")
        
        # Login
        login_data = {
            "email": MERCHANT_EMAIL,
            "password": MERCHANT_PASSWORD
        }
        
        headers = {}
        if csrf_token:
            headers["X-CSRF-Token"] = csrf_token
        
        response = session.post(
            f"{API_BASE}/user/login",
            json=login_data,
            headers=headers,
            timeout=10
        )
        
        print_info(f"Login Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            # Extract token
            token = None
            if isinstance(data, dict):
                token = (data.get("token") or 
                        data.get("accessToken") or 
                        data.get("data", {}).get("token") or 
                        data.get("data", {}).get("accessToken"))
            
            if token:
                print_pass(f"Login successful, token: {token[:30]}...")
                return True, token, csrf_token
            else:
                print_fail("Login response missing token")
                return False, "", ""
        else:
            print_fail(f"Login failed: {response.status_code}")
            print_info(f"Response: {response.text[:500]}")
            return False, "", ""
            
    except Exception as e:
        print_fail(f"Login exception: {str(e)}")
        return False, "", ""

def get_display_currency(token: str) -> Tuple[bool, Dict[str, Any]]:
    """Step 1: Get current display currency setting"""
    print_test("Step 1: GET /api/user/display-currency (Baseline)")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{API_BASE}/user/display-currency",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            result = data.get("data", {})
            print_data("Display Currency", result)
            
            display_currency = result.get("display_currency")
            user_override = result.get("user_override")
            source = result.get("source")
            rate = result.get("usd_to_display_rate")
            
            print_info(f"display_currency={display_currency}, user_override={user_override}, source={source}, rate={rate}")
            
            if display_currency == "USD" and user_override is None and source == "company" and rate == 1:
                print_pass("Baseline state confirmed: USD/None/company/rate=1")
                return True, result
            else:
                print_info(f"Current state: {display_currency}/{user_override}/{source}/{rate}")
                return True, result
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            return False, {}
            
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False, {}

def get_invoices(token: str, limit: int = 6) -> Tuple[bool, list]:
    """Step 2a: Get invoices list"""
    print_test(f"Step 2a: GET /api/invoices?limit={limit}")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{API_BASE}/invoices?limit={limit}",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            invoices = data.get("data", {}).get("invoices", [])
            print_info(f"Retrieved {len(invoices)} invoices")
            
            # Print key fields for first few invoices
            for i, inv in enumerate(invoices[:3]):
                print_info(f"Invoice {i+1}: id={inv.get('invoice_id')}, "
                          f"total_usd={inv.get('total_usd')}, "
                          f"unit_price={inv.get('unit_price')}, "
                          f"processing_fee={inv.get('processing_fee')}, "
                          f"version={inv.get('invoice_version')}")
            
            print_pass(f"Retrieved {len(invoices)} invoices")
            return True, invoices
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            return False, []
            
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False, []

def get_tax_report(token: str, group_by: str = "month") -> Tuple[bool, Dict[str, Any]]:
    """Step 2b: Get tax report JSON"""
    print_test(f"Step 2b: GET /api/invoices/tax-report?group_by={group_by}")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{API_BASE}/invoices/tax-report?group_by={group_by}",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            result = data.get("data", {})
            summary = result.get("summary", {})
            
            print_data("Summary", summary)
            print_info(f"Total Revenue: {summary.get('total_revenue')}")
            print_info(f"Total Tax: {summary.get('total_tax')}")
            print_info(f"Total Invoices: {summary.get('total_invoices')}")
            print_info(f"Display Currency: {summary.get('display_currency')}")
            print_info(f"USD to Display Rate: {summary.get('usd_to_display_rate')}")
            
            print_pass("Tax report retrieved")
            return True, result
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            return False, {}
            
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False, {}

def get_tax_report_csv(token: str) -> Tuple[bool, str, list]:
    """Step 2c: Get tax report CSV"""
    print_test("Step 2c: GET /api/invoices/tax-report/csv")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{API_BASE}/invoices/tax-report/csv",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            csv_text = response.text
            print_info(f"CSV length: {len(csv_text)} bytes")
            
            # Parse CSV
            csv_reader = csv.DictReader(io.StringIO(csv_text))
            rows = list(csv_reader)
            
            print_info(f"CSV has {len(rows)} data rows")
            print_info(f"CSV header: {csv_reader.fieldnames}")
            
            # Show first row
            if rows:
                print_data("First CSV row", rows[0])
            
            print_pass(f"CSV retrieved with {len(rows)} rows")
            return True, csv_text, rows
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            return False, "", []
            
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False, "", []

def set_display_currency(token: str, csrf_token: str, currency: str) -> Tuple[bool, Dict[str, Any]]:
    """Step 3: Set display currency"""
    print_test(f"Step 3: PATCH /api/user/display-currency (Set to {currency})")
    
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "X-CSRF-Token": csrf_token
        }
        
        payload = {"display_currency": currency}
        
        response = requests.patch(
            f"{API_BASE}/user/display-currency",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            result = data.get("data", {})
            print_data("Response", result)
            
            print_pass(f"Display currency set to {currency}")
            return True, result
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text[:500]}")
            return False, {}
            
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False, {}

def verify_csv_math(csv_rows: list, currency: str, expected_rate: float) -> Tuple[bool, list]:
    """Verify CSV math consistency"""
    print_test(f"Verify CSV Math Consistency ({currency})")
    
    issues = []
    
    for i, row in enumerate(csv_rows):
        invoice_num = row.get("Invoice Number", "")
        subtotal = float(row.get(f"Subtotal ({currency})", 0))
        vat_amount = float(row.get(f"VAT Amount ({currency})", 0))
        processing_fee = float(row.get(f"Processing Fee ({currency})", 0))
        total = float(row.get(f"Total ({currency})", 0))
        
        # Check arithmetic identity: subtotal + vatAmount ≈ total
        calculated_total = subtotal + vat_amount
        delta = abs(calculated_total - total)
        
        if delta > 0.02:  # Allow 2 cent tolerance
            issue = f"Row {i+1} ({invoice_num}): subtotal({subtotal}) + vat({vat_amount}) = {calculated_total} != total({total}), delta={delta}"
            issues.append(issue)
            print_fail(issue)
        else:
            print_info(f"Row {i+1} ({invoice_num}): Math OK - subtotal({subtotal}) + vat({vat_amount}) ≈ total({total})")
    
    if not issues:
        print_pass(f"All {len(csv_rows)} rows pass arithmetic identity check")
        return True, []
    else:
        print_fail(f"{len(issues)} rows failed arithmetic check")
        return False, issues

def verify_processing_fee_fix(csv_rows: list, invoices: list, currency: str, rate: float) -> Tuple[bool, list]:
    """
    CRITICAL: Verify Processing Fee column shows unit_price (not fixed_fee) for v2 invoices.
    
    For v2 invoices with unit_price=$1.87 and fixed_fee=$1.00:
    - CSV Processing Fee at EUR (rate=0.87) should be ~€1.63 (=1.87×0.87)
    - NOT ~€0.87 (=1.00×0.87) which was the bug
    """
    print_test(f"CRITICAL: Verify Processing Fee Fix for v2 Invoices ({currency})")
    
    issues = []
    
    # Build invoice lookup by invoice_number
    invoice_lookup = {}
    for inv in invoices:
        invoice_lookup[inv.get("invoice_number")] = inv
    
    for i, row in enumerate(csv_rows):
        invoice_num = row.get("Invoice Number", "")
        csv_processing_fee = float(row.get(f"Processing Fee ({currency})", 0))
        
        # Find matching invoice from API
        inv = invoice_lookup.get(invoice_num)
        if not inv:
            continue
        
        version = inv.get("invoice_version", "v1")
        unit_price = float(inv.get("unit_price", 0))
        
        # For v2 invoices, CSV Processing Fee should equal unit_price × rate
        if version == "v2":
            expected_fee = unit_price * rate
            delta = abs(csv_processing_fee - expected_fee)
            
            if delta > 0.02:  # 2 cent tolerance
                issue = (f"Row {i+1} ({invoice_num}): v2 invoice - "
                        f"CSV Processing Fee={csv_processing_fee} {currency}, "
                        f"expected={expected_fee:.2f} (unit_price={unit_price} × rate={rate}), "
                        f"delta={delta:.2f}")
                issues.append(issue)
                print_fail(issue)
            else:
                print_info(f"Row {i+1} ({invoice_num}): v2 OK - "
                          f"CSV fee={csv_processing_fee} ≈ unit_price({unit_price}) × rate({rate}) = {expected_fee:.2f}")
    
    if not issues:
        print_pass(f"All v2 invoices show correct Processing Fee (unit_price × rate)")
        return True, []
    else:
        print_fail(f"{len(issues)} v2 invoices have incorrect Processing Fee")
        return False, issues

def verify_csv_header(csv_text: str, currency: str) -> bool:
    """Verify CSV header has correct currency suffix"""
    print_test(f"Verify CSV Header ({currency})")
    
    lines = csv_text.split('\n')
    if not lines:
        print_fail("CSV is empty")
        return False
    
    header = lines[0]
    print_info(f"Header: {header}")
    
    required_columns = [
        f"Subtotal ({currency})",
        f"VAT Amount ({currency})",
        f"Processing Fee ({currency})",
        f"Total ({currency})",
        "Display Currency",
        "Payment Currency"
    ]
    
    missing = []
    for col in required_columns:
        if col not in header:
            missing.append(col)
    
    if missing:
        print_fail(f"Missing columns: {missing}")
        return False
    else:
        print_pass(f"CSV header has all required columns with ({currency}) suffix")
        return True

def get_invoice_pdf(token: str, invoice_id: int) -> Tuple[bool, bytes]:
    """Step 4c: Get invoice PDF"""
    print_test(f"Step 4c: GET /api/invoices/{invoice_id}/pdf")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{API_BASE}/invoices/{invoice_id}/pdf",
            headers=headers,
            timeout=30
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            pdf_bytes = response.content
            print_info(f"PDF size: {len(pdf_bytes)} bytes")
            print_pass(f"PDF retrieved for invoice {invoice_id}")
            return True, pdf_bytes
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            return False, b""
            
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False, b""

def main():
    print_section("FIAT EVERYWHERE EXPORT MATH CONSISTENCY TEST")
    print(f"{Colors.YELLOW}Preview URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.YELLOW}Test Type: READ-ONLY + display_currency PATCH round-trip{Colors.END}")
    print(f"{Colors.YELLOW}CRITICAL: Verify Processing Fee fix for v2 invoices{Colors.END}\n")
    
    results = {}
    baseline_data = {}
    eur_data = {}
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 0: Login
    # ═══════════════════════════════════════════════════════════════════════
    print_section("STEP 0: LOGIN")
    success, token, csrf_token = login()
    if not success:
        print_fail("Login failed, cannot continue")
        return 1
    results["login"] = True
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 1: Baseline USD reads
    # ═══════════════════════════════════════════════════════════════════════
    print_section("STEP 1: BASELINE USD READS")
    
    # 1a: Get display currency
    success, display_curr = get_display_currency(token)
    results["step1_display_currency"] = success
    baseline_data["display_currency"] = display_curr
    
    # 1b: Get invoices
    success, invoices = get_invoices(token, limit=6)
    results["step1_invoices"] = success
    baseline_data["invoices"] = invoices
    
    # 1c: Get tax report JSON
    success, tax_report = get_tax_report(token)
    results["step1_tax_report"] = success
    baseline_data["tax_report"] = tax_report
    
    # 1d: Get tax report CSV
    success, csv_text, csv_rows = get_tax_report_csv(token)
    results["step1_tax_csv"] = success
    baseline_data["csv_text"] = csv_text
    baseline_data["csv_rows"] = csv_rows
    
    # Verify CSV header (USD)
    if csv_text:
        success = verify_csv_header(csv_text, "USD")
        results["step1_csv_header"] = success
    
    # Verify CSV math (USD)
    if csv_rows:
        success, issues = verify_csv_math(csv_rows, "USD", 1.0)
        results["step1_csv_math"] = success
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 2: Set EUR
    # ═══════════════════════════════════════════════════════════════════════
    print_section("STEP 2: SET DISPLAY CURRENCY TO EUR")
    
    success, result = set_display_currency(token, csrf_token, "EUR")
    results["step2_set_eur"] = success
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 3: EUR reads
    # ═══════════════════════════════════════════════════════════════════════
    print_section("STEP 3: EUR READS")
    
    # 3a: Get tax report JSON (EUR)
    success, tax_report_eur = get_tax_report(token)
    results["step3_tax_report_eur"] = success
    eur_data["tax_report"] = tax_report_eur
    
    # Verify EUR rate
    if tax_report_eur:
        summary = tax_report_eur.get("summary", {})
        display_currency = summary.get("display_currency")
        rate = summary.get("usd_to_display_rate")
        
        if display_currency == "EUR" and rate and 0.85 <= rate <= 0.89:
            print_pass(f"EUR rate verified: {rate} (within 0.85-0.89 range)")
            results["step3_eur_rate"] = True
        else:
            print_fail(f"EUR rate issue: currency={display_currency}, rate={rate}")
            results["step3_eur_rate"] = False
    
    # 3b: Get tax report CSV (EUR)
    success, csv_text_eur, csv_rows_eur = get_tax_report_csv(token)
    results["step3_tax_csv_eur"] = success
    eur_data["csv_text"] = csv_text_eur
    eur_data["csv_rows"] = csv_rows_eur
    
    # Verify CSV header (EUR)
    if csv_text_eur:
        success = verify_csv_header(csv_text_eur, "EUR")
        results["step3_csv_header_eur"] = success
    
    # Verify CSV math (EUR)
    if csv_rows_eur:
        eur_rate = tax_report_eur.get("summary", {}).get("usd_to_display_rate", 0.87)
        success, issues = verify_csv_math(csv_rows_eur, "EUR", eur_rate)
        results["step3_csv_math_eur"] = success
        
        # CRITICAL: Verify Processing Fee fix for v2 invoices
        success, issues = verify_processing_fee_fix(csv_rows_eur, invoices, "EUR", eur_rate)
        results["step3_processing_fee_fix"] = success
    
    # 3c: Get invoice #6 PDF (if available)
    if invoices and len(invoices) >= 6:
        invoice_6 = invoices[5]  # 0-indexed
        invoice_id = invoice_6.get("invoice_id")
        if invoice_id:
            success, pdf_bytes = get_invoice_pdf(token, invoice_id)
            results["step3_invoice_pdf"] = success
            
            # Note: We can't easily extract text from PDF in Python without pdftotext
            # Just verify we got a PDF
            if pdf_bytes and len(pdf_bytes) > 1000:
                print_pass(f"PDF retrieved, size={len(pdf_bytes)} bytes")
            else:
                print_info("PDF size seems small, may not be valid")
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 4: REVERT to USD (MANDATORY)
    # ═══════════════════════════════════════════════════════════════════════
    print_section("STEP 4: REVERT DISPLAY CURRENCY TO USD (MANDATORY)")
    
    success, result = set_display_currency(token, csrf_token, None)
    results["step4_revert"] = success
    
    # Verify revert
    success, display_curr_final = get_display_currency(token)
    results["step4_verify_revert"] = success
    
    if display_curr_final:
        display_currency = display_curr_final.get("display_currency")
        user_override = display_curr_final.get("user_override")
        source = display_curr_final.get("source")
        rate = display_curr_final.get("usd_to_display_rate") or display_curr_final.get("rate")
        
        # Rate may be None or 1 for USD (identity conversion)
        rate_ok = (rate == 1 or (rate is None and display_currency == "USD"))
        
        if display_currency == "USD" and user_override is None and source == "company" and rate_ok:
            print_pass(f"✓ REVERT CONFIRMED: display_currency=USD, user_override=None, source=company, rate={rate or 1}")
            results["step4_revert_confirmed"] = True
        else:
            print_fail(f"✗ REVERT FAILED: {display_currency}/{user_override}/{source}/{rate}")
            results["step4_revert_confirmed"] = False
    
    # ═══════════════════════════════════════════════════════════════════════
    # SUMMARY
    # ═══════════════════════════════════════════════════════════════════════
    print_section("TEST SUMMARY")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"\n{Colors.BLUE}Results by Step:{Colors.END}\n")
    for test_name, result in results.items():
        status = f"{Colors.GREEN}✓ PASS{Colors.END}" if result else f"{Colors.RED}✗ FAIL{Colors.END}"
        print(f"{status} - {test_name}")
    
    print(f"\n{Colors.CYAN}{'='*100}{Colors.END}")
    
    # Critical checks
    critical_checks = [
        ("Login", results.get("login", False)),
        ("Processing Fee Fix (v2 invoices)", results.get("step3_processing_fee_fix", False)),
        ("CSV Math Consistency (EUR)", results.get("step3_csv_math_eur", False)),
        ("Revert Confirmed", results.get("step4_revert_confirmed", False)),
    ]
    
    all_critical_pass = all(check[1] for check in critical_checks)
    
    print(f"\n{Colors.BLUE}Critical Checks:{Colors.END}\n")
    for name, result in critical_checks:
        status = f"{Colors.GREEN}✓ PASS{Colors.END}" if result else f"{Colors.RED}✗ FAIL{Colors.END}"
        print(f"{status} - {name}")
    
    print(f"\n{Colors.CYAN}{'='*100}{Colors.END}")
    
    if all_critical_pass:
        print(f"{Colors.GREEN}✓ ALL CRITICAL TESTS PASSED{Colors.END}")
        print(f"{Colors.GREEN}✓ Processing Fee fix verified: v2 invoices show unit_price (not fixed_fee){Colors.END}")
        print(f"{Colors.GREEN}✓ CSV math consistency verified across USD and EUR{Colors.END}")
        print(f"{Colors.GREEN}✓ Display currency reverted to USD/None/company/rate=1{Colors.END}")
        print(f"{Colors.CYAN}{'='*100}{Colors.END}\n")
        return 0
    else:
        print(f"{Colors.RED}✗ SOME CRITICAL TESTS FAILED{Colors.END}")
        print(f"{Colors.YELLOW}Total: {passed}/{total} tests passed{Colors.END}")
        print(f"{Colors.CYAN}{'='*100}{Colors.END}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
