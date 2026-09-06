#!/usr/bin/env python3
"""Forward `lang` into dynoPayEmailTemplate so the shared sign-off/footer chrome
("Best regards, / The Dynopay Team", tagline, Privacy/Terms/Support) renders in
the recipient's language for every LOCALIZED email.

Rule: only wire call sites whose BODY is already localized (they reference a
language identifier inside their t(...) calls, or are explicitly listed).
Code-embedded English emails (referral, team, wallet sudo/batch, wallet-security,
admin ops, diagnostics) are intentionally left English end-to-end.

Idempotent: a call that already has 7 args is skipped.
Run from backend/:  python3 scripts/apply_footer_lang_wiring.py
"""
import pathlib, re, sys

BASE = pathlib.Path(__file__).resolve().parent.parent

# file -> (explicit lang overrides by 1-based line of the call start, skip lines)
TARGETS = {
    "services/overpaymentNotifier.ts": {"skip": {135}},
    "services/email/kycEmails.ts": {},
    "services/email/adminOpsEmails.ts": {"skip": {173, 219, 261}},
    "services/email/accountEmails.ts": {},
    "services/email/billingReportEmails.ts": {},
    "services/email/customerReceiptEmail.ts": {},
    "services/email/activationEmails.ts": {"force": {67: "L"}},
    "services/email/activationGateEmail.ts": {"force": {104: "L"}},
    "services/email/linkCampaignEmails.ts": {"skip": {430}},
    "services/email/companyEmails.ts": {"skip": {132}},
    "services/email/walletEmails.ts": {"skip": {63, 91}},
    "services/email/conversionEmails.ts": {},
    "services/email/paymentEmails.ts": {},
    "controller/wallet/walletOtp.ts": {},
}

PAD = ["false", '""', '""', '""']  # showButton, buttonText, buttonLink, preheader (positions 3..6)


def split_args(body: str):
    args, depth, cur, q = [], 0, "", None
    i = 0
    while i < len(body):
        c = body[i]
        if q:
            cur += c
            if c == "\\":
                cur += body[i + 1]
                i += 2
                continue
            if c == q:
                q = None
            i += 1
            continue
        if c in "'\"`":
            q = c
            cur += c
        elif c in "([{":
            depth += 1
            cur += c
        elif c in ")]}":
            depth -= 1
            cur += c
        elif c == "," and depth == 0:
            args.append(cur)
            cur = ""
        else:
            cur += c
        i += 1
    if cur.strip():
        args.append(cur)
    return args


def process(rel: str, cfg: dict) -> int:
    path = BASE / rel
    src = path.read_text()
    out, pos, changed = [], 0, 0
    for m in re.finditer(r"\bdynoPayEmailTemplate\(", src):
        start = m.start()
        i, depth = m.end(), 1
        while depth and i < len(src):
            if src[i] == "(":
                depth += 1
            elif src[i] == ")":
                depth -= 1
            i += 1
        close = i - 1  # index of the matching ')'
        line = src[:start].count("\n") + 1
        body = src[m.end():close]
        args = split_args(body)
        if line in cfg.get("skip", set()):
            continue
        if len(args) >= 7:
            continue  # already wired
        lang = cfg.get("force", {}).get(line)
        if not lang:
            found = set(re.findall(r"\bt\(\s*['\"][^'\"]+['\"]\s*,\s*([A-Za-z_]+)", body))
            if len(found) != 1:
                print(f"   ! {rel}:{line} ambiguous/no lang ({sorted(found)}) — left unchanged")
                continue
            lang = found.pop()
        # Build the insertion: padding for missing positional args + lang.
        missing = PAD[max(0, len(args) - 2):] if len(args) < 6 else []
        extra = ", ".join(missing + [lang])
        # Preserve trailing whitespace/newline formatting before ')'.
        trail = re.search(r"\s*$", body).group(0)
        core = body[: len(body) - len(trail)] if trail else body
        new_body = f"{core}, {extra}{trail}"
        out.append(src[pos:m.end()])
        out.append(new_body)
        pos = close
        changed += 1
        print(f"   + {rel}:{line} -> +{extra}")
    out.append(src[pos:])
    if changed:
        path.write_text("".join(out))
    return changed


def main():
    total = 0
    for rel, cfg in TARGETS.items():
        total += process(rel, cfg)
    print(f"\nwired {total} call sites")
    return 0


if __name__ == "__main__":
    sys.exit(main())
