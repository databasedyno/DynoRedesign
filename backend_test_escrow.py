#!/usr/bin/env python3
"""
Backend test for DynoPay Escrow Service v2 (SAFE MODE - simulated settlement).
Tests the NEW email-OTP flow, custody conversion, two-phase payout (pending->paid),
fee math, happy paths, disputes, state machine, and auth guards.
"""
import requests
import json
import time
import subprocess
import sys
from typing import Dict, Any, Optional

# Base URL - external preview URL
BASE_URL = "https://secure-vault-app-58.preview.emergentagent.com/api"

# Test credentials
MERCHANT_EMAIL = "onarrival21@gmail.com"
MERCHANT_PASSWORD = "Katiekendra123@"
ADMIN_EMAIL = "moxxcompany@gmail.com"
ADMIN_PASSWORD = "Katiekendra123@"

# Test counterparty emails (different from owner)
BUYER_EMAIL = "escrow_buyer_test@example.com"
SELLER_EMAIL = "escrow_seller_test@example.com"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'

def log(msg: str, color: str = ""):
    print(f"{color}{msg}{Colors.END}")

def get_totp_code() -> str:
    """Get fresh TOTP code for merchant owner (user_id=1)"""
    try:
        result = subprocess.run(
            ["node", "/app/backend/scripts/print_totp.cjs", "1"],
            capture_output=True,
            text=True,
            timeout=5
        )
        code = result.stdout.strip()
        if len(code) == 6 and code.isdigit():
            return code
        log(f"⚠️  Invalid TOTP code: {code}", Colors.YELLOW)
        return ""
    except Exception as e:
        log(f"⚠️  Failed to get TOTP: {e}", Colors.YELLOW)
        return ""

def merchant_login() -> Optional[str]:
    """Login as merchant owner with 2FA"""
    log("\n🔐 Logging in as merchant owner...", Colors.BLUE)
    
    # Step 1: Initial login
    resp = requests.post(f"{BASE_URL}/user/login", json={
        "email": MERCHANT_EMAIL,
        "password": MERCHANT_PASSWORD
    })
    
    if resp.status_code != 200:
        log(f"❌ Login failed: {resp.status_code} {resp.text}", Colors.RED)
        return None
    
    data = resp.json().get("data", {})
    
    # Check if 2FA required
    if not data.get("requires_2fa"):
        token = data.get("accessToken")
        if token:
            log("✅ Merchant login successful (no 2FA)", Colors.GREEN)
            return token
    
    # Step 2: 2FA validation
    challenge_token = data.get("challenge_token")
    if not challenge_token:
        log(f"❌ No challenge_token in response", Colors.RED)
        return None
    
    totp_code = get_totp_code()
    if not totp_code:
        log("❌ Failed to get TOTP code", Colors.RED)
        return None
    
    log(f"🔑 Using TOTP code: {totp_code}", Colors.BLUE)
    
    resp2 = requests.post(f"{BASE_URL}/user/2fa/validate", json={
        "challenge_token": challenge_token,
        "token": totp_code
    })
    
    if resp2.status_code != 200:
        log(f"❌ 2FA validation failed: {resp2.status_code} {resp2.text}", Colors.RED)
        return None
    
    token = resp2.json().get("data", {}).get("accessToken")
    if token:
        log("✅ Merchant login successful (with 2FA)", Colors.GREEN)
        return token
    
    log("❌ No accessToken in 2FA response", Colors.RED)
    return None

def admin_login() -> Optional[str]:
    """Login as super-admin"""
    log("\n🔐 Logging in as super-admin...", Colors.BLUE)
    
    resp = requests.post(f"{BASE_URL}/admin/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if resp.status_code != 200:
        log(f"❌ Admin login failed: {resp.status_code} {resp.text}", Colors.RED)
        return None
    
    token = resp.json().get("data", {}).get("accessToken")
    if token:
        log("✅ Admin login successful", Colors.GREEN)
        return token
    
    log("❌ No accessToken in admin response", Colors.RED)
    return None

def test_fee_math(token: str) -> bool:
    """Test 1: Fee math via /api/escrow/fee-preview"""
    log("\n" + "="*80, Colors.BLUE)
    log("TEST 1: FEE MATH via /api/escrow/fee-preview", Colors.BLUE)
    log("="*80, Colors.BLUE)
    
    headers = {"Authorization": f"Bearer {token}"}
    all_pass = True
    
    # Test 1a: fee_payer="buyer"
    log("\n📊 Test 1a: fee_payer='buyer', amount=100, fee_percent=5", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/fee-preview", headers=headers, json={
        "amount": 100,
        "fee_percent": 5,
        "fee_payer": "buyer"
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        data = resp.json().get("data", {})
        escrow_fee = data.get("escrowFee")
        buyer_pays = data.get("buyerPays")
        seller_receives = data.get("sellerReceives")
        
        expected_fee = 5.0
        expected_buyer = 105.0
        expected_seller = 100.0
        
        if escrow_fee == expected_fee and buyer_pays == expected_buyer and seller_receives == expected_seller:
            log(f"✅ PASS: escrowFee={escrow_fee}, buyerPays={buyer_pays}, sellerReceives={seller_receives}", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected fee={expected_fee}, buyer={expected_buyer}, seller={expected_seller}", Colors.RED)
            log(f"   Got: fee={escrow_fee}, buyer={buyer_pays}, seller={seller_receives}", Colors.RED)
            all_pass = False
    
    # Test 1b: fee_payer="seller"
    log("\n📊 Test 1b: fee_payer='seller', amount=100, fee_percent=5", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/fee-preview", headers=headers, json={
        "amount": 100,
        "fee_percent": 5,
        "fee_payer": "seller"
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        data = resp.json().get("data", {})
        buyer_pays = data.get("buyerPays")
        seller_receives = data.get("sellerReceives")
        
        if buyer_pays == 100.0 and seller_receives == 95.0:
            log(f"✅ PASS: buyerPays={buyer_pays}, sellerReceives={seller_receives}", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected buyer=100, seller=95, got buyer={buyer_pays}, seller={seller_receives}", Colors.RED)
            all_pass = False
    
    # Test 1c: fee_payer="split"
    log("\n📊 Test 1c: fee_payer='split', amount=100, fee_percent=5", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/fee-preview", headers=headers, json={
        "amount": 100,
        "fee_percent": 5,
        "fee_payer": "split"
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        data = resp.json().get("data", {})
        buyer_pays = data.get("buyerPays")
        seller_receives = data.get("sellerReceives")
        
        if buyer_pays == 102.5 and seller_receives == 97.5:
            log(f"✅ PASS: buyerPays={buyer_pays}, sellerReceives={seller_receives}", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected buyer=102.5, seller=97.5, got buyer={buyer_pays}, seller={seller_receives}", Colors.RED)
            all_pass = False
    
    # Test 1d: fee_min_usd floor ($1 floor on tiny amounts)
    log("\n📊 Test 1d: fee_min_usd floor, amount=5, fee_percent=5, fee_min_usd=1", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/fee-preview", headers=headers, json={
        "amount": 5,
        "fee_percent": 5,
        "fee_min_usd": 1,
        "fee_payer": "buyer"
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        data = resp.json().get("data", {})
        escrow_fee = data.get("escrowFee")
        
        # 5% of 5 = 0.25, but min is 1, so fee should be 1
        if escrow_fee == 1.0:
            log(f"✅ PASS: escrowFee={escrow_fee} (floor applied)", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected fee=1.0 (floor), got {escrow_fee}", Colors.RED)
            all_pass = False
    
    return all_pass

def test_otp_onboarding(token: str) -> bool:
    """Test 2: OTP onboarding flow"""
    log("\n" + "="*80, Colors.BLUE)
    log("TEST 2: OTP ONBOARDING (send-otp -> verify-otp -> x-escrow-token)", Colors.BLUE)
    log("="*80, Colors.BLUE)
    
    headers = {"Authorization": f"Bearer {token}"}
    all_pass = True
    
    # Create a test deal
    log("\n📝 Creating test deal for OTP flow...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow", headers=headers, json={
        "company_id": 1,
        "title": "Test Deal - OTP Flow",
        "amount": 50,
        "counterparty_email": BUYER_EMAIL,
        "creator_role": "seller",
        "send_invite": True
    })
    
    if resp.status_code != 201:
        log(f"❌ FAIL: Create deal failed: {resp.status_code} {resp.text}", Colors.RED)
        return False
    
    deal_data = resp.json().get("data", {})
    deal_token = deal_data.get("deal_token")
    log(f"✅ Deal created: token={deal_token}", Colors.GREEN)
    
    # Test 2a: send-otp returns preview_otp
    log("\n📧 Test 2a: POST /escrow/public/:token/send-otp", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/send-otp", json={
        "email": BUYER_EMAIL
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
        return all_pass
    
    data = resp.json().get("data", {})
    preview_otp = data.get("preview_otp")
    has_account = data.get("has_account")
    
    if preview_otp and len(preview_otp) == 6 and preview_otp.isdigit():
        log(f"✅ PASS: preview_otp={preview_otp}, has_account={has_account}", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 6-digit preview_otp, got {preview_otp}", Colors.RED)
        all_pass = False
        return all_pass
    
    # Test 2b: verify-otp returns escrow_session + has_account
    log("\n🔐 Test 2b: POST /escrow/public/:token/verify-otp", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/verify-otp", json={
        "email": BUYER_EMAIL,
        "otp": preview_otp
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
        return all_pass
    
    data = resp.json().get("data", {})
    escrow_session = data.get("escrow_session")
    has_account = data.get("has_account")
    expires_in = data.get("expires_in")
    
    if escrow_session and len(escrow_session) > 20 and has_account is not None:
        log(f"✅ PASS: escrow_session={escrow_session[:20]}..., has_account={has_account}, expires_in={expires_in}", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected escrow_session token, got {escrow_session}", Colors.RED)
        all_pass = False
        return all_pass
    
    # Test 2c: Guard - wrong OTP -> 400
    log("\n🚫 Test 2c: verify-otp with wrong OTP (should fail 400)", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/send-otp", json={"email": BUYER_EMAIL})
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/verify-otp", json={
        "email": BUYER_EMAIL,
        "otp": "999999"
    })
    
    if resp.status_code == 400:
        log(f"✅ PASS: Got 400 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 400, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Test 2d: Guard - verify with mismatched email -> 403
    log("\n🚫 Test 2d: verify-otp with mismatched email (should fail 403)", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/verify-otp", json={
        "email": "wrong@example.com",
        "otp": "123456"
    })
    
    if resp.status_code == 403:
        log(f"✅ PASS: Got 403 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 403, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Test 2e: Guard - public respond WITHOUT x-escrow-token -> 401
    log("\n🚫 Test 2e: public respond WITHOUT x-escrow-token (should fail 401)", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/respond", json={
        "action": "accept"
    })
    
    if resp.status_code == 401:
        log(f"✅ PASS: Got 401 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 401, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Test 2f: public respond WITH x-escrow-token -> 200
    log("\n✅ Test 2f: public respond WITH x-escrow-token (should succeed)", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/respond", 
                        headers={"x-escrow-token": escrow_session},
                        json={"action": "accept"})
    
    if resp.status_code == 200:
        log(f"✅ PASS: Got 200 with x-escrow-token", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 200, got {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    
    return all_pass

def test_happy_path_a(token: str) -> bool:
    """Test 3: Happy Path A - owner is SELLER (custody + two-phase payout)"""
    log("\n" + "="*80, Colors.BLUE)
    log("TEST 3: HAPPY PATH A (owner=seller, custody conversion, two-phase payout)", Colors.BLUE)
    log("="*80, Colors.BLUE)
    
    headers = {"Authorization": f"Bearer {token}"}
    all_pass = True
    
    # Create deal
    log("\n📝 Creating deal (owner=seller, counterparty=buyer)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow", headers=headers, json={
        "company_id": 1,
        "title": "Test Deal A - Owner is Seller",
        "description": "Testing custody + two-phase payout",
        "amount": 200,
        "currency": "USD",
        "accepted_coins": "USDT-TRC20,BTC",
        "terms": "Test terms",
        "counterparty_email": BUYER_EMAIL,
        "creator_role": "seller",
        "fee_percent": 5,
        "fee_payer": "buyer",
        "auto_release_days": 3,
        "send_invite": True
    })
    
    if resp.status_code != 201:
        log(f"❌ FAIL: Create deal failed: {resp.status_code} {resp.text}", Colors.RED)
        return False
    
    deal_data = resp.json().get("data", {})
    deal_token = deal_data.get("deal_token")
    escrow_id = deal_data.get("escrow_id")
    status = deal_data.get("status")
    
    log(f"✅ Deal created: escrow_id={escrow_id}, token={deal_token}, status={status}", Colors.GREEN)
    
    if status != "invited":
        log(f"❌ FAIL: Expected status='invited', got '{status}'", Colors.RED)
        all_pass = False
    
    # Buyer OTP-verify
    log(f"\n🔐 Buyer OTP-verify...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/send-otp", json={"email": BUYER_EMAIL})
    preview_otp = resp.json().get("data", {}).get("preview_otp")
    
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/verify-otp", json={
        "email": BUYER_EMAIL,
        "otp": preview_otp
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: OTP verify failed: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
        return all_pass
    
    escrow_session = resp.json().get("data", {}).get("escrow_session")
    log(f"✅ OTP verified, escrow_session={escrow_session[:20]}...", Colors.GREEN)
    
    # Buyer accept
    log(f"\n✅ Buyer respond accept...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/respond", 
                        headers={"x-escrow-token": escrow_session},
                        json={"action": "accept"})
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        new_status = resp.json().get("data", {}).get("status")
        if new_status == "awaiting_payment":
            log(f"✅ PASS: Status changed to '{new_status}'", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected status='awaiting_payment', got '{new_status}'", Colors.RED)
            all_pass = False
    
    # Buyer fund (custody conversion)
    log(f"\n💰 Buyer action fund (should convert to stable custody)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                        headers={"x-escrow-token": escrow_session},
                        json={"action": "fund", "coin": "BTC"})
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        new_status = deal.get("status")
        custody_stablecoin = deal.get("custody_stablecoin")
        custody_amount_stable = deal.get("custody_amount_stable")
        converted_at = deal.get("converted_at")
        simulated = deal.get("simulated")
        
        if (new_status == "funded" and 
            custody_stablecoin in ["USDT-TRC20", "USDT-TRON"] and 
            custody_amount_stable is not None and 
            custody_amount_stable > 0 and
            converted_at and 
            simulated):
            log(f"✅ PASS: Status='funded', custody_stablecoin={custody_stablecoin}, custody_amount_stable={custody_amount_stable}, converted_at={converted_at}", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected funded+custody conversion", Colors.RED)
            log(f"   Got: status={new_status}, custody_stablecoin={custody_stablecoin}, custody_amount_stable={custody_amount_stable}, converted_at={converted_at}", Colors.RED)
            all_pass = False
    
    # Seller deliver (owner, authed)
    log(f"\n📦 Seller deliver (owner, authed)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/{escrow_id}/deliver", headers=headers, json={
        "delivery_note": "Goods delivered"
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        new_status = deal.get("status")
        auto_release_at = deal.get("auto_release_at")
        
        if new_status == "delivered" and auto_release_at:
            log(f"✅ PASS: Status='delivered', auto_release_at={auto_release_at}", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected delivered+auto_release_at, got status={new_status}, auto_release_at={auto_release_at}", Colors.RED)
            all_pass = False
    
    # Buyer release (two-phase: authorize + payout pending)
    log(f"\n🎉 Buyer action release (should authorize + payout pending)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                        headers={"x-escrow-token": escrow_session},
                        json={"action": "release"})
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        new_status = deal.get("status")
        outcome = deal.get("outcome")
        outcome_authorized_at = deal.get("outcome_authorized_at")
        seller_payout_state = deal.get("seller_payout_state")
        seller_entitlement_stable = deal.get("seller_entitlement_stable")
        settlement_phase = deal.get("settlement_phase")
        
        if (new_status == "completed" and 
            outcome == "release" and 
            outcome_authorized_at and 
            seller_payout_state == "pending" and 
            seller_entitlement_stable is not None and
            settlement_phase == "pending"):
            log(f"✅ PASS: Status='completed', outcome='release', seller_payout_state='pending', settlement_phase='pending'", Colors.GREEN)
            log(f"   seller_entitlement_stable={seller_entitlement_stable}, outcome_authorized_at={outcome_authorized_at}", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected completed+release+pending payout", Colors.RED)
            log(f"   Got: status={new_status}, outcome={outcome}, seller_payout_state={seller_payout_state}, settlement_phase={settlement_phase}", Colors.RED)
            all_pass = False
    
    # Seller adds payout address (owner, authed) -> payout executes
    log(f"\n💳 Seller POST /escrow/:id/payout-info (should trigger payout -> paid)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/{escrow_id}/payout-info", headers=headers, json={
        "payout_address": "TTestSellerAddress123456789",
        "payout_coin": "USDT-TRC20"
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        seller_payout_state = deal.get("seller_payout_state")
        seller_paid_at = deal.get("seller_paid_at")
        seller_payout_tx = deal.get("seller_payout_tx")
        fully_paid_at = deal.get("fully_paid_at")
        settlement_phase = deal.get("settlement_phase")
        
        if (seller_payout_state == "paid" and 
            seller_paid_at and 
            seller_payout_tx and 
            fully_paid_at and
            settlement_phase == "paid"):
            log(f"✅ PASS: seller_payout_state='paid', seller_paid_at={seller_paid_at}, fully_paid_at={fully_paid_at}, settlement_phase='paid'", Colors.GREEN)
            log(f"   seller_payout_tx={seller_payout_tx}", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected seller_payout_state='paid' + fully_paid_at set", Colors.RED)
            log(f"   Got: seller_payout_state={seller_payout_state}, seller_paid_at={seller_paid_at}, fully_paid_at={fully_paid_at}, settlement_phase={settlement_phase}", Colors.RED)
            all_pass = False
    
    return all_pass

def test_happy_path_b(token: str) -> bool:
    """Test 4: Happy Path B - owner is BUYER"""
    log("\n" + "="*80, Colors.BLUE)
    log("TEST 4: HAPPY PATH B (owner=buyer, seller OTP-only adds address)", Colors.BLUE)
    log("="*80, Colors.BLUE)
    
    headers = {"Authorization": f"Bearer {token}"}
    all_pass = True
    
    # Create deal
    log("\n📝 Creating deal (owner=buyer, counterparty=seller)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow", headers=headers, json={
        "company_id": 1,
        "title": "Test Deal B - Owner is Buyer",
        "amount": 150,
        "counterparty_email": SELLER_EMAIL,
        "creator_role": "buyer",
        "fee_payer": "seller",
        "send_invite": True
    })
    
    if resp.status_code != 201:
        log(f"❌ FAIL: Create deal failed: {resp.status_code} {resp.text}", Colors.RED)
        return False
    
    deal_data = resp.json().get("data", {})
    deal_token = deal_data.get("deal_token")
    escrow_id = deal_data.get("escrow_id")
    
    log(f"✅ Deal created: escrow_id={escrow_id}, token={deal_token}", Colors.GREEN)
    
    # Seller OTP-verify
    log(f"\n🔐 Seller OTP-verify...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/send-otp", json={"email": SELLER_EMAIL})
    preview_otp = resp.json().get("data", {}).get("preview_otp")
    
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/verify-otp", json={
        "email": SELLER_EMAIL,
        "otp": preview_otp
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: OTP verify failed: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
        return all_pass
    
    escrow_session = resp.json().get("data", {}).get("escrow_session")
    log(f"✅ OTP verified, escrow_session={escrow_session[:20]}...", Colors.GREEN)
    
    # Seller accept
    log(f"\n✅ Seller respond accept...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/respond", 
                        headers={"x-escrow-token": escrow_session},
                        json={"action": "accept"})
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        log("✅ PASS: Accept successful", Colors.GREEN)
    
    # Buyer simulate-fund (owner, authed)
    log(f"\n💰 Buyer POST /escrow/:id/simulate-fund (owner, authed)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/{escrow_id}/simulate-fund", headers=headers, json={
        "coin": "BTC"
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        if deal.get("status") == "funded":
            log("✅ PASS: Status='funded'", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected status='funded', got '{deal.get('status')}'", Colors.RED)
            all_pass = False
    
    # Seller deliver (OTP-only)
    log(f"\n📦 Seller action deliver (OTP-only)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                        headers={"x-escrow-token": escrow_session},
                        json={"action": "deliver", "delivery_note": "Service completed"})
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        if deal.get("status") == "delivered":
            log("✅ PASS: Status='delivered'", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected status='delivered', got '{deal.get('status')}'", Colors.RED)
            all_pass = False
    
    # Buyer release (owner, authed)
    log(f"\n🎉 Buyer POST /escrow/:id/release (owner, authed)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/{escrow_id}/release", headers=headers)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        if deal.get("status") == "completed" and deal.get("seller_payout_state") == "pending":
            log(f"✅ PASS: Status='completed', seller_payout_state='pending'", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected completed+pending, got status={deal.get('status')}, seller_payout_state={deal.get('seller_payout_state')}", Colors.RED)
            all_pass = False
    
    # Seller adds payout address via public action (OTP-only) -> payout executes
    log(f"\n💳 Seller public action payout-info (OTP-only, should trigger payout)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                        headers={"x-escrow-token": escrow_session},
                        json={
                            "action": "payout-info",
                            "payout_address": "TTestSellerAddress987654321",
                            "payout_coin": "USDT-TRC20"
                        })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        seller_payout_state = deal.get("seller_payout_state")
        seller_paid_at = deal.get("seller_paid_at")
        
        if seller_payout_state == "paid" and seller_paid_at:
            log(f"✅ PASS: seller_payout_state='paid', seller_paid_at={seller_paid_at}", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected seller_payout_state='paid', got {seller_payout_state}", Colors.RED)
            all_pass = False
    
    return all_pass

def test_dispute_admin_resolve(merchant_token: str, admin_token: str) -> bool:
    """Test 5: Dispute + Admin Resolve (split/refund/release)"""
    log("\n" + "="*80, Colors.BLUE)
    log("TEST 5: DISPUTE + ADMIN RESOLVE (split/refund/release)", Colors.BLUE)
    log("="*80, Colors.BLUE)
    
    headers = {"Authorization": f"Bearer {merchant_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    all_pass = True
    
    # Test 5a: Dispute + admin resolve split
    log("\n📝 Test 5a: Create deal, fund, dispute, admin resolve split 60/40...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow", headers=headers, json={
        "company_id": 1,
        "title": "Test Deal - Dispute Split",
        "amount": 100,
        "counterparty_email": BUYER_EMAIL,
        "creator_role": "seller",
        "fee_payer": "buyer",
        "send_invite": True
    })
    
    if resp.status_code != 201:
        log(f"❌ FAIL: Create deal failed: {resp.status_code} {resp.text}", Colors.RED)
        return False
    
    deal_data = resp.json().get("data", {})
    deal_token = deal_data.get("deal_token")
    escrow_id = deal_data.get("escrow_id")
    
    log(f"✅ Deal created: escrow_id={escrow_id}", Colors.GREEN)
    
    # Accept and fund
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/send-otp", json={"email": BUYER_EMAIL})
    preview_otp = resp.json().get("data", {}).get("preview_otp")
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/verify-otp", json={"email": BUYER_EMAIL, "otp": preview_otp})
    escrow_session = resp.json().get("data", {}).get("escrow_session")
    
    requests.post(f"{BASE_URL}/escrow/public/{deal_token}/respond", 
                 headers={"x-escrow-token": escrow_session},
                 json={"action": "accept"})
    requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                 headers={"x-escrow-token": escrow_session},
                 json={"action": "fund"})
    
    # Raise dispute
    log(f"\n⚠️  Authed POST /escrow/{escrow_id}/dispute...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/{escrow_id}/dispute", headers=headers, json={
        "reason": "Product not as described"
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        status = deal.get("status")
        auto_release_at = deal.get("auto_release_at")
        
        if status == "disputed" and auto_release_at is None:
            log(f"✅ PASS: Status='disputed', auto_release_at cleared", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected disputed+cleared auto_release, got status={status}, auto_release_at={auto_release_at}", Colors.RED)
            all_pass = False
    
    # Verify NO payout allowed while disputed (buyer tries to release)
    log(f"\n🚫 Test: release while disputed (buyer tries, should fail 409)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                        headers={"x-escrow-token": escrow_session},
                        json={"action": "release"})
    
    if resp.status_code == 409:
        log(f"✅ PASS: Got 409 as expected (no payout while disputed)", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 409, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Admin get disputes
    log(f"\n👮 Admin GET /escrow/admin/disputes...", Colors.CYAN)
    resp = requests.get(f"{BASE_URL}/escrow/admin/disputes", headers=admin_headers)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        disputes = resp.json().get("data", [])
        found = any(d.get("escrow_id") == escrow_id for d in disputes)
        if found:
            log(f"✅ PASS: Dispute found in admin queue", Colors.GREEN)
        else:
            log(f"❌ FAIL: Dispute not found in admin queue", Colors.RED)
            all_pass = False
    
    # Admin resolve split
    log(f"\n⚖️  Admin POST /escrow/admin/{escrow_id}/resolve (split 60/40)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/admin/{escrow_id}/resolve", headers=admin_headers, json={
        "outcome": "split",
        "split_percent_seller": 60,
        "note": "Partial refund agreed"
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        status = deal.get("status")
        resolution = deal.get("dispute_resolution")
        split_pct = deal.get("split_percent_seller")
        seller_payout_state = deal.get("seller_payout_state")
        buyer_payout_state = deal.get("buyer_payout_state")
        
        if (status == "split" and 
            resolution == "split" and 
            split_pct == 60 and
            seller_payout_state == "pending" and
            buyer_payout_state == "pending"):
            log(f"✅ PASS: Status='split', resolution='split', split_percent_seller=60, both legs pending", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected split+60%+both pending", Colors.RED)
            log(f"   Got: status={status}, resolution={resolution}, split={split_pct}, seller_state={seller_payout_state}, buyer_state={buyer_payout_state}", Colors.RED)
            all_pass = False
    
    # Test 5b: Dispute + admin resolve refund
    log("\n📝 Test 5b: Create deal, fund, dispute, admin resolve refund...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow", headers=headers, json={
        "company_id": 1,
        "title": "Test Deal - Dispute Refund",
        "amount": 80,
        "counterparty_email": BUYER_EMAIL,
        "creator_role": "seller",
        "send_invite": True
    })
    
    if resp.status_code != 201:
        log(f"❌ FAIL: Create deal failed", Colors.RED)
        return all_pass
    
    deal_data = resp.json().get("data", {})
    deal_token2 = deal_data.get("deal_token")
    escrow_id2 = deal_data.get("escrow_id")
    
    log(f"✅ Deal created: escrow_id={escrow_id2}", Colors.GREEN)
    
    # Accept, fund, dispute
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token2}/send-otp", json={"email": BUYER_EMAIL})
    preview_otp = resp.json().get("data", {}).get("preview_otp")
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token2}/verify-otp", json={"email": BUYER_EMAIL, "otp": preview_otp})
    escrow_session = resp.json().get("data", {}).get("escrow_session")
    
    requests.post(f"{BASE_URL}/escrow/public/{deal_token2}/respond", 
                 headers={"x-escrow-token": escrow_session},
                 json={"action": "accept"})
    requests.post(f"{BASE_URL}/escrow/public/{deal_token2}/action", 
                 headers={"x-escrow-token": escrow_session},
                 json={"action": "fund"})
    requests.post(f"{BASE_URL}/escrow/{escrow_id2}/dispute", headers=headers, json={"reason": "Never delivered"})
    
    # Admin resolve refund
    log(f"\n💸 Admin POST /escrow/admin/{escrow_id2}/resolve (refund)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/admin/{escrow_id2}/resolve", headers=admin_headers, json={
        "outcome": "refund",
        "note": "Full refund to buyer"
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        status = deal.get("status")
        resolution = deal.get("dispute_resolution")
        buyer_payout_state = deal.get("buyer_payout_state")
        
        if status == "refunded" and resolution == "refund" and buyer_payout_state == "pending":
            log(f"✅ PASS: Status='refunded', resolution='refund', buyer_payout_state='pending'", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected refunded+refund+pending, got status={status}, resolution={resolution}, buyer_state={buyer_payout_state}", Colors.RED)
            all_pass = False
    
    # Test 5c: Dispute + admin resolve release
    log("\n📝 Test 5c: Create deal, fund, dispute, admin resolve release...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow", headers=headers, json={
        "company_id": 1,
        "title": "Test Deal - Dispute Release",
        "amount": 70,
        "counterparty_email": BUYER_EMAIL,
        "creator_role": "seller",
        "send_invite": True
    })
    
    if resp.status_code != 201:
        log(f"❌ FAIL: Create deal failed", Colors.RED)
        return all_pass
    
    deal_data = resp.json().get("data", {})
    deal_token3 = deal_data.get("deal_token")
    escrow_id3 = deal_data.get("escrow_id")
    
    log(f"✅ Deal created: escrow_id={escrow_id3}", Colors.GREEN)
    
    # Accept, fund, dispute
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token3}/send-otp", json={"email": BUYER_EMAIL})
    preview_otp = resp.json().get("data", {}).get("preview_otp")
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token3}/verify-otp", json={"email": BUYER_EMAIL, "otp": preview_otp})
    escrow_session = resp.json().get("data", {}).get("escrow_session")
    
    requests.post(f"{BASE_URL}/escrow/public/{deal_token3}/respond", 
                 headers={"x-escrow-token": escrow_session},
                 json={"action": "accept"})
    requests.post(f"{BASE_URL}/escrow/public/{deal_token3}/action", 
                 headers={"x-escrow-token": escrow_session},
                 json={"action": "fund"})
    requests.post(f"{BASE_URL}/escrow/{escrow_id3}/dispute", headers=headers, json={"reason": "Dispute test"})
    
    # Admin resolve release
    log(f"\n🎉 Admin POST /escrow/admin/{escrow_id3}/resolve (release)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/admin/{escrow_id3}/resolve", headers=admin_headers, json={
        "outcome": "release",
        "note": "Release to seller"
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        status = deal.get("status")
        outcome = deal.get("outcome")
        
        if status == "completed" and outcome == "release":
            log(f"✅ PASS: Status='completed', outcome='release'", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected completed+release, got status={status}, outcome={outcome}", Colors.RED)
            all_pass = False
    
    return all_pass

def test_state_machine_guards(token: str) -> bool:
    """Test 6: State machine + auth guards"""
    log("\n" + "="*80, Colors.BLUE)
    log("TEST 6: STATE MACHINE + AUTH GUARDS", Colors.BLUE)
    log("="*80, Colors.BLUE)
    
    headers = {"Authorization": f"Bearer {token}"}
    all_pass = True
    
    # Create a deal
    resp = requests.post(f"{BASE_URL}/escrow", headers=headers, json={
        "company_id": 1,
        "title": "Test Deal - State Machine",
        "amount": 50,
        "counterparty_email": BUYER_EMAIL,
        "creator_role": "seller",
        "send_invite": True
    })
    
    if resp.status_code != 201:
        log(f"❌ FAIL: Create deal failed", Colors.RED)
        return False
    
    deal_data = resp.json().get("data", {})
    deal_token = deal_data.get("deal_token")
    escrow_id = deal_data.get("escrow_id")
    
    log(f"✅ Deal created: escrow_id={escrow_id}", Colors.GREEN)
    
    # Accept
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/send-otp", json={"email": BUYER_EMAIL})
    preview_otp = resp.json().get("data", {}).get("preview_otp")
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/verify-otp", json={"email": BUYER_EMAIL, "otp": preview_otp})
    escrow_session = resp.json().get("data", {}).get("escrow_session")
    
    requests.post(f"{BASE_URL}/escrow/public/{deal_token}/respond", 
                 headers={"x-escrow-token": escrow_session},
                 json={"action": "accept"})
    
    # Test: deliver before funded -> 409
    log(f"\n🚫 Test: deliver before funded (should fail 409)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/{escrow_id}/deliver", headers=headers)
    
    if resp.status_code == 409:
        log(f"✅ PASS: Got 409 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 409, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Test: release before funded -> 409 (buyer tries via public action)
    log(f"\n🚫 Test: release before funded (buyer tries, should fail 409)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                        headers={"x-escrow-token": escrow_session},
                        json={"action": "release"})
    
    if resp.status_code == 409:
        log(f"✅ PASS: Got 409 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 409, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Fund the deal
    requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                 headers={"x-escrow-token": escrow_session},
                 json={"action": "fund"})
    
    # Test: cancel after funded -> 409
    log(f"\n🚫 Test: cancel after funded (should fail 409)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/{escrow_id}/cancel", headers=headers)
    
    if resp.status_code == 409:
        log(f"✅ PASS: Got 409 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 409, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Test: self-invite -> 400
    log(f"\n🚫 Test: create with counterparty_email == owner email (should fail 400)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow", headers=headers, json={
        "company_id": 1,
        "title": "Self Invite Test",
        "amount": 100,
        "counterparty_email": MERCHANT_EMAIL,
        "creator_role": "seller"
    })
    
    if resp.status_code == 400:
        log(f"✅ PASS: Got 400 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 400, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Test: unauthenticated GET /api/escrow -> 401
    log(f"\n🚫 Test: unauthenticated GET /api/escrow (should fail 401)...", Colors.CYAN)
    resp = requests.get(f"{BASE_URL}/escrow")
    
    if resp.status_code == 401:
        log(f"✅ PASS: Got 401 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 401, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    return all_pass

def test_idempotency(token: str) -> bool:
    """Test 7: Idempotency - releasing/paying twice doesn't double-pay"""
    log("\n" + "="*80, Colors.BLUE)
    log("TEST 7: IDEMPOTENCY (releasing/paying twice doesn't double-pay)", Colors.BLUE)
    log("="*80, Colors.BLUE)
    
    headers = {"Authorization": f"Bearer {token}"}
    all_pass = True
    
    # Create deal where owner is BUYER (so owner can release)
    log("\n📝 Creating deal for idempotency test (owner=buyer)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow", headers=headers, json={
        "company_id": 1,
        "title": "Test Deal - Idempotency",
        "amount": 60,
        "counterparty_email": SELLER_EMAIL,
        "creator_role": "buyer",
        "send_invite": True
    })
    
    if resp.status_code != 201:
        log(f"❌ FAIL: Create deal failed", Colors.RED)
        return False
    
    deal_data = resp.json().get("data", {})
    deal_token = deal_data.get("deal_token")
    escrow_id = deal_data.get("escrow_id")
    
    # Seller accept
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/send-otp", json={"email": SELLER_EMAIL})
    preview_otp = resp.json().get("data", {}).get("preview_otp")
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/verify-otp", json={"email": SELLER_EMAIL, "otp": preview_otp})
    escrow_session = resp.json().get("data", {}).get("escrow_session")
    
    requests.post(f"{BASE_URL}/escrow/public/{deal_token}/respond", 
                 headers={"x-escrow-token": escrow_session},
                 json={"action": "accept"})
    
    # Buyer fund (owner, authed)
    requests.post(f"{BASE_URL}/escrow/{escrow_id}/simulate-fund", headers=headers, json={"coin": "BTC"})
    
    # Seller deliver
    requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                 headers={"x-escrow-token": escrow_session},
                 json={"action": "deliver", "delivery_note": "Delivered"})
    
    # Release once (owner=buyer)
    log(f"\n🎉 First release (owner=buyer)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/{escrow_id}/release", headers=headers)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: First release failed: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
        return all_pass
    
    deal = resp.json().get("data", {})
    first_outcome_authorized_at = deal.get("outcome_authorized_at")
    log(f"✅ First release successful, outcome_authorized_at={first_outcome_authorized_at}", Colors.GREEN)
    
    # Try to release again (should be idempotent - fail with 409)
    log(f"\n🚫 Second release (should fail 409 - already settled)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/{escrow_id}/release", headers=headers)
    
    if resp.status_code == 409:
        log(f"✅ PASS: Got 409 as expected (idempotent - no double-release)", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 409, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Seller adds payout address (OTP-only)
    log(f"\n💳 Seller adding payout address (first time, OTP-only)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                        headers={"x-escrow-token": escrow_session},
                        json={
                            "action": "payout-info",
                            "payout_address": "TTestIdempotencyAddress",
                            "payout_coin": "USDT-TRC20"
                        })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: Add payout address failed: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
        return all_pass
    
    deal = resp.json().get("data", {})
    first_seller_paid_at = deal.get("seller_paid_at")
    first_seller_payout_tx = deal.get("seller_payout_tx")
    log(f"✅ Payout executed, seller_paid_at={first_seller_paid_at}, tx={first_seller_payout_tx}", Colors.GREEN)
    
    # Try to add payout address again (should be idempotent - no double-pay)
    log(f"\n💳 Seller adding payout address again (should be idempotent - no double-pay)...", Colors.CYAN)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                        headers={"x-escrow-token": escrow_session},
                        json={
                            "action": "payout-info",
                            "payout_address": "TTestIdempotencyAddress2",
                            "payout_coin": "USDT-TRC20"
                        })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: Second payout-info failed: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
        return all_pass
    
    deal = resp.json().get("data", {})
    second_seller_paid_at = deal.get("seller_paid_at")
    second_seller_payout_tx = deal.get("seller_payout_tx")
    
    if (second_seller_paid_at == first_seller_paid_at and 
        second_seller_payout_tx == first_seller_payout_tx):
        log(f"✅ PASS: Idempotent - same paid_at and tx (no double-pay)", Colors.GREEN)
    else:
        log(f"❌ FAIL: Not idempotent - different paid_at or tx", Colors.RED)
        log(f"   First: paid_at={first_seller_paid_at}, tx={first_seller_payout_tx}", Colors.RED)
        log(f"   Second: paid_at={second_seller_paid_at}, tx={second_seller_payout_tx}", Colors.RED)
        all_pass = False
    
    return all_pass

def main():
    log("\n" + "="*80, Colors.BLUE)
    log("🚀 DYNOPAY ESCROW SERVICE BACKEND TEST v2", Colors.BLUE)
    log("="*80, Colors.BLUE)
    log(f"Base URL: {BASE_URL}", Colors.BLUE)
    log(f"Mode: SAFE MODE (simulated settlement, no real crypto)", Colors.YELLOW)
    log("="*80 + "\n", Colors.BLUE)
    
    # Login
    merchant_token = merchant_login()
    if not merchant_token:
        log("\n❌ FATAL: Merchant login failed. Cannot proceed.", Colors.RED)
        sys.exit(1)
    
    admin_token = admin_login()
    if not admin_token:
        log("\n❌ FATAL: Admin login failed. Cannot proceed.", Colors.RED)
        sys.exit(1)
    
    # Run tests
    results = {}
    
    results["Test 1: Fee Math"] = test_fee_math(merchant_token)
    results["Test 2: OTP Onboarding"] = test_otp_onboarding(merchant_token)
    results["Test 3: Happy Path A (owner=seller, custody, two-phase)"] = test_happy_path_a(merchant_token)
    results["Test 4: Happy Path B (owner=buyer, seller OTP-only)"] = test_happy_path_b(merchant_token)
    results["Test 5: Dispute + Admin Resolve"] = test_dispute_admin_resolve(merchant_token, admin_token)
    results["Test 6: State Machine + Auth Guards"] = test_state_machine_guards(merchant_token)
    results["Test 7: Idempotency"] = test_idempotency(merchant_token)
    
    # Summary
    log("\n" + "="*80, Colors.BLUE)
    log("📊 TEST SUMMARY", Colors.BLUE)
    log("="*80, Colors.BLUE)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_flag in results.items():
        status = "✅ PASS" if passed_flag else "❌ FAIL"
        color = Colors.GREEN if passed_flag else Colors.RED
        log(f"{status} - {test_name}", color)
    
    log("\n" + "="*80, Colors.BLUE)
    log(f"TOTAL: {passed}/{total} tests passed", Colors.GREEN if passed == total else Colors.RED)
    log("="*80 + "\n", Colors.BLUE)
    
    if passed == total:
        log("🎉 ALL TESTS PASSED! Escrow service v2 is working correctly.", Colors.GREEN)
        sys.exit(0)
    else:
        log(f"⚠️  {total - passed} test(s) failed. Review the output above.", Colors.YELLOW)
        sys.exit(1)

if __name__ == "__main__":
    main()
