#!/usr/bin/env python3
"""Translate every /for/{vertical} SEO landing page into de/es/fr/pt/nl.

Reads data/seo-pages/verticals/*.json (English source), translates all string
leaves EXCEPT `_`-prefixed meta keys (which include `_slug` — must never change),
and writes data/seo-pages/verticals/i18n/<lang>/<slug>.json. Idempotent.
Batches all verticals into ONE request per language for speed.
"""
import os, json, re, sys, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..")
VDIR = os.path.join(ROOT, "data", "seo-pages", "verticals")
OUT = os.path.join(VDIR, "i18n")
LANGS = {"de": "German", "es": "Spanish", "fr": "French",
         "pt": "European Portuguese (Portugal)", "nl": "Dutch"}
MODEL = "gpt-4o-mini"


def read_key():
    for p in (os.path.join(ROOT, ".env"), os.path.join(ROOT, "backend", ".env")):
        try:
            for line in open(p):
                m = re.match(r'\s*OPENAI_API_KEY\s*=\s*"?([^"\n]+)"?', line)
                if m:
                    return m.group(1).strip()
        except Exception:
            pass
    return None


KEY = read_key()
if not KEY:
    print("NO OPENAI KEY"); sys.exit(1)


def collect(obj, out):
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, list):
        for v in obj:
            collect(v, out)
    elif isinstance(obj, dict):
        for k in obj:
            if str(k).startswith("_"):
                continue
            collect(obj[k], out)


def rebuild(obj, it):
    if isinstance(obj, str):
        return next(it)
    if isinstance(obj, list):
        return [rebuild(v, it) for v in obj]
    if isinstance(obj, dict):
        return {k: (obj[k] if str(k).startswith("_") else rebuild(obj[k], it)) for k in obj}
    return obj


def translate(strings, lang_name):
    sysp = (f"You are a professional translator. Translate each string from English to {lang_name} "
            f"for a business marketing/SEO landing page about crypto payments. "
            f"Keep the brand name 'Dynopay' unchanged. Keep URLs, email addresses, ticker symbols "
            f"(USDT, USDC, BTC, ETH), numbers and percentages unchanged. Preserve any {{{{placeholder}}}} tokens. "
            f"Translate naturally and keep it concise. Return a JSON object {{\"items\": [...]}} "
            f"with EXACTLY the same number of items in the same order.")
    payload = {"model": MODEL, "temperature": 0.2,
               "messages": [{"role": "system", "content": sysp},
                            {"role": "user", "content": json.dumps({"items": strings}, ensure_ascii=False)}],
               "response_format": {"type": "json_object"}}
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions",
                                 data=json.dumps(payload).encode("utf-8"),
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.loads(r.read().decode("utf-8"))
    items = json.loads(data["choices"][0]["message"]["content"])["items"]
    if len(items) != len(strings):
        raise RuntimeError(f"len {len(items)} != {len(strings)}")
    return items


files = sorted(f for f in os.listdir(VDIR) if f.endswith(".json"))
verticals = [(f[:-5], json.load(open(os.path.join(VDIR, f), encoding="utf-8"))) for f in files]
print(f"verticals: {len(verticals)}")

# Flatten strings across all verticals, tracking per-vertical counts.
big, counts = [], []
for _slug, content in verticals:
    s = []
    collect(content, s)
    counts.append(len(s))
    big.extend(s)
print(f"total strings/lang: {len(big)}")

for code, name in LANGS.items():
    outdir = os.path.join(OUT, code)
    os.makedirs(outdir, exist_ok=True)
    for slug, content in verticals:
        s = []
        collect(content, s)
        tr = translate(s, name)
        localized = rebuild(content, iter(tr))
        with open(os.path.join(outdir, slug + ".json"), "w", encoding="utf-8") as f:
            json.dump(localized, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print(f"{code}: wrote {len(verticals)} files")

print("DONE")
