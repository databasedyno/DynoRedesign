"""Backend tests for Fiat/Crypto display + refresh audit (iteration 283).

Validates:
- /api/user/display-currency returns fx meta
- /api/dashboard/* /api/invoices/period-summary /api/wallet/getWallet carry `fx` block
- currency_symbol consistent with currency
- /api/tax/collected-report has summary.unconverted_currencies
- No NaN anywhere
- SSE /api/events/stream sends `event: connected`
"""
import json
import math
import os
import subprocess

import pytest
import requests

BASE_URL = "https://fiat-crypto-vault.preview.emergentagent.com"
UA = "Mozilla/5.0 (Testing)"
with open("/app/memory/tmp/merchant_token.txt") as _f:
    TOKEN = _f.read().strip()

HEADERS = {"Authorization": f"Bearer {TOKEN}", "User-Agent": UA}

SYMBOL_MAP = {"USD": "$", "EUR": "\u20ac", "GBP": "\u00a3", "NGN": "\u20a6", "CAD": "C$", "AUD": "A$"}


def _get(path):
    r = requests.get(f"{BASE_URL}{path}", headers=HEADERS, timeout=30)
    return r


def _has_nan(obj):
    if isinstance(obj, float):
        return math.isnan(obj)
    if isinstance(obj, str):
        return obj == "NaN"
    if isinstance(obj, dict):
        return any(_has_nan(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_has_nan(v) for v in obj)
    return False


# ---------- display-currency ----------
class TestDisplayCurrency:
    def test_display_currency_returns_fx_meta(self):
        r = _get("/api/user/display-currency?company_id=1")
        assert r.status_code == 200, r.text
        data = r.json().get("data", {})
        assert "effective_currency" in data
        assert "effective_currency_info" in data
        assert data.get("rate", 0) > 0
        assert "rate_as_of" in data
        assert "rate_is_stale" in data
        assert "rate_fallback" in data
        assert not _has_nan(data)


# ---------- fx block carriers ----------
FX_ENDPOINTS = [
    ("/api/dashboard/overview?company_id=1&period=30d", "data"),
    ("/api/dashboard/payouts?company_id=1&period=30d", "data"),
    ("/api/dashboard/brands?period=30d", "data"),
    ("/api/invoices/period-summary?company_id=1", "data"),
    ("/api/dashboard?company_id=1", "data"),
]


@pytest.mark.parametrize("path,root", FX_ENDPOINTS)
def test_fx_block_present(path, root):
    r = _get(path)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:300]}"
    body = r.json()
    data = body.get(root, body)
    assert "fx" in data, f"{path} missing fx block. Keys={list(data.keys())[:30]}"
    fx = data["fx"]
    for k in ("currency", "requested_currency", "rate", "as_of", "is_stale", "fallback"):
        assert k in fx, f"{path} fx missing key {k}: {fx}"
    # currency_symbol consistent with currency
    cur = data.get("currency") or fx.get("currency")
    sym = data.get("currency_symbol")
    if sym and cur in SYMBOL_MAP:
        assert sym == SYMBOL_MAP[cur], f"{path} symbol {sym!r} inconsistent with currency {cur}"
    assert not _has_nan(body), f"{path} contains NaN"


def test_wallet_fx_per_company_group():
    r = _get("/api/wallet/getWallet?company_id=1")
    assert r.status_code == 200, r.text
    body = r.json()
    # Dig for fx structures
    assert not _has_nan(body)
    # Expect `fx` at some level. Accept either per company group or top-level data.
    text = json.dumps(body)
    assert '"fx"' in text, "wallet response has no fx block anywhere"
    # Validate at least one fx block has required keys
    def find_fx(o):
        if isinstance(o, dict):
            if "fx" in o and isinstance(o["fx"], dict):
                yield o["fx"]
            for v in o.values():
                yield from find_fx(v)
        elif isinstance(o, list):
            for v in o:
                yield from find_fx(v)
    found = list(find_fx(body))
    assert found, "no fx dict object found"
    required = {"currency", "requested_currency", "rate", "as_of", "is_stale", "fallback"}
    for fx in found:
        missing = required - set(fx.keys())
        assert not missing, f"wallet fx missing keys {missing}: {fx}"


def test_dashboard_chart_200():
    r = _get("/api/dashboard/chart?company_id=1&period=30d")
    assert r.status_code == 200, r.text
    assert not _has_nan(r.json())


def test_fee_tiers_route_if_exists():
    r = _get("/api/dashboard/fee-tiers")
    # Route may or may not exist; if exists must be 200
    assert r.status_code in (200, 404), f"unexpected {r.status_code}: {r.text[:200]}"


def test_tax_collected_report_has_unconverted_currencies():
    r = _get("/api/tax/collected-report?company_id=1")
    assert r.status_code == 200, r.text
    body = r.json()
    data = body.get("data", body)
    summary = data.get("summary", {})
    assert "unconverted_currencies" in summary, f"missing unconverted_currencies, keys={list(summary.keys())}"
    assert isinstance(summary["unconverted_currencies"], list)
    assert not _has_nan(body)


# ---------- SSE ----------
def test_events_stream_sends_connected():
    """Use curl -N with a short timeout to capture the initial `event: connected` frame."""
    cmd = [
        "curl", "-sN", "--max-time", "4",
        "-A", UA,
        "-H", f"Authorization: Bearer {TOKEN}",
        f"{BASE_URL}/api/events/stream?channels=payments,notifications",
    ]
    try:
        out = subprocess.run(cmd, capture_output=True, timeout=8).stdout.decode("utf-8", errors="ignore")
    except subprocess.TimeoutExpired as e:
        out = (e.stdout or b"").decode("utf-8", errors="ignore")
    assert "event: connected" in out, f"SSE did not send connected frame. Got: {out[:500]!r}"
