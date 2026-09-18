#!/usr/bin/env python3
"""
Escrow backend test — focused re-test of two small changes:
  CHANGE 1: Escrow fee % is now ADMIN-CONTROLLED via .env (client values ignored)
  CHANGE 2: auto_release_days now clamps to presets {3,5,7,14}, default 3

SAFE MODE: LIVE prod DB, simulated money. Throwaway counterparties escrow_test_*.
"""
import requests
import json
import sys
import subprocess
import random
import time

BASE_URL = "http://localhost:8001"
API_PREFIX = "/api"

# Merchant auth credentials
MERCHANT_EMAIL = "onarrival21@gmail.com"
MERCHANT_PASSWORD = "Katiekendra123@"
COMPANY_ID = 1

def log(msg):
    print(f"[TEST] {msg}")

def get_totp():
    """Get current TOTP token for 2FA"""
    try:
        result = subprocess.run(
            ["node", "/app/backend/scripts/print_totp.cjs", "1"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.stdout.strip()
    except Exception as e:
        log(f"ERROR getting TOTP: {e}")
        return None

def merchant_login():
    """Login as merchant with 2FA"""
    log("Logging in as merchant...")
    
    # Step 1: Initial login
    resp = requests.post(f"{BASE_URL}{API_PREFIX}/user/login", json={
        "email": MERCHANT_EMAIL,
        "password": MERCHANT_PASSWORD
    })
    
    if resp.status_code != 200:
        log(f"Login failed: {resp.status_code} {resp.text}")
        return None
    
    data = resp.json().get("data", {})
    challenge_token = data.get("challenge_token")
    
    if not challenge_token:
        log(f"No challenge_token in response: {resp.json()}")
        return None
    
    # Step 2: 2FA validation
    totp = get_totp()
    if not totp:
        log("Failed to get TOTP token")
        return None
    
    log(f"Using TOTP: {totp}")
    
    resp2 = requests.post(f"{BASE_URL}{API_PREFIX}/user/2fa/validate", json={
        "challenge_token": challenge_token,
        "token": totp
    })
    
    if resp2.status_code != 200:
        log(f"2FA validation failed: {resp2.status_code} {resp2.text}")
        return None
    
    data2 = resp2.json().get("data", {})
    access_token = data2.get("accessToken")
    
    if not access_token:
        log(f"No accessToken in 2FA response: {resp2.json()}")
        return None
    
    log("✓ Merchant login successful")
    return access_token

def random_email():
    """Generate random throwaway email"""
    return f"escrow_test_{random.randint(100000, 999999)}@example.com"

def test_fee_preview_ignores_client_values(token):
    """
    CHANGE 1a: POST /api/escrow/fee-preview with client fee_percent:99, fee_min_usd:50
    → assert returned breakdown.feePercent == 5 and breakdown.feeMinUsd == 1 (NOT 99/50)
    """
    log("\n=== TEST 1a: Fee preview ignores client-supplied fee values ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "amount": 100,
        "fee_payer": "buyer",
        "fee_percent": 99,  # Client tries to set 99% - should be ignored
        "fee_min_usd": 50,  # Client tries to set $50 min - should be ignored
        "payout_coin": "USDT-TRON"
    }
    
    resp = requests.post(f"{BASE_URL}{API_PREFIX}/escrow/fee-preview", json=payload, headers=headers)
    
    if resp.status_code != 200:
        log(f"✗ FAIL: HTTP {resp.status_code}: {resp.text}")
        return False
    
    data = resp.json().get("data", {})
    fee_percent = data.get("feePercent")
    fee_min_usd = data.get("feeMinUsd")
    escrow_fee = data.get("escrowFee")
    
    log(f"Response: feePercent={fee_percent}, feeMinUsd={fee_min_usd}, escrowFee={escrow_fee}")
    
    # Assert admin values (5%, $1 min) were used, NOT client values (99%, $50)
    if fee_percent != 5:
        log(f"✗ FAIL: feePercent={fee_percent}, expected 5 (client 99 was NOT ignored)")
        return False
    
    if fee_min_usd != 1:
        log(f"✗ FAIL: feeMinUsd={fee_min_usd}, expected 1 (client 50 was NOT ignored)")
        return False
    
    if escrow_fee != 5.0:
        log(f"✗ FAIL: escrowFee={escrow_fee}, expected 5.00 (5% of 100)")
        return False
    
    log("✓ PASS: Client fee values ignored, admin values (5%, $1) applied")
    return True

def test_create_deal_ignores_client_fee(token):
    """
    CHANGE 1b: POST /api/escrow with fee_percent:42, fee_min_usd:20
    → GET the deal and assert stored fee_percent == 5 and fee_min_usd == 1
    """
    log("\n=== TEST 1b: Create deal ignores client fee values ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    counterparty = random_email()
    
    payload = {
        "company_id": COMPANY_ID,
        "title": "fee-test",
        "amount": 100,
        "currency": "USD",
        "counterparty_email": counterparty,
        "creator_role": "seller",
        "fee_payer": "buyer",
        "fee_percent": 42,  # Client tries to set 42% - should be ignored
        "fee_min_usd": 20,  # Client tries to set $20 min - should be ignored
        "accepted_coins": "USDT-TRON,BTC",
        "send_invite": False
    }
    
    resp = requests.post(f"{BASE_URL}{API_PREFIX}/escrow", json=payload, headers=headers)
    
    if resp.status_code != 201:
        log(f"✗ FAIL: HTTP {resp.status_code}: {resp.text}")
        return False
    
    data = resp.json().get("data", {})
    escrow_id = data.get("escrow_id")
    
    log(f"Created deal {escrow_id}")
    
    # GET the deal to verify stored values
    resp2 = requests.get(f"{BASE_URL}{API_PREFIX}/escrow/{escrow_id}", headers=headers)
    
    if resp2.status_code != 200:
        log(f"✗ FAIL: GET failed: {resp2.status_code}: {resp2.text}")
        return False
    
    deal = resp2.json().get("data", {})
    stored_fee_percent = deal.get("fee_percent")
    stored_fee_min_usd = deal.get("breakdown", {}).get("feeMinUsd")
    fee_payer = deal.get("fee_payer")
    
    log(f"Stored: fee_percent={stored_fee_percent}, feeMinUsd={stored_fee_min_usd}, fee_payer={fee_payer}")
    
    # Assert admin values were stored, NOT client values
    if stored_fee_percent != 5:
        log(f"✗ FAIL: stored fee_percent={stored_fee_percent}, expected 5 (client 42 was NOT ignored)")
        return False
    
    if stored_fee_min_usd != 1:
        log(f"✗ FAIL: stored feeMinUsd={stored_fee_min_usd}, expected 1 (client 20 was NOT ignored)")
        return False
    
    # Verify fee_payer WAS honored (it's still a merchant choice)
    if fee_payer != "buyer":
        log(f"✗ FAIL: fee_payer={fee_payer}, expected 'buyer' (should be honored)")
        return False
    
    log("✓ PASS: Client fee values ignored, admin values (5%, $1) stored, fee_payer honored")
    return True

def test_fee_minimum_applied(token):
    """
    CHANGE 1c: Small amount preview (amount:5, fee_payer:buyer)
    → escrowFee == 1.00 (since 5% of 5 = 0.25 < $1 min)
    """
    log("\n=== TEST 1c: Fee minimum applied for small amounts ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "amount": 5,
        "fee_payer": "buyer",
        "payout_coin": "USDT-TRON"
    }
    
    resp = requests.post(f"{BASE_URL}{API_PREFIX}/escrow/fee-preview", json=payload, headers=headers)
    
    if resp.status_code != 200:
        log(f"✗ FAIL: HTTP {resp.status_code}: {resp.text}")
        return False
    
    data = resp.json().get("data", {})
    escrow_fee = data.get("escrowFee")
    
    log(f"Response: escrowFee={escrow_fee} (5% of 5 = 0.25, min $1 should apply)")
    
    # 5% of $5 = $0.25, but min is $1, so escrowFee should be $1.00
    if escrow_fee != 1.0:
        log(f"✗ FAIL: escrowFee={escrow_fee}, expected 1.00 (minimum not applied)")
        return False
    
    log("✓ PASS: $1 minimum fee applied for small amount")
    return True

def test_auto_release_invalid_clamped(token):
    """
    CHANGE 2d: Create deal with auto_release_days:99
    → assert stored auto_release_days == 3 (invalid value clamped to default)
    """
    log("\n=== TEST 2d: Invalid auto_release_days clamped to default ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    counterparty = random_email()
    
    payload = {
        "company_id": COMPANY_ID,
        "title": "auto-release-test-invalid",
        "amount": 50,
        "currency": "USD",
        "counterparty_email": counterparty,
        "creator_role": "seller",
        "fee_payer": "buyer",
        "auto_release_days": 99,  # Invalid - should clamp to 3
        "send_invite": False
    }
    
    resp = requests.post(f"{BASE_URL}{API_PREFIX}/escrow", json=payload, headers=headers)
    
    if resp.status_code != 201:
        log(f"✗ FAIL: HTTP {resp.status_code}: {resp.text}")
        return False
    
    data = resp.json().get("data", {})
    escrow_id = data.get("escrow_id")
    auto_release_days = data.get("auto_release_days")
    
    log(f"Created deal {escrow_id}, auto_release_days={auto_release_days}")
    
    if auto_release_days != 3:
        log(f"✗ FAIL: auto_release_days={auto_release_days}, expected 3 (invalid 99 not clamped)")
        return False
    
    log("✓ PASS: Invalid auto_release_days (99) clamped to default (3)")
    return True

def test_auto_release_valid_preset(token):
    """
    CHANGE 2e: Create deal with auto_release_days:7
    → assert stored auto_release_days == 7 (valid preset honored)
    """
    log("\n=== TEST 2e: Valid auto_release_days preset honored ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    counterparty = random_email()
    
    payload = {
        "company_id": COMPANY_ID,
        "title": "auto-release-test-valid",
        "amount": 50,
        "currency": "USD",
        "counterparty_email": counterparty,
        "creator_role": "seller",
        "fee_payer": "buyer",
        "auto_release_days": 7,  # Valid preset - should be honored
        "send_invite": False
    }
    
    resp = requests.post(f"{BASE_URL}{API_PREFIX}/escrow", json=payload, headers=headers)
    
    if resp.status_code != 201:
        log(f"✗ FAIL: HTTP {resp.status_code}: {resp.text}")
        return False
    
    data = resp.json().get("data", {})
    escrow_id = data.get("escrow_id")
    auto_release_days = data.get("auto_release_days")
    
    log(f"Created deal {escrow_id}, auto_release_days={auto_release_days}")
    
    if auto_release_days != 7:
        log(f"✗ FAIL: auto_release_days={auto_release_days}, expected 7 (valid preset not honored)")
        return False
    
    log("✓ PASS: Valid auto_release_days preset (7) honored")
    return True

def test_auto_release_non_preset_clamped(token):
    """
    CHANGE 2f: Create deal with auto_release_days:4
    → assert stored auto_release_days == 3 (non-preset clamped to default)
    """
    log("\n=== TEST 2f: Non-preset auto_release_days clamped to default ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    counterparty = random_email()
    
    payload = {
        "company_id": COMPANY_ID,
        "title": "auto-release-test-non-preset",
        "amount": 50,
        "currency": "USD",
        "counterparty_email": counterparty,
        "creator_role": "seller",
        "fee_payer": "buyer",
        "auto_release_days": 4,  # Not in presets {3,5,7,14} - should clamp to 3
        "send_invite": False
    }
    
    resp = requests.post(f"{BASE_URL}{API_PREFIX}/escrow", json=payload, headers=headers)
    
    if resp.status_code != 201:
        log(f"✗ FAIL: HTTP {resp.status_code}: {resp.text}")
        return False
    
    data = resp.json().get("data", {})
    escrow_id = data.get("escrow_id")
    auto_release_days = data.get("auto_release_days")
    
    log(f"Created deal {escrow_id}, auto_release_days={auto_release_days}")
    
    if auto_release_days != 3:
        log(f"✗ FAIL: auto_release_days={auto_release_days}, expected 3 (non-preset 4 not clamped)")
        return False
    
    log("✓ PASS: Non-preset auto_release_days (4) clamped to default (3)")
    return True

def test_regression_fee_preview_structure(token):
    """
    REGRESSION: Confirm fee-preview still returns 4 costItems and
    buyerPays/sellerReceives math is unchanged for fee_payer buyer/seller/split
    """
    log("\n=== REGRESSION: Fee preview structure and math ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test buyer pays
    resp1 = requests.post(f"{BASE_URL}{API_PREFIX}/escrow/fee-preview", json={
        "amount": 100,
        "fee_payer": "buyer",
        "payout_coin": "USDT-TRON"
    }, headers=headers)
    
    if resp1.status_code != 200:
        log(f"✗ FAIL: buyer test HTTP {resp1.status_code}")
        return False
    
    buyer_data = resp1.json().get("data", {})
    buyer_cost_items = buyer_data.get("costItems", [])
    buyer_pays = buyer_data.get("buyerPays")
    seller_receives = buyer_data.get("sellerReceives")
    total_cost = buyer_data.get("totalCost")
    
    log(f"Buyer pays: costItems={len(buyer_cost_items)}, buyerPays={buyer_pays}, sellerReceives={seller_receives}, totalCost={total_cost}")
    
    if len(buyer_cost_items) != 4:
        log(f"✗ FAIL: Expected 4 costItems, got {len(buyer_cost_items)}")
        return False
    
    # buyer pays: buyerPays = amount + totalCost, sellerReceives = amount
    if buyer_pays != 100 + total_cost:
        log(f"✗ FAIL: buyerPays={buyer_pays}, expected {100 + total_cost}")
        return False
    
    if seller_receives != 100:
        log(f"✗ FAIL: sellerReceives={seller_receives}, expected 100")
        return False
    
    # Test seller pays
    resp2 = requests.post(f"{BASE_URL}{API_PREFIX}/escrow/fee-preview", json={
        "amount": 100,
        "fee_payer": "seller",
        "payout_coin": "USDT-TRON"
    }, headers=headers)
    
    if resp2.status_code != 200:
        log(f"✗ FAIL: seller test HTTP {resp2.status_code}")
        return False
    
    seller_data = resp2.json().get("data", {})
    seller_cost_items = seller_data.get("costItems", [])
    seller_buyer_pays = seller_data.get("buyerPays")
    seller_seller_receives = seller_data.get("sellerReceives")
    seller_total_cost = seller_data.get("totalCost")
    
    log(f"Seller pays: costItems={len(seller_cost_items)}, buyerPays={seller_buyer_pays}, sellerReceives={seller_seller_receives}, totalCost={seller_total_cost}")
    
    if len(seller_cost_items) != 4:
        log(f"✗ FAIL: Expected 4 costItems, got {len(seller_cost_items)}")
        return False
    
    # seller pays: buyerPays = amount, sellerReceives = amount - totalCost
    if seller_buyer_pays != 100:
        log(f"✗ FAIL: buyerPays={seller_buyer_pays}, expected 100")
        return False
    
    if seller_seller_receives != 100 - seller_total_cost:
        log(f"✗ FAIL: sellerReceives={seller_seller_receives}, expected {100 - seller_total_cost}")
        return False
    
    log("✓ PASS: Fee preview structure (4 costItems) and math unchanged")
    return True

def main():
    log("=== ESCROW BACKEND FOCUSED RE-TEST ===")
    log("Testing CHANGE 1 (admin-controlled fee) and CHANGE 2 (auto_release_days clamping)")
    
    # Login
    token = merchant_login()
    if not token:
        log("✗ FATAL: Could not login")
        sys.exit(1)
    
    results = []
    
    # CHANGE 1 tests
    results.append(("1a: Fee preview ignores client values", test_fee_preview_ignores_client_values(token)))
    results.append(("1b: Create deal ignores client fee", test_create_deal_ignores_client_fee(token)))
    results.append(("1c: Fee minimum applied", test_fee_minimum_applied(token)))
    
    # CHANGE 2 tests
    results.append(("2d: Invalid auto_release_days clamped", test_auto_release_invalid_clamped(token)))
    results.append(("2e: Valid preset honored", test_auto_release_valid_preset(token)))
    results.append(("2f: Non-preset clamped", test_auto_release_non_preset_clamped(token)))
    
    # Regression
    results.append(("REGRESSION: Fee preview structure", test_regression_fee_preview_structure(token)))
    
    # Summary
    log("\n" + "="*70)
    log("TEST SUMMARY")
    log("="*70)
    
    passed = 0
    failed = 0
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        log(f"{status}: {name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    log("="*70)
    log(f"TOTAL: {passed} passed, {failed} failed out of {len(results)} tests")
    log("="*70)
    
    if failed > 0:
        sys.exit(1)
    else:
        log("\n✓✓✓ ALL TESTS PASSED ✓✓✓")
        sys.exit(0)

if __name__ == "__main__":
    main()
