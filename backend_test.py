#!/usr/bin/env python3
"""
Backend test for Dynopay name capture feature.
Tests email signup flow to verify first+last name is required at OTP verification.
"""

import os
import sys
import json
import time
import random
import requests
import redis
import psycopg2
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:8001/api"
REDIS_URL = os.getenv("REDIS_PUBLIC_URL", "redis://default:HAEMJseUAdqAjpiICURxlefSoSYXKEUg@nozomi.proxy.rlwy.net:15794/1")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:IHCzCDslIsUZlzCvvjxfSWcChEiBtiCU@roundhouse.proxy.rlwy.net:23599/railway")

def log(msg):
    """Print timestamped log message"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def connect_redis():
    """Connect to Redis"""
    log(f"Connecting to Redis...")
    r = redis.from_url(REDIS_URL)
    r.ping()
    log("✓ Redis connected")
    return r

def connect_postgres():
    """Connect to Postgres"""
    log(f"Connecting to Postgres...")
    conn = psycopg2.connect(DATABASE_URL, sslmode='require')
    log("✓ Postgres connected")
    return conn

def read_otp_from_redis(r, email):
    """Read OTP from Redis for given email"""
    key = f"otp:{email.lower()}:json"
    log(f"Reading OTP from Redis key: {key}")
    value = r.get(key)
    if not value:
        log(f"✗ No OTP found in Redis for key: {key}")
        return None
    
    data = json.loads(value)
    otp = data.get("otp")
    log(f"✓ OTP read from Redis: {otp}")
    return otp

def query_user_by_email(conn, email):
    """Query tbl_user for given email"""
    with conn.cursor() as cur:
        cur.execute("SELECT user_id, name, email, login_type FROM tbl_user WHERE LOWER(email) = LOWER(%s)", (email,))
        result = cur.fetchone()
        return result

def cleanup_user(conn, user_id):
    """Clean up user and related records"""
    log(f"Cleaning up user_id={user_id}...")
    with conn.cursor() as cur:
        try:
            # Delete child rows first (ignore tables that don't exist or have no rows)
            cur.execute("DELETE FROM tbl_user_wallet WHERE user_id=%s", (user_id,))
            deleted_wallets = cur.rowcount
            log(f"  Deleted {deleted_wallets} wallets")
            
            cur.execute("DELETE FROM tbl_referral WHERE referrer_user_id=%s OR referred_user_id=%s", (user_id, user_id))
            deleted_referrals = cur.rowcount
            log(f"  Deleted {deleted_referrals} referrals")
            
            # Delete the user
            cur.execute("DELETE FROM tbl_user WHERE user_id=%s", (user_id,))
            deleted_users = cur.rowcount
            log(f"  Deleted {deleted_users} users")
            
            conn.commit()
            log(f"✓ Cleanup complete for user_id={user_id}")
            return True
        except Exception as e:
            conn.rollback()
            log(f"✗ Cleanup failed: {e}")
            log(f"  LEFTOVER user_id={user_id} - manual cleanup required")
            return False

def test_negative_no_name():
    """TEST 1 - NEGATIVE: Verify OTP without name fields returns 400 and creates NO user"""
    log("\n" + "="*80)
    log("TEST 1 - NEGATIVE: OTP verification WITHOUT name fields")
    log("="*80)
    
    # Generate unique email
    timestamp = int(time.time() * 1000)
    email = f"qa-nametest-{timestamp}@example.com"
    log(f"Test email: {email}")
    
    # Connect to Redis and Postgres
    r = connect_redis()
    conn = connect_postgres()
    
    try:
        # Step 1: POST /api/user/registerEmail
        log("\nStep 1: POST /api/user/registerEmail")
        response = requests.post(
            f"{BACKEND_URL}/user/registerEmail",
            json={"email": email},
            timeout=10
        )
        log(f"Response status: {response.status_code}")
        log(f"Response body: {response.text}")
        
        if response.status_code != 200:
            log(f"✗ Expected 200, got {response.status_code}")
            return False
        
        log("✓ registerEmail returned 200")
        
        # Step 2: Read OTP from Redis
        log("\nStep 2: Read OTP from Redis")
        time.sleep(1)  # Give Redis a moment
        otp = read_otp_from_redis(r, email)
        
        if not otp:
            log("✗ Failed to read OTP from Redis")
            return False
        
        # Step 3: POST /api/user/registerEmail/verify-otp WITHOUT name fields
        log("\nStep 3: POST /api/user/registerEmail/verify-otp (NO name fields)")
        response = requests.post(
            f"{BACKEND_URL}/user/registerEmail/verify-otp",
            json={"email": email, "otp": otp},
            timeout=10
        )
        log(f"Response status: {response.status_code}")
        log(f"Response body: {response.text}")
        
        if response.status_code != 400:
            log(f"✗ Expected 400, got {response.status_code}")
            return False
        
        # Check if response mentions first and last name
        response_text = response.text.lower()
        if "first" not in response_text or "last" not in response_text or "name" not in response_text:
            log(f"✗ Expected error message to mention 'first and last name'")
            return False
        
        log("✓ verify-otp returned 400 with correct error message")
        
        # Step 4: Verify NO user was created
        log("\nStep 4: Query tbl_user to verify NO account created")
        user = query_user_by_email(conn, email)
        
        if user:
            log(f"✗ FAIL: User was created when it shouldn't have been: {user}")
            # Clean up the unexpected user
            cleanup_user(conn, user[0])
            return False
        
        log("✓ PASS: No user account was created (as expected)")
        
        log("\n" + "="*80)
        log("TEST 1 - NEGATIVE: ✓✓✓ PASSED ✓✓✓")
        log("="*80)
        return True
        
    except Exception as e:
        log(f"✗ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        r.close()
        conn.close()

def test_positive_with_name():
    """TEST 2 - POSITIVE: Verify OTP with name fields creates user, then clean up"""
    log("\n" + "="*80)
    log("TEST 2 - POSITIVE: OTP verification WITH name fields")
    log("="*80)
    
    # Generate unique email
    timestamp = int(time.time() * 1000)
    email = f"qa-namepos-{timestamp}@example.com"
    log(f"Test email: {email}")
    
    # Connect to Redis and Postgres
    r = connect_redis()
    conn = connect_postgres()
    
    user_id = None
    
    try:
        # Step 1: POST /api/user/registerEmail
        log("\nStep 1: POST /api/user/registerEmail")
        response = requests.post(
            f"{BACKEND_URL}/user/registerEmail",
            json={"email": email},
            timeout=10
        )
        log(f"Response status: {response.status_code}")
        log(f"Response body: {response.text}")
        
        if response.status_code != 200:
            log(f"✗ Expected 200, got {response.status_code}")
            return False
        
        log("✓ registerEmail returned 200")
        
        # Step 2: Read OTP from Redis
        log("\nStep 2: Read OTP from Redis")
        time.sleep(1)  # Give Redis a moment
        otp = read_otp_from_redis(r, email)
        
        if not otp:
            log("✗ Failed to read OTP from Redis")
            return False
        
        # Step 3: POST /api/user/registerEmail/verify-otp WITH name fields
        log("\nStep 3: POST /api/user/registerEmail/verify-otp (WITH name fields)")
        response = requests.post(
            f"{BACKEND_URL}/user/registerEmail/verify-otp",
            json={
                "email": email,
                "otp": otp,
                "first_name": "Ada",
                "last_name": "Lovelace"
            },
            timeout=10
        )
        log(f"Response status: {response.status_code}")
        log(f"Response body: {response.text}")
        
        if response.status_code != 200:
            log(f"✗ Expected 200, got {response.status_code}")
            return False
        
        # Check for accessToken in response
        try:
            response_data = response.json()
            if not response_data.get("data", {}).get("accessToken"):
                log(f"✗ Expected accessToken in response data")
                return False
        except:
            log(f"✗ Failed to parse JSON response")
            return False
        
        log("✓ verify-otp returned 200 with accessToken")
        
        # Step 4: Query tbl_user to verify account was created correctly
        log("\nStep 4: Query tbl_user to verify account created with correct name")
        time.sleep(1)  # Give DB a moment
        user = query_user_by_email(conn, email)
        
        if not user:
            log(f"✗ FAIL: No user account was created")
            return False
        
        user_id, name, user_email, login_type = user
        log(f"User found: user_id={user_id}, name='{name}', email='{user_email}', login_type='{login_type}'")
        
        # Verify name
        if name != "Ada Lovelace":
            log(f"✗ FAIL: Expected name='Ada Lovelace', got name='{name}'")
            return False
        
        log("✓ Name is correct: 'Ada Lovelace'")
        
        # Verify login_type
        if login_type != "EMAIL":
            log(f"✗ FAIL: Expected login_type='EMAIL', got login_type='{login_type}'")
            return False
        
        log("✓ login_type is correct: 'EMAIL'")
        
        # Step 5: CLEAN UP
        log("\nStep 5: CLEAN UP - Delete test user")
        cleanup_success = cleanup_user(conn, user_id)
        
        if not cleanup_success:
            log(f"✗ WARNING: Cleanup failed, leftover user_id={user_id}")
            log(f"  Manual cleanup required for: {email}")
        
        log("\n" + "="*80)
        log("TEST 2 - POSITIVE: ✓✓✓ PASSED ✓✓✓")
        log("="*80)
        return True
        
    except Exception as e:
        log(f"✗ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        
        # Attempt cleanup if we have a user_id
        if user_id:
            log(f"\nAttempting cleanup of user_id={user_id} after test failure...")
            cleanup_user(conn, user_id)
        
        return False
    finally:
        r.close()
        conn.close()

def main():
    """Run all tests"""
    log("="*80)
    log("DYNOPAY NAME CAPTURE FEATURE - BACKEND TESTS")
    log("="*80)
    log(f"Backend URL: {BACKEND_URL}")
    log(f"Redis URL: {REDIS_URL[:50]}...")
    log(f"Database URL: {DATABASE_URL[:50]}...")
    
    results = []
    
    # Run TEST 1 - NEGATIVE (primary, no side effects)
    test1_passed = test_negative_no_name()
    results.append(("TEST 1 - NEGATIVE (no name fields)", test1_passed))
    
    # Run TEST 2 - POSITIVE (creates and cleans up)
    test2_passed = test_positive_with_name()
    results.append(("TEST 2 - POSITIVE (with name fields)", test2_passed))
    
    # Summary
    log("\n" + "="*80)
    log("TEST SUMMARY")
    log("="*80)
    for test_name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        log(f"{status}: {test_name}")
    
    all_passed = all(passed for _, passed in results)
    
    if all_passed:
        log("\n✓✓✓ ALL TESTS PASSED ✓✓✓")
        return 0
    else:
        log("\n✗✗✗ SOME TESTS FAILED ✗✗✗")
        return 1

if __name__ == "__main__":
    sys.exit(main())
