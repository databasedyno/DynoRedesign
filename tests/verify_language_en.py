"""Verify the live account language is restored to 'en' (read-only check)."""
import os
import requests
from dotenv import dotenv_values

env = dotenv_values("/app/.env")
BASE_URL = (os.environ.get("NEXT_PUBLIC_BASE_URL") or env.get("NEXT_PUBLIC_BASE_URL")
            or "https://dynopay-preview-13.preview.emergentagent.com").rstrip("/")

r = requests.post(f"{BASE_URL}/api/user/login",
                  json={"email": "hostbay@moxx.co", "password": "Katiekendra123@"}, timeout=60)
print("login", r.status_code)
data = r.json()
token = (data.get("data") or {}).get("accessToken") or data.get("accessToken")
p = requests.get(f"{BASE_URL}/api/user/profile",
                 headers={"Authorization": f"Bearer {token}"}, timeout=60)
print("profile", p.status_code)
pj = p.json()
lang = (pj.get("data") or {}).get("language") or pj.get("language")
print("LANGUAGE =", lang)
assert lang == "en", f"expected en, got {lang}"
print("PASS: account language restored to en")
