"""
Regression tests for the Flutterwave inbound webhook signature guard.

Bug under test: flutterwaveWebHook() sent `res.status(401).end()` on a bad/missing
`verif-hash` header WITHOUT returning, so it kept processing the unsigned payload
and then double-wrote the response (ERR_HTTP_HEADERS_SENT).

SAFETY: only bad/missing-signature requests are sent (rejected with 401 before any
DB/Redis write). NEVER send a valid `verif-hash` — this pod points at the LIVE PROD DB.
"""
import os

import pytest
import requests

BASE_URL = os.environ.get(
    "PREVIEW_BASE_URL",
    "https://setup-vault-5.preview.emergentagent.com",
).rstrip("/")

# A realistic-looking payload; must NOT be processed because the signature is invalid.
PAYLOAD = {
    "id": 999999999,
    "txRef": "TEST_flw-txt-qa-invalid-sig",
    "status": "successful",
    "amount": 1,
    "currency": "USD",
    "event": "charge.completed",
}

WEBHOOK_PATHS = ["/api/webhook", "/api/failed_webhook"]


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _post(client, path, headers=None):
    return client.post(f"{BASE_URL}{path}", json=PAYLOAD, headers=headers or {}, timeout=30)


@pytest.mark.parametrize("path", WEBHOOK_PATHS)
def test_missing_verif_hash_returns_401(client, path):
    r = _post(client, path)
    assert r.status_code == 401, f"{path} expected 401, got {r.status_code}: {r.text[:300]}"
    # 401 + .end() => empty body, no leaked payload echo
    assert r.text.strip() == "", f"{path} unexpected body: {r.text[:300]}"


@pytest.mark.parametrize("path", WEBHOOK_PATHS)
def test_wrong_verif_hash_returns_401(client, path):
    r = _post(client, path, {"verif-hash": "WRONG-HASH"})
    assert r.status_code == 401, f"{path} expected 401, got {r.status_code}: {r.text[:300]}"
    assert r.text.strip() == ""


@pytest.mark.parametrize("path", WEBHOOK_PATHS)
def test_malformed_body_with_bad_hash_still_401_not_500(client, path):
    """Guard must fire before payload parsing (payload.txRef would throw -> 500/401 in catch)."""
    r = client.post(
        f"{BASE_URL}{path}",
        data="not-json-at-all",
        headers={"Content-Type": "text/plain", "verif-hash": "WRONG-HASH"},
        timeout=30,
    )
    assert r.status_code == 401, f"{path} expected 401, got {r.status_code}: {r.text[:300]}"


@pytest.mark.parametrize("path", WEBHOOK_PATHS)
def test_array_verif_hash_header_rejected(client, path):
    r = _post(client, path, {"verif-hash": ""})
    assert r.status_code == 401


def test_repeated_bad_requests_do_not_break_server(client):
    """Fire several rejected requests, then confirm the server is still serving."""
    codes = []
    for _ in range(5):
        codes.append(_post(client, "/api/webhook", {"verif-hash": "WRONG-HASH"}).status_code)
    # 401 expected; 429 acceptable if the webhook rate limiter kicks in
    assert all(c in (401, 429) for c in codes), f"unexpected codes: {codes}"


def test_health_still_healthy_after_bad_webhooks(client):
    # NOTE: /health is mounted on the express app root (not under /api), so it is only
    # reachable internally; the public host routes non-/api paths to the Next frontend.
    r = client.get("http://localhost:8001/health", timeout=30)
    assert r.status_code == 200, f"health failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    assert body.get("status") in ("healthy", "degraded"), body
    assert body.get("database") == "connected", body
