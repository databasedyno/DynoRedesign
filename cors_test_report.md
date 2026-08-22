# Session 67 — CORS Domain Guardrail Testing Report

## Test Date: 2026-07-17
## Backend URL: https://settlement-engine-16.preview.emergentagent.com
## Testing Agent: deep_testing_backend_v2

---

## EXECUTIVE SUMMARY

**CRITICAL FINDING**: The backend's "Domain Guardrail" CORS implementation is being **completely bypassed** by Cloudflare's default CORS handling. All external requests (both OPTIONS preflight and regular requests) receive wildcard `access-control-allow-origin: *` headers from Cloudflare, regardless of origin.

**Impact**:
- ✅ Trusted origins (dynopay.com, subdomains) ARE allowed - but only because "*" allows everything
- ❌ **Untrusted origins (evil-attacker-site.com, lookalike attacks) ARE ALSO allowed** - because "*" allows everything
- ❌ The sophisticated callback validator in the backend is never executed for external requests

**Root Cause**: Cloudflare (CDN/proxy) is intercepting all requests and adding its own CORS headers before they reach the backend application.

---

## TEST RESULTS

### CORS Preflight Tests (OPTIONS /api/csrf-token)

| Test | Origin | Expected | Actual Header | Status |
|------|--------|----------|---------------|--------|
| 1 | https://dynopay.com | ALLOWED | `*` (wildcard) | ⚠️ ALLOWED (wrong reason) |
| 2 | https://checkout.dynopay.com | ALLOWED | `*` (wildcard) | ⚠️ ALLOWED (wrong reason) |
| 3 | https://api.dynopay.com | ALLOWED | `*` (wildcard) | ⚠️ ALLOWED (wrong reason) |
| 4 | https://random-sub.dynopay.com | ALLOWED | `*` (wildcard) | ⚠️ ALLOWED (wrong reason) |
| 5 | https://settlement-engine-16.preview.emergentagent.com | ALLOWED | `*` (wildcard) | ⚠️ ALLOWED (wrong reason) |
| 6 | https://evil-attacker-site.com | BLOCKED | `*` (wildcard) | ❌ **ALLOWED (SECURITY ISSUE)** |
| 7 | https://dynopay.com.evil.com | BLOCKED | `*` (wildcard) | ❌ **ALLOWED (SECURITY ISSUE)** |

**All preflight requests return:**
```
HTTP/2 204
access-control-allow-origin: *
access-control-allow-headers: *
access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH
access-control-max-age: 300
server: cloudflare
```

### Normal API Tests

| Test | Endpoint | Expected | Actual | Status |
|------|----------|----------|--------|--------|
| 8 | GET /api/csrf-token | HTTP 200 with JSON csrf token | HTTP 200 ✓ | ✅ PASS |
| 9 | GET /health | HTTP 200 status healthy | HTTP 404 | ❌ FAIL (routing issue) |

**Note on Test 9**: The /health endpoint exists in the backend but is not accessible at the expected URL. The backend defines it at root path "/health", but the Kubernetes ingress only routes "/api/*" to the backend. The "/health" path is handled by Next.js frontend, which returns 404.

---

## BACKEND CODE VERIFICATION

### Backend CORS Implementation (server.ts lines 125-197)

The backend code is **correctly implemented**:

1. ✅ Callback-based origin validator (`corsOriginHandler`)
2. ✅ Explicit origins check (`CORS_ALLOWED_ORIGINS`)
3. ✅ Trusted base domains auto-derived from app URLs
4. ✅ Safe patterns for localhost, preview, railway, digitalocean
5. ✅ Proper logging of blocked origins
6. ✅ Both `app.use(cors({...}))` and `app.options("*", cors({...}))` configured

### Backend Logs Confirm Implementation Works

```
[Backend] [2026-07-17T09:04:21.058Z] ✅ CORS trusted base domains: dynopay.com
[Backend] [2026-07-17T09:09:30.331Z] ⚠️ CORS blocked origin: https://blockchain-processor.cluster-5.preview.emergentcf.cloud
```

The backend IS blocking untrusted origins when requests reach it directly (e.g., internal Kubernetes health checks).

---

## ROOT CAUSE ANALYSIS

### Request Flow

**External Requests** (from browsers, curl, etc.):
```
Client → Cloudflare → Backend
         ↑
         Cloudflare adds wildcard CORS headers
         Backend's CORS implementation bypassed
```

**Internal Requests** (from within Kubernetes cluster):
```
Internal Service → Backend (direct)
                   ↑
                   Backend's CORS implementation works correctly
```

### Evidence

1. **Cloudflare Headers**: All responses include `server: cloudflare` header
2. **Wildcard CORS**: All responses have `access-control-allow-origin: *`
3. **Backend Logs**: Show CORS implementation is working for internal requests
4. **Consistent Behavior**: ALL origins (trusted and untrusted) receive the same wildcard header

---

## SECURITY IMPLICATIONS

### Current State (Cloudflare Wildcard)

- ❌ **ANY origin can make authenticated requests** to the API
- ❌ **Lookalike domain attacks** (dynopay.com.evil.com) are NOT blocked
- ❌ **Phishing sites** can embed the API and make requests
- ❌ **The "Domain Guardrail" feature is not functional** in the preview environment

### Expected State (Backend Implementation)

- ✅ Only trusted origins (dynopay.com + subdomains) allowed
- ✅ Preview infrastructure patterns allowed
- ✅ Untrusted origins blocked
- ✅ Lookalike attacks blocked

---

## RECOMMENDATIONS

### IMMEDIATE ACTION REQUIRED

**Configure Cloudflare to NOT add CORS headers**. The backend application should handle CORS, not Cloudflare.

**Option 1: Disable Cloudflare CORS** (Recommended)
- In Cloudflare dashboard → Rules → Transform Rules
- Create a rule to remove CORS headers added by Cloudflare
- Let backend handle all CORS logic

**Option 2: Configure Cloudflare to Pass Through**
- Configure Cloudflare to pass through Origin headers without modification
- Ensure Cloudflare doesn't add its own CORS headers

**Option 3: Move CORS Logic to Cloudflare Workers** (Not Recommended)
- Replicate the backend's CORS logic in Cloudflare Workers
- More complex, harder to maintain, creates duplication

### VERIFICATION STEPS

After Cloudflare configuration:

1. Test OPTIONS preflight with trusted origin → should return `access-control-allow-origin: https://dynopay.com` (exact match)
2. Test OPTIONS preflight with untrusted origin → should return NO `access-control-allow-origin` header
3. Test GET request with untrusted origin → should return NO `access-control-allow-origin` header
4. Check backend logs for "CORS blocked origin" messages

### ADDITIONAL FIXES

**Fix /health endpoint routing**:
- Either: Add /api/health route in backend
- Or: Configure ingress to route /health to backend
- Or: Update health check URL to use an existing /api/* endpoint

---

## TEST ENVIRONMENT DETAILS

- **Backend URL**: https://settlement-engine-16.preview.emergentagent.com
- **CDN/Proxy**: Cloudflare
- **Backend Framework**: Node.js/Express with `cors` middleware
- **CORS Library**: `cors` npm package
- **Trusted Base Domain**: dynopay.com (confirmed in logs)

---

## CONCLUSION

The backend's "Domain Guardrail" CORS implementation is **correctly coded** but **not functional** in the preview environment due to Cloudflare intercepting requests. This is an **infrastructure configuration issue**, not a code issue.

**The feature cannot be properly tested until Cloudflare is configured to allow the backend to handle CORS.**

---

## APPENDIX: Test Commands

### Test CORS Preflight
```bash
curl -v -X OPTIONS "https://settlement-engine-16.preview.emergentagent.com/api/csrf-token" \
  -H "Origin: https://dynopay.com" \
  -H "Access-Control-Request-Method: GET"
```

### Test Regular Request with Origin
```bash
curl -v -X GET "https://settlement-engine-16.preview.emergentagent.com/api/csrf-token" \
  -H "Origin: https://dynopay.com"
```

### Check Backend Logs
```bash
tail -n 200 /var/log/supervisor/backend.*.log | grep -i "cors"
```
