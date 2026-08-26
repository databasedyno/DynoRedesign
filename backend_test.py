#!/usr/bin/env python3
"""
DynoPay Backend Verification — 3 New Read-Only Features (2026-08-26)
=====================================================================
PRODUCTION DATABASE - STRICTLY READ-ONLY (SAFE MODE)

Test Cases (per review_request):
FEATURE #1 — Localized sitemap:
1. GET /api/shop-sitemap -> 200 JSON with shops[] (has "devhub") + products[] (each {handle, slug})
2. GET /sitemap.xml -> 200 text/xml; contains /devhub/shop AND at least one /p/ URL; has hreflang alternates with ?lang=de + x-default

FEATURE #2 — Status per-service budgets + auto-incidents:
3. GET /api/status/services -> 200; each service has degraded_ms + outage_ms (NOT flat 1000)
4. GET /api/status/incidents -> 200; incidents[] present (may include auto-derived ones with auto=true)

FEATURE #3 — Referral clarity:
5. POST /api/user/login -> get accessToken
6. GET /api/referral/my-code with Bearer -> get referral_code
7. POST /api/referral/validate with Bearer and valid code -> valid:true, code_type "referral"
8. POST /api/referral/validate with Bearer and invalid code -> valid:false / 404

FEATURE health:
9. GET /health -> status healthy, database connected, redis connected, background_jobs.eligible == false (SAFE MODE)

CRITICAL SAFETY RULES:
- Do NOT sign up / register any user (writes to prod).
- Do NOT call POST /api/referral/apply with a VALID code (it creates a referral + grants a fee discount on prod).
- Only /api/referral/validate (read-only) and, if you want, /apply with a deliberately INVALID code (returns 404, no write).
"""

import requests
import re
from xml.etree import ElementTree as ET

# Base URLs
LOCALHOST_BASE = "http://localhost:8001"
PREVIEW_BASE = "https://checkout-deployment-1.preview.emergentagent.com"
API_BASE = f"{PREVIEW_BASE}/api"

# Test credentials (from test_credentials.md)
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

# Global token storage
access_token = None
referral_code = None

def test_health_check():
    """
    TEST 9: Health check
    Expected: status=healthy, database=connected, redis=connected, background_jobs.eligible=false (SAFE MODE)
    """
    print("\n" + "="*70)
    print("TEST 9: Health Check (SAFE MODE verification)")
    print("="*70)
    
    url = f"{LOCALHOST_BASE}/health"
    
    print(f"\n[TEST 9] GET {url}")
    print(f"Expected: status=healthy, database=connected, redis=connected, background_jobs.eligible=false")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"\nActual Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {data}")
            
            status = data.get('status')
            database = data.get('database')
            redis = data.get('redis')
            bg_jobs = data.get('background_jobs', {}).get('eligible')
            
            if status == 'healthy' and database == 'connected' and redis == 'connected' and bg_jobs == False:
                print(f"✅ TEST 9 PASSED: Health check returned all expected values")
                print(f"   - status: {status}")
                print(f"   - database: {database}")
                print(f"   - redis: {redis}")
                print(f"   - background_jobs.eligible: {bg_jobs} (SAFE MODE confirmed)")
                return True
            else:
                print(f"❌ TEST 9 FAILED: Values don't match:")
                print(f"   - status: {status} (expected: healthy)")
                print(f"   - database: {database} (expected: connected)")
                print(f"   - redis: {redis} (expected: connected)")
                print(f"   - background_jobs.eligible: {bg_jobs} (expected: false)")
                return False
        else:
            print(f"❌ TEST 9 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 9 ERROR: {str(e)}")
        return False

def test_shop_sitemap():
    """
    TEST 1: GET /api/shop-sitemap
    Expected: 200 JSON with shops[] (has "devhub") + products[] (each {handle, slug})
    """
    print("\n" + "="*70)
    print("TEST 1: Localized Sitemap Feed (/api/shop-sitemap)")
    print("="*70)
    
    url = f"{API_BASE}/shop-sitemap"
    
    print(f"\n[TEST 1] GET {url}")
    print(f"Expected: 200 JSON with data.shops[] (includes 'devhub') + data.products[] (each has handle, slug)")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"\nActual Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {data.keys()}")
            
            # Check for data.shops and data.products
            if 'data' in data:
                shops = data['data'].get('shops', [])
                products = data['data'].get('products', [])
                
                print(f"\nShops count: {len(shops)}")
                print(f"Products count: {len(products)}")
                
                # Check if "devhub" is in shops
                shop_handles = [shop.get('handle') for shop in shops if isinstance(shop, dict)]
                print(f"Shop handles: {shop_handles}")
                
                devhub_found = 'devhub' in shop_handles
                
                # Check if products have handle and slug
                products_valid = True
                if products:
                    sample_product = products[0]
                    print(f"Sample product: {sample_product}")
                    products_valid = all(
                        isinstance(p, dict) and 'handle' in p and 'slug' in p 
                        for p in products
                    )
                
                if devhub_found and products_valid:
                    print(f"✅ TEST 1 PASSED: /api/shop-sitemap returned valid data")
                    print(f"   - 'devhub' found in shops: {devhub_found}")
                    print(f"   - Products have handle+slug: {products_valid}")
                    return True
                else:
                    print(f"❌ TEST 1 FAILED:")
                    print(f"   - 'devhub' found in shops: {devhub_found}")
                    print(f"   - Products have handle+slug: {products_valid}")
                    return False
            else:
                print(f"❌ TEST 1 FAILED: Response missing 'data' key")
                print(f"Response: {data}")
                return False
        else:
            print(f"❌ TEST 1 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 ERROR: {str(e)}")
        return False

def test_sitemap_xml():
    """
    TEST 2: GET /sitemap.xml
    Expected: 200 text/xml; contains /devhub/shop AND at least one /p/ URL; 
              has hreflang alternates with ?lang=de + x-default
    """
    print("\n" + "="*70)
    print("TEST 2: Sitemap XML with Localized Hreflang Alternates")
    print("="*70)
    
    url = f"{PREVIEW_BASE}/sitemap.xml"
    
    print(f"\n[TEST 2] GET {url}")
    print(f"Expected: 200 text/xml with /devhub/shop, at least one /p/ URL, hreflang alternates (?lang=de + x-default)")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"\nActual Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type')}")
        
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '')
            
            if 'xml' not in content_type.lower():
                print(f"❌ TEST 2 FAILED: Expected text/xml, got {content_type}")
                return False
            
            xml_content = response.text
            print(f"XML content length: {len(xml_content)} bytes")
            
            # Check for /devhub/shop
            devhub_shop_found = '/devhub/shop' in xml_content
            print(f"Contains '/devhub/shop': {devhub_shop_found}")
            
            # Check for at least one product URL (/p/)
            product_url_found = '/p/' in xml_content
            print(f"Contains at least one '/p/' URL: {product_url_found}")
            
            # Check for hreflang alternates with ?lang=de
            lang_de_found = '?lang=de' in xml_content
            print(f"Contains '?lang=de' alternate: {lang_de_found}")
            
            # Check for x-default hreflang
            x_default_found = 'hreflang="x-default"' in xml_content
            print(f"Contains 'hreflang=\"x-default\"': {x_default_found}")
            
            # Try to parse XML to verify structure
            try:
                root = ET.fromstring(xml_content)
                # Count URL entries
                namespaces = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
                urls = root.findall('.//ns:url', namespaces)
                print(f"Total URL entries in sitemap: {len(urls)}")
            except Exception as e:
                print(f"⚠️ XML parsing warning: {e}")
            
            if devhub_shop_found and product_url_found and lang_de_found and x_default_found:
                print(f"✅ TEST 2 PASSED: Sitemap XML contains all required elements")
                print(f"   - /devhub/shop: ✓")
                print(f"   - Product URLs (/p/): ✓")
                print(f"   - ?lang=de alternates: ✓")
                print(f"   - x-default hreflang: ✓")
                return True
            else:
                print(f"❌ TEST 2 FAILED: Missing required elements:")
                print(f"   - /devhub/shop: {devhub_shop_found}")
                print(f"   - Product URLs (/p/): {product_url_found}")
                print(f"   - ?lang=de alternates: {lang_de_found}")
                print(f"   - x-default hreflang: {x_default_found}")
                return False
        else:
            print(f"❌ TEST 2 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 2 ERROR: {str(e)}")
        return False

def test_status_services():
    """
    TEST 3: GET /api/status/services
    Expected: 200; each service has degraded_ms + outage_ms (NOT flat 1000 for all)
    """
    print("\n" + "="*70)
    print("TEST 3: Status Per-Service Budgets")
    print("="*70)
    
    url = f"{API_BASE}/status/services"
    
    print(f"\n[TEST 3] GET {url}")
    print(f"Expected: 200; each service has degraded_ms + outage_ms (per-service, NOT all 1000)")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"\nActual Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'data' in data and 'services' in data['data']:
                services = data['data']['services']
                print(f"\nServices count: {len(services)}")
                
                # Check each service for degraded_ms and outage_ms
                all_have_budgets = True
                budgets = {}
                
                for service in services:
                    service_name = service.get('service_name', 'unknown')
                    degraded_ms = service.get('degraded_ms')
                    outage_ms = service.get('outage_ms')
                    
                    budgets[service_name] = {
                        'degraded_ms': degraded_ms,
                        'outage_ms': outage_ms
                    }
                    
                    if degraded_ms is None or outage_ms is None:
                        all_have_budgets = False
                
                print(f"\nPer-service budgets:")
                for service_name, budget in budgets.items():
                    print(f"  {service_name}: degraded={budget['degraded_ms']}ms, outage={budget['outage_ms']}ms")
                
                # Check if they are NOT all the same flat 1000
                degraded_values = [b['degraded_ms'] for b in budgets.values() if b['degraded_ms'] is not None]
                outage_values = [b['outage_ms'] for b in budgets.values() if b['outage_ms'] is not None]
                
                all_degraded_1000 = all(v == 1000 for v in degraded_values)
                all_outage_1000 = all(v == 1000 for v in outage_values)
                
                has_variation = not (all_degraded_1000 and all_outage_1000)
                
                if all_have_budgets and has_variation:
                    print(f"\n✅ TEST 3 PASSED: Per-service budgets are present and vary")
                    print(f"   - All services have degraded_ms + outage_ms: {all_have_budgets}")
                    print(f"   - Budgets are per-service (NOT all 1000): {has_variation}")
                    return True
                else:
                    print(f"\n❌ TEST 3 FAILED:")
                    print(f"   - All services have budgets: {all_have_budgets}")
                    print(f"   - Budgets vary (NOT all 1000): {has_variation}")
                    return False
            else:
                print(f"❌ TEST 3 FAILED: Response missing 'data.services'")
                print(f"Response: {data}")
                return False
        else:
            print(f"❌ TEST 3 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 3 ERROR: {str(e)}")
        return False

def test_status_incidents():
    """
    TEST 4: GET /api/status/incidents
    Expected: 200; incidents[] present (may include auto-derived ones with auto=true)
    """
    print("\n" + "="*70)
    print("TEST 4: Status Auto-Derived Incidents")
    print("="*70)
    
    url = f"{API_BASE}/status/incidents"
    
    print(f"\n[TEST 4] GET {url}")
    print(f"Expected: 200; data.incidents[] present (may include auto=true, titles like '... recovered')")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"\nActual Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'data' in data and 'incidents' in data['data']:
                incidents = data['data']['incidents']
                print(f"\nIncidents count: {len(incidents)}")
                
                # Check structure of incidents
                if incidents:
                    sample_incident = incidents[0]
                    print(f"Sample incident keys: {sample_incident.keys()}")
                    
                    # Check for required fields
                    required_fields = ['title', 'description', 'status', 'formatted_date', 'services_affected']
                    all_have_fields = all(
                        all(field in incident for field in required_fields)
                        for incident in incidents
                    )
                    
                    # Check for auto-derived incidents
                    auto_incidents = [i for i in incidents if i.get('auto') == True]
                    print(f"Auto-derived incidents: {len(auto_incidents)}")
                    
                    if auto_incidents:
                        print(f"Sample auto-derived incident:")
                        print(f"  Title: {auto_incidents[0].get('title')}")
                        print(f"  Status: {auto_incidents[0].get('status')}")
                    
                    if all_have_fields:
                        print(f"\n✅ TEST 4 PASSED: Incidents endpoint working correctly")
                        print(f"   - Total incidents: {len(incidents)}")
                        print(f"   - Auto-derived incidents: {len(auto_incidents)}")
                        print(f"   - All have required fields: {all_have_fields}")
                        return True
                    else:
                        print(f"\n❌ TEST 4 FAILED: Some incidents missing required fields")
                        return False
                else:
                    print(f"\n✅ TEST 4 PASSED: Incidents endpoint working (empty array is valid)")
                    return True
            else:
                print(f"❌ TEST 4 FAILED: Response missing 'data.incidents'")
                print(f"Response: {data}")
                return False
        else:
            print(f"❌ TEST 4 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 4 ERROR: {str(e)}")
        return False

def test_login():
    """
    TEST 5: POST /api/user/login
    Expected: 200, capture data.accessToken
    """
    global access_token
    
    print("\n" + "="*70)
    print("TEST 5: User Login (for referral testing)")
    print("="*70)
    
    url = f"{API_BASE}/user/login"
    payload = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    print(f"\n[TEST 5] POST {url}")
    print(f"Payload: {payload}")
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"\nActual Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'data' in data and 'accessToken' in data['data']:
                access_token = data['data']['accessToken']
                print(f"✅ TEST 5 PASSED: Login successful")
                print(f"   Token obtained (length: {len(access_token)})")
                return True
            else:
                print(f"❌ TEST 5 FAILED: Response missing accessToken")
                print(f"Response: {data}")
                return False
        else:
            print(f"❌ TEST 5 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 5 ERROR: {str(e)}")
        return False

def test_referral_my_code():
    """
    TEST 6: GET /api/referral/my-code with Bearer
    Expected: 200, capture data.referral_code
    """
    global referral_code
    
    print("\n" + "="*70)
    print("TEST 6: Get My Referral Code")
    print("="*70)
    
    url = f"{API_BASE}/referral/my-code"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    print(f"\n[TEST 6] GET {url}")
    print(f"Headers: Authorization: Bearer <token>")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"\nActual Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'data' in data and 'referral_code' in data['data']:
                referral_code = data['data']['referral_code']
                print(f"✅ TEST 6 PASSED: Got referral code")
                print(f"   Referral code: {referral_code}")
                return True
            else:
                print(f"❌ TEST 6 FAILED: Response missing referral_code")
                print(f"Response: {data}")
                return False
        else:
            print(f"❌ TEST 6 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 6 ERROR: {str(e)}")
        return False

def test_referral_validate_valid():
    """
    TEST 7: POST /api/referral/validate with Bearer and valid code
    Expected: 200, valid:true, code_type "referral", referrer_name present
    """
    print("\n" + "="*70)
    print("TEST 7: Validate Referral Code (Valid Code)")
    print("="*70)
    
    url = f"{API_BASE}/referral/validate"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    payload = {
        "referral_code": referral_code
    }
    
    print(f"\n[TEST 7] POST {url}")
    print(f"Headers: Authorization: Bearer <token>")
    print(f"Payload: {payload}")
    print(f"Expected: 200, valid:true, code_type='referral', referrer_name present")
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        print(f"\nActual Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {data}")
            
            valid = data.get('valid')
            code_type = data.get('data', {}).get('code_type') if 'data' in data else None
            referrer_name = data.get('data', {}).get('referrer_name') if 'data' in data else None
            
            if valid == True and code_type == 'referral' and referrer_name:
                print(f"✅ TEST 7 PASSED: Valid referral code validated correctly")
                print(f"   - valid: {valid}")
                print(f"   - code_type: {code_type}")
                print(f"   - referrer_name: {referrer_name}")
                return True
            else:
                print(f"❌ TEST 7 FAILED: Response values don't match:")
                print(f"   - valid: {valid} (expected: True)")
                print(f"   - code_type: {code_type} (expected: 'referral')")
                print(f"   - referrer_name: {referrer_name} (expected: present)")
                return False
        else:
            print(f"❌ TEST 7 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 7 ERROR: {str(e)}")
        return False

def test_referral_validate_invalid():
    """
    TEST 8: POST /api/referral/validate with Bearer and invalid code
    Expected: valid:false (HTTP 404 or 200 with valid:false)
    """
    print("\n" + "="*70)
    print("TEST 8: Validate Referral Code (Invalid Code)")
    print("="*70)
    
    url = f"{API_BASE}/referral/validate"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    payload = {
        "referral_code": "NOPE-INVALID-XYZ"
    }
    
    print(f"\n[TEST 8] POST {url}")
    print(f"Headers: Authorization: Bearer <token>")
    print(f"Payload: {payload}")
    print(f"Expected: valid:false (HTTP 404 or 200 with valid:false)")
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        print(f"\nActual Status: {response.status_code}")
        
        if response.status_code == 404:
            print(f"✅ TEST 8 PASSED: Invalid code correctly rejected with 404")
            return True
        elif response.status_code == 200:
            data = response.json()
            print(f"Response: {data}")
            
            valid = data.get('valid')
            
            if valid == False:
                print(f"✅ TEST 8 PASSED: Invalid code correctly rejected with valid:false")
                return True
            else:
                print(f"❌ TEST 8 FAILED: Expected valid:false, got valid:{valid}")
                return False
        else:
            print(f"⚠️ TEST 8: Unexpected status {response.status_code}")
            print(f"Response: {response.text[:500]}")
            # Still pass if it's a 4xx error (rejection is working)
            return response.status_code >= 400 and response.status_code < 500
    except Exception as e:
        print(f"❌ TEST 8 ERROR: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("DYNOPAY BACKEND VERIFICATION")
    print("3 New Read-Only Features (2026-08-26)")
    print("="*70)
    print(f"Preview Base: {PREVIEW_BASE}")
    print(f"Localhost Base: {LOCALHOST_BASE}")
    print(f"Test User: {TEST_EMAIL}")
    print("⚠️  PRODUCTION DATABASE - STRICTLY READ-ONLY (SAFE MODE)")
    print("="*70)
    
    # Run all tests in order
    results = {}
    
    # FEATURE health (test first to verify SAFE MODE)
    results["Test 9: Health Check (SAFE MODE)"] = test_health_check()
    
    # FEATURE #1 — Localized sitemap
    results["Test 1: Shop Sitemap Feed"] = test_shop_sitemap()
    results["Test 2: Sitemap XML with Hreflang"] = test_sitemap_xml()
    
    # FEATURE #2 — Status per-service budgets + auto-incidents
    results["Test 3: Status Per-Service Budgets"] = test_status_services()
    results["Test 4: Status Auto-Derived Incidents"] = test_status_incidents()
    
    # FEATURE #3 — Referral clarity (requires login first)
    login_success = test_login()
    results["Test 5: User Login"] = login_success
    
    if login_success:
        my_code_success = test_referral_my_code()
        results["Test 6: Get My Referral Code"] = my_code_success
        
        if my_code_success:
            results["Test 7: Validate Valid Referral Code"] = test_referral_validate_valid()
        else:
            print("\n⚠️ Skipping Test 7 (no referral code obtained)")
            results["Test 7: Validate Valid Referral Code"] = False
        
        results["Test 8: Validate Invalid Referral Code"] = test_referral_validate_invalid()
    else:
        print("\n⚠️ Skipping Tests 6-8 (login failed)")
        results["Test 6: Get My Referral Code"] = False
        results["Test 7: Validate Valid Referral Code"] = False
        results["Test 8: Validate Invalid Referral Code"] = False
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({int(passed/total*100)}% pass rate)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - 3 new read-only features verified successfully!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed - Features incomplete or issues detected")
    
    print("="*70)

if __name__ == "__main__":
    main()
