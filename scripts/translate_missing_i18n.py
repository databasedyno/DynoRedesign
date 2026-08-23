#!/usr/bin/env python3
"""Backfill + machine-translate the missing i18n keys from i18n_manifest.json.

- Adds English source keys into langs/locales/en/<ns>.json (centralize).
- Machine-translates into de/es/fr/pt/nl via OpenAI (gpt-4o-mini), preserving
  interpolation placeholders ({{x}}), HTML tags, arrows, URLs and 'Dynopay'.
- Idempotent: only writes keys that are still missing. Safe to re-run.
- Placeholder guard: if a translation drops/changes a placeholder, keep English.
"""
import os, json, re, sys, time, urllib.request, urllib.error

ROOT = os.path.join(os.path.dirname(__file__), "..")
LOCALES = os.path.join(ROOT, "langs", "locales")
MANIFEST = os.path.join(ROOT, "scripts", "i18n_manifest.json")
LANGS = {
    "de": "German",
    "es": "Spanish",
    "fr": "French",
    "pt": "European Portuguese (Portugal)",
    "nl": "Dutch",
}
MODEL = "gpt-4o-mini"
CHUNK = 40

def read_key():
    for p in ("/app/.env", "/app/backend/.env"):
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

def load(path):
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}

def save(path, data):
    json.dump(data, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    open(path, "a", encoding="utf-8").write("\n")

def has_nested(d, dotted):
    cur = d
    for p in dotted.split("."):
        if not isinstance(cur, dict) or p not in cur:
            return False
        cur = cur[p]
    return True

def set_nested(d, dotted, value):
    parts = dotted.split(".")
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    if parts[-1] not in cur:
        cur[parts[-1]] = value
        return True
    return False

PH = re.compile(r"\{\{[^}]+\}\}")
TAG = re.compile(r"</?[a-zA-Z][^>]*>")

def placeholders(s):
    return sorted(PH.findall(s)), sorted(TAG.findall(s))

def openai_translate(mapping, lang_name):
    sys_prompt = (
        "You are a professional software UI localization translator for Dynopay, a "
        "crypto payments platform. Translate the JSON VALUES from English into "
        f"{lang_name}. Return ONLY a valid JSON object with the EXACT same keys.\n"
        "Rules: translate naturally and concisely for UI; DO NOT translate or alter "
        "interpolation placeholders like {{name}} {{count}} {{amount}}, HTML tags like "
        "<b></b>, trailing arrows →, URLs/paths like /creator, or the brand name "
        "'Dynopay'. Preserve punctuation and emoji. Do not add or remove keys."
    )
    body = json.dumps({
        "model": MODEL,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": json.dumps(mapping, ensure_ascii=False)},
        ],
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions", data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    last = None
    for attempt in range(4):
        try:
            r = urllib.request.urlopen(req, timeout=90)
            d = json.load(r)
            content = d["choices"][0]["message"]["content"]
            return json.loads(content)
        except Exception as e:
            last = e
            time.sleep(2 * (attempt + 1))
    print("   ! translate failed:", type(last).__name__, str(last)[:200])
    return {}

def chunks(items, n):
    for i in range(0, len(items), n):
        yield items[i:i + n]

manifest = load(MANIFEST)

# 1) English backfill
en_added = 0
for ns, kv in manifest.items():
    path = os.path.join(LOCALES, "en", f"{ns}.json")
    d = load(path)
    ch = False
    for k, v in kv.items():
        if not has_nested(d, k):
            if set_nested(d, k, v):
                en_added += 1; ch = True
    if ch:
        save(path, d)
print(f"[en] backfilled {en_added} keys", flush=True)

# 2) translations
for lang, lang_name in LANGS.items():
    total_added = 0
    for ns, kv in manifest.items():
        path = os.path.join(LOCALES, lang, f"{ns}.json")
        d = load(path)
        pending = {k: v for k, v in kv.items() if not has_nested(d, k)}
        if not pending:
            continue
        items = list(pending.items())
        for batch in chunks(items, CHUNK):
            mapping = {k: v for k, v in batch}
            out = openai_translate(mapping, lang_name)
            wrote = 0
            for k, en_v in batch:
                tv = out.get(k)
                if not isinstance(tv, str) or not tv.strip():
                    tv = en_v  # fallback to English
                else:
                    # placeholder guard
                    if placeholders(en_v) != placeholders(tv):
                        tv = en_v
                if set_nested(d, k, tv):
                    wrote += 1
            total_added += wrote
            save(path, d)  # persist incrementally
            print(f"[{lang}] {ns}: +{wrote} (batch {len(batch)})", flush=True)
    print(f"[{lang}] DONE total +{total_added}", flush=True)

print("ALL DONE", flush=True)
