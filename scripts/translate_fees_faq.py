#!/usr/bin/env python3
"""Inject the fee-FAQ copy into en/fees.json (v3.faq*) then machine-translate it
into de/es/fr/pt/nl (OpenAI gpt-4o-mini) and merge. Idempotent."""
import os, json, re, sys, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..")
LOCALES = os.path.join(ROOT, "langs", "locales")
LANGS = {"de": "German", "es": "Spanish", "fr": "French",
         "pt": "European Portuguese (Portugal)", "nl": "Dutch"}
MODEL = "gpt-4o-mini"

FAQ = {
    "faqEyebrow": "FAQ",
    "faqTitle": "Pricing questions, answered",
    "faqItems": [
        {"q": "How much does Dynopay charge per transaction?",
         "a": "Fees start at 1.5% per successful transaction and drop to as low as 0.5% as your monthly processing volume grows. Your very first payment is completely free."},
        {"q": "Are there monthly fees or setup costs?",
         "a": "No. There are no monthly fees, no setup fees, and no hidden charges. You only pay a simple percentage on successful payments."},
        {"q": "What are network (gas) fees?",
         "a": "Every blockchain charges its own network fee to move funds. This fee goes to the network, not to Dynopay, and varies by network and congestion. Choosing an efficient network keeps it low for you and your customers."},
        {"q": "Do I pay fees on refunds or failed payments?",
         "a": "You are only ever charged on successful payments. Failed, abandoned, or unconfirmed payments cost you nothing."},
        {"q": "When do I receive my money?",
         "a": "Dynopay is non-custodial, so confirmed payments settle directly to a wallet you control. There is no Dynopay-imposed holding period before you can use your funds."},
        {"q": "How are exchange rates calculated?",
         "a": "When you price in a fiat currency, Dynopay converts the amount to the chosen crypto at a live market rate shown to the customer at checkout. Paying in a stablecoin keeps the amount received close to the amount invoiced."},
    ],
}


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
        [collect(v, out) for v in obj]
    elif isinstance(obj, dict):
        [collect(obj[k], out) for k in obj]


def rebuild(obj, it):
    if isinstance(obj, str):
        return next(it)
    if isinstance(obj, list):
        return [rebuild(v, it) for v in obj]
    if isinstance(obj, dict):
        return {k: rebuild(obj[k], it) for k in obj}
    return obj


def translate(strings, lang_name):
    sysp = (f"Translate each string from English to {lang_name} for a business pricing help page. "
            f"Keep 'Dynopay' unchanged; keep numbers, percentages and ticker symbols unchanged. "
            f"Return a JSON object {{\"items\": [...]}} with the same length and order.")
    payload = {"model": MODEL, "temperature": 0.2,
               "messages": [{"role": "system", "content": sysp},
                            {"role": "user", "content": json.dumps({"items": strings}, ensure_ascii=False)}],
               "response_format": {"type": "json_object"}}
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions",
                                 data=json.dumps(payload).encode("utf-8"),
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read().decode("utf-8"))
    items = json.loads(data["choices"][0]["message"]["content"])["items"]
    assert len(items) == len(strings), f"{len(items)} != {len(strings)}"
    return items


def load(p):
    return json.load(open(p, encoding="utf-8"))


def save(p, o):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, indent=2); f.write("\n")


def merge(code, faq):
    p = os.path.join(LOCALES, code, "fees.json")
    d = load(p)
    d.setdefault("v3", {})
    d["v3"]["faqEyebrow"] = faq["faqEyebrow"]
    d["v3"]["faqTitle"] = faq["faqTitle"]
    d["v3"]["faqItems"] = faq["faqItems"]
    save(p, d)


merge("en", FAQ)
print("en: merged fee FAQ")
strings = []
collect(FAQ, strings)
print(f"strings/lang: {len(strings)}")
for code, name in LANGS.items():
    tr = translate(strings, name)
    merge(code, rebuild(FAQ, iter(tr)))
    print(f"{code}: merged")
