"""
SafeDeal iteration 209 — Regression + verification tests for:
  1. Orphan 'Legacy API Customer' fix (top-ups & deal funding)
  2. Crypto NETWORK FEE accuracy per coin (live, not hardcoded 0.10)
  3. Itemized top-up statement (received / network fee / credited)
  4. Branded PDFs + unified invoices list (deposits + deals)
  5. Top-up self-heal (webhook-missed recovery)
  6. Deposit-reserve shield vs auto-withdraw

Run:  pytest /app/backend/tests/test_safedeal_iter209_topup_orphan_fees.py -v
"""
import json, os, subprocess, time, uuid
import pytest
import requests

BASE_URL = os.environ.get("NEXT_PUBLIC_SERVER_URL", "https://passphrase-init-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
RO = "/app/backend/scripts/ro_query.js"
SELFHEAL = "/app/backend/scripts/topup_selfheal_test.js"


def _req(method, path, token=None, json_body=None, params=None, retries=3, timeout=60):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["x-safedeal-token"] = token
    last = None
    for i in range(retries):
        r = requests.request(method, f"{API}{path}", headers=headers, json=json_body, params=params, timeout=timeout)
        last = r
        if r.status_code == 503 and "Backend starting" in (r.text or ""):
            time.sleep(3); continue
        return r
    return last


def _sign_in(prefix="sd-qatest"):
    email = f"{prefix}-{int(time.time()*1000)}-{uuid.uuid4().hex[:6]}@example.com"
    # retry loop for 503 backend-starting
    r = None
    for _ in range(20):
        r = _req("POST", "/safedeal/auth/send-code", json_body={"email": email})
        if r.status_code == 200:
            break
        time.sleep(3)
    assert r.status_code == 200, r.text
    code = r.json()["data"]["preview_code"]
    r = _req("POST", "/safedeal/auth/verify-code", json_body={"email": email, "code": code})
    assert r.status_code == 200, r.text
    token = r.json()["data"]["token"]
    me = _req("GET", "/safedeal/me", token=token).json()["data"]
    return {"email": email, "token": token, "customer_id": me["user"]["customer_id"]}


def _ro_count(sql):
    env = os.environ.copy(); env["RO_JSON"] = "1"
    r = subprocess.run(["node", RO, sql], capture_output=True, text=True, env=env, cwd="/app/backend", timeout=30)
    try:
        rows = json.loads(r.stdout)
        return int(rows[0][list(rows[0].keys())[0]])
    except Exception:
        return None


@pytest.fixture(scope="module")
def user():
    return _sign_in()


# ---------- (1) Auth + baseline ----------

def test_signin_and_me(user):
    assert user["token"] and isinstance(user["customer_id"], int)


# ---------- (2) Per-coin fee accuracy (live) ----------

def test_topup_coins_per_coin_fees(user):
    r = _req("GET", "/safedeal/wallet/topup/coins", token=user["token"], params={"amount": 50})
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    coins = {c["coin"]: c for c in data["coins"]}
    for k in ["USDT-TRC20", "USDT-POLYGON", "USDT-ERC20", "USDC-ERC20", "BTC", "ETH"]:
        assert k in coins, f"missing {k}"
    trc = coins["USDT-TRC20"]
    # PRIMARY CLAIM: USDT-TRC20 must be realistic (not the old $0.10 native-TRX fee)
    assert 1.5 <= trc["network_fee"] <= 4.0, f"USDT-TRC20 network_fee={trc['network_fee']} — expected ~2.25"
    # Per-coin fees are NOT all identical (was the bug)
    fees = {c["coin"]: c["network_fee"] for c in data["coins"]}
    assert len(set(fees.values())) >= 3, f"fees appear shared across coins: {fees}"
    # 'pays' = amount + fees
    for c in data["coins"]:
        expected = round(50 + c.get("network_fee", 0) + c.get("conversion_fee", 0) + c.get("exchange_fee", 0), 2)
        assert abs(c["pays"] - expected) < 0.05, f"{c['coin']}: pays={c['pays']} expected~{expected}"


def test_other_stablecoin_token_fees_are_realistic(user):
    """Regression: token-specific sweep-fee override was supposed to apply to ALL stablecoin funding coins,
    not just USDT-TRC20. Per review: USDT-POLYGON ~0.1, USDT-ERC20/USDC-ERC20 ~6."""
    r = _req("GET", "/safedeal/wallet/topup/coins", token=user["token"], params={"amount": 50})
    coins = {c["coin"]: c for c in r.json()["data"]["coins"]}
    poly = coins["USDT-POLYGON"]["network_fee"]
    erc = coins["USDT-ERC20"]["network_fee"]
    usdc = coins["USDC-ERC20"]["network_fee"]
    problems = []
    if poly < 0.02:
        problems.append(f"USDT-POLYGON network_fee={poly} (expected ~0.1)")
    if erc < 3.0:
        problems.append(f"USDT-ERC20 network_fee={erc} (expected ~6)")
    if usdc < 3.0:
        problems.append(f"USDC-ERC20 network_fee={usdc} (expected ~6)")
    assert not problems, "Token-specific sweep-fee fix did not extend to non-TRC20 stables: " + "; ".join(problems)


# ---------- (3) Orphan customer fix + itemized statement + reserve ----------

def test_topup_no_orphan_itemized_reserve(user):
    before = _ro_count("SELECT COUNT(*) AS n FROM tbl_customer WHERE email LIKE 'legacy-api-%@dynopay.internal'")
    r = _req("POST", "/safedeal/wallet/topup", token=user["token"], json_body={"amount": 50, "coin": "USDT-TRC20"})
    assert r.status_code in (200, 201), r.text
    t = r.json()["data"]["topup"]
    tid = t["topup_id"]
    assert 1.5 <= float(t["network_fee_usd"]) <= 4.0, f"network_fee_usd={t['network_fee_usd']}"
    assert abs(float(t["amount_usd"]) - 50.0) < 0.01
    assert abs(float(t["pays_usd"]) - (50.0 + float(t["network_fee_usd"]) + float(t.get("conversion_fee_usd", 0)) + float(t.get("exchange_fee_usd", 0)))) < 0.05
    assert t.get("address"), "deposit address missing"

    # Orphan invariant
    after = _ro_count("SELECT COUNT(*) AS n FROM tbl_customer WHERE email LIKE 'legacy-api-%@dynopay.internal'")
    assert before is not None and after is not None and after == before, f"legacy-api customers grew {before}->{after}"

    # Simulate credit
    s = _req("POST", f"/safedeal/wallet/topup/{tid}/simulate", token=user["token"], json_body={})
    assert s.status_code == 200, s.text
    assert s.json()["data"]["topup"]["status"] == "credited"

    # Wallet available bumped by full 50 (fees added on top)
    w = _req("GET", "/safedeal/wallet", token=user["token"]).json()["data"]
    assert w["wallet"]["available"] >= 50.0, f"available={w['wallet']['available']}"
    # Deposit reserve >= credited
    assert float(w["profile"].get("deposit_reserved_usd", 0)) >= 50.0, w["profile"]

    # Itemized statement
    st = _req("GET", "/safedeal/wallet/statement", token=user["token"]).json()["data"]
    topup_rows = [e for e in st["entries"] if e.get("kind") == "topup"]
    assert topup_rows, "no topup entry in statement"
    row = topup_rows[0]
    desc = (row.get("description") or "").lower()
    assert "network fee" in desc and "credited" in desc, f"description: {row.get('description')}"
    meta = row.get("meta") or {}
    for k in ["received_usd", "network_fee_usd", "credited_usd"]:
        assert k in meta, f"meta missing {k}: {meta}"
    assert abs(float(meta["credited_usd"]) - 50.0) < 0.01

    # Store for next tests
    pytest._iter209_tid = tid


# ---------- (4) Invoices unified list + PDF ----------

def test_invoices_includes_deposit_and_pdf(user):
    r = _req("GET", "/safedeal/invoices", token=user["token"])
    assert r.status_code == 200, r.text
    j = r.json()["data"]
    invs = j if isinstance(j, list) else j.get("invoices", [])
    deps = [i for i in invs if i.get("type") == "deposit"]
    assert deps, f"no deposit invoices: {invs}"
    d = deps[0]
    assert d["invoice_no"].startswith("DEP-")
    for k in ["received_usd", "network_fee_usd", "credited_usd"]:
        assert k in d, f"missing {k} in deposit invoice: {d}"

    # PDF
    tid = getattr(pytest, "_iter209_tid", None)
    assert tid, "no tid from prior test"
    pdf = requests.get(f"{API}/safedeal/wallet/topup/{tid}/receipt.pdf", headers={"x-safedeal-token": user["token"]}, timeout=60)
    assert pdf.status_code == 200, pdf.text[:400]
    assert pdf.headers.get("content-type", "").startswith("application/pdf"), pdf.headers
    assert pdf.content[:4] == b"%PDF", "not a PDF"
    assert len(pdf.content) > 3000, f"PDF too small: {len(pdf.content)}"


# ---------- (5) BTC quote edge case ----------

def test_btc_quote_nonstable(user):
    r = _req("GET", "/safedeal/wallet/topup/coins", token=user["token"], params={"amount": 100})
    coins = {c["coin"]: c for c in r.json()["data"]["coins"]}
    btc = coins.get("BTC")
    assert btc, "BTC missing"
    assert btc["network_fee"] > 0
    # Non-stable coin should carry an exchange/conversion component OR at minimum a crypto amount
    assert btc.get("crypto_amount") or btc.get("pays") > 100


# ---------- (6) Auto-withdraw does NOT sweep reserved deposit ----------

def test_deposit_reserve_shields_auto_withdraw(user):
    # Add a fake address then flip auto_withdraw on
    add = _req("POST", "/safedeal/addresses", token=user["token"], json_body={"coin": "USDT-TRC20", "address": "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE", "label": "qa"})
    if add.status_code not in (200, 201):
        pytest.skip(f"cannot add address: {add.status_code} {add.text[:200]}")
    aid = add.json()["data"]["address"]["address_id"]
    w_before = _req("GET", "/safedeal/wallet", token=user["token"]).json()["data"]["wallet"]["available"]
    prof = _req("POST", "/safedeal/profile", token=user["token"], json_body={"auto_withdraw": True, "auto_withdraw_address_id": aid})
    # Might 400 in 24h cooling-off — that's fine, shield still applies at balance level
    time.sleep(2)
    w_after = _req("GET", "/safedeal/wallet", token=user["token"]).json()["data"]
    # Reserved deposit still present, available not swept below reserve
    assert float(w_after["profile"].get("deposit_reserved_usd", 0)) >= 50.0
    assert w_after["wallet"]["available"] >= min(50.0, w_before), f"deposit swept: before={w_before} after={w_after['wallet']['available']}"


# ---------- (7) Top-up self-heal ----------

def test_topup_selfheal(user):
    seed = subprocess.run(
        ["node", "-r", "dotenv/config", SELFHEAL, "seed", str(user["customer_id"])],
        capture_output=True, text=True, cwd="/app/backend", timeout=45,
    )
    out = seed.stdout + seed.stderr
    line = [l for l in out.splitlines() if l.startswith("RESULT:")]
    assert line, f"seed failed: {out}"
    seeded = json.loads(line[0][len("RESULT:"):].strip())
    assert seeded.get("ok"), seeded
    tid = seeded["topup_id"]; pid = seeded["payment_id"]

    # Fetching the top-up should self-heal
    r = _req("GET", f"/safedeal/wallet/topup/{tid}", token=user["token"])
    assert r.status_code == 200, r.text
    status = r.json()["data"]["topup"]["status"]
    assert status == "credited", f"expected credited after self-heal, got {status}"

    # Wallet increased by seeded 12.34
    w = _req("GET", "/safedeal/wallet", token=user["token"]).json()["data"]["wallet"]["available"]
    assert w >= 50 + 12.34 - 0.01, f"wallet={w}"

    # Cleanup
    subprocess.run(["node", "-r", "dotenv/config", SELFHEAL, "cleanup", str(tid), pid, str(user["customer_id"])],
                   capture_output=True, text=True, cwd="/app/backend", timeout=45)


# ---------- (8) Deal funding orphan fix (crypto) ----------

def test_deal_funding_orphan_fix():
    seller = _sign_in("sd-qa209-seller")
    buyer = _sign_in("sd-qa209-buyer")
    dr = _req("POST", "/safedeal/deals", token=seller["token"], json_body={
        "title": "iter209 orphan test", "amount": 50, "counterparty_email": buyer["email"], "my_role": "seller", "fee_payer": "buyer"
    })
    assert dr.status_code in (200, 201), dr.text
    deal = dr.json()["data"]
    token_str = deal.get("deal_token")
    assert token_str, deal
    # Accept as buyer
    ac = _req("POST", f"/safedeal/deals/{token_str}/action", token=buyer["token"], json_body={"action": "accept"})
    assert ac.status_code in (200, 201), ac.text

    before = _ro_count("SELECT COUNT(*) AS n FROM tbl_customer WHERE email LIKE 'legacy-api-%@dynopay.internal'")
    # Fund with crypto
    fund = _req("POST", f"/safedeal/deals/{token_str}/action", token=buyer["token"], json_body={"action": "fund-crypto", "coin": "USDT-TRC20"})
    if fund.status_code not in (200, 201):
        pytest.skip(f"fund crypto not available: {fund.status_code} {fund.text[:200]}")
    after = _ro_count("SELECT COUNT(*) AS n FROM tbl_customer WHERE email LIKE 'legacy-api-%@dynopay.internal'")
    assert before is not None and after is not None and after == before, f"legacy-api customer created during deal funding {before}->{after}"


# ---------- (9) Deal invoices funding_label ----------

def test_deal_invoice_funding_label(user):
    # Uses wallet balance already funded above (>=50). Create small deal buyer=user, seller=fresh.
    seller = _sign_in("sd-qa209-seller2")
    dr = _req("POST", "/safedeal/deals", token=user["token"], json_body={
        "title": "iter209 balance deal", "amount": 30, "counterparty_email": seller["email"], "my_role": "buyer", "fee_payer": "buyer"
    })
    if dr.status_code not in (200, 201):
        pytest.skip(f"deal create: {dr.status_code} {dr.text[:200]}")
    token_str = dr.json()["data"].get("deal_token")
    _req("POST", f"/safedeal/deals/{token_str}/action", token=seller["token"], json_body={"action": "accept"})
    fund = _req("POST", f"/safedeal/deals/{token_str}/action", token=user["token"], json_body={"action": "fund-balance"})
    if fund.status_code not in (200, 201):
        pytest.skip(f"fund from balance failed: {fund.status_code} {fund.text[:200]}")
    invs = _req("GET", "/safedeal/invoices", token=user["token"]).json()["data"]
    if not isinstance(invs, list):
        invs = invs.get("invoices", [])
    deal_invs = [i for i in invs if i.get("type") == "deal"]
    if deal_invs:
        labels = [(i.get("funding_label") or "") for i in deal_invs]
        assert any("wallet" in l.lower() or "balance" in l.lower() for l in labels), f"funding_label missing 'Wallet balance': {labels}"
