"""Iteration 218 — Fee Reconciliation + Crumb Sweeper (dry-run only) backend tests.

SAFE: reads via GET; POST reconcile/backfill only write to audit table; consolidate-crumbs
is ONLY invoked with dry_run:true (never broadcasts).
"""
import os
import time
import pytest
import requests

BASE_URL = "https://passphrase-init-1.preview.emergentagent.com"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
CREDS = {"email": "moxxcompany@gmail.com", "password": "Katiekendra123@"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/admin/login",
        json=CREDS,
        headers={"User-Agent": UA, "Content-Type": "application/json"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    tok = r.json()["data"]["accessToken"]
    assert tok
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {
        "Authorization": f"Bearer {admin_token}",
        "User-Agent": UA,
        "Content-Type": "application/json",
    }


# -------------------------- Fee Reconciliation GET --------------------------
class TestFeeReconciliationGet:
    def test_unauth_forbidden(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/fee-reconciliation?limit=5",
            headers={"User-Agent": UA},
            timeout=30,
        )
        assert r.status_code in (401, 403), r.text

    def test_basic_shape(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/fee-reconciliation?limit=5",
            headers=auth_headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        data = body.get("data") or body
        s = data["summary"]
        for k in [
            "payouts", "reconciled", "pending", "unavailable",
            "charged_usd", "actual_usd", "variance_usd",
            "over", "under", "ok", "by_chain",
        ]:
            assert k in s, f"summary missing {k}"
        assert "rows" in data and "page" in data and "limit" in data and "total" in data
        # Invariant: reconciled == over+under+ok
        assert s["reconciled"] == s["over"] + s["under"] + s["ok"], s
        # total == payouts when no verdict/status filter
        assert data["total"] == s["payouts"], (data["total"], s["payouts"])
        # Row shape
        if data["rows"]:
            row = data["rows"][0]
            for k in ["audit_id", "wallet_type", "payout_tx_hash",
                       "charged_fee_usd", "verdict"]:
                assert k in row, f"row missing {k}"
            assert "explorer_url" in row

    def test_verdict_ok_filter(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/fee-reconciliation?limit=25&verdict=ok",
            headers=auth_headers, timeout=60,
        )
        assert r.status_code == 200
        data = r.json().get("data") or r.json()
        for row in data["rows"]:
            assert row["verdict"] == "ok", row
            v = row.get("variance_usd")
            if v is not None:
                assert abs(float(v)) <= 0.05 + 1e-9, row
        assert data["total"] == data["summary"]["ok"], (data["total"], data["summary"])

    def test_verdict_under_filter(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/fee-reconciliation?limit=25&verdict=under",
            headers=auth_headers, timeout=60,
        )
        assert r.status_code == 200
        data = r.json().get("data") or r.json()
        for row in data["rows"]:
            assert row["verdict"] == "under", row
            if row.get("variance_usd") is not None:
                assert float(row["variance_usd"]) < -0.05 + 1e-9, row

    def test_chain_filter_trc20(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/fee-reconciliation?limit=25&chain=USDT_TRC20",
            headers=auth_headers, timeout=60,
        )
        assert r.status_code == 200
        data = r.json().get("data") or r.json()
        for row in data["rows"]:
            assert row["wallet_type"] == "USDT_TRC20", row

    def test_status_pending_filter(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/fee-reconciliation?limit=25&status=pending",
            headers=auth_headers, timeout=60,
        )
        assert r.status_code == 200
        data = r.json().get("data") or r.json()
        for row in data["rows"]:
            assert row["verdict"] == "pending", row

    def test_pagination_distinct(self, auth_headers):
        r1 = requests.get(
            f"{BASE_URL}/api/admin/fee-reconciliation?limit=5&page=1",
            headers=auth_headers, timeout=60,
        )
        r2 = requests.get(
            f"{BASE_URL}/api/admin/fee-reconciliation?limit=5&page=2",
            headers=auth_headers, timeout=60,
        )
        assert r1.status_code == 200 and r2.status_code == 200
        ids1 = {row["audit_id"] for row in (r1.json().get("data") or r1.json())["rows"]}
        ids2 = {row["audit_id"] for row in (r2.json().get("data") or r2.json())["rows"]}
        if ids1 and ids2:
            assert ids1.isdisjoint(ids2), (ids1, ids2)


# -------------------------- Reconcile + Backfill writes --------------------------
class TestFeeReconciliationWrites:
    def test_reconcile_endpoint(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/fee-reconciliation/reconcile",
            json={"limit": 5},
            headers=auth_headers, timeout=120,
        )
        assert r.status_code == 200, r.text
        data = r.json().get("data") or r.json()
        for k in ["reconciled", "pending", "unavailable"]:
            assert k in data, data
            assert isinstance(data[k], int)

    def test_backfill_endpoint_idempotent(self, auth_headers):
        # Snapshot summary.payouts before
        pre = requests.get(
            f"{BASE_URL}/api/admin/fee-reconciliation?limit=1",
            headers=auth_headers, timeout=60,
        ).json()
        pre_data = pre.get("data") or pre
        pre_payouts = pre_data["summary"]["payouts"]

        r = requests.post(
            f"{BASE_URL}/api/admin/fee-reconciliation/backfill",
            json={"days": 30},
            headers=auth_headers, timeout=180,
        )
        assert r.status_code == 200, r.text
        data = r.json().get("data") or r.json()
        assert data.get("days") == 30
        for k in ["scanned", "inserted", "reconciled", "pending", "unavailable"]:
            assert k in data, data

        # After: payouts should NOT decrease
        post = requests.get(
            f"{BASE_URL}/api/admin/fee-reconciliation?limit=5&page=1",
            headers=auth_headers, timeout=60,
        ).json()
        post_data = post.get("data") or post
        assert post_data["summary"]["payouts"] >= pre_payouts

        # Uniqueness of pool_tx_id / audit_id across page 1
        page1_ids = [row["audit_id"] for row in post_data["rows"]]
        assert len(page1_ids) == len(set(page1_ids)), page1_ids


# -------------------------- Crumb Sweeper --------------------------
class TestCrumbSweeper:
    def test_unauth_report_forbidden(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/pool/crumbs-report",
            headers={"User-Agent": UA}, timeout=30,
        )
        assert r.status_code in (401, 403), r.text

    def test_report_shape(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/pool/crumbs-report",
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        data = body.get("data") or body
        assert "running" in data
        assert isinstance(data["running"], bool)
        # Report may be null if never run
        report = data.get("report")
        if report:
            for k in ["dryRun", "thresholdUsd", "totals", "swept", "skipped"]:
                assert k in report, f"report missing {k}"
            for tk in ["sweptUsdt", "reclaimedTrx", "strandedUsdt", "strandedTrx"]:
                assert tk in report["totals"], report["totals"]

    def test_dry_run_start_and_conflict(self, auth_headers):
        # If already running, wait a bit first
        for _ in range(30):
            rep = requests.get(
                f"{BASE_URL}/api/admin/pool/crumbs-report",
                headers=auth_headers, timeout=30,
            ).json()
            rep_data = rep.get("data") or rep
            if not rep_data.get("running"):
                break
            time.sleep(3)

        r1 = requests.post(
            f"{BASE_URL}/api/admin/pool/consolidate-crumbs",
            json={"dry_run": True},
            headers=auth_headers, timeout=30,
        )
        assert r1.status_code in (200, 202), r1.text
        b1 = r1.json().get("data") or r1.json()
        assert b1.get("started") is True, b1
        assert b1.get("dry_run") is True, b1

        # Second call immediately should conflict
        r2 = requests.post(
            f"{BASE_URL}/api/admin/pool/consolidate-crumbs",
            json={"dry_run": True},
            headers=auth_headers, timeout=30,
        )
        # 409 expected while running; could be 200 with started:false depending on impl
        if r2.status_code == 409:
            pass
        else:
            body2 = r2.json().get("data") or r2.json()
            assert body2.get("started") in (False, None) or "running" in str(body2).lower(), body2

        # Poll until done (up to ~3 min)
        final_report = None
        for _ in range(60):
            rep = requests.get(
                f"{BASE_URL}/api/admin/pool/crumbs-report",
                headers=auth_headers, timeout=30,
            ).json()
            rep_data = rep.get("data") or rep
            if not rep_data.get("running"):
                final_report = rep_data.get("report")
                break
            time.sleep(3)

        assert final_report is not None, "Report never populated"
        assert final_report.get("dryRun") is True, final_report
        assert final_report.get("swept") == [] or final_report.get("totals", {}).get("sweptUsdt", 0) == 0, final_report
        # every skip should have a reason string
        for s in final_report.get("skipped", []):
            assert "reason" in s, s


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
