"""Regression test for team invite/accept flow after teamNotifications extraction refactor."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("TEAM_TEST_BASE_URL", "http://localhost:8001")
OWNER_EMAIL = os.environ.get("TEAM_TEST_OWNER_EMAIL", "")
OWNER_PASSWORD = os.environ.get("TEAM_TEST_OWNER_PASSWORD", "")
COMPANY_ID = int(os.environ.get("TEAM_TEST_COMPANY_ID", "1"))

pytestmark = pytest.mark.skipif(
    not (OWNER_EMAIL and OWNER_PASSWORD),
    reason="Set TEAM_TEST_OWNER_EMAIL / TEAM_TEST_OWNER_PASSWORD (and TEAM_TEST_BASE_URL) to run this live regression test.",
)


@pytest.fixture(scope="module")
def owner_token():
    r = requests.post(f"{BASE_URL}/api/user/login",
                      json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json().get("data") or {}
    tok = data.get("accessToken") or data.get("access_token") or r.json().get("accessToken")
    assert tok, f"No accessToken in {r.json()}"
    return tok


@pytest.fixture(scope="module")
def state():
    return {}


def test_1_owner_login(owner_token):
    assert isinstance(owner_token, str) and len(owner_token) > 20


def test_2_invite(owner_token, state):
    ts = int(time.time())
    invite_email = f"onarrival21+regr{ts}@gmail.com"
    state["invite_email"] = invite_email
    r = requests.post(
        f"{BASE_URL}/api/team/invite",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"email": invite_email, "role": "member", "company_id": COMPANY_ID},
        timeout=30,
    )
    assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
    body = r.json()
    data = body.get("data") or body
    link = data.get("invite_link") or body.get("invite_link")
    assert link and "/auth/accept-invite?token=" in link, f"Bad invite link: {body}"
    token = link.split("token=")[1].split("&")[0]
    state["invite_token"] = token
    print(f"invite_email={invite_email} token_prefix={token[:12]}")


def test_3_invite_info(state):
    tok = state["invite_token"]
    r = requests.get(f"{BASE_URL}/api/team/invite/{tok}", timeout=30)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    body = r.json()
    data = body.get("data") or body
    assert data.get("email") == state["invite_email"]
    assert "email_has_account" in data


def test_4_accept_and_notification(owner_token, state):
    tok = state["invite_token"]
    r = requests.post(
        f"{BASE_URL}/api/team/accept",
        json={"token": tok, "name": "Regr Tester", "password": "StrongPass123!"},
        timeout=30,
    )
    assert r.status_code in (200, 201), f"accept failed: {r.status_code} {r.text}"
    body = r.json()
    msg = (body.get("message") or "").lower()
    data = body.get("data") or {}
    assert data.get("team_member") is True or "welcome" in msg or "ready" in msg, body
    state["accept_body"] = body

    # tiny wait for async best-effort notification
    time.sleep(1.5)

    r = requests.get(
        f"{BASE_URL}/api/notifications/?limit=10",
        headers={"Authorization": f"Bearer {owner_token}"},
        timeout=30,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    body = r.json()
    data = body.get("data") or body
    notifs = data if isinstance(data, list) else (data.get("notifications") or [])
    match = [n for n in notifs
             if n.get("type") == "team_member_joined"
             and "accepted your invite and joined" in (n.get("message") or "")]
    assert match, f"team_member_joined notification not found in latest 10: {[(n.get('type'), n.get('message')) for n in notifs][:10]}"
    print(f"Found notification: {match[0].get('message')}")


def test_5_team_accept_activity(owner_token):
    r = requests.get(
        f"{BASE_URL}/api/team/activity?company_id={COMPANY_ID}&limit=10",
        headers={"Authorization": f"Bearer {owner_token}"},
        timeout=30,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    body = r.json()
    data = body.get("data") or body
    rows = data if isinstance(data, list) else (data.get("activities") or data.get("rows") or [])
    match = [r for r in rows
             if r.get("action") == "team.accept"
             and (r.get("description") or "") == "Joined the team"]
    assert match, f"team.accept row not found: {[(r.get('action'), r.get('description')) for r in rows][:10]}"
    print(f"Found team.accept activity: actor={match[0].get('actor_email')}")


def test_6_cleanup(owner_token):
    r = requests.get(
        f"{BASE_URL}/api/team/members?company_id={COMPANY_ID}",
        headers={"Authorization": f"Bearer {owner_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    data = body.get("data") or body
    members = data if isinstance(data, list) else (data.get("members") or data.get("rows") or [])
    to_delete = [m for m in members
                 if (m.get("email") or "").startswith("onarrival21+regr")
                 and m.get("status") != "revoked"]
    print(f"Cleaning up {len(to_delete)} members")
    for m in to_delete:
        mid = m.get("id") or m.get("member_id") or m.get("team_member_id")
        d = requests.delete(
            f"{BASE_URL}/api/team/members/{mid}",
            headers={"Authorization": f"Bearer {owner_token}"},
            timeout=30,
        )
        assert d.status_code in (200, 204), f"delete {mid} -> {d.status_code} {d.text}"

    # verify
    r2 = requests.get(
        f"{BASE_URL}/api/team/members?company_id={COMPANY_ID}",
        headers={"Authorization": f"Bearer {owner_token}"},
        timeout=30,
    )
    body2 = r2.json()
    data2 = body2.get("data") or body2
    members2 = data2 if isinstance(data2, list) else (data2.get("members") or data2.get("rows") or [])
    remaining = [m for m in members2
                 if (m.get("email") or "").startswith("onarrival21+regr")
                 and m.get("status") != "revoked"]
    assert not remaining, f"Leftover: {remaining}"
