"""
Iteration 165 backend regression:
- OG image share cards: demo=1, shop=jltvisuals, shop=devhub, no-params fallback, bad handle fallback
- Error envelope + Request-Id on apiKeyOnlyMiddleware and legacyApiAuthMiddleware paths
"""
import struct
import requests

BASE = "https://cred-manager-29.preview.emergentagent.com"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
HDRS = {"User-Agent": UA, "Accept": "*/*"}


def _assert_valid_png(body: bytes, min_size: int = 20_000):
    assert body[:8] == b"\x89PNG\r\n\x1a\n", "not a valid PNG header"
    assert len(body) > min_size, f"png too small: {len(body)} bytes"
    width = struct.unpack(">I", body[16:20])[0]
    height = struct.unpack(">I", body[20:24])[0]
    assert width == 1200 and height == 630, f"dims={width}x{height}"
    return width, height, len(body)


class TestOgImage:
    def test_demo_returns_valid_png(self):
        r = requests.get(f"{BASE}/api/pay/og-image?demo=1", headers=HDRS, timeout=60)
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
        assert "image/png" in r.headers.get("Content-Type", "")
        w, h, n = _assert_valid_png(r.content, min_size=50_000)
        print(f"demo=1 -> {w}x{h} {n} bytes")

    def test_shop_jltvisuals_returns_valid_png(self):
        r = requests.get(f"{BASE}/api/pay/og-image?shop=jltvisuals", headers=HDRS, timeout=60)
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
        assert "image/png" in r.headers.get("Content-Type", "")
        w, h, n = _assert_valid_png(r.content, min_size=50_000)
        print(f"shop=jltvisuals -> {w}x{h} {n} bytes")
        # request says ~130-160KB; assert generous >=80KB (with logo it's typically larger than devhub)
        assert n > 80_000, f"jltvisuals PNG unexpectedly small: {n}"

    def test_shop_devhub_returns_valid_png(self):
        r = requests.get(f"{BASE}/api/pay/og-image?shop=devhub", headers=HDRS, timeout=60)
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
        assert "image/png" in r.headers.get("Content-Type", "")
        w, h, n = _assert_valid_png(r.content, min_size=20_000)
        print(f"shop=devhub -> {w}x{h} {n} bytes")

    def test_no_params_redirects_to_fallback(self):
        r = requests.get(f"{BASE}/api/pay/og-image", headers=HDRS, timeout=30, allow_redirects=False)
        assert r.status_code in (301, 302, 307, 308), f"status={r.status_code}"
        loc = r.headers.get("Location", "")
        assert loc.endswith("/og/dynopay-og.png"), f"location={loc}"

    def test_bad_handle_redirects_to_fallback(self):
        r = requests.get(
            f"{BASE}/api/pay/og-image?shop=___no_such_handle___",
            headers=HDRS,
            timeout=30,
            allow_redirects=False,
        )
        assert r.status_code in (301, 302, 307, 308), f"status={r.status_code} body={r.text[:200]}"
        loc = r.headers.get("Location", "")
        assert loc.endswith("/og/dynopay-og.png"), f"location={loc}"


class TestErrorEnvelope:
    def test_getSupportedCurrency_missing_key_envelope(self):
        r = requests.get(f"{BASE}/api/user/getSupportedCurrency", headers=HDRS, timeout=30)
        assert r.status_code == 401, f"status={r.status_code} body={r.text[:400]}"
        body = r.json()
        assert body.get("success") is False
        assert "message" in body
        err = body.get("error")
        assert isinstance(err, dict), f"error object missing: {body}"
        assert err.get("type") == "authentication_error", err
        assert err.get("code") == "api_key_missing", err
        assert err.get("doc_url"), err
        assert err.get("request_id"), err
        hdr = r.headers.get("Request-Id") or r.headers.get("request-id")
        assert hdr, f"missing Request-Id header, got headers: {dict(r.headers)}"
        assert hdr == err["request_id"], (hdr, err["request_id"])

    def test_getSingleTransaction_missing_key_envelope(self):
        r = requests.get(
            f"{BASE}/api/user/getSingleTransaction/x", headers=HDRS, timeout=30
        )
        assert r.status_code == 401, f"status={r.status_code} body={r.text[:400]}"
        body = r.json()
        assert body.get("success") is False
        assert "message" in body
        err = body.get("error")
        assert isinstance(err, dict), f"error object missing: {body}"
        assert err.get("type") == "authentication_error", err
        assert err.get("code") == "api_key_missing", err
        assert err.get("doc_url"), err
        assert err.get("request_id"), err
        hdr = r.headers.get("Request-Id") or r.headers.get("request-id")
        assert hdr, f"missing Request-Id header, got headers: {dict(r.headers)}"
        assert hdr == err["request_id"], (hdr, err["request_id"])
