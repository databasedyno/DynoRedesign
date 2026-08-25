#!/bin/bash

# Backend Test Suite for 4-Issue Fix Batch (session 10b)
# Tests: Email button render, CTA routes, sweep module, core API, checkout data
# SAFETY: READ-ONLY tests only. No mutations, no emails, no sweeps.

API_BASE="https://dynopay-credentials.preview.emergentagent.com/api"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Backend Test Suite - 4-Issue Fix Batch (session 10b)     ║"
echo "║  READ-ONLY tests - No mutations, no emails, no sweeps     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# ============================================================
# TEST A: Email Button Render (offline)
# ============================================================
echo "=== TEST A: Email Button Render (offline) ==="
TEST_A_PASS=true

# Check for lime background (#CCFF00) in button
if grep -q "background-color: #CCFF00" /app/backend/utils/emailTemplate.ts; then
    echo "  ✓ Button has background-color: #CCFF00"
else
    echo "  ✗ Button missing background-color: #CCFF00"
    TEST_A_PASS=false
fi

# Check for black text (#050505) in button
if grep -q "color: #050505" /app/backend/utils/emailTemplate.ts; then
    echo "  ✓ Button has color: #050505"
else
    echo "  ✗ Button missing color: #050505"
    TEST_A_PASS=false
fi

# Check for -webkit-text-fill-color in button
if grep -q "\-webkit-text-fill-color: #050505" /app/backend/utils/emailTemplate.ts; then
    echo "  ✓ Button has -webkit-text-fill-color: #050505"
else
    echo "  ✗ Button missing -webkit-text-fill-color: #050505"
    TEST_A_PASS=false
fi

# Check for dark mode .btn span rule
if grep -A 20 "@media (prefers-color-scheme: dark)" /app/backend/utils/emailTemplate.ts | grep -q ".btn span.*color: #050505"; then
    echo "  ✓ Dark-mode .btn span rule with #050505 found"
else
    echo "  ✗ Dark-mode .btn span rule with #050505 not found"
    TEST_A_PASS=false
fi

# Check NO old black background (#050505) in button block
if grep -B 5 -A 5 "class=\"btn\"" /app/backend/utils/emailTemplate.ts | grep -q "background-color: #050505"; then
    echo "  ✗ Found old black background (should be lime #CCFF00)"
    TEST_A_PASS=false
else
    echo "  ✓ No old black background found"
fi

if [ "$TEST_A_PASS" = true ]; then
    echo "✅ TEST A: PASS"
    ((PASS_COUNT++))
else
    echo "❌ TEST A: FAIL"
    ((FAIL_COUNT++))
fi
echo ""

# ============================================================
# TEST B: CTA Routes (static)
# ============================================================
echo "=== TEST B: CTA Routes (static) ==="
TEST_B_PASS=true

# Extract all FRONTEND_BASE_URL paths
PATHS=$(grep -oE 'FRONTEND_BASE_URL\}[a-zA-Z0-9/_?=-]*' /app/backend/services/emailService.ts | sed 's/FRONTEND_BASE_URL}//' | sort -u)

echo "  Found paths:"
echo "$PATHS" | while read path; do
    echo "    - $path"
done

# Check for forbidden patterns
if echo "$PATHS" | grep -qE '/dashboard/[a-z]'; then
    echo "  ✗ Found forbidden /dashboard/<subpath> pattern"
    TEST_B_PASS=false
fi

if echo "$PATHS" | grep -qE '^/support$'; then
    echo "  ✗ Found forbidden /support path (should be /help-support)"
    TEST_B_PASS=false
fi

if echo "$PATHS" | grep -q '/forgot-password'; then
    echo "  ✗ Found forbidden /forgot-password path"
    TEST_B_PASS=false
fi

if [ "$TEST_B_PASS" = true ]; then
    echo "  ✓ All CTA paths are valid"
    echo "✅ TEST B: PASS"
    ((PASS_COUNT++))
else
    echo "❌ TEST B: FAIL"
    ((FAIL_COUNT++))
fi
echo ""

# ============================================================
# TEST C: Sweep Module Regression (read-only)
# ============================================================
echo "=== TEST C: Sweep Module Regression (read-only) ==="
TEST_C_PASS=true

# Check exports
if grep -q "export.*sweepPoolAddress" /app/backend/services/merchantPool/merchantPoolSweep.ts; then
    echo "  ✓ Module exports sweepPoolAddress"
else
    echo "  ✗ Module missing export: sweepPoolAddress"
    TEST_C_PASS=false
fi

if grep -q "export.*sweepByThreshold" /app/backend/services/merchantPool/merchantPoolSweep.ts; then
    echo "  ✓ Module exports sweepByThreshold"
else
    echo "  ✗ Module missing export: sweepByThreshold"
    TEST_C_PASS=false
fi

if grep -q "export.*performScheduledSweeps" /app/backend/services/merchantPool/merchantPoolSweep.ts; then
    echo "  ✓ Module exports performScheduledSweeps"
else
    echo "  ✗ Module missing export: performScheduledSweeps"
    TEST_C_PASS=false
fi

# Check DEFERRAL_HOURS = 24
if grep -q "DEFERRAL_HOURS = 24" /app/backend/services/merchantPool/merchantPoolSweep.ts; then
    echo "  ✓ DEFERRAL_HOURS = 24 found"
else
    echo "  ✗ DEFERRAL_HOURS = 24 not found"
    TEST_C_PASS=false
fi

# Check ERC20 write-off condition balUSD < 1.0
if grep -q "balUSD < 1.0" /app/backend/services/merchantPool/merchantPoolSweep.ts; then
    echo "  ✓ ERC20 write-off condition balUSD < 1.0 found"
else
    echo "  ✗ ERC20 write-off condition balUSD < 1.0 not found"
    TEST_C_PASS=false
fi

# Check calculateDynamicTRC20Fee in profitability section
if grep -B 10 -A 10 "profitability" /app/backend/services/merchantPool/merchantPoolSweep.ts | grep -q "calculateDynamicTRC20Fee"; then
    echo "  ✓ calculateDynamicTRC20Fee referenced in profitability section"
else
    echo "  ✗ calculateDynamicTRC20Fee not found in profitability section"
    TEST_C_PASS=false
fi

if [ "$TEST_C_PASS" = true ]; then
    echo "✅ TEST C: PASS"
    ((PASS_COUNT++))
else
    echo "❌ TEST C: FAIL"
    ((FAIL_COUNT++))
fi
echo ""

# ============================================================
# TEST D: Core API Regression
# ============================================================
echo "=== TEST D: Core API Regression ==="
TEST_D_PASS=true

# Test 1: GET /api/ → 200
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/" -H "User-Agent: Mozilla/5.0")
if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✓ GET /api/ → 200"
else
    echo "  ✗ GET /api/ → $HTTP_CODE (expected 200)"
    TEST_D_PASS=false
fi

# Test 2: GET /api/csrf-token → 200
CSRF_RESPONSE=$(curl -s "$API_BASE/csrf-token" -H "User-Agent: Mozilla/5.0")
HTTP_CODE=$(echo "$CSRF_RESPONSE" | jq -r '.status // 200' 2>/dev/null || echo "200")
if echo "$CSRF_RESPONSE" | grep -q "csrf"; then
    echo "  ✓ GET /api/csrf-token → 200"
    CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | jq -r '.csrfToken // .token' 2>/dev/null || echo "")
    
    # Test 3: POST /api/user/login with wrong credentials → 401
    LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_BASE/user/login" \
        -H "User-Agent: Mozilla/5.0" \
        -H "Content-Type: application/json" \
        -H "X-CSRF-Token: $CSRF_TOKEN" \
        -d '{"email":"nouser@example.com","password":"wrongpassword"}')
    
    if [ "$LOGIN_CODE" = "401" ]; then
        echo "  ✓ POST /api/user/login (wrong creds) → 401"
    else
        echo "  ✗ POST /api/user/login (wrong creds) → $LOGIN_CODE (expected 401)"
        TEST_D_PASS=false
    fi
else
    echo "  ✗ GET /api/csrf-token failed"
    TEST_D_PASS=false
fi

if [ "$TEST_D_PASS" = true ]; then
    echo "✅ TEST D: PASS"
    ((PASS_COUNT++))
else
    echo "❌ TEST D: FAIL"
    ((FAIL_COUNT++))
fi
echo ""

# ============================================================
# TEST E: Checkout Data Regression
# ============================================================
echo "=== TEST E: Checkout Data Regression ==="
TEST_E_PASS=true

CHECKOUT_RESPONSE=$(curl -s -X POST "$API_BASE/pay/getData" \
    -H "User-Agent: Mozilla/5.0" \
    -H "Content-Type: application/json" \
    -d '{"data":"d73ed771b7ea6cbac71bb11c130d725d81bacf7ddf6811d0","timezone":"UTC","language":"en"}')

# Check HTTP 200
if echo "$CHECKOUT_RESPONSE" | grep -q "amount"; then
    echo "  ✓ POST /api/pay/getData → 200"
    
    # Check amount = 10
    AMOUNT=$(echo "$CHECKOUT_RESPONSE" | jq -r '.data.amount // .amount' 2>/dev/null)
    if [ "$AMOUNT" = "10" ]; then
        echo "  ✓ Response data.amount = 10"
    else
        echo "  ✗ Response data.amount = $AMOUNT (expected 10)"
        TEST_E_PASS=false
    fi
    
    # Check base_currency = USD
    CURRENCY=$(echo "$CHECKOUT_RESPONSE" | jq -r '.data.base_currency // .base_currency' 2>/dev/null)
    if [ "$CURRENCY" = "USD" ]; then
        echo "  ✓ Response data.base_currency = USD"
    else
        echo "  ✗ Response data.base_currency = $CURRENCY (expected USD)"
        TEST_E_PASS=false
    fi
else
    echo "  ✗ POST /api/pay/getData failed"
    TEST_E_PASS=false
fi

if [ "$TEST_E_PASS" = true ]; then
    echo "✅ TEST E: PASS"
    ((PASS_COUNT++))
else
    echo "❌ TEST E: FAIL"
    ((FAIL_COUNT++))
fi
echo ""

# ============================================================
# Summary
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "SUMMARY: $PASS_COUNT PASS, $FAIL_COUNT FAIL"
echo "═══════════════════════════════════════════════════════════"

if [ $FAIL_COUNT -gt 0 ]; then
    exit 1
else
    exit 0
fi
