"""SSR SEO verification tests for Dynopay: help center bodies, JSON-LD schemas, i18n."""
import re
import json
import pytest
import requests

BASE = "https://50ef14bb-0f38-4cdd-b053-5f782bcefcf9.preview.emergentagent.com"

HELP_SLUGS = [
    "supported-cryptocurrencies-and-networks",
    "how-crypto-payments-work-for-merchants",
    "fees-rates-and-conversion-logic",
    "wallets-payouts-and-settlement-options",
    "invoices-checkout-and-payment-links",
    "api-and-integrations",
    "security-and-transaction-safety",
]


def fetch(url, retries=2):
    last = None
    for _ in range(retries + 1):
        try:
            r = requests.get(url, timeout=45)
            if r.status_code == 200:
                return r
            last = r
        except Exception as e:
            last = e
    if isinstance(last, requests.Response):
        return last
    raise last


def extract_jsonld(html):
    blocks = re.findall(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
        html, re.DOTALL,
    )
    parsed = []
    for b in blocks:
        try:
            parsed.append(json.loads(b.strip()))
        except Exception as e:
            parsed.append({"__parse_error__": str(e), "__raw__": b[:200]})
    return parsed


def get_html_lang(html):
    m = re.search(r'<html[^>]*\blang="([^"]+)"', html)
    return m.group(1) if m else None


def get_canonical(html):
    m = re.search(r'<link[^>]*rel="canonical"[^>]*href="([^"]+)"', html)
    if not m:
        m = re.search(r'<link[^>]*href="([^"]+)"[^>]*rel="canonical"', html)
    return m.group(1) if m else None


def get_hreflangs(html):
    out = {}
    for m in re.finditer(
        r'<link[^>]*rel="alternate"[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"', html, re.I
    ):
        out[m.group(1)] = m.group(2)
    for m in re.finditer(
        r'<link[^>]*hreflang="([^"]+)"[^>]*rel="alternate"[^>]*href="([^"]+)"', html, re.I
    ):
        out.setdefault(m.group(1), m.group(2))
    return out


# ---------- Regression: 200 & content ----------

@pytest.mark.parametrize("path", ["/", "/fees", "/help-support",
                                   "/for/creators", "/for/merchants", "/for/developers"])
def test_pages_200(path):
    r = fetch(BASE + path)
    assert r.status_code == 200, f"{path} -> {r.status_code}"
    assert len(r.text) > 1000
    # not blank
    assert "<body" in r.text.lower()


# ---------- Help Center list page ----------

def test_help_support_index_lists_articles():
    r = fetch(BASE + "/help-support")
    assert r.status_code == 200
    # Should reference at least 6 of the 7 known slugs
    found = sum(1 for s in HELP_SLUGS if s in r.text)
    assert found >= 6, f"help-support index only mentions {found}/7 slugs"


# ---------- Help Center article body SSR ----------

@pytest.mark.parametrize("slug", HELP_SLUGS)
def test_help_article_full_body_ssr(slug):
    url = f"{BASE}/help-support/{slug}"
    r = fetch(url)
    assert r.status_code == 200, f"{url} -> {r.status_code}"
    html = r.text
    # h1 present
    assert re.search(r"<h1[\s>]", html), f"{slug} missing <h1>"
    # multiple h2 headings (sections)
    h2s = re.findall(r"<h2[\s>]", html)
    assert len(h2s) >= 2, f"{slug} has only {len(h2s)} <h2> section headings in SSR"
    # multiple paragraphs
    ps = re.findall(r"<p[\s>]", html)
    assert len(ps) >= 3, f"{slug} has only {len(ps)} <p> tags in SSR"


# ---------- /fees JSON-LD ----------

def test_fees_jsonld_faq_and_service():
    r = fetch(BASE + "/fees")
    assert r.status_code == 200
    blocks = extract_jsonld(r.text)
    for b in blocks:
        assert "__parse_error__" not in b, f"Invalid JSON-LD: {b}"
    types = [b.get("@type") for b in blocks]
    assert "FAQPage" in types, f"/fees missing FAQPage JSON-LD; got {types}"
    assert "Service" in types, f"/fees missing Service JSON-LD; got {types}"
    # FAQ must have entities
    faq = next(b for b in blocks if b.get("@type") == "FAQPage")
    assert isinstance(faq.get("mainEntity"), list) and len(faq["mainEntity"]) > 0
    for q in faq["mainEntity"]:
        assert q.get("@type") == "Question"
        assert q.get("acceptedAnswer", {}).get("@type") == "Answer"
    # Service must have OfferCatalog (under hasOfferCatalog or offers)
    svc = next(b for b in blocks if b.get("@type") == "Service")
    catalog = svc.get("hasOfferCatalog") or svc.get("offers") or {}
    assert catalog.get("@type") == "OfferCatalog"
    assert isinstance(catalog.get("itemListElement"), list) and len(catalog["itemListElement"]) > 0


# ---------- /for/* JSON-LD (Product/SoftwareApplication is NEW) ----------

@pytest.mark.parametrize("vertical", ["creators", "merchants", "developers"])
def test_for_vertical_jsonld(vertical):
    r = fetch(f"{BASE}/for/{vertical}")
    assert r.status_code == 200
    blocks = extract_jsonld(r.text)
    for b in blocks:
        assert "__parse_error__" not in b, f"Invalid JSON-LD on /for/{vertical}: {b}"
    types = [b.get("@type") for b in blocks]
    for expected in ["FAQPage", "WebPage", "BreadcrumbList", "SoftwareApplication"]:
        assert expected in types, f"/for/{vertical} missing {expected}; got {types}"
    # SoftwareApplication with nested Offer
    app = next(b for b in blocks if b.get("@type") == "SoftwareApplication")
    offer = app.get("offers")
    assert isinstance(offer, dict), f"SoftwareApplication.offers not object: {offer}"
    assert offer.get("@type") == "Offer"
    # price 0, USD
    assert str(offer.get("price")) in ("0", "0.0", "0.00")
    assert offer.get("priceCurrency") == "USD"


# ---------- Multilingual ----------

LANG_CASES = [
    ("/fees", "fr"),
    ("/", "de"),
    ("/for/creators", "fr"),
    ("/help-support/api-and-integrations", "es"),
]


@pytest.mark.parametrize("path,lang", LANG_CASES)
def test_multilingual_ssr(path, lang):
    url = f"{BASE}{path}?lang={lang}"
    r = fetch(url)
    assert r.status_code == 200, f"{url} -> {r.status_code}"
    html = r.text
    # html lang attr
    hl = get_html_lang(html)
    assert hl == lang, f"{url} <html lang> is '{hl}', expected '{lang}'"
    # canonical points to same URL with ?lang=
    canon = get_canonical(html)
    assert canon and f"lang={lang}" in canon, f"{url} canonical is '{canon}'"
    # hreflang alternates: 7 langs + x-default
    alts = get_hreflangs(html)
    for code in ["en", "pt", "fr", "es", "de", "nl"]:
        assert code in alts, f"{url} missing hreflang '{code}'; got {list(alts)}"
    assert "x-default" in alts, f"{url} missing x-default hreflang; got {list(alts)}"


@pytest.mark.parametrize("path", ["/fees", "/", "/for/creators", "/help-support/api-and-integrations"])
def test_english_default(path):
    url = BASE + path
    r = fetch(url)
    assert r.status_code == 200
    html = r.text
    hl = get_html_lang(html)
    assert hl == "en", f"{url} <html lang> is '{hl}', expected 'en'"
    canon = get_canonical(html)
    assert canon, f"{url} missing canonical"
    assert "lang=" not in canon, f"{url} en canonical has lang param: {canon}"
