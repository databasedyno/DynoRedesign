#!/usr/bin/env python3
"""
Backend Test: Weekly Summary Notification Bug Fix Verification
Bug: total_volume was summing RAW base_amount instead of USD values
Fix: now sums COALESCE(NULLIF(usd_value,0), stablecoin base_amount)
"""

import requests
import subprocess
import json
import sys
from typing import Dict, Any, Optional

# Base URL
BASE_URL = "https://cd0a12df-8cd2-4301-a8cf-d89e2699ae29.preview.emergentagent.com"

# Test credentials
MERCHANT_EMAIL = "onarrival21@gmail.com"
MERCHANT_PASSWORD = "Katiekendra123@"
USER_ID = 1

# Headers with browser User-Agent (required for Cloudflare)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json"
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.END}\n")

def print_success(text: str):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_error(text: str):
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def print_info(text: str):
    print(f"{Colors.YELLOW}ℹ️  {text}{Colors.END}")

def get_totp() -> Optional[str]:
    """Get current TOTP code for user_id 1"""
    try:
        result = subprocess.run(
            ["node", "/app/backend/scripts/print_totp.cjs", str(USER_ID)],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            totp = result.stdout.strip()
            print_info(f"TOTP retrieved: {totp}")
            return totp
        else:
            print_error(f"Failed to get TOTP: {result.stderr}")
            return None
    except Exception as e:
        print_error(f"Exception getting TOTP: {e}")
        return None

def login_step1() -> Optional[str]:
    """Step 1: Login with email/password to get challenge_token"""
    print_header("STEP 1: Login with Email/Password")
    
    url = f"{BASE_URL}/api/user/login"
    payload = {
        "email": MERCHANT_EMAIL,
        "password": MERCHANT_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload, headers=HEADERS, timeout=30)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            # Check if we have data with challenge_token (2FA required)
            if "data" in data and data["data"].get("challenge_token"):
                challenge_token = data["data"].get("challenge_token")
                print_success(f"Login successful, challenge_token received (2FA required)")
                return challenge_token
            elif data.get("success") and "data" in data:
                challenge_token = data["data"].get("challenge_token")
                if challenge_token:
                    print_success(f"Login successful, challenge_token received")
                    return challenge_token
                else:
                    print_error("No challenge_token in response")
                    print_info(f"Response: {json.dumps(data, indent=2)}")
            else:
                print_error(f"Login failed: {data}")
        else:
            print_error(f"HTTP {response.status_code}: {response.text}")
        
        return None
    except Exception as e:
        print_error(f"Exception during login: {e}")
        return None

def login_step2(challenge_token: str, totp: str) -> Optional[str]:
    """Step 2: Validate 2FA with TOTP to get accessToken"""
    print_header("STEP 2: Validate 2FA with TOTP")
    
    url = f"{BASE_URL}/api/user/2fa/validate"
    payload = {
        "challenge_token": challenge_token,
        "token": totp
    }
    
    try:
        response = requests.post(url, json=payload, headers=HEADERS, timeout=30)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            # Check if we have data with accessToken
            if "data" in data and data["data"].get("accessToken"):
                access_token = data["data"].get("accessToken")
                print_success(f"2FA validation successful, accessToken received")
                return access_token
            elif data.get("success") and "data" in data:
                access_token = data["data"].get("accessToken")
                if access_token:
                    print_success(f"2FA validation successful, accessToken received")
                    return access_token
                else:
                    print_error("No accessToken in response")
                    print_info(f"Response: {json.dumps(data, indent=2)}")
            else:
                print_error(f"2FA validation failed: {data}")
        else:
            print_error(f"HTTP {response.status_code}: {response.text}")
        
        return None
    except Exception as e:
        print_error(f"Exception during 2FA validation: {e}")
        return None

def get_db_truth() -> Optional[Dict[str, Any]]:
    """Get the truth from database using read-only query"""
    print_header("STEP 3: Get Database Truth (Read-Only Query)")
    
    query = """
    SELECT 
        ROUND(SUM(CASE WHEN status IN ('successful','done','completed') THEN base_amount ELSE 0 END)::numeric,2) AS old_vol,
        ROUND(SUM(CASE WHEN status IN ('successful','done','completed') THEN 
            COALESCE(NULLIF(usd_value,0), 
                CASE WHEN UPPER(base_currency) IN ('USD','USDT','USDC','USDT-TRC20','USDT-ERC20','USDC-ERC20','BUSD','DAI','USDT_TRC20','USDT_ERC20','USDC_ERC20','USDT-POLYGON') 
                THEN base_amount ELSE 0 END) 
        ELSE 0 END)::numeric,2) AS new_vol_usd,
        COUNT(*) AS txn,
        SUM(CASE WHEN status IN ('successful','done','completed') THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending
    FROM tbl_user_transaction 
    WHERE user_id = '1' 
    AND "createdAt" >= now() - interval '7 days'
    """
    
    try:
        result = subprocess.run(
            ["node", "/app/backend/scripts/ro_query.js", query],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            output = result.stdout.strip()
            print_info(f"Query output:\n{output}")
            
            # Parse the output - it should be a table format
            lines = output.split('\n')
            if len(lines) >= 3:
                # Find the data line (skip header and separator)
                for line in lines[2:]:
                    if line.strip() and not line.startswith('-'):
                        parts = [p.strip() for p in line.split('|')]
                        if len(parts) >= 5:
                            try:
                                db_data = {
                                    "old_vol": float(parts[0]) if parts[0] else 0.0,
                                    "new_vol_usd": float(parts[1]) if parts[1] else 0.0,
                                    "txn": int(parts[2]) if parts[2] else 0,
                                    "completed": int(parts[3]) if parts[3] else 0,
                                    "pending": int(parts[4]) if parts[4] else 0
                                }
                                print_success(f"Database truth retrieved:")
                                print_info(f"  old_vol (buggy): ${db_data['old_vol']}")
                                print_info(f"  new_vol_usd (fixed): ${db_data['new_vol_usd']}")
                                print_info(f"  transaction_count: {db_data['txn']}")
                                print_info(f"  completed_count: {db_data['completed']}")
                                print_info(f"  pending_count: {db_data['pending']}")
                                return db_data
                            except (ValueError, IndexError) as e:
                                print_error(f"Failed to parse query result: {e}")
            
            print_error("Could not parse query output")
            return None
        else:
            print_error(f"Query failed: {result.stderr}")
            return None
    except Exception as e:
        print_error(f"Exception running query: {e}")
        return None

def trigger_weekly_summary(access_token: str) -> Optional[Dict[str, Any]]:
    """Trigger weekly summary with dry_run=true"""
    print_header("STEP 4: Trigger Weekly Summary (Dry Run)")
    
    url = f"{BASE_URL}/api/notifications/trigger-weekly-summary"
    headers = {
        **HEADERS,
        "Authorization": f"Bearer {access_token}"
    }
    payload = {
        "user_id": USER_ID,
        "dry_run": True
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success("Weekly summary trigger successful")
            print_info(f"Response:\n{json.dumps(data, indent=2)}")
            return data
        else:
            print_error(f"HTTP {response.status_code}: {response.text}")
            return None
    except Exception as e:
        print_error(f"Exception triggering weekly summary: {e}")
        return None

def verify_assertions(api_response: Dict[str, Any], db_truth: Dict[str, Any]) -> bool:
    """Verify all assertions"""
    print_header("STEP 5: Verify Assertions")
    
    all_passed = True
    
    # Extract summary from API response
    if not api_response.get("data") or not api_response["data"].get("results"):
        print_error("ASSERTION FAILED: No data.results in API response")
        return False
    
    results = api_response["data"]["results"]
    if not results or len(results) == 0:
        print_error("ASSERTION FAILED: results array is empty")
        return False
    
    result = results[0]
    
    # Assertion 2: dry_run=true, notification=null
    print("\n" + Colors.BOLD + "Assertion 2: Dry run verification" + Colors.END)
    if result.get("dry_run") == True:
        print_success("dry_run is true")
    else:
        print_error(f"ASSERTION FAILED: dry_run is {result.get('dry_run')}, expected true")
        all_passed = False
    
    if result.get("notification") is None:
        print_success("notification is null (no DB write)")
    else:
        print_error(f"ASSERTION FAILED: notification is {result.get('notification')}, expected null")
        all_passed = False
    
    # Check summary exists
    if not result.get("summary"):
        print_error("ASSERTION FAILED: No summary in results[0]")
        return False
    
    summary = result["summary"]
    print_info(f"\nAPI Summary:\n{json.dumps(summary, indent=2)}")
    
    # Assertion 3: total_volume ≈ new_vol_usd (within ±1.00)
    print("\n" + Colors.BOLD + "Assertion 3: total_volume matches new_vol_usd" + Colors.END)
    api_total_volume = float(summary.get("total_volume", 0))
    db_new_vol = db_truth["new_vol_usd"]
    volume_diff = abs(api_total_volume - db_new_vol)
    
    print_info(f"API total_volume: ${api_total_volume}")
    print_info(f"DB new_vol_usd: ${db_new_vol}")
    print_info(f"Difference: ${volume_diff}")
    
    if volume_diff <= 1.00:
        print_success(f"total_volume matches new_vol_usd (within ±$1.00)")
    else:
        print_error(f"ASSERTION FAILED: total_volume differs by ${volume_diff} (> $1.00)")
        all_passed = False
    
    # Assertion 4: total_volume is NOT equal to old_vol
    print("\n" + Colors.BOLD + "Assertion 4: Bug fix verification (NOT using old buggy calculation)" + Colors.END)
    db_old_vol = db_truth["old_vol"]
    print_info(f"API total_volume: ${api_total_volume}")
    print_info(f"DB old_vol (buggy): ${db_old_vol}")
    
    if abs(api_total_volume - db_old_vol) > 1.00:
        print_success(f"total_volume is NOT equal to old_vol (bug is fixed)")
    else:
        print_error(f"ASSERTION FAILED: total_volume ≈ old_vol (bug NOT fixed!)")
        all_passed = False
    
    # Assertion 5: total_volume > 1000 (realistic USD figure)
    print("\n" + Colors.BOLD + "Assertion 5: Realistic USD figure" + Colors.END)
    if api_total_volume > 1000:
        print_success(f"total_volume ${api_total_volume} > $1000 (realistic)")
    else:
        print_error(f"ASSERTION FAILED: total_volume ${api_total_volume} <= $1000 (unrealistic)")
        all_passed = False
    
    # Assertion 6: transaction counts match
    print("\n" + Colors.BOLD + "Assertion 6: Transaction counts match" + Colors.END)
    
    api_txn_count = summary.get("transaction_count", 0)
    db_txn_count = db_truth["txn"]
    if api_txn_count == db_txn_count:
        print_success(f"transaction_count matches: {api_txn_count}")
    else:
        print_error(f"ASSERTION FAILED: transaction_count {api_txn_count} != {db_txn_count}")
        all_passed = False
    
    api_completed = summary.get("completed_count", 0)
    db_completed = db_truth["completed"]
    if api_completed == db_completed:
        print_success(f"completed_count matches: {api_completed}")
    else:
        print_error(f"ASSERTION FAILED: completed_count {api_completed} != {db_completed}")
        all_passed = False
    
    api_pending = summary.get("pending_count", 0)
    db_pending = db_truth["pending"]
    if api_pending == db_pending:
        print_success(f"pending_count matches: {api_pending}")
    else:
        print_error(f"ASSERTION FAILED: pending_count {api_pending} != {db_pending}")
        all_passed = False
    
    return all_passed

def main():
    print_header("Weekly Summary Notification Bug Fix Verification")
    print_info(f"Base URL: {BASE_URL}")
    print_info(f"User: {MERCHANT_EMAIL} (user_id={USER_ID})")
    
    # Step 1: Get TOTP
    totp = get_totp()
    if not totp:
        print_error("Failed to get TOTP. Aborting.")
        sys.exit(1)
    
    # Step 2: Login (email/password)
    challenge_token = login_step1()
    if not challenge_token:
        print_error("Login step 1 failed. Aborting.")
        sys.exit(1)
    
    # Step 3: Validate 2FA
    access_token = login_step2(challenge_token, totp)
    if not access_token:
        print_error("2FA validation failed. Aborting.")
        # Try getting fresh TOTP and retry once
        print_info("Retrying with fresh TOTP...")
        totp = get_totp()
        if totp:
            access_token = login_step2(challenge_token, totp)
        if not access_token:
            print_error("2FA validation failed after retry. Aborting.")
            sys.exit(1)
    
    print_success("✅ ASSERTION 1 PASSED: Login + 2FA succeeded, accessToken obtained")
    
    # Step 4: Get database truth
    db_truth = get_db_truth()
    if not db_truth:
        print_error("Failed to get database truth. Aborting.")
        sys.exit(1)
    
    # Step 5: Trigger weekly summary (dry run)
    api_response = trigger_weekly_summary(access_token)
    if not api_response:
        print_error("Failed to trigger weekly summary. Aborting.")
        sys.exit(1)
    
    # Step 6: Verify all assertions
    all_passed = verify_assertions(api_response, db_truth)
    
    # Final summary
    print_header("FINAL SUMMARY")
    
    if all_passed:
        print_success("✅✅✅ ALL ASSERTIONS PASSED ✅✅✅")
        print_success("\nBug fix VERIFIED:")
        print_success("  - Weekly summary now correctly sums USD values")
        print_success("  - NOT using buggy raw base_amount calculation")
        print_success("  - Total volume is realistic (> $1000)")
        print_success("  - Transaction counts match database")
        print_success("  - Dry run works correctly (no DB write)")
        print("\n" + Colors.GREEN + Colors.BOLD + "🎉 BUG FIX CONFIRMED - READY FOR PRODUCTION 🎉" + Colors.END + "\n")
        sys.exit(0)
    else:
        print_error("❌❌❌ SOME ASSERTIONS FAILED ❌❌❌")
        print_error("\nPlease review the failures above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
