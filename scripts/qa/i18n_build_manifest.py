#!/usr/bin/env python3
"""Build scripts/i18n_manifest.json from t()-calls whose key is missing in en/<ns>.json.
Handles balanced braces in options ({{placeholders}}), `ns:` overrides, and alias→namespace bindings."""
import glob, json, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
EN = os.path.join(ROOT, "langs", "locales", "en")
SKIP = ("Components/Page/Home", "pages/blog", "pages/for", "Components/Page/Landing", "pages/index", "Components/Page/Pay3",
        "pages/pay/", "pages/[handle]", "pages/admin", "Components/Page/Admin", "Components/Layout/AdminHeader")
ALIAS_NS = {"tPaymentLink": "createPaymentLinkScreen", "tDashboard": "dashboardLayout", "tTransactions": "transactions",
            "tWallet": "walletScreen", "tNotifications": "notifications", "tCommon": "common", "tTx": "transactions",
            "tSettings": "companySettings", "tTitle": "pageTitles"}

present = {}
for f in glob.glob(os.path.join(EN, "*.json")):
    ns = os.path.splitext(os.path.basename(f))[0]
    s = set()
    def walk(d, p=""):
        for k, v in d.items():
            s.add(p + k)
            if isinstance(v, dict): walk(v, p + k + ".")
    walk(json.load(open(f, encoding="utf-8")))
    present[ns] = s

BIND = re.compile(r"const\s*\{\s*t(?:\s*:\s*(\w+))?[^}]*\}\s*=\s*useTranslation\(\s*(\[[^\]]*\]|\"[^\"]*\"|'[^']*'|(\w+))\s*\)")
STR = re.compile(r"[\"']([^\"']+)[\"']")
DV = re.compile(r"defaultValue\s*:\s*(\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*')", re.S)
NSOPT = re.compile(r"\bns\s*:\s*[\"']([^\"']+)[\"']")
CALL = re.compile(r"\b(t[A-Za-z]*)\(\s*[\"']([^\"'$]+)[\"']\s*,\s*\{")

def balanced(txt, i):
    depth = 0
    for j in range(i, len(txt)):
        if txt[j] == "{": depth += 1
        elif txt[j] == "}":
            depth -= 1
            if depth == 0: return txt[i + 1:j]
    return None

manifest, seen = {}, {}
files = [p for pat in ("Components/**/*.tsx", "Components/**/*.ts", "pages/**/*.tsx", "Containers/**/*.tsx", "helpers/**/*.ts*", "hooks/**/*.ts*")
         for p in glob.glob(os.path.join(ROOT, pat), recursive=True)]
for fp in files:
    rel = os.path.relpath(fp, ROOT)
    if rel.startswith(SKIP): continue
    txt = open(fp, encoding="utf-8").read()
    alias_ns = dict(ALIAS_NS)
    for m in BIND.finditer(txt):
        alias = m.group(1) or "t"
        raw = m.group(2)
        if raw.startswith("["): nss = STR.findall(raw)
        elif raw[0] in "\"'": nss = [raw[1:-1]]
        else:
            vm = re.search(r"const\s+" + re.escape(raw) + r"\s*=\s*(\[[^\]]*\])", txt)
            nss = STR.findall(vm.group(1)) if vm else []
        if nss: alias_ns[alias] = nss[0]
    has_binding = "useTranslation(" in txt
    for m in CALL.finditer(txt):
        alias, key = m.group(1), m.group(2)
        if alias not in alias_ns and alias != "t": continue
        if alias == "t" and not has_binding: continue  # `t` passed in via props — namespace unknown
        opts = balanced(txt, m.end() - 1)
        if opts is None: continue
        dv = DV.search(opts)
        if not dv: continue
        english = json.loads(dv.group(1)) if dv.group(1)[0] == '"' else dv.group(1)[1:-1]
        nsm = NSOPT.search(opts)
        ns = nsm.group(1) if nsm else alias_ns.get(alias, "common")
        if ":" in key and not key.startswith("http"):
            ns, key = key.split(":", 1)
        if key in present.get(ns, set()): continue
        # plural / interpolation: template-built defaults can't be used verbatim
        if "${" in english: continue
        manifest.setdefault(ns, {})
        if key not in manifest[ns]:
            manifest[ns][key] = english
            seen[(ns, key)] = rel

out = os.path.join(ROOT, "scripts", "i18n_manifest.json")
json.dump(manifest, open(out, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
total = sum(len(v) for v in manifest.values())
print("namespaces:", len(manifest), "| missing keys:", total)
for (ns, key), rel in sorted(seen.items(), key=lambda x: x[1]):
    print(f"  {rel}: {ns}:{key} => {manifest[ns][key][:70]}")
