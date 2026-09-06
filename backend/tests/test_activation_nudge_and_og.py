"""
Tests for:
  (A) POST /api/user/activation-nudge  (real backend, no interception)
  (B) SEO og:image / twitter:image on /fees /about /how-to /blog (+ / default)
  (C) GET /og/*.png returns 200 image/png 1200x630

Merchant: onarrival21@gmail.com / Katiekendra123@  (all gates already satisfied
so every gate check must return 200 sent:false gate_not_open — no email is
attempted, which is the safe/read-only behaviour we want on a live-prod pod.)
"""

import os
import re
import struct
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to public preview URL from the task
    BASE_URL = "https://great-moore-13.preview.emergentagent.com"

EMAIL = "onarrival21@gmail.com"
PASSWORD = "Katiekendra123@"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/user/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    tok = (body.get("data") or {}).get("accessToken") or body.get("accessToken")
    assert tok, f"no accessToken in login response: {body}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --- (A) activation-nudge ---------------------------------------------------

class TestActivationNudge:
    def _post(self, headers, body):
        return requests.post(
            f"{BASE_URL}/api/user/activation-nudge",
            headers=headers,
            json=body,
            timeout=30,
        )

    def test_brand_gate_not_open(self, auth_headers):
        r = self._post(auth_headers, {"gate": "brand"})
        assert r.status_code == 200, r.text[:300]
        data = r.json().get("data") or {}
        assert data.get("sent") is False
        assert data.get("reason") == "gate_not_open"

    def test_wallet_gate_not_open(self, auth_headers):
        r = self._post(auth_headers, {"gate": "wallet", "company_id": 1})
        assert r.status_code == 200, r.text[:300]
        data = r.json().get("data") or {}
        assert data.get("sent") is False
        assert data.get("reason") == "gate_not_open"

    def test_kyc_gate_not_open(self, auth_headers):
        r = self._post(auth_headers, {"gate": "kyc", "company_id": 1})
        assert r.status_code == 200, r.text[:300]
        data = r.json().get("data") or {}
        assert data.get("sent") is False
        assert data.get("reason") == "gate_not_open"

    def test_invalid_gate_returns_400(self, auth_headers):
        r = self._post(auth_headers, {"gate": "bogus"})
        assert r.status_code == 400, r.text[:300]
        body = r.json()
        # error string per controller
        msg = (body.get("message") or body.get("error") or "").lower()
        assert "gate" in msg and "brand" in msg and "wallet" in msg and "kyc" in msg

    def test_unauthenticated_rejected(self):
        r = requests.post(
            f"{BASE_URL}/api/user/activation-nudge",
            json={"gate": "kyc"},
            timeout=30,
        )
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code} {r.text[:200]}"


# --- (B) SEO OG images ------------------------------------------------------

OG_RE_OG = re.compile(
    r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
OG_RE_TW = re.compile(
    r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)


def _extract_og(html: str):
    og = OG_RE_OG.search(html)
    tw = OG_RE_TW.search(html)
    return (og.group(1) if og else None, tw.group(1) if tw else None)


@pytest.mark.parametrize(
    "path,expected",
    [
        ("/fees", "https://dynopay.com/og/fees.png"),
        ("/about", "https://dynopay.com/og/about.png"),
        ("/how-to", "https://dynopay.com/og/how-to.png"),
        ("/blog", "https://dynopay.com/og/blog.png"),
        ("/", "https://dynopay.com/og/dynopay-og.png"),
    ],
)
def test_og_and_twitter_image_on_marketing_pages(path, expected):
    r = requests.get(f"{BASE_URL}{path}", timeout=45, allow_redirects=True)
    assert r.status_code == 200, f"GET {path} -> {r.status_code}"
    og, tw = _extract_og(r.text)
    assert og == expected, f"{path} og:image={og!r} expected={expected!r}"
    assert tw == expected, f"{path} twitter:image={tw!r} expected={expected!r}"


# --- (C) OG PNGs exist, correct dims ----------------------------------------

def _png_dims(content: bytes):
    # PNG signature 8 bytes, then IHDR chunk: 4 len + 4 "IHDR" + 4 width + 4 height ...
    assert content[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    assert content[12:16] == b"IHDR"
    w, h = struct.unpack(">II", content[16:24])
    return w, h


@pytest.mark.parametrize("fname", ["fees.png", "about.png", "how-to.png", "blog.png"])
def test_og_png_served_1200x630(fname):
    r = requests.get(f"{BASE_URL}/og/{fname}", timeout=30)
    assert r.status_code == 200, f"/og/{fname} -> {r.status_code}"
    ctype = r.headers.get("content-type", "")
    assert "image/png" in ctype, f"/og/{fname} content-type={ctype!r}"
    w, h = _png_dims(r.content)
    assert (w, h) == (1200, 630), f"/og/{fname} dims={w}x{h}"
