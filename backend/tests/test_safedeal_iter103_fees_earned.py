"""
SafeDeal iteration 103 — fees_earned restoration verification (read-only, PRODUCTION DB).

Verifies /app/backend/scripts/restore_deal_209_ledger.ts fix: the buyer-side ledger
rows for deal #209 that were lost in the 2026-09-20 cascade were re-posted so
brandWalletTotals() now correctly reports fees_earned=10.00 for brand 262.

Covers:
 - Invariant script + SQL row counts + sum(escrow_fee/exchange_fee)
 - Merchant brand totals API + dashboard overview
 - Admin readiness totals
 - Buyer ledger (gidimeter, cid 753) — 5 restored entries for escrow_id 209
 - Seller ledger unchanged (moxxcompany, cid 696) — 4 entries, wallet 20.00
 - Deal #209 integrity (activity_log 9, last 'restored', breakdown, PDF)
 - Purge dry-run remains all-zeros
"""
import json
import os
import subprocess
import time

import pytest
import requests

def _base_url():
    env = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
    if env:
        return env
    # No frontend .env in this pod — the preview URL lives in backend/.env (FRONTEND_URL).
    with open("/app/backend/.env") as f:
        for line in f:
            if line.startswith("FRONTEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL / FRONTEND_URL missing")


BASE_URL = _base_url()
BACKEND_DIR = "/app/backend"
DEAL_209_TOKEN = "26dffe8a2ab8432acb1362c54ea12ecddd95ca71d4365867"
MONEY_TOL = 0.01


def qsql(sql: str):
    r = subprocess.run(
        ["node", "scripts/q.js", sql],
        cwd=BACKEND_DIR, capture_output=True, text=True, timeout=60,
    )
    assert r.returncode == 0, f"q.js failed: {r.stderr}"
    return json.loads(r.stdout)


def _get(url, headers=None, retries=2):
    for i in range(retries + 1):
        r = requests.get(url, headers=headers or {}, timeout=30)
        if r.status_code == 503 and i < retries:
            time.sleep(3)
            continue
        return r
    return r


# ── DB read-only assertions ──────────────────────────────────────────────
class TestDbState:
    def test_ledger_row_count(self):
        n = int(qsql("SELECT count(*) AS c FROM tbl_customer_transaction WHERE company_id=262")[0]["c"])
        assert n == 9, f"expected 9 ledger rows, got {n}"

    def test_fees_sum_is_10(self):
        s = float(qsql(
            "SELECT COALESCE(SUM(paid_amount),0) AS s FROM tbl_customer_transaction "
            "WHERE company_id=262 AND meta->>'kind' IN ('escrow_fee','exchange_fee')"
        )[0]["s"])
        assert abs(s - 10.0) < MONEY_TOL, f"escrow_fee sum={s}, expected 10.00"

    def test_costs_sum_is_374(self):
        s = float(qsql(
            "SELECT COALESCE(SUM(paid_amount),0) AS s FROM tbl_customer_transaction "
            "WHERE company_id=262 AND meta->>'kind' = 'escrow_costs'"
        )[0]["s"])
        assert abs(s - 3.74) < MONEY_TOL

    def test_invariants_clean(self):
        r = subprocess.run(
            ["node", "scripts/safedeal_invariants.js"],
            cwd=BACKEND_DIR, capture_output=True, text=True, timeout=60,
        )
        assert r.returncode == 0, r.stderr
        out = json.loads(r.stdout)
        assert out["issues"] == []
        assert out["settled_deals"] == 1

    def test_dry_run_purge_all_zeros(self):
        r = subprocess.run(
            ["node", "scripts/purge_test_data.js"],
            cwd=BACKEND_DIR, capture_output=True, text=True, timeout=90,
        )
        assert r.returncode == 0
        tail = r.stdout.split("to purge:", 1)[1] if "to purge:" in r.stdout else r.stdout
        for line in tail.splitlines():
            if ":" in line and any(c.isdigit() for c in line):
                num = "".join(c for c in line.split(":")[1] if c.isdigit())
                if num:
                    assert int(num) == 0, f"non-zero: {line.strip()}"


# ── Merchant owner (TOTP 2FA) — brand totals ─────────────────────────────
@pytest.fixture(scope="module")
def merchant_token():
    r = requests.post(f"{BASE_URL}/api/user/login",
                      json={"email": "onarrival21@gmail.com", "password": "Katiekendra123@"}, timeout=30)
    ct = r.json().get("data", {}).get("challenge_token")
    if not ct:
        pytest.skip("no 2FA challenge_token")
    totp = subprocess.run(
        ["node", "/app/backend/scripts/print_totp.cjs", "1"],
        capture_output=True, text=True, timeout=15
    ).stdout.strip().splitlines()[-1]
    r = requests.post(f"{BASE_URL}/api/user/2fa/validate",
                      json={"challenge_token": ct, "token": totp}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"2FA failed {r.status_code}")
    return r.json()["data"]["accessToken"]


class TestBrandTotals:
    def _h(self, tok):
        return {"Authorization": f"Bearer {tok}"}

    def test_brand_totals(self, merchant_token):
        r = _get(f"{BASE_URL}/api/safedeal/brand/262/totals", self._h(merchant_token))
        assert r.status_code == 200
        t = r.json()["data"]
        assert abs(float(t["fees_earned"]) - 10.0) < MONEY_TOL, f"fees_earned={t['fees_earned']}"
        assert abs(float(t["costs_retained"]) - 3.74) < MONEY_TOL
        assert abs(float(t["available_total"]) - 20.0) < MONEY_TOL
        assert abs(float(t["held_total"]) - 0.0) < MONEY_TOL
        assert abs(float(t["withdrawals_paid"]) - 60.0) < MONEY_TOL
        assert int(t["deals_total"]) == 3
        assert int(t["customers"]) == 3
        assert t.get("is_safedeal_brand") is True

    def test_dashboard_card_endpoint_fees(self, merchant_token):
        """The dashboard/customers 'SafeDeal escrow — brand totals' card (BrandEscrowTotals.tsx) reads
        GET /api/safedeal/brand/<company>/totals directly — not the dashboard overview payload."""
        r = _get(f"{BASE_URL}/api/safedeal/brand/262/totals", self._h(merchant_token))
        assert r.status_code == 200, r.text[:200]
        t = r.json()["data"]
        assert abs(float(t["fees_earned"]) - 10.0) < MONEY_TOL, t
        assert abs(float(t["costs_retained"]) - 3.74) < MONEY_TOL, t
        assert abs(float(t["available_total"]) - 20.0) < MONEY_TOL, t
        assert abs(float(t["withdrawals_paid"]) - 60.0) < MONEY_TOL, t
        assert int(t["deals_total"]) == 3
        # the overview endpoint itself must still work for the same brand
        r2 = _get(f"{BASE_URL}/api/dashboard/overview?company_id=262", self._h(merchant_token))
        assert r2.status_code == 200, r2.text[:200]

    @pytest.fixture(scope="class")
    def admin_token(self):
        r = requests.post(f"{BASE_URL}/api/admin/login",
                          json={"email": "moxxcompany@gmail.com", "password": "Katiekendra123@"}, timeout=30)
        assert r.status_code == 200, r.text[:200]
        return r.json()["data"]["accessToken"]

    def test_readiness_fees_earned(self, admin_token):
        r = _get(f"{BASE_URL}/api/safedeal/admin/readiness",
                 {"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        t = r.json()["data"]["totals"]
        assert abs(float(t["fees_earned"]) - 10.0) < MONEY_TOL, f"fees_earned={t['fees_earned']}"
        assert int(t["customers"]) == 3
        assert int(t["deals_total"]) == 3
        assert abs(float(t["available_total"]) - 20.0) < MONEY_TOL
        assert abs(float(t["withdrawals_paid"]) - 60.0) < MONEY_TOL


# ── SafeDeal customer passwordless ───────────────────────────────────────
def sd_login(email):
    r = requests.post(f"{BASE_URL}/api/safedeal/auth/send-code", json={"email": email}, timeout=30)
    r.raise_for_status()
    code = r.json()["data"]["preview_code"]
    r = requests.post(f"{BASE_URL}/api/safedeal/auth/verify-code",
                      json={"email": email, "code": code}, timeout=30)
    r.raise_for_status()
    return r.json()["data"]["token"]


@pytest.fixture(scope="module")
def buyer_token():
    return sd_login("gidimeter@gmail.com")


@pytest.fixture(scope="module")
def seller_token():
    return sd_login("moxxcompany@gmail.com")


def _sdh(tok):
    return {"x-safedeal-token": tok}


# ── Buyer ledger (5 restored entries for escrow_id 209) ──────────────────
class TestBuyerLedger:
    def test_buyer_wallet_zero(self, buyer_token):
        r = _get(f"{BASE_URL}/api/safedeal/wallet", _sdh(buyer_token))
        assert r.status_code == 200
        d = r.json()["data"]
        assert abs(float(d["available"]) - 0.0) < MONEY_TOL
        assert abs(float(d.get("held", 0)) - 0.0) < MONEY_TOL

    def test_buyer_statement_five_restored_entries(self, buyer_token):
        r = _get(f"{BASE_URL}/api/safedeal/wallet/statement", _sdh(buyer_token))
        assert r.status_code == 200
        entries = r.json()["data"]["entries"]
        # filter to escrow 209
        e209 = [e for e in entries if str(e.get("escrow_id") or (e.get("meta") or {}).get("escrow_id") or "") == "209"]
        assert len(e209) == 5, f"expected 5 escrow_id=209 entries, got {len(e209)}: {[e.get('kind') or e.get('type') for e in e209]}"
        kinds = [(e.get("kind") or e.get("type") or (e.get("meta") or {}).get("kind") or "").lower() for e in e209]
        expected_kinds = {"escrow_funding", "hold_released", "paid_to_seller", "escrow_fee", "escrow_costs"}
        assert expected_kinds.issubset(set(kinds)), f"kinds present: {kinds}"
        # every entry has meta.restored true
        for e in e209:
            meta = e.get("meta") or {}
            assert meta.get("restored") is True, f"missing restored flag on {e}"
        # no simulated/binance
        blob = json.dumps(e209).lower()
        assert "simulated" not in blob, "'simulated' text appears"
        assert "binance" not in blob, "'binance' text appears"
        # final running balance 0 (either newest-first or oldest-first)
        first_rb = float(e209[0].get("running_balance", 0))
        last_rb = float(e209[-1].get("running_balance", 0))
        assert abs(first_rb) < MONEY_TOL or abs(last_rb) < MONEY_TOL


# ── Seller ledger unchanged ──────────────────────────────────────────────
class TestSellerLedger:
    def test_seller_wallet(self, seller_token):
        r = _get(f"{BASE_URL}/api/safedeal/wallet", _sdh(seller_token))
        assert r.status_code == 200
        d = r.json()["data"]
        assert abs(float(d["available"]) - 20.0) < MONEY_TOL
        assert {w["withdrawal_id"] for w in d["withdrawals"]} == {46, 51}

    def test_seller_statement_four_entries(self, seller_token):
        r = _get(f"{BASE_URL}/api/safedeal/wallet/statement", _sdh(seller_token))
        assert r.status_code == 200
        entries = r.json()["data"]["entries"]
        assert len(entries) == 4
        assert abs(float(entries[0]["running_balance"]) - 20.0) < MONEY_TOL


# ── Deal #209 integrity ──────────────────────────────────────────────────
class TestDeal209:
    def test_deal_detail(self, seller_token):
        r = _get(f"{BASE_URL}/api/safedeal/deals/{DEAL_209_TOKEN}", _sdh(seller_token))
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["status"] == "completed"
        alog = d.get("activity_log") or []
        assert len(alog) == 9, f"activity_log len={len(alog)}"
        last = alog[-1]
        assert (last.get("type") or "").lower() == "restored", f"last type={last.get('type')}"
        note = (last.get("note") or "").lower()
        assert "wallet ledger" in note or "re-post" in note or "reposted" in note
        bd = d.get("breakdown") or {}
        assert abs(float(bd.get("escrowFee", bd.get("escrow_fee", 0))) - 10.0) < MONEY_TOL
        assert abs(float(bd.get("passThroughCosts", bd.get("pass_through_costs", 0))) - 3.74) < MONEY_TOL
        assert abs(float(bd.get("buyerPays", bd.get("buyer_pays", 0))) - 43.74) < MONEY_TOL
        assert d.get("fee_locked") is True or bd.get("fee_locked") is True

    def test_invoice_209(self, seller_token):
        r = _get(f"{BASE_URL}/api/safedeal/invoices", _sdh(seller_token))
        assert r.status_code == 200
        invs = [i for i in r.json()["data"] if i.get("type") == "deal" and i.get("escrow_id") == 209]
        assert len(invs) == 1
        inv = invs[0]
        total = float(inv.get("total_cost", inv.get("my_fee_share", 0)))
        assert abs(total - 13.74) < MONEY_TOL, f"total_cost={total}"

    def test_summary_pdf(self, seller_token):
        r = _get(f"{BASE_URL}/api/safedeal/deals/{DEAL_209_TOKEN}/summary.pdf", _sdh(seller_token))
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"
