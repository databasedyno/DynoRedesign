#!/usr/bin/env python3
import requests
import json

BASE_URL = "https://merchant-demo-4.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Login
response = requests.post(
    f"{API_BASE}/user/login",
    json={"email": "hostbay@moxx.co", "password": "Katiekendra123@"},
    headers={"Content-Type": "application/json"},
    timeout=30
)

token = response.json()["data"]["accessToken"]

# Test recent-transactions with company_id=1
print("=== Testing recent-transactions with company_id=1 ===")
resp = requests.get(
    f"{API_BASE}/dashboard/recent-transactions",
    params={"company_id": 1},
    headers={"Authorization": f"Bearer {token}"},
    timeout=30
)
print(f"Status: {resp.status_code}")
data = resp.json()
print(f"Full response:\n{json.dumps(data, indent=2)}")

# Also test the main dashboard endpoint to see structure
print("\n=== Testing /dashboard with company_id=1 ===")
resp = requests.get(
    f"{API_BASE}/dashboard",
    params={"company_id": 1},
    headers={"Authorization": f"Bearer {token}"},
    timeout=30
)
print(f"Status: {resp.status_code}")
data = resp.json()
print(f"Dashboard response keys: {list(data.keys())}")
if "data" in data:
    print(f"Dashboard data keys: {list(data['data'].keys()) if isinstance(data['data'], dict) else 'N/A'}")
