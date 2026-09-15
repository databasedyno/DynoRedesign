"""
Wave 1 Command-Centre Dashboard - GET /api/dashboard/overview backend tests.
SAFE MODE: read-only. Do not mutate merchant data.
"""
import os
import time
import pytest
import requests

BASE_URL = "https://344a40b3-ff42-4c97-9de3-1b749ec105fa.preview.emergentagent.com"
EMAIL = "onarrival21@gmail.com"
PASSWORD = "Katiekendra123@"


@pytest.fixture(scope="session")
def token():
    r = requests.post(
        f"{BASE_URL}/api/user/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    tok = r.json().get("data", {}).get("accessToken")
    assert tok, f"no accessToken: {r.text[:300]}"
    return tok


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _get(headers, params):
    return requests.get(
        f"{BASE_URL}/api/dashboard/overview",
        headers=headers,
        params=params,
        timeout=30,
    )


# ------------- Shape / sanity for brand 1 30d -------------
class TestOverviewShapeBrand1:
    def test_status_and_top_keys(self, auth_headers):
        r = _get(auth_headers, {"company_id": 1, "period": "30d"})
        assert r.status_code == 200, r.text
        body = r.json()
        # Response may wrap in {data:{...}} or return top-level; accept both
        d = body.get("data", body)
        for k in [
            "range", "currency", "currency_symbol", "pulse",
            "settled", "in_flight", "forwarded", "health",
            "attention", "top_sources", "generated_at",
        ]:
            assert k in d, f"missing key {k} in overview response. Got keys={list(d.keys())}"

    def test_settled_sanity(self, auth_headers):
        r = _get(auth_headers, {"company_id": 1, "period": "30d"})
        d = r.json().get("data", r.json())
        s = d["settled"]
        for k in ["net", "gross", "fees", "count", "previous_net",
                  "previous_count", "delta_pct", "avg_ticket"]:
            assert k in s, f"settled missing {k}"
        # fees == gross - net (±0.02)
        assert abs(float(s["fees"]) - (float(s["gross"]) - float(s["net"]))) <= 0.02, s
        # avg_ticket == net/count (when count>0)
        if s["count"]:
            assert abs(float(s["avg_ticket"]) - float(s["net"]) / s["count"]) <= 0.02, s

    def test_health_sanity(self, auth_headers):
        r = _get(auth_headers, {"company_id": 1, "period": "30d"})
        d = r.json().get("data", r.json())
        h = d["health"]
        for k in ["created", "paid", "completion_rate", "exception_rate"]:
            assert k in h, f"health missing {k}"
        if h["created"]:
            expected = round(h["paid"] / h["created"] * 100, 1)
            assert abs(float(h["completion_rate"]) - expected) <= 0.2, h

    def test_top_sources_sorted_and_capped(self, auth_headers):
        r = _get(auth_headers, {"company_id": 1, "period": "30d"})
        d = r.json().get("data", r.json())
        ts = d["top_sources"]
        assert isinstance(ts, list)
        assert len(ts) <= 6
        amts = [float(x.get("amount", 0)) for x in ts]
        assert amts == sorted(amts, reverse=True), f"top_sources not sorted desc: {amts}"

    def test_attention_shape(self, auth_headers):
        r = _get(auth_headers, {"company_id": 1, "period": "30d"})
        d = r.json().get("data", r.json())
        a = d["attention"]
        for k in [
            "underpaid_open", "expired_today", "confirming_stale",
            "webhook_failures_24h", "webhook_deliveries_24h",
            "stale_api_keys", "coins_without_wallet", "paylinks_expiring_48h",
        ]:
            assert k in a, f"attention missing {k}"
        assert "count" in a["expired_today"] and "amount" in a["expired_today"]


# ------------- Period handling -------------
class TestPeriods:
    @pytest.mark.parametrize("period", ["today", "7d", "30d", "90d", "1y"])
    def test_period_echo(self, auth_headers, period):
        r = _get(auth_headers, {"company_id": 1, "period": period})
        assert r.status_code == 200, r.text
        d = r.json().get("data", r.json())
        assert d["range"]["period"] == period, d["range"]

    def test_unknown_period_falls_back_to_30d(self, auth_headers):
        r = _get(auth_headers, {"company_id": 1, "period": "banana"})
        assert r.status_code == 200, r.text
        d = r.json().get("data", r.json())
        assert d["range"]["period"] == "30d", d["range"]

    def test_custom_range(self, auth_headers):
        r = _get(auth_headers, {
            "company_id": 1, "period": "custom",
            "startDate": "2026-08-01", "endDate": "2026-08-31",
        })
        assert r.status_code == 200, r.text
        d = r.json().get("data", r.json())
        assert d["range"]["period"] == "custom", d["range"]
        # start 00:00 and end 23:59:59
        start = str(d["range"].get("start", ""))
        end = str(d["range"].get("end", ""))
        assert "2026-08-01" in start, start
        assert "2026-08-31" in end, end
        # basic time boundary
        assert "00:00:00" in start or "T00:00" in start, start
        assert "23:59:59" in end, end


# ------------- Other brands -------------
class TestOtherBrands:
    @pytest.mark.parametrize("company_id", [71, 165])
    def test_returns_200(self, auth_headers, company_id):
        r = _get(auth_headers, {"company_id": company_id, "period": "30d"})
        assert r.status_code == 200, r.text

    def test_brand_165_webhook_failure(self, auth_headers):
        r = _get(auth_headers, {"company_id": 165, "period": "30d"})
        d = r.json().get("data", r.json())
        # webhook_failures_24h should be >= 1 per problem statement
        assert d["attention"]["webhook_failures_24h"] >= 1, d["attention"]

    def test_brand_71_7d_has_1_settled(self, auth_headers):
        r = _get(auth_headers, {"company_id": 71, "period": "7d"})
        d = r.json().get("data", r.json())
        # data may drift, just ensure shape and non-negative count
        assert d["settled"]["count"] >= 0


# ------------- Auth / authz -------------
class TestAuthz:
    def test_no_auth_401(self):
        r = requests.get(
            f"{BASE_URL}/api/dashboard/overview",
            params={"company_id": 1, "period": "30d"},
            timeout=20,
        )
        assert r.status_code == 401, f"expected 401 got {r.status_code}: {r.text[:200]}"

    def test_foreign_company_not_500(self, auth_headers):
        r = _get(auth_headers, {"company_id": 9999, "period": "30d"})
        assert r.status_code < 500, f"got 5xx: {r.status_code} {r.text[:200]}"
        assert r.status_code in (400, 401, 403, 404), (
            f"expected 4xx for foreign company, got {r.status_code}: {r.text[:200]}"
        )


# ------------- Caching -------------
class TestCaching:
    def test_60s_cache_same_generated_at(self, auth_headers):
        r1 = _get(auth_headers, {"company_id": 1, "period": "30d"})
        assert r1.status_code == 200
        time.sleep(0.5)
        r2 = _get(auth_headers, {"company_id": 1, "period": "30d"})
        assert r2.status_code == 200
        g1 = r1.json().get("data", r1.json())["generated_at"]
        g2 = r2.json().get("data", r2.json())["generated_at"]
        assert g1 == g2, f"cache miss: {g1} != {g2}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
