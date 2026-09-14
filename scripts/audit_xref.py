#!/usr/bin/env python3
"""Cross-reference frontend API calls against backend Express routes.
Read-only audit helper. Best-effort static parse (not a full TS parser)."""
import os, re, json, glob

ROOT = "/app"
BE_ROUTES = os.path.join(ROOT, "backend", "routes")

# 1) Parse index.ts mount prefixes:  router.use("/prefix", ...Router)
index_ts = open(os.path.join(BE_ROUTES, "index.ts")).read()
mounts = {}  # routerVarName -> prefix
for m in re.finditer(r'router\.use\(\s*"([^"]*)"\s*,(.*?)\)', index_ts):
    prefix, rest = m.group(1), m.group(2)
    for rv in re.findall(r'(\w+Router)\b', rest):
        mounts.setdefault(rv, []).append(prefix)

# Map router variable -> file (import ... from "./xxxRouter")
var2file = {}
for m in re.finditer(r'import\s+(\w+)\s+from\s+"\./([\w/]+)"', index_ts):
    var2file[m.group(1)] = m.group(2)

# 2) For each router file, extract route method+path
def routes_in_file(path):
    try:
        txt = open(path).read()
    except FileNotFoundError:
        return []
    out = []
    for m in re.finditer(r'\brouter\.(get|post|put|patch|delete)\(\s*[`"\']([^`"\']*)[`"\']', txt):
        out.append((m.group(1).upper(), m.group(2)))
    return out

backend_paths = set()  # (METHOD, fullpath-regex-ish)
backend_raw = []
for rv, prefixes in mounts.items():
    f = var2file.get(rv)
    if not f:
        continue
    fp = os.path.join(BE_ROUTES, f + ".ts")
    for method, rp in routes_in_file(fp):
        for prefix in prefixes:
            full = ("/api" + prefix + rp).replace("//", "/")
            backend_raw.append((method, full))
            backend_paths.add((method, full))

# also direct router.get/post in index.ts (with /api prefix)
for m in re.finditer(r'\brouter\.(get|post|put|patch|delete)\(\s*[`"\']([^`"\']*)[`"\']', index_ts):
    full = ("/api" + m.group(2)).replace("//", "/")
    backend_raw.append((m.group(1).upper(), full))
    backend_paths.add((m.group(1).upper(), full))

def to_regex(path):
    # express :param and * -> wildcard segment
    p = re.escape(path)
    p = re.sub(r'\\:[A-Za-z0-9_]+', r'[^/]+', p)
    p = p.replace(r'\*', r'.*')
    return re.compile("^" + p + "$")

be_regex = [(mth, to_regex(p), p) for (mth, p) in backend_paths]

# 3) Frontend calls. Find axios-ish calls with method + path literal.
fe_calls = []  # (method, rawpath, file, line)
exts = ("*.ts", "*.tsx")
dirs = ["pages", "Components", "Containers", "contexts", "hooks", "api", "Redux", "utils", "helpers"]
call_re = re.compile(r'\.(get|post|put|patch|delete)\(\s*([`"\'])([^`"\']*)\2')
for d in dirs:
    for ext in exts:
        for fpath in glob.glob(os.path.join(ROOT, d, "**", ext), recursive=True):
            try:
                lines = open(fpath).read().splitlines()
            except Exception:
                continue
            for i, line in enumerate(lines, 1):
                for m in call_re.finditer(line):
                    method, path = m.group(1).upper(), m.group(3)
                    fe_calls.append((method, path, fpath.replace(ROOT+"/", ""), i))

# Normalise a frontend path to compare: ensure leading /api
def norm_fe(path):
    p = path.strip()
    if p.startswith("http"):
        return None
    # strip query
    p = p.split("?")[0]
    # template ${...} -> wildcard
    p = re.sub(r'\$\{[^}]*\}', 'X', p)
    if not p.startswith("/"):
        p = "/" + p
    if not p.startswith("/api"):
        p = "/api" + p
    return p

# Filter obvious non-HTTP (URLSearchParams.get('x'), Map.get) : path has no slash and is a bare word
def looks_http(path):
    if path.startswith("http"): return False
    if "/" in path: return True
    return False

unmatched = []
for method, path, f, ln in fe_calls:
    if not looks_http(path):
        continue
    np = norm_fe(path)
    if np is None:
        continue
    # compare, allowing X wildcard to match [^/]+
    cand = np.replace("X", "__WILD__")
    test = re.escape(cand).replace(re.escape("__WILD__"), "[^/]+")
    trx = re.compile("^" + test + "$")
    ok = False
    for (bm, brx, bp) in be_regex:
        if bm != method:
            continue
        # match either direction
        if brx.match(np.replace("X","x")) or trx.match(bp):
            ok = True
            break
    if not ok:
        unmatched.append((method, path, np, f, ln))

print("=== BACKEND ROUTE COUNT:", len(backend_paths))
print("=== FRONTEND HTTP CALLS:", len([c for c in fe_calls if looks_http(c[1])]))
print("=== UNMATCHED FRONTEND CALLS (no backend route found):", len(unmatched))
seen = set()
for method, path, np, f, ln in sorted(unmatched):
    key = (method, np)
    if key in seen: continue
    seen.add(key)
    print(f"  {method:6} {path:55} [{f}:{ln}]")
