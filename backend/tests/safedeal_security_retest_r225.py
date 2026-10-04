"""
SafeDeal security RETEST — iteration 225 (R1..R6).
Covers cases that were 429-blocked in the previous run + one skipped test.
Cleanup (R7) is performed separately via /app/backend/scripts/cleanup_r225.js.
"""
import os, time, subprocess, json, requests, pytest

BASE = "https://vault-auth-setup.preview.emergentagent.com"
API = f"{BASE}/api/safedeal"
TS = str(int(time.time()))

state = {
    "email": None,
    "token": None,
    "customer_id": None,
    "address_id": None,
}


def ro_sql(sql):
    r = subprocess.run(
        ["node", "scripts/ro_query.js", sql],
        capture_output=True, text=True,
        cwd="/app/backend", env={**os.environ, "RO_JSON": "1"}, timeout=30,
    )
    if r.returncode != 0:
        print("ro_sql err:", r.stderr)
        return None
    try:
        return json.loads(r.stdout)
    except Exception:
        return None


def hdr():
    return {"x-safedeal-token": state["token"]}


def post_retry(url, **kw):
    """POST with retry on transient 503 'Backend starting'."""
    for _ in range(20):
        r = requests.post(url, timeout=15, **kw)
        if r.status_code == 503 and "starting" in r.text.lower():
            time.sleep(3)
            continue
        return r
    return r


def get_retry(url, **kw):
    for _ in range(20):
        r = requests.get(url, timeout=15, **kw)
        if r.status_code == 503 and "starting" in r.text.lower():
            time.sleep(3)
            continue
        return r
    return r


# ------- fixture: one throwaway account for R1..R4 -------
@pytest.fixture(scope="module", autouse=True)
def bootstrap_account():
    email = f"sd-sec2-{TS}@example.com"
    state["email"] = email
    r = post_retry(f"{API}/auth/send-code", json={"email": email})
    assert r.status_code == 200, r.text
    code = r.json()["data"]["preview_code"]
    r = post_retry(f"{API}/auth/verify-code", json={"email": email, "code": code})
    assert r.status_code == 200, r.text
    state["token"] = r.json()["data"]["token"]
    # capture customer id via DB (wallet response does not include it)
    rows = ro_sql(f"SELECT customer_id FROM tbl_customer WHERE email='{email}'")
    assert rows and len(rows) == 1, f"customer not found for {email}: {rows}"
    state["customer_id"] = int(rows[0]["customer_id"])
    print(f"\n[bootstrap] email={email} customer_id={state['customer_id']}")
    yield


# ---------------- R1: step-up brute-force lockout ----------------
class TestR1StepUpLockout:
    def test_stepup_returns_preview_code(self):
        r = requests.post(f"{API}/auth/step-up", json={"action": "address_add"}, headers=hdr(), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json().get("data") or {}
        assert "preview_code" in d and len(str(d["preview_code"])) == 6, d
        state["_r1_code"] = d["preview_code"]

    def test_five_wrong_then_correct_all_400(self):
        body = {"payout_key": "USDT-POLYGON",
                "address": "0x000000000000000000000000000000000000dEaD"}
        for i in range(5):
            rr = requests.post(f"{API}/wallet/addresses",
                               json={**body, "code": "000000"}, headers=hdr(), timeout=15)
            assert rr.status_code == 400, f"wrong attempt {i}: {rr.status_code} {rr.text}"
            assert "invalid" in rr.text.lower() or "expired" in rr.text.lower(), rr.text
        # correct code now invalidated
        rr = requests.post(f"{API}/wallet/addresses",
                           json={**body, "code": state["_r1_code"]},
                           headers=hdr(), timeout=15)
        assert rr.status_code == 400, f"post-lockout should still 400: {rr.status_code} {rr.text}"


# ---------------- R2: step-up single use ----------------
class TestR2StepUpSingleUse:
    def test_fresh_stepup_first_use_saves(self):
        r = requests.post(f"{API}/auth/step-up", json={"action": "address_add"}, headers=hdr(), timeout=15)
        assert r.status_code == 200, r.text
        code = r.json()["data"]["preview_code"]
        state["_r2_code"] = code
        body = {"payout_key": "USDT-POLYGON",
                "address": "0x000000000000000000000000000000000000dEaD",
                "code": code}
        r1 = requests.post(f"{API}/wallet/addresses", json=body, headers=hdr(), timeout=15)
        assert r1.status_code in (200, 201), f"first save must succeed: {r1.status_code} {r1.text}"
        d = r1.json().get("data") or {}
        aid = d.get("address_id") or d.get("id") or (d.get("address") or {}).get("id") or \
              (d.get("address") or {}).get("address_id")
        assert aid, r1.text
        state["address_id"] = aid
        print(f"[R2] saved address_id={aid}")

    def test_same_code_second_use_400(self):
        body = {"payout_key": "USDT-POLYGON",
                "address": "0x1111111111111111111111111111111111111111",
                "code": state["_r2_code"]}
        r2 = requests.post(f"{API}/wallet/addresses", json=body, headers=hdr(), timeout=15)
        assert r2.status_code == 400, f"reuse should be 400: {r2.status_code} {r2.text}"


# ---------------- R3: top-up simulate blocked ----------------
class TestR3TopupSimulateBlocked:
    def test_simulate_403_disabled(self):
        # get supported coins first
        rc = requests.get(f"{API}/wallet/topup/coins", params={"amount": 10}, headers=hdr(), timeout=15)
        assert rc.status_code == 200, rc.text
        coins = ((rc.json().get("data") or {}).get("coins") or [])
        coin = None
        if coins:
            coin = coins[0].get("coin") or coins[0].get("code")
        print(f"[R3] first coin={coin}")
        topup_id = None
        if coin:
            r = requests.post(f"{API}/wallet/topup", json={"amount": 10, "coin": coin},
                              headers=hdr(), timeout=20)
            print(f"[R3] topup create: {r.status_code} {r.text[:200]}")
            if r.status_code in (200, 201):
                d = r.json().get("data") or {}
                topup_id = (d.get("topup") or {}).get("topup_id") or d.get("topup_id")
        if not topup_id:
            topup_id = "999999999"
            print(f"[R3] using bogus topup_id for gate check: {topup_id}")
        rs = requests.post(f"{API}/wallet/topup/{topup_id}/simulate", headers=hdr(), timeout=15)
        assert rs.status_code == 403, f"expected 403 got {rs.status_code}: {rs.text}"
        assert "disabled on this server" in rs.text.lower(), rs.text

    def test_wallet_flags(self):
        w = requests.get(f"{API}/wallet", headers=hdr(), timeout=15).json()
        d = w.get("data") or {}
        avail = d.get("available")
        if avail is None:
            avail = (d.get("wallet") or {}).get("available_usd") or 0
        assert float(avail) == 0.0, f"wallet leaked balance: {avail}"
        # simulation_allowed is exposed via /config (already verified in R6)


# ---------------- R4: withdraw zero balance creates NO row ----------------
class TestR4WithdrawNoRow:
    def test_withdraw_400_no_row(self):
        assert state.get("address_id"), "need address_id from R2"
        r = requests.post(f"{API}/auth/step-up", json={"action": "cashout"}, headers=hdr(), timeout=15)
        assert r.status_code == 200, f"stepup failed: {r.status_code} {r.text}"
        code = r.json()["data"]["preview_code"]
        rw = requests.post(f"{API}/wallet/withdraw",
                           json={"address_id": state["address_id"], "amount": 10, "code": code},
                           headers=hdr(), timeout=20)
        assert rw.status_code == 400, f"expected 400 got {rw.status_code}: {rw.text}"
        assert "insufficient" in rw.text.lower(), rw.text
        rows = ro_sql(
            f"SELECT count(*)::int AS c FROM tbl_customer_withdrawal WHERE customer_id={state['customer_id']}"
        )
        assert rows is not None, "SQL failed"
        assert rows[0]["c"] == 0, f"withdrawal row leaked! rows={rows}"


# ---------------- R5: per-route rate limits independent ----------------
class TestR5PerRouteLimits:
    def test_telegram_bucket_then_stepup_ok(self):
        last = None
        first_429_at = None
        for i in range(21):
            last = requests.post(f"{API}/auth/telegram", json={}, timeout=15)
            if last.status_code == 429 and first_429_at is None:
                first_429_at = i + 1
        print(f"[R5] first 429 on telegram at attempt #{first_429_at}, last={last.status_code}")
        assert last.status_code == 429, f"expected 429 by 21st attempt, got {last.status_code}"

        # step-up must still work (different bucket)
        rs = requests.post(f"{API}/auth/step-up", json={"action": "address_add"}, headers=hdr(), timeout=15)
        assert rs.status_code == 200, f"stepup should be 200 immediately after telegram-429, got {rs.status_code} {rs.text}"

    def test_stepup_bucket_11th_429(self):
        # We've already done ~4 step-ups (bootstrap + R1 + R2 + R4 + R5 = 5). Fire more until 429.
        last = None
        first_429_at = None
        for i in range(15):
            last = requests.post(f"{API}/auth/step-up", json={"action": "address_add"},
                                 headers=hdr(), timeout=15)
            if last.status_code == 429 and first_429_at is None:
                first_429_at = i + 1
                break
        print(f"[R5] first 429 on step-up at extra attempt #{first_429_at}, last={last.status_code}")
        assert last.status_code == 429, f"expected step-up 429 eventually, got {last.status_code}: {last.text}"


# ---------------- R6: regression quick ----------------
class TestR6Regression:
    def test_real_gmail_no_preview(self):
        email = f"victim2-{TS}@gmail.com"
        r = requests.post(f"{API}/auth/send-code", json={"email": email}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json().get("data") or {}
        assert "preview_code" not in d, f"LEAK: {d}"

    def test_config_flags(self):
        r = requests.get(f"{API}/config", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json().get("data") or {}
        assert d.get("live_settlement") is False, d
        assert d.get("simulation_allowed") is False, d
