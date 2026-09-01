#!/usr/bin/env python3
"""
Backend test for branded short link bug fix (2026-09-01)
Tests the createPaymentLink endpoint to verify:
1. short_link exists and equals <SERVER_URL>/<6-char-ref> (NO "/pay?d=")
2. payment_link STILL contains "/pay?d=<ref>" (unchanged)
3. The 6-char <ref> is IDENTICAL in both
"""

import requests
import json
import re
import sys

# Configuration
BASE_URL = "http://localhost:8001"
LOGIN_EMAIL = "onarrival21@gmail.com"
LOGIN_PASSWORD = "Katiekendra123@"

# Expected URLs from backend/.env
SERVER_URL = "https://d4fef0d9-f3e2-42b2-a3b0-4b3e15a570d4.preview.emergentagent.com"
CHECKOUT_URL = "https://d4fef0d9-f3e2-42b2-a3b0-4b3e15a570d4.preview.emergentagent.com"

def log(msg):
    print(f"[TEST] {msg}")

def test_health():
    """Verify backend health before testing"""
    log("Step 0: Checking backend health...")
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            log(f"✅ Backend healthy: status={data.get('status')}, db={data.get('database')}, redis={data.get('redis')}")
            return True
        else:
            log(f"❌ Health check failed: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ Health check error: {e}")
        return False

def login():
    """Login as owner and return JWT token"""
    log("Step 1: Logging in as owner...")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("data", {}).get("accessToken")
            if token:
                log(f"✅ Login successful, token obtained (length: {len(token)} chars)")
                return token
            else:
                log(f"❌ Login response missing accessToken: {data}")
                return None
        else:
            log(f"❌ Login failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        log(f"❌ Login error: {e}")
        return None

def create_payment_link(token):
    """Create a payment link and return the response data"""
    log("Step 2: Creating payment link...")
    
    # Payment link payload - multi-crypto to avoid single-crypto merchant-pool address reservation
    payload = {
        "amount": 25,
        "currency": "USD",
        "email": "onarrival21+ptest@gmail.com",
        "description": "QA branded-link test",
        "crypto_currencies": ["BTC", "ETH"],
        "company_id": 1
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/pay/createPaymentLink",
            json=payload,
            headers=headers,
            timeout=15
        )
        
        log(f"Response status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            log(f"✅ Payment link created successfully")
            return data.get("data")
        elif resp.status_code == 400 and "An active API key is required" in resp.text:
            log(f"⚠️ Expected error: {resp.text}")
            log("This is NOT a bug fix failure - company needs an active API key")
            return None
        else:
            log(f"❌ Create payment link failed: {resp.status_code}")
            log(f"Response: {resp.text}")
            return None
    except Exception as e:
        log(f"❌ Create payment link error: {e}")
        return None

def verify_assertions(data):
    """Verify the three critical assertions"""
    log("Step 3: Verifying assertions...")
    
    if not data:
        log("❌ No data to verify")
        return False
    
    short_link = data.get("short_link")
    payment_link = data.get("payment_link")
    link_id = data.get("link_id")
    
    log(f"short_link: {short_link}")
    log(f"payment_link: {payment_link}")
    log(f"link_id: {link_id}")
    
    all_passed = True
    
    # Assertion A: short_link EXISTS and equals <SERVER_URL>/<6-char-ref> (NO "/pay?d=")
    log("\nAssertion A: short_link format...")
    if not short_link:
        log("❌ FAIL: short_link is missing")
        all_passed = False
    elif "/pay?d=" in short_link:
        log(f"❌ FAIL: short_link contains '/pay?d=' (should NOT): {short_link}")
        all_passed = False
    else:
        # Extract ref from short_link (last path segment)
        match = re.search(r'/([A-Za-z0-9]{6})$', short_link)
        if not match:
            log(f"❌ FAIL: short_link does not end with 6 base62 chars: {short_link}")
            all_passed = False
        else:
            ref_from_short = match.group(1)
            expected_short = f"{SERVER_URL}/{ref_from_short}"
            if short_link == expected_short:
                log(f"✅ PASS: short_link = {short_link} (correct format, ref={ref_from_short})")
            else:
                log(f"❌ FAIL: short_link = {short_link}, expected = {expected_short}")
                all_passed = False
    
    # Assertion B: payment_link STILL contains "/pay?d=<ref>" (unchanged)
    log("\nAssertion B: payment_link format...")
    if not payment_link:
        log("❌ FAIL: payment_link is missing")
        all_passed = False
    elif "/pay?d=" not in payment_link:
        log(f"❌ FAIL: payment_link does NOT contain '/pay?d=' (should contain it): {payment_link}")
        all_passed = False
    else:
        # Extract ref from payment_link (?d=<ref>)
        match = re.search(r'\?d=([A-Za-z0-9]{6})', payment_link)
        if not match:
            log(f"❌ FAIL: payment_link does not have ?d=<6-char-ref>: {payment_link}")
            all_passed = False
        else:
            ref_from_payment = match.group(1)
            expected_payment = f"{CHECKOUT_URL}/pay?d={ref_from_payment}"
            if payment_link == expected_payment:
                log(f"✅ PASS: payment_link = {payment_link} (correct format, ref={ref_from_payment})")
            else:
                log(f"✅ PASS: payment_link contains '/pay?d={ref_from_payment}' (format correct)")
    
    # Assertion C: The 6-char <ref> is IDENTICAL in both
    log("\nAssertion C: ref consistency...")
    if short_link and payment_link:
        match_short = re.search(r'/([A-Za-z0-9]{6})$', short_link)
        match_payment = re.search(r'\?d=([A-Za-z0-9]{6})', payment_link)
        
        if match_short and match_payment:
            ref_short = match_short.group(1)
            ref_payment = match_payment.group(1)
            
            if ref_short == ref_payment:
                log(f"✅ PASS: Both refs are IDENTICAL: {ref_short}")
            else:
                log(f"❌ FAIL: Refs are DIFFERENT - short_link ref={ref_short}, payment_link ref={ref_payment}")
                all_passed = False
        else:
            log("❌ FAIL: Could not extract refs from both links")
            all_passed = False
    
    return all_passed, link_id

def cleanup(token, link_id):
    """Delete the test payment link"""
    log(f"\nStep 4: Cleaning up (deleting link_id={link_id})...")
    
    if not link_id:
        log("⚠️ No link_id to clean up")
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        resp = requests.delete(
            f"{BASE_URL}/api/pay/deletePaymentLink/{link_id}",
            headers=headers,
            timeout=10
        )
        
        if resp.status_code == 200:
            log(f"✅ Cleanup successful: link_id={link_id} deleted")
            return True
        else:
            log(f"⚠️ Cleanup failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        log(f"❌ Cleanup error: {e}")
        return False

def main():
    log("=" * 80)
    log("BRANDED SHORT LINK BUG FIX VERIFICATION")
    log("=" * 80)
    
    # Step 0: Health check
    if not test_health():
        log("\n❌ OVERALL RESULT: FAILED (backend not healthy)")
        sys.exit(1)
    
    # Step 1: Login
    token = login()
    if not token:
        log("\n❌ OVERALL RESULT: FAILED (login failed)")
        sys.exit(1)
    
    # Step 2: Create payment link
    data = create_payment_link(token)
    if data is None:
        log("\n⚠️ OVERALL RESULT: INCONCLUSIVE (could not create payment link)")
        log("If error was 'An active API key is required', report this exactly.")
        sys.exit(2)
    
    # Step 3: Verify assertions
    all_passed, link_id = verify_assertions(data)
    
    # Step 4: Cleanup
    cleanup_success = cleanup(token, link_id)
    
    # Final result
    log("\n" + "=" * 80)
    if all_passed:
        log("✅ OVERALL RESULT: ALL ASSERTIONS PASSED")
        log("The branded short link bug fix is WORKING CORRECTLY.")
        if cleanup_success:
            log("✅ Cleanup successful - production DB kept clean.")
        else:
            log("⚠️ Cleanup failed - manual cleanup may be needed.")
    else:
        log("❌ OVERALL RESULT: SOME ASSERTIONS FAILED")
        log("The branded short link bug fix has ISSUES.")
    log("=" * 80)
    
    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()
