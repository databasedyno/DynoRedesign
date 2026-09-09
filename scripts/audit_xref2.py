#!/usr/bin/env python3
"""Robust-ish frontend->backend endpoint cross-check by suffix matching."""
import os, re, glob

ROOT = "/app"

# Collect ALL backend route definitions (method, path) from any express router
# across backend/ (routes + controllers that define sub-routers).
be = []  # (METHOD, path)
for fpath in glob.glob(os.path.join(ROOT, "backend", "**", "*.ts"), recursive=True):
    try:
        txt = open(fpath).read()
    except Exception:
        continue
    for m in re.finditer(r'\b(?:router|app|r|apiRouter|publicRouter|merchantApiRouter)\.(get|post|put|patch|delete)\(\s*[`"\']([^`"\']*)[`"\']', txt):
        be.append((m.group(1).upper(), m.group(2)))

# Build a set of backend (method, normalized-suffix-tokens)
def toks(p):
    p = p.split("?")[0]
    p = re.sub(r':[A-Za-z0-9_]+', '*', p)     # express param
    p = re.sub(r'\$\{[^}]*\}', '*', p)         # template literal
    parts = [seg for seg in p.split("/") if seg != ""]
    return parts

be_by_method = {}
for mth, p in be:
    be_by_method.setdefault(mth, []).append(toks(p))

def suffix_match(fe_parts, be_parts):
    """Does fe path end-match a backend route? Compare from the right, allowing '*' wildcard on either side."""
    if not fe_parts or not be_parts:
        return False
    n = min(len(fe_parts), len(be_parts))
    # require the backend route's full token count to align at the tail
    fe_tail = fe_parts[-len(be_parts):] if len(fe_parts) >= len(be_parts) else fe_parts
    if len(fe_tail) != len(be_parts):
        return False
    for a, b in zip(fe_tail, be_parts):
        if a == "*" or b == "*":
            continue
        if a.lower() != b.lower():
            return False
    return True

# Frontend calls
call_re = re.compile(r'\.(get|post|put|patch|delete)\(\s*([`"\'])([^`"\']*)\2')
dirs = ["pages", "Components", "Containers", "contexts", "hooks", "api", "Redux", "utils", "helpers"]
unmatched = []
seen = set()
for d in dirs:
    for fpath in glob.glob(os.path.join(ROOT, d, "**", "*.ts*"), recursive=True):
        try:
            lines = open(fpath).read().splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            for m in call_re.finditer(line):
                method, path = m.group(1).upper(), m.group(3)
                if path.startswith("http") or "/" not in path:
                    continue
                fe_parts = toks(path)
                # skip external / non-api obvious (e.g. asset paths)
                cands = be_by_method.get(method, [])
                ok = any(suffix_match(fe_parts, bp) for bp in cands)
                if not ok:
                    key = (method, "/".join(fe_parts))
                    if key in seen: continue
                    seen.add(key)
                    unmatched.append((method, path, fpath.replace(ROOT+"/",""), i))

print("BACKEND route defs found:", len(be))
print("UNMATCHED frontend calls:", len(unmatched))
for method, path, f, ln in sorted(unmatched):
    print(f"  {method:6} {path:52} [{f}:{ln}]")
