"""
Iteration 164 backend regression:
- Error envelope + Request-Id header on missing x-api-key
- Rich share card OG image (demo=1 -> PNG, no params -> 302 fallback)
"""
import os
import io
import struct
import requests

BASE = "https://speedup-check.preview.emergentagent.com"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
HDRS = {"User-Agent": UA, "Accept": "*/*"}


class TestErrorEnvelope:
    def test_missing_api_key_returns_envelope_and_request_id(self):
        r = requests.get(f"{BASE}/api/user/getSupportedCurrency", headers=HDRS, timeout=30)
        assert r.status_code == 401, f"status={r.status_code} body={r.text[:400]}"
        body = r.json()
        # Legacy backward-compat fields
        assert body.get("success") is False
        assert "message" in body
        # Additive error object
        err = body.get("error")
        assert isinstance(err, dict), f"error object missing: {body}"
        assert err.get("type") == "authentication_error", err
        assert err.get("code") == "api_key_missing", err
        assert err.get("doc_url"), err
        assert err.get("request_id"), err
        # Response header Request-Id must equal error.request_id
        hdr = r.headers.get("Request-Id") or r.headers.get("request-id")
        assert hdr, f"missing Request-Id header, got headers: {dict(r.headers)}"
        assert hdr == err["request_id"], (hdr, err["request_id"])

    def test_missing_key_on_single_tx_endpoint_also_envelope(self):
        r = requests.get(f"{BASE}/api/user/getSingleTransaction/does-not-exist", headers=HDRS, timeout=30)
        assert r.status_code == 401
        body = r.json()
        err = body.get("error", {})
        assert err.get("type") == "authentication_error"
        assert err.get("code") == "api_key_missing"
        assert err.get("request_id")
        assert r.headers.get("Request-Id") == err.get("request_id")


class TestOgImage:
    def test_demo_returns_png(self):
        r = requests.get(f"{BASE}/api/pay/og-image?demo=1", headers=HDRS, timeout=60)
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
        ct = r.headers.get("Content-Type", "")
        assert "image/png" in ct, ct
        body = r.content
        assert len(body) > 50_000, f"png too small: {len(body)} bytes"
        # PNG magic
        assert body[:8] == b"\x89PNG\r\n\x1a\n", "not a valid PNG header"
        # Parse IHDR (first chunk) to get width/height
        # 8 bytes signature, then 4 byte length, 4 byte type 'IHDR', then 4 width, 4 height
        width = struct.unpack(">I", body[16:20])[0]
        height = struct.unpack(">I", body[20:24])[0]
        assert width == 1200 and height == 630, f"dims={width}x{height}"

    def test_no_params_redirects_to_fallback(self):
        r = requests.get(f"{BASE}/api/pay/og-image", headers=HDRS, timeout=30, allow_redirects=False)
        assert r.status_code in (301, 302, 307, 308), f"status={r.status_code}"
        loc = r.headers.get("Location", "")
        assert loc.endswith("/og/dynopay-og.png"), f"location={loc}"
