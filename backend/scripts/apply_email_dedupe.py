#!/usr/bin/env python3
"""De-dupe redundant / clashing email + PDF copy so every surface pulls from ONE source.

What it does (all 6 locales: en de es fr nl pt — key sets stay identical):
  GREETING  -> single source common.greeting / common.greetingDefault
              (chrome.greeting, chrome.greetingNoName, common.greetingNoName removed;
               dynoPayGreetingTemplate + customerReceiptEmail repointed)
  SIGN-OFF  -> single source chrome.bestRegards / chrome.teamSignature
              (dead common.regards "Thanks," / common.team / common.questions removed —
               they clashed with the footer's "Best regards,")
  PDF       -> receipt.* exact duplicates of labels.* / chrome.* removed; pdfReceiptService
              repointed (transactionId, reference, status, description, customer,
              merchantReceives, platformFee, feePaidByMerchant, feePaidByCustomer,
              amountPaid [uppercased in code], tagline, rights)
  WALLET OTP-> dead merchant.walletOtp block removed (live one is top-level walletOtp.*)

Idempotent. Run from backend/:  python3 scripts/apply_email_dedupe.py
"""
import json, pathlib, sys

BASE = pathlib.Path(__file__).resolve().parent.parent
LANGS = ["en", "de", "es", "fr", "nl", "pt"]

REMOVE_KEYS = [
    "chrome.greeting",
    "chrome.greetingNoName",
    "common.greetingNoName",
    "common.regards",
    "common.team",
    "common.questions",
    "receipt.transactionId",
    "receipt.reference",
    "receipt.status",
    "receipt.description",
    "receipt.customer",
    "receipt.merchantReceives",
    "receipt.platformFee",
    "receipt.feePaidByMerchant",
    "receipt.feePaidByCustomer",
    "receipt.amountPaid",
    "receipt.tagline",
    "receipt.rights",
    "merchant.walletOtp",
]

CODE_EDITS = [
    ("services/email/emailShared.ts",
     "tr('chrome.greeting', lang, { name: cleanName })",
     "tr('common.greeting', lang, { name: cleanName })"),
    ("services/email/emailShared.ts",
     "tr('chrome.greetingNoName', lang)",
     "tr('common.greetingDefault', lang)"),
    ("services/email/customerReceiptEmail.ts",
     "t('common.greetingNoName', L)",
     "t('common.greetingDefault', L)"),
    ("utils/emailI18n.ts",
     "// Greeting keys (common.greeting / chrome.greeting) always take a person's",
     "// The greeting key (common.greeting — single source) always takes a person's"),
    ("services/pdfReceiptService.ts", 't("receipt.amountPaid", L)', 't("labels.amountPaid", L).toUpperCase()'),
    ("services/pdfReceiptService.ts", 't("receipt.transactionId", L)', 't("labels.transactionId", L)'),
    ("services/pdfReceiptService.ts", 't("receipt.reference", L)', 't("labels.reference", L)'),
    ("services/pdfReceiptService.ts", 't("receipt.status", L)', 't("labels.status", L)'),
    ("services/pdfReceiptService.ts",
     '"receipt.feePaidByCustomer" : "receipt.feePaidByMerchant"',
     '"labels.feePaidByCustomer" : "labels.feePaidByMerchant"'),
    ("services/pdfReceiptService.ts", 't("receipt.merchantReceives", L)', 't("labels.merchantReceives", L)'),
    ("services/pdfReceiptService.ts", 't("receipt.platformFee", L)', 't("labels.platformFee", L)'),
    ("services/pdfReceiptService.ts", 't("receipt.customer", L)', 't("labels.customer", L)'),
    ("services/pdfReceiptService.ts", 't("receipt.description", L)', 't("labels.description", L)'),
    ("services/pdfReceiptService.ts", 't("receipt.tagline", L)', 't("chrome.tagline", L)'),
    ("services/pdfReceiptService.ts", 't("receipt.rights", L, ', 't("chrome.rights", L, '),
]


def drop(d: dict, dotted: str) -> bool:
    parts = dotted.split(".")
    cur = d
    for p in parts[:-1]:
        if not isinstance(cur, dict) or p not in cur:
            return False
        cur = cur[p]
    if isinstance(cur, dict) and parts[-1] in cur:
        del cur[parts[-1]]
        return True
    return False


def main() -> int:
    # 1) code repoints (must run BEFORE deleting keys so nothing dangles)
    for rel, old, new in CODE_EDITS:
        p = BASE / rel
        s = p.read_text()
        n = s.count(old)
        if n == 0 and s.count(new) >= 1:
            print(f"   = {rel}: already repointed ({new[:48]}...)")
            continue
        if n == 0:
            print(f"   ! {rel}: target not found: {old}")
            return 1
        s = s.replace(old, new)
        p.write_text(s)
        print(f"   + {rel}: {n}x {old[:52]} -> {new[:52]}")

    # 2) locale files
    for lang in LANGS:
        p = BASE / "locales" / lang / "emails.json"
        d = json.loads(p.read_text())
        removed = [k for k in REMOVE_KEYS if drop(d, k)]
        p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
        print(f"   + locales/{lang}: removed {len(removed)} keys")

    # 3) sanity: identical key sets across languages
    def flat(o, pre=""):
        out = set()
        for k, v in o.items():
            kp = f"{pre}.{k}" if pre else k
            out |= flat(v, kp) if isinstance(v, dict) else {kp}
        return out

    ref = flat(json.loads((BASE / "locales/en/emails.json").read_text()))
    for lang in LANGS[1:]:
        cur = flat(json.loads((BASE / f"locales/{lang}/emails.json").read_text()))
        if cur != ref:
            print(f"   ! {lang} key set differs: +{sorted(cur - ref)[:5]} -{sorted(ref - cur)[:5]}")
            return 1
    print(f"\nOK — {len(ref)} leaf keys per locale, identical across {len(LANGS)} languages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
