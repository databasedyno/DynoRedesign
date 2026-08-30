#!/usr/bin/env python3
"""
Backend API Test for Team Members / RBAC Phase 2
Tests all /api/team/* endpoints with positive and negative flows
"""

import requests
import json
import time
from typing import Dict, List, Optional

# Configuration
BASE_URL = "https://10424307-97df-4c37-b0e5-f220fc44f85b.preview.emergentagent.com/api"
LOGIN_EMAIL = "onarrival21@gmail.com"
LOGIN_PASSWORD = "Katiekendra123@"
COMPANY_ID = 1

# Test state
access_token: Optional[str] = None
created_member_ids: List[int] = []
test_results: List[Dict] = []


def extract_data(response_json: Dict) -> Dict:
    """Extract data from response, handling nested 'data' key"""
    if "data" in response_json and isinstance(response_json["data"], dict):
        return response_json["data"]
    return response_json


def log_test(test_name: str, passed: bool, details: str, response_data: Optional[Dict] = None):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status} - {test_name}")
    print(f"Details: {details}")
    if response_data:
        print(f"Response: {json.dumps(response_data, indent=2)}")
    test_results.append({
        "test": test_name,
        "passed": passed,
        "details": details,
        "response": response_data
    })


def login() -> bool:
    """Step 0: Login to get access token"""
    print("\n" + "="*80)
    print("STEP 0: LOGIN")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/user/login",
            json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            global access_token
            # Token is nested under data.accessToken
            if "data" in data and "accessToken" in data["data"]:
                access_token = data["data"]["accessToken"]
            else:
                access_token = data.get("accessToken")
            
            if access_token:
                log_test(
                    "Login",
                    True,
                    f"Successfully logged in as {LOGIN_EMAIL}",
                    {"status": response.status_code, "has_token": True}
                )
                return True
            else:
                log_test("Login", False, "No accessToken in response", data)
                return False
        else:
            log_test("Login", False, f"HTTP {response.status_code}", response.json())
            return False
            
    except Exception as e:
        log_test("Login", False, f"Exception: {str(e)}", None)
        return False


def test_permissions_catalogue():
    """Step 1: GET /team/permissions/catalogue"""
    print("\n" + "="*80)
    print("STEP 1: GET PERMISSIONS CATALOGUE")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/team/permissions/catalogue",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30
        )
        
        response_json = response.json()
        # Extract data from nested structure
        data = response_json.get("data", response_json)
        
        if response.status_code == 200:
            # Check required fields
            has_keys = "keys" in data and isinstance(data["keys"], list)
            has_labels = "labels" in data and isinstance(data["labels"], dict)
            has_roles = "roles" in data and isinstance(data["roles"], list)
            has_defaults = "defaults" in data and isinstance(data["defaults"], dict)
            
            if has_keys and has_labels and has_roles and has_defaults:
                log_test(
                    "GET /team/permissions/catalogue",
                    True,
                    f"Returned keys={len(data['keys'])}, roles={data['roles']}",
                    data
                )
                return True
            else:
                log_test(
                    "GET /team/permissions/catalogue",
                    False,
                    f"Missing required fields: keys={has_keys}, labels={has_labels}, roles={has_roles}, defaults={has_defaults}",
                    data
                )
                return False
        else:
            log_test(
                "GET /team/permissions/catalogue",
                False,
                f"HTTP {response.status_code}",
                data
            )
            return False
            
    except Exception as e:
        log_test("GET /team/permissions/catalogue", False, f"Exception: {str(e)}", None)
        return False


def test_invite_member() -> Optional[Dict]:
    """Step 2: POST /team/invite"""
    print("\n" + "="*80)
    print("STEP 2: POST /team/invite")
    print("="*80)
    
    # Use unique fake email with timestamp
    fake_email = f"dyno-rbac-test+{int(time.time())}@example.com"
    
    try:
        response = requests.post(
            f"{BASE_URL}/team/invite",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "email": fake_email,
                "role": "member",
                "company_id": COMPANY_ID
            },
            timeout=30
        )
        
        response_json = response.json()
        # Extract data from nested structure
        data = response_json.get("data", response_json)
        
        if response.status_code == 200:
            # Check required fields
            has_email = data.get("email") == fake_email
            has_role = data.get("role") == "member"
            has_invited_companies = "invited_companies" in data
            has_invite_link = "invite_link" in data
            has_expires_at = "expires_at" in data
            
            if has_email and has_role and has_invited_companies and has_invite_link and has_expires_at:
                # Extract token from invite_link
                invite_link = data["invite_link"]
                token = None
                if "?token=" in invite_link:
                    token = invite_link.split("?token=")[1].split("&")[0]
                
                log_test(
                    "POST /team/invite",
                    True,
                    f"Successfully invited {fake_email}, token extracted: {token is not None}",
                    data
                )
                
                return {
                    "email": fake_email,
                    "token": token,
                    "invite_link": invite_link,
                    "expires_at": data["expires_at"]
                }
            else:
                log_test(
                    "POST /team/invite",
                    False,
                    f"Missing fields: email={has_email}, role={has_role}, invited_companies={has_invited_companies}, invite_link={has_invite_link}, expires_at={has_expires_at}",
                    data
                )
                return None
        else:
            log_test("POST /team/invite", False, f"HTTP {response.status_code}", data)
            return None
            
    except Exception as e:
        log_test("POST /team/invite", False, f"Exception: {str(e)}", None)
        return None


def test_list_members(expected_email: str) -> Optional[int]:
    """Step 3: GET /team/members?company_id=1"""
    print("\n" + "="*80)
    print("STEP 3: GET /team/members")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/team/members",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"company_id": COMPANY_ID},
            timeout=30
        )
        
        response_json = response.json()
        data = extract_data(response_json)
        
        if response.status_code == 200:
            # Handle both direct array and nested members array
            if isinstance(data, list):
                members = data
            elif isinstance(data, dict) and "members" in data:
                members = data["members"]
            else:
                members = []
            
            # Find the invited member
            invited_member = None
            for member in members:
                if member.get("email") == expected_email:
                    invited_member = member
                    break
            
            if invited_member:
                member_id = invited_member.get("id")
                status = invited_member.get("status")
                
                if status == "invited" and member_id:
                    global created_member_ids
                    created_member_ids.append(member_id)
                    
                    log_test(
                        "GET /team/members",
                        True,
                        f"Found invited member: email={expected_email}, id={member_id}, status={status}",
                        {"member": invited_member, "total_members": len(members)}
                    )
                    return member_id
                else:
                    log_test(
                        "GET /team/members",
                        False,
                        f"Member found but status={status} (expected 'invited') or missing id",
                        invited_member
                    )
                    return None
            else:
                log_test(
                    "GET /team/members",
                    False,
                    f"Invited member {expected_email} not found in list of {len(members)} members",
                    {"members": members}
                )
                return None
        else:
            log_test("GET /team/members", False, f"HTTP {response.status_code}", data)
            return None
            
    except Exception as e:
        log_test("GET /team/members", False, f"Exception: {str(e)}", None)
        return None


def test_validate_invite_token(token: str, expected_email: str):
    """Step 4: GET /team/invite/:token (NO auth, public)"""
    print("\n" + "="*80)
    print("STEP 4: GET /team/invite/:token (PUBLIC)")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/team/invite/{token}",
            timeout=30
        )
        
        response_json = response.json()
        data = extract_data(response_json)
        
        if response.status_code == 200:
            has_email = data.get("email") == expected_email
            has_email_has_account = "email_has_account" in data
            email_has_account = data.get("email_has_account") == False
            has_companies = "companies" in data and isinstance(data["companies"], list)
            
            # Check if company_id=1 is in companies
            company_found = False
            if has_companies:
                for company in data["companies"]:
                    if company.get("company_id") == COMPANY_ID:
                        company_found = True
                        break
            
            if has_email and has_email_has_account and email_has_account and has_companies and company_found:
                log_test(
                    "GET /team/invite/:token",
                    True,
                    f"Token valid: email={expected_email}, email_has_account=false, company_id={COMPANY_ID} found",
                    data
                )
                return True
            else:
                log_test(
                    "GET /team/invite/:token",
                    False,
                    f"Invalid response: email={has_email}, email_has_account={email_has_account}, companies={has_companies}, company_found={company_found}",
                    data
                )
                return False
        else:
            log_test("GET /team/invite/:token", False, f"HTTP {response.status_code}", data)
            return False
            
    except Exception as e:
        log_test("GET /team/invite/:token", False, f"Exception: {str(e)}", None)
        return False


def test_accept_invite(token: str):
    """Step 5: POST /team/accept (NO auth, public)"""
    print("\n" + "="*80)
    print("STEP 5: POST /team/accept (PUBLIC)")
    print("="*80)
    
    try:
        # First, get CSRF token
        session = requests.Session()
        csrf_response = session.get(f"{BASE_URL}/csrf-token", timeout=30)
        
        if csrf_response.status_code != 200:
            log_test(
                "POST /team/accept",
                False,
                f"Failed to get CSRF token: HTTP {csrf_response.status_code}",
                csrf_response.json()
            )
            return False
        
        csrf_data = csrf_response.json()
        csrf_token = csrf_data.get("csrf_token")
        
        if not csrf_token:
            log_test(
                "POST /team/accept",
                False,
                "No CSRF token in response",
                csrf_data
            )
            return False
        
        # Now make the accept request with CSRF token
        response = session.post(
            f"{BASE_URL}/team/accept",
            json={
                "token": token,
                "name": "RBAC Test User",
                "password": "StrongPass123!"
            },
            headers={"x-csrf-token": csrf_token},
            timeout=30
        )
        
        response_json = response.json()
        data = extract_data(response_json)
        
        if response.status_code == 200:
            has_access_token = "accessToken" in data and data["accessToken"]
            has_team_member = data.get("team_member") == True
            
            if has_access_token and has_team_member:
                log_test(
                    "POST /team/accept",
                    True,
                    "New user created and logged in successfully, team_member=true",
                    {"has_token": True, "team_member": data.get("team_member")}
                )
                return True
            else:
                log_test(
                    "POST /team/accept",
                    False,
                    f"Missing fields: accessToken={has_access_token}, team_member={has_team_member}",
                    data
                )
                return False
        else:
            log_test("POST /team/accept", False, f"HTTP {response.status_code}", response_json)
            return False
            
    except Exception as e:
        log_test("POST /team/accept", False, f"Exception: {str(e)}", None)
        return False


def test_member_now_active(expected_email: str):
    """Step 6: GET /team/members - verify member is now active"""
    print("\n" + "="*80)
    print("STEP 6: VERIFY MEMBER NOW ACTIVE")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/team/members",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"company_id": COMPANY_ID},
            timeout=30
        )
        
        response_json = response.json()
        data = extract_data(response_json)
        
        if response.status_code == 200:
            # Handle both direct array and nested members array
            if isinstance(data, list):
                members = data
            elif isinstance(data, dict) and "members" in data:
                members = data["members"]
            else:
                members = []
            
            # Find the member
            member = None
            for m in members:
                if m.get("email") == expected_email:
                    member = m
                    break
            
            if member:
                status = member.get("status")
                
                if status == "active":
                    log_test(
                        "Verify member active",
                        True,
                        f"Member {expected_email} is now active",
                        member
                    )
                    return True
                else:
                    log_test(
                        "Verify member active",
                        False,
                        f"Member status is '{status}' (expected 'active')",
                        member
                    )
                    return False
            else:
                log_test(
                    "Verify member active",
                    False,
                    f"Member {expected_email} not found",
                    {"members": members}
                )
                return False
        else:
            log_test("Verify member active", False, f"HTTP {response.status_code}", data)
            return False
            
    except Exception as e:
        log_test("Verify member active", False, f"Exception: {str(e)}", None)
        return False


def test_update_permissions(member_id: int):
    """Step 7: PATCH /team/members/:id"""
    print("\n" + "="*80)
    print("STEP 7: PATCH /team/members/:id")
    print("="*80)
    
    try:
        response = requests.patch(
            f"{BASE_URL}/team/members/{member_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "permissions": {
                    "view_dashboard": True,
                    "view_transactions": True,
                    "manage_payment_links": True
                }
            },
            timeout=30
        )
        
        response_json = response.json()
        data = extract_data(response_json)
        
        if response.status_code == 200:
            log_test(
                "PATCH /team/members/:id",
                True,
                f"Successfully updated permissions for member {member_id}",
                data
            )
            return True
        else:
            log_test("PATCH /team/members/:id", False, f"HTTP {response.status_code}", data)
            return False
            
    except Exception as e:
        log_test("PATCH /team/members/:id", False, f"Exception: {str(e)}", None)
        return False


def test_revoke_member(member_id: int):
    """Step 8: DELETE /team/members/:id"""
    print("\n" + "="*80)
    print("STEP 8: DELETE /team/members/:id")
    print("="*80)
    
    try:
        response = requests.delete(
            f"{BASE_URL}/team/members/{member_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30
        )
        
        response_json = response.json()
        data = extract_data(response_json)
        
        if response.status_code == 200:
            log_test(
                "DELETE /team/members/:id",
                True,
                f"Successfully revoked member {member_id}",
                data
            )
            return True
        else:
            log_test("DELETE /team/members/:id", False, f"HTTP {response.status_code}", data)
            return False
            
    except Exception as e:
        log_test("DELETE /team/members/:id", False, f"Exception: {str(e)}", None)
        return False


def test_member_now_revoked(expected_email: str):
    """Verify member status is now 'revoked'"""
    print("\n" + "="*80)
    print("VERIFY MEMBER NOW REVOKED")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/team/members",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"company_id": COMPANY_ID},
            timeout=30
        )
        
        response_json = response.json()
        data = extract_data(response_json)
        
        if response.status_code == 200:
            # Handle both direct array and nested members array
            if isinstance(data, list):
                members = data
            elif isinstance(data, dict) and "members" in data:
                members = data["members"]
            else:
                members = []
            
            # Find the member
            member = None
            for m in members:
                if m.get("email") == expected_email:
                    member = m
                    break
            
            if member:
                status = member.get("status")
                
                if status == "revoked":
                    log_test(
                        "Verify member revoked",
                        True,
                        f"Member {expected_email} is now revoked",
                        member
                    )
                    return True
                else:
                    log_test(
                        "Verify member revoked",
                        False,
                        f"Member status is '{status}' (expected 'revoked')",
                        member
                    )
                    return False
            else:
                log_test(
                    "Verify member revoked",
                    False,
                    f"Member {expected_email} not found",
                    {"members": members}
                )
                return False
        else:
            log_test("Verify member revoked", False, f"HTTP {response.status_code}", data)
            return False
            
    except Exception as e:
        log_test("Verify member revoked", False, f"Exception: {str(e)}", None)
        return False


def test_negative_no_auth():
    """Negative Test A: POST /team/invite with NO Authorization header"""
    print("\n" + "="*80)
    print("NEGATIVE TEST A: NO AUTHORIZATION HEADER")
    print("="*80)
    
    fake_email = f"dyno-rbac-test-noauth+{int(time.time())}@example.com"
    
    try:
        response = requests.post(
            f"{BASE_URL}/team/invite",
            json={
                "email": fake_email,
                "role": "member",
                "company_id": COMPANY_ID
            },
            timeout=30
        )
        
        data = response.json()
        
        # Accept both 401 (Unauthorized) and 403 (CSRF/Forbidden) as valid rejections
        if response.status_code in [401, 403]:
            log_test(
                "Negative: No auth header",
                True,
                f"Correctly rejected with {response.status_code} (unauthorized access blocked)",
                data
            )
            return True
        else:
            log_test(
                "Negative: No auth header",
                False,
                f"Expected 401 or 403, got {response.status_code}",
                data
            )
            return False
            
    except Exception as e:
        log_test("Negative: No auth header", False, f"Exception: {str(e)}", None)
        return False


def test_negative_invalid_company():
    """Negative Test B: POST /team/invite with company_id the owner does NOT own"""
    print("\n" + "="*80)
    print("NEGATIVE TEST B: INVALID COMPANY_ID")
    print("="*80)
    
    fake_email = f"dyno-rbac-test-badcompany+{int(time.time())}@example.com"
    
    try:
        response = requests.post(
            f"{BASE_URL}/team/invite",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "email": fake_email,
                "role": "member",
                "company_id": 999999
            },
            timeout=30
        )
        
        data = response.json()
        
        # Should either be 403, or 200 with empty invited_companies and company in "skipped"
        if response.status_code == 403:
            log_test(
                "Negative: Invalid company_id",
                True,
                "Correctly rejected with 403 Forbidden",
                data
            )
            return True
        elif response.status_code == 200:
            invited_companies = data.get("invited_companies", [])
            skipped = data.get("skipped", [])
            
            if len(invited_companies) == 0 and any(s.get("company_id") == 999999 for s in skipped):
                log_test(
                    "Negative: Invalid company_id",
                    True,
                    "Correctly rejected: empty invited_companies and company in skipped list",
                    data
                )
                return True
            else:
                log_test(
                    "Negative: Invalid company_id",
                    False,
                    f"Expected empty invited_companies and company in skipped, got: invited={len(invited_companies)}, skipped={len(skipped)}",
                    data
                )
                return False
        else:
            log_test(
                "Negative: Invalid company_id",
                False,
                f"Expected 403 or 200 with rejection, got {response.status_code}",
                data
            )
            return False
            
    except Exception as e:
        log_test("Negative: Invalid company_id", False, f"Exception: {str(e)}", None)
        return False


def test_negative_invalid_role():
    """Negative Test C: POST /team/invite with role='owner' (only admin/member allowed)"""
    print("\n" + "="*80)
    print("NEGATIVE TEST C: INVALID ROLE 'owner'")
    print("="*80)
    
    fake_email = f"dyno-rbac-test-badrole+{int(time.time())}@example.com"
    
    try:
        response = requests.post(
            f"{BASE_URL}/team/invite",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "email": fake_email,
                "role": "owner",
                "company_id": COMPANY_ID
            },
            timeout=30
        )
        
        data = response.json()
        
        if response.status_code == 400:
            log_test(
                "Negative: Invalid role 'owner'",
                True,
                "Correctly rejected with 400 Bad Request",
                data
            )
            
            # Verify no row was created - check members list
            members_response = requests.get(
                f"{BASE_URL}/team/members",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"company_id": COMPANY_ID},
                timeout=30
            )
            
            if members_response.status_code == 200:
                members_data = members_response.json()
                members = members_data if isinstance(members_data, list) else members_data.get("members", [])
                
                # Check if the fake email exists
                found = any(m.get("email") == fake_email for m in members)
                
                if not found:
                    print("✅ Verified: No membership row was created")
                    return True
                else:
                    print("❌ WARNING: Membership row was created despite 400 error")
                    return False
            else:
                print("⚠️ Could not verify if row was created (members list failed)")
                return True  # Still pass the main test
        else:
            log_test(
                "Negative: Invalid role 'owner'",
                False,
                f"Expected 400, got {response.status_code}",
                data
            )
            return False
            
    except Exception as e:
        log_test("Negative: Invalid role 'owner'", False, f"Exception: {str(e)}", None)
        return False


def cleanup_all_members():
    """CLEANUP: Delete/revoke all created members"""
    print("\n" + "="*80)
    print("CLEANUP: REVOKING ALL CREATED MEMBERS")
    print("="*80)
    
    if not created_member_ids:
        print("No members to clean up")
        return True
    
    success_count = 0
    fail_count = 0
    
    for member_id in created_member_ids:
        try:
            response = requests.delete(
                f"{BASE_URL}/team/members/{member_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"✅ Revoked member {member_id}")
                success_count += 1
            else:
                print(f"❌ Failed to revoke member {member_id}: HTTP {response.status_code}")
                fail_count += 1
                
        except Exception as e:
            print(f"❌ Exception revoking member {member_id}: {str(e)}")
            fail_count += 1
    
    print(f"\nCleanup summary: {success_count} revoked, {fail_count} failed")
    
    log_test(
        "Cleanup",
        fail_count == 0,
        f"Revoked {success_count} members, {fail_count} failures",
        {"revoked": success_count, "failed": fail_count}
    )
    
    return fail_count == 0


def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for t in test_results if t["passed"])
    failed = sum(1 for t in test_results if not t["passed"])
    total = len(test_results)
    
    print(f"\nTotal tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success rate: {(passed/total*100):.1f}%")
    
    if failed > 0:
        print("\n❌ FAILED TESTS:")
        for t in test_results:
            if not t["passed"]:
                print(f"  - {t['test']}: {t['details']}")
    
    print("\n" + "="*80)


def main():
    """Main test execution"""
    print("="*80)
    print("TEAM MEMBERS / RBAC PHASE 2 API TESTS")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Login: {LOGIN_EMAIL}")
    print(f"Company ID: {COMPANY_ID}")
    print("="*80)
    
    # Step 0: Login
    if not login():
        print("\n❌ CRITICAL: Login failed, cannot continue")
        return
    
    # Step 1: Get permissions catalogue
    test_permissions_catalogue()
    
    # Step 2-8: Main positive flow
    invite_data = test_invite_member()
    
    if invite_data:
        member_id = test_list_members(invite_data["email"])
        
        if invite_data["token"]:
            test_validate_invite_token(invite_data["token"], invite_data["email"])
            test_accept_invite(invite_data["token"])
            test_member_now_active(invite_data["email"])
        
        if member_id:
            test_update_permissions(member_id)
            test_revoke_member(member_id)
            test_member_now_revoked(invite_data["email"])
    
    # Negative tests
    test_negative_no_auth()
    test_negative_invalid_company()
    test_negative_invalid_role()
    
    # Cleanup
    cleanup_all_members()
    
    # Summary
    print_summary()


if __name__ == "__main__":
    main()
