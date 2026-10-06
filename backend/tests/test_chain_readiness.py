"""Chain readiness admin endpoint tests."""
import os
import time
import pytest
import requests

BASE_URL = "https://secure-passphrase-15.preview.emergentagent.com"
TOKEN = open("/app/memory/tmp/admin_token.txt").read().strip()
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"


@pytest.fixture
def auth():
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {TOKEN}",
        "User-Agent": UA,
        "Accept": "application/json",
    })
    return s


def test_chain_readiness_unauthenticated():
    r = requests.get(f"{BASE_URL}/api/admin/chain-readiness",
                     headers={"User-Agent": UA}, timeout=30)
    assert r.status_code in (401, 403), f"got {r.status_code}: {r.text[:200]}"


def test_chain_readiness_bad_token():
    r = requests.get(f"{BASE_URL}/api/admin/chain-readiness",
                     headers={"User-Agent": UA, "Authorization": "Bearer BAD"}, timeout=30)
    assert r.status_code in (401, 403)


def test_chain_readiness_ok(auth):
    r = auth.get(f"{BASE_URL}/api/admin/chain-readiness?refresh=1", timeout=60)
    assert r.status_code == 200, r.text[:500]
    body = r.json()
    assert body.get("success") is True
    data = body["data"]
    assert "generated_at" in data
    assert data.get("cached") is False
    s = data["summary"]
    assert {"ready", "degraded", "blocked"} <= set(s.keys())
    # blocked must be at least 1 (USDT-POLYGON expected)
    assert s["blocked"] >= 1

    gws = data["gas_wallets"]
    assert len(gws) == 4
    ids = {g["id"] for g in gws}
    assert ids == {"TRX", "ETH", "POLYGON", "XRP_MASTER"}
    for g in gws:
        for k in ("symbol", "role", "address", "env_key", "balance",
                  "level", "thresholds", "top_up_needed",
                  "signing_key_in_db", "serves", "impact"):
            assert k in g, f"missing {k} in {g['id']}"
        assert {"critical", "warning", "healthy"} <= set(g["thresholds"].keys())
    pol = next(g for g in gws if g["id"] == "POLYGON")
    assert pol["level"] == "empty", pol
    assert pol["top_up_needed"] == 10
    assert pol["address"].lower() == "0x6508f517021b3fe14acb4515535b6772b0669f47"
    assert pol["impact"]
    for gid in ("TRX", "ETH", "XRP_MASTER"):
        g = next(x for x in gws if x["id"] == gid)
        assert g["level"] == "healthy", f"{gid}: {g}"

    currencies = data["currencies"]
    assert len(currencies) == 15
    expected = {"BTC","ETH","LTC","DOGE","TRX","BCH","USDT-TRC20","USDT-ERC20",
                "USDC-ERC20","SOL","XRP","RLUSD","POLYGON","USDT-POLYGON","RLUSD-ERC20"}
    got = {c.get("currency") or c.get("code") or c.get("id") for c in currencies}
    assert expected <= got, f"missing: {expected - got}"
    for c in currencies:
        for k in ("family", "network", "gas_wallet_id", "overall", "checks", "pool", "settlements"):
            assert k in c, f"missing {k} in {c}"
        assert c["overall"] in ("ready", "degraded", "blocked")
    usdt_poly = next(c for c in currencies if (c.get("currency") or c.get("id")) == "USDT-POLYGON")
    assert usdt_poly["overall"] == "blocked"
    gas_check = next(ch for ch in usdt_poly["checks"] if ch["key"] == "gas_balance")
    assert gas_check["status"] == "fail"


def test_chain_readiness_cache(auth):
    # warm
    auth.get(f"{BASE_URL}/api/admin/chain-readiness?refresh=1", timeout=60)
    r1 = auth.get(f"{BASE_URL}/api/admin/chain-readiness", timeout=30)
    assert r1.status_code == 200
    assert r1.json()["data"]["cached"] is True
    r2 = auth.get(f"{BASE_URL}/api/admin/chain-readiness?refresh=1", timeout=60)
    assert r2.json()["data"]["cached"] is False


# ---- Regression: other admin endpoints still 200 ----
@pytest.mark.parametrize("path", [
    "/api/admin/fee-reconciliation",
    "/api/admin/email-log/stats",
    "/api/admin/security/events?limit=5",
])
def test_other_admin_endpoints(auth, path):
    r = auth.get(f"{BASE_URL}{path}", timeout=45)
    assert r.status_code == 200, f"{path} => {r.status_code}: {r.text[:200]}"
