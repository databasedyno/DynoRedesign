#!/usr/bin/env python3
import requests
import json

BASE_URL = "https://dynopay-setup-5.preview.emergentagent.com"
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
    
    # Try different endpoints to find companies
    endpoints = [
        "/company/getCompany",
        "/company/list",
        "/company",
        "/user/profile"
    ]
    
    for endpoint in endpoints:
        print(f"\n--- Testing {endpoint} ---")
        try:
            resp = requests.get(
                f"{API_BASE}{endpoint}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=30
            )
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                print(f"Response: {json.dumps(data, indent=2)[:1000]}")
        except Exception as e:
            print(f"Error: {e}")
else:
    print(f"Login failed: {response.status_code}")
