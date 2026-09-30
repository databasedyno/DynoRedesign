#!/usr/bin/env python3
"""
Add Brevo DNS records to Cloudflare for 10 domains.
Records: DKIM1 CNAME, DKIM2 CNAME, brevo-code TXT, and DMARC TXT (for 2 domains).
"""
import requests, json, sys, time, os

CF_EMAIL = os.environ["CF_EMAIL"]      # export CF_EMAIL=... before running
CF_KEY = os.environ["CF_API_KEY"]      # export CF_API_KEY=... (never hardcode)
BASE = "https://api.cloudflare.com/client/v4"
HEADERS = {
    "X-Auth-Email": CF_EMAIL,
    "X-Auth-Key": CF_KEY,
    "Content-Type": "application/json",
}

BREVO_CODE = "brevo-code:4831905d430c357fb51d82f6ddb0d1d3"
DMARC_VALUE = "v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com"

DOMAINS = [
    {"domain": "dynopay.com",  "slug": "dynopay-com",  "dmarc": False},
    {"domain": "safedeal.sh",  "slug": "safedeal-sh",  "dmarc": False},
    {"domain": "dynocash.com", "slug": "dynocash-com", "dmarc": False},
    {"domain": "lockbay.io",   "slug": "lockbay-io",   "dmarc": False},
    {"domain": "movely.pt",    "slug": "movely-pt",    "dmarc": False},
    {"domain": "bozzmail.com", "slug": "bozzmail-com", "dmarc": False},
    {"domain": "nameword.com", "slug": "nameword-com", "dmarc": False},
    {"domain": "hostbay.io",   "slug": "hostbay-io",   "dmarc": False},
    {"domain": "priv.host",    "slug": "priv-host",    "dmarc": True},
    {"domain": "cloakhost.ru", "slug": "cloakhost-ru", "dmarc": True},
]


def get_zone_id(domain):
    """Get Cloudflare zone ID for a domain."""
    r = requests.get(f"{BASE}/zones", params={"name": domain}, headers=HEADERS)
    data = r.json()
    if not data.get("success") or not data.get("result"):
        return None
    return data["result"][0]["id"]


def get_existing_records(zone_id):
    """Get all DNS records in a zone (paginated)."""
    records = []
    page = 1
    while True:
        r = requests.get(f"{BASE}/zones/{zone_id}/dns_records", params={"page": page, "per_page": 100}, headers=HEADERS)
        data = r.json()
        if not data.get("success"):
            break
        records.extend(data.get("result", []))
        total_pages = data.get("result_info", {}).get("total_pages", 1)
        if page >= total_pages:
            break
        page += 1
    return records


def record_exists(existing, rec_type, rec_name, rec_content):
    """Check if a record already exists."""
    for r in existing:
        if r["type"] == rec_type and r["name"].lower() == rec_name.lower():
            if r["content"].lower() == rec_content.lower():
                return True
    return False


def add_record(zone_id, rec_type, name, content, proxied=False, ttl=1):
    """Add a DNS record. Returns (success, message)."""
    payload = {
        "type": rec_type,
        "name": name,
        "content": content,
        "ttl": ttl,  # 1 = auto
        "proxied": proxied,
    }
    r = requests.post(f"{BASE}/zones/{zone_id}/dns_records", headers=HEADERS, json=payload)
    data = r.json()
    if data.get("success"):
        return True, "created"
    errors = data.get("errors", [])
    msg = errors[0].get("message", str(errors)) if errors else str(data)
    return False, msg


def main():
    results = {"ok": [], "skip": [], "fail": [], "no_zone": []}

    for d in DOMAINS:
        domain = d["domain"]
        slug = d["slug"]
        print(f"\n{'='*60}")
        print(f"  {domain}")
        print(f"{'='*60}")

        zone_id = get_zone_id(domain)
        if not zone_id:
            print(f"  ✗ Zone not found in Cloudflare — skipping")
            results["no_zone"].append(domain)
            continue

        print(f"  Zone ID: {zone_id}")
        existing = get_existing_records(zone_id)
        print(f"  Existing records: {len(existing)}")

        # Build the records we need to add
        records_to_add = [
            # DKIM1 CNAME
            ("CNAME", f"brevo1._domainkey.{domain}", f"b1.{slug}.dkim.brevo.com"),
            # DKIM2 CNAME
            ("CNAME", f"brevo2._domainkey.{domain}", f"b2.{slug}.dkim.brevo.com"),
            # brevo-code TXT
            ("TXT", domain, BREVO_CODE),
        ]
        if d["dmarc"]:
            records_to_add.append(("TXT", f"_dmarc.{domain}", DMARC_VALUE))

        for rec_type, name, content in records_to_add:
            label = f"{rec_type} {name}"
            if record_exists(existing, rec_type, name, content):
                print(f"  ≡ {label} — already exists, skipping")
                results["skip"].append(f"{domain}: {label}")
                continue

            ok, msg = add_record(zone_id, rec_type, name, content, proxied=False)
            if ok:
                print(f"  ✓ {label} — {msg}")
                results["ok"].append(f"{domain}: {label}")
            else:
                print(f"  ✗ {label} — {msg}")
                results["fail"].append(f"{domain}: {label} — {msg}")

            time.sleep(0.3)  # rate-limit courtesy

    # Summary
    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    print(f"  Created:    {len(results['ok'])}")
    print(f"  Skipped:    {len(results['skip'])} (already existed)")
    print(f"  Failed:     {len(results['fail'])}")
    print(f"  No zone:    {len(results['no_zone'])}")

    if results["fail"]:
        print("\n  FAILURES:")
        for f in results["fail"]:
            print(f"    - {f}")

    if results["no_zone"]:
        print("\n  ZONES NOT FOUND:")
        for z in results["no_zone"]:
            print(f"    - {z}")

    sys.exit(1 if results["fail"] or results["no_zone"] else 0)


if __name__ == "__main__":
    main()
