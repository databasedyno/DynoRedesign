"""
SafeDeal security audit regression tests (T1-T9).
Verifies preview_code leak closed, simulation disabled, step-up hardened,
rate limiting, ledger DB invariants, and no fake balance mutation.
"""
import os, time, subprocess, json, requests, pytest

BASE = "https://secure-passphrase-6.preview.emergentagent.com"
API = f"{BASE}/api/safedeal"
TS = str(int(time.time()))

session_state = {"tokens": {}, "customer_ids": [], "throwaway_email": None, "buyer_email": None,
                 "buyer_token": None, "deal_token": None, "address_id": None}


def ro_sql(sql):
    r = subprocess.run(["node", "scripts/ro_query.js", sql], capture_output=True, text=True,
                       cwd="/app/backend", env={**os.environ, "RO_JSON": "1"}, timeout=30)
    if r.returncode != 0:
        return None
    try:
        return json.loads(r.stdout)
    except Exception:
        return None


# ---------------- T1: preview_code leak closed ----------------
class TestT1PreviewCodeLeak:
    def test_real_gmail_no_preview_code(self):
        email = f"sec-victim-{TS}@gmail.com"
        r = requests.post(f"{API}/auth/send-code", json={"email": email}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json().get("data") or {}
        assert "preview_code" not in d, f"LEAK: preview_code present for real gmail: {d}"

    def test_example_com_has_preview_code(self):
        email = f"sd-sec-{TS}@example.com"
        session_state["throwaway_email"] = email
        r = requests.post(f"{API}/auth/send-code", json={"email": email}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json().get("data") or {}
        assert "preview_code" in d and len(str(d["preview_code"])) == 6, d
        session_state["tokens"]["preview_code"] = d["preview_code"]

    @pytest.mark.parametrize("email,expected", [
        (f"x-{TS}@example.org", True),
        (f"x-{TS}@foo.test", True),
        (f"x-{TS}@example.net", True),
        (f"x-{TS}@examplecom.com", False),
        (f"x-{TS}@notexample.com", False),
        (f"x-{TS}@example.com.evil.io", False),
    ])
    def test_reserved_domains(self, email, expected):
        r = requests.post(f"{API}/auth/send-code", json={"email": email}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json().get("data") or {}
        has = "preview_code" in d
        assert has == expected, f"{email}: expected preview_code={expected}, got={has} data={d}"


# ---------------- T2: sign-in works, wrong code lockout ----------------
class TestT2SignIn:
    def test_verify_code_returns_token(self):
        code = session_state["tokens"]["preview_code"]
        r = requests.post(f"{API}/auth/verify-code",
                          json={"email": session_state["throwaway_email"], "code": code}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json().get("data") or {}
        assert "token" in d, d
        session_state["tokens"]["auth"] = d["token"]

    def test_wrong_code_5_times_locks(self):
        email = f"sd-sec-lockout-{TS}@example.com"
        r = requests.post(f"{API}/auth/send-code", json={"email": email}, timeout=15)
        real_code = r.json()["data"]["preview_code"]
        for i in range(5):
            rr = requests.post(f"{API}/auth/verify-code", json={"email": email, "code": "000000"}, timeout=15)
            assert rr.status_code == 400, f"attempt {i}: {rr.status_code} {rr.text}"
        # Now correct code should fail (code deleted)
        rr = requests.post(f"{API}/auth/verify-code", json={"email": email, "code": real_code}, timeout=15)
        # After 5 wrong attempts the code must be invalidated -> correct code must NOT return 200 token
        assert rr.status_code == 400, rr.text
        assert "token" not in (rr.json().get("data") or {}), rr.text


def hdr():
    return {"x-safedeal-token": session_state["tokens"]["auth"]}


# ---------------- T4: simulation OFF ----------------
class TestT4SimulationOff:
    def test_config_no_simulation(self):
        r = requests.get(f"{API}/config", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json().get("data") or {}
        assert d.get("live_settlement") is False, d
        assert d.get("simulation_allowed") is False, d

    def test_wallet_no_simulation(self):
        r = requests.get(f"{API}/wallet", headers=hdr(), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json().get("data") or {}
        assert d.get("simulation_allowed") is False, d
        # capture customer_id
        cid = d.get("customer_id") or d.get("wallet", {}).get("customer_id")
        if cid:
            session_state["customer_ids"].append(int(cid))

    def test_topup_simulate_403(self):
        # Try create topup
        coin = "USDT-POLYGON"
        r = requests.post(f"{API}/wallet/topup", json={"amount": 10, "coin": coin}, headers=hdr(), timeout=20)
        if r.status_code != 200:
            # try to fetch supported coins
            rr = requests.get(f"{API}/wallet/topup/coins", params={"amount": 10}, headers=hdr(), timeout=15)
            if rr.status_code == 200:
                coins = (rr.json().get("data") or {}).get("coins") or []
                if coins:
                    coin = coins[0].get("coin") or coins[0].get("code") or coin
                    r = requests.post(f"{API}/wallet/topup", json={"amount": 10, "coin": coin}, headers=hdr(), timeout=20)
        assert r.status_code in (200, 201), f"topup create failed: {r.status_code} {r.text}"
        topup_id = (r.json().get("data") or {}).get("topup", {}).get("topup_id") or \
                   (r.json().get("data") or {}).get("topup_id")
        assert topup_id, r.text
        rs = requests.post(f"{API}/wallet/topup/{topup_id}/simulate", headers=hdr(), timeout=15)
        assert rs.status_code == 403, f"expected 403 got {rs.status_code}: {rs.text}"
        assert "disabled on this server" in rs.text.lower(), rs.text
        # wallet balance still 0
        w = requests.get(f"{API}/wallet", headers=hdr(), timeout=15).json()
        avail = (w.get("data") or {}).get("wallet", {}).get("available_usd") or \
                (w.get("data") or {}).get("available") or 0
        assert float(avail) == 0.0, f"wallet leaked balance: {avail}"


# ---------------- T3: step-up hardening ----------------
class TestT3StepUp:
    def test_stepup_preview_code(self):
        r = requests.post(f"{API}/auth/step-up", json={"action": "cashout"}, headers=hdr(), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json().get("data") or {}
        assert "preview_code" in d, d
        session_state["tokens"]["stepup"] = d["preview_code"]

    def test_5_wrong_then_correct_fails(self):
        addr_body = {"payout_key": "USDT-POLYGON",
                     "address": "0x000000000000000000000000000000000000dEaD"}
        for i in range(5):
            rr = requests.post(f"{API}/wallet/addresses",
                               json={**addr_body, "code": "000000"}, headers=hdr(), timeout=15)
            assert rr.status_code == 400, f"attempt {i}: {rr.status_code} {rr.text}"
        # Correct code should now fail (invalidated)
        rr = requests.post(f"{API}/wallet/addresses",
                           json={**addr_body, "code": session_state["tokens"]["stepup"]},
                           headers=hdr(), timeout=15)
        assert rr.status_code == 400, f"expected 400 (invalidated) got {rr.status_code}: {rr.text}"

    def test_fresh_stepup_single_use(self):
        r = requests.post(f"{API}/auth/step-up", json={"action": "cashout"}, headers=hdr(), timeout=15)
        code = r.json()["data"]["preview_code"]
        addr_body = {"payout_key": "USDT-POLYGON",
                     "address": "0x000000000000000000000000000000000000dEaD", "code": code}
        r1 = requests.post(f"{API}/wallet/addresses", json=addr_body, headers=hdr(), timeout=15)
        assert r1.status_code in (200, 201), f"first attempt should succeed: {r1.status_code} {r1.text}"
        d = r1.json().get("data") or {}
        # capture address_id
        aid = d.get("address_id") or d.get("id") or (d.get("address") or {}).get("id")
        if aid:
            session_state["address_id"] = aid
        # Reuse same code -> 400
        r2 = requests.post(f"{API}/wallet/addresses",
                           json={**addr_body, "address": "0x0000000000000000000000000000000000001dEa"},
                           headers=hdr(), timeout=15)
        assert r2.status_code == 400, f"expected 400 (single-use) got {r2.status_code}: {r2.text}"


# ---------------- T5: fake deal funding OFF ----------------
class TestT5DealFunding:
    def test_create_and_fund_403(self):
        buyer_email = f"sd-buyer-{TS}@example.com"
        session_state["buyer_email"] = buyer_email
        body = {"title": "sec test deal", "description": "sec test",
                "amount": 50, "price_currency": "USD",
                "my_role": "seller", "counterparty_email": buyer_email}
        r = requests.post(f"{API}/deals", json=body, headers=hdr(), timeout=20)
        assert r.status_code in (200, 201), r.text
        d = r.json().get("data") or {}
        deal = d.get("deal") or d
        token = deal.get("deal_token") or deal.get("token")
        assert token, r.text
        session_state["deal_token"] = token

        # Sign in as buyer
        rs = requests.post(f"{API}/auth/send-code", json={"email": buyer_email}, timeout=15)
        code = rs.json()["data"]["preview_code"]
        rv = requests.post(f"{API}/auth/verify-code", json={"email": buyer_email, "code": code}, timeout=15)
        buyer_tok = rv.json()["data"]["token"]
        session_state["buyer_token"] = buyer_tok
        bhdr = {"x-safedeal-token": buyer_tok}

        # capture buyer customer id
        w = requests.get(f"{API}/wallet", headers=bhdr, timeout=15).json()
        cid = (w.get("data") or {}).get("customer_id") or (w.get("data") or {}).get("wallet", {}).get("customer_id")
        if cid:
            session_state["customer_ids"].append(int(cid))

        # Try accept (best effort)
        requests.post(f"{API}/deals/{token}/action", json={"action": "accept"}, headers=bhdr, timeout=15)

        # fund action -> 403
        rf = requests.post(f"{API}/deals/{token}/action", json={"action": "fund"}, headers=bhdr, timeout=15)
        assert rf.status_code == 403, f"expected 403 got {rf.status_code}: {rf.text}"
        assert "simulated" in rf.text.lower() and "disabled" in rf.text.lower(), rf.text

        # fund-balance with zero balance -> 400
        rfb = requests.post(f"{API}/deals/{token}/action", json={"action": "fund-balance"},
                            headers=bhdr, timeout=15)
        assert rfb.status_code == 400, f"expected 400 got {rfb.status_code}: {rfb.text}"


# ---------------- T6: rate limiting ----------------
class TestT6RateLimit:
    def test_send_code_rate_limit(self):
        email = f"sd-rl-{TS}@example.com"
        last = None
        for i in range(12):
            last = requests.post(f"{API}/auth/send-code", json={"email": email}, timeout=15)
            if last.status_code == 429:
                break
        assert last.status_code == 429, f"expected 429 by 12th attempt, got {last.status_code}"
        # Retry-After should be present
        assert last.headers.get("Retry-After") or last.headers.get("retry-after"), \
            f"missing Retry-After header: {dict(last.headers)}"

    def test_telegram_strict_limit(self):
        last = None
        for i in range(22):
            last = requests.post(f"{API}/auth/telegram", json={"garbage": True}, timeout=15)
            if last.status_code == 429:
                break
        assert last.status_code == 429, f"expected 429, got {last.status_code}"


# ---------------- T7: ledger DB invariants ----------------
class TestT7DBInvariants:
    def test_unique_index_exists(self):
        rows = ro_sql(
            "SELECT indexname FROM pg_indexes WHERE indexname='uq_customer_transaction_safedeal_reference'")
        assert rows and len(rows) == 1, rows

    def test_migration_recorded(self):
        rows = ro_sql(
            "SELECT version FROM schema_migrations WHERE version='0052_safedeal_ledger_unique_reference'")
        assert rows and len(rows) == 1, rows


# ---------------- T9: withdrawal with no balance ----------------
class TestT9WithdrawNoBalance:
    def test_withdraw_zero_balance_no_row(self):
        if not session_state.get("address_id"):
            pytest.skip("no saved address")
        # fresh step-up
        r = requests.post(f"{API}/auth/step-up", json={"action": "cashout"}, headers=hdr(), timeout=15)
        assert r.status_code == 200, f"stepup failed: {r.status_code} {r.text}"
        code = (r.json().get("data") or {}).get("preview_code")
        assert code, r.text
        # get customer id
        w = requests.get(f"{API}/wallet", headers=hdr(), timeout=15).json()
        cid = (w.get("data") or {}).get("customer_id") or \
              (w.get("data") or {}).get("wallet", {}).get("customer_id")
        rw = requests.post(f"{API}/wallet/withdraw",
                           json={"address_id": session_state["address_id"], "amount": 10, "code": code},
                           headers=hdr(), timeout=20)
        assert rw.status_code == 400, f"expected 400 got {rw.status_code}: {rw.text}"
        assert "insufficient" in rw.text.lower() or "balance" in rw.text.lower(), rw.text
        # verify no row
        if cid:
            rows = ro_sql(f"SELECT count(*)::int AS c FROM tbl_customer_withdrawal WHERE customer_id={int(cid)}")
            assert rows and rows[0]["c"] == 0, rows
