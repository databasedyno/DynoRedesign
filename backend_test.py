#!/usr/bin/env python3
"""
Behavioral E2E test for buyer email capture feature on DynoPay.
Tests against company_id 219 (QA BuyerEmail Test) via EXTERNAL preview origin.
"""

import requests
import time
import json
import sys

# EXTERNAL preview origin (client uses relative /api base)
BASE_URL = "https://cred-manager-29.preview.emergentagent.com"

# Test brand credentials
MERCHANT_EMAIL = "onarrival21@gmail.com"
MERCHANT_PASSWORD = "Katiekendra123@"
COMPANY_ID = 219  # QA BuyerEmail Test

# API key for test brand (send as header x-api-key)
API_KEY = "U2FsdGVkX1+RlYJogoYEqSr5oXyqu6HXFRUjHSs+Xdu1FJuc8qKZqCe2CxD/RiiBWnLnglD8EEO/32hrgim5/iRejXpnVrX+GuzITYjUE8LuZ2hq2VKDbtHPIPCAlZO644tWF/x8KS6lGBvWZBR99t//HwV3zrf5P9ZnjmzTiNE="

def log(msg):
    """Print timestamped log message"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def test_buyer_email_capture():
    """
    Test buyer email capture feature:
    1. Login to get merchant JWT
    2. Create payment with REAL email
    3. Create payment with PLACEHOLDER .local email
    4. Get customer directory
    5. Assert REAL email is captured, PLACEHOLDER is rejected
    """
    
    results = {
        "login": None,
        "real_email_payment": None,
        "placeholder_email_payment": None,
        "customer_directory": None,
        "assertions": {
            "real_email_captured": False,
            "placeholder_rejected": False,
            "no_500_errors": True
        }
    }
    
    # Generate unique emails for this run
    unix_ts = int(time.time())
    real_email = f"qa.real.{unix_ts}@example.com"
    placeholder_email = f"buyer.{unix_ts}@qabuyeremail.local"
    
    log(f"Generated test emails:")
    log(f"  REAL: {real_email}")
    log(f"  PLACEHOLDER: {placeholder_email}")
    
    # STEP 1: Login to get merchant JWT
    log("\n=== STEP 1: Merchant Login ===")
    try:
        login_response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={
                "email": MERCHANT_EMAIL,
                "password": MERCHANT_PASSWORD
            },
            timeout=30
        )
        log(f"Login status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            login_data = login_response.json()
            if "data" in login_data and "accessToken" in login_data["data"]:
                jwt_token = login_data["data"]["accessToken"]
                log(f"✓ JWT token obtained (length: {len(jwt_token)})")
                results["login"] = {"status": 200, "success": True}
            else:
                log(f"✗ No accessToken in response: {login_data}")
                results["login"] = {"status": 200, "success": False, "error": "No accessToken"}
                return results
        else:
            log(f"✗ Login failed: {login_response.text}")
            results["login"] = {"status": login_response.status_code, "success": False}
            return results
    except Exception as e:
        log(f"✗ Login exception: {e}")
        results["login"] = {"error": str(e)}
        return results
    
    # STEP 2: Create payment with REAL email
    log("\n=== STEP 2: Create Payment with REAL Email ===")
    try:
        real_payment_response = requests.post(
            f"{BASE_URL}/api/user/createPayment",
            headers={
                "x-api-key": API_KEY,
                "Content-Type": "application/json"
            },
            json={
                "amount": 25,
                "redirect_uri": "https://example.com/return",
                "customer_email": real_email,
                "customer_name": "QA Real Buyer"
            },
            timeout=30
        )
        log(f"Real email payment status: {real_payment_response.status_code}")
        log(f"Real email payment response: {real_payment_response.text[:500]}")
        
        results["real_email_payment"] = {
            "status": real_payment_response.status_code,
            "body": real_payment_response.text[:500]
        }
        
        # Expected: 400 "No crypto wallet configured..." (test brand has no wallet)
        # 500 or crash = FAIL
        if real_payment_response.status_code == 500:
            log("✗ FAIL: Real email payment returned 500")
            results["assertions"]["no_500_errors"] = False
        elif real_payment_response.status_code == 400:
            if "No crypto wallet" in real_payment_response.text or "wallet" in real_payment_response.text.lower():
                log("✓ Expected 400 (no wallet configured) - customer should be created before this check")
            else:
                log(f"⚠ 400 but unexpected message: {real_payment_response.text}")
        else:
            log(f"⚠ Unexpected status: {real_payment_response.status_code}")
            
    except Exception as e:
        log(f"✗ Real email payment exception: {e}")
        results["real_email_payment"] = {"error": str(e)}
        results["assertions"]["no_500_errors"] = False
    
    # STEP 3: Create payment with PLACEHOLDER .local email
    log("\n=== STEP 3: Create Payment with PLACEHOLDER .local Email ===")
    try:
        placeholder_payment_response = requests.post(
            f"{BASE_URL}/api/user/createPayment",
            headers={
                "x-api-key": API_KEY,
                "Content-Type": "application/json"
            },
            json={
                "amount": 25,
                "redirect_uri": "https://example.com/return",
                "customer_email": placeholder_email,
                "customer_name": "QA Placeholder"
            },
            timeout=30
        )
        log(f"Placeholder email payment status: {placeholder_payment_response.status_code}")
        log(f"Placeholder email payment response: {placeholder_payment_response.text[:500]}")
        
        results["placeholder_email_payment"] = {
            "status": placeholder_payment_response.status_code,
            "body": placeholder_payment_response.text[:500]
        }
        
        # Expected: 400 "No crypto wallet configured..." (test brand has no wallet)
        # 500 or crash = FAIL
        if placeholder_payment_response.status_code == 500:
            log("✗ FAIL: Placeholder email payment returned 500")
            results["assertions"]["no_500_errors"] = False
        elif placeholder_payment_response.status_code == 400:
            if "No crypto wallet" in placeholder_payment_response.text or "wallet" in placeholder_payment_response.text.lower():
                log("✓ Expected 400 (no wallet configured)")
            else:
                log(f"⚠ 400 but unexpected message: {placeholder_payment_response.text}")
        else:
            log(f"⚠ Unexpected status: {placeholder_payment_response.status_code}")
            
    except Exception as e:
        log(f"✗ Placeholder email payment exception: {e}")
        results["placeholder_email_payment"] = {"error": str(e)}
        results["assertions"]["no_500_errors"] = False
    
    # STEP 4: Get customer directory
    log("\n=== STEP 4: Get Customer Directory ===")
    try:
        directory_response = requests.get(
            f"{BASE_URL}/api/userApi/customers/directory",
            headers={
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            },
            params={"company_id": COMPANY_ID},
            timeout=30
        )
        log(f"Customer directory status: {directory_response.status_code}")
        
        if directory_response.status_code == 200:
            directory_data = directory_response.json()
            log(f"Customer directory response keys: {directory_data.keys()}")
            
            # Extract customer emails
            customer_emails = []
            if "data" in directory_data and "customers" in directory_data["data"]:
                customers = directory_data["data"]["customers"]
                log(f"Found {len(customers)} customers")
                customer_emails = [c.get("email") for c in customers if c.get("email")]
                log(f"Customer emails: {customer_emails}")
            else:
                log(f"⚠ Unexpected directory structure: {directory_data}")
            
            results["customer_directory"] = {
                "status": 200,
                "customer_emails": customer_emails
            }
            
            # STEP 5: Assertions
            log("\n=== STEP 5: Assertions ===")
            
            # Assert 1: REAL email appears in directory
            if real_email in customer_emails:
                log(f"✓ PASS: Real email {real_email} found in customer directory")
                results["assertions"]["real_email_captured"] = True
            else:
                log(f"✗ FAIL: Real email {real_email} NOT found in customer directory")
                results["assertions"]["real_email_captured"] = False
            
            # Assert 2: PLACEHOLDER email does NOT appear in directory
            if placeholder_email not in customer_emails:
                log(f"✓ PASS: Placeholder email {placeholder_email} correctly rejected (not in directory)")
                results["assertions"]["placeholder_rejected"] = True
            else:
                log(f"✗ FAIL: Placeholder email {placeholder_email} incorrectly stored in directory")
                results["assertions"]["placeholder_rejected"] = False
                
        else:
            log(f"✗ Customer directory failed: {directory_response.status_code}")
            log(f"Response: {directory_response.text}")
            results["customer_directory"] = {
                "status": directory_response.status_code,
                "error": directory_response.text[:500]
            }
            
    except Exception as e:
        log(f"✗ Customer directory exception: {e}")
        results["customer_directory"] = {"error": str(e)}
    
    return results

def print_summary(results):
    """Print test summary"""
    log("\n" + "="*80)
    log("TEST SUMMARY")
    log("="*80)
    
    # Login
    if results["login"]:
        log(f"Login: {'✓ PASS' if results['login'].get('success') else '✗ FAIL'}")
    
    # Real email payment
    if results["real_email_payment"]:
        status = results["real_email_payment"].get("status", "ERROR")
        log(f"Real email payment: HTTP {status}")
        if "body" in results["real_email_payment"]:
            log(f"  Message: {results['real_email_payment']['body'][:200]}")
    
    # Placeholder email payment
    if results["placeholder_email_payment"]:
        status = results["placeholder_email_payment"].get("status", "ERROR")
        log(f"Placeholder email payment: HTTP {status}")
        if "body" in results["placeholder_email_payment"]:
            log(f"  Message: {results['placeholder_email_payment']['body'][:200]}")
    
    # Customer directory
    if results["customer_directory"]:
        if "customer_emails" in results["customer_directory"]:
            emails = results["customer_directory"]["customer_emails"]
            log(f"Customer directory: {len(emails)} customers")
            log(f"  Emails: {emails}")
        else:
            log(f"Customer directory: ERROR - {results['customer_directory'].get('error', 'Unknown')}")
    
    # Assertions
    log("\nASSERTIONS:")
    log(f"  1. Real email captured: {'✓ PASS' if results['assertions']['real_email_captured'] else '✗ FAIL'}")
    log(f"  2. Placeholder rejected: {'✓ PASS' if results['assertions']['placeholder_rejected'] else '✗ FAIL'}")
    log(f"  3. No 500 errors: {'✓ PASS' if results['assertions']['no_500_errors'] else '✗ FAIL'}")
    
    # Overall result
    all_pass = (
        results["assertions"]["real_email_captured"] and
        results["assertions"]["placeholder_rejected"] and
        results["assertions"]["no_500_errors"]
    )
    
    log("\n" + "="*80)
    if all_pass:
        log("OVERALL: ✓✓✓ ALL TESTS PASSED ✓✓✓")
    else:
        log("OVERALL: ✗✗✗ SOME TESTS FAILED ✗✗✗")
    log("="*80)
    
    return all_pass

if __name__ == "__main__":
    log("Starting buyer email capture E2E test")
    log(f"Target: {BASE_URL}")
    log(f"Test brand: company_id={COMPANY_ID}")
    
    results = test_buyer_email_capture()
    all_pass = print_summary(results)
    
    # Write results to file
    with open("/app/buyer_email_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    log("\nResults written to /app/buyer_email_test_results.json")
    
    sys.exit(0 if all_pass else 1)
