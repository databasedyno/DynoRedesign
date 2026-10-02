"""Backend tests for email system overhaul (Phase 1+2) - iteration 251.

Covers:
- Brevo webhook (POST /api/webhooks/brevo)
- Admin email-log endpoints
- Notification preferences (trimmed contract)
"""
import os
import json
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("SERVER_URL") or os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # read from backend/.env directly
    with open("/app/backend/.env") as f:
        for line in f:
            if line.startswith("SERVER_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
HEADERS = {"User-Agent": UA, "Content-Type": "application/json"}

QA_TOKEN = open("/app/memory/tmp/qa221_token.txt").read().strip()
ADMIN_TOKEN = open("/app/memory/tmp/admin_token.txt").read().strip()

# Compute Brevo webhook token
def _brevo_token():
    out = subprocess.check_output(
        ["node", "-e",
         "require('dotenv').config();console.log(require('crypto').createHmac('sha256',process.env.BREVO_API_KEY).update('dynopay-brevo-webhook').digest('hex').slice(0,48))"],
        cwd="/app/backend"
    ).decode().strip()
    return out

BREVO_TOKEN = _brevo_token()
QA_EMAIL = "qa-bounce-test@example.com"


# ---------------- Brevo Webhook ----------------
class TestBrevoWebhook:
    def test_wrong_token_401(self):
        r = requests.post(f"{BASE_URL}/api/webhooks/brevo?token=WRONG",
                          headers=HEADERS,
                          data=json.dumps({"event": "hard_bounce", "email": QA_EMAIL}))
        assert r.status_code == 401, r.text
        body = r.json()
        assert body.get("error") == "unauthorized"

    def test_hard_bounce_processed(self):
        payload = {
            "event": "hard_bounce",
            "email": QA_EMAIL,
            "message-id": "<qa-none@smtp-relay.mailin.fr>",
            "reason": "mailbox unavailable",
            "ts_event": 1700000000,
        }
        r = requests.post(f"{BASE_URL}/api/webhooks/brevo?token={BREVO_TOKEN}",
                          headers=HEADERS, data=json.dumps(payload))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "suppressed" in body.get("processed", [])

    def test_redis_key_set_after_hard_bounce(self):
        try:
            out = subprocess.check_output(
                ["node", "scripts/read_redis_key.cjs", f"email:suppressed:{QA_EMAIL}"],
                cwd="/app/backend", stderr=subprocess.STDOUT, timeout=15
            ).decode().strip()
            # Should contain some JSON (non-empty, non-null)
            assert out and out.lower() not in ("null", "nil", ""), f"Expected redis key to be set, got: {out!r}"
            print(f"Redis key after hard_bounce: {out[:120]}")
        except subprocess.CalledProcessError as e:
            pytest.fail(f"read_redis_key failed: {e.output.decode()}")

    def test_array_body_soft_then_delivered(self):
        payload = [
            {"event": "soft_bounce", "email": QA_EMAIL, "message-id": "<qa-soft@smtp-relay.mailin.fr>",
             "reason": "temporarily rejected", "ts_event": 1700000100},
            {"event": "delivered", "email": QA_EMAIL, "message-id": "<qa-del@smtp-relay.mailin.fr>",
             "ts_event": 1700000200},
        ]
        r = requests.post(f"{BASE_URL}/api/webhooks/brevo?token={BREVO_TOKEN}",
                          headers=HEADERS, data=json.dumps(payload))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        processed = body.get("processed", [])
        assert "recorded" in processed, f"processed={processed}"
        assert "delivered" in processed, f"processed={processed}"

    def test_redis_key_cleared_after_delivered(self):
        try:
            out = subprocess.check_output(
                ["node", "scripts/read_redis_key.cjs", f"email:suppressed:{QA_EMAIL}"],
                cwd="/app/backend", stderr=subprocess.STDOUT, timeout=15
            ).decode().strip()
            # Should be null/empty
            assert out.lower() in ("null", "nil", "", "undefined"), f"Expected redis key cleared, got: {out!r}"
        except subprocess.CalledProcessError as e:
            pytest.fail(f"read_redis_key failed: {e.output.decode()}")


# ---------------- Admin email-log endpoints ----------------
class TestAdminEmailLog:
    def _auth(self):
        return {**HEADERS, "Authorization": f"Bearer {ADMIN_TOKEN}"}

    def test_stats_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/email-log/stats", headers=HEADERS)
        assert r.status_code in (401, 403), r.status_code

    def test_stats_ok(self):
        r = requests.get(f"{BASE_URL}/api/admin/email-log/stats", headers=self._auth())
        assert r.status_code == 200, r.text
        data = r.json().get("data") or r.json()
        assert "last24h" in data
        assert "bounced_users" in data
        q = data["queue"]
        for k in ("waiting", "active", "delayed", "failed", "completed", "dlq", "worker_running"):
            assert k in q, f"missing queue key {k}: {q}"
        assert q["worker_running"] is False, f"worker_running expected False on preview: {q}"

    def test_list_ok(self):
        r = requests.get(f"{BASE_URL}/api/admin/email-log?email=qa-bounce&limit=5", headers=self._auth())
        assert r.status_code == 200, r.text
        data = r.json().get("data") or r.json()
        assert isinstance(data.get("rows"), list)

    def test_dlq_ok(self):
        r = requests.get(f"{BASE_URL}/api/admin/email-log/dlq", headers=self._auth())
        assert r.status_code == 200, r.text
        data = r.json().get("data") or r.json()
        assert isinstance(data.get("items"), list)

    def test_bounces_clear_ok(self):
        r = requests.post(f"{BASE_URL}/api/admin/email-log/bounces/clear",
                          headers=self._auth(),
                          data=json.dumps({"email": QA_EMAIL}))
        assert r.status_code == 200, r.text
        data = r.json().get("data") or r.json()
        assert "users_updated" in data

    def test_dlq_retry_nonexistent_404(self):
        r = requests.post(f"{BASE_URL}/api/admin/email-log/dlq/does-not-exist/retry", headers=self._auth())
        assert r.status_code == 404, r.text

    def test_list_no_auth_rejected(self):
        r = requests.get(f"{BASE_URL}/api/admin/email-log", headers=HEADERS)
        assert r.status_code in (401, 403)

    def test_dlq_no_auth_rejected(self):
        r = requests.get(f"{BASE_URL}/api/admin/email-log/dlq", headers=HEADERS)
        assert r.status_code in (401, 403)


# ---------------- Notification preferences ----------------
class TestNotificationPreferences:
    def _auth(self):
        return {**HEADERS, "Authorization": f"Bearer {QA_TOKEN}"}

    REMOVED = {"transaction_updates", "payment_received", "email_notifications",
               "sms_notifications", "security_alerts"}
    EXPECTED = {"weekly_summary", "payout_digest_weekly", "notify_new_device_only", "marketing_emails"}

    def test_get_preferences_contract(self):
        r = requests.get(f"{BASE_URL}/api/notifications/preferences", headers=self._auth())
        assert r.status_code == 200, r.text
        data = r.json().get("data") or r.json()
        keys = set(data.keys())
        print(f"GET prefs keys: {keys}")
        for k in self.EXPECTED:
            assert k in keys, f"missing expected key {k}; got {keys}"
        for k in self.REMOVED:
            assert k not in keys, f"removed key {k} still present: {keys}"

    def test_put_preferences_toggle_round_trip(self):
        # set notify_new_device_only=true
        r = requests.put(f"{BASE_URL}/api/notifications/preferences",
                         headers=self._auth(),
                         data=json.dumps({"notify_new_device_only": True, "weekly_summary": True}))
        assert r.status_code == 200, r.text
        data = r.json().get("data") or r.json()
        assert data.get("notify_new_device_only") is True

        # verify via GET
        r2 = requests.get(f"{BASE_URL}/api/notifications/preferences", headers=self._auth())
        d2 = r2.json().get("data") or r2.json()
        assert d2.get("notify_new_device_only") is True

        # revert to false
        r3 = requests.put(f"{BASE_URL}/api/notifications/preferences",
                          headers=self._auth(),
                          data=json.dumps({"notify_new_device_only": False}))
        assert r3.status_code == 200, r3.text
        d3 = r3.json().get("data") or r3.json()
        assert d3.get("notify_new_device_only") is False
