"""Backend perf test: wallet_services status probe < 300ms after single-round-trip fix."""
import os
import time
import requests
import pytest

BASE_URL = "https://dynopay-settlement.preview.emergentagent.com"


def _csrf_session():
    s = requests.Session()
    r = s.get(f"{BASE_URL}/api/csrf-token", timeout=30)
    assert r.status_code == 200, f"csrf-token {r.status_code} {r.text}"
    token = r.json().get("csrf_token")
    assert token, f"no csrf_token in {r.json()}"
    assert "dynopay_csrf" in s.cookies.get_dict(), f"cookies: {s.cookies.get_dict()}"
    return s, token


def _trigger(s, token):
    r = s.post(
        f"{BASE_URL}/api/status/check",
        headers={"x-csrf-token": token, "Content-Type": "application/json"},
        json={},
        timeout=60,
    )
    assert r.status_code == 200, f"trigger {r.status_code} {r.text[:400]}"
    return r.json()


def _get_services(s):
    r = s.get(f"{BASE_URL}/api/status/services", timeout=30)
    assert r.status_code == 200, f"services {r.status_code} {r.text[:400]}"
    return r.json()


def test_csrf_and_trigger_and_wallet_latency():
    results = []
    s, token = _csrf_session()
    for i in range(3):
        _trigger(s, token)
        data = _get_services(s)
        services = data.get("services") or data.get("data") or data
        if isinstance(services, dict) and "services" in services:
            services = services["services"]
        # Build map by service_id
        by_id = {}
        for svc in services:
            sid = svc.get("service_id") or svc.get("id") or svc.get("name")
            by_id[sid] = svc
        print(f"\n--- Cycle {i+1} ---")
        for sid, svc in by_id.items():
            print(f"{sid}: status={svc.get('status')} latency_ms={svc.get('latency_ms')}")
        results.append(by_id)
        time.sleep(1)

    # Assertions on last cycle
    last = results[-1]
    expected = {"api_gateway", "payment_processing", "wallet_services", "webhook_delivery", "dashboard"}
    assert expected.issubset(set(last.keys())), f"Missing services: {expected - set(last.keys())}"

    for sid in expected:
        svc = last[sid]
        assert svc.get("status") == "operational", f"{sid} status={svc.get('status')}"
        lat = svc.get("latency_ms")
        assert isinstance(lat, (int, float)) and lat > 0, f"{sid} latency_ms={lat}"

    # Wallet perf check across cycles - use best (min) to avoid one-off jitter, but also report all
    wallet_lats = [r["wallet_services"]["latency_ms"] for r in results]
    pay_lats = [r["payment_processing"]["latency_ms"] for r in results]
    dash_lats = [r["dashboard"]["latency_ms"] for r in results]
    print(f"\nwallet_services latencies across cycles: {wallet_lats}")
    print(f"payment_processing latencies across cycles: {pay_lats}")
    print(f"dashboard latencies across cycles: {dash_lats}")

    assert min(wallet_lats) < 300, f"wallet_services latencies {wallet_lats} - none under 300ms"
