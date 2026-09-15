#!/usr/bin/env python3
"""Structural audit of every rendered email (plan/audit/emails/html) → plan/audit/emails/email_audit.json.
Checks: subject length, preheader, CTA count/target, local-part greeting, small fonts, money fields, footer bits, shot height."""
import json, re, os, struct
from pathlib import Path

HTML = Path("/app/plan/audit/emails/html")
SHOTS = Path("/app/public/audit/emails")
m = json.load(open(HTML / "manifest.json"))

MONEY_SENDERS = {"paymentSettled", "paymentReceived", "paymentPending", "paymentConfirming", "paymentPartial", "paymentPartialExpired",
                 "merchantUnderpaidDigest", "autoConversionPayout", "orderReceiptMerchant", "largeTransaction", "withdrawalSuccess", "merchantRefund"}
BUYER_MONEY = {"customerConfirmation", "orderReceipt", "buyerRefund", "buyerUnderpaidNudge", "buyerPaymentExpired", "orderRefunded"}

def png_height(p):
    try:
        with open(p, "rb") as f:
            f.read(16); w, h = struct.unpack(">II", f.read(8)); return h
    except Exception:
        return None

out = []
for r in m:
    if not r["file"]:
        out.append({**r, "checks": {}, "flags": ["no-output"]}); continue
    s = (HTML / r["file"]).read_text(encoding="utf-8")
    body = re.sub(r"<style.*?</style>", "", s, flags=re.S)
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body))
    hrefs = re.findall(r'href="([^"]+)"', body)
    app_links = [h for h in hrefs if re.search(r"dynopay\.com|localhost|preview\.emergentagent", h) and not re.search(r"privacy-policy|terms-conditions|help-support|facebook|instagram|x\.com|linkedin|t\.me|/api/static|^https://dynopay\.com/?$", h)]
    ctas = re.findall(r'<a[^>]+class="[^"]*\bbtn\b[^"]*"', body) or re.findall(r'<a[^>]+style="[^"]*display:\s*inline-block[^"]*background(?:-color)?:\s*#4338CA', body)
    small = re.findall(r"font-size:\s*(\d+(?:\.\d+)?)px", body)
    small_ct = sum(1 for v in small if float(v) < 12)
    greeting_local = bool(re.search(r"Hey [a-z0-9._-]+@|Hey [a-z0-9]+[.,]", text)) and "@" in (re.search(r"Hey ([^,]+),", text) or [None, ""])[1]
    checks = {
        "subject_len": len(r["subject"]),
        "subject_placeholder": "{{" in r["subject"],
        "preheader": 'max-height:0;max-width:0;opacity:0' in body,
        "cta_count": len(ctas),
        "cta_targets": app_links[:3],
        "cta_to_list_page": any(re.search(r"/(transactions|payouts|dashboard|invoices|pay-links)(\?|$|\")", h) and "tx=" not in h and "open=" not in h for h in app_links),
        "small_font_hits": small_ct,
        "greeting_local_part": greeting_local,
        "has_explorer_link": bool(re.search(r"mempool|etherscan|tronscan|blockchair|polygonscan|solscan|xrpscan|explorer", body, re.I)),
        "mentions_fee": bool(re.search(r"\bfee\b|Gebühr|comisión|frais|taxa|kosten", text, re.I)),
        "mentions_net": bool(re.search(r"\bnet\b|netto|neto|líquido", text, re.I)),
        "mentions_network": bool(re.search(r"network|netzwerk|red\b|réseau|rede|netwerk|TRC-20|ERC-20|Bitcoin|Ethereum|Tron|Polygon|Litecoin", text, re.I)),
        "mentions_hash_or_tx": bool(re.search(r"transaction (id|hash)|tx hash|hash|0x[0-9a-f]{6}|[0-9a-f]{8}…", text, re.I)),
        "footer_settings_link": bool(re.search(r"notification|settings\?section=notifications|unsubscribe|abmelden|préférences", body, re.I)),
        "footer_legal_address": bool(re.search(r"\b(Ltd|LLC|GmbH|Inc\.|B\.V\.|S\.A\.|UG|OÜ)\b|street|straße|\d{4,5}\s+[A-Z][a-z]+", text)),
        "raw_i18n_key": bool(re.search(r"(?<![\w/.-])(?:merchant|common|labels|paymentSettled|paymentReceived|activation)\.[a-zA-Z]+\.[a-zA-Z]+(?![\w-])", text)),
        "shot_h_600": png_height(SHOTS / f"{r['slug']}__600__light.png"),
        "shot_h_390": png_height(SHOTS / f"{r['slug']}__390__light.png"),
        "text_len": len(text),
    }
    flags = []
    if checks["subject_placeholder"]: flags.append("BLOCKER subject placeholder not interpolated")
    if checks["subject_len"] > 60: flags.append("subject > 60 chars")
    if not checks["preheader"]: flags.append("no preheader")
    if checks["cta_count"] > 1: flags.append(f"{checks['cta_count']} CTA buttons")
    if checks["cta_to_list_page"]: flags.append("CTA opens a list page, not the object")
    if checks["greeting_local_part"]: flags.append("greets by e-mail local part")
    if checks["small_font_hits"] > 0: flags.append(f"{checks['small_font_hits']} text runs < 12px")
    if r["sender"] in MONEY_SENDERS and r["audience"] == "M":
        if not checks["mentions_fee"]: flags.append("money: no fee")
        if not checks["mentions_net"]: flags.append("money: no net")
        if not checks["mentions_network"]: flags.append("money: no network")
        if not checks["mentions_hash_or_tx"]: flags.append("money: no tx hash")
    if r["sender"] in BUYER_MONEY and r["audience"] == "B":
        if not checks["mentions_network"]: flags.append("buyer: no network")
        if re.search(r"Dynopay fee|platform fee|Plattformgebühr", text, re.I) and r["sender"] != "customerConfirmation": flags.append("buyer: shows merchant fee")
    if not checks["footer_settings_link"] and r["audience"] == "M": flags.append("footer: no notification-settings link")
    if checks["raw_i18n_key"]: flags.append("BLOCKER raw i18n key")
    if (checks["shot_h_390"] or 0) > 3200: flags.append("very long on phone (>3200px)")
    out.append({**r, "checks": checks, "flags": flags})

json.dump(out, open("/app/plan/audit/emails/email_audit.json", "w"), indent=1, ensure_ascii=False)
for r in out:
    print(f"{r['n']:3} {r['audience']} {r['family']:14} {r['sender']:26} {r['variant']:22} h390={r['checks'].get('shot_h_390')} | {'; '.join(f for f in r['flags'] if not f.startswith('footer'))}")
print("\nfooter: no notification-settings link →", sum(1 for r in out if any(f.startswith('footer') for f in r['flags'])), "of", len(out))
print("no preheader →", sum(1 for r in out if 'no preheader' in r['flags']))
