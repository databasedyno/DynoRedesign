#!/usr/bin/env python3
"""
SafeDeal Backend Test - Cancellation Fee REVERSAL Verification
==============================================================
CHANGE 1 (PRIMARY): CANCELLATION FEE now CHARGED (was previously WAIVED)

Background: A mutually-agreed cancellation after funding used to WAIVE the escrow fee.
It now CHARGES a cancellation fee = SAFEDEAL_CANCELLATION_FEE_PERCENT (default 5% when
unset; currently unset so 5%), settled like a refund (buyer refunded the net pool;
platform keeps the fee + real costs).

Test Scenarios:
1. Config endpoint returns cancellation_fee_percent == 5
2. Scenario A: Cancellation CHARGES fee (buyer refund = held - fee - costs)
3. Control: Normal dispute refund also charges fee
4. Withdrawal happy path
5. Full happy path (create->accept->fund->deliver->release)
6. Admin readiness endpoint

API base: http://localhost:8001/api/safedeal/*
Auth: POST /auth/send-code {email} -> data.preview_code
      POST /auth/verify-code {email, code} -> data.token
      Header: x-safedeal-token: <token>
"""

import requests
import time
import json
import sys
from typing import Dict, Any, Optional

BASE_URL = "http://localhost:8001/api/safedeal"
ADMIN_BASE = "http://localhost:8001/api/safedeal/admin"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def log(msg: str, color: str = ""):
    print(f"{color}{msg}{Colors.END}")

def log_success(msg: str):
    log(f"✓ {msg}", Colors.GREEN)

def log_error(msg: str):
    log(f"✗ {msg}", Colors.RED)

def log_info(msg: str):
    log(f"ℹ {msg}", Colors.BLUE)

def log_section(msg: str):
    log(f"\n{'='*70}\n{msg}\n{'='*70}", Colors.BOLD)

def safedeal_auth(email: str) -> str:
    """Authenticate and return JWT token"""
    log_info(f"Authenticating {email}...")
    
    # Send code
    resp = requests.post(f"{BASE_URL}/auth/send-code", json={"email": email})
    if resp.status_code != 200:
        log_error(f"Send code failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    
    data = resp.json().get("data", {})
    code = data.get("preview_code")
    if not code:
        log_error("No preview_code in response")
        sys.exit(1)
    
    log_info(f"Got code: {code}")
    
    # Verify code
    resp = requests.post(f"{BASE_URL}/auth/verify-code", json={"email": email, "code": code})
    if resp.status_code != 200:
        log_error(f"Verify code failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    
    token = resp.json().get("data", {}).get("token")
    if not token:
        log_error("No token in response")
        sys.exit(1)
    
    log_success(f"Authenticated: {email}")
    return token

def api_call(method: str, path: str, token: str, json_data: Optional[Dict] = None) -> Dict[str, Any]:
    """Make API call with token"""
    url = f"{BASE_URL}{path}"
    headers = {"x-safedeal-token": token}
    
    if method == "GET":
        resp = requests.get(url, headers=headers)
    elif method == "POST":
        resp = requests.post(url, headers=headers, json=json_data or {})
    else:
        raise ValueError(f"Unsupported method: {method}")
    
    if resp.status_code not in [200, 201]:
        log_error(f"{method} {path} failed: {resp.status_code} {resp.text}")
        return {"error": resp.text, "status_code": resp.status_code}
    
    return resp.json().get("data", {})

def admin_login() -> str:
    """Admin login"""
    log_info("Admin login...")
    resp = requests.post(
        "http://localhost:8001/api/admin/login",
        json={"email": "moxxcompany@gmail.com", "password": "Katiekendra123@"}
    )
    if resp.status_code != 200:
        log_error(f"Admin login failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    
    token = resp.json().get("data", {}).get("accessToken")
    if not token:
        log_error("No admin token")
        sys.exit(1)
    
    log_success("Admin authenticated")
    return token

def test_config():
    """Test 1: Config endpoint returns cancellation_fee_percent == 5"""
    log_section("TEST 1: Config Endpoint - Cancellation Fee Percent")
    
    resp = requests.get(f"{BASE_URL}/config")
    if resp.status_code != 200:
        log_error(f"Config failed: {resp.status_code} {resp.text}")
        return False
    
    data = resp.json().get("data", {})
    cancel_fee = data.get("cancellation_fee_percent")
    fee_pct = data.get("fee_percent")
    telegram_bot = data.get("telegram_bot")
    
    log_info(f"Config response: {json.dumps(data, indent=2)}")
    
    if cancel_fee != 5:
        log_error(f"Expected cancellation_fee_percent=5, got {cancel_fee}")
        return False
    
    if fee_pct != 5:
        log_error(f"Expected fee_percent=5, got {fee_pct}")
        return False
    
    if telegram_bot != "SafeDealAlert_bot":
        log_error(f"Expected telegram_bot=SafeDealAlert_bot, got {telegram_bot}")
        return False
    
    log_success(f"Config OK: cancellation_fee_percent={cancel_fee}, fee_percent={fee_pct}, telegram_bot={telegram_bot}")
    return True

def test_cancellation_charges_fee():
    """Test 2: Scenario A - Cancellation CHARGES fee (not waives)"""
    log_section("TEST 2: Scenario A - Cancellation CHARGES Fee")
    
    ts = int(time.time())
    seller_email = f"sd_qa_seller_{ts}@example.com"
    buyer_email = f"sd_qa_buyer_{ts}@example.com"
    
    # Seller creates deal
    seller_token = safedeal_auth(seller_email)
    deal_data = {
        "title": "cancel-fee-test",
        "amount": 200,
        "price_currency": "USD",
        "counterparty_email": buyer_email,
        "my_role": "seller",
        "fee_payer": "buyer"
    }
    
    log_info("Seller creating deal...")
    deal = api_call("POST", "/deals", seller_token, deal_data)
    if "error" in deal:
        log_error(f"Create deal failed: {deal}")
        return False
    
    deal_token = deal.get("deal_token")
    escrow_id = deal.get("escrow_id")
    log_success(f"Deal created: token={deal_token}, escrow_id={escrow_id}")
    
    # Buyer accepts
    buyer_token = safedeal_auth(buyer_email)
    log_info("Buyer accepting...")
    result = api_call("POST", f"/deals/{deal_token}/action", buyer_token, {"action": "accept"})
    if "error" in result:
        log_error(f"Accept failed: {result}")
        return False
    log_success("Buyer accepted")
    
    # Buyer funds (simulated)
    log_info("Buyer funding with USDT-TRC20...")
    result = api_call("POST", f"/deals/{deal_token}/action", buyer_token, {"action": "fund", "coin": "USDT-TRC20"})
    if "error" in result:
        # Try funding endpoint first
        log_info("Trying funding endpoint first...")
        result = api_call("POST", f"/deals/{deal_token}/funding", buyer_token, {"coin": "USDT-TRC20"})
        if "error" in result:
            log_error(f"Funding setup failed: {result}")
            return False
        # Now fund
        result = api_call("POST", f"/deals/{deal_token}/action", buyer_token, {"action": "fund", "coin": "USDT-TRC20"})
        if "error" in result:
            log_error(f"Fund failed: {result}")
            return False
    
    log_success("Buyer funded (simulated)")
    
    # Get deal to check custody
    deal = api_call("GET", f"/deals/{deal_token}", buyer_token)
    custody_held = deal.get("custody_amount_stable")
    breakdown = deal.get("breakdown", {})
    
    log_info(f"Custody held: ${custody_held}")
    log_info(f"Breakdown: escrowFee=${breakdown.get('escrowFee')}, totalCost=${breakdown.get('totalCost')}, buyerPays=${breakdown.get('buyerPays')}")
    
    # Buyer cancels
    log_info("Buyer requesting cancellation...")
    result = api_call("POST", f"/deals/{deal_token}/action", buyer_token, {"action": "cancel"})
    if "error" in result:
        log_error(f"Cancel failed: {result}")
        return False
    
    # Check if it's a dispute (cancellation after funding)
    deal_after_cancel = result.get("deal") or result
    status_after_cancel = deal_after_cancel.get("status")
    
    if status_after_cancel == "disputed":
        log_success("Cancellation requested (opened as dispute)")
    elif result.get("requested"):
        log_success("Cancellation requested")
    else:
        log_error(f"Unexpected cancel response: {result}")
        return False
    
    # Seller accepts cancellation
    log_info("Seller accepting cancellation...")
    result = api_call("POST", f"/deals/{deal_token}/action", seller_token, {"action": "dispute-accept"})
    if "error" in result:
        log_error(f"Dispute-accept failed: {result}")
        return False
    log_success("Seller accepted cancellation - deal settled")
    
    # Check final deal state
    deal = api_call("GET", f"/deals/{deal_token}", buyer_token)
    status = deal.get("status")
    final_breakdown = deal.get("breakdown", {})
    escrow_fee = final_breakdown.get("escrowFee")
    cost_items = final_breakdown.get("costItems", [])
    
    log_info(f"Final status: {status}")
    log_info(f"Final escrowFee: ${escrow_fee}")
    
    # Check cost items for cancellation fee
    escrow_fee_item = next((item for item in cost_items if item.get("key") == "escrow_fee"), None)
    if not escrow_fee_item:
        log_error("No escrow_fee cost item found")
        return False
    
    fee_label = escrow_fee_item.get("label", "")
    fee_amount = escrow_fee_item.get("amount", 0)
    
    log_info(f"Escrow fee item: label='{fee_label}', amount=${fee_amount}")
    
    # ASSERT: Fee is CHARGED (not waived)
    if "Cancellation fee" not in fee_label:
        log_error(f"Expected 'Cancellation fee' in label, got: {fee_label}")
        return False
    
    if fee_amount <= 0:
        log_error(f"Expected fee > 0, got ${fee_amount}")
        return False
    
    expected_fee = 200 * 0.05  # 5% of $200 = $10
    if abs(fee_amount - expected_fee) > 0.01:
        log_error(f"Expected fee ~${expected_fee}, got ${fee_amount}")
        return False
    
    if "waived" in fee_label.lower():
        log_error(f"Fee should NOT be waived, but label says: {fee_label}")
        return False
    
    log_success(f"✓ Cancellation fee CHARGED: ${fee_amount} (5% of $200)")
    
    # Check buyer wallet
    wallet = api_call("GET", "/wallet", buyer_token)
    buyer_available = wallet.get("available", 0)
    
    log_info(f"Buyer wallet available: ${buyer_available}")
    
    # Buyer should get: custody_held - fee - costs
    # Expected: ~$200 (held ~$212.50 - $10 fee - ~$2.50 costs)
    if buyer_available < 195 or buyer_available > 205:
        log_error(f"Expected buyer refund ~$200, got ${buyer_available}")
        return False
    
    log_success(f"✓ Buyer refund correct: ${buyer_available} (held - fee - costs)")
    
    # DB check
    log_info("Checking database for escrow_fee debit...")
    import subprocess
    query = f"SELECT transaction_type, payment_mode, paid_amount, meta->>'kind' AS kind FROM tbl_customer_transaction WHERE meta->>'escrow_id' = '{escrow_id}' ORDER BY transaction_id"
    result = subprocess.run(
        ["node", "/app/backend/scripts/ro_query.js", query],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        log_info(f"DB ledger:\n{result.stdout}")
        if "escrow_fee" in result.stdout:
            log_success("✓ DB confirms escrow_fee debit present (fee kept)")
        else:
            log_error("No escrow_fee debit in ledger")
            return False
    else:
        log_error(f"DB query failed: {result.stderr}")
    
    log_success("✓✓✓ SCENARIO A PASSED: Cancellation fee IS CHARGED (not waived)")
    return True

def test_normal_dispute_charges_fee():
    """Test 3: Control - Normal dispute refund also charges fee"""
    log_section("TEST 3: Control - Normal Dispute Refund Charges Fee")
    
    ts = int(time.time())
    seller_email = f"sd_qa_control_seller_{ts}@example.com"
    buyer_email = f"sd_qa_control_buyer_{ts}@example.com"
    
    # Create and fund deal
    seller_token = safedeal_auth(seller_email)
    deal_data = {
        "title": "control-dispute-test",
        "amount": 200,
        "price_currency": "USD",
        "counterparty_email": buyer_email,
        "my_role": "seller",
        "fee_payer": "buyer"
    }
    
    deal = api_call("POST", "/deals", seller_token, deal_data)
    deal_token = deal.get("deal_token")
    escrow_id = deal.get("escrow_id")
    log_success(f"Deal created: {deal_token}")
    
    buyer_token = safedeal_auth(buyer_email)
    api_call("POST", f"/deals/{deal_token}/action", buyer_token, {"action": "accept"})
    api_call("POST", f"/deals/{deal_token}/action", buyer_token, {"action": "fund", "coin": "USDT-TRC20"})
    log_success("Deal funded")
    
    # Buyer opens NORMAL dispute (not cancel)
    log_info("Buyer opening normal dispute (refund)...")
    result = api_call("POST", f"/deals/{deal_token}/action", buyer_token, {
        "action": "dispute",
        "proposed_outcome": "refund",
        "reason": "not delivered"
    })
    if "error" in result:
        log_error(f"Dispute failed: {result}")
        return False
    log_success("Dispute opened")
    
    # Seller accepts
    log_info("Seller accepting dispute...")
    result = api_call("POST", f"/deals/{deal_token}/action", seller_token, {"action": "dispute-accept"})
    if "error" in result:
        log_error(f"Dispute-accept failed: {result}")
        return False
    log_success("Dispute accepted - deal settled")
    
    # Check final state
    deal = api_call("GET", f"/deals/{deal_token}", buyer_token)
    status = deal.get("status")
    breakdown = deal.get("breakdown", {})
    escrow_fee = breakdown.get("escrowFee")
    cost_items = breakdown.get("costItems", [])
    
    log_info(f"Final status: {status}")
    log_info(f"Final escrowFee: ${escrow_fee}")
    
    # Check fee is charged
    escrow_fee_item = next((item for item in cost_items if item.get("key") == "escrow_fee"), None)
    if not escrow_fee_item:
        log_error("No escrow_fee cost item")
        return False
    
    fee_label = escrow_fee_item.get("label", "")
    fee_amount = escrow_fee_item.get("amount", 0)
    
    log_info(f"Escrow fee item: label='{fee_label}', amount=${fee_amount}")
    
    # ASSERT: Fee is CHARGED (not waived)
    if fee_amount <= 0:
        log_error(f"Expected fee > 0, got ${fee_amount}")
        return False
    
    if "Cancellation" in fee_label:
        log_error(f"Normal dispute should NOT have 'Cancellation' in label: {fee_label}")
        return False
    
    expected_fee = 200 * 0.05  # 5% of $200 = $10
    if abs(fee_amount - expected_fee) > 0.01:
        log_error(f"Expected fee ~${expected_fee}, got ${fee_amount}")
        return False
    
    log_success(f"✓ Normal dispute fee CHARGED: ${fee_amount}")
    
    # Check buyer wallet
    wallet = api_call("GET", "/wallet", buyer_token)
    buyer_available = wallet.get("available", 0)
    
    log_info(f"Buyer wallet available: ${buyer_available}")
    
    # Buyer should get: held - fee - costs (same as cancellation)
    if buyer_available < 195 or buyer_available > 205:
        log_error(f"Expected buyer refund ~$200, got ${buyer_available}")
        return False
    
    log_success(f"✓ Buyer refund correct: ${buyer_available}")
    
    # DB check
    import subprocess
    query = f"SELECT transaction_type, payment_mode, paid_amount, meta->>'kind' AS kind FROM tbl_customer_transaction WHERE meta->>'escrow_id' = '{escrow_id}' ORDER BY transaction_id"
    result = subprocess.run(
        ["node", "/app/backend/scripts/ro_query.js", query],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        log_info(f"DB ledger:\n{result.stdout}")
        if "escrow_fee" in result.stdout:
            log_success("✓ DB confirms escrow_fee debit present")
        else:
            log_error("No escrow_fee debit in ledger")
            return False
    
    log_success("✓✓✓ CONTROL PASSED: Normal dispute refund charges fee")
    return True

def test_withdrawal_happy_path():
    """Test 4: Withdrawal happy path"""
    log_section("TEST 4: Withdrawal Happy Path")
    
    ts = int(time.time())
    email = f"sd_qa_withdraw_{ts}@example.com"
    token = safedeal_auth(email)
    
    # Top up wallet
    log_info("Topping up wallet...")
    topup = api_call("POST", "/wallet/topup", token, {"amount": 50, "coin": "USDT-TRC20"})
    if "error" in topup:
        log_error(f"Topup failed: {topup}")
        return False
    
    # topup_id might be in topup.topup or topup.topup_id
    topup_id = topup.get("topup_id") or topup.get("topup", {}).get("topup_id")
    if not topup_id:
        log_error(f"No topup_id in response: {topup}")
        return False
    log_info(f"Topup created: {topup_id}")
    
    # Simulate topup
    result = api_call("POST", f"/wallet/topup/{topup_id}/simulate", token)
    if "error" in result:
        log_error(f"Simulate failed: {result}")
        return False
    log_success("Wallet topped up: $50")
    
    # Check balance
    wallet = api_call("GET", "/wallet", token)
    available = wallet.get("available", 0)
    log_info(f"Available balance: ${available}")
    
    if available < 45:
        log_error(f"Expected balance ~$50, got ${available}")
        return False
    
    # Add payout address (step-up required)
    log_info("Getting step-up code...")
    stepup = api_call("POST", "/auth/step-up", token)
    if "error" in stepup:
        log_error(f"Step-up failed: {stepup}")
        return False
    
    code = stepup.get("preview_code")
    log_info(f"Step-up code: {code}")
    
    # Add address
    log_info("Adding payout address...")
    address_data = {
        "payout_key": "USDT-TRON",
        "address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        "code": code
    }
    address = api_call("POST", "/wallet/addresses", token, address_data)
    if "error" in address:
        log_error(f"Add address failed: {address}")
        return False
    
    address_id = address.get("address_id")
    log_success(f"Address added: {address_id}")
    
    # Request withdrawal (needs fresh step-up)
    log_info("Getting fresh step-up code for withdrawal...")
    stepup2 = api_call("POST", "/auth/step-up", token)
    if "error" in stepup2:
        log_error(f"Step-up failed: {stepup2}")
        return False
    code2 = stepup2.get("preview_code")
    
    log_info("Requesting withdrawal...")
    withdraw_data = {
        "address_id": address_id,
        "amount": 20,
        "code": code2
    }
    withdrawal = api_call("POST", "/wallet/withdraw", token, withdraw_data)
    if "error" in withdrawal:
        # Check if it's cooling-off error (expected for new address)
        error_msg = str(withdrawal.get("error", ""))
        if "24h" in error_msg or "cooling" in error_msg.lower():
            log_info(f"Expected cooling-off error: {error_msg}")
            log_success("✓ Withdrawal validation working (24h cooling-off)")
            return True
        log_error(f"Withdrawal failed: {withdrawal}")
        return False
    
    withdrawal_id = withdrawal.get("withdrawal_id")
    status = withdrawal.get("status")
    log_success(f"Withdrawal created: {withdrawal_id}, status={status}")
    
    # Check wallet balance updated
    wallet = api_call("GET", "/wallet", token)
    new_available = wallet.get("available", 0)
    log_info(f"New available balance: ${new_available}")
    
    if new_available >= available:
        log_error(f"Balance should decrease, was ${available}, now ${new_available}")
        return False
    
    log_success("✓ Balance debited correctly")
    
    # Get withdraw quote
    log_info("Testing withdraw quote endpoint...")
    resp = requests.get(f"{BASE_URL}/wallet/withdraw/quote", headers={"x-safedeal-token": token})
    if resp.status_code == 200:
        quote = resp.json().get("data", {})
        log_info(f"Quote: {json.dumps(quote, indent=2)}")
        
        if "min" not in quote or "fee" not in quote:
            log_error("Quote missing required fields")
            return False
        
        log_success("✓ Withdraw quote endpoint working")
    else:
        log_info(f"Quote endpoint returned {resp.status_code} (optional feature)")
    
    log_success("✓✓✓ WITHDRAWAL HAPPY PATH PASSED")
    return True

def test_full_happy_path():
    """Test 5: Full happy path (create->accept->fund->deliver->release)"""
    log_section("TEST 5: Full Happy Path")
    
    ts = int(time.time())
    seller_email = f"sd_qa_happy_seller_{ts}@example.com"
    buyer_email = f"sd_qa_happy_buyer_{ts}@example.com"
    
    # Create deal
    seller_token = safedeal_auth(seller_email)
    deal_data = {
        "title": "happy-path-test",
        "amount": 100,
        "price_currency": "USD",
        "counterparty_email": buyer_email,
        "my_role": "seller",
        "fee_payer": "buyer"
    }
    
    deal = api_call("POST", "/deals", seller_token, deal_data)
    deal_token = deal.get("deal_token")
    log_success(f"Deal created: {deal_token}")
    
    # Accept
    buyer_token = safedeal_auth(buyer_email)
    api_call("POST", f"/deals/{deal_token}/action", buyer_token, {"action": "accept"})
    log_success("Buyer accepted")
    
    # Fund
    api_call("POST", f"/deals/{deal_token}/action", buyer_token, {"action": "fund", "coin": "USDT-TRC20"})
    log_success("Buyer funded")
    
    # Deliver
    api_call("POST", f"/deals/{deal_token}/action", seller_token, {"action": "deliver", "note": "Delivered"})
    log_success("Seller delivered")
    
    # Release
    api_call("POST", f"/deals/{deal_token}/action", buyer_token, {"action": "release"})
    log_success("Buyer released")
    
    # Check final state
    deal = api_call("GET", f"/deals/{deal_token}", seller_token)
    status = deal.get("status")
    
    if status != "completed":
        log_error(f"Expected status=completed, got {status}")
        return False
    
    log_success(f"✓ Deal completed: {status}")
    
    # Check seller wallet
    wallet = api_call("GET", "/wallet", seller_token)
    seller_available = wallet.get("available", 0)
    
    log_info(f"Seller wallet available: ${seller_available}")
    
    if seller_available < 95:
        log_error(f"Expected seller balance ~$100, got ${seller_available}")
        return False
    
    log_success(f"✓ Seller credited: ${seller_available}")
    log_success("✓✓✓ FULL HAPPY PATH PASSED")
    return True

def test_admin_readiness():
    """Test 6: Admin readiness endpoint"""
    log_section("TEST 6: Admin Readiness")
    
    admin_token = admin_login()
    
    resp = requests.get(
        f"{ADMIN_BASE}/readiness",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if resp.status_code != 200:
        log_error(f"Readiness failed: {resp.status_code} {resp.text}")
        return False
    
    data = resp.json().get("data", {})
    checks = data.get("checks", [])
    
    # Checks can be array or object
    if isinstance(checks, list):
        check_keys = [c.get("key") for c in checks]
    else:
        check_keys = list(checks.keys())
    
    log_info(f"Readiness checks: {json.dumps(checks, indent=2)}")
    
    expected_checks = ["brand", "api_key", "webhook", "url", "live", "wallets", "custody", "pool", "fee_exempt", "autoconvert", "fees", "email"]
    
    for check in expected_checks:
        if check not in check_keys:
            log_error(f"Missing check: {check}")
            return False
    
    log_success(f"✓ All {len(expected_checks)} checks present")
    log_success("✓✓✓ ADMIN READINESS PASSED")
    return True

def main():
    log_section("SafeDeal Backend Test - Cancellation Fee REVERSAL")
    log_info("Testing that cancellation fee is now CHARGED (was previously WAIVED)")
    
    results = []
    
    # Test 1: Config
    results.append(("Config", test_config()))
    
    # Test 2: Cancellation charges fee
    results.append(("Cancellation Charges Fee", test_cancellation_charges_fee()))
    
    # Test 3: Normal dispute charges fee
    results.append(("Normal Dispute Charges Fee", test_normal_dispute_charges_fee()))
    
    # Test 4: Withdrawal
    results.append(("Withdrawal Happy Path", test_withdrawal_happy_path()))
    
    # Test 5: Full happy path
    results.append(("Full Happy Path", test_full_happy_path()))
    
    # Test 6: Admin readiness
    results.append(("Admin Readiness", test_admin_readiness()))
    
    # Summary
    log_section("TEST SUMMARY")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        if result:
            log_success(f"{name}: PASS")
        else:
            log_error(f"{name}: FAIL")
    
    log("")
    if passed == total:
        log_success(f"✓✓✓ ALL TESTS PASSED ({passed}/{total}) ✓✓✓")
        log_success("Cancellation fee is now CHARGED (reversal verified)")
        return 0
    else:
        log_error(f"✗✗✗ SOME TESTS FAILED ({passed}/{total}) ✗✗✗")
        return 1

if __name__ == "__main__":
    sys.exit(main())
