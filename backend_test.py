#!/usr/bin/env python3
"""
Backend Test Script for DynoPay Split Name Fields Feature
Tests the "Split Name Fields" changes to ensure first_name and last_name columns
are properly captured and synchronized with the name field.
"""

import requests
import json
import time
import sys
import redis
import psycopg2
from urllib.parse import urlparse

# Configuration
BACKEND_URL = "http://localhost:8001"
REDIS_URL = "redis://default:HAEMJseUAdqAjpiICURxlefSoSYXKEUg@nozomi.proxy.rlwy.net:15794/1"
DATABASE_URL = "postgresql://postgres:IHCzCDslIsUZlzCvvjxfSWcChEiBtiCU@roundhouse.proxy.rlwy.net:23599/railway"

# Test data
TIMESTAMP = int(time.time())
NEGATIVE_TEST_EMAIL = f"namesplit_neg_{TIMESTAMP}@example.com"
POSITIVE_TEST_EMAIL = f"namesplit_pos_{TIMESTAMP}@example.com"

# Track created user IDs for cleanup
created_user_ids = []

def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def print_result(test_name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"    {details}")

def get_redis_connection():
    """Get Redis connection"""
    try:
        parsed = urlparse(REDIS_URL)
        r = redis.Redis(
            host=parsed.hostname,
            port=parsed.port,
            password=parsed.password,
            db=int(parsed.path.lstrip('/')) if parsed.path else 0,
            decode_responses=True
        )
        r.ping()
        return r
    except Exception as e:
        print(f"❌ Failed to connect to Redis: {e}")
        return None

def get_db_connection():
    """Get PostgreSQL connection"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return None

def test_health_check():
    """Test 0: Health check and schema verification"""
    print_section("TEST 0: HEALTH CHECK + SCHEMA VERIFICATION")
    
    # Health check
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        health_data = response.json()
        
        health_passed = (
            response.status_code == 200 and
            health_data.get("status") == "healthy" and
            health_data.get("database") == "connected" and
            health_data.get("redis") == "connected"
        )
        
        print_result(
            "Health endpoint",
            health_passed,
            f"Status: {health_data.get('status')}, DB: {health_data.get('database')}, Redis: {health_data.get('redis')}"
        )
        
        if not health_passed:
            return False
            
    except Exception as e:
        print_result("Health endpoint", False, f"Error: {e}")
        return False
    
    # Schema verification
    try:
        conn = get_db_connection()
        if not conn:
            return False
            
        cursor = conn.cursor()
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'tbl_user'
            AND column_name IN ('first_name', 'last_name')
            ORDER BY column_name;
        """)
        
        columns = cursor.fetchall()
        cursor.close()
        conn.close()
        
        has_first_name = any(col[0] == 'first_name' for col in columns)
        has_last_name = any(col[0] == 'last_name' for col in columns)
        
        schema_passed = has_first_name and has_last_name
        
        print_result(
            "Schema verification (first_name, last_name columns exist)",
            schema_passed,
            f"Columns found: {[col[0] for col in columns]}"
        )
        
        if columns:
            for col in columns:
                print(f"    - {col[0]}: {col[1]}, nullable: {col[2]}")
        
        return health_passed and schema_passed
        
    except Exception as e:
        print_result("Schema verification", False, f"Error: {e}")
        return False

def test_negative_case():
    """Test 1: NEGATIVE test - registration without name should fail"""
    print_section("TEST 1: NEGATIVE TEST (Side-effect-free, PRIMARY)")
    
    redis_conn = get_redis_connection()
    db_conn = get_db_connection()
    
    if not redis_conn or not db_conn:
        print("❌ Cannot proceed without Redis/DB connections")
        return False
    
    try:
        # Step 1: POST /api/user/registerEmail
        print(f"Step 1: Sending OTP to {NEGATIVE_TEST_EMAIL}...")
        response = requests.post(
            f"{BACKEND_URL}/api/user/registerEmail",
            json={"email": NEGATIVE_TEST_EMAIL},
            timeout=10
        )
        
        step1_passed = response.status_code == 200
        print_result(
            "POST /api/user/registerEmail",
            step1_passed,
            f"Status: {response.status_code}, Response: {response.json()}"
        )
        
        if not step1_passed:
            return False
        
        # Step 2: Read OTP from Redis
        print(f"\nStep 2: Reading OTP from Redis key 'otp:{NEGATIVE_TEST_EMAIL.lower()}:json'...")
        otp_key = f"otp:{NEGATIVE_TEST_EMAIL.lower()}:json"
        otp_data = redis_conn.get(otp_key)
        
        if not otp_data:
            print_result("Read OTP from Redis", False, "OTP not found in Redis")
            return False
        
        otp_json = json.loads(otp_data)
        otp = otp_json.get("otp")
        
        print_result(
            "Read OTP from Redis",
            bool(otp),
            f"OTP: {otp}"
        )
        
        if not otp:
            return False
        
        # Step 3: POST /api/user/registerEmail/verify-otp WITHOUT name
        print(f"\nStep 3: Verifying OTP WITHOUT name fields (should fail with 400)...")
        response = requests.post(
            f"{BACKEND_URL}/api/user/registerEmail/verify-otp",
            json={
                "email": NEGATIVE_TEST_EMAIL,
                "otp": otp
                # Intentionally NOT sending name, first_name, or last_name
            },
            timeout=10
        )
        
        # Should get 400 error
        verify_failed_correctly = response.status_code == 400
        response_data = response.json()
        error_message = response_data.get("message", "")
        
        has_name_error = "first" in error_message.lower() and "last" in error_message.lower() and "name" in error_message.lower()
        
        print_result(
            "POST /api/user/registerEmail/verify-otp (without name)",
            verify_failed_correctly and has_name_error,
            f"Status: {response.status_code}, Message: '{error_message}'"
        )
        
        if not (verify_failed_correctly and has_name_error):
            print(f"    ⚠️  Expected 400 with message about first and last name")
            return False
        
        # Step 4: Confirm NO tbl_user row exists
        print(f"\nStep 4: Confirming NO user was created in database...")
        cursor = db_conn.cursor()
        cursor.execute(
            "SELECT user_id FROM tbl_user WHERE email = %s",
            (NEGATIVE_TEST_EMAIL.lower(),)
        )
        user_row = cursor.fetchone()
        cursor.close()
        
        no_user_created = user_row is None
        
        print_result(
            "Confirm NO user created in database",
            no_user_created,
            f"User row: {user_row}"
        )
        
        return verify_failed_correctly and has_name_error and no_user_created
        
    except Exception as e:
        print_result("Negative test", False, f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if db_conn:
            db_conn.close()

def test_positive_case():
    """Test 2: POSITIVE test - registration with name, update, verify sync, cleanup"""
    print_section("TEST 2: POSITIVE TEST (CLEAN UP AFTER)")
    
    redis_conn = get_redis_connection()
    db_conn = get_db_connection()
    
    if not redis_conn or not db_conn:
        print("❌ Cannot proceed without Redis/DB connections")
        return False
    
    access_token = None
    user_id = None
    
    try:
        # Step 1: POST /api/user/registerEmail
        print(f"Step 1: Sending OTP to {POSITIVE_TEST_EMAIL}...")
        response = requests.post(
            f"{BACKEND_URL}/api/user/registerEmail",
            json={"email": POSITIVE_TEST_EMAIL},
            timeout=10
        )
        
        step1_passed = response.status_code == 200
        print_result(
            "POST /api/user/registerEmail",
            step1_passed,
            f"Status: {response.status_code}"
        )
        
        if not step1_passed:
            return False
        
        # Step 2: Read OTP from Redis
        print(f"\nStep 2: Reading OTP from Redis...")
        otp_key = f"otp:{POSITIVE_TEST_EMAIL.lower()}:json"
        otp_data = redis_conn.get(otp_key)
        
        if not otp_data:
            print_result("Read OTP from Redis", False, "OTP not found")
            return False
        
        otp_json = json.loads(otp_data)
        otp = otp_json.get("otp")
        
        print_result("Read OTP from Redis", bool(otp), f"OTP: {otp}")
        
        if not otp:
            return False
        
        # Step 3: POST /api/user/registerEmail/verify-otp WITH first_name and last_name
        print(f"\nStep 3: Verifying OTP WITH first_name='Ada', last_name='Lovelace'...")
        response = requests.post(
            f"{BACKEND_URL}/api/user/registerEmail/verify-otp",
            json={
                "email": POSITIVE_TEST_EMAIL,
                "otp": otp,
                "first_name": "Ada",
                "last_name": "Lovelace"
            },
            timeout=10
        )
        
        verify_passed = response.status_code == 200
        response_data = response.json()
        
        if verify_passed:
            access_token = response_data.get("data", {}).get("accessToken")
        
        print_result(
            "POST /api/user/registerEmail/verify-otp (with name)",
            verify_passed,
            f"Status: {response.status_code}, Has token: {bool(access_token)}"
        )
        
        if not verify_passed or not access_token:
            print(f"    Response: {response.text}")
            return False
        
        # Step 4: Query database to verify name fields
        print(f"\nStep 4: Querying database to verify name fields...")
        cursor = db_conn.cursor()
        cursor.execute(
            """
            SELECT user_id, name, first_name, last_name
            FROM tbl_user
            WHERE email = %s
            """,
            (POSITIVE_TEST_EMAIL.lower(),)
        )
        user_row = cursor.fetchone()
        cursor.close()
        
        if not user_row:
            print_result("Query user from database", False, "User not found")
            return False
        
        user_id, name, first_name, last_name = user_row
        created_user_ids.append(user_id)
        
        name_correct = name == "Ada Lovelace"
        first_name_correct = first_name == "Ada"
        last_name_correct = last_name == "Lovelace"
        
        all_correct = name_correct and first_name_correct and last_name_correct
        
        print_result(
            "Verify initial name fields in database",
            all_correct,
            f"user_id={user_id}, name='{name}', first_name='{first_name}', last_name='{last_name}'"
        )
        
        if not all_correct:
            print(f"    ⚠️  Expected: name='Ada Lovelace', first_name='Ada', last_name='Lovelace'")
            return False
        
        # Step 5: Update user with new name via PUT /api/user/updateUser
        print(f"\nStep 5: Updating user name to 'Grace Hopper' via PUT /api/user/updateUser...")
        
        # Create multipart/form-data with a single field "data" containing JSON
        files = {
            'data': (None, json.dumps({"name": "Grace Hopper"}), 'application/json')
        }
        
        response = requests.put(
            f"{BACKEND_URL}/api/user/updateUser",
            files=files,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10
        )
        
        update_passed = response.status_code == 200
        
        print_result(
            "PUT /api/user/updateUser",
            update_passed,
            f"Status: {response.status_code}"
        )
        
        if not update_passed:
            print(f"    Response: {response.text}")
            return False
        
        # Step 6: Re-query database to verify name sync
        print(f"\nStep 6: Re-querying database to verify name fields are synced...")
        cursor = db_conn.cursor()
        cursor.execute(
            """
            SELECT name, first_name, last_name
            FROM tbl_user
            WHERE user_id = %s
            """,
            (user_id,)
        )
        user_row = cursor.fetchone()
        cursor.close()
        
        if not user_row:
            print_result("Re-query user from database", False, "User not found")
            return False
        
        name, first_name, last_name = user_row
        
        name_correct = name == "Grace Hopper"
        first_name_correct = first_name == "Grace"
        last_name_correct = last_name == "Hopper"
        
        all_synced = name_correct and first_name_correct and last_name_correct
        
        print_result(
            "Verify updated name fields are synced",
            all_synced,
            f"name='{name}', first_name='{first_name}', last_name='{last_name}'"
        )
        
        if not all_synced:
            print(f"    ⚠️  Expected: name='Grace Hopper', first_name='Grace', last_name='Hopper'")
            return False
        
        # Step 7: Cleanup - DELETE the test user
        print(f"\nStep 7: Cleaning up - deleting test user (user_id={user_id})...")
        
        cursor = db_conn.cursor()
        
        # Delete child rows first (wallets, etc.)
        cursor.execute("DELETE FROM tbl_user_wallet WHERE user_id = %s", (user_id,))
        deleted_wallets = cursor.rowcount
        
        cursor.execute("DELETE FROM tbl_user_addresses WHERE user_id = %s", (user_id,))
        deleted_addresses = cursor.rowcount
        
        cursor.execute("DELETE FROM tbl_notification_preferences WHERE user_id = %s", (user_id,))
        deleted_prefs = cursor.rowcount
        
        cursor.execute("DELETE FROM tbl_user_session WHERE user_id = %s", (user_id,))
        deleted_sessions = cursor.rowcount
        
        # Delete the user
        cursor.execute("DELETE FROM tbl_user WHERE user_id = %s", (user_id,))
        deleted_user = cursor.rowcount
        
        db_conn.commit()
        cursor.close()
        
        cleanup_passed = deleted_user == 1
        
        print_result(
            "Delete test user and child rows",
            cleanup_passed,
            f"Deleted: user={deleted_user}, wallets={deleted_wallets}, addresses={deleted_addresses}, prefs={deleted_prefs}, sessions={deleted_sessions}"
        )
        
        if cleanup_passed:
            print(f"    ✅ Test user {user_id} successfully deleted from production database")
            created_user_ids.remove(user_id)
        
        return all_correct and all_synced and cleanup_passed
        
    except Exception as e:
        print_result("Positive test", False, f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if db_conn:
            db_conn.close()

def test_backend_logs():
    """Test 3: Check backend logs for errors"""
    print_section("TEST 3: BACKEND LOGS CHECK")
    
    try:
        import subprocess
        
        # Check error log
        print("Checking backend error log for registration-related errors...")
        result = subprocess.run(
            ["tail", "-n", "100", "/var/log/supervisor/backend.err.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        err_log = result.stdout
        
        # Filter for registration-related errors (exclude expected email errors)
        lines = err_log.split('\n')
        registration_errors = []
        
        for line in lines:
            if any(keyword in line.lower() for keyword in ['registeremail', 'verify-otp', 'nameutils', 'first_name', 'last_name']):
                if 'email' not in line.lower() or 'disable_outbound_email' not in line.lower():
                    if any(err in line.lower() for err in ['error', 'exception', 'crash', 'failed']):
                        registration_errors.append(line)
        
        no_errors = len(registration_errors) == 0
        
        print_result(
            "Backend error log check",
            no_errors,
            f"Registration-related errors found: {len(registration_errors)}"
        )
        
        if registration_errors:
            print("\n    Recent registration-related errors:")
            for err in registration_errors[-5:]:  # Show last 5
                print(f"    {err}")
        else:
            print("    ✅ No registration-related errors found (email send errors are expected and OK)")
        
        return no_errors
        
    except Exception as e:
        print_result("Backend logs check", False, f"Error: {e}")
        return False

def main():
    """Main test runner"""
    print("\n" + "="*80)
    print("  DynoPay Backend Test: Split Name Fields Feature")
    print("  Testing first_name and last_name column synchronization")
    print("="*80)
    
    print(f"\nTest Configuration:")
    print(f"  Backend URL: {BACKEND_URL}")
    print(f"  Negative test email: {NEGATIVE_TEST_EMAIL}")
    print(f"  Positive test email: {POSITIVE_TEST_EMAIL}")
    print(f"  Database: LIVE PRODUCTION (Railway)")
    print(f"  Redis: LIVE PRODUCTION (Railway)")
    print(f"  Safe Mode: ON (email disabled)")
    
    results = {}
    
    # Run tests
    results["health"] = test_health_check()
    
    if results["health"]:
        results["negative"] = test_negative_case()
        results["positive"] = test_positive_case()
        results["logs"] = test_backend_logs()
    else:
        print("\n❌ Health check failed, skipping remaining tests")
        results["negative"] = False
        results["positive"] = False
        results["logs"] = False
    
    # Summary
    print_section("TEST SUMMARY")
    
    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v)
    
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print()
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status}: {test_name.upper()}")
    
    # Cleanup check
    if created_user_ids:
        print(f"\n⚠️  WARNING: {len(created_user_ids)} test user(s) were NOT cleaned up:")
        for uid in created_user_ids:
            print(f"    - user_id: {uid}")
        print("    Please manually delete these users from the production database!")
    else:
        print("\n✅ All test users successfully cleaned up from production database")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n" + "="*80)
        print("  ✅✅✅ ALL TESTS PASSED ✅✅✅")
        print("="*80)
        return 0
    else:
        print("\n" + "="*80)
        print("  ❌ SOME TESTS FAILED")
        print("="*80)
        return 1

if __name__ == "__main__":
    sys.exit(main())
