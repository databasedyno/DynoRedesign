# Transactions export endpoint regression tests (POST /api/wallet/transactions/export)
# Read-only: login + list + CSV export only (preview is wired to LIVE prod DB).
import csv
import io
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

_env = dotenv_values("/app/frontend/.env") if Path("/app/frontend/.env").exists() else {}
BASE_URL = (
    os.environ.get("PREVIEW_BASE_URL")
    or os.environ.get("REACT_APP_BACKEND_URL")
    or _env.get("REACT_APP_BACKEND_URL")
    or "https://kendra-vault.preview.emergentagent.com"
).rstrip("/")

COMPANY_ID = 1


@pytest.fixture(scope="session")
def creds():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("missing test_credentials.md")
    txt = p.read_text(encoding="utf-8")
    m = re.search(r"MERCHANT LOGIN FOR TESTING:\s*(\S+)\s*/\s*(\S+)", txt)
    if not m:
        pytest.skip("merchant creds not found")
    return {"email": m.group(1), "password": m.group(2)}


@pytest.fixture(scope="session")
def token(creds):
    r = requests.post(
        f"{BASE_URL}/api/user/login",
        json={"email": creds["email"], "password": creds["password"]},
        timeout=60,
    )
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    tok = (r.json().get("data") or {}).get("accessToken")
    if not tok:
        pytest.fail(f"no accessToken in login response: {r.text[:300]}")
    return tok


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


def _bucket(status: str) -> str:
    s = (status or "").lower().strip()
    if s in ("success", "successful", "completed", "payout_complete", "converted", "recovered", "done", "settled"):
        return "settled"
    if s in ("confirmed", "processing", "unpaid"):
        return s
    if s in ("awaiting_payment", "awaiting"):
        return "awaiting_payment"
    if s in ("failed", "expired", "refunded", "settlement_failed"):
        return "failed"
    return "pending"


@pytest.fixture(scope="session")
def list_buckets(client):
    r = client.post(f"{BASE_URL}/api/wallet/getAllTransactions", json={"company_id": COMPANY_ID}, timeout=120)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    rows = body.get("data") or []
    if isinstance(rows, dict):
        rows = rows.get("customers_transactions") or rows.get("transactions") or rows.get("data") or []
    assert isinstance(rows, list) and rows, f"unexpected list payload: {str(body)[:300]}"
    counts = {}
    for row in rows:
        counts[_bucket(row.get("status"))] = counts.get(_bucket(row.get("status")), 0) + 1
    counts["all"] = len(rows)
    return counts


def _export(client, payload):
    r = client.post(f"{BASE_URL}/api/wallet/transactions/export", json=payload, timeout=180)
    return r


def _csv_rows(resp):
    text = resp.text
    reader = csv.DictReader(io.StringIO(text))
    return [row for row in reader]


class TestExport:
    def test_export_status_unpaid(self, client, list_buckets):
        r = _export(client, {"company_id": COMPANY_ID, "status": "unpaid"})
        assert r.status_code == 200, r.text[:300]
        assert "csv" in r.headers.get("content-type", "").lower()
        rows = _csv_rows(r)
        assert len(rows) == list_buckets.get("unpaid", 0), (len(rows), list_buckets)
        statuses = {(_bucket(row.get("Status") or "")) for row in rows}
        assert statuses == {"unpaid"}, statuses

    def test_export_status_settled(self, client, list_buckets):
        r = _export(client, {"company_id": COMPANY_ID, "status": "settled"})
        assert r.status_code == 200, r.text[:300]
        rows = _csv_rows(r)
        assert len(rows) == list_buckets.get("settled", 0), (len(rows), list_buckets)
        assert {(_bucket(row.get("Status") or "")) for row in rows} == {"settled"}

    def test_export_status_pending(self, client, list_buckets):
        r = _export(client, {"company_id": COMPANY_ID, "status": "pending"})
        assert r.status_code == 200, r.text[:300]
        rows = _csv_rows(r)
        assert len(rows) == list_buckets.get("pending", 0), (len(rows), list_buckets)

    def test_export_source_direct(self, client):
        r = _export(client, {"company_id": COMPANY_ID, "source": "direct"})
        assert r.status_code == 200, r.text[:300]
        rows = _csv_rows(r)
        assert len(rows) > 0
        all_rows = len(_csv_rows(_export(client, {"company_id": COMPANY_ID})))
        assert len(rows) < all_rows

    def test_export_wallet_and_status(self, client):
        r = _export(client, {"company_id": COMPANY_ID, "wallet": "LTC", "status": "unpaid"})
        assert r.status_code == 200, r.text[:300]
        rows = _csv_rows(r)
        assert len(rows) > 0
        crypto_col = next((c for c in (rows[0].keys()) if c and "crypto" in c.lower()), None)
        assert crypto_col, list(rows[0].keys())
        assert {row[crypto_col] for row in rows} == {"LTC"}
        assert {(_bucket(row.get("Status") or "")) for row in rows} == {"unpaid"}

    def test_status_chip_beats_settled_only(self, client, list_buckets):
        r = _export(client, {"company_id": COMPANY_ID, "settled_only": True, "status": "unpaid"})
        assert r.status_code == 200, r.text[:300]
        rows = _csv_rows(r)
        assert len(rows) == list_buckets.get("unpaid", 0)
        assert {(_bucket(row.get("Status") or "")) for row in rows} == {"unpaid"}

    def test_settled_only_flag(self, client, list_buckets):
        r = _export(client, {"company_id": COMPANY_ID, "settled_only": True})
        assert r.status_code == 200, r.text[:300]
        rows = _csv_rows(r)
        assert len(rows) == list_buckets.get("settled", 0), (len(rows), list_buckets)

    def test_export_all_matches_list_total(self, client, list_buckets):
        r = _export(client, {"company_id": COMPANY_ID})
        assert r.status_code == 200, r.text[:300]
        rows = _csv_rows(r)
        assert len(rows) == list_buckets["all"], (len(rows), list_buckets["all"])

    def test_export_search_parity_with_ui(self, client):
        """UI search matches id / base_amount / base_currency; export must match the same slice."""
        r = _export(client, {"company_id": COMPANY_ID, "search": "LTC"})
        assert r.status_code == 200, r.text[:300]
        rows = _csv_rows(r)
        lst = client.post(
            f"{BASE_URL}/api/wallet/getAllTransactions", json={"company_id": COMPANY_ID}, timeout=120
        ).json()["data"]["customers_transactions"]
        expected = [
            t
            for t in lst
            if "ltc" in str(t.get("id", "")).lower()
            or "ltc" in str(t.get("base_amount", "")).lower()
            or "ltc" in str(t.get("base_currency", "")).lower()
        ]
        assert len(rows) == len(expected), (
            f"export search returned {len(rows)} rows but UI search shows {len(expected)} "
            "(backend only searches ut.id / transaction_reference)"
        )

    def test_export_foreign_company_forbidden(self, client):
        r = _export(client, {"company_id": 999})
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:200]}"

    def test_export_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/wallet/transactions/export",
            json={"company_id": COMPANY_ID},
            timeout=60,
        )
        assert r.status_code in (401, 403), r.status_code
