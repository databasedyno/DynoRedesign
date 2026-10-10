"""
Iteration 250 — Onboarding emails & 2FA email-code enrolment regression.
Scenarios G, I, J. (H is a long render script run separately.)
"""
import os
import re
import time
import subprocess
import pytest
import requests

BASE_URL = os.environ["SERVER_URL"] if os.environ.get("SERVER_URL") else "https://vault-setup-21.preview.emergentagent.com"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
QA_EMAIL = "qa_minorder_p1b@example.com"
QA_PWD = "QaMinOrder123@"
LOG_PATH = "/var/log/supervisor/backend.out.log"


def _h(token=None):
    h = {"User-Agent": UA, "Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


@pytest.fixture(scope="module")
def qa_token():
    r = requests.post(f"{BASE_URL}/api/user/login",
                      json={"email": QA_EMAIL, "password": QA_PWD},
                      headers=_h(), timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    j = r.json()
    data = j.get("data", j)
    challenge = data.get("challenge_token") or data.get("challengeToken")
    otp = data.get("preview_otp") or data.get("previewOtp")
    assert challenge and otp, f"login JSON missing challenge/preview_otp: {j}"
    r2 = requests.post(f"{BASE_URL}/api/user/2fa/validate",
                       json={"challenge_token": challenge, "token": otp},
                       headers=_h(), timeout=30)
    assert r2.status_code == 200, f"2fa validate failed: {r2.status_code} {r2.text[:300]}"
    j2 = r2.json()
    data2 = j2.get("data", j2)
    tok = data2.get("accessToken") or data2.get("access_token") or data2.get("token")
    assert tok, f"no access token in 2fa response: {j2}"
    return tok


def _log_tail_since(start_ts: float, pattern: str = None, wait: float = 2.0) -> str:
    """Return log lines appended since start_ts (approx — just last N lines filtered)."""
    time.sleep(wait)
    try:
        with open(LOG_PATH, "r") as f:
            # Read last 400KB
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - 400_000))
            content = f.read()
    except Exception as e:
        return f"<<log read failed: {e}>>"
    # Keep only the trailing region after our marker if present
    return content


# -------- G: First-time brand save suppresses 'changed' email --------
class TestBrandWelcomeFirstSave:
    def test_g_firsttime_schedules_welcome_no_changed_email(self, qa_token):
        # Precondition: set country=NULL on company 231
        subprocess.run(
            ["node", "scripts/_pgq.js", "UPDATE tbl_company SET country=NULL WHERE company_id=231"],
            cwd="/app/backend", check=True, capture_output=True, text=True
        )
        marker = f"MARKER_G_{int(time.time())}"
        # Open log for tailing — record size
        with open(LOG_PATH, "rb") as f:
            f.seek(0, 2)
            start_size = f.tell()

        r = requests.put(
            f"{BASE_URL}/api/company/updateCompany/231",
            json={"data": {"company_name": "QA MinOrder", "country": "US"}},
            headers=_h(qa_token), timeout=30
        )
        assert r.status_code == 200, f"update failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        msg = (body.get("message") or body.get("data") or "") if isinstance(body, dict) else ""
        assert "Brand updated successfully" in str(body), f"unexpected body: {body}"

        # Wait and read new log lines
        time.sleep(3)
        with open(LOG_PATH, "rb") as f:
            f.seek(start_size)
            new_log = f.read().decode("utf-8", errors="replace")

        assert "[BrandWelcome] preview timer set" in new_log and "for company 231" in new_log, \
            f"Expected BrandWelcome preview timer log for company 231. Log excerpt:\n{new_log[-3000:]}"
        # Must NOT contain the 'changed' email for this request
        assert "Your brand details were changed" not in new_log or "SUPPRESSED" in new_log, \
            f"'changed' email appears to have been sent on first-time save. Log:\n{new_log[-3000:]}"
        # Also no "Company profile updated email sent to qa_minorder" for this update window
        assert f"Company profile updated email sent to {QA_EMAIL}" not in new_log, \
            f"Updated email was sent on first-time save (should be suppressed). Log:\n{new_log[-3000:]}"

    def test_g_regular_edit_sends_changed_email(self, qa_token):
        with open(LOG_PATH, "rb") as f:
            f.seek(0, 2)
            start_size = f.tell()
        r = requests.put(
            f"{BASE_URL}/api/company/updateCompany/231",
            json={"data": {"website": "https://qa-minorder.example.com"}},
            headers=_h(qa_token), timeout=30
        )
        assert r.status_code == 200, f"update failed: {r.status_code} {r.text[:300]}"
        time.sleep(3)
        with open(LOG_PATH, "rb") as f:
            f.seek(start_size)
            new_log = f.read().decode("utf-8", errors="replace")
        assert "SUPPRESSED" in new_log and "Your brand details were changed" in new_log, \
            f"Expected SUPPRESSED 'brand details were changed' log for regular edit. Log:\n{new_log[-3000:]}"

    def test_g_restore_website(self, qa_token):
        r = requests.put(
            f"{BASE_URL}/api/company/updateCompany/231",
            json={"data": {"website": ""}},
            headers=_h(qa_token), timeout=30
        )
        assert r.status_code == 200
        res = subprocess.run(
            ["node", "scripts/ro_query.js", "select country, website from tbl_company where company_id=231"],
            cwd="/app/backend", check=True, capture_output=True, text=True
        )
        out = res.stdout
        assert "US" in out, f"country should be US. ro_query output: {out}"
        # website should be empty / null
        assert "qa-minorder.example.com" not in out, f"website should be empty. ro_query output: {out}"


# -------- I: 2FA email-code enrolment sends new email --------
class TestEmailCodes2FA:
    def test_i_email_codes_enabled_email(self, qa_token):
        with open(LOG_PATH, "rb") as f:
            f.seek(0, 2)
            start_size = f.tell()
        r1 = requests.post(f"{BASE_URL}/api/user/2fa/email/start",
                           json={}, headers=_h(qa_token), timeout=30)
        assert r1.status_code == 200, f"email/start failed: {r1.status_code} {r1.text[:300]}"
        j1 = r1.json()
        d1 = j1.get("data", j1)
        otp = d1.get("preview_otp") or d1.get("previewOtp")
        assert otp, f"missing preview_otp in email/start: {j1}"
        r2 = requests.post(f"{BASE_URL}/api/user/2fa/email/verify",
                           json={"code": otp}, headers=_h(qa_token), timeout=30)
        assert r2.status_code == 200, f"email/verify failed: {r2.status_code} {r2.text[:300]}"
        j2 = r2.json()
        d2 = j2.get("data", j2)
        assert d2.get("method") == "email", f"method should be email: {j2}"
        assert d2.get("backup_codes") or d2.get("backupCodes"), f"backup_codes missing: {j2}"
        time.sleep(3)
        with open(LOG_PATH, "rb") as f:
            f.seek(start_size)
            new_log = f.read().decode("utf-8", errors="replace")
        assert "Email codes are now your sign-in second step" in new_log, \
            f"Expected new subject line in log. Log:\n{new_log[-3000:]}"
        assert "2FA is on for your account" not in new_log, \
            f"Old subject should NOT appear. Log:\n{new_log[-3000:]}"


# -------- J: Regression --------
class TestRegression:
    def test_j_enforcement_endpoint(self, qa_token):
        r = requests.get(f"{BASE_URL}/api/user/2fa/enforcement",
                         headers=_h(qa_token), timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        j = r.json()
        d = j.get("data", j)
        assert d.get("enrolled") is True, f"enrolled should be true: {j}"
        assert d.get("method") == "email", f"method should be email: {j}"

    def test_j_update_company_without_token(self):
        r = requests.put(
            f"{BASE_URL}/api/company/updateCompany/231",
            json={"data": {"website": ""}},
            headers={"User-Agent": UA, "Content-Type": "application/json"},
            timeout=30,
        )
        assert r.status_code in (401, 403), f"should reject unauthenticated: {r.status_code} {r.text[:200]}"
