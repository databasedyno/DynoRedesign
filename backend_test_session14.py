#!/usr/bin/env python3
"""
Session 14 Backend Test - Emily Support Chat with Attachments
Tests upload, vision, timestamps, and validation
"""

import requests
import json
import time
from datetime import datetime
from io import BytesIO
from PIL import Image

# Base URL
BASE_URL = "https://crypto-payment-hub-34.preview.emergentagent.com/api"

# Session ID for testing (prefixed with "backendtest-")
SESSION_ID = f"backendtest-{int(time.time())}"

# Test results
results = {
    "test1_upload_png": None,
    "test2_static_serve": None,
    "test3_upload_rejection": None,
    "test4_chat_with_image": None,
    "test5_history": None,
    "test6a_validation_external_url": None,
    "test6b_validation_nonexistent": None,
    "test6c_validation_empty_message": None,
    "test7a_regression_root": None,
    "test7b_regression_csrf": None,
    "test7c_regression_login": None,
}

def create_1x1_png():
    """Create a tiny 1x1 transparent PNG in memory"""
    img = Image.new('RGBA', (1, 1), (255, 255, 255, 0))
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer

def create_txt_file():
    """Create a small text file in memory"""
    return BytesIO(b"This is a test text file")

print("=" * 80)
print("SESSION 14 BACKEND TEST - Emily Support Chat with Attachments")
print("=" * 80)
print(f"Base URL: {BASE_URL}")
print(f"Session ID: {SESSION_ID}")
print(f"Timestamp: {datetime.now().isoformat()}")
print("=" * 80)
print()

# TEST 1: Upload PNG
print("TEST 1: Upload PNG file")
print("-" * 80)
try:
    png_buffer = create_1x1_png()
    files = {'file': ('test.png', png_buffer, 'image/png')}
    response = requests.post(f"{BASE_URL}/support/chat/upload", files=files, timeout=30)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if 'data' in data and 'url' in data['data']:
            upload_url = data['data']['url']
            upload_name = data['data'].get('name', '')
            upload_type = data['data'].get('type', '')
            upload_size = data['data'].get('size', 0)
            
            # Verify URL format
            if upload_url.startswith('/api/static/support-chat/') and upload_url.endswith('.png'):
                results['test1_upload_png'] = {
                    'status': 'PASS',
                    'url': upload_url,
                    'name': upload_name,
                    'type': upload_type,
                    'size': upload_size
                }
                print(f"✅ PASS: Upload successful")
                print(f"   URL: {upload_url}")
                print(f"   Name: {upload_name}")
                print(f"   Type: {upload_type}")
                print(f"   Size: {upload_size}")
            else:
                results['test1_upload_png'] = {'status': 'FAIL', 'reason': f'Invalid URL format: {upload_url}'}
                print(f"❌ FAIL: Invalid URL format: {upload_url}")
        else:
            results['test1_upload_png'] = {'status': 'FAIL', 'reason': 'Missing data.url in response'}
            print(f"❌ FAIL: Missing data.url in response")
    else:
        results['test1_upload_png'] = {'status': 'FAIL', 'reason': f'Status {response.status_code}'}
        print(f"❌ FAIL: Expected 200, got {response.status_code}")
except Exception as e:
    results['test1_upload_png'] = {'status': 'ERROR', 'reason': str(e)}
    print(f"❌ ERROR: {e}")

print()

# TEST 2: Static serve
if results['test1_upload_png'] and results['test1_upload_png']['status'] == 'PASS':
    print("TEST 2: Static serve uploaded PNG")
    print("-" * 80)
    try:
        upload_url = results['test1_upload_png']['url']
        full_url = f"https://crypto-payment-hub-34.preview.emergentagent.com{upload_url}"
        
        response = requests.get(full_url, timeout=30)
        
        print(f"URL: {full_url}")
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'N/A')}")
        print(f"Content-Length: {len(response.content)} bytes")
        
        if response.status_code == 200 and 'image/png' in response.headers.get('content-type', ''):
            results['test2_static_serve'] = {'status': 'PASS', 'content_type': response.headers.get('content-type')}
            print(f"✅ PASS: Static file served correctly")
        else:
            results['test2_static_serve'] = {'status': 'FAIL', 'reason': f'Status {response.status_code} or wrong content-type'}
            print(f"❌ FAIL: Expected 200 with image/png, got {response.status_code}")
    except Exception as e:
        results['test2_static_serve'] = {'status': 'ERROR', 'reason': str(e)}
        print(f"❌ ERROR: {e}")
    print()
else:
    print("TEST 2: SKIPPED (Test 1 failed)")
    print()

# TEST 3: Upload rejection (.txt file)
print("TEST 3: Upload rejection (.txt file)")
print("-" * 80)
try:
    txt_buffer = create_txt_file()
    files = {'file': ('test.txt', txt_buffer, 'text/plain')}
    response = requests.post(f"{BASE_URL}/support/chat/upload", files=files, timeout=30)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 400:
        response_text = response.text.lower()
        if 'only png' in response_text or 'only' in response_text and 'pdf' in response_text:
            results['test3_upload_rejection'] = {'status': 'PASS', 'message': response.text}
            print(f"✅ PASS: .txt file correctly rejected with 400")
        else:
            results['test3_upload_rejection'] = {'status': 'FAIL', 'reason': f'Wrong error message: {response.text}'}
            print(f"❌ FAIL: Wrong error message: {response.text}")
    else:
        results['test3_upload_rejection'] = {'status': 'FAIL', 'reason': f'Expected 400, got {response.status_code}'}
        print(f"❌ FAIL: Expected 400, got {response.status_code}")
except Exception as e:
    results['test3_upload_rejection'] = {'status': 'ERROR', 'reason': str(e)}
    print(f"❌ ERROR: {e}")

print()

# TEST 4: Chat with image attachment (vision) - COSTS OPENAI TOKENS
if results['test1_upload_png'] and results['test1_upload_png']['status'] == 'PASS':
    print("TEST 4: Chat with image attachment (vision) - COSTS OPENAI TOKENS")
    print("-" * 80)
    try:
        upload_url = results['test1_upload_png']['url']
        
        payload = {
            "session_id": SESSION_ID,
            "message": "What color is this image? Answer in 3 words max.",
            "attachment_url": upload_url,
            "attachment_name": "t.png",
            "attachment_type": "image/png"
        }
        
        response = requests.post(f"{BASE_URL}/support/chat", json=payload, timeout=60)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:1000]}")
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and 'reply' in data['data'] and 'replied_at' in data['data']:
                reply = data['data']['reply']
                replied_at = data['data']['replied_at']
                
                # Check if reply mentions white/blank/transparent
                reply_lower = reply.lower()
                mentions_color = any(word in reply_lower for word in ['white', 'blank', 'transparent', 'clear', 'empty'])
                
                # Verify replied_at is ISO format
                try:
                    datetime.fromisoformat(replied_at.replace('Z', '+00:00'))
                    valid_timestamp = True
                except:
                    valid_timestamp = False
                
                if mentions_color and valid_timestamp:
                    results['test4_chat_with_image'] = {
                        'status': 'PASS',
                        'reply': reply,
                        'replied_at': replied_at
                    }
                    print(f"✅ PASS: Vision working, reply mentions color")
                    print(f"   Reply: {reply}")
                    print(f"   Replied at: {replied_at}")
                else:
                    results['test4_chat_with_image'] = {
                        'status': 'PARTIAL',
                        'reason': f'mentions_color={mentions_color}, valid_timestamp={valid_timestamp}',
                        'reply': reply,
                        'replied_at': replied_at
                    }
                    print(f"⚠️ PARTIAL: Reply received but may not mention expected color")
                    print(f"   Reply: {reply}")
                    print(f"   Replied at: {replied_at}")
            else:
                results['test4_chat_with_image'] = {'status': 'FAIL', 'reason': 'Missing reply or replied_at'}
                print(f"❌ FAIL: Missing reply or replied_at in response")
        else:
            results['test4_chat_with_image'] = {'status': 'FAIL', 'reason': f'Status {response.status_code}'}
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
    except Exception as e:
        results['test4_chat_with_image'] = {'status': 'ERROR', 'reason': str(e)}
        print(f"❌ ERROR: {e}")
    print()
else:
    print("TEST 4: SKIPPED (Test 1 failed)")
    print()

# TEST 5: History
print("TEST 5: Chat history")
print("-" * 80)
try:
    response = requests.get(f"{BASE_URL}/support/chat/history/{SESSION_ID}", timeout=30)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:1000]}")
    
    if response.status_code == 200:
        data = response.json()
        if 'data' in data and 'messages' in data['data']:
            messages = data['data']['messages']
            
            if len(messages) >= 2:
                msg0 = messages[0]
                msg1 = messages[1]
                
                # Check message 0 (user with attachment)
                has_attachment = all(k in msg0 for k in ['attachment_url', 'attachment_name', 'attachment_type'])
                has_created_at = 'createdAt' in msg0
                is_user_role = msg0.get('role') == 'user'
                
                # Check message 1 (assistant reply)
                is_assistant_role = msg1.get('role') == 'assistant'
                has_reply = 'content' in msg1 and len(msg1['content']) > 0
                
                if has_attachment and has_created_at and is_user_role and is_assistant_role and has_reply:
                    results['test5_history'] = {
                        'status': 'PASS',
                        'message_count': len(messages),
                        'msg0_attachment_url': msg0.get('attachment_url'),
                        'msg0_createdAt': msg0.get('createdAt'),
                        'msg1_role': msg1.get('role')
                    }
                    print(f"✅ PASS: History correct with {len(messages)} messages")
                    print(f"   Message 0: role={msg0.get('role')}, has_attachment={has_attachment}, createdAt={msg0.get('createdAt')}")
                    print(f"   Message 1: role={msg1.get('role')}, content_length={len(msg1.get('content', ''))}")
                else:
                    results['test5_history'] = {
                        'status': 'FAIL',
                        'reason': f'has_attachment={has_attachment}, has_created_at={has_created_at}, is_user_role={is_user_role}, is_assistant_role={is_assistant_role}, has_reply={has_reply}'
                    }
                    print(f"❌ FAIL: History structure incorrect")
            else:
                results['test5_history'] = {'status': 'FAIL', 'reason': f'Expected >=2 messages, got {len(messages)}'}
                print(f"❌ FAIL: Expected >=2 messages, got {len(messages)}")
        else:
            results['test5_history'] = {'status': 'FAIL', 'reason': 'Missing data.messages'}
            print(f"❌ FAIL: Missing data.messages in response")
    else:
        results['test5_history'] = {'status': 'FAIL', 'reason': f'Status {response.status_code}'}
        print(f"❌ FAIL: Expected 200, got {response.status_code}")
except Exception as e:
    results['test5_history'] = {'status': 'ERROR', 'reason': str(e)}
    print(f"❌ ERROR: {e}")

print()

# TEST 6a: Validation - external URL
print("TEST 6a: Validation - external URL (no OpenAI cost)")
print("-" * 80)
try:
    payload = {
        "session_id": f"backendtest-validation-{int(time.time())}",
        "message": "Test",
        "attachment_url": "https://evil.com/x.png",
        "attachment_name": "x.png",
        "attachment_type": "image/png"
    }
    
    response = requests.post(f"{BASE_URL}/support/chat", json=payload, timeout=30)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 400:
        response_text = response.text.lower()
        if 'invalid' in response_text and 'attachment' in response_text:
            results['test6a_validation_external_url'] = {'status': 'PASS', 'message': response.text}
            print(f"✅ PASS: External URL correctly rejected with 400")
        else:
            results['test6a_validation_external_url'] = {'status': 'PARTIAL', 'message': response.text}
            print(f"⚠️ PARTIAL: Got 400 but message may differ: {response.text}")
    else:
        results['test6a_validation_external_url'] = {'status': 'FAIL', 'reason': f'Expected 400, got {response.status_code}'}
        print(f"❌ FAIL: Expected 400, got {response.status_code}")
except Exception as e:
    results['test6a_validation_external_url'] = {'status': 'ERROR', 'reason': str(e)}
    print(f"❌ ERROR: {e}")

print()

# TEST 6b: Validation - nonexistent file
print("TEST 6b: Validation - nonexistent file (no OpenAI cost)")
print("-" * 80)
try:
    payload = {
        "session_id": f"backendtest-validation-{int(time.time())}",
        "message": "Test",
        "attachment_url": "/api/static/support-chat/nonexistent-file.png",
        "attachment_name": "nonexistent.png",
        "attachment_type": "image/png"
    }
    
    response = requests.post(f"{BASE_URL}/support/chat", json=payload, timeout=30)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 400:
        results['test6b_validation_nonexistent'] = {'status': 'PASS', 'message': response.text}
        print(f"✅ PASS: Nonexistent file correctly rejected with 400")
    else:
        results['test6b_validation_nonexistent'] = {'status': 'FAIL', 'reason': f'Expected 400, got {response.status_code}'}
        print(f"❌ FAIL: Expected 400, got {response.status_code}")
except Exception as e:
    results['test6b_validation_nonexistent'] = {'status': 'ERROR', 'reason': str(e)}
    print(f"❌ ERROR: {e}")

print()

# TEST 6c: Validation - empty message + no attachment
print("TEST 6c: Validation - empty message + no attachment (no OpenAI cost)")
print("-" * 80)
try:
    payload = {
        "session_id": f"backendtest-validation-{int(time.time())}",
        "message": ""
    }
    
    response = requests.post(f"{BASE_URL}/support/chat", json=payload, timeout=30)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 400:
        response_text = response.text.lower()
        if 'message' in response_text and 'required' in response_text:
            results['test6c_validation_empty_message'] = {'status': 'PASS', 'message': response.text}
            print(f"✅ PASS: Empty message correctly rejected with 400")
        else:
            results['test6c_validation_empty_message'] = {'status': 'PARTIAL', 'message': response.text}
            print(f"⚠️ PARTIAL: Got 400 but message may differ: {response.text}")
    else:
        results['test6c_validation_empty_message'] = {'status': 'FAIL', 'reason': f'Expected 400, got {response.status_code}'}
        print(f"❌ FAIL: Expected 400, got {response.status_code}")
except Exception as e:
    results['test6c_validation_empty_message'] = {'status': 'ERROR', 'reason': str(e)}
    print(f"❌ ERROR: {e}")

print()

# TEST 7a: Regression - root endpoint
print("TEST 7a: Regression - GET /api/")
print("-" * 80)
try:
    response = requests.get(f"{BASE_URL}/", timeout=30)
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        results['test7a_regression_root'] = {'status': 'PASS'}
        print(f"✅ PASS: GET /api/ returned 200")
    else:
        results['test7a_regression_root'] = {'status': 'FAIL', 'reason': f'Expected 200, got {response.status_code}'}
        print(f"❌ FAIL: Expected 200, got {response.status_code}")
except Exception as e:
    results['test7a_regression_root'] = {'status': 'ERROR', 'reason': str(e)}
    print(f"❌ ERROR: {e}")

print()

# TEST 7b: Regression - CSRF token
print("TEST 7b: Regression - GET /api/csrf-token")
print("-" * 80)
try:
    response = requests.get(f"{BASE_URL}/csrf-token", timeout=30)
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        results['test7b_regression_csrf'] = {'status': 'PASS'}
        print(f"✅ PASS: GET /api/csrf-token returned 200")
    else:
        results['test7b_regression_csrf'] = {'status': 'FAIL', 'reason': f'Expected 200, got {response.status_code}'}
        print(f"❌ FAIL: Expected 200, got {response.status_code}")
except Exception as e:
    results['test7b_regression_csrf'] = {'status': 'ERROR', 'reason': str(e)}
    print(f"❌ ERROR: {e}")

print()

# TEST 7c: Regression - login with bad credentials
print("TEST 7c: Regression - POST /api/user/login (bad credentials)")
print("-" * 80)
try:
    payload = {
        "email": "bad@bad.com",
        "password": "wrongpass"
    }
    
    response = requests.post(f"{BASE_URL}/user/login", json=payload, timeout=30)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 401:
        results['test7c_regression_login'] = {'status': 'PASS'}
        print(f"✅ PASS: Bad credentials correctly rejected with 401")
    else:
        results['test7c_regression_login'] = {'status': 'FAIL', 'reason': f'Expected 401, got {response.status_code}'}
        print(f"❌ FAIL: Expected 401, got {response.status_code}")
except Exception as e:
    results['test7c_regression_login'] = {'status': 'ERROR', 'reason': str(e)}
    print(f"❌ ERROR: {e}")

print()

# SUMMARY
print("=" * 80)
print("TEST SUMMARY")
print("=" * 80)

pass_count = sum(1 for r in results.values() if r and r.get('status') == 'PASS')
partial_count = sum(1 for r in results.values() if r and r.get('status') == 'PARTIAL')
fail_count = sum(1 for r in results.values() if r and r.get('status') == 'FAIL')
error_count = sum(1 for r in results.values() if r and r.get('status') == 'ERROR')
total_count = len(results)

print(f"Total Tests: {total_count}")
print(f"✅ PASS: {pass_count}")
print(f"⚠️ PARTIAL: {partial_count}")
print(f"❌ FAIL: {fail_count}")
print(f"❌ ERROR: {error_count}")
print()

for test_name, result in results.items():
    if result:
        status = result.get('status', 'UNKNOWN')
        symbol = '✅' if status == 'PASS' else '⚠️' if status == 'PARTIAL' else '❌'
        print(f"{symbol} {test_name}: {status}")
        if status in ['FAIL', 'ERROR']:
            print(f"   Reason: {result.get('reason', 'N/A')}")

print()
print("=" * 80)
print("END OF TEST")
print("=" * 80)
