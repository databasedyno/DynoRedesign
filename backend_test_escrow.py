#!/usr/bin/env python3
"""
Backend test for DynoPay Escrow Service v1 (SAFE MODE - simulated settlement).
Tests the full escrow lifecycle: fee math, happy paths, disputes, state machine, auth guards.
"""
import requests
import json
import time
import subprocess
import sys
from typing import Dict, Any, Optional

# Base URL from .env.local
BASE_URL = "https://7f123f55-5720-4355-8e48-5cafe6f3c410.preview.emergentagent.com/api"

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
    END = '\033[0m'

def log(msg: str, color: str = ""):
    print(f"{color}{msg}{Colors.END}")

def get_csrf_token() -> tuple[str, dict]:
    """Get CSRF token and cookies"""
    try:
        resp = requests.get(f"{BASE_URL}/csrf-token")
        if resp.status_code == 200:
            csrf_token = resp.json().get("data", {}).get("csrf_token", "")
            cookies = resp.cookies.get_dict()
            return csrf_token, cookies
        return "", {}
    except Exception as e:
        log(f"⚠️  Failed to get CSRF token: {e}", Colors.YELLOW)
        return "", {}

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
        # Direct token
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
    log("\n📊 Test 1a: fee_payer='buyer', amount=100, fee_percent=5", Colors.BLUE)
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
    log("\n📊 Test 1b: fee_payer='seller', amount=100, fee_percent=5", Colors.BLUE)
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
    log("\n📊 Test 1c: fee_payer='split', amount=100, fee_percent=5", Colors.BLUE)
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
    
    # Test 1d: fee_min_usd floor
    log("\n📊 Test 1d: fee_min_usd floor, amount=5, fee_percent=5, fee_min_usd=1", Colors.BLUE)
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

def test_happy_path_a(token: str) -> bool:
    """Test 2: Happy Path A - owner is SELLER"""
    log("\n" + "="*80, Colors.BLUE)
    log("TEST 2: HAPPY PATH A (owner is SELLER)", Colors.BLUE)
    log("="*80, Colors.BLUE)
    
    headers = {"Authorization": f"Bearer {token}"}
    csrf_token, csrf_cookies = get_csrf_token()
    all_pass = True
    
    # Create deal
    log("\n📝 Creating deal (owner=seller, counterparty=buyer)...", Colors.BLUE)
    resp = requests.post(f"{BASE_URL}/escrow", headers=headers, json={
        "company_id": 1,
        "title": "Test Deal A - Owner is Seller",
        "description": "Testing happy path where owner is the seller",
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
    
    # Public GET
    log(f"\n🌐 Public GET /api/escrow/public/{deal_token}...", Colors.BLUE)
    resp = requests.get(f"{BASE_URL}/escrow/public/{deal_token}")
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        log("✅ PASS: Public GET successful", Colors.GREEN)
    
    # Public accept
    log(f"\n✅ Public respond accept (email={BUYER_EMAIL})...", Colors.BLUE)
    public_headers = {"x-csrf-token": csrf_token} if csrf_token else {}
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/respond", 
                        headers=public_headers,
                        cookies=csrf_cookies,
                        json={
        "action": "accept",
        "email": BUYER_EMAIL
    })
    
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
    
    # Public fund
    log(f"\n💰 Public action fund (email={BUYER_EMAIL})...", Colors.BLUE)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                        headers=public_headers,
                        cookies=csrf_cookies,
                        json={
        "action": "fund",
        "email": BUYER_EMAIL,
        "coin": "BTC"
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        new_status = deal.get("status")
        funding_address = deal.get("funding_deposit_address")
        simulated = deal.get("simulated")
        
        if new_status == "funded" and simulated and funding_address and funding_address.startswith("SIMULATED-"):
            log(f"✅ PASS: Status='funded', simulated=True, address={funding_address}", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected funded+simulated, got status={new_status}, simulated={simulated}, addr={funding_address}", Colors.RED)
            all_pass = False
    
    # Authed deliver (owner=seller)
    log(f"\n📦 Authed POST /{escrow_id}/deliver (owner=seller)...", Colors.BLUE)
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
    
    # Public release
    log(f"\n🎉 Public action release (email={BUYER_EMAIL})...", Colors.BLUE)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                        headers=public_headers,
                        cookies=csrf_cookies,
                        json={
        "action": "release",
        "email": BUYER_EMAIL
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        new_status = deal.get("status")
        settlement_note = deal.get("settlement_note", "")
        
        if new_status == "completed" and "[SIMULATED" in settlement_note:
            log(f"✅ PASS: Status='completed', settlement_note contains '[SIMULATED'", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected completed+simulated note, got status={new_status}, note={settlement_note}", Colors.RED)
            all_pass = False
    
    return all_pass

def test_happy_path_b(token: str) -> bool:
    """Test 3: Happy Path B - owner is BUYER"""
    log("\n" + "="*80, Colors.BLUE)
    log("TEST 3: HAPPY PATH B (owner is BUYER)", Colors.BLUE)
    log("="*80, Colors.BLUE)
    
    headers = {"Authorization": f"Bearer {token}"}
    csrf_token, csrf_cookies = get_csrf_token()
    public_headers = {"x-csrf-token": csrf_token} if csrf_token else {}
    all_pass = True
    
    # Create deal
    log("\n📝 Creating deal (owner=buyer, counterparty=seller)...", Colors.BLUE)
    resp = requests.post(f"{BASE_URL}/escrow", headers=headers, json={
        "company_id": 1,
        "title": "Test Deal B - Owner is Buyer",
        "description": "Testing happy path where owner is the buyer",
        "amount": 150,
        "currency": "USD",
        "accepted_coins": "USDT-TRC20,BTC",
        "counterparty_email": SELLER_EMAIL,
        "creator_role": "buyer",
        "fee_percent": 5,
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
    
    # Public accept
    log(f"\n✅ Public respond accept (email={SELLER_EMAIL})...", Colors.BLUE)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/respond", 
                        headers=public_headers,
                        cookies=csrf_cookies,
                        json={
        "action": "accept",
        "email": SELLER_EMAIL
    })
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        log("✅ PASS: Accept successful", Colors.GREEN)
    
    # Authed simulate-fund (owner=buyer)
    log(f"\n💰 Authed POST /{escrow_id}/simulate-fund (owner=buyer)...", Colors.BLUE)
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
    
    # Public deliver
    log(f"\n📦 Public action deliver (email={SELLER_EMAIL})...", Colors.BLUE)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                        headers=public_headers,
                        cookies=csrf_cookies,
                        json={
        "action": "deliver",
        "email": SELLER_EMAIL,
        "delivery_note": "Service completed"
    })
    
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
    
    # Authed release (owner=buyer)
    log(f"\n🎉 Authed POST /{escrow_id}/release (owner=buyer)...", Colors.BLUE)
    resp = requests.post(f"{BASE_URL}/escrow/{escrow_id}/release", headers=headers)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deal = resp.json().get("data", {})
        if deal.get("status") == "completed":
            log("✅ PASS: Status='completed'", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected status='completed', got '{deal.get('status')}'", Colors.RED)
            all_pass = False
    
    return all_pass

def test_dispute_admin_resolve(merchant_token: str, admin_token: str) -> bool:
    """Test 4: Dispute + Admin Resolve"""
    log("\n" + "="*80, Colors.BLUE)
    log("TEST 4: DISPUTE + ADMIN RESOLVE", Colors.BLUE)
    log("="*80, Colors.BLUE)
    
    headers = {"Authorization": f"Bearer {merchant_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    csrf_token, csrf_cookies = get_csrf_token()
    public_headers = {"x-csrf-token": csrf_token} if csrf_token else {}
    all_pass = True
    
    # Create and fund a deal for split resolution
    log("\n📝 Creating deal for split resolution...", Colors.BLUE)
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
    requests.post(f"{BASE_URL}/escrow/public/{deal_token}/respond", 
                 headers=public_headers, cookies=csrf_cookies,
                 json={"action": "accept", "email": BUYER_EMAIL})
    requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                 headers=public_headers, cookies=csrf_cookies,
                 json={"action": "fund", "email": BUYER_EMAIL})
    
    # Raise dispute
    log(f"\n⚠️  Authed POST /{escrow_id}/dispute...", Colors.BLUE)
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
    
    # Admin get disputes
    log(f"\n👮 Admin GET /api/escrow/admin/disputes...", Colors.BLUE)
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
    log(f"\n⚖️  Admin POST /api/escrow/admin/{escrow_id}/resolve (split 60/40)...", Colors.BLUE)
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
        
        if status == "completed" and resolution == "split" and split_pct == 60:
            log(f"✅ PASS: Status='completed', resolution='split', split_percent_seller=60", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected completed+split+60%, got status={status}, resolution={resolution}, split={split_pct}", Colors.RED)
            all_pass = False
    
    # Create another deal for refund resolution
    log("\n📝 Creating deal for refund resolution...", Colors.BLUE)
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
    requests.post(f"{BASE_URL}/escrow/public/{deal_token2}/respond", 
                 headers=public_headers, cookies=csrf_cookies,
                 json={"action": "accept", "email": BUYER_EMAIL})
    requests.post(f"{BASE_URL}/escrow/public/{deal_token2}/action", 
                 headers=public_headers, cookies=csrf_cookies,
                 json={"action": "fund", "email": BUYER_EMAIL})
    requests.post(f"{BASE_URL}/escrow/{escrow_id2}/dispute", headers=headers, json={"reason": "Never delivered"})
    
    # Admin resolve refund
    log(f"\n💸 Admin POST /api/escrow/admin/{escrow_id2}/resolve (refund)...", Colors.BLUE)
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
        
        if status == "refunded" and resolution == "refund":
            log(f"✅ PASS: Status='refunded', resolution='refund'", Colors.GREEN)
        else:
            log(f"❌ FAIL: Expected refunded+refund, got status={status}, resolution={resolution}", Colors.RED)
            all_pass = False
    
    return all_pass

def test_state_machine_guards(token: str) -> bool:
    """Test 5: State machine + auth guards"""
    log("\n" + "="*80, Colors.BLUE)
    log("TEST 5: STATE MACHINE + AUTH GUARDS", Colors.BLUE)
    log("="*80, Colors.BLUE)
    
    headers = {"Authorization": f"Bearer {token}"}
    csrf_token, csrf_cookies = get_csrf_token()
    public_headers = {"x-csrf-token": csrf_token} if csrf_token else {}
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
    requests.post(f"{BASE_URL}/escrow/public/{deal_token}/respond", 
                 headers=public_headers, cookies=csrf_cookies,
                 json={"action": "accept", "email": BUYER_EMAIL})
    
    # Test: deliver before funded -> 409
    log(f"\n🚫 Test: deliver before funded (should fail 409)...", Colors.BLUE)
    resp = requests.post(f"{BASE_URL}/escrow/{escrow_id}/deliver", headers=headers)
    
    if resp.status_code == 409:
        log(f"✅ PASS: Got 409 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 409, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Test: release before funded -> 409
    log(f"\n🚫 Test: release before funded (should fail 409)...", Colors.BLUE)
    resp = requests.post(f"{BASE_URL}/escrow/{escrow_id}/release", headers=headers)
    
    if resp.status_code == 409:
        log(f"✅ PASS: Got 409 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 409, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Fund the deal
    requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action", 
                 headers=public_headers, cookies=csrf_cookies,
                 json={"action": "fund", "email": BUYER_EMAIL})
    
    # Test: cancel after funded -> 409
    log(f"\n🚫 Test: cancel after funded (should fail 409)...", Colors.BLUE)
    resp = requests.post(f"{BASE_URL}/escrow/{escrow_id}/cancel", headers=headers)
    
    if resp.status_code == 409:
        log(f"✅ PASS: Got 409 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 409, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Test: self-invite -> 400
    log(f"\n🚫 Test: create with counterparty_email == owner email (should fail 400)...", Colors.BLUE)
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
    
    # Test: missing amount -> 400
    log(f"\n🚫 Test: create with missing amount (should fail 400)...", Colors.BLUE)
    resp = requests.post(f"{BASE_URL}/escrow", headers=headers, json={
        "company_id": 1,
        "title": "Missing Amount",
        "counterparty_email": BUYER_EMAIL
    })
    
    if resp.status_code == 400:
        log(f"✅ PASS: Got 400 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 400, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Test: public respond with wrong email -> 403
    log(f"\n🚫 Test: public respond with wrong email (should fail 403)...", Colors.BLUE)
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/respond", 
                        headers=public_headers, cookies=csrf_cookies,
                        json={
        "action": "accept",
        "email": "wrong@example.com"
    })
    
    if resp.status_code == 403:
        log(f"✅ PASS: Got 403 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 403, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    # Test: unauthenticated GET /api/escrow -> 401
    log(f"\n🚫 Test: unauthenticated GET /api/escrow (should fail 401)...", Colors.BLUE)
    resp = requests.get(f"{BASE_URL}/escrow")
    
    if resp.status_code == 401:
        log(f"✅ PASS: Got 401 as expected", Colors.GREEN)
    else:
        log(f"❌ FAIL: Expected 401, got {resp.status_code}", Colors.RED)
        all_pass = False
    
    return all_pass

def test_list_participant_scoping(token: str) -> bool:
    """Test 6: List + participant scoping"""
    log("\n" + "="*80, Colors.BLUE)
    log("TEST 6: LIST + PARTICIPANT SCOPING", Colors.BLUE)
    log("="*80, Colors.BLUE)
    
    headers = {"Authorization": f"Bearer {token}"}
    all_pass = True
    
    # List deals
    log(f"\n📋 GET /api/escrow?company_id=1...", Colors.BLUE)
    resp = requests.get(f"{BASE_URL}/escrow?company_id=1", headers=headers)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deals = resp.json().get("data", [])
        log(f"✅ PASS: Got {len(deals)} deals", Colors.GREEN)
        
        # Check that deals have my_role and is_creator fields
        if deals:
            first_deal = deals[0]
            if "my_role" in first_deal and "is_creator" in first_deal:
                log(f"✅ PASS: Deals have my_role and is_creator fields", Colors.GREEN)
            else:
                log(f"❌ FAIL: Deals missing my_role or is_creator fields", Colors.RED)
                all_pass = False
    
    # Test role filter
    log(f"\n📋 GET /api/escrow?company_id=1&role=buyer...", Colors.BLUE)
    resp = requests.get(f"{BASE_URL}/escrow?company_id=1&role=buyer", headers=headers)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deals = resp.json().get("data", [])
        log(f"✅ PASS: Got {len(deals)} buyer deals", Colors.GREEN)
        
        # Verify all are buyer role
        if deals:
            all_buyer = all(d.get("my_role") == "buyer" for d in deals)
            if all_buyer:
                log(f"✅ PASS: All deals have my_role='buyer'", Colors.GREEN)
            else:
                log(f"❌ FAIL: Some deals don't have my_role='buyer'", Colors.RED)
                all_pass = False
    
    log(f"\n📋 GET /api/escrow?company_id=1&role=seller...", Colors.BLUE)
    resp = requests.get(f"{BASE_URL}/escrow?company_id=1&role=seller", headers=headers)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: {resp.status_code} {resp.text}", Colors.RED)
        all_pass = False
    else:
        deals = resp.json().get("data", [])
        log(f"✅ PASS: Got {len(deals)} seller deals", Colors.GREEN)
        
        # Verify all are seller role
        if deals:
            all_seller = all(d.get("my_role") == "seller" for d in deals)
            if all_seller:
                log(f"✅ PASS: All deals have my_role='seller'", Colors.GREEN)
            else:
                log(f"❌ FAIL: Some deals don't have my_role='seller'", Colors.RED)
                all_pass = False
    
    return all_pass

def main():
    log("\n" + "="*80, Colors.BLUE)
    log("🚀 DYNOPAY ESCROW SERVICE BACKEND TEST", Colors.BLUE)
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
    results["Test 2: Happy Path A (owner=seller)"] = test_happy_path_a(merchant_token)
    results["Test 3: Happy Path B (owner=buyer)"] = test_happy_path_b(merchant_token)
    results["Test 4: Dispute + Admin Resolve"] = test_dispute_admin_resolve(merchant_token, admin_token)
    results["Test 5: State Machine + Auth Guards"] = test_state_machine_guards(merchant_token)
    results["Test 6: List + Participant Scoping"] = test_list_participant_scoping(merchant_token)
    
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
        log("🎉 ALL TESTS PASSED! Escrow service is working correctly.", Colors.GREEN)
        sys.exit(0)
    else:
        log(f"⚠️  {total - passed} test(s) failed. Review the output above.", Colors.YELLOW)
        sys.exit(1)

if __name__ == "__main__":
    main()
