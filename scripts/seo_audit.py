import re, sys, json, urllib.request, html

BASE = "http://localhost:3000"
ROUTES = sys.argv[1:] or [
    "/", "/fees", "/documentation", "/blog", "/about", "/press", "/referral-program",
    "/system-status", "/terms-conditions", "/privacy-policy", "/aml-policy", "/how-to",
    "/creator", "/auth/login", "/auth/register", "/signup", "/help-support",
    "/for/merchants", "/for/creators", "/for/fundraisers", "/for/developers",
    "/blog/how-to-accept-crypto-payments-on-your-website",
    "/blog/stablecoin-settlement-protects-revenue",
    "/blog/bitcoin-vs-credit-card-fees-comparison",
    "/blog/userless-payment-api-simplest-crypto-integration",
    "/pay/demo", "/404-not-here",
]

def meta(src, attr, name):
    m = re.search(rf'<meta[^>]*{attr}="{re.escape(name)}"[^>]*content="([^"]*)"', src) or \
        re.search(rf'<meta[^>]*content="([^"]*)"[^>]*{attr}="{re.escape(name)}"', src)
    return html.unescape(m.group(1)) if m else None

for r in ROUTES:
    try:
        req = urllib.request.Request(BASE + r, headers={"User-Agent": "Mozilla/5.0 (Slackbot-LinkExpanding)"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            src = resp.read().decode("utf-8", "ignore"); status = resp.status
    except urllib.error.HTTPError as e:
        src = e.read().decode("utf-8", "ignore"); status = e.code
    except Exception as e:
        print(f"\n### {r}\n  ERROR {e}"); continue
    titles = re.findall(r"<title[^>]*>(.*?)</title>", src, re.S)
    t = html.unescape(titles[-1].strip()) if titles else None
    d = meta(src, "name", "description")
    ogt = meta(src, "property", "og:title"); ogd = meta(src, "property", "og:description")
    ogi = meta(src, "property", "og:image"); rob = meta(src, "name", "robots")
    can = re.search(r'<link[^>]*rel="canonical"[^>]*href="([^"]*)"', src)
    h1 = re.findall(r"<h1[^>]*>(.*?)</h1>", src, re.S)
    h1 = re.sub(r"<[^>]+>", "", h1[0]).strip() if h1 else None
    print(f"\n### {r}  [{status}]  titles={len(titles)}")
    print(f"  TITLE ({len(t or '')}ch): {t}")
    print(f"  DESC  ({len(d or '')}ch): {d}")
    if ogt != t: print(f"  OG:TITLE: {ogt}")
    if ogd != d: print(f"  OG:DESC : {ogd}")
    print(f"  OG:IMG: {ogi}")
    print(f"  CANON : {can.group(1) if can else None}   ROBOTS: {rob}")
    print(f"  H1    : {h1}")
