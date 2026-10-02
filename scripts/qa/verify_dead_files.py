#!/usr/bin/env python3
"""Verify that candidate files have zero importers (outside the candidate set itself).
Usage: python3 scripts/qa/verify_dead_files.py <list-file> [root=/app]
Prints files that ARE referenced (keep) and writes the confirmed-dead list to <list-file>.confirmed
"""
import os, re, sys

root = sys.argv[2] if len(sys.argv) > 2 else "/app"
cands = [l.strip() for l in open(sys.argv[1]) if l.strip()]
cand_set = set(cands)
SKIP_DIRS = {"node_modules", ".next", ".next-prod", ".next-prod-new", ".git", ".jest-cache", "dist", "build", "coverage", "memory", "test_reports", "public"}
EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json")

def walk(base):
    for dp, dns, fns in os.walk(base):
        dns[:] = [d for d in dns if d not in SKIP_DIRS and not d.startswith(".next")]
        for fn in fns:
            if fn.endswith(EXTS):
                yield os.path.join(dp, fn)

def strip_ext(p):
    return re.sub(r"\.(tsx?|jsx?|mjs|cjs)$", "", p)

def specifiers(rel):
    base = strip_ext(rel)
    out = {"@/" + base, base}
    name = os.path.basename(base)
    if name.lower() == "index":
        d = os.path.dirname(base)
        out |= {"@/" + d, d}
    return out, name

files = list(walk(root))
contents = {}
for f in files:
    try:
        contents[f] = open(f, encoding="utf-8", errors="ignore").read()
    except Exception:
        pass

IMPORT_RE = re.compile(r"""(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)["']([^"']+)["']""")

def resolve(importer, spec):
    """Return repo-relative path (no ext) the spec points to, or None."""
    if spec.startswith("@/"):
        return spec[2:].rstrip("/")
    if spec.startswith("."):
        return os.path.normpath(os.path.join(os.path.dirname(os.path.relpath(importer, root)), spec)).rstrip("/")
    return None

def main():
    referenced = {}
    cand_bases = {}
    for c in cands:
        base = strip_ext(c)
        cand_bases[base] = c
        if os.path.basename(base).lower() == "index":
            cand_bases[os.path.dirname(base)] = c
    for f, src in contents.items():
        rel = os.path.relpath(f, root)
        if rel in cand_set:
            continue
        for m in IMPORT_RE.finditer(src):
            tgt = resolve(f, m.group(1))
            if tgt is None:
                continue
            for key in (tgt, tgt + "/index", tgt + "/Index"):
                if key in cand_bases:
                    referenced.setdefault(cand_bases[key], set()).add(rel)
    # Also catch string references to bare basenames in next/dynamic or config files (heuristic)
    for c in cands:
        name = os.path.basename(strip_ext(c))
        if name.lower() in ("index", "styled"):
            continue
        pat = re.compile(r"[\"'/]" + re.escape(name) + r"[\"'.]")
        for f, src in contents.items():
            rel = os.path.relpath(f, root)
            if rel in cand_set or rel.startswith("scripts/") or rel.startswith("memory/") or rel.endswith(".md"):
                continue
            if pat.search(src) and "import" in src:
                referenced.setdefault(c, set()).add(rel + " (name match)")
    missing = [c for c in cands if not os.path.exists(os.path.join(root, c))]
    dead = [c for c in cands if c not in referenced and c not in missing]
    for c in sorted(referenced):
        print(f"KEEP  {c}  <- {sorted(referenced[c])[:3]}")
    for c in missing:
        print(f"GONE  {c}")
    out = sys.argv[1] + ".confirmed"
    open(out, "w").write("\n".join(dead) + "\n")
    print(f"\n{len(dead)} confirmed dead → {out}; {len(referenced)} referenced; {len(missing)} already gone")

main()
