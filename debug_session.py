#!/usr/bin/env python3
"""Debug script to check session is_current logic"""

import requests
import json

BASE_URL = "https://tokens-60.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"

# Get CSRF token
response = requests.get(f"{API_URL}/csrf-token")
csrf_token = response.json()["csrf_token"]
print(f"CSRF token: {csrf_token[:20]}...")

# Login
headers = {
    "Content-Type": "application/json",
    "x-csrf-token": csrf_token
}
payload = {"email": EMAIL, "password": PASSWORD}
response = requests.post(f"{API_URL}/user/login", headers=headers, json=payload)
data = response.json()["data"]
access_token = data["accessToken"]

print(f"\nAccess token: {access_token[:50]}...")
print(f"Access token length: {len(access_token)}")
print(f"Last 32 chars: {access_token[-32:]}")

# Get sessions
headers = {"Authorization": f"Bearer {access_token}"}
response = requests.get(f"{API_URL}/user/sessions", headers=headers)
sessions_data = response.json()["data"]["sessions"]

print(f"\nTotal sessions: {len(sessions_data)}")
print(f"\nFirst 3 sessions:")
for i, session in enumerate(sessions_data[:3]):
    print(f"\nSession {i+1}:")
    print(f"  session_id: {session['session_id']}")
    print(f"  is_current: {session['is_current']}")
    print(f"  created_at: {session['created_at']}")
    print(f"  ip_address: {session['ip_address']}")
    print(f"  device_name: {session['device_name']}")

# Count is_current
current_count = sum(1 for s in sessions_data if s.get('is_current') is True)
print(f"\nSessions with is_current=true: {current_count}")
