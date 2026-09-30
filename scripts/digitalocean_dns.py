#!/usr/bin/env python3
"""Add Brevo DNS records to DigitalOcean for dynopay.com and safedeal.sh."""
import requests, sys, time, os

DO_TOKEN = os.environ["DO_TOKEN"]  # export DO_TOKEN=... before running (never hardcode)
BASE = "https://api.digitalocean.com/v2"
HEADERS = {
    "Authorization": f"Bearer {DO_TOKEN}",
    "Content-Type": "application/json",
}

BREVO_CODE = "brevo-code:4831905d430c357fb51d82f6ddb0d1d3"

DOMAINS = [
    {"domain": "dynopay.com",  "slug": "dynopay-com"},
    {"domain": "safedeal.sh",  "slug": "safedeal-sh"},
]


def get_existing_records(domain):
    records = []
    page = 1
    while True:
        r = requests.get(f"{BASE}/domains/{domain}/records", params={"page": page, "per_page": 200}, headers=HEADERS)
        data = r.json()
        records.extend(data.get("domain_records", []))
        pages = data.get("meta", {}).get("total", 0)
        links = data.get("links", {}).get("pages", {})
        if "next" not in links:
            break
        page += 1
    return records


def record_exists(existing, rec_type, name, data_value):
    for r in existing:
        if r["type"] == rec_type and r["name"] == name and r["data"] == data_value:
            return True
    return False


def add_record(domain, rec_type, name, data_value):
    payload = {
        "type": rec_type,
        "name": name,
        "data": data_value,
        "ttl": 1800,
    }
    # CNAME records need a trailing dot on the target in DO API
    if rec_type == "CNAME" and not data_value.endswith("."):
        payload["data"] = data_value + "."

    r = requests.post(f"{BASE}/domains/{domain}/records", headers=HEADERS, json=payload)
    if r.status_code in (200, 201):
        return True, "created"
    return False, f"HTTP {r.status_code}: {r.text}"


def main():
    results = {"ok": [], "skip": [], "fail": []}

    for d in DOMAINS:
        domain = d["domain"]
        slug = d["slug"]
        print(f"\n{'='*60}")
        print(f"  {domain}")
        print(f"{'='*60}")

        existing = get_existing_records(domain)
        print(f"  Existing records: {len(existing)}")

        records_to_add = [
            ("CNAME", "brevo1._domainkey", f"b1.{slug}.dkim.brevo.com"),
            ("CNAME", "brevo2._domainkey", f"b2.{slug}.dkim.brevo.com"),
            ("TXT", "@", BREVO_CODE),
        ]

        for rec_type, name, content in records_to_add:
            label = f"{rec_type} {name}"
            # For existence check, DO stores CNAME data with trailing dot
            check_content = content + "." if rec_type == "CNAME" else content
            if record_exists(existing, rec_type, name, check_content) or record_exists(existing, rec_type, name, content):
                print(f"  ≡ {label} — already exists, skipping")
                results["skip"].append(f"{domain}: {label}")
                continue

            ok, msg = add_record(domain, rec_type, name, content)
            if ok:
                print(f"  ✓ {label} — {msg}")
                results["ok"].append(f"{domain}: {label}")
            else:
                print(f"  ✗ {label} — {msg}")
                results["fail"].append(f"{domain}: {label} — {msg}")
            time.sleep(0.3)

    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    print(f"  Created:  {len(results['ok'])}")
    print(f"  Skipped:  {len(results['skip'])}")
    print(f"  Failed:   {len(results['fail'])}")
    if results["fail"]:
        print("\n  FAILURES:")
        for f in results["fail"]:
            print(f"    - {f}")

    sys.exit(1 if results["fail"] else 0)


if __name__ == "__main__":
    main()
