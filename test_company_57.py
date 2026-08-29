#!/usr/bin/env python3
import requests
import json

BASE_URL = "https://crypto-payment-init-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Login first
response = requests.post(
    f"{API_BASE}/user/login",
    json={"email": "hostbay@moxx.co", "password": "Katiekendra123@"},
    headers={"Content-Type": "application/json"},
    timeout=30
)

if response.status_code == 200:
    data = response.json()
    token = data["data"]["accessToken"]
    print(f"✓ Logged in successfully")
    
    # Test company_id 57 (from last_company_id in profile)
    print(f"\n--- Testing recent-transactions with company_id=57 ---")
    resp = requests.get(
        f"{API_BASE}/dashboard/recent-transactions",
        params={"company_id": 57},
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
    
    # Test company_id 1 (known owned company)
    print(f"\n--- Testing recent-transactions with company_id=1 ---")
    resp = requests.get(
        f"{API_BASE}/dashboard/recent-transactions",
        params={"company_id": 1},
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    print(f"Status: {resp.status_code}")
    data = resp.json()
    print(f"Response keys: {list(data.keys())}")
    if "data" in data:
        print(f"Transactions count: {len(data['data']) if isinstance(data['data'], list) else 'N/A'}")
        if isinstance(data['data'], list) and len(data['data']) > 0:
            print(f"First transaction keys: {list(data['data'][0].keys())}")
            print(f"First transaction: {json.dumps(data['data'][0], indent=2)[:500]}")
else:
    print(f"Login failed: {response.status_code}")
