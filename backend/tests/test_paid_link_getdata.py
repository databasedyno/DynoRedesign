"""Tests for cryptoCheckout getData fix: paid link resurrection bug."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://merchant-portal-239.preview.emergentagent.com").rstrip("/")
ENDPOINT = f"{BASE_URL}/api/pay/getData"

PAID_REF_1 = "818c7e420fa49355ad16bbd20bd6bc25cbc94428dc1d4678"
PAID_REF_2 = "89a05d063781463a1e8e0a354842b702ab2c4f8e521ad1e3"
ACTIVE_REF = "c86efad91c64fb3d408264c59aba55c3e1300d4cae52f7e3"
INVALID_REF = "deadbeef0000"


def _post(ref):
    return requests.post(ENDPOINT, json={"data": ref, "language": "en"}, timeout=30)


def test_paid_link_1_returns_completed():
    r = _post(PAID_REF_1)
    assert r.status_code == 200, r.text
    body = r.json()
    d = body.get("data", body)
    assert d.get("payment_completed") is True, d
    assert str(d.get("amount") or d.get("base_amount")) in ("800", "800.0", "800.00")
    assert d.get("base_currency") == "USD"
    assert str(d.get("paid_amount")) == "0.42472539"
    assert d.get("paid_currency") == "ETH"
    assert d.get("paid_at")
    assert "3CX" in (d.get("description") or "") or "Ireland" in (d.get("description") or "")


def test_paid_link_2_returns_completed():
    r = _post(PAID_REF_2)
    assert r.status_code == 200, r.text
    body = r.json()
    d = body.get("data", body)
    assert d.get("payment_completed") is True, d
    assert str(d.get("amount") or d.get("base_amount")) in ("75", "75.0", "75.00")
    assert d.get("base_currency") == "USD"
    assert str(d.get("paid_amount")) == "0.00120154"
    assert d.get("paid_currency") == "BTC"


def test_active_link_regression_normal_checkout():
    r = _post(ACTIVE_REF)
    assert r.status_code == 200, r.text
    body = r.json()
    d = body.get("data", body)
    assert not d.get("payment_completed"), f"Should not be completed: {d}"
    assert str(d.get("amount") or d.get("base_amount")) in ("10", "10.0", "10.00")
    assert d.get("base_currency") == "EUR"
    ac = d.get("available_currencies") or d.get("availableCurrencies") or []
    assert isinstance(ac, list) and len(ac) >= 5, f"available_currencies: {ac}"
    assert d.get("token")


def test_invalid_ref_returns_404():
    r = _post(INVALID_REF)
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"
