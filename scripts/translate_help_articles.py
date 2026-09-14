#!/usr/bin/env python3
"""Inject the 7 authored help articles into en/helpAndSupport.json under
`articles`, then machine-translate the whole `articles` subtree into
de/es/fr/pt/nl (OpenAI gpt-4o-mini) and merge into each locale.

- Preserves 'Dynopay', URLs and placeholders.
- Idempotent: safe to re-run (overwrites the `articles` key each time).
"""
import os, json, re, sys, urllib.request, urllib.error

ROOT = os.path.join(os.path.dirname(__file__), "..")
LOCALES = os.path.join(ROOT, "langs", "locales")
SRC = os.path.join(ROOT, "scripts", "help_articles_en.json")
LANGS = {
    "de": "German",
    "es": "Spanish",
    "fr": "French",
    "pt": "European Portuguese (Portugal)",
    "nl": "Dutch",
}
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


def collect_strings(obj, out):
    """Depth-first collect of all string leaves (order stable)."""
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, list):
        for v in obj:
            collect_strings(v, out)
    elif isinstance(obj, dict):
        for k in obj:
            collect_strings(obj[k], out)


def rebuild(obj, it):
    """Rebuild the same structure pulling translated strings from iterator `it`."""
    if isinstance(obj, str):
        return next(it)
    if isinstance(obj, list):
        return [rebuild(v, it) for v in obj]
    if isinstance(obj, dict):
        return {k: rebuild(obj[k], it) for k in obj}
    return obj


def translate_batch(strings, lang_name):
    sys_prompt = (
        f"You are a professional translator. Translate each string in the JSON array "
        f"from English to {lang_name}. Return ONLY a JSON array of the same length, same order. "
        f"Keep the brand name 'Dynopay' unchanged. Keep URLs, email addresses, ticker symbols "
        f"(USDT, USDC, BTC, ETH), percentages and numbers unchanged. Preserve any {{{{placeholder}}}} tokens exactly. "
        f"Translate naturally for a business help-center audience."
    )
    payload = {
        "model": MODEL,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": json.dumps(strings, ensure_ascii=False)},
        ],
        "response_format": {"type": "json_object"},
    }
    # response_format json_object requires an object; wrap/unwrap.
    payload["messages"][1]["content"] = json.dumps({"items": strings}, ensure_ascii=False)
    payload["messages"][0]["content"] = sys_prompt + " Return a JSON object {\"items\": [...]}."
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read().decode("utf-8"))
    content = data["choices"][0]["message"]["content"]
    items = json.loads(content)["items"]
    if len(items) != len(strings):
        raise RuntimeError(f"length mismatch: got {len(items)} want {len(strings)}")
    return items


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    articles_en = load(SRC)

    # 1. English merge
    en_path = os.path.join(LOCALES, "en", "helpAndSupport.json")
    en = load(en_path)
    en["articles"] = articles_en
    save(en_path, en)
    print("en: merged articles")

    strings = []
    collect_strings(articles_en, strings)
    print(f"strings to translate per language: {len(strings)}")

    # 2. Translate + merge each locale
    for code, name in LANGS.items():
        translated = translate_batch(strings, name)
        it = iter(translated)
        articles_loc = rebuild(articles_en, it)
        p = os.path.join(LOCALES, code, "helpAndSupport.json")
        loc = load(p)
        loc["articles"] = articles_loc
        save(p, loc)
        print(f"{code}: merged {len(translated)} translated strings")


if __name__ == "__main__":
    main()
