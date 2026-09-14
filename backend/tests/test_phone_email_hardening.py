"""Backend regression tests for phone hardening, security emails, and hero icons.

Iteration: phone E.164 normalisation, duplicate-account UX, branded security emails.
SAFE MODE: only invalid phones for SMS-triggering endpoints, password reset uses SAME password.
"""
import os
import re
import time
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cred-manager-29.preview.emergentagent.com").rstrip("/")
MERCHANT_EMAIL = "onarrival21@gmail.com"
MERCHANT_PASSWORD = "Katiekendra123@"


@pytest.fixture(scope="module")
def sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Phone type-check (read-only, safe with valid numbers) ----------
class TestPhoneTypeCheck:
    def test_bd_number_with_trunk_zero(self, sess):
        r = sess.post(f"{BASE_URL}/api/user/phone-type-check", json={"mobile": "+880 01712-345678"})
        assert r.status_code == 200, r.text
        d = r.json()["data"]
        assert d["normalized"] == "8801712345678"
        assert d["country_code"] == "BD"
        assert d["phone_type"] == "mobile"
        assert d["is_mobile"] is True

    def test_invalid_short_number(self, sess):
        r = sess.post(f"{BASE_URL}/api/user/phone-type-check", json={"mobile": "12345"})
        assert r.status_code == 400
        assert "valid mobile number" in r.text.lower()

    def test_us_number_normalisation(self, sess):
        r = sess.post(f"{BASE_URL}/api/user/phone-type-check", json={"mobile": "+1 (302) 514-1000"})
        assert r.status_code == 200, r.text
        d = r.json()["data"]
        assert d["normalized"] == "13025141000"
        assert d["country_code"] == "US"


# ---------- registerPhone (INVALID ONLY — never trigger SMS) ----------
class TestRegisterPhoneInvalid:
    def test_register_phone_long_invalid(self, sess):
        r = sess.post(f"{BASE_URL}/api/user/registerPhone", json={"mobile": "999999999999"})
        assert r.status_code == 400
        assert "valid mobile number" in r.text.lower()

    def test_register_phone_short_invalid(self, sess):
        r = sess.post(f"{BASE_URL}/api/user/registerPhone", json={"mobile": "12345"})
        assert r.status_code == 400
        assert "valid mobile number" in r.text.lower()

    def test_register_phone_missing(self, sess):
        r = sess.post(f"{BASE_URL}/api/user/registerPhone", json={})
        assert r.status_code == 400
        assert "mobile number is required" in r.text.lower()

    def test_register_phone_verify_invalid(self, sess):
        r = sess.post(f"{BASE_URL}/api/user/registerPhone/verify", json={"mobile": "12345", "otp": "000000"})
        assert r.status_code == 400
        assert "valid mobile number" in r.text.lower()


# ---------- Duplicate-account messaging via email (safe) ----------
class TestDuplicateAccountEmail:
    def test_register_email_duplicate(self, sess):
        r = sess.post(f"{BASE_URL}/api/user/registerEmail", json={"email": MERCHANT_EMAIL})
        assert r.status_code == 200, r.text
        assert r.json()["data"]["account_exists"] is True

    def test_suppressed_otp_email_logged(self):
        time.sleep(1)
        out = subprocess.run(
            ["bash", "-lc", "grep -a 'SUPPRESSED' /var/log/supervisor/backend.out.log | tail -20"],
            capture_output=True, text=True,
        ).stdout
        assert "OTP for login" in out, f"Expected OTP for login in suppressed log; got:\n{out}"


# ---------- Hero icon assets ----------
class TestHeroIcons:
    @pytest.mark.parametrize("name", ["shield-green", "shield-red", "phone", "block", "person-off"])
    def test_hero_png(self, sess, name):
        r = sess.get(f"{BASE_URL}/api/static/email/hero/{name}.png")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/png")
        assert len(r.content) > 100


# ---------- Password-reset with branded template (idempotent: same password) ----------
class TestPasswordResetBrandedEmail:
    def test_full_flow_and_branded_email(self, sess):
        # 1) request OTP
        r = sess.post(f"{BASE_URL}/api/user/forgot-password", json={"email": MERCHANT_EMAIL})
        assert r.status_code == 200, r.text

        # 2) read OTP from redis
        out = subprocess.run(
            ["bash", "-lc", f"cd /app && node backend/scripts/read_otp.cjs {MERCHANT_EMAIL}"],
            capture_output=True, text=True,
        )
        m = re.search(r"\b(\d{4,8})\b", out.stdout)
        assert m, f"OTP not found. stdout={out.stdout!r} stderr={out.stderr!r}"
        otp = m.group(1)

        # 3) verify OTP -> resetToken
        r = sess.post(f"{BASE_URL}/api/user/forgot-password/verify-otp",
                      json={"email": MERCHANT_EMAIL, "otp": otp})
        assert r.status_code == 200, r.text
        token = r.json()["data"]["resetToken"]

        # snapshot email outbox size before reset
        before = subprocess.run(["bash", "-lc", "ls -1 /app/memory/email_outbox/ 2>/dev/null | wc -l"],
                                capture_output=True, text=True).stdout.strip()

        # 4) reset to SAME password (idempotent, SAFE)
        r = sess.post(f"{BASE_URL}/api/user/reset-password",
                      json={"token": token, "email": MERCHANT_EMAIL, "newPassword": MERCHANT_PASSWORD})
        assert r.status_code == 200, r.text
        time.sleep(2)

        # 5a) suppressed log line for new subject
        log = subprocess.run(
            ["bash", "-lc", "grep -a 'SUPPRESSED' /var/log/supervisor/backend.out.log | tail -30"],
            capture_output=True, text=True,
        ).stdout
        assert "Password updated successfully" in log, f"branded subject not found. log tail:\n{log}"
        assert "Password Changed Successfully - Dynopay" not in log.split("Password updated successfully")[-1], \
            "old subject line still present after branded one"

        # 5b) new HTML file appeared with hero/lock.png + View Account Settings CTA
        after = subprocess.run(["bash", "-lc", "ls -1t /app/memory/email_outbox/*.html 2>/dev/null | head -5"],
                               capture_output=True, text=True).stdout.strip().splitlines()
        assert after, "no HTML dumps found"
        # Check the most recent files for the branded markers
        found_hero = False
        for f in after:
            content = subprocess.run(["bash", "-lc", f"cat '{f}'"], capture_output=True, text=True).stdout
            if "/api/static/email/hero/lock.png" in content and "View Account Settings" in content:
                found_hero = True
                break
        assert found_hero, f"Branded lock.png hero + CTA not found in latest outbox dumps. Latest files: {after[:3]}"

        # 5c) login still works with same password
        r = sess.post(f"{BASE_URL}/api/user/login",
                      json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD})
        assert r.status_code == 200, r.text
        assert r.json()["data"].get("accessToken"), "no accessToken returned"


# ---------- Email builder render + typecheck + file-size ----------
class TestBackendBuildChecks:
    def test_verify_security_emails_render(self):
        r = subprocess.run(
            ["bash", "-lc",
             "cd /app/backend && DISABLE_OUTBOUND_EMAIL=true EMAIL_DUMP_DIR=/tmp/email_render_check "
             "npx ts-node --transpile-only scripts/verify_security_emails_render.ts"],
            capture_output=True, text=True, timeout=180,
        )
        assert r.returncode == 0, f"stdout:\n{r.stdout}\nstderr:\n{r.stderr}"
        assert re.search(r"29 emails rendered, 0 problems", r.stdout), r.stdout

    def test_typecheck(self):
        r = subprocess.run(
            ["bash", "-lc", "cd /app/backend && npx tsc --noEmit -p tsconfig.json"],
            capture_output=True, text=True, timeout=240,
        )
        assert r.returncode == 0, f"stdout:\n{r.stdout}\nstderr:\n{r.stderr}"

    def test_file_size(self):
        r = subprocess.run(
            ["bash", "-lc", "cd /app/backend && node scripts/check-file-size.mjs"],
            capture_output=True, text=True, timeout=60,
        )
        assert r.returncode == 0, r.stdout + r.stderr
        assert "[file-size] OK" in r.stdout


# ---------- Locale catalog integrity ----------
class TestLocaleCatalogs:
    LOCALES = ["en", "de", "es", "fr", "nl", "pt"]
    REQUIRED_KEYS = [
        ("security", "twoFaEnabled", "subject"),
        ("security", "accountSuspended", "subject"),
        ("security", "phoneChanged", "subject"),
        ("paymentRequest", "cta"),
    ]

    @pytest.mark.parametrize("loc", LOCALES)
    def test_locale_keys(self, loc):
        import json
        path = f"/app/backend/locales/{loc}/emails.json"
        with open(path) as f:
            data = json.load(f)
        for keys in self.REQUIRED_KEYS:
            cur = data
            for k in keys:
                assert isinstance(cur, dict) and k in cur, f"{loc}: missing key path {'.'.join(keys)}"
                cur = cur[k]
            assert isinstance(cur, str) and cur.strip(), f"{loc}: empty value at {'.'.join(keys)}"
