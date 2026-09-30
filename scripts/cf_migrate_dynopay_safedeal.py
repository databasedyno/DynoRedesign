#!/usr/bin/env python3
"""
Migrate dynopay.com + safedeal.sh DNS hosting from DigitalOcean to Cloudflare,
keeping the live app on DO (A record -> droplet IP, DNS-only / grey cloud) and
carrying over every existing record, plus a clean Brevo set (NEW account).

Non-destructive: creating a Cloudflare zone + records does NOT affect the live
domain until the registrar's nameservers are pointed at Cloudflare.

Run:  python3 scripts/cf_migrate_dynopay_safedeal.py
"""
import requests, sys, time, json, os

CF_EMAIL = os.environ["CF_EMAIL"]              # export CF_EMAIL=... before running
CF_KEY = os.environ["CF_API_KEY"]              # export CF_API_KEY=... (never hardcode)
CF_ACCOUNT_ID = os.environ.get("CF_ACCOUNT_ID", "ed6035ebf6bd3d85f5b26c60189a21e2")
BASE = "https://api.cloudflare.com/client/v4"
H = {"X-Auth-Email": CF_EMAIL, "X-Auth-Key": CF_KEY, "Content-Type": "application/json"}

DROPLET_IP = "134.209.94.115"
BREVO_CODE_NEW = "brevo-code:4831905d430c357fb51d82f6ddb0d1d3"
DMARC = "v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com"
SPF = "v=spf1 include:spf.brevo.com ~all"
MAIL_DKIM = ("k=rsa;p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDeMVIzrCa3T14JsNY0IRv5/2V1/"
             "v2itlviLQBwXsa7shBD6TrBkswsFUToPyMRWC9tbR/5ey0nRBH0ZVxp+lsmTxid2Y2z+FApQ6ra2"
             "VsXfbJP3HE6wAO0YTVEJt1TmeczhEd2Jiz/fcabIISgXEdSpTYJhb0ct0VJRxcg4c8c7wIDAQAB")

# (type, name, content, proxied)   name "@" means apex
RECORDS = {
    "dynopay.com": [
        ("A",     "@",                     DROPLET_IP,                          False),
        ("CNAME", "www",                   "dynopay.com",                       False),
        ("CNAME", "checkout",              "dynopay.com",                       False),
        ("CNAME", "7023c07d2dc9c90065edb194fd8811a5", "verify.bing.com",        False),
        ("CNAME", "brevo1._domainkey",     "b1.dynopay-com.dkim.brevo.com",     False),
        ("CNAME", "brevo2._domainkey",     "b2.dynopay-com.dkim.brevo.com",     False),
        ("TXT",   "@",  "google-site-verification=PAEz5RHrrcfZmDFHV1yFct7ygnlZuFxmAq02QyQNFm4", False),
        ("TXT",   "@",  BREVO_CODE_NEW,    None),
        ("TXT",   "@",  SPF,               None),
        ("TXT",   "_dmarc", DMARC,         None),
        ("TXT",   "mail._domainkey", MAIL_DKIM, None),
    ],
    "safedeal.sh": [
        ("A",     "@",                     DROPLET_IP,                          False),
        ("CNAME", "www",                   "safedeal.sh",                       False),
        ("CNAME", "brevo1._domainkey",     "b1.safedeal-sh.dkim.brevo.com",     False),
        ("CNAME", "brevo2._domainkey",     "b2.safedeal-sh.dkim.brevo.com",     False),
        ("TXT",   "@",  BREVO_CODE_NEW,    None),
        ("TXT",   "@",  SPF,               None),
        ("TXT",   "_dmarc", DMARC,         None),
        ("TXT",   "mail._domainkey", MAIL_DKIM, None),
    ],
}


def get_zone(domain):
    r = requests.get(f"{BASE}/zones", params={"name": domain}, headers=H, timeout=20).json()
    res = r.get("result") or []
    return res[0] if res else None


def create_zone(domain):
    payload = {"name": domain, "account": {"id": CF_ACCOUNT_ID}, "type": "full", "jump_start": False}
    r = requests.post(f"{BASE}/zones", headers=H, json=payload, timeout=30).json()
    if r.get("success"):
        return r["result"], None
    return None, r.get("errors")


def full_name(domain, name):
    return domain if name == "@" else f"{name}.{domain}"


def list_records(zone_id):
    recs, page = [], 1
    while True:
        r = requests.get(f"{BASE}/zones/{zone_id}/dns_records", params={"page": page, "per_page": 100}, headers=H, timeout=20).json()
        recs += r.get("result", [])
        info = r.get("result_info", {})
        if page >= info.get("total_pages", 1):
            break
        page += 1
    return recs


def exists(existing, rtype, fqdn, content):
    c = content.strip('"').lower()
    for r in existing:
        if r["type"] == rtype and r["name"].lower() == fqdn.lower() and r["content"].strip('"').lower() == c:
            return True
    return False


def add_record(zone_id, domain, rtype, name, content, proxied):
    fqdn = full_name(domain, name)
    payload = {"type": rtype, "name": fqdn, "content": content, "ttl": 1}
    if proxied is not None:
        payload["proxied"] = proxied
    r = requests.post(f"{BASE}/zones/{zone_id}/dns_records", headers=H, json=payload, timeout=30).json()
    if r.get("success"):
        return True, "created"
    errs = r.get("errors", [])
    return False, (errs[0].get("message") if errs else str(r))


def main():
    summary = {}
    for domain, records in RECORDS.items():
        print(f"\n{'='*66}\n  {domain}\n{'='*66}")
        z = get_zone(domain)
        if not z:
            z, err = create_zone(domain)
            if not z:
                print(f"  ! zone create FAILED: {err}")
                summary[domain] = {"ns": None, "error": err}
                continue
            print(f"  + zone created (status={z['status']})")
        else:
            print(f"  = zone already exists (status={z['status']})")
        zid = z["id"]
        ns = z.get("name_servers", [])
        print(f"  Cloudflare nameservers: {ns}")

        existing = list_records(zid)
        for (rtype, name, content, proxied) in records:
            fqdn = full_name(domain, name)
            if exists(existing, rtype, fqdn, content):
                print(f"  = {rtype:5} {name:34} exists")
                continue
            ok, msg = add_record(zid, domain, rtype, name, content, proxied)
            flag = "proxied" if proxied else ("dns-only" if proxied is False else "")
            print(f"  {'+' if ok else '!'} {rtype:5} {name:34} {flag:9} {msg if not ok else ''}")
            time.sleep(0.25)
        summary[domain] = {"ns": ns, "zone_status": z["status"]}

    print(f"\n{'='*66}\n  NAMESERVERS TO SET AT REGISTRAR\n{'='*66}")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
