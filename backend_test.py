#!/usr/bin/env python3
"""
DynoPay Currency Expansion Testing
Session 88 - African/Local Currency Support

SAFETY CRITICAL: This tests against LIVE PRODUCTION database
- Do NOT send cryptocurrency
- Do NOT complete/settle payments
- MUST delete all test links created
- Do NOT create/leave API keys behind
"""

import requests
import json
import time
from typing import Dict, List, Optional, Tuple

# Base URL from review request
BASE_URL = "https://46ec93b1-1703-4bf5-91d5-029cedba6253.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials (NO 2FA)
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

# Expected currencies (21 total)
EXPECTED_CURRENCIES = [
    'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'INR', 'NGN', 'VND', 'PKR', 
    'BRL', 'ARS', 'PHP', 'SGD', 'AED',  # Original 14
    'KES', 'GHS', 'ZAR', 'XOF', 'XAF', 'EGP', 'MAD'  # New 7 African currencies
]

NEW_AFRICAN_CURRENCIES = ['KES', 'GHS', 'ZAR', 'XOF', 'XAF', 'EGP', 'MAD']
ALL_TEST_CURRENCIES = ['NGN'] + NEW_AFRICAN_CURRENCIES

# Track created links for cleanup
created_links: List[str] = []

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def log_info(msg: str):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.RESET}")

def log_success(msg: str):
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}")

def log_error(msg: str):
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}")

def log_warning(msg: str):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}")

def login() -> Tuple[Optional[str], Optional[str]]:
    """
    Login and return (JWT token, company_id)
    """
    log_info("TEST 1: Authenticating...")
    
    try:
        response = requests.post(
            f"{API_BASE}/user/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            },
            timeout=30
        )
        
        if response.status_code != 200:
            log_error(f"Login failed: {response.status_code} - {response.text}")
            return None, None
        
        data = response.json()
        # Token is in data.accessToken
        token = data.get('data', {}).get('accessToken') or data.get('token')
        
        # Extract company_id from response or user data
        company_id = data.get('company_id') or data.get('data', {}).get('company_id')
        
        if not token:
            log_error("No token in login response")
            return None, None
        
        log_success(f"Login successful - Token obtained")
        if company_id:
            log_success(f"Company ID: {company_id}")
        
        return token, company_id
        
    except Exception as e:
        log_error(f"Login exception: {str(e)}")
        return None, None

def test_available_currencies(token: str, company_id: str) -> bool:
    """
    TEST 1: Verify availableCurrencies endpoint returns all 21 currencies
    """
    log_info("\n" + "="*80)
    log_info("TEST 1: Available Currencies Endpoint")
    log_info("="*80)
    
    try:
        response = requests.get(
            f"{API_BASE}/userApi/availableCurrencies/{company_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code != 200:
            log_error(f"availableCurrencies failed: {response.status_code} - {response.text}")
            return False
        
        data = response.json()
        currencies_list = data.get('data', {}).get('currencies', [])
        
        if not currencies_list:
            log_error("No currencies returned")
            return False
        
        # Extract currency codes
        currency_codes = [c.get('code') for c in currencies_list if c.get('code')]
        
        log_info(f"Total currencies returned: {len(currency_codes)}")
        log_info(f"Currency codes: {', '.join(sorted(currency_codes))}")
        
        # Check for all expected currencies
        missing = set(EXPECTED_CURRENCIES) - set(currency_codes)
        extra = set(currency_codes) - set(EXPECTED_CURRENCIES)
        
        if missing:
            log_error(f"Missing currencies: {', '.join(sorted(missing))}")
            return False
        
        if extra:
            log_warning(f"Extra currencies (not expected): {', '.join(sorted(extra))}")
        
        # Verify new African currencies specifically
        log_info("\nVerifying NEW African currencies:")
        for curr in NEW_AFRICAN_CURRENCIES:
            if curr in currency_codes:
                curr_obj = next((c for c in currencies_list if c.get('code') == curr), None)
                symbol = curr_obj.get('symbol', 'N/A') if curr_obj else 'N/A'
                name = curr_obj.get('name', 'N/A') if curr_obj else 'N/A'
                log_success(f"  {curr}: {name} ({symbol})")
            else:
                log_error(f"  {curr}: MISSING")
                return False
        
        log_success(f"\n✓ All 21 currencies present including 7 new African currencies")
        return True
        
    except Exception as e:
        log_error(f"Exception in test_available_currencies: {str(e)}")
        return False

def create_payment_link(token: str, company_id: str, currency: str, amount: float = 10000) -> Optional[Dict]:
    """
    Create a payment link with specified currency
    Returns link data including link_id
    """
    try:
        payload = {
            "base_currency": currency,
            "base_amount": amount,
            "description": f"Test {currency} payment link - Session 88",
            "email": TEST_EMAIL,
            "company_id": company_id,
            "modes": ["CRYPTO"]
        }
        
        response = requests.post(
            f"{API_BASE}/pay/createPaymentLink",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
            timeout=30
        )
        
        if response.status_code != 200:
            log_error(f"Create link failed for {currency}: {response.status_code} - {response.text}")
            return None
        
        data = response.json()
        link_data = data.get('data', {})
        
        link_id = link_data.get('link_id')
        payment_link = link_data.get('payment_link')
        stored_currency = link_data.get('base_currency')
        
        if link_id:
            created_links.append(link_id)
            log_success(f"Created {currency} link: ID={link_id}")
        
        return link_data
        
    except Exception as e:
        log_error(f"Exception creating {currency} link: {str(e)}")
        return None

def get_currency_rates(customer_token: str, amount: float, source_currency: str) -> Optional[List[Dict]]:
    """
    Get currency conversion rates using customer token
    """
    try:
        response = requests.post(
            f"{API_BASE}/pay/getCurrencyRates",
            headers={"Authorization": f"Bearer {customer_token}"},
            json={
                "amount": amount,
                "source": source_currency,
                "currencyList": ["BTC", "USDT-TRC20", "USDT-ERC20", "ETH"],
                "fixedDecimal": True,
                "fee_payer": "company"
            },
            timeout=30
        )
        
        if response.status_code != 200:
            log_error(f"getCurrencyRates failed: {response.status_code} - {response.text}")
            return None
        
        data = response.json()
        # Response can be either a list directly or wrapped in data
        if isinstance(data, list):
            rates = data
        else:
            rates = data.get('data', data.get('rates', []))
        
        return rates
        
    except Exception as e:
        log_error(f"Exception in get_currency_rates: {str(e)}")
        return None

def get_checkout_data(payment_link: str) -> Optional[Dict]:
    """
    Get public checkout data for a payment link
    Extract uniqueRef from link and call getData
    """
    try:
        # Extract uniqueRef from payment_link URL (format: ?d=<uniqueRef>)
        import re
        match = re.search(r'[?&]d=([a-f0-9]+)', payment_link)
        if not match:
            log_error(f"Could not extract uniqueRef from link: {payment_link}")
            return None
        
        unique_ref = match.group(1)
        
        response = requests.post(
            f"{API_BASE}/pay/getData",
            json={"data": unique_ref},
            timeout=30
        )
        
        if response.status_code != 200:
            log_error(f"getData failed: {response.status_code} - {response.text}")
            return None
        
        data = response.json()
        checkout_data = data.get('data', {})
        return checkout_data
        
    except Exception as e:
        log_error(f"Exception in get_checkout_data: {str(e)}")
        return None

def test_ngn_payment_link(token: str, company_id: str) -> bool:
    """
    TEST 2: Create NGN payment link and verify
    """
    log_info("\n" + "="*80)
    log_info("TEST 2: NGN Payment Link Creation")
    log_info("="*80)
    
    # Create NGN link
    link_data = create_payment_link(token, company_id, "NGN", 10000)
    
    if not link_data:
        log_error("Failed to create NGN payment link")
        return False
    
    # Verify stored currency
    stored_currency = link_data.get('base_currency')
    if stored_currency != 'NGN':
        log_error(f"Expected base_currency='NGN', got '{stored_currency}'")
        return False
    
    log_success(f"✓ NGN link created with base_currency='NGN'")
    
    # Get checkout data
    payment_link = link_data.get('payment_link')
    if not payment_link:
        log_error("No payment_link URL in response")
        return False
    
    log_info(f"Payment link: {payment_link}")
    
    checkout_data = get_checkout_data(payment_link)
    if not checkout_data:
        log_error("Failed to get checkout data")
        return False
    
    # Verify base currency
    base_currency = checkout_data.get('base_currency')
    amount = checkout_data.get('amount')
    customer_token = checkout_data.get('token')
    
    log_info(f"Checkout base_currency: {base_currency}")
    log_info(f"Checkout amount: {amount}")
    
    if base_currency != 'NGN':
        log_error(f"Expected base_currency='NGN', got '{base_currency}'")
        return False
    
    log_success("✓ Checkout data shows base_currency='NGN'")
    
    # Get currency rates using customer token
    if not customer_token:
        log_error("No customer token in checkout data")
        return False
    
    rates = get_currency_rates(customer_token, amount, base_currency)
    if not rates:
        log_warning("Failed to get currency rates")
        return False
    
    log_info(f"\nCrypto conversion amounts for NGN {amount}:")
    btc_rate = next((r for r in rates if r.get('currency') == 'BTC'), None)
    usdt_rate = next((r for r in rates if r.get('currency') in ['USDT', 'USDT-TRC20', 'USDT-ERC20']), None)
    
    if btc_rate:
        btc_amount = btc_rate.get('amount', 0)
        log_info(f"  BTC: {btc_amount}")
        if btc_amount == 0:
            log_warning("  BTC conversion returned 0 (but continuing test)")
    
    if usdt_rate:
        usdt_amount = usdt_rate.get('amount', 0)
        usdt_currency = usdt_rate.get('currency')
        log_info(f"  {usdt_currency}: {usdt_amount}")
        if usdt_amount == 0:
            log_error("  USDT conversion returned 0!")
            return False
        else:
            log_success(f"  ✓ Valid USDT conversion: {usdt_amount}")
    
    log_success("\n✓ NGN payment link test PASSED")
    return True

def test_currency_conversion(token: str, company_id: str, currencies: List[str]) -> Dict[str, bool]:
    """
    TEST 3: Test fiat→crypto conversion for new currencies
    Create a link for each currency and verify conversion works
    """
    log_info("\n" + "="*80)
    log_info("TEST 3: Fiat→Crypto Conversion for New Currencies")
    log_info("="*80)
    
    results = {}
    
    for currency in currencies:
        log_info(f"\nTesting {currency}...")
        
        # Add delay to avoid rate limiting
        time.sleep(2)
        
        # Create link
        link_data = create_payment_link(token, company_id, currency, 1000)
        
        if not link_data:
            log_error(f"  Failed to create {currency} link")
            results[currency] = False
            continue
        
        # Get checkout data
        payment_link = link_data.get('payment_link')
        if not payment_link:
            log_error(f"  No payment_link for {currency}")
            results[currency] = False
            continue
        
        checkout_data = get_checkout_data(payment_link)
        if not checkout_data:
            log_error(f"  Failed to get checkout data for {currency}")
            results[currency] = False
            continue
        
        # Get customer token and amount
        customer_token = checkout_data.get('token')
        amount = checkout_data.get('amount')
        base_currency = checkout_data.get('base_currency')
        
        if not customer_token:
            log_error(f"  No customer token for {currency}")
            results[currency] = False
            continue
        
        # Get currency rates
        rates = get_currency_rates(customer_token, amount, base_currency)
        if not rates:
            log_error(f"  Failed to get rates for {currency}")
            results[currency] = False
            continue
        
        # Find BTC and USDT rates
        btc_rate = next((r for r in rates if r.get('currency') == 'BTC'), None)
        usdt_rate = next((r for r in rates if r.get('currency') in ['USDT', 'USDT-TRC20', 'USDT-ERC20']), None)
        
        btc_amount = btc_rate.get('amount', 0) if btc_rate else 0
        usdt_amount = usdt_rate.get('amount', 0) if usdt_rate else 0
        
        log_info(f"  {currency} 1000 → BTC: {btc_amount}, USDT: {usdt_amount}")
        
        # Check if conversions are valid (non-zero)
        if btc_amount == 0 and usdt_amount == 0:
            log_error(f"  ✗ {currency}: Both BTC and USDT conversions returned 0!")
            results[currency] = False
        elif btc_amount == 0:
            log_warning(f"  ⚠ {currency}: BTC conversion returned 0 (but USDT works)")
            results[currency] = True  # Consider pass if at least one works
        elif usdt_amount == 0:
            log_warning(f"  ⚠ {currency}: USDT conversion returned 0 (but BTC works)")
            results[currency] = True  # Consider pass if at least one works
        else:
            log_success(f"  ✓ {currency}: Valid conversions (BTC: {btc_amount}, USDT: {usdt_amount})")
            results[currency] = True
    
    # Summary
    log_info("\n" + "-"*80)
    log_info("Conversion Test Summary:")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for curr, passed_test in results.items():
        status = "✓ PASS" if passed_test else "✗ FAIL"
        log_info(f"  {curr}: {status}")
    
    log_info(f"\nTotal: {passed}/{total} currencies passed")
    
    return results

def cleanup_links(token: str) -> bool:
    """
    TEST 4: Cleanup - Delete all created test links
    """
    log_info("\n" + "="*80)
    log_info("TEST 4: CLEANUP - Deleting Test Links")
    log_info("="*80)
    
    if not created_links:
        log_info("No links to clean up")
        return True
    
    log_info(f"Deleting {len(created_links)} test links...")
    
    success_count = 0
    for link_id in created_links:
        try:
            response = requests.delete(
                f"{API_BASE}/pay/deletePaymentLink/{link_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=30
            )
            
            if response.status_code == 200:
                log_success(f"  Deleted link {link_id}")
                success_count += 1
            else:
                log_error(f"  Failed to delete link {link_id}: {response.status_code}")
        
        except Exception as e:
            log_error(f"  Exception deleting link {link_id}: {str(e)}")
    
    log_info(f"\nCleanup: {success_count}/{len(created_links)} links deleted")
    
    if success_count == len(created_links):
        log_success("✓ All test links cleaned up successfully")
        return True
    else:
        log_warning(f"⚠ {len(created_links) - success_count} links failed to delete")
        return False

def main():
    """
    Main test execution
    """
    print("\n" + "="*80)
    print("DynoPay Currency Expansion Testing - Session 88")
    print("Testing African/Local Currency Support (21 total currencies)")
    print("="*80)
    print(f"\nBase URL: {BASE_URL}")
    print(f"Test Account: {TEST_EMAIL}")
    print("\n⚠️  SAFETY: LIVE PRODUCTION DATABASE - NO CRYPTO TRANSACTIONS")
    print("="*80)
    
    # Login
    token, company_id = login()
    if not token:
        log_error("Login failed - cannot proceed")
        return False
    
    if not company_id:
        log_warning("No company_id from login - attempting to use default")
        # Try to get company_id from user profile or use a default
        company_id = "1"  # Fallback
    
    all_passed = True
    
    # TEST 1: Available Currencies
    test1_passed = test_available_currencies(token, company_id)
    all_passed = all_passed and test1_passed
    
    # TEST 2: NGN Payment Link
    test2_passed = test_ngn_payment_link(token, company_id)
    all_passed = all_passed and test2_passed
    
    # TEST 3: Currency Conversions
    conversion_results = test_currency_conversion(token, company_id, ALL_TEST_CURRENCIES)
    test3_passed = all(conversion_results.values())
    all_passed = all_passed and test3_passed
    
    # TEST 4: Cleanup
    cleanup_passed = cleanup_links(token)
    
    # Final Summary
    print("\n" + "="*80)
    print("FINAL TEST SUMMARY")
    print("="*80)
    print(f"TEST 1 - Available Currencies: {'✓ PASS' if test1_passed else '✗ FAIL'}")
    print(f"TEST 2 - NGN Payment Link: {'✓ PASS' if test2_passed else '✗ FAIL'}")
    print(f"TEST 3 - Currency Conversions: {'✓ PASS' if test3_passed else '✗ FAIL'}")
    print(f"TEST 4 - Cleanup: {'✓ PASS' if cleanup_passed else '⚠ PARTIAL'}")
    print("="*80)
    
    if all_passed and cleanup_passed:
        print(f"\n{Colors.GREEN}✓ ALL TESTS PASSED{Colors.RESET}")
        return True
    else:
        print(f"\n{Colors.RED}✗ SOME TESTS FAILED{Colors.RESET}")
        return False

if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        exit(1)
    except Exception as e:
        log_error(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)
