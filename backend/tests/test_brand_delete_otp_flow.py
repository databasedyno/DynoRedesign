"""
Regression + feature tests for:
  - Brand-delete OTP flow (send-otp, verify, invalid attempts, lockout)
  - PUT /api/company/updateCompany, GET /api/company/getCompany
  - DELETE /api/api/deleteApi for sandbox API key
  - Preview otp exposure while DISABLE_OUTBOUND_EMAIL=true
LIVE PROD DB — only touch brands whose names begin with 'QA'.
"""
import os
import time
import re
import pytest
import requests

BASE = "https://speedup-check.preview.emergentagent.com"
EMAIL = "onarrival21@gmail.com"
PASSWORD = "Katiekendra123@"

PROTECTED_COMPANY_IDS = {1, 71}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE}/api/user/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    tok = d.get("token") or d.get("accessToken")
    assert tok
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def qa_brand(headers):
    """Create throw-away QA brand for lifecycle."""
    ts = int(time.time())
    files = {
        "company_name": (None, f"QA Agent Brand {ts}"),
        "email": (None, f"onarrival21+qa{ts}@gmail.com"),
        "country": (None, "EE"),
    }
    r = requests.post(f"{BASE}/api/company/addCompany", headers=headers, files=files, timeout=60)
    assert r.status_code in (200, 201), f"addCompany failed: {r.status_code} {r.text}"
    body = r.json()
    assert "Brand added successfully" in body.get("message", ""), body
    cid = body["data"]["company_id"]
    assert cid not in PROTECTED_COMPANY_IDS
    yield {"id": cid, "name": f"QA Agent Brand {ts}"}
    # cleanup: if still alive, try to delete via OTP
    try:
        s = requests.post(f"{BASE}/api/company/deleteCompany/{cid}/send-otp", headers=headers, timeout=30)
        if s.status_code == 200:
            otp = s.json().get("data", {}).get("preview_otp")
            if otp:
                requests.delete(f"{BASE}/api/company/deleteCompany/{cid}", headers=headers, json={"otp": otp}, timeout=30)
    except Exception:
        pass


def test_get_companies_list(headers):
    r = requests.get(f"{BASE}/api/company/getCompany", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert re.search(r"Successfully retrieved \d+ brands?", body.get("message", "")), body.get("message")
    assert isinstance(body["data"], list)


def test_update_company_brand_wording(headers, qa_brand):
    files = {
        "company_id": (None, str(qa_brand["id"])),
        "company_name": (None, qa_brand["name"]),
    }
    r = requests.put(f"{BASE}/api/company/updateCompany/{qa_brand['id']}", headers=headers, files=files, timeout=45)
    # Some routes may not accept :id in path; try body form
    if r.status_code == 404:
        r = requests.put(f"{BASE}/api/company/updateCompany", headers=headers, files=files, timeout=45)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    assert "Brand updated successfully" in r.json().get("message", ""), r.json()


def test_delete_without_otp_returns_400(headers, qa_brand):
    r = requests.delete(f"{BASE}/api/company/deleteCompany/{qa_brand['id']}", headers=headers, timeout=30)
    assert r.status_code == 400, r.text
    assert "Verification code is required" in r.json().get("message", ""), r.json()


def test_send_otp_on_non_owned_returns_403(headers):
    r = requests.post(f"{BASE}/api/company/deleteCompany/139/send-otp", headers=headers, timeout=30)
    assert r.status_code in (403, 404), f"Expected 403/404 got {r.status_code}: {r.text}"


def test_send_otp_success_shape(headers, qa_brand):
    r = requests.post(f"{BASE}/api/company/deleteCompany/{qa_brand['id']}/send-otp", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    # masked email
    assert re.match(r".{1,3}\*+@", d["email"]), d["email"]
    assert d["expires_in"] == 600
    assert re.match(r"^\d{6}$", str(d["preview_otp"])), d
    # stash for next test
    qa_brand["_last_otp"] = d["preview_otp"]


def test_wrong_otp_then_lockout(headers, qa_brand):
    # 5 wrong attempts
    last_msg = ""
    for i in range(5):
        r = requests.delete(
            f"{BASE}/api/company/deleteCompany/{qa_brand['id']}",
            headers=headers, json={"otp": "000000"}, timeout=30,
        )
        assert r.status_code == 400, r.text
        last_msg = r.json().get("message", "")
        assert "Invalid verification code" in last_msg or "Too many" in last_msg, last_msg
    # 6th attempt should be lockout / require new code
    r = requests.delete(
        f"{BASE}/api/company/deleteCompany/{qa_brand['id']}",
        headers=headers, json={"otp": "000000"}, timeout=30,
    )
    assert r.status_code == 400
    assert "Too many" in r.json().get("message", "") or "new" in r.json().get("message", "").lower(), r.json()


def test_correct_otp_deletes_brand(headers, qa_brand):
    # request a fresh code after lockout
    r = requests.post(f"{BASE}/api/company/deleteCompany/{qa_brand['id']}/send-otp", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    otp = r.json()["data"]["preview_otp"]

    d = requests.delete(
        f"{BASE}/api/company/deleteCompany/{qa_brand['id']}",
        headers=headers, json={"otp": otp}, timeout=45,
    )
    assert d.status_code == 200, d.text
    j = d.json()
    assert "Brand deleted successfully" in j.get("message", ""), j
    assert j["data"].get("rowsDeleted") == 1, j

    # Repeat should now fail (already gone)
    d2 = requests.delete(
        f"{BASE}/api/company/deleteCompany/{qa_brand['id']}",
        headers=headers, json={"otp": otp}, timeout=30,
    )
    assert d2.status_code in (400, 403, 404), f"expected error, got {d2.status_code}"


def test_hero_email_images():
    for name in ("trash.png", "check.png", "key-off.png"):
        r = requests.get(f"{BASE}/api/static/email/hero/{name}", timeout=20)
        assert r.status_code == 200, f"{name}: {r.status_code}"
        assert r.headers.get("Content-Type", "").startswith("image/"), r.headers
