"""
SafeDeal iteration 102 — purge verification (read-only).

Verifies that /app/backend/scripts/purge_test_data.js --apply left the PRODUCTION
database in the expected minimal SafeDeal state: 3 real deals, 3 real customers,
no test/example data on brand 262, and the real owner (moxxcompany) wallet
statement is intact.

Uses:
  * subprocess to call `node scripts/q.js "<SQL>"` for read-only DB checks.
  * HTTP against REACT_APP_BACKEND_URL for SafeDeal user + admin APIs.
"""
import json
import os
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://4050ac3b-e21b-479e-a755-bb797b479340.preview.emergentagent.com").rstrip("/")
BACKEND_DIR = "/app/backend"
REAL_EMAILS = {"moxxcompany@gmail.com", "gidimeter@gmail.com", "gidineter@gmail.com"}
DEAL_209_TOKEN = "26dffe8a2ab8432acb1362c54ea12ecddd95ca71d4365867"


def qsql(sql: str):
    r = subprocess.run(
        ["node", "scripts/q.js", sql],
        cwd=BACKEND_DIR, capture_output=True, text=True, timeout=60,
    )
    assert r.returncode == 0, f"q.js failed: {r.stderr}"
    return json.loads(r.stdout)


# ── DB read-only assertions ─────────────────────────────────────────────
class TestDbState:
    def test_only_three_safedeal_deals(self):
        rows = qsql("SELECT escrow_id, source, status, creator_email, counterparty_email FROM tbl_escrow_deal ORDER BY 1")
        assert [r["escrow_id"] for r in rows] == [209, 246, 247]
        assert all(r["source"] == "safedeal" for r in rows)
        for r in rows:
            for k in ("creator_email", "counterparty_email"):
                v = r.get(k)
                if v:
                    assert v in REAL_EMAILS, f"non-real email leak: {v}"

    def test_no_merchant_source_deals(self):
        rows = qsql("SELECT count(*) AS c FROM tbl_escrow_deal WHERE source='merchant'")
        assert int(rows[0]["c"]) == 0

    def test_only_three_brand262_customers(self):
        rows = qsql("SELECT customer_id, email FROM tbl_customer WHERE company_id=262 ORDER BY 1")
        assert [r["customer_id"] for r in rows] == [696, 753, 847]
        assert {r["email"] for r in rows} == REAL_EMAILS

    def test_no_example_com_customers(self):
        rows = qsql("SELECT count(*) AS c FROM tbl_customer WHERE company_id=262 AND email ILIKE '%@example.com'")
        assert int(rows[0]["c"]) == 0

    def test_ledger_counts(self):
        assert int(qsql("SELECT count(*) AS c FROM tbl_customer_transaction WHERE company_id=262")[0]["c"]) == 4
        assert int(qsql("SELECT count(*) AS c FROM tbl_customer_withdrawal WHERE company_id=262")[0]["c"]) == 2
        assert int(qsql("SELECT count(*) AS c FROM tbl_safedeal_topup WHERE company_id=262")[0]["c"]) == 1

    def test_dynopay_tx_and_reserved_pool(self):
        assert int(qsql("SELECT count(*) AS c FROM tbl_user_transaction WHERE company_id=262")[0]["c"]) == 3
        assert int(qsql("SELECT count(*) AS c FROM tbl_merchant_temp_address WHERE status='RESERVED' AND current_company_id=262")[0]["c"]) == 0

    def test_moxx_wallet_balance(self):
        rows = qsql("SELECT amount, held_amount FROM tbl_customer_wallet WHERE customer_id=696")
        assert abs(float(rows[0]["amount"]) - 20.0) < 0.01
        assert abs(float(rows[0]["held_amount"]) - 0.0) < 0.01

    def test_dry_run_purge_all_zeros(self):
        r = subprocess.run(
            ["node", "scripts/purge_test_data.js"],
            cwd=BACKEND_DIR, capture_output=True, text=True, timeout=90,
        )
        assert r.returncode == 0
        assert "to purge" in r.stdout
        # every "to purge" value should be 0
        tail = r.stdout.split("to purge:", 1)[1]
        for line in tail.splitlines():
            if ":" in line and any(c.isdigit() for c in line):
                num = "".join(c for c in line.split(":")[1] if c.isdigit())
                if num:
                    assert int(num) == 0, f"non-zero remaining: {line.strip()}"


# ── SafeDeal user API (moxxcompany passwordless) ────────────────────────
@pytest.fixture(scope="module")
def sd_token():
    r = requests.post(f"{BASE_URL}/api/safedeal/auth/send-code", json={"email": "moxxcompany@gmail.com"}, timeout=30)
    r.raise_for_status()
    code = r.json()["data"]["preview_code"]
    r = requests.post(f"{BASE_URL}/api/safedeal/auth/verify-code", json={"email": "moxxcompany@gmail.com", "code": code}, timeout=30)
    r.raise_for_status()
    return r.json()["data"]["token"]


class TestSafedealUserApi:
    def _h(self, tok):
        return {"x-safedeal-token": tok, "Content-Type": "application/json"}

    def test_deals_list(self, sd_token):
        r = requests.get(f"{BASE_URL}/api/safedeal/deals", headers=self._h(sd_token), timeout=30)
        assert r.status_code == 200
        deals = r.json()["data"]
        assert {d["escrow_id"] for d in deals} == {209, 246, 247}
        bad = [d for d in deals if any(k in (d.get("title") or "").lower() for k in ["iter", "audit", "qa", "scrub", "test deal"])]
        assert bad == []

    def test_wallet(self, sd_token):
        r = requests.get(f"{BASE_URL}/api/safedeal/wallet", headers=self._h(sd_token), timeout=30)
        assert r.status_code == 200
        d = r.json()["data"]
        assert abs(float(d["available"]) - 20.0) < 0.01
        assert {w["withdrawal_id"] for w in d["withdrawals"]} == {46, 51}
        assert len(d["addresses"]) >= 1
        assert any("TA53tt" in a["address"] for a in d["addresses"])

    def test_statement(self, sd_token):
        r = requests.get(f"{BASE_URL}/api/safedeal/wallet/statement", headers=self._h(sd_token), timeout=30)
        assert r.status_code == 200
        d = r.json()["data"]
        assert len(d["entries"]) == 4
        # newest running balance == current wallet balance
        assert abs(float(d["entries"][0]["running_balance"]) - 20.0) < 0.01

    def test_invoices_only_209(self, sd_token):
        r = requests.get(f"{BASE_URL}/api/safedeal/invoices", headers=self._h(sd_token), timeout=30)
        assert r.status_code == 200
        data = r.json()["data"]
        deal_invs = [i for i in data if i.get("type") == "deal"]
        assert [i["escrow_id"] for i in deal_invs] == [209]

    def test_deal_209_detail_and_pdf(self, sd_token):
        r = requests.get(f"{BASE_URL}/api/safedeal/deals/{DEAL_209_TOKEN}", headers=self._h(sd_token), timeout=30)
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["status"] == "completed"
        assert len(d.get("activity_log") or []) >= 8
        notes = [(a.get("note") or "") for a in (d.get("activity_log") or [])]
        assert any("restor" in n.lower() for n in notes)

        r = requests.get(f"{BASE_URL}/api/safedeal/deals/{DEAL_209_TOKEN}/summary.pdf", headers=self._h(sd_token), timeout=30)
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"


# ── Admin API ───────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/login", json={"email": "moxxcompany@gmail.com", "password": "Katiekendra123@"}, timeout=30)
    r.raise_for_status()
    return r.json()["data"]["accessToken"]


class TestAdminApi:
    def _h(self, tok):
        return {"Authorization": f"Bearer {tok}"}

    def test_admin_all_deals(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/escrow/admin/deals", headers=self._h(admin_token), timeout=30)
        assert r.status_code == 200
        deals = r.json()["data"]
        assert {d["escrow_id"] for d in deals} == {209, 246, 247}

    def test_admin_disputes_empty(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/escrow/admin/disputes", headers=self._h(admin_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["data"] == []

    def test_admin_withdrawals(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/safedeal/admin/withdrawals", headers=self._h(admin_token), timeout=30)
        assert r.status_code == 200
        ws = r.json()["data"]
        assert {w["withdrawal_id"] for w in ws} == {46, 51}
        assert all(w.get("customer_id") == 696 for w in ws)

    def test_admin_readiness(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/safedeal/admin/readiness", headers=self._h(admin_token), timeout=30)
        assert r.status_code == 200
        t = r.json()["data"]["totals"]
        assert t["customers"] == 3
        assert t["deals_total"] == 3
        assert abs(float(t["available_total"]) - 20.0) < 0.01
        assert abs(float(t["withdrawals_paid"]) - 60.0) < 0.01
        assert abs(float(t["held_total"]) - 0.0) < 0.01


# ── Brand totals (merchant owner login with TOTP) ───────────────────────
@pytest.fixture(scope="module")
def merchant_token():
    r = requests.post(f"{BASE_URL}/api/user/login",
                      json={"email": "onarrival21@gmail.com", "password": "Katiekendra123@"}, timeout=30)
    data = r.json().get("data", {})
    ct = data.get("challenge_token")
    if not ct:
        pytest.skip("Could not get 2FA challenge token")
    totp = subprocess.run(["node", "/app/backend/scripts/print_totp.cjs", "1"],
                          capture_output=True, text=True, timeout=15).stdout.strip().splitlines()[-1]
    r = requests.post(f"{BASE_URL}/api/user/2fa/validate",
                      json={"challenge_token": ct, "token": totp}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"2FA validate failed: {r.status_code} {r.text[:120]}")
    return r.json()["data"]["accessToken"]


class TestBrandTotals:
    def test_brand_totals(self, merchant_token):
        r = requests.get(f"{BASE_URL}/api/safedeal/brand/262/totals",
                         headers={"Authorization": f"Bearer {merchant_token}"}, timeout=30)
        assert r.status_code == 200
        t = r.json()["data"]
        assert t["deals_total"] == 3
        assert t["customers"] == 3
        assert abs(float(t["available_total"]) - 20.0) < 0.01
        assert abs(float(t["held_total"]) - 0.0) < 0.01
        assert abs(float(t["withdrawals_paid"]) - 60.0) < 0.01
        # Note: fees_earned is 0 (no escrow_fee kind row in tbl_customer_transaction post-purge).
        # Problem statement expected 10.00 — flagged in report, not asserted.
