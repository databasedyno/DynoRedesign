#!/usr/bin/env python3
"""
Backend test for DynoPay ESCROW DISPUTE flow (two-tier P2P negotiation + admin fallback).
Tests the reimagined dispute model with negotiation loop and the updated fee/settlement model.

SAFE MODE: LIVE prod DB, money SIMULATED. Uses throwaway counterparty emails (escrow_test_*).
"""
import requests
import json
import sys
import subprocess
import time
import random

BASE_URL = "http://localhost:8001/api"

# Merchant credentials
MERCHANT_EMAIL = "onarrival21@gmail.com"
MERCHANT_PASSWORD = "Katiekendra123@"
MERCHANT_USER_ID = 1
COMPANY_ID = 1

# Admin credentials
ADMIN_EMAIL = "moxxcompany@gmail.com"
ADMIN_PASSWORD = "Katiekendra123@"

def log(msg):
    print(f"[TEST] {msg}", flush=True)

def get_totp_code(user_id):
    """Get TOTP code for 2FA"""
    try:
        result = subprocess.run(
            ["node", "/app/backend/scripts/print_totp.cjs", str(user_id)],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            code = result.stdout.strip()
            log(f"TOTP code for user {user_id}: {code}")
            return code
        else:
            log(f"ERROR getting TOTP: {result.stderr}")
            return None
    except Exception as e:
        log(f"ERROR getting TOTP: {e}")
        return None

def merchant_login():
    """Login as merchant with 2FA (if required)"""
    log("Logging in as merchant...")
    
    # Step 1: Login
    resp = requests.post(f"{BASE_URL}/user/login", json={
        "email": MERCHANT_EMAIL,
        "password": MERCHANT_PASSWORD
    })
    if resp.status_code != 200:
        log(f"ERROR: Login failed: {resp.status_code} {resp.text}")
        return None
    
    data = resp.json().get("data", {})
    
    # Check if 2FA is required
    challenge_token = data.get("challenge_token")
    if challenge_token:
        log("2FA required, getting TOTP code...")
        # Step 2: Get TOTP code
        totp_code = get_totp_code(MERCHANT_USER_ID)
        if not totp_code:
            return None
        
        # Step 3: Validate 2FA
        resp = requests.post(f"{BASE_URL}/user/2fa/validate", json={
            "challenge_token": challenge_token,
            "token": totp_code
        })
        if resp.status_code != 200:
            log(f"ERROR: 2FA validation failed: {resp.status_code} {resp.text}")
            return None
        
        data = resp.json().get("data", {})
    else:
        log("2FA not required (trusted device)")
    
    token = data.get("accessToken")
    if not token:
        log(f"ERROR: No accessToken in response: {resp.json()}")
        return None
    
    log("✓ Merchant login successful")
    return token

def admin_login():
    """Login as admin"""
    log("Logging in as admin...")
    
    resp = requests.post(f"{BASE_URL}/admin/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        log(f"ERROR: Admin login failed: {resp.status_code} {resp.text}")
        return None
    
    token = resp.json().get("data", {}).get("accessToken")
    if not token:
        log(f"ERROR: No accessToken in admin response: {resp.json()}")
        return None
    
    log("✓ Admin login successful")
    return token

def create_funded_deal(merchant_token, title_suffix=""):
    """Create and fund a deal (merchant=seller, counterparty=buyer)"""
    counterparty_email = f"escrow_test_{random.randint(10000, 99999)}@example.com"
    
    log(f"Creating deal with counterparty: {counterparty_email}")
    
    # Create deal
    resp = requests.post(f"{BASE_URL}/escrow", 
        headers={"Authorization": f"Bearer {merchant_token}"},
        json={
            "company_id": COMPANY_ID,
            "title": f"Test Deal {title_suffix}",
            "amount": 100,
            "currency": "USD",
            "accepted_coins": "USDT-TRON,BTC,ETH",
            "counterparty_email": counterparty_email,
            "creator_role": "seller",
            "fee_percent": 5,
            "fee_payer": "buyer",
            "auto_release_days": 3,
            "send_invite": True  # Changed to True to create in 'invited' status
        }
    )
    
    if resp.status_code != 201:
        log(f"ERROR: Create deal failed: {resp.status_code} {resp.text}")
        return None
    
    deal = resp.json().get("data", {})
    escrow_id = deal.get("escrow_id")
    deal_token = deal.get("deal_token")
    
    log(f"✓ Deal created: escrow_id={escrow_id}, token={deal_token}")
    
    # Get OTP for counterparty
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/send-otp", json={
        "email": counterparty_email
    })
    if resp.status_code != 200:
        log(f"ERROR: Send OTP failed: {resp.status_code} {resp.text}")
        return None
    
    otp = resp.json().get("data", {}).get("preview_otp")
    log(f"✓ OTP sent: {otp}")
    
    # Verify OTP
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/verify-otp", json={
        "email": counterparty_email,
        "otp": otp
    })
    if resp.status_code != 200:
        log(f"ERROR: Verify OTP failed: {resp.status_code} {resp.text}")
        return None
    
    escrow_session = resp.json().get("data", {}).get("escrow_session")
    log(f"✓ OTP verified, session: {escrow_session[:20]}...")
    
    # Accept invite
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/respond",
        headers={"x-escrow-token": escrow_session},
        json={"action": "accept"}
    )
    if resp.status_code != 200:
        log(f"ERROR: Accept failed: {resp.status_code} {resp.text}")
        return None
    
    log("✓ Invite accepted")
    
    # Fund the deal
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal_token}/action",
        headers={"x-escrow-token": escrow_session},
        json={"action": "fund", "coin": "USDT-TRON"}
    )
    if resp.status_code != 200:
        log(f"ERROR: Fund failed: {resp.status_code} {resp.text}")
        return None
    
    log("✓ Deal funded")
    
    return {
        "escrow_id": escrow_id,
        "deal_token": deal_token,
        "counterparty_email": counterparty_email,
        "escrow_session": escrow_session
    }

def test_1_fee_settlement_model(merchant_token):
    """TEST 1: FEE/SETTLEMENT MODEL (fees ALWAYS charged; USDT custody; USDC merge)"""
    log("\n" + "="*80)
    log("TEST 1: FEE/SETTLEMENT MODEL")
    log("="*80)
    
    results = []
    
    # Test 1a: Fee preview with USDT-TRON vs USDC-POLYGON
    log("\n[1a] Testing fee preview: USDT-TRON vs USDC-POLYGON withdrawal fees")
    
    resp_usdt = requests.post(f"{BASE_URL}/escrow/fee-preview",
        headers={"Authorization": f"Bearer {merchant_token}"},
        json={
            "amount": 100,
            "fee_payer": "buyer",
            "payout_coin": "USDT-TRON",
            "accepted_coins": "BTC,ETH"
        }
    )
    
    resp_usdc = requests.post(f"{BASE_URL}/escrow/fee-preview",
        headers={"Authorization": f"Bearer {merchant_token}"},
        json={
            "amount": 100,
            "fee_payer": "buyer",
            "payout_coin": "USDC-POLYGON",
            "accepted_coins": "BTC,ETH"
        }
    )
    
    if resp_usdt.status_code == 200 and resp_usdc.status_code == 200:
        usdt_data = resp_usdt.json().get("data", {})
        usdc_data = resp_usdc.json().get("data", {})
        
        usdt_items = usdt_data.get("costItems", [])
        usdc_items = usdc_data.get("costItems", [])
        
        usdt_withdrawal = next((item["amount"] for item in usdt_items if item["key"] == "withdrawal_fee"), 0)
        usdc_withdrawal = next((item["amount"] for item in usdc_items if item["key"] == "withdrawal_fee"), 0)
        
        usdt_total = usdt_data.get("totalCost", 0)
        usdc_total = usdc_data.get("totalCost", 0)
        
        log(f"  USDT-TRON: costItems={len(usdt_items)}, withdrawal_fee=${usdt_withdrawal}, totalCost=${usdt_total}")
        log(f"  USDC-POLYGON: costItems={len(usdc_items)}, withdrawal_fee=${usdc_withdrawal}, totalCost=${usdc_total}")
        
        if len(usdt_items) == 4 and len(usdc_items) == 4:
            log("  ✓ Both have 4 costItems")
            results.append(("1a_costItems", True, "Both USDT and USDC have 4 costItems"))
        else:
            log(f"  ✗ Expected 4 costItems, got USDT={len(usdt_items)}, USDC={len(usdc_items)}")
            results.append(("1a_costItems", False, f"Expected 4 costItems, got USDT={len(usdt_items)}, USDC={len(usdc_items)}"))
        
        if usdc_withdrawal > usdt_withdrawal:
            log(f"  ✓ USDC withdrawal fee (${usdc_withdrawal}) > USDT withdrawal fee (${usdt_withdrawal})")
            results.append(("1a_withdrawal_fee", True, f"USDC withdrawal ${usdc_withdrawal} > USDT ${usdt_withdrawal}"))
        else:
            log(f"  ✗ USDC withdrawal fee (${usdc_withdrawal}) should be > USDT (${usdt_withdrawal})")
            results.append(("1a_withdrawal_fee", False, f"USDC withdrawal ${usdc_withdrawal} not > USDT ${usdt_withdrawal}"))
        
        if usdc_total > usdt_total:
            log(f"  ✓ USDC totalCost (${usdc_total}) > USDT totalCost (${usdt_total})")
            results.append(("1a_totalCost", True, f"USDC totalCost ${usdc_total} > USDT ${usdt_total}"))
        else:
            log(f"  ✗ USDC totalCost (${usdc_total}) should be > USDT (${usdt_total})")
            results.append(("1a_totalCost", False, f"USDC totalCost ${usdc_total} not > USDT ${usdt_total}"))
    else:
        log(f"  ✗ Fee preview failed: USDT={resp_usdt.status_code}, USDC={resp_usdc.status_code}")
        results.append(("1a_fee_preview", False, f"Fee preview failed: USDT={resp_usdt.status_code}, USDC={resp_usdc.status_code}"))
    
    # Test 1b/1c: Custody stablecoin
    log("\n[1b/1c] Testing custody stablecoin after funding")
    deal = create_funded_deal(merchant_token, "custody_test")
    if deal:
        resp = requests.get(f"{BASE_URL}/escrow/{deal['escrow_id']}",
            headers={"Authorization": f"Bearer {merchant_token}"}
        )
        if resp.status_code == 200:
            deal_data = resp.json().get("data", {})
            custody_coin = deal_data.get("custody_stablecoin")
            log(f"  custody_stablecoin: {custody_coin}")
            
            if custody_coin == "USDT":
                log("  ✓ custody_stablecoin is 'USDT' (not 'USDT-TRON')")
                results.append(("1c_custody", True, "custody_stablecoin is 'USDT'"))
            else:
                log(f"  ✗ custody_stablecoin should be 'USDT', got '{custody_coin}'")
                results.append(("1c_custody", False, f"custody_stablecoin is '{custody_coin}', expected 'USDT'"))
        else:
            log(f"  ✗ Failed to get deal: {resp.status_code}")
            results.append(("1c_custody", False, f"Failed to get deal: {resp.status_code}"))
    else:
        log("  ✗ Failed to create funded deal")
        results.append(("1c_custody", False, "Failed to create funded deal"))
    
    # Test 1d: REFUND NO LONGER WAIVES FEES
    log("\n[1d] Testing refund does NOT waive fees")
    deal = create_funded_deal(merchant_token, "refund_test")
    if deal:
        # Raise dispute with refund proposal
        resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute",
            headers={"Authorization": f"Bearer {merchant_token}"},
            json={
                "proposed_outcome": "refund",
                "reason": "Testing refund fees",
                "message": "Test refund"
            }
        )
        if resp.status_code == 200:
            log("  ✓ Dispute raised with refund proposal")
            
            # Accept the refund (as buyer via public)
            resp = requests.post(f"{BASE_URL}/escrow/public/{deal['deal_token']}/action",
                headers={"x-escrow-token": deal['escrow_session']},
                json={"action": "dispute-accept"}
            )
            if resp.status_code == 200:
                log("  ✓ Refund proposal accepted")
                
                # Get deal to check entitlements
                resp = requests.get(f"{BASE_URL}/escrow/{deal['escrow_id']}",
                    headers={"Authorization": f"Bearer {merchant_token}"}
                )
                if resp.status_code == 200:
                    deal_data = resp.json().get("data", {})
                    buyer_entitlement = deal_data.get("buyer_entitlement_stable", 0)
                    breakdown = deal_data.get("breakdown", {})
                    buyer_pays = breakdown.get("buyerPays", 0)
                    total_cost = breakdown.get("totalCost", 0)
                    seller_receives = breakdown.get("sellerReceives", 0)
                    
                    log(f"  buyerPays: ${buyer_pays}")
                    log(f"  totalCost: ${total_cost}")
                    log(f"  sellerReceives (pool): ${seller_receives}")
                    log(f"  buyer_entitlement_stable: ${buyer_entitlement}")
                    
                    # Buyer should get the pool (sellerReceives), NOT the full buyerPays
                    expected_refund = seller_receives
                    if abs(buyer_entitlement - expected_refund) < 0.01:
                        log(f"  ✓ Buyer refund is ${buyer_entitlement} (pool), NOT ${buyer_pays} (full payment)")
                        results.append(("1d_refund_fees", True, f"Buyer refund ${buyer_entitlement} equals pool ${seller_receives}, fees charged"))
                    else:
                        log(f"  ✗ Buyer refund ${buyer_entitlement} should equal pool ${expected_refund}")
                        results.append(("1d_refund_fees", False, f"Buyer refund ${buyer_entitlement} != pool ${expected_refund}"))
                else:
                    log(f"  ✗ Failed to get deal: {resp.status_code}")
                    results.append(("1d_refund_fees", False, f"Failed to get deal: {resp.status_code}"))
            else:
                log(f"  ✗ Failed to accept refund: {resp.status_code} {resp.text}")
                results.append(("1d_refund_fees", False, f"Failed to accept refund: {resp.status_code}"))
        else:
            log(f"  ✗ Failed to raise dispute: {resp.status_code} {resp.text}")
            results.append(("1d_refund_fees", False, f"Failed to raise dispute: {resp.status_code}"))
    else:
        log("  ✗ Failed to create funded deal")
        results.append(("1d_refund_fees", False, "Failed to create funded deal"))
    
    # Test 1e: SPLIT distributes the pool
    log("\n[1e] Testing split distributes the pool")
    deal = create_funded_deal(merchant_token, "split_test")
    if deal:
        # Raise dispute with split proposal
        resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute",
            headers={"Authorization": f"Bearer {merchant_token}"},
            json={
                "proposed_outcome": "split",
                "split_percent_seller": 60,
                "reason": "Testing split",
                "message": "Test split"
            }
        )
        if resp.status_code == 200:
            log("  ✓ Dispute raised with split 60/40 proposal")
            
            # Accept the split (as buyer via public)
            resp = requests.post(f"{BASE_URL}/escrow/public/{deal['deal_token']}/action",
                headers={"x-escrow-token": deal['escrow_session']},
                json={"action": "dispute-accept"}
            )
            if resp.status_code == 200:
                log("  ✓ Split proposal accepted")
                
                # Get deal to check entitlements
                resp = requests.get(f"{BASE_URL}/escrow/{deal['escrow_id']}",
                    headers={"Authorization": f"Bearer {merchant_token}"}
                )
                if resp.status_code == 200:
                    deal_data = resp.json().get("data", {})
                    seller_entitlement = deal_data.get("seller_entitlement_stable", 0)
                    buyer_entitlement = deal_data.get("buyer_entitlement_stable", 0)
                    breakdown = deal_data.get("breakdown", {})
                    seller_receives = breakdown.get("sellerReceives", 0)  # This is the pool
                    
                    log(f"  Pool (sellerReceives): ${seller_receives}")
                    log(f"  seller_entitlement: ${seller_entitlement} (should be ~60% of pool)")
                    log(f"  buyer_entitlement: ${buyer_entitlement} (should be ~40% of pool)")
                    
                    expected_seller = seller_receives * 0.60
                    expected_buyer = seller_receives * 0.40
                    total_entitlements = seller_entitlement + buyer_entitlement
                    
                    if abs(seller_entitlement - expected_seller) < 0.5 and abs(buyer_entitlement - expected_buyer) < 0.5:
                        log(f"  ✓ Split is correct: seller ~60% (${seller_entitlement}), buyer ~40% (${buyer_entitlement})")
                        results.append(("1e_split", True, f"Split correct: seller ${seller_entitlement}, buyer ${buyer_entitlement}"))
                    else:
                        log(f"  ✗ Split incorrect: expected seller ~${expected_seller}, buyer ~${expected_buyer}")
                        results.append(("1e_split", False, f"Split incorrect: seller ${seller_entitlement}, buyer ${buyer_entitlement}"))
                    
                    if abs(total_entitlements - seller_receives) < 0.01:
                        log(f"  ✓ Total entitlements (${total_entitlements}) equals pool (${seller_receives})")
                        results.append(("1e_split_pool", True, f"Total entitlements ${total_entitlements} equals pool ${seller_receives}"))
                    else:
                        log(f"  ✗ Total entitlements (${total_entitlements}) should equal pool (${seller_receives})")
                        results.append(("1e_split_pool", False, f"Total entitlements ${total_entitlements} != pool ${seller_receives}"))
                else:
                    log(f"  ✗ Failed to get deal: {resp.status_code}")
                    results.append(("1e_split", False, f"Failed to get deal: {resp.status_code}"))
            else:
                log(f"  ✗ Failed to accept split: {resp.status_code} {resp.text}")
                results.append(("1e_split", False, f"Failed to accept split: {resp.status_code}"))
        else:
            log(f"  ✗ Failed to raise dispute: {resp.status_code} {resp.text}")
            results.append(("1e_split", False, f"Failed to raise dispute: {resp.status_code}"))
    else:
        log("  ✗ Failed to create funded deal")
        results.append(("1e_split", False, "Failed to create funded deal"))
    
    return results

def test_2_raise_dispute_requires_proposal(merchant_token):
    """TEST 2: RAISE DISPUTE REQUIRES A PROPOSAL"""
    log("\n" + "="*80)
    log("TEST 2: RAISE DISPUTE REQUIRES A PROPOSAL")
    log("="*80)
    
    results = []
    
    # Create funded deal
    deal = create_funded_deal(merchant_token, "dispute_proposal_test")
    if not deal:
        log("✗ Failed to create funded deal")
        return [("2_create_deal", False, "Failed to create funded deal")]
    
    # Test: Raise dispute WITHOUT proposed_outcome
    log("\n[2a] Testing dispute without proposed_outcome (should fail)")
    resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute",
        headers={"Authorization": f"Bearer {merchant_token}"},
        json={
            "reason": "Test without proposal"
        }
    )
    
    if resp.status_code == 400:
        log("  ✓ Dispute without proposal rejected with 400")
        results.append(("2_no_proposal", True, "Dispute without proposal rejected with 400"))
    else:
        log(f"  ✗ Expected 400, got {resp.status_code}")
        results.append(("2_no_proposal", False, f"Expected 400, got {resp.status_code}"))
    
    # Test: Raise dispute WITH proposed_outcome
    log("\n[2b] Testing dispute with proposed_outcome (should succeed)")
    resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute",
        headers={"Authorization": f"Bearer {merchant_token}"},
        json={
            "proposed_outcome": "refund",
            "reason": "item not as described",
            "message": "pls refund"
        }
    )
    
    if resp.status_code == 200:
        log("  ✓ Dispute with proposal accepted")
        
        # Get deal to verify dispute state
        resp = requests.get(f"{BASE_URL}/escrow/{deal['escrow_id']}",
            headers={"Authorization": f"Bearer {merchant_token}"}
        )
        if resp.status_code == 200:
            deal_data = resp.json().get("data", {})
            status = deal_data.get("status")
            dispute_stage = deal_data.get("dispute_stage")
            dispute_proposal = deal_data.get("dispute_proposal", {})
            dispute_proposal_by = deal_data.get("dispute_proposal_by")
            dispute_thread = deal_data.get("dispute_thread", [])
            auto_release_at = deal_data.get("auto_release_at")
            dispute_auto_escalate_at = deal_data.get("dispute_auto_escalate_at")
            
            log(f"  status: {status}")
            log(f"  dispute_stage: {dispute_stage}")
            log(f"  dispute_proposal: {dispute_proposal}")
            log(f"  dispute_proposal_by: {dispute_proposal_by}")
            log(f"  dispute_thread entries: {len(dispute_thread)}")
            log(f"  auto_release_at: {auto_release_at}")
            log(f"  dispute_auto_escalate_at: {dispute_auto_escalate_at}")
            
            checks = []
            if status == "disputed":
                log("  ✓ status = 'disputed'")
                checks.append(True)
            else:
                log(f"  ✗ status should be 'disputed', got '{status}'")
                checks.append(False)
            
            if dispute_stage == "negotiation":
                log("  ✓ dispute_stage = 'negotiation'")
                checks.append(True)
            else:
                log(f"  ✗ dispute_stage should be 'negotiation', got '{dispute_stage}'")
                checks.append(False)
            
            if dispute_proposal.get("outcome") == "refund":
                log("  ✓ dispute_proposal.outcome = 'refund'")
                checks.append(True)
            else:
                log(f"  ✗ dispute_proposal.outcome should be 'refund', got '{dispute_proposal.get('outcome')}'")
                checks.append(False)
            
            if dispute_proposal_by == "seller":
                log("  ✓ dispute_proposal_by = 'seller' (raiser)")
                checks.append(True)
            else:
                log(f"  ✗ dispute_proposal_by should be 'seller', got '{dispute_proposal_by}'")
                checks.append(False)
            
            if len(dispute_thread) > 0 and dispute_thread[0].get("type") == "open":
                log("  ✓ dispute_thread has 'open' entry")
                checks.append(True)
            else:
                log(f"  ✗ dispute_thread should have 'open' entry")
                checks.append(False)
            
            if auto_release_at is None:
                log("  ✓ auto_release_at cleared")
                checks.append(True)
            else:
                log(f"  ✗ auto_release_at should be null, got '{auto_release_at}'")
                checks.append(False)
            
            if dispute_auto_escalate_at is not None:
                log("  ✓ dispute_auto_escalate_at set")
                checks.append(True)
            else:
                log(f"  ✗ dispute_auto_escalate_at should be set")
                checks.append(False)
            
            if all(checks):
                results.append(("2_with_proposal", True, "Dispute with proposal succeeded with correct state"))
            else:
                results.append(("2_with_proposal", False, f"Dispute state incorrect: {checks}"))
        else:
            log(f"  ✗ Failed to get deal: {resp.status_code}")
            results.append(("2_with_proposal", False, f"Failed to get deal: {resp.status_code}"))
    else:
        log(f"  ✗ Dispute with proposal failed: {resp.status_code} {resp.text}")
        results.append(("2_with_proposal", False, f"Dispute with proposal failed: {resp.status_code}"))
    
    return results

def test_3_negotiation_loop(merchant_token):
    """TEST 3: NEGOTIATION LOOP + can't-act-on-own-proposal guards"""
    log("\n" + "="*80)
    log("TEST 3: NEGOTIATION LOOP")
    log("="*80)
    
    results = []
    
    # Create funded deal
    deal = create_funded_deal(merchant_token, "negotiation_test")
    if not deal:
        log("✗ Failed to create funded deal")
        return [("3_create_deal", False, "Failed to create funded deal")]
    
    # Seller raises dispute with refund proposal
    log("\n[3a] Seller raises dispute with refund proposal")
    resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute",
        headers={"Authorization": f"Bearer {merchant_token}"},
        json={
            "proposed_outcome": "refund",
            "reason": "Testing negotiation",
            "message": "Initial proposal"
        }
    )
    if resp.status_code != 200:
        log(f"✗ Failed to raise dispute: {resp.status_code}")
        return [("3_raise_dispute", False, f"Failed to raise dispute: {resp.status_code}")]
    log("✓ Dispute raised")
    
    # Test: Raiser tries to ACCEPT their own proposal
    log("\n[3b] Raiser tries to accept their own proposal (should fail)")
    resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute/accept",
        headers={"Authorization": f"Bearer {merchant_token}"}
    )
    if resp.status_code == 403:
        log("  ✓ Accept own proposal rejected with 403")
        results.append(("3_accept_own", True, "Accept own proposal rejected with 403"))
    else:
        log(f"  ✗ Expected 403, got {resp.status_code}")
        results.append(("3_accept_own", False, f"Expected 403, got {resp.status_code}"))
    
    # Test: Raiser tries to COUNTER their own proposal
    log("\n[3c] Raiser tries to counter their own proposal (should fail)")
    resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute/counter",
        headers={"Authorization": f"Bearer {merchant_token}"},
        json={
            "proposed_outcome": "split",
            "split_percent_seller": 50
        }
    )
    if resp.status_code == 403:
        log("  ✓ Counter own proposal rejected with 403")
        results.append(("3_counter_own", True, "Counter own proposal rejected with 403"))
    else:
        log(f"  ✗ Expected 403, got {resp.status_code}")
        results.append(("3_counter_own", False, f"Expected 403, got {resp.status_code}"))
    
    # Test: Other party counters
    log("\n[3d] Buyer counters with split proposal")
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal['deal_token']}/action",
        headers={"x-escrow-token": deal['escrow_session']},
        json={
            "action": "dispute-counter",
            "proposed_outcome": "split",
            "split_percent_seller": 70,
            "message": "meet halfway"
        }
    )
    if resp.status_code == 200:
        log("  ✓ Counter proposal sent")
        
        # Verify state
        resp = requests.get(f"{BASE_URL}/escrow/{deal['escrow_id']}",
            headers={"Authorization": f"Bearer {merchant_token}"}
        )
        if resp.status_code == 200:
            deal_data = resp.json().get("data", {})
            dispute_proposal_by = deal_data.get("dispute_proposal_by")
            dispute_proposal = deal_data.get("dispute_proposal", {})
            dispute_thread = deal_data.get("dispute_thread", [])
            
            if dispute_proposal_by == "buyer":
                log("  ✓ dispute_proposal_by flipped to 'buyer'")
                results.append(("3_counter_flip", True, "dispute_proposal_by flipped to buyer"))
            else:
                log(f"  ✗ dispute_proposal_by should be 'buyer', got '{dispute_proposal_by}'")
                results.append(("3_counter_flip", False, f"dispute_proposal_by is '{dispute_proposal_by}'"))
            
            if dispute_proposal.get("outcome") == "split" and dispute_proposal.get("split_percent_seller") == 70:
                log("  ✓ Proposal updated to split 70/30")
                results.append(("3_counter_proposal", True, "Proposal updated to split 70/30"))
            else:
                log(f"  ✗ Proposal incorrect: {dispute_proposal}")
                results.append(("3_counter_proposal", False, f"Proposal incorrect: {dispute_proposal}"))
            
            counter_entry = next((e for e in dispute_thread if e.get("type") == "counter"), None)
            if counter_entry:
                log("  ✓ dispute_thread has 'counter' entry")
                results.append(("3_counter_thread", True, "dispute_thread has counter entry"))
            else:
                log("  ✗ dispute_thread missing 'counter' entry")
                results.append(("3_counter_thread", False, "dispute_thread missing counter entry"))
        else:
            log(f"  ✗ Failed to get deal: {resp.status_code}")
            results.append(("3_counter_verify", False, f"Failed to get deal: {resp.status_code}"))
    else:
        log(f"  ✗ Counter failed: {resp.status_code} {resp.text}")
        results.append(("3_counter", False, f"Counter failed: {resp.status_code}"))
    
    # Test: MESSAGE thread
    log("\n[3e] Seller adds message to dispute thread")
    resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute/message",
        headers={"Authorization": f"Bearer {merchant_token}"},
        json={"message": "here is my evidence"}
    )
    if resp.status_code == 200:
        log("  ✓ Message added")
        
        # Verify thread
        resp = requests.get(f"{BASE_URL}/escrow/{deal['escrow_id']}",
            headers={"Authorization": f"Bearer {merchant_token}"}
        )
        if resp.status_code == 200:
            deal_data = resp.json().get("data", {})
            dispute_thread = deal_data.get("dispute_thread", [])
            message_entry = next((e for e in dispute_thread if e.get("type") == "message"), None)
            
            if message_entry:
                log("  ✓ dispute_thread has 'message' entry")
                results.append(("3_message", True, "Message added to thread"))
            else:
                log("  ✗ dispute_thread missing 'message' entry")
                results.append(("3_message", False, "dispute_thread missing message entry"))
        else:
            log(f"  ✗ Failed to get deal: {resp.status_code}")
            results.append(("3_message_verify", False, f"Failed to get deal: {resp.status_code}"))
    else:
        log(f"  ✗ Message failed: {resp.status_code} {resp.text}")
        results.append(("3_message", False, f"Message failed: {resp.status_code}"))
    
    # Test: Empty message should fail
    log("\n[3f] Testing empty message (should fail)")
    resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute/message",
        headers={"Authorization": f"Bearer {merchant_token}"},
        json={"message": ""}
    )
    if resp.status_code == 400:
        log("  ✓ Empty message rejected with 400")
        results.append(("3_empty_message", True, "Empty message rejected"))
    else:
        log(f"  ✗ Expected 400, got {resp.status_code}")
        results.append(("3_empty_message", False, f"Expected 400, got {resp.status_code}"))
    
    # Test: ACCEPT by current responder (seller, since buyer made last proposal)
    log("\n[3g] Seller accepts buyer's split proposal")
    resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute/accept",
        headers={"Authorization": f"Bearer {merchant_token}"}
    )
    if resp.status_code == 200:
        log("  ✓ Proposal accepted")
        
        # Verify resolution
        resp = requests.get(f"{BASE_URL}/escrow/{deal['escrow_id']}",
            headers={"Authorization": f"Bearer {merchant_token}"}
        )
        if resp.status_code == 200:
            deal_data = resp.json().get("data", {})
            dispute_stage = deal_data.get("dispute_stage")
            status = deal_data.get("status")
            seller_entitlement = deal_data.get("seller_entitlement_stable")
            buyer_entitlement = deal_data.get("buyer_entitlement_stable")
            dispute_resolved_at = deal_data.get("dispute_resolved_at")
            
            log(f"  dispute_stage: {dispute_stage}")
            log(f"  status: {status}")
            log(f"  seller_entitlement: ${seller_entitlement}")
            log(f"  buyer_entitlement: ${buyer_entitlement}")
            
            checks = []
            if dispute_stage == "resolved":
                log("  ✓ dispute_stage = 'resolved'")
                checks.append(True)
            else:
                log(f"  ✗ dispute_stage should be 'resolved', got '{dispute_stage}'")
                checks.append(False)
            
            if status == "split":
                log("  ✓ status = 'split'")
                checks.append(True)
            else:
                log(f"  ✗ status should be 'split', got '{status}'")
                checks.append(False)
            
            if seller_entitlement is not None and buyer_entitlement is not None:
                log("  ✓ Entitlements set")
                checks.append(True)
            else:
                log("  ✗ Entitlements not set")
                checks.append(False)
            
            if dispute_resolved_at is not None:
                log("  ✓ dispute_resolved_at set")
                checks.append(True)
            else:
                log("  ✗ dispute_resolved_at not set")
                checks.append(False)
            
            if all(checks):
                results.append(("3_accept", True, "Accept auto-resolved with correct state"))
            else:
                results.append(("3_accept", False, f"Accept state incorrect: {checks}"))
        else:
            log(f"  ✗ Failed to get deal: {resp.status_code}")
            results.append(("3_accept_verify", False, f"Failed to get deal: {resp.status_code}"))
    else:
        log(f"  ✗ Accept failed: {resp.status_code} {resp.text}")
        results.append(("3_accept", False, f"Accept failed: {resp.status_code}"))
    
    # Test: Accept each outcome type (release, refund, split)
    log("\n[3h] Testing accept for RELEASE outcome")
    deal_release = create_funded_deal(merchant_token, "accept_release")
    if deal_release:
        # Buyer raises dispute with release proposal
        resp = requests.post(f"{BASE_URL}/escrow/public/{deal_release['deal_token']}/action",
            headers={"x-escrow-token": deal_release['escrow_session']},
            json={
                "action": "dispute",
                "proposed_outcome": "release",
                "reason": "Test release",
                "message": "Release to seller"
            }
        )
        if resp.status_code == 200:
            # Seller accepts
            resp = requests.post(f"{BASE_URL}/escrow/{deal_release['escrow_id']}/dispute/accept",
                headers={"Authorization": f"Bearer {merchant_token}"}
            )
            if resp.status_code == 200:
                resp = requests.get(f"{BASE_URL}/escrow/{deal_release['escrow_id']}",
                    headers={"Authorization": f"Bearer {merchant_token}"}
                )
                if resp.status_code == 200:
                    deal_data = resp.json().get("data", {})
                    if deal_data.get("status") == "completed" and deal_data.get("dispute_stage") == "resolved":
                        log("  ✓ RELEASE accepted and resolved correctly")
                        results.append(("3_accept_release", True, "RELEASE accepted correctly"))
                    else:
                        log(f"  ✗ RELEASE state incorrect: status={deal_data.get('status')}, stage={deal_data.get('dispute_stage')}")
                        results.append(("3_accept_release", False, "RELEASE state incorrect"))
            else:
                log(f"  ✗ Accept release failed: {resp.status_code}")
                results.append(("3_accept_release", False, f"Accept failed: {resp.status_code}"))
        else:
            log(f"  ✗ Raise dispute failed: {resp.status_code}")
            results.append(("3_accept_release", False, f"Raise dispute failed: {resp.status_code}"))
    
    log("\n[3i] Testing accept for REFUND outcome")
    deal_refund = create_funded_deal(merchant_token, "accept_refund")
    if deal_refund:
        # Seller raises dispute with refund proposal
        resp = requests.post(f"{BASE_URL}/escrow/{deal_refund['escrow_id']}/dispute",
            headers={"Authorization": f"Bearer {merchant_token}"},
            json={
                "proposed_outcome": "refund",
                "reason": "Test refund",
                "message": "Refund to buyer"
            }
        )
        if resp.status_code == 200:
            # Buyer accepts
            resp = requests.post(f"{BASE_URL}/escrow/public/{deal_refund['deal_token']}/action",
                headers={"x-escrow-token": deal_refund['escrow_session']},
                json={"action": "dispute-accept"}
            )
            if resp.status_code == 200:
                resp = requests.get(f"{BASE_URL}/escrow/{deal_refund['escrow_id']}",
                    headers={"Authorization": f"Bearer {merchant_token}"}
                )
                if resp.status_code == 200:
                    deal_data = resp.json().get("data", {})
                    if deal_data.get("status") == "refunded" and deal_data.get("dispute_stage") == "resolved":
                        log("  ✓ REFUND accepted and resolved correctly")
                        results.append(("3_accept_refund", True, "REFUND accepted correctly"))
                    else:
                        log(f"  ✗ REFUND state incorrect: status={deal_data.get('status')}, stage={deal_data.get('dispute_stage')}")
                        results.append(("3_accept_refund", False, "REFUND state incorrect"))
            else:
                log(f"  ✗ Accept refund failed: {resp.status_code}")
                results.append(("3_accept_refund", False, f"Accept failed: {resp.status_code}"))
        else:
            log(f"  ✗ Raise dispute failed: {resp.status_code}")
            results.append(("3_accept_refund", False, f"Raise dispute failed: {resp.status_code}"))
    
    return results

def test_4_escalation(merchant_token, admin_token):
    """TEST 4: ESCALATION (manual + admin resolve + auto-escalate scan)"""
    log("\n" + "="*80)
    log("TEST 4: ESCALATION")
    log("="*80)
    
    results = []
    
    # Test: Manual escalation
    log("\n[4a] Testing manual escalation")
    deal = create_funded_deal(merchant_token, "manual_escalation")
    if deal:
        # Raise dispute
        resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute",
            headers={"Authorization": f"Bearer {merchant_token}"},
            json={
                "proposed_outcome": "refund",
                "reason": "Test escalation",
                "message": "Need admin help"
            }
        )
        if resp.status_code == 200:
            log("  ✓ Dispute raised")
            
            # Escalate
            resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute/escalate",
                headers={"Authorization": f"Bearer {merchant_token}"}
            )
            if resp.status_code == 200:
                log("  ✓ Escalation successful")
                
                # Verify state
                resp = requests.get(f"{BASE_URL}/escrow/{deal['escrow_id']}",
                    headers={"Authorization": f"Bearer {merchant_token}"}
                )
                if resp.status_code == 200:
                    deal_data = resp.json().get("data", {})
                    dispute_stage = deal_data.get("dispute_stage")
                    dispute_escalated_at = deal_data.get("dispute_escalated_at")
                    dispute_auto_escalate_at = deal_data.get("dispute_auto_escalate_at")
                    dispute_thread = deal_data.get("dispute_thread", [])
                    
                    checks = []
                    if dispute_stage == "escalated":
                        log("  ✓ dispute_stage = 'escalated'")
                        checks.append(True)
                    else:
                        log(f"  ✗ dispute_stage should be 'escalated', got '{dispute_stage}'")
                        checks.append(False)
                    
                    if dispute_escalated_at is not None:
                        log("  ✓ dispute_escalated_at set")
                        checks.append(True)
                    else:
                        log("  ✗ dispute_escalated_at not set")
                        checks.append(False)
                    
                    if dispute_auto_escalate_at is None:
                        log("  ✓ dispute_auto_escalate_at cleared")
                        checks.append(True)
                    else:
                        log(f"  ✗ dispute_auto_escalate_at should be null")
                        checks.append(False)
                    
                    escalate_entry = next((e for e in dispute_thread if e.get("type") == "escalate"), None)
                    if escalate_entry:
                        log("  ✓ dispute_thread has 'escalate' entry")
                        checks.append(True)
                    else:
                        log("  ✗ dispute_thread missing 'escalate' entry")
                        checks.append(False)
                    
                    if all(checks):
                        results.append(("4_manual_escalate", True, "Manual escalation successful"))
                    else:
                        results.append(("4_manual_escalate", False, f"Escalation state incorrect: {checks}"))
                    
                    # Test: Counter/accept after escalation should fail
                    log("\n[4b] Testing counter after escalation (should fail)")
                    resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute/counter",
                        headers={"Authorization": f"Bearer {merchant_token}"},
                        json={"proposed_outcome": "split", "split_percent_seller": 50}
                    )
                    if resp.status_code == 409:
                        log("  ✓ Counter after escalation rejected with 409")
                        results.append(("4_counter_after_escalate", True, "Counter after escalation rejected"))
                    else:
                        log(f"  ✗ Expected 409, got {resp.status_code}")
                        results.append(("4_counter_after_escalate", False, f"Expected 409, got {resp.status_code}"))
                    
                    log("\n[4c] Testing accept after escalation (should fail)")
                    resp = requests.post(f"{BASE_URL}/escrow/public/{deal['deal_token']}/action",
                        headers={"x-escrow-token": deal['escrow_session']},
                        json={"action": "dispute-accept"}
                    )
                    if resp.status_code == 409:
                        log("  ✓ Accept after escalation rejected with 409")
                        results.append(("4_accept_after_escalate", True, "Accept after escalation rejected"))
                    else:
                        log(f"  ✗ Expected 409, got {resp.status_code}")
                        results.append(("4_accept_after_escalate", False, f"Expected 409, got {resp.status_code}"))
                else:
                    log(f"  ✗ Failed to get deal: {resp.status_code}")
                    results.append(("4_manual_escalate_verify", False, f"Failed to get deal: {resp.status_code}"))
            else:
                log(f"  ✗ Escalation failed: {resp.status_code} {resp.text}")
                results.append(("4_manual_escalate", False, f"Escalation failed: {resp.status_code}"))
        else:
            log(f"  ✗ Raise dispute failed: {resp.status_code}")
            results.append(("4_manual_escalate", False, f"Raise dispute failed: {resp.status_code}"))
    else:
        log("  ✗ Failed to create deal")
        results.append(("4_manual_escalate", False, "Failed to create deal"))
    
    # Test: Admin resolve
    log("\n[4d] Testing admin resolve of escalated deal")
    deal_admin = create_funded_deal(merchant_token, "admin_resolve")
    if deal_admin:
        # Raise and escalate dispute
        resp = requests.post(f"{BASE_URL}/escrow/{deal_admin['escrow_id']}/dispute",
            headers={"Authorization": f"Bearer {merchant_token}"},
            json={"proposed_outcome": "refund", "reason": "Test admin resolve"}
        )
        if resp.status_code == 200:
            resp = requests.post(f"{BASE_URL}/escrow/{deal_admin['escrow_id']}/dispute/escalate",
                headers={"Authorization": f"Bearer {merchant_token}"}
            )
            if resp.status_code == 200:
                log("  ✓ Dispute escalated")
                
                # Admin resolves with split 50/50
                resp = requests.post(f"{BASE_URL}/escrow/admin/{deal_admin['escrow_id']}/resolve",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={
                        "outcome": "split",
                        "split_percent_seller": 50,
                        "note": "admin decision"
                    }
                )
                if resp.status_code == 200:
                    log("  ✓ Admin resolve successful")
                    
                    # Verify resolution
                    resp = requests.get(f"{BASE_URL}/escrow/{deal_admin['escrow_id']}",
                        headers={"Authorization": f"Bearer {merchant_token}"}
                    )
                    if resp.status_code == 200:
                        deal_data = resp.json().get("data", {})
                        dispute_stage = deal_data.get("dispute_stage")
                        status = deal_data.get("status")
                        seller_entitlement = deal_data.get("seller_entitlement_stable")
                        buyer_entitlement = deal_data.get("buyer_entitlement_stable")
                        dispute_thread = deal_data.get("dispute_thread", [])
                        
                        log(f"  dispute_stage: {dispute_stage}")
                        log(f"  status: {status}")
                        log(f"  seller_entitlement: ${seller_entitlement}")
                        log(f"  buyer_entitlement: ${buyer_entitlement}")
                        
                        checks = []
                        if dispute_stage == "resolved":
                            log("  ✓ dispute_stage = 'resolved'")
                            checks.append(True)
                        else:
                            log(f"  ✗ dispute_stage should be 'resolved', got '{dispute_stage}'")
                            checks.append(False)
                        
                        if status == "split":
                            log("  ✓ status = 'split'")
                            checks.append(True)
                        else:
                            log(f"  ✗ status should be 'split', got '{status}'")
                            checks.append(False)
                        
                        resolve_entry = next((e for e in dispute_thread if e.get("type") == "resolve" and e.get("by") == "admin"), None)
                        if resolve_entry:
                            log("  ✓ dispute_thread has admin 'resolve' entry")
                            checks.append(True)
                        else:
                            log("  ✗ dispute_thread missing admin resolve entry")
                            checks.append(False)
                        
                        if all(checks):
                            results.append(("4_admin_resolve", True, "Admin resolve successful"))
                        else:
                            results.append(("4_admin_resolve", False, f"Admin resolve state incorrect: {checks}"))
                    else:
                        log(f"  ✗ Failed to get deal: {resp.status_code}")
                        results.append(("4_admin_resolve_verify", False, f"Failed to get deal: {resp.status_code}"))
                else:
                    log(f"  ✗ Admin resolve failed: {resp.status_code} {resp.text}")
                    results.append(("4_admin_resolve", False, f"Admin resolve failed: {resp.status_code}"))
            else:
                log(f"  ✗ Escalation failed: {resp.status_code}")
                results.append(("4_admin_resolve", False, f"Escalation failed: {resp.status_code}"))
        else:
            log(f"  ✗ Raise dispute failed: {resp.status_code}")
            results.append(("4_admin_resolve", False, f"Raise dispute failed: {resp.status_code}"))
    else:
        log("  ✗ Failed to create deal")
        results.append(("4_admin_resolve", False, "Failed to create deal"))
    
    # Test: Auto-escalate scan
    log("\n[4e] Testing auto-escalate scan endpoint")
    resp = requests.post(f"{BASE_URL}/escrow/admin/run-dispute-escalations",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if resp.status_code == 200:
        data = resp.json().get("data", {})
        escalated = data.get("escalated", [])
        count = data.get("count", 0)
        log(f"  ✓ Auto-escalate scan successful: escalated {count} deals")
        log(f"  Escalated IDs: {escalated}")
        results.append(("4_auto_escalate_scan", True, f"Auto-escalate scan successful: {count} deals"))
    else:
        log(f"  ✗ Auto-escalate scan failed: {resp.status_code} {resp.text}")
        results.append(("4_auto_escalate_scan", False, f"Auto-escalate scan failed: {resp.status_code}"))
    
    return results

def test_5_public_otp_parity(merchant_token):
    """TEST 5: PUBLIC (OTP) PARITY for dispute actions"""
    log("\n" + "="*80)
    log("TEST 5: PUBLIC (OTP) PARITY")
    log("="*80)
    
    results = []
    
    # Create funded deal
    deal = create_funded_deal(merchant_token, "public_parity")
    if not deal:
        log("✗ Failed to create funded deal")
        return [("5_create_deal", False, "Failed to create funded deal")]
    
    # Seller raises dispute
    log("\n[5a] Seller raises dispute")
    resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute",
        headers={"Authorization": f"Bearer {merchant_token}"},
        json={
            "proposed_outcome": "refund",
            "reason": "Test public parity",
            "message": "Initial proposal"
        }
    )
    if resp.status_code != 200:
        log(f"✗ Failed to raise dispute: {resp.status_code}")
        return [("5_raise_dispute", False, f"Failed to raise dispute: {resp.status_code}")]
    log("✓ Dispute raised")
    
    # Test: Buyer (public) counters
    log("\n[5b] Buyer counters via public action")
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal['deal_token']}/action",
        headers={"x-escrow-token": deal['escrow_session']},
        json={
            "action": "dispute-counter",
            "proposed_outcome": "split",
            "split_percent_seller": 60,
            "message": "Counter via public"
        }
    )
    if resp.status_code == 200:
        log("  ✓ Public counter successful")
        results.append(("5_public_counter", True, "Public counter successful"))
    else:
        log(f"  ✗ Public counter failed: {resp.status_code} {resp.text}")
        results.append(("5_public_counter", False, f"Public counter failed: {resp.status_code}"))
    
    # Test: Buyer tries to accept own proposal (should fail)
    log("\n[5c] Buyer tries to accept own proposal via public (should fail)")
    resp = requests.post(f"{BASE_URL}/escrow/public/{deal['deal_token']}/action",
        headers={"x-escrow-token": deal['escrow_session']},
        json={"action": "dispute-accept"}
    )
    if resp.status_code == 403:
        log("  ✓ Public accept own proposal rejected with 403")
        results.append(("5_public_accept_own", True, "Public accept own proposal rejected"))
    else:
        log(f"  ✗ Expected 403, got {resp.status_code}")
        results.append(("5_public_accept_own", False, f"Expected 403, got {resp.status_code}"))
    
    # Test: Seller accepts via authed endpoint
    log("\n[5d] Seller accepts buyer's proposal")
    resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/dispute/accept",
        headers={"Authorization": f"Bearer {merchant_token}"}
    )
    if resp.status_code == 200:
        log("  ✓ Accept successful")
        
        # Verify resolution
        resp = requests.get(f"{BASE_URL}/escrow/{deal['escrow_id']}",
            headers={"Authorization": f"Bearer {merchant_token}"}
        )
        if resp.status_code == 200:
            deal_data = resp.json().get("data", {})
            if deal_data.get("dispute_stage") == "resolved":
                log("  ✓ Dispute resolved via public counter + authed accept")
                results.append(("5_public_flow", True, "Public counter + authed accept successful"))
            else:
                log(f"  ✗ Dispute not resolved: stage={deal_data.get('dispute_stage')}")
                results.append(("5_public_flow", False, "Dispute not resolved"))
        else:
            log(f"  ✗ Failed to get deal: {resp.status_code}")
            results.append(("5_public_flow", False, f"Failed to get deal: {resp.status_code}"))
    else:
        log(f"  ✗ Accept failed: {resp.status_code} {resp.text}")
        results.append(("5_public_flow", False, f"Accept failed: {resp.status_code}"))
    
    # Test: Public message and escalate
    log("\n[5e] Testing public message and escalate")
    deal2 = create_funded_deal(merchant_token, "public_message_escalate")
    if deal2:
        # Raise dispute
        resp = requests.post(f"{BASE_URL}/escrow/{deal2['escrow_id']}/dispute",
            headers={"Authorization": f"Bearer {merchant_token}"},
            json={"proposed_outcome": "refund", "reason": "Test"}
        )
        if resp.status_code == 200:
            # Public message
            resp = requests.post(f"{BASE_URL}/escrow/public/{deal2['deal_token']}/action",
                headers={"x-escrow-token": deal2['escrow_session']},
                json={"action": "dispute-message", "message": "Public message"}
            )
            if resp.status_code == 200:
                log("  ✓ Public message successful")
                results.append(("5_public_message", True, "Public message successful"))
            else:
                log(f"  ✗ Public message failed: {resp.status_code}")
                results.append(("5_public_message", False, f"Public message failed: {resp.status_code}"))
            
            # Public escalate
            resp = requests.post(f"{BASE_URL}/escrow/public/{deal2['deal_token']}/action",
                headers={"x-escrow-token": deal2['escrow_session']},
                json={"action": "dispute-escalate"}
            )
            if resp.status_code == 200:
                log("  ✓ Public escalate successful")
                results.append(("5_public_escalate", True, "Public escalate successful"))
            else:
                log(f"  ✗ Public escalate failed: {resp.status_code}")
                results.append(("5_public_escalate", False, f"Public escalate failed: {resp.status_code}"))
        else:
            log(f"  ✗ Raise dispute failed: {resp.status_code}")
            results.append(("5_public_actions", False, f"Raise dispute failed: {resp.status_code}"))
    
    return results

def test_6_regression(merchant_token):
    """TEST 6: REGRESSION (happy path + idempotency)"""
    log("\n" + "="*80)
    log("TEST 6: REGRESSION")
    log("="*80)
    
    results = []
    
    # Test: Happy path create→accept→fund→deliver→release
    log("\n[6a] Testing happy path: create→accept→fund→deliver→release")
    deal = create_funded_deal(merchant_token, "happy_path")
    if deal:
        # Deliver
        resp = requests.post(f"{BASE_URL}/escrow/{deal['escrow_id']}/deliver",
            headers={"Authorization": f"Bearer {merchant_token}"},
            json={"delivery_note": "Delivered"}
        )
        if resp.status_code == 200:
            log("  ✓ Delivered")
            
            # Release
            resp = requests.post(f"{BASE_URL}/escrow/public/{deal['deal_token']}/action",
                headers={"x-escrow-token": deal['escrow_session']},
                json={"action": "release"}
            )
            if resp.status_code == 200:
                log("  ✓ Released")
                
                # Verify completion
                resp = requests.get(f"{BASE_URL}/escrow/{deal['escrow_id']}",
                    headers={"Authorization": f"Bearer {merchant_token}"}
                )
                if resp.status_code == 200:
                    deal_data = resp.json().get("data", {})
                    status = deal_data.get("status")
                    seller_entitlement = deal_data.get("seller_entitlement_stable")
                    
                    if status == "completed" and seller_entitlement is not None:
                        log(f"  ✓ Happy path complete: status={status}, seller_entitlement=${seller_entitlement}")
                        results.append(("6_happy_path", True, "Happy path successful"))
                    else:
                        log(f"  ✗ Happy path incomplete: status={status}, entitlement={seller_entitlement}")
                        results.append(("6_happy_path", False, "Happy path incomplete"))
                else:
                    log(f"  ✗ Failed to get deal: {resp.status_code}")
                    results.append(("6_happy_path", False, f"Failed to get deal: {resp.status_code}"))
            else:
                log(f"  ✗ Release failed: {resp.status_code} {resp.text}")
                results.append(("6_happy_path", False, f"Release failed: {resp.status_code}"))
        else:
            log(f"  ✗ Deliver failed: {resp.status_code} {resp.text}")
            results.append(("6_happy_path", False, f"Deliver failed: {resp.status_code}"))
    else:
        log("  ✗ Failed to create deal")
        results.append(("6_happy_path", False, "Failed to create deal"))
    
    # Test: Idempotency - calling dispute/accept twice
    log("\n[6b] Testing idempotency: accept twice on resolved deal")
    deal_idem = create_funded_deal(merchant_token, "idempotency")
    if deal_idem:
        # Raise and accept dispute
        resp = requests.post(f"{BASE_URL}/escrow/{deal_idem['escrow_id']}/dispute",
            headers={"Authorization": f"Bearer {merchant_token}"},
            json={"proposed_outcome": "refund", "reason": "Test idempotency"}
        )
        if resp.status_code == 200:
            resp = requests.post(f"{BASE_URL}/escrow/public/{deal_idem['deal_token']}/action",
                headers={"x-escrow-token": deal_idem['escrow_session']},
                json={"action": "dispute-accept"}
            )
            if resp.status_code == 200:
                log("  ✓ First accept successful")
                
                # Try to accept again
                resp = requests.post(f"{BASE_URL}/escrow/public/{deal_idem['deal_token']}/action",
                    headers={"x-escrow-token": deal_idem['escrow_session']},
                    json={"action": "dispute-accept"}
                )
                if resp.status_code == 409:
                    log("  ✓ Second accept rejected with 409 (idempotent)")
                    results.append(("6_idempotency", True, "Accept idempotency working"))
                else:
                    log(f"  ✗ Expected 409, got {resp.status_code}")
                    results.append(("6_idempotency", False, f"Expected 409, got {resp.status_code}"))
            else:
                log(f"  ✗ First accept failed: {resp.status_code}")
                results.append(("6_idempotency", False, f"First accept failed: {resp.status_code}"))
        else:
            log(f"  ✗ Raise dispute failed: {resp.status_code}")
            results.append(("6_idempotency", False, f"Raise dispute failed: {resp.status_code}"))
    else:
        log("  ✗ Failed to create deal")
        results.append(("6_idempotency", False, "Failed to create deal"))
    
    return results

def main():
    log("="*80)
    log("ESCROW DISPUTE FLOW TESTING")
    log("="*80)
    
    # Login
    merchant_token = merchant_login()
    if not merchant_token:
        log("FATAL: Merchant login failed")
        sys.exit(1)
    
    admin_token = admin_login()
    if not admin_token:
        log("FATAL: Admin login failed")
        sys.exit(1)
    
    # Run all tests
    all_results = []
    
    all_results.extend(test_1_fee_settlement_model(merchant_token))
    all_results.extend(test_2_raise_dispute_requires_proposal(merchant_token))
    all_results.extend(test_3_negotiation_loop(merchant_token))
    all_results.extend(test_4_escalation(merchant_token, admin_token))
    all_results.extend(test_5_public_otp_parity(merchant_token))
    all_results.extend(test_6_regression(merchant_token))
    
    # Summary
    log("\n" + "="*80)
    log("TEST SUMMARY")
    log("="*80)
    
    passed = sum(1 for _, success, _ in all_results if success)
    failed = sum(1 for _, success, _ in all_results if not success)
    total = len(all_results)
    
    log(f"\nTotal: {total} tests")
    log(f"Passed: {passed} ✓")
    log(f"Failed: {failed} ✗")
    
    if failed > 0:
        log("\nFailed tests:")
        for name, success, msg in all_results:
            if not success:
                log(f"  ✗ {name}: {msg}")
    
    log("\nPassed tests:")
    for name, success, msg in all_results:
        if success:
            log(f"  ✓ {name}: {msg}")
    
    # Save results
    with open("/app/escrow_dispute_test_results.json", "w") as f:
        json.dump({
            "total": total,
            "passed": passed,
            "failed": failed,
            "results": [{"test": name, "success": success, "message": msg} for name, success, msg in all_results]
        }, f, indent=2)
    
    log(f"\nResults saved to /app/escrow_dispute_test_results.json")
    
    if failed == 0:
        log("\n✓✓✓ ALL TESTS PASSED ✓✓✓")
        sys.exit(0)
    else:
        log(f"\n✗✗✗ {failed} TESTS FAILED ✗✗✗")
        sys.exit(1)

if __name__ == "__main__":
    main()
