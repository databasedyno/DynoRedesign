#!/usr/bin/env python3
"""Cross-reference frontend API call sites against the dumped backend route table (read-only)."""
import json, os, re, sys
from collections import defaultdict

ROOT = "/app"
FE_DIRS = ["pages", "Components", "Containers", "Redux", "api", "hooks", "helpers", "contexts", "utils", "constants", "middleware.ts", "axiosConfig.ts", "axiosAdmin.ts", "store.ts", "i18n.js"]
routes = json.load(open("/tmp/routes_clean.json"))

PREFIXES = sorted({r["path"].split("/")[2] for r in routes if len(r["path"].split("/")) > 2 and r["path"].split("/")[2]})

def route_regex(path):
    # express path -> regex
    parts = []
    for seg in path.split("/"):
        if seg.startswith(":"):
            parts.append("[^/]*" if seg.endswith("?") else "[^/]+")
        elif seg == "*":
            parts.append(".*")
        else:
            parts.append(re.escape(seg))
    p = "/".join(parts)
    return re.compile("^" + p + "/?$")

route_tbl = [(r["method"], r["path"], route_regex(r["path"])) for r in routes]

def norm(u):
    u = u.strip()
    u = re.sub(r"\$\{[^}]*\}", "P", u)  # template placeholders
    u = u.split("?")[0]
    u = u.split("#")[0]
    if not u.startswith("/"):
        u = "/" + u
    if not u.startswith("/api/"):
        u = "/api" + u
    u = re.sub(r"/+", "/", u)
    if len(u) > 5 and u.endswith("/"):
        u = u[:-1]
    return u

call_re = re.compile(r"""(?:axiosBaseApi|axiosAdmin|axios|api|client|http|instance|apiClient|safedealApi|sdApi|escrowApi|adminApi)\s*\.\s*(get|post|put|delete|patch)\s*(?:<[^>]*>)?\s*\(\s*([`'"])(.*?)\2""", re.S)
fetch_re = re.compile(r"""fetch\s*\(\s*([`'"])(.*?)\1""", re.S)
str_re = re.compile(r"""([`'"])((?:/api/|/?(?:%s)/)[A-Za-z0-9_\-./:${}?=&\[\]]*?)\1""" % "|".join(map(re.escape, PREFIXES)))

hits = []  # (file, line, method, url)
skip_dirs = {"node_modules", ".next-prod", ".next", "_archive", "public", "tmp"}
for base in FE_DIRS:
    full = os.path.join(ROOT, base)
    files = []
    if os.path.isfile(full):
        files = [full]
    else:
        for dp, dn, fn in os.walk(full):
            dn[:] = [d for d in dn if d not in skip_dirs]
            for f in fn:
                if f.endswith((".ts", ".tsx", ".js", ".jsx")):
                    files.append(os.path.join(dp, f))
    for f in files:
        try:
            src = open(f, encoding="utf-8", errors="ignore").read()
        except Exception:
            continue
        for m in call_re.finditer(src):
            url = m.group(3)
            if "://" in url and "/api/" not in url:
                continue
            if not (url.startswith("/") or url.startswith("user") or url.startswith("wallet") or url.startswith("pay") or url.startswith("company") or url.startswith("admin") or url.startswith("safedeal") or url.startswith("$") or url.startswith("api") or "/" in url):
                continue
            line = src.count("\n", 0, m.start()) + 1
            hits.append((os.path.relpath(f, ROOT), line, m.group(1).upper(), url))
        for m in fetch_re.finditer(src):
            url = m.group(2)
            if "/api/" not in url and not url.startswith("/"):
                continue
            if "://" in url and "/api/" not in url:
                continue
            line = src.count("\n", 0, m.start()) + 1
            hits.append((os.path.relpath(f, ROOT), line, "?", url))
        for m in str_re.finditer(src):
            url = m.group(2)
            line = src.count("\n", 0, m.start()) + 1
            hits.append((os.path.relpath(f, ROOT), line, "?", url))

# Normalise & dedupe
seen = {}
for f, line, meth, url in hits:
    # strip absolute prefix up to /api/
    if "/api/" in url and not url.startswith("/api/"):
        url = url[url.index("/api/"):]
    if url.startswith("${") and "/api/" not in url:
        # `${base}/user/...` style
        url = re.sub(r"^\$\{[^}]*\}", "", url)
    n = norm(url)
    # Only consider paths that could be API paths
    if n in ("/api", "/api/"):
        continue
    seg = n.split("/")[2] if len(n.split("/")) > 2 else ""
    if seg not in PREFIXES and seg != "v1":
        continue
    if seg == "v1":
        n = "/api" + n[len("/api/v1"):]
    key = (meth, n)
    seen.setdefault(key, []).append(f"{f}:{line}")

unmatched = []
matched_routes = set()
for (meth, n), locs in sorted(seen.items()):
    cands = [(m, p) for (m, p, rx) in route_tbl if rx.match(n)]
    if not cands:
        unmatched.append((meth, n, locs))
        continue
    if meth != "?":
        mm = [(m, p) for (m, p) in cands if m == meth]
        if not mm:
            unmatched.append((meth + " (method mismatch; have " + ",".join(sorted({m for m, _ in cands})) + ")", n, locs))
            continue
        cands = mm
    for m, p in cands:
        matched_routes.add((m, p))

print("== FRONTEND CALLS WITH NO BACKEND ROUTE (%d) ==" % len(unmatched))
for meth, n, locs in unmatched:
    print(f"{meth:6} {n}\n      {'; '.join(locs[:4])}{' ...' if len(locs) > 4 else ''}")

unused = [(m, p) for (m, p, _) in route_tbl if (m, p) not in matched_routes]
print("\n== BACKEND ROUTES NEVER REFERENCED BY FRONTEND (%d of %d) ==" % (len(unused), len(route_tbl)))
grp = defaultdict(list)
for m, p in unused:
    grp[p.split("/")[2] if len(p.split("/")) > 2 else p].append(f"{m} {p}")
for k in sorted(grp):
    print(f"[{k}] " + " | ".join(sorted(grp[k])))
