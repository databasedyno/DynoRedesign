"""
Iteration 123 regression tests (READ-ONLY, prod-connected SAFE MODE).
Covers:
  1. Backend CORS blocked-origin handling -> 403 JSON (not 500)
  2. /sitemap.xml correctness (creators, how-to, help-support, no fabricated lastmod)
  3. /robots.txt correctness
  4. /api/shop-sitemap payload
"""
import re
import xml.etree.ElementTree as ET

import pytest
import requests

BACKEND = "http://localhost:3300"
FRONTEND = "http://localhost:3000"
NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
      "xhtml": "http://www.w3.org/1999/xhtml"}


# ─── 1. CORS blocked-origin ────────────────────────────────────────────────
class TestCorsBlockedOrigin:
    def _assert_403(self, r):
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:300]}"
        body = r.json()
        assert body.get("success") is False, body
        assert body.get("message") == "Origin not allowed", body
        assert body.get("statusCode") == 403, body

    def test_post_rsc_malformed_origin(self):
        r = requests.post(f"{BACKEND}/api/rsc",
                          headers={"Origin": "https://dynopay.me/api/rsc",
                                   "Content-Type": "application/json"},
                          json={}, timeout=20)
        self._assert_403(r)

    def test_post_login_evil_origin(self):
        r = requests.post(f"{BACKEND}/api/user/login",
                          headers={"Origin": "https://evil.example",
                                   "Content-Type": "application/json"},
                          json={"email": "x@y.z", "password": "nope"}, timeout=20)
        self._assert_403(r)

    def test_preflight_bad_origin(self):
        r = requests.options(f"{BACKEND}/api/user/login",
                             headers={"Origin": "https://evil.example",
                                      "Access-Control-Request-Method": "POST"}, timeout=20)
        assert r.status_code == 403, f"got {r.status_code}: {r.text[:300]}"

    def test_preflight_allowed_origin(self):
        r = requests.options(f"{BACKEND}/api/user/login",
                             headers={"Origin": "https://dynopay.com",
                                      "Access-Control-Request-Method": "POST"}, timeout=20)
        assert r.status_code == 204, f"got {r.status_code}: {r.text[:300]}"
        assert r.headers.get("Access-Control-Allow-Origin") == "https://dynopay.com", dict(r.headers)

    def test_get_tickers_allowed_origin(self):
        r = requests.get(f"{BACKEND}/api/public/tickers",
                         headers={"Origin": "https://dynopay.com"}, timeout=30)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        assert r.headers.get("Access-Control-Allow-Origin") == "https://dynopay.com"


# ─── 2. shop-sitemap API ───────────────────────────────────────────────────
class TestShopSitemapApi:
    def test_shop_sitemap(self):
        r = requests.get(f"{BACKEND}/api/shop-sitemap", timeout=30)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        data = r.json().get("data") or {}
        for key in ("creators", "shops", "products"):
            assert isinstance(data.get(key), list), f"{key} missing/not list: {data.keys()}"
        assert len(data["creators"]) >= 5, f"only {len(data['creators'])} creators"
        assert all(isinstance(c.get("handle"), str) and c["handle"] for c in data["creators"])


# ─── 3. sitemap.xml ────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def sitemap():
    r = requests.get(f"{FRONTEND}/sitemap.xml", timeout=90)
    assert r.status_code == 200, f"got {r.status_code}"
    assert "xml" in r.headers.get("Content-Type", ""), r.headers.get("Content-Type")
    root = ET.fromstring(r.text)
    return r.text, root


class TestSitemap:
    def _locs(self, root):
        return [u.find("sm:loc", NS).text for u in root.findall("sm:url", NS)]

    def test_static_pages_present(self, sitemap):
        _, root = sitemap
        locs = self._locs(root)
        for p in ["https://dynopay.com/how-to", "https://dynopay.com/help-support",
                  "https://dynopay.com/fees", "https://dynopay.com/"]:
            assert p in locs, f"{p} missing"

    def test_creator_pages(self, sitemap):
        _, root = sitemap
        locs = self._locs(root)
        creators = [l for l in locs
                    if re.fullmatch(r"https://dynopay\.com/[A-Za-z0-9._-]+", l)
                    and not l.rstrip("/").endswith(("/fees", "/how-to", "/help-support", "/blog",
                                                    "/about", "/press", "/referral-program",
                                                    "/system-status", "/terms-conditions",
                                                    "/privacy-policy", "/aml-policy",
                                                    "/documentation"))]
        assert len(creators) >= 5, f"only {len(creators)} creator-like URLs: {creators}"

    def test_shop_and_product_entries(self, sitemap):
        _, root = sitemap
        locs = self._locs(root)
        assert any(l.endswith("/shop") for l in locs), "no /{handle}/shop entries"
        assert any("/p/" in l for l in locs), "no product entries"

    def test_fees_has_no_lastmod_blog_has(self, sitemap):
        _, root = sitemap
        by_loc = {u.find("sm:loc", NS).text: u for u in root.findall("sm:url", NS)}
        fees = by_loc["https://dynopay.com/fees"]
        assert fees.find("sm:lastmod", NS) is None, "fees should have no lastmod"
        blogs = [u for loc, u in by_loc.items() if "/blog/" in loc]
        assert blogs, "no blog entries"
        for b in blogs:
            lm = b.find("sm:lastmod", NS)
            assert lm is not None, "blog entry missing lastmod"
            assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", lm.text), lm.text

    def test_hreflang_alternates(self, sitemap):
        _, root = sitemap
        for u in root.findall("sm:url", NS):
            loc = u.find("sm:loc", NS).text
            links = u.findall("xhtml:link", NS)
            if "/blog/" in loc or "/help-support/" in loc:
                assert len(links) == 0, f"{loc} should have no hreflang, has {len(links)}"
            else:
                assert len(links) == 7, f"{loc} has {len(links)} alternates (expected 6+x-default)"
                assert any(l.get("hreflang") == "x-default" for l in links), loc


# ─── 4. robots.txt ─────────────────────────────────────────────────────────
class TestRobots:
    def test_robots(self):
        r = requests.get(f"{FRONTEND}/robots.txt", timeout=60)
        assert r.status_code == 200
        t = r.text
        assert "Allow: /help-support" in t
        assert "Disallow: /help-support" not in t
        for d in ["Disallow: /pay/demo", "Disallow: /order/", "Disallow: /payment/",
                  "Disallow: /qa", "Disallow: /kyc/", "Disallow: /wallet-security",
                  "Disallow: /unsubscribe", "Disallow: /payouts"]:
            assert d in t, f"missing {d}"
        assert "Sitemap: https://dynopay.com/sitemap.xml" in t
