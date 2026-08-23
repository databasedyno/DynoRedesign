#!/usr/bin/env python3
"""
STRICTLY READ-ONLY backend verification for DynoPay email-image fix.
Tests against LIVE Railway PRODUCTION database in SAFE MODE.
DO NOT log in, DO NOT mutate data, DO NOT trigger emails or payments.
Only performs GET requests to public/static endpoints and /health.
"""

import requests
import sys
from typing import Dict, List, Tuple

# Backend base URL (external)
BASE_URL = "https://c1eb6151-3c7a-435a-8a42-15de110bfc9d.preview.emergentagent.com"

def test_email_brand_logo() -> Tuple[bool, str]:
    """
    Test 1: Email brand logo asset
    GET /api/static/dynopay-email-logo.png
    PASS if HTTP 200 AND Content-Type is image/png AND body size > 0
    """
    url = f"{BASE_URL}/api/static/dynopay-email-logo.png"
    try:
        response = requests.get(url, timeout=10)
        status = response.status_code
        content_type = response.headers.get('Content-Type', '')
        body_size = len(response.content)
        
        if status == 200 and 'image/png' in content_type and body_size > 0:
            return True, f"✅ PASS - Status: {status}, Content-Type: {content_type}, Size: {body_size} bytes"
        else:
            return False, f"❌ FAIL - Status: {status}, Content-Type: {content_type}, Size: {body_size} bytes"
    except Exception as e:
        return False, f"❌ ERROR - {str(e)}"

def test_email_social_icons() -> Tuple[bool, str, List[Dict]]:
    """
    Test 2: Email social icon assets (5 files)
    GET /api/static/email/{facebook,instagram,x,linkedin,telegram}.png
    PASS if EACH returns HTTP 200 AND Content-Type image/png AND body size > 0
    """
    icons = ['facebook', 'instagram', 'x', 'linkedin', 'telegram']
    results = []
    all_pass = True
    
    for icon in icons:
        url = f"{BASE_URL}/api/static/email/{icon}.png"
        try:
            response = requests.get(url, timeout=10)
            status = response.status_code
            content_type = response.headers.get('Content-Type', '')
            body_size = len(response.content)
            
            passed = status == 200 and 'image/png' in content_type and body_size > 0
            if not passed:
                all_pass = False
            
            results.append({
                'icon': icon,
                'url': url,
                'status': status,
                'content_type': content_type,
                'size': body_size,
                'passed': passed
            })
        except Exception as e:
            all_pass = False
            results.append({
                'icon': icon,
                'url': url,
                'error': str(e),
                'passed': False
            })
    
    summary = "✅ PASS - All 5 social icons" if all_pass else "❌ FAIL - Some social icons failed"
    return all_pass, summary, results

def test_old_white_logo() -> Tuple[bool, str]:
    """
    Test 3: Regression check - OLD white-transparent logo should still serve
    GET /api/static/dynopay-white-logo.png
    PASS if HTTP 200 AND Content-Type image/png
    """
    url = f"{BASE_URL}/api/static/dynopay-white-logo.png"
    try:
        response = requests.get(url, timeout=10)
        status = response.status_code
        content_type = response.headers.get('Content-Type', '')
        body_size = len(response.content)
        
        if status == 200 and 'image/png' in content_type and body_size > 0:
            return True, f"✅ PASS - Status: {status}, Content-Type: {content_type}, Size: {body_size} bytes"
        else:
            return False, f"❌ FAIL - Status: {status}, Content-Type: {content_type}, Size: {body_size} bytes"
    except Exception as e:
        return False, f"❌ ERROR - {str(e)}"

def test_health_endpoint() -> Tuple[bool, str, Dict]:
    """
    Test 4: Health endpoint
    GET /health (via localhost:8001 since external ingress doesn't expose root-level endpoints)
    PASS if JSON status == "healthy", database == "connected", redis == "connected",
    and background_jobs.eligible == false (confirms SAFE MODE - this is REQUIRED, false is correct)
    """
    # The /health endpoint is defined at root level in server.ts but not accessible via external URL
    # due to Kubernetes ingress rules (only /api/* routes are exposed). Test via localhost instead.
    url = "http://localhost:8001/health"
    try:
        response = requests.get(url, timeout=10)
        status = response.status_code
        
        if status != 200:
            return False, f"❌ FAIL - HTTP {status}", {}
        
        data = response.json()
        
        # Check required fields
        checks = {
            'status': data.get('status') == 'healthy',
            'database': data.get('database') == 'connected',
            'redis': data.get('redis') == 'connected',
            'safe_mode': data.get('background_jobs', {}).get('eligible') == False
        }
        
        all_pass = all(checks.values())
        
        if all_pass:
            return True, "✅ PASS - All health checks passed (SAFE MODE confirmed)", data
        else:
            failed = [k for k, v in checks.items() if not v]
            return False, f"❌ FAIL - Failed checks: {', '.join(failed)}", data
    except Exception as e:
        return False, f"❌ ERROR - {str(e)}", {}

def main():
    print("=" * 80)
    print("STRICTLY READ-ONLY Backend Verification - DynoPay Email Image Fix")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print("SAFETY: LIVE Railway PROD DB in SAFE MODE - READ-ONLY")
    print("=" * 80)
    print()
    
    all_tests_passed = True
    
    # Test 1: Email brand logo
    print("Test 1: Email brand logo asset")
    print("-" * 80)
    passed, message = test_email_brand_logo()
    print(f"URL: {BASE_URL}/api/static/dynopay-email-logo.png")
    print(message)
    print()
    if not passed:
        all_tests_passed = False
    
    # Test 2: Email social icons
    print("Test 2: Email social icon assets (5 files)")
    print("-" * 80)
    passed, summary, results = test_email_social_icons()
    print(summary)
    for result in results:
        icon = result['icon']
        if result.get('passed'):
            print(f"  {icon:12} ✅ Status: {result['status']}, Content-Type: {result['content_type']}, Size: {result['size']} bytes")
        elif 'error' in result:
            print(f"  {icon:12} ❌ ERROR: {result['error']}")
        else:
            print(f"  {icon:12} ❌ Status: {result['status']}, Content-Type: {result['content_type']}, Size: {result['size']} bytes")
    print()
    if not passed:
        all_tests_passed = False
    
    # Test 3: Old white logo (regression)
    print("Test 3: Regression check - OLD white-transparent logo")
    print("-" * 80)
    passed, message = test_old_white_logo()
    print(f"URL: {BASE_URL}/api/static/dynopay-white-logo.png")
    print(message)
    print()
    if not passed:
        all_tests_passed = False
    
    # Test 4: Health endpoint
    print("Test 4: Health endpoint")
    print("-" * 80)
    passed, message, data = test_health_endpoint()
    print(f"URL: http://localhost:8001/health (internal - /health not exposed via external ingress)")
    print(message)
    if data:
        print(f"  status: {data.get('status')}")
        print(f"  database: {data.get('database')}")
        print(f"  redis: {data.get('redis')}")
        bg_jobs = data.get('background_jobs', {})
        print(f"  background_jobs.eligible: {bg_jobs.get('eligible')} (SAFE MODE: must be false)")
        print(f"  background_jobs.is_leader: {bg_jobs.get('is_leader')}")
        print(f"  background_jobs.instance_id: {bg_jobs.get('instance_id')}")
    print()
    if not passed:
        all_tests_passed = False
    
    # Summary
    print("=" * 80)
    if all_tests_passed:
        print("✅ ALL TESTS PASSED")
        print("=" * 80)
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        print("=" * 80)
        return 1

if __name__ == "__main__":
    sys.exit(main())
