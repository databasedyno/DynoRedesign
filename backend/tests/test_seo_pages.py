"""SEO landing pages test - verifies country + vertical pages return 200 with real content."""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://merchant-onboard-19.preview.emergentagent.com").rstrip("/")

COUNTRIES = [
    "united-states", "united-kingdom", "germany", "india",
    "nigeria", "brazil", "turkey", "vietnam",
]
VERTICALS = [
    "ecommerce", "saas", "freelancers", "gaming", "remittance", "digital-downloads",
]

NOT_FOUND_MARKER = "not found or is unavailable"

# Warm-up: Next.js dev mode compiles on demand
@pytest.fixture(scope="session", autouse=True)
def warmup():
    for slug in COUNTRIES[:1]:
        requests.get(f"{BASE_URL}/accept-crypto-payments-in/{slug}", timeout=60)
    for slug in VERTICALS[:1]:
        requests.get(f"{BASE_URL}/for/{slug}", timeout=60)


@pytest.mark.parametrize("slug", COUNTRIES)
def test_country_page_returns_200_with_content(slug):
    url = f"{BASE_URL}/accept-crypto-payments-in/{slug}"
    r = requests.get(url, timeout=60)
    assert r.status_code == 200, f"{url} returned {r.status_code}"
    body = r.text
    assert NOT_FOUND_MARKER not in body, f"{url} shows 404 error content"
    # Country name should appear somewhere (case-insensitive, may be hyphenated)
    country_words = slug.replace("-", " ")
    assert re.search(country_words, body, re.IGNORECASE), f"{url} missing country name '{country_words}' in body"
    # Some H1 must exist
    assert re.search(r"<h1[^>]*>", body, re.IGNORECASE), f"{url} has no <h1>"


@pytest.mark.parametrize("slug", VERTICALS)
def test_vertical_page_returns_200_with_content(slug):
    url = f"{BASE_URL}/for/{slug}"
    r = requests.get(url, timeout=60)
    assert r.status_code == 200, f"{url} returned {r.status_code}"
    body = r.text
    assert NOT_FOUND_MARKER not in body, f"{url} shows 404 error content"
    assert re.search(r"<h1[^>]*>", body, re.IGNORECASE), f"{url} has no <h1>"


def test_homepage_seo_links_all_resolve():
    """Collect every /accept-crypto-payments-in/ and /for/ href on homepage; each must 200."""
    r = requests.get(f"{BASE_URL}/", timeout=60)
    assert r.status_code == 200
    hrefs = set(re.findall(r'href="(/accept-crypto-payments-in/[^"#?]+)"', r.text))
    hrefs |= set(re.findall(r'href="(/for/[^"#?]+)"', r.text))
    # Filter out plain /for/ (would be a directory link) and anchors
    hrefs = {h for h in hrefs if h not in ("/for/", "/accept-crypto-payments-in/")}
    assert len(hrefs) > 0, "No SEO links found on homepage — homepage may not be rendering them"
    failing = []
    for href in sorted(hrefs):
        resp = requests.get(f"{BASE_URL}{href}", timeout=60)
        if resp.status_code != 200 or NOT_FOUND_MARKER in resp.text:
            failing.append((href, resp.status_code))
    assert not failing, f"Broken homepage SEO links: {failing}"


def test_sitemap_contains_all_seo_urls():
    r = requests.get(f"{BASE_URL}/sitemap.xml", timeout=60)
    assert r.status_code == 200, f"/sitemap.xml returned {r.status_code}"
    assert "xml" in r.headers.get("content-type", "").lower() or r.text.lstrip().startswith("<?xml")
    body = r.text
    missing = []
    for slug in COUNTRIES:
        if f"/accept-crypto-payments-in/{slug}" not in body:
            missing.append(f"country:{slug}")
    for slug in VERTICALS:
        if f"/for/{slug}" not in body:
            missing.append(f"vertical:{slug}")
    assert not missing, f"Sitemap missing URLs: {missing}"


def test_unknown_country_returns_404():
    r = requests.get(f"{BASE_URL}/accept-crypto-payments-in/atlantis", timeout=60)
    assert r.status_code == 404, f"Expected 404 for unknown country, got {r.status_code}"


def test_unknown_vertical_returns_404():
    r = requests.get(f"{BASE_URL}/for/unknown-vertical-xyz", timeout=60)
    assert r.status_code == 404, f"Expected 404 for unknown vertical, got {r.status_code}"


def test_server_still_serves_after_404():
    """Regression: after 404 for unknown slug, valid page still 200 (no crash)."""
    requests.get(f"{BASE_URL}/accept-crypto-payments-in/atlantis", timeout=60)
    r = requests.get(f"{BASE_URL}/accept-crypto-payments-in/india", timeout=60)
    assert r.status_code == 200
    assert NOT_FOUND_MARKER not in r.text
