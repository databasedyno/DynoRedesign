#!/usr/bin/env python3
"""
Test script to verify invoice PDF logo quality fix.
Tests the fix: logo upgraded from 180×60 px to 1888×656 px with fit: [120,42]
"""

import requests
import json
import redis
import sys
import time

BASE_URL = "https://crypto-payment-hub-32.preview.emergentagent.com/api"
REDIS_URL = "redis://default:HAEMJseUAdqAjpiICURxlefSoSYXKEUg@nozomi.proxy.rlwy.net:15794"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json"
}

# Test credentials
CREDENTIALS = [
    {"email": "hostbay@moxx.co", "password": "Katiekendra123@"},
    {"email": "qa.onboard.1782585233@dynopaytest.com", "password": "QaOnboard#2026"}
]

def connect_redis():
    """Connect to Redis"""
    try:
        r = redis.from_url(REDIS_URL, decode_responses=True)
        r.ping()
        print("✅ Redis connection successful")
        return r
    except Exception as e:
        print(f"❌ Redis connection failed: {e}")
        return None

def login_step1(email, password):
    """Step 1: POST /api/user/login to get session_id"""
    url = f"{BASE_URL}/user/login"
    payload = {"email": email, "password": password}
    
    print(f"\n🔐 Step 1: Logging in as {email}...")
    try:
        response = requests.post(url, json=payload, headers=HEADERS, timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Look for session_id or loginToken or login_otp_session
            session_id = None
            if 'data' in data:
                session_id = (data['data'].get('session_id') or 
                             data['data'].get('loginToken') or 
                             data['data'].get('sessionId') or
                             data['data'].get('login_otp_session'))
            if not session_id and 'session_id' in data:
                session_id = data['session_id']
            if not session_id and 'loginToken' in data:
                session_id = data['loginToken']
            if not session_id and 'login_otp_session' in data:
                session_id = data['login_otp_session']
                
            return session_id
        else:
            print(f"   Error: {response.text}")
            return None
    except Exception as e:
        print(f"   Exception: {e}")
        return None

def get_otp_from_redis(redis_client, session_id):
    """Step 2: Get OTP from Redis"""
    print(f"\n🔑 Step 2: Fetching OTP from Redis...")
    
    # Try different key patterns
    key_patterns = [
        f"login_otp:{session_id}:json",
        f"login_otp:{session_id}",
        f"otp:{session_id}:json",
        f"otp:{session_id}"
    ]
    
    for key in key_patterns:
        try:
            value = redis_client.get(key)
            if value:
                print(f"   Found OTP at key: {key}")
                print(f"   Value: {value}")
                
                # Try to parse as JSON
                try:
                    data = json.loads(value)
                    otp = data.get('otp') or data.get('code')
                    if otp:
                        print(f"   ✅ OTP extracted: {otp}")
                        return otp
                except:
                    # Maybe it's just the OTP string
                    if value.isdigit() and len(value) == 6:
                        print(f"   ✅ OTP (plain): {value}")
                        return value
        except Exception as e:
            print(f"   Error checking key {key}: {e}")
    
    print("   ❌ OTP not found in Redis")
    return None

def verify_login_otp(session_id, otp):
    """Step 3: POST /api/user/verifyLoginOTP to get Bearer token"""
    url = f"{BASE_URL}/user/verifyLoginOTP"
    # Try different parameter combinations
    payload = {"login_otp_session": session_id, "otp": otp}
    
    print(f"\n✅ Step 3: Verifying OTP...")
    try:
        response = requests.post(url, json=payload, headers=HEADERS, timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response keys: {list(data.keys())}")
            
            # Look for accessToken
            access_token = None
            if 'data' in data:
                access_token = data['data'].get('accessToken')
            if not access_token and 'accessToken' in data:
                access_token = data['accessToken']
            
            if access_token:
                print(f"   ✅ Access token obtained (length: {len(access_token)})")
                return access_token
            else:
                print(f"   ❌ No accessToken in response: {json.dumps(data, indent=2)}")
                return None
        else:
            print(f"   Error: {response.text}")
            return None
    except Exception as e:
        print(f"   Exception: {e}")
        return None

def get_invoices(access_token):
    """GET /api/invoices?limit=5"""
    url = f"{BASE_URL}/invoices?limit=5"
    headers = {**HEADERS, "Authorization": f"Bearer {access_token}"}
    
    print(f"\n📄 Step 4: Fetching invoices...")
    try:
        response = requests.get(url, headers=headers, timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)[:500]}...")
            
            # Look for invoices in data
            invoices = []
            if 'data' in data:
                if isinstance(data['data'], list):
                    invoices = data['data']
                elif isinstance(data['data'], dict) and 'invoices' in data['data']:
                    invoices = data['data']['invoices']
            elif 'invoices' in data:
                invoices = data['invoices']
            elif isinstance(data, list):
                invoices = data
            
            if invoices and len(invoices) > 0:
                # Get first invoice ID
                invoice = invoices[0]
                invoice_id = invoice.get('invoice_id') or invoice.get('id')
                print(f"   ✅ Found {len(invoices)} invoice(s)")
                print(f"   First invoice ID: {invoice_id}")
                return invoice_id
            else:
                print(f"   ❌ No invoices found")
                return None
        else:
            print(f"   Error: {response.text}")
            return None
    except Exception as e:
        print(f"   Exception: {e}")
        return None

def download_pdf(access_token, invoice_id):
    """GET /api/invoices/{id}/pdf"""
    url = f"{BASE_URL}/invoices/{invoice_id}/pdf"
    headers = {**HEADERS, "Authorization": f"Bearer {access_token}"}
    
    print(f"\n📥 Step 5: Downloading PDF for invoice {invoice_id}...")
    try:
        response = requests.get(url, headers=headers, timeout=30)
        print(f"   Status: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('Content-Type')}")
        print(f"   Content-Length: {len(response.content)} bytes")
        
        if response.status_code == 200:
            # Check PDF magic bytes
            first_bytes = response.content[:8]
            print(f"   First 8 bytes (hex): {first_bytes.hex()}")
            print(f"   First 8 bytes (ascii): {first_bytes[:4].decode('ascii', errors='ignore')}")
            
            # Verify it's a PDF
            if response.content[:4] == b'%PDF':
                print(f"   ✅ Valid PDF file")
                
                # Save to file
                output_path = f"/tmp/test_invoice_{invoice_id}.pdf"
                with open(output_path, 'wb') as f:
                    f.write(response.content)
                print(f"   ✅ Saved to: {output_path}")
                
                # Verify file size
                if len(response.content) > 5000:
                    print(f"   ✅ File size > 5KB (sanity check passed)")
                    return output_path
                else:
                    print(f"   ⚠️  File size < 5KB (may be incomplete)")
                    return output_path
            else:
                print(f"   ❌ Not a valid PDF file")
                print(f"   Response: {response.text[:500]}")
                return None
        else:
            print(f"   Error: {response.text}")
            return None
    except Exception as e:
        print(f"   Exception: {e}")
        return None

def main():
    print("=" * 80)
    print("INVOICE PDF LOGO QUALITY TEST")
    print("=" * 80)
    
    # Connect to Redis
    redis_client = connect_redis()
    if not redis_client:
        print("\n❌ FAIL: Cannot connect to Redis")
        sys.exit(1)
    
    # Try each credential
    access_token = None
    successful_email = None
    
    for cred in CREDENTIALS:
        email = cred['email']
        password = cred['password']
        
        print(f"\n{'=' * 80}")
        print(f"Trying account: {email}")
        print(f"{'=' * 80}")
        
        # Step 1: Login
        session_id = login_step1(email, password)
        if not session_id:
            print(f"❌ Login failed for {email}, trying next account...")
            continue
        
        # Step 2: Get OTP from Redis
        otp = get_otp_from_redis(redis_client, session_id)
        if not otp:
            print(f"❌ Could not get OTP for {email}, trying next account...")
            continue
        
        # Step 3: Verify OTP
        access_token = verify_login_otp(session_id, otp)
        if access_token:
            successful_email = email
            break
        else:
            print(f"❌ OTP verification failed for {email}, trying next account...")
    
    if not access_token:
        print("\n❌ FAIL: Could not login with any account")
        sys.exit(1)
    
    print(f"\n✅ Successfully logged in as: {successful_email}")
    
    # Step 4: Get invoices
    invoice_id = get_invoices(access_token)
    if not invoice_id:
        print("\n❌ FAIL: No invoices found for this user")
        print("   Recommendation: Try the other test account or create a test invoice")
        sys.exit(1)
    
    # Step 5: Download PDF
    pdf_path = download_pdf(access_token, invoice_id)
    if not pdf_path:
        print("\n❌ FAIL: Could not download PDF")
        sys.exit(1)
    
    print("\n" + "=" * 80)
    print("✅ PDF DOWNLOAD SUCCESSFUL")
    print("=" * 80)
    print(f"PDF saved to: {pdf_path}")
    print(f"Invoice ID: {invoice_id}")
    print(f"Account: {successful_email}")
    print("\nNext step: Run analyze_file_tool on the PDF to check logo quality")
    print("=" * 80)

if __name__ == "__main__":
    main()
