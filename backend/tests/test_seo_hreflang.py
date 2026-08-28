"""Regression tests for hreflang / canonical SEO tags on public shop + product pages.

Verifies: exactly 1 canonical, 7 hreflang alternates (en,es,pt,fr,de,nl,x-default),
1 og:locale per page, correct URLs, no broken 'dynopay.com//' host in <link> tags.
"""
import os
import re
import pytest
import requests

BASE = "https://crypto-checkout-45.preview.emergentagent.com"
HANDLE = "devhub"
SLUG = "talk-to-a-developer"
LANGS = ["en", "es", "pt", "fr", "de", "nl"]

SHOP_BARE = f"{BASE}/{HANDLE}/shop"
PROD_BARE = f"{BASE}/{HANDLE}/p/{SLUG}"


def _fetch(url):
    # Cloudflare edge can flap; retry a couple of times.
    last = None
    for _ in range(3):
        r = requests.get(url, timeout=30)
        last = r
        if r.status_code == 200:
            return r.text
    assert last.status_code == 200, f"{url} -> {last.status_code}"
    return last.text


def _canonicals(html):
    return re.findall(r'<link[^>]*rel="canonical"[^>]*href="([^"]+)"', html, re.I)


def _hreflangs(html):
    # matches both hreflang and hrefLang (React camelCase)
    return re.findall(
        r'<link[^>]*rel="alternate"[^>]*href[Ll]ang="([^"]+)"[^>]*href="([^"]+)"',
        html,
    )


def _og_locales(html):
    return re.findall(r'<meta[^>]*property="og:locale"[^>]*content="([^"]+)"', html, re.I)


def _titles(html):
    return re.findall(r"<title>([^<]*)</title>", html, re.I)


def _assert_hreflang_cluster(html, base_url):
    hl = _hreflangs(html)
    langs_seen = [l for l, _ in hl]
    # exactly one tag per hreflang value (no duplicates)
    assert len(langs_seen) == len(set(langs_seen)), f"duplicate hreflang tags: {langs_seen}"
    expected = set(LANGS + ["x-default"])
    assert set(langs_seen) == expected, f"expected {expected}, got {set(langs_seen)}"
    d = dict(hl)
    assert d["en"] == base_url
    assert d["x-default"] == base_url
    for lg in ["es", "pt", "fr", "de", "nl"]:
        assert d[lg] == f"{base_url}?lang={lg}", f"{lg} -> {d[lg]}"
    # broken host must not appear in any <link> tag
    for _, href in hl:
        assert "dynopay.com//" not in href, f"broken host in hreflang: {href}"


def test_shop_default_no_lang():
    html = _fetch(SHOP_BARE)
    cans = _canonicals(html)
    assert len(cans) == 1
    assert cans[0] == SHOP_BARE
    _assert_hreflang_cluster(html, SHOP_BARE)
    ogl = _og_locales(html)
    assert len(ogl) == 1 and ogl[0] == "en"


def test_shop_lang_fr():
    url = f"{SHOP_BARE}?lang=fr"
    html = _fetch(url)
    cans = _canonicals(html)
    assert len(cans) == 1
    assert cans[0] == url, f"canonical not self-ref: {cans[0]}"
    _assert_hreflang_cluster(html, SHOP_BARE)
    ogl = _og_locales(html)
    assert len(ogl) == 1 and ogl[0] == "fr"
    titles = _titles(html)
    assert len(titles) == 1
    # localized title should be in French — 'Boutique'
    assert "Boutique" in titles[0], f"title not french: {titles[0]}"


def test_product_lang_de():
    url = f"{PROD_BARE}?lang=de"
    html = _fetch(url)
    cans = _canonicals(html)
    assert len(cans) == 1
    assert cans[0] == url
    _assert_hreflang_cluster(html, PROD_BARE)
    ogl = _og_locales(html)
    assert len(ogl) == 1 and ogl[0] == "de"


def test_product_default_regression():
    html = _fetch(PROD_BARE)
    cans = _canonicals(html)
    assert len(cans) == 1
    assert cans[0] == PROD_BARE
    _assert_hreflang_cluster(html, PROD_BARE)
    ogl = _og_locales(html)
    assert len(ogl) == 1 and ogl[0] == "en"


def test_no_broken_link_tags_across_pages():
    """No <link> tag on any tested page should contain 'dynopay.com//'."""
    for url in [SHOP_BARE, f"{SHOP_BARE}?lang=fr", PROD_BARE, f"{PROD_BARE}?lang=de"]:
        html = _fetch(url)
        bad = re.findall(r'<link[^>]*dynopay\.com//[^"]*"[^>]*>', html)
        assert not bad, f"{url} has broken <link> tags: {bad}"
