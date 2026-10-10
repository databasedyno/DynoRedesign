#!/usr/bin/env python3
"""Read-only sweep: call every parameter-free GET route of the merchant API with the
merchant token and report non-2xx responses. Usage: python3 scripts/qa/get_route_sweep.py"""
import json
import os
import re
import urllib.request
import urllib.error
import concurrent.futures as cf

ROOT = "/app/backend/routes"
BASE = "https://fiat-crypto-vault.preview.emergentagent.com/api"
TOKEN = open("/app/memory/tmp/merchant_token.txt").read().strip()
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
SKIP_WORDS = ("sync", "start", "trigger", "run", "send", "retry", "cron", "callback", "webhook", "stream", "logout",
              "export", "download", "pdf", "csv", "oauth", "redirect", "verify", "unsubscribe", "test", "sweep", "backfill")

index = open(os.path.join(ROOT, "index.ts")).read()
mounts = dict((v, p) for p, v in re.findall(r'router\.use\(\s*"(/[^"]*)",\s*(?:authMiddleware,\s*)?(?:[A-Za-z]+,\s*)*([A-Za-z]+Router)\s*\)', index))
imports = dict(re.findall(r'import\s+(\w+Router)\s+from\s+"\./(\w+)"', index))

routes = []
for var, prefix in mounts.items():
    fname = imports.get(var)
    if not fname:
        continue
    path = os.path.join(ROOT, fname + ".ts")
    if not os.path.exists(path):
        continue
    src = open(path).read()
    for sub in re.findall(r'\w+\.get\(\s*["\'](/[^"\']*)["\']', src):
        if ":" in sub or "*" in sub:
            continue
        full = (prefix.rstrip("/") + sub) if sub != "/" else prefix
        if any(w in full.lower() for w in SKIP_WORDS) or full.startswith("/admin") or full.startswith("/__"):
            continue
        routes.append(full)

routes = sorted(set(routes))


def hit(p):
    sep = "&" if "?" in p else "?"
    req = urllib.request.Request(f"{BASE}{p}{sep}company_id=1", headers={"Authorization": f"Bearer {TOKEN}", "User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            body = r.read(4000).decode("utf-8", "ignore")
            return p, r.status, ("NaN" in body and '"NaN' not in body), ""
    except urllib.error.HTTPError as e:
        body = e.read(400).decode("utf-8", "ignore")
        try:
            msg = json.loads(body).get("message", "")
        except Exception:
            msg = body[:120]
        return p, e.code, False, msg
    except Exception as e:  # timeout etc.
        return p, 0, False, str(e)[:120]


with cf.ThreadPoolExecutor(6) as ex:
    results = list(ex.map(hit, routes))

bad = [r for r in results if r[1] >= 500 or r[1] == 0 or r[2]]
client = [r for r in results if 400 <= r[1] < 500]
print(f"routes swept: {len(results)} | 2xx: {sum(1 for r in results if 200 <= r[1] < 300)} | 4xx: {len(client)} | 5xx/timeouts/NaN: {len(bad)}")
for r in bad:
    print("SERVER", r)
for r in client:
    print("CLIENT", r)
