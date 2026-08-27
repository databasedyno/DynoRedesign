#!/usr/bin/env python3
"""Extract i18n keys used inline with a defaultValue but MISSING from the
locale files, resolving each to its namespace via useTranslation bindings.
Outputs scripts/i18n_manifest.json = { "<ns>": { "<key>": "<english>" } }.

Low risk: if a key is mis-resolved it just lands in the wrong file (app still
falls back to defaultValue). We only ADD missing keys; never touch existing."""
import json, glob, re, os

ROOT = os.path.join(os.path.dirname(__file__), "..")
EN = os.path.join(ROOT, "langs", "locales", "en")

# keys already present in each en/<ns>.json (leaf + dotted path)
present = {}
for f in glob.glob(os.path.join(EN, "*.json")):
    ns = os.path.splitext(os.path.basename(f))[0]
    s = set()
    def walk(d, prefix=""):
        for k, v in d.items():
            s.add(prefix + k)
            if isinstance(v, dict):
                walk(v, prefix + k + ".")
    try:
        walk(json.load(open(f, encoding="utf-8")))
    except Exception:
        pass
    present[ns] = s

BIND = re.compile(
    r"const\s*\{\s*t(?:\s*:\s*(\w+))?\s*(?:,\s*[\w:]+)?\s*\}\s*=\s*useTranslation\(\s*(\[[^\]]*\]|\"[^\"]*\"|'[^']*'|\w+)\s*\)"
)
NSVAR = re.compile(r"const\s+%s\s*=\s*(\[[^\]]*\])")
STRLIST = re.compile(r"[\"']([^\"']+)[\"']")
# t-call: alias("key", { ...options with defaultValue... })
def call_re(alias):
    return re.compile(
        r"\b" + re.escape(alias) + r"\(\s*[\"'`]([^\"'`]+)[\"'`]\s*,\s*\{([^{}]*defaultValue[^{}]*)\}",
        re.S,
    )
DV = re.compile(r"defaultValue\s*:\s*(\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*'|`[^`$]*`)")
NSOPT = re.compile(r"\bns\s*:\s*[\"']([^\"']+)[\"']")

def _decode_js(inner):
    """Decode standard JS/JSON string escapes to real unicode."""
    out = []
    i = 0
    while i < len(inner):
        c = inner[i]
        if c == "\\" and i + 1 < len(inner):
            n = inner[i + 1]
            if n == "u" and i + 5 < len(inner) + 1:
                try:
                    out.append(chr(int(inner[i + 2:i + 6], 16)))
                    i += 6
                    continue
                except ValueError:
                    pass
            m = {"n": "\n", "t": "\t", "r": "\r", '"': '"', "'": "'", "`": "`", "\\": "\\", "/": "/"}
            if n in m:
                out.append(m[n])
                i += 2
                continue
            out.append(n)
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def unquote(s):
    return _decode_js(s[1:-1])

manifest = {}
files = (glob.glob(os.path.join(ROOT, "Components", "**", "*.tsx"), recursive=True)
         + glob.glob(os.path.join(ROOT, "Components", "**", "*.ts"), recursive=True)
         + glob.glob(os.path.join(ROOT, "pages", "**", "*.tsx"), recursive=True)
         + glob.glob(os.path.join(ROOT, "pages", "**", "*.ts"), recursive=True))
skipped = 0
for fp in files:
    if "node_modules" in fp:
        continue
    try:
        txt = open(fp, encoding="utf-8").read()
    except Exception:
        continue
    # alias -> default namespace
    alias_ns = {}
    for m in BIND.finditer(txt):
        alias = m.group(1) or "t"
        raw = m.group(2)
        nss = []
        if raw.startswith("["):
            nss = STRLIST.findall(raw)
        elif raw[0] in "\"'":
            nss = [raw[1:-1]]
        else:  # identifier like `namespaces`
            vm = NSVAR.pattern.replace("%s", re.escape(raw))
            vmm = re.search(NSVAR.pattern % re.escape(raw), txt)
            if vmm:
                nss = STRLIST.findall(vmm.group(1))
        if nss:
            alias_ns[alias] = nss
    if not alias_ns:
        continue
    for alias, nss in alias_ns.items():
        default_ns = nss[0]
        for cm in call_re(alias).finditer(txt):
            key = cm.group(1)
            opts = cm.group(2)
            dvm = DV.search(opts)
            if not dvm:
                continue
            english = unquote(dvm.group(1))
            nsm = NSOPT.search(opts)
            ns = nsm.group(1) if nsm else default_ns
            # skip if already present in that ns (leaf or path)
            if ns in present and (key in present[ns]):
                continue
            # also skip if present in ANY loaded ns as leaf (dup safety)
            manifest.setdefault(ns, {})
            if key in manifest[ns]:
                continue
            manifest[ns][key] = english

total = sum(len(v) for v in manifest.values())
out = os.path.join(ROOT, "scripts", "i18n_manifest.json")
json.dump(manifest, open(out, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print("namespaces:", len(manifest), "| total missing keys:", total)
for ns in sorted(manifest, key=lambda n: -len(manifest[n])):
    print(f"  {ns}: {len(manifest[ns])}")
