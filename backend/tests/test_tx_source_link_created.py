"""
Backend tests: Payment-link "link_created_at" propagation across
GET /api/wallet/transaction/:id, POST /api/wallet/getAllTransactions,
GET /api/dashboard/recent-transactions, and GET /health.

Runs against the live preview backend using the owner account.
READ-ONLY: no writes/deletes.
"""
import os
import subprocess
import time
import pytest
import requests

BASE_URL = os.environ.get("NEXT_PUBLIC_BASE_URL", "https://vault-setup-14.preview.emergentagent.com").rstrip("/")
EMAIL = "onarrival21@gmail.com"
PASSWORD = "Katiekendra123@"
COMPANY_ID = 1
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def _totp():
    out = subprocess.check_output(["node", "/app/backend/scripts/print_totp.cjs", "1"], text=True).strip()
    # last 6-digit token in output
    import re
    m = re.findall(r"\b\d{6}\b", out)
    return m[-1] if m else out


def _post(session, path, payload, retries=4):
    last = None
    for i in range(retries):
        r = session.post(f"{BASE_URL}{path}", json=payload, timeout=30)
        if r.status_code < 500:
            return r
        last = r
        time.sleep(2)
    return last


def _get(session, path, retries=4):
    last = None
    for i in range(retries):
        r = session.get(f"{BASE_URL}{path}", timeout=30)
        if r.status_code < 500:
            return r
        last = r
        time.sleep(2)
    return last


@pytest.fixture(scope="session")
def token():
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Content-Type": "application/json"})
    r = _post(s, "/api/user/login", {"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:200]}"
    j = r.json()
    challenge = j.get("data", {}).get("challenge_token") or j.get("challenge_token")
    assert challenge, f"no challenge_token: {j}"
    # try up to 3 TOTP codes in case of rotation
    last_err = None
    for _ in range(3):
        code = _totp()
        r2 = _post(s, "/api/user/2fa/validate", {"challenge_token": challenge, "token": code})
        if r2.status_code == 200:
            tok = r2.json().get("data", {}).get("accessToken")
            if tok:
                return tok
        last_err = r2.text[:200]
        time.sleep(2)
    pytest.fail(f"2fa validate failed: {last_err}")


@pytest.fixture(scope="session")
def sess(token):
    s = requests.Session()
    s.headers.update({
        "User-Agent": UA,
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    })
    return s


def test_health():
    # Backend /health is not exposed under /api on the preview edge; hit localhost:8001 to verify liveness.
    r = requests.get("http://localhost:8001/health", headers={"User-Agent": UA}, timeout=15)
    assert r.status_code == 200, f"health {r.status_code}: {r.text[:200]}"
    assert r.json().get("status") == "healthy"


# ---- BACKEND 1: single-transaction endpoint has source object ----

class TestSingleTxSource:
    def test_by_numeric_id_1295(self, sess):
        r = _get(sess, f"/api/wallet/transaction/1295?company_id={COMPANY_ID}")
        assert r.status_code == 200, r.text[:400]
        d = r.json().get("data") or r.json()
        src = d.get("source")
        assert isinstance(src, dict), f"source missing/not object: {d}"
        assert src.get("type") == "payment_link", src
        assert src.get("link_id") == 492, src
        assert src.get("link_created_at") == "2026-09-19T01:43:33.719Z", src

    def test_by_uuid(self, sess):
        r = _get(sess, f"/api/wallet/transaction/d0c1ec0d-b0d1-4e05-a4f0-e227c790f4be?company_id={COMPANY_ID}")
        assert r.status_code == 200, r.text[:400]
        d = r.json().get("data") or r.json()
        src = d.get("source")
        assert isinstance(src, dict)
        assert src.get("type") == "payment_link"
        assert src.get("link_id") == 492
        assert src.get("link_created_at") == "2026-09-19T01:43:33.719Z"

    def test_non_link_transaction_source_null(self, sess):
        # find an api/direct tx via getAllTransactions
        r = _post(sess, "/api/wallet/getAllTransactions", {
            "company_id": COMPANY_ID, "page": 1, "limit": 500,
            "start_date": "2026-01-01", "end_date": "2027-01-01",
        })
        assert r.status_code == 200, r.text[:300]
        data = r.json().get("data") or {}
        rows = list(data.get("customers_transactions", []) or []) + list(data.get("self_transactions", []) or [])
        candidate = None
        for row in rows:
            src = row.get("source") or {}
            if src.get("type") in ("api", "direct"):
                candidate = row
                break
        assert candidate, "no api/direct transaction found"
        tid = candidate.get("transaction_id") or candidate.get("id")
        r2 = _get(sess, f"/api/wallet/transaction/{tid}?company_id={COMPANY_ID}")
        assert r2.status_code == 200
        d = r2.json().get("data") or r2.json()
        src = d.get("source") or {}
        assert src.get("type") in ("api", "direct"), src
        assert src.get("link_created_at") in (None, ""), f"link_created_at should be null: {src}"


# ---- BACKEND 2: getAllTransactions parent-date for tip + regression ----

class TestGetAllTransactions:
    @pytest.fixture(scope="class")
    def rows(self, sess):
        # request a wide range to include older tx like tx 557 (Aug 12) and tx 1295 (Sep 28)
        r = _post(sess, "/api/wallet/getAllTransactions", {
            "company_id": COMPANY_ID,
            "page": 1,
            "limit": 500,
            "date_range": "all",
            "start_date": "2026-01-01",
            "end_date": "2027-01-01",
        })
        assert r.status_code == 200, r.text[:300]
        data = r.json().get("data") or {}
        if isinstance(data, dict):
            rows = list(data.get("customers_transactions", []) or []) + list(data.get("self_transactions", []) or [])
            if not rows:
                rows = data.get("transactions", []) or []
            return rows
        return data or []

    def test_tip_557_uses_parent_link_date(self, rows):
        tx = next((r for r in rows if r.get("transaction_id") == 557 or r.get("id") == 557), None)
        assert tx, "tx 557 not returned by getAllTransactions"
        src = tx.get("source") or {}
        assert src.get("type") == "tip", src
        assert src.get("link_id") == 173, src
        assert src.get("parent_link_id") == 59, src
        assert src.get("link_created_at") == "2026-07-13T11:44:42.129Z", src

    def test_regression_tx_1295(self, rows):
        tx = next((r for r in rows if r.get("transaction_id") == 1295 or r.get("id") == 1295), None)
        assert tx, "tx 1295 not returned"
        src = tx.get("source") or {}
        assert src.get("link_created_at") == "2026-09-19T01:43:33.719Z", src

    def test_api_direct_rows_link_created_at_null(self, rows):
        checked = 0
        for row in rows:
            src = row.get("source") or {}
            if src.get("type") in ("api", "direct"):
                assert src.get("link_created_at") in (None, ""), row
                checked += 1
                if checked >= 3:
                    break
        # not fatal if no api/direct rows exist

    def test_no_raw_source_columns_leak(self, rows):
        forbidden = {"source_link_created_at", "source_parent_link_created_at", "source_type", "source_link_id", "source_parent_link_id"}
        for row in rows[:50]:
            leaked = forbidden & set(row.keys())
            assert not leaked, f"raw source_* keys leaked: {leaked} in {row.get('transaction_id')}"


# ---- BACKEND 3: dashboard/recent-transactions ----

class TestDashboardRecent:
    def test_recent_transactions_has_source_link_created_at(self, sess):
        r = _get(sess, f"/api/dashboard/recent-transactions?limit=40&company_id={COMPANY_ID}")
        assert r.status_code == 200, r.text[:300]
        data = r.json().get("data")
        rows = data if isinstance(data, list) else (data or {}).get("transactions", [])
        assert rows, "no rows returned"
        # find tx 1295
        tx = next((row for row in rows if row.get("transaction_id") == 1295 or row.get("id") == 1295), None)
        # It may or may not be in the top-40 depending on ordering; if not present, skip that assertion but still check leakage
        if tx:
            src = tx.get("source") or {}
            assert src.get("link_created_at") == "2026-09-19T01:43:33.719Z", src
        # no leaked raw keys
        forbidden = {"source_link_created_at", "source_parent_link_created_at"}
        for row in rows:
            leaked = forbidden & set(row.keys())
            assert not leaked, f"leaked keys in dashboard row: {leaked}"
