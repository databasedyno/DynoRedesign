#!/usr/bin/env python3
"""
Test remaining webhook endpoints after rate limit clears
"""

import requests
import json
import time

BACKEND_URL = "https://user-profile-split.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

TEST_USER = {
    "email": "hostbay@moxx.co",
    "password": "Katiekendra123@"
}

def get_csrf():
    resp = requests.get(f"{API_BASE}/csrf-token", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        return data.get("csrf_token") or data.get("csrfToken") or data.get("data", {}).get("csrf_token")
    return None

def login():
    csrf = get_csrf()
    resp = requests.post(
        f"{API_BASE}/user/login",
        json=TEST_USER,
        headers={"X-CSRF-Token": csrf} if csrf else {},
        timeout=15
    )
    if resp.status_code == 200:
        data = resp.json()
        return data.get("data", {}).get("accessToken") or data.get("accessToken")
    return None

print("Waiting for rate limit to clear (10 seconds)...")
time.sleep(10)

print("\n=== Test 1: Webhook Settings (GET) ===")
token = login()
if token:
    resp = requests.get(
        f"{API_BASE}/company/webhook-settings/1",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15
    )
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json().get("data", {})
        print(f"✅ webhook_disabled: {data.get('webhook_disabled')}")
        print(f"✅ webhook_disabled_at: {data.get('webhook_disabled_at')}")
        print(f"✅ webhook_disabled_reason: {data.get('webhook_disabled_reason')}")
    else:
        print(f"❌ Response: {resp.text[:200]}")
else:
    print("❌ Login failed")

time.sleep(2)

print("\n=== Test 2: Webhook Re-enable WITH CSRF ===")
csrf = get_csrf()
token = login()
if token and csrf:
    resp = requests.post(
        f"{API_BASE}/company/webhook-reenable/1",
        headers={"Authorization": f"Bearer {token}", "X-CSRF-Token": csrf},
        json={},
        timeout=15
    )
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        print(f"✅ Response: {resp.json()}")
    else:
        print(f"❌ Response: {resp.text[:200]}")
else:
    print("❌ Login or CSRF failed")

time.sleep(2)

print("\n=== Test 3: Webhook Re-enable WITHOUT CSRF (should return 403) ===")
token = login()
if token:
    resp = requests.post(
        f"{API_BASE}/company/webhook-reenable/1",
        headers={"Authorization": f"Bearer {token}"},
        json={},
        timeout=15
    )
    print(f"Status: {resp.status_code}")
    if resp.status_code == 403:
        print(f"✅ Correctly returned 403")
    else:
        print(f"❌ Expected 403, got {resp.status_code}: {resp.text[:200]}")
else:
    print("❌ Login failed")

time.sleep(2)

print("\n=== Test 4: Webhook Re-enable WITHOUT Auth (should return 401) ===")
csrf = get_csrf()
resp = requests.post(
    f"{API_BASE}/company/webhook-reenable/1",
    headers={"X-CSRF-Token": csrf} if csrf else {},
    json={},
    timeout=15
)
print(f"Status: {resp.status_code}")
if resp.status_code == 401:
    print(f"✅ Correctly returned 401")
else:
    print(f"❌ Expected 401, got {resp.status_code}: {resp.text[:200]}")

print("\n=== Test 5: Delete Non-existent Company (should return 404) ===")
csrf = get_csrf()
token = login()
if token:
    resp = requests.delete(
        f"{API_BASE}/company/deleteCompany/99999",
        headers={"Authorization": f"Bearer {token}", "X-CSRF-Token": csrf} if csrf else {"Authorization": f"Bearer {token}"},
        timeout=15
    )
    print(f"Status: {resp.status_code}")
    if resp.status_code == 404:
        print(f"✅ Correctly returned 404")
    else:
        print(f"❌ Expected 404, got {resp.status_code}: {resp.text[:200]}")
else:
    print("❌ Login failed")

print("\n=== Test 6: GET /api/company/getTransactions/1 (Fix D+E regression check) ===")
token = login()
if token:
    resp = requests.get(
        f"{API_BASE}/company/getTransactions/1",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15
    )
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"✅ Transactions endpoint working (no regression)")
    else:
        print(f"❌ Response: {resp.text[:200]}")
else:
    print("❌ Login failed")
