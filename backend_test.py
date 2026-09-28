#!/usr/bin/env python3
"""
Backend API Testing for SafeDeal Deal Preview Endpoint
E2E UX Audit Batch 3: SD-02 (itemised costs) and SD-04 (no email leak)
"""

import requests
import json
import sys

# Base URL from the review request
BASE_URL = "https://cd0a12df-8cd2-4301-a8cf-d89e2699ae29.preview.emergentagent.com"

# Test fixtures (already exist in DB)
EMAIL_INVITE_TOKEN = "bfdd8f76429be0ef77804ea6f7038917a3caaec3b35f641e"
LINK_INVITE_TOKEN = "98d9f2ba0ccd4188c66f9c9e7e030a7c39c172a41b27e61f"

# Expected values
EXPECTED_FEE_PERCENT = 5
EXPECTED_EMAIL_MASKED = "sd•••@example.com"
FULL_EMAIL_SHOULD_NOT_APPEAR = "sd-audit-buyer-1790570923@example.com"

def print_section(title):
    """Print a section header"""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def test_preview_endpoint(token, token_name):
    """Test the deal preview endpoint for a given token"""
    print_section(f"Testing {token_name}")
    
    url = f"{BASE_URL}/api/safedeal/deals/{token}/preview"
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        # Parse response
        response_json = response.json()
        print(f"\nResponse structure keys: {list(response_json.keys())}")
        
        # The response is wrapped by app's success helper (data is under "data" key)
        if "data" not in response_json:
            print(f"❌ FAIL: Response missing 'data' key")
            print(f"Full response: {json.dumps(response_json, indent=2)[:1000]}")
            return False
        
        data = response_json["data"]
        print(f"Data keys: {list(data.keys())}")
        
        # Store results
        results = []
        
        # SD-02: Itemised costs assertions
        print(f"\n--- SD-02: Itemised Costs Assertions ---")
        
        # Check cost_items is a non-empty array
        if "cost_items" not in data:
            print(f"❌ FAIL: Missing 'cost_items' field")
            results.append(False)
        elif not isinstance(data["cost_items"], list):
            print(f"❌ FAIL: 'cost_items' is not an array, got {type(data['cost_items'])}")
            results.append(False)
        elif len(data["cost_items"]) == 0:
            print(f"❌ FAIL: 'cost_items' is empty")
            results.append(False)
        else:
            print(f"✅ PASS: cost_items is a non-empty array with {len(data['cost_items'])} items")
            
            # Check each item has key, label, amount
            all_items_valid = True
            for i, item in enumerate(data["cost_items"]):
                if not isinstance(item, dict):
                    print(f"  ❌ Item {i}: Not a dict")
                    all_items_valid = False
                    continue
                
                has_key = "key" in item and isinstance(item["key"], str)
                has_label = "label" in item and isinstance(item["label"], str)
                has_amount = "amount" in item and isinstance(item["amount"], (int, float))
                
                if has_key and has_label and has_amount:
                    print(f"  ✅ Item {i}: key='{item['key']}', label='{item['label']}', amount={item['amount']}")
                else:
                    print(f"  ❌ Item {i}: Missing required fields - has_key={has_key}, has_label={has_label}, has_amount={has_amount}")
                    all_items_valid = False
            
            results.append(all_items_valid)
        
        # Check total_cost is a number > 0
        if "total_cost" not in data:
            print(f"❌ FAIL: Missing 'total_cost' field")
            results.append(False)
        elif not isinstance(data["total_cost"], (int, float)):
            print(f"❌ FAIL: 'total_cost' is not a number, got {type(data['total_cost'])}")
            results.append(False)
        elif data["total_cost"] <= 0:
            print(f"❌ FAIL: 'total_cost' is not > 0, got {data['total_cost']}")
            results.append(False)
        else:
            print(f"✅ PASS: total_cost is a number > 0: {data['total_cost']}")
            results.append(True)
        
        # Check costs_estimated is a boolean
        if "costs_estimated" not in data:
            print(f"❌ FAIL: Missing 'costs_estimated' field")
            results.append(False)
        elif not isinstance(data["costs_estimated"], bool):
            print(f"❌ FAIL: 'costs_estimated' is not a boolean, got {type(data['costs_estimated'])}")
            results.append(False)
        else:
            print(f"✅ PASS: costs_estimated is a boolean: {data['costs_estimated']}")
            results.append(True)
        
        # Check fee_percent === 5
        if "fee_percent" not in data:
            print(f"❌ FAIL: Missing 'fee_percent' field")
            results.append(False)
        elif data["fee_percent"] != EXPECTED_FEE_PERCENT:
            print(f"❌ FAIL: fee_percent is {data['fee_percent']}, expected {EXPECTED_FEE_PERCENT}")
            results.append(False)
        else:
            print(f"✅ PASS: fee_percent === {EXPECTED_FEE_PERCENT}")
            results.append(True)
        
        # Check buyer_pays and seller_receives are numbers
        if "buyer_pays" not in data:
            print(f"❌ FAIL: Missing 'buyer_pays' field")
            results.append(False)
        elif not isinstance(data["buyer_pays"], (int, float)):
            print(f"❌ FAIL: 'buyer_pays' is not a number, got {type(data['buyer_pays'])}")
            results.append(False)
        else:
            print(f"✅ PASS: buyer_pays is a number: {data['buyer_pays']}")
            results.append(True)
        
        if "seller_receives" not in data:
            print(f"❌ FAIL: Missing 'seller_receives' field")
            results.append(False)
        elif not isinstance(data["seller_receives"], (int, float)):
            print(f"❌ FAIL: 'seller_receives' is not a number, got {type(data['seller_receives'])}")
            results.append(False)
        else:
            print(f"✅ PASS: seller_receives is a number: {data['seller_receives']}")
            results.append(True)
        
        # SD-04: Email leak prevention assertions
        print(f"\n--- SD-04: Email Leak Prevention Assertions ---")
        
        # Check counterparty_email_hint === null
        if "counterparty_email_hint" not in data:
            print(f"❌ FAIL: Missing 'counterparty_email_hint' field")
            results.append(False)
        elif data["counterparty_email_hint"] is not None:
            print(f"❌ FAIL: counterparty_email_hint is not null, got {data['counterparty_email_hint']}")
            results.append(False)
        else:
            print(f"✅ PASS: counterparty_email_hint === null")
            results.append(True)
        
        # For EMAIL deal: check counterparty_email_masked
        if token_name == "EMAIL-invite deal":
            if "counterparty_email_masked" not in data:
                print(f"❌ FAIL: Missing 'counterparty_email_masked' field")
                results.append(False)
            elif data["counterparty_email_masked"] != EXPECTED_EMAIL_MASKED:
                print(f"❌ FAIL: counterparty_email_masked is '{data['counterparty_email_masked']}', expected '{EXPECTED_EMAIL_MASKED}'")
                results.append(False)
            else:
                print(f"✅ PASS: counterparty_email_masked === '{EXPECTED_EMAIL_MASKED}'")
                results.append(True)
            
            # Check full email does NOT appear anywhere in response
            response_text = json.dumps(response_json)
            if FULL_EMAIL_SHOULD_NOT_APPEAR in response_text:
                print(f"❌ FAIL: Full email '{FULL_EMAIL_SHOULD_NOT_APPEAR}' found in response!")
                results.append(False)
            else:
                print(f"✅ PASS: Full email '{FULL_EMAIL_SHOULD_NOT_APPEAR}' does NOT appear in response")
                results.append(True)
        
        # Print raw data object for email-invite token
        if token_name == "EMAIL-invite deal":
            print(f"\n--- Raw Data Object for {token_name} ---")
            print(json.dumps(data, indent=2))
        
        # Summary
        all_passed = all(results)
        print(f"\n--- Summary for {token_name} ---")
        print(f"Total assertions: {len(results)}")
        print(f"Passed: {sum(results)}")
        print(f"Failed: {len(results) - sum(results)}")
        
        if all_passed:
            print(f"✅✅✅ ALL ASSERTIONS PASSED for {token_name} ✅✅✅")
        else:
            print(f"❌❌❌ SOME ASSERTIONS FAILED for {token_name} ❌❌❌")
        
        return all_passed
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL: Request error: {e}")
        return False
    except Exception as e:
        print(f"❌ FAIL: Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_bogus_token():
    """Test that a bogus token returns 404"""
    print_section("Testing Bogus Token (should return 404)")
    
    bogus_token = "deadbeef"
    url = f"{BASE_URL}/api/safedeal/deals/{bogus_token}/preview"
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 404:
            print(f"✅ PASS: Bogus token returns 404")
            
            # Check for "Deal not found" style message
            try:
                response_json = response.json()
                response_text = json.dumps(response_json).lower()
                if "deal" in response_text and ("not found" in response_text or "not exist" in response_text):
                    print(f"✅ PASS: Response contains 'Deal not found' style message")
                    print(f"Response: {json.dumps(response_json, indent=2)}")
                    return True
                else:
                    print(f"⚠️  WARNING: Response doesn't contain clear 'Deal not found' message")
                    print(f"Response: {json.dumps(response_json, indent=2)}")
                    return True  # Still pass if 404 is returned
            except:
                print(f"Response text: {response.text[:200]}")
                return True
        elif response.status_code == 500:
            print(f"❌ FAIL: Bogus token returns 500 (should be 404)")
            print(f"Response: {response.text[:500]}")
            return False
        else:
            print(f"❌ FAIL: Bogus token returns {response.status_code} (should be 404)")
            print(f"Response: {response.text[:500]}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL: Request error: {e}")
        return False
    except Exception as e:
        print(f"❌ FAIL: Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main test runner"""
    print_section("SafeDeal Deal Preview Endpoint Testing")
    print(f"Base URL: {BASE_URL}")
    print(f"Endpoint: GET /api/safedeal/deals/:token/preview")
    print(f"\nTest Scope:")
    print(f"  - SD-02: Itemised costs (cost_items, total_cost, costs_estimated, fee_percent)")
    print(f"  - SD-04: Email leak prevention (counterparty_email_hint, counterparty_email_masked)")
    print(f"\nConstraints: READ-ONLY, no auth required (public endpoint)")
    
    results = {}
    
    # Test EMAIL-invite deal
    results["email_invite"] = test_preview_endpoint(EMAIL_INVITE_TOKEN, "EMAIL-invite deal")
    
    # Test LINK-invite deal
    results["link_invite"] = test_preview_endpoint(LINK_INVITE_TOKEN, "LINK-invite deal")
    
    # Test bogus token
    results["bogus_token"] = test_bogus_token()
    
    # Final summary
    print_section("FINAL TEST SUMMARY")
    print(f"EMAIL-invite deal: {'✅ PASS' if results['email_invite'] else '❌ FAIL'}")
    print(f"LINK-invite deal:  {'✅ PASS' if results['link_invite'] else '❌ FAIL'}")
    print(f"Bogus token (404): {'✅ PASS' if results['bogus_token'] else '❌ FAIL'}")
    
    all_passed = all(results.values())
    print(f"\n{'='*80}")
    if all_passed:
        print("✅✅✅ ALL TESTS PASSED ✅✅✅")
        print("="*80)
        return 0
    else:
        print("❌❌❌ SOME TESTS FAILED ❌❌❌")
        print("="*80)
        return 1

if __name__ == "__main__":
    sys.exit(main())
