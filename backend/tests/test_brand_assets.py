"""Brand icon refresh (Bold Loop) asset rollout tests - read-only.

Verifies that every favicon/PWA/OG/press/email asset is served with the correct
content-type on the preview URL, and that the favicon.svg embeds the new
'Bold Loop' geometry (round-tail arcs) and not the old path.
"""
import os
import json
import re
import pytest
import requests

BASE = "https://secure-passphrase-1.preview.emergentagent.com"


def _head_or_get(path, expect_ct_startswith):
    url = f"{BASE}{path}"
    r = None
    import time
    for i in range(8):
        try:
            r = requests.get(url, timeout=30, allow_redirects=True)
            if r.status_code == 200:
                break
        except Exception:
            pass
        time.sleep(2)
    assert r is not None and r.status_code == 200, f"{path} -> {r.status_code if r else 'no-resp'}"
    ct = r.headers.get("content-type", "").lower()
    assert ct.startswith(expect_ct_startswith), f"{path} content-type={ct}"
    return r


# ---------- favicons ----------
@pytest.mark.parametrize("path,ct", [
    ("/favicon.ico?v=6", "image/"),  # x-icon or vnd.microsoft.icon
    ("/favicon-16.png", "image/png"),
    ("/favicon-32.png", "image/png"),
    ("/favicon-48.png", "image/png"),
    ("/favicon-192.png", "image/png"),
    ("/favicon-512.png", "image/png"),
    ("/apple-touch-icon.png?v=6", "image/png"),
    ("/pwa-192.png", "image/png"),
    ("/pwa-512.png", "image/png"),
    ("/pwa-maskable-512.png", "image/png"),
])
def test_favicon_assets(path, ct):
    _head_or_get(path, ct)


def test_favicon_svg_has_bold_loop_geometry():
    r = _head_or_get("/favicon.svg?v=6", "image/svg+xml")
    body = r.text
    assert "<circle" in body, "favicon.svg missing coin <circle>"
    # New Bold Loop arrows use arc commands 'A' inside a <path
    assert re.search(r"<path[^>]*\bd=\"[^\"]*A", body), "favicon.svg missing arc (A) commands => new round-tail geometry"
    # Old path start must be gone
    assert "M13.73 23.86" not in body, "favicon.svg still contains OLD arrow path"


# ---------- manifest ----------
def test_site_webmanifest():
    r = _head_or_get("/site.webmanifest?v=6", "application/")
    data = r.json()
    icons = data.get("icons", [])
    srcs = [(i.get("src"), i.get("purpose", "any")) for i in icons]
    assert any("/pwa-192.png" in s[0] for s in srcs), f"missing pwa-192: {srcs}"
    assert any("/pwa-512.png" in s[0] and "maskable" not in s[1] for s in srcs), f"missing pwa-512 any: {srcs}"
    assert any("/pwa-maskable-512.png" in s[0] and "maskable" in s[1] for s in srcs), \
        f"missing maskable pwa-maskable-512: {srcs}"
    assert data.get("theme_color", "").lower() == "#4338ca", f"theme_color={data.get('theme_color')}"


# ---------- press kit ----------
@pytest.mark.parametrize("path,ct", [
    ("/press/dynopay-logo-black.svg", "image/svg"),
    ("/press/dynopay-logo-white.svg", "image/svg"),
    ("/press/dynopay-icon-512.png", "image/png"),
])
def test_press_assets(path, ct):
    _head_or_get(path, ct)


# ---------- OG images ----------
OG_PATHS = [
    "/og/dynopay-og.png?v=3",
    "/og/press.png", "/og/fees.png", "/og/about.png", "/og/how-to.png",
    "/og/blog.png", "/og/vertical-saas.png",
    "/og/comparison-coingate.png", "/og/country-germany.png",
]


@pytest.mark.parametrize("path", OG_PATHS)
def test_og_image_served(path):
    _head_or_get(path, "image/png")


# ---------- email chip (v3 + v2 legacy) ----------
def test_email_chip_v3():
    _head_or_get("/api/static/dynopay-email-logo-v3.png", "image/png")


def test_email_chip_v2_legacy_still_served():
    _head_or_get("/api/static/dynopay-email-logo-v2.png", "image/png")
