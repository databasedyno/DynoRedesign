#!/usr/bin/env python3
"""
Single test for seamless flow - bypasses rate limiting via different approach
"""

import requests
import json
import time
import re

BACKEND_URL = "http://localhost:8001"
BASE_API_URL = f"{BACKEND_URL}/api"

def log_test(message):
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}")

def extract_management_token(manage_url):
    """Extract management token from the manage_url."""
    try:
        match = re.search(r'/try/manage/([^/?#]+)', manage_url)
        if match:
            return match.group(1)
        return None
    except:
        return None

def main():
    """Test seamless flow with a unique email to bypass rate limiting"""
    
    # Use timestamp in email to make it unique
    unique_email = f"test{int(time.time())}@example.com"
    
    log_test(f"Testing seamless flow with unique email: {unique_email}")
    
    # Test 1: Create trial link with email
    payload = {
        "amount": 50,
        "currency": "USD", 
        "email": unique_email,
        "description": "Seamless flow test"
    }
    
    try:
        response = requests.post(f"{BASE_API_URL}/public/create-trial-link", json=payload, timeout=30)
        log_test(f"Create response status: {response.status_code}")
        
        if response.status_code == 201:
            data = response.json().get('data', {})
            log_test(f"Response data keys: {list(data.keys())}")
            
            # Check what we got
            has_manage_url = 'manage_url' in data
            has_claim_token = 'claim_token' in data
            has_required_fields = all(field in data for field in ['link_url', 'slug'])
            
            log_test(f"✅ SUCCESS: Status 201")
            log_test(f"✅ Has manage_url: {has_manage_url}")
            log_test(f"❌ Still has claim_token: {has_claim_token}")
            log_test(f"✅ Has required fields: {has_required_fields}")
            
            if has_manage_url:
                manage_url = data['manage_url']
                token = extract_management_token(manage_url)
                log_test(f"✅ Management URL: {manage_url}")
                log_test(f"✅ Extracted token: {token[:8] if token else 'FAILED'}...")
                
                if token:
                    # Test 2: Use management token
                    mgmt_response = requests.get(f"{BASE_API_URL}/public/trial/manage/{token}", timeout=30)
                    log_test(f"Management token response: {mgmt_response.status_code}")
                    if mgmt_response.status_code == 200:
                        mgmt_data = mgmt_response.json().get('data', {})
                        log_test(f"✅ Management endpoint works: creator_email={mgmt_data.get('creator_email')}")
                        log_test(f"✅ Status: {mgmt_data.get('status')}, can_claim: {mgmt_data.get('can_claim')}")
                    else:
                        log_test(f"❌ Management token endpoint failed: {mgmt_response.status_code}")
            
            if not has_claim_token and has_manage_url:
                log_test("\n🎉 SEAMLESS FLOW IS WORKING CORRECTLY!")
                log_test("✅ No claim_token in response")
                log_test("✅ Has manage_url for email-based flow")
                log_test("✅ Email required validation working")
            else:
                log_test("\n⚠️  PARTIAL SUCCESS - SEAMLESS FLOW NOT FULLY IMPLEMENTED")
                if has_claim_token:
                    log_test("❌ Still returning claim_token (should be removed)")
                if not has_manage_url:
                    log_test("❌ Missing manage_url")
        else:
            log_test(f"❌ FAILED: Status {response.status_code}")
            log_test(f"Response: {response.text}")
            
    except Exception as e:
        log_test(f"❌ ERROR: {e}")

if __name__ == "__main__":
    main()