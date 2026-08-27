#!/usr/bin/env python3
"""Pass 2: convert multiline / property-form useSelector(...) calls that read
walletReducer or companyReducer into the SWR hook equivalents, using a
balanced-paren scanner (robust to type casts and newlines)."""
import re, os

ROOT = "/app"
FILES = [
    "Components/Page/Dashboard/ConversionBanner.tsx",
    "Components/Page/Payment-link/index.tsx",
    "Components/Page/Transactions/index.tsx",
    "Components/Page/Notification/NotificationPage.tsx",
    "pages/invoices.tsx",
    "Components/Page/Customers/index.tsx",
    "Components/Page/CreatePaymentLink/index.tsx",
    "hooks/useDashboardData.ts",
    "hooks/useNotificationPreferences.ts",
    "hooks/useUnreadNotificationsCount.ts",
    "pages/dashboard.tsx",
    "Components/Page/Wallet/index.tsx",
    "Components/Page/API/ApiKeysPage.tsx",
    "Components/Page/API/BuyButtonsSection.tsx",
    "Components/Page/API/PublishableKeysSection.tsx",
    "Components/Page/API/WebhookConsoleSection.tsx",
    "Components/UI/CompanySettingsDialog/index.tsx",
    "Components/UI/OnboardingFlow/CreateCompanyModal.tsx",
    "Components/UI/CompanySelector/index.tsx",
    "pages/company.tsx",
    "pages/create-pay-link.tsx",
    "hooks/useWalletData.ts",
]

def find_calls(text, fn="useSelector("):
    """Yield (start, end) spans of balanced fn(...) calls."""
    spans = []
    i = 0
    while True:
        idx = text.find(fn, i)
        if idx == -1:
            break
        # scan from the opening paren of fn
        p = idx + len(fn) - 1  # index of '('
        depth = 0
        j = p
        while j < len(text):
            ch = text[j]
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0:
                    break
            j += 1
        spans.append((idx, j + 1))  # inclusive of ')'
        i = j + 1
    return spans

def convert_body(body):
    """Given the full 'useSelector(...)' text, return replacement or None."""
    if "walletReducer" not in body and "companyReducer" not in body:
        return None
    if "walletReducer" in body:
        slice_name, hook = "walletReducer", "useWalletStore()"
    else:
        slice_name, hook = "companyReducer", "useCompanyStore()"
    # tail after the LAST real access of the slice name
    last = body.rfind(slice_name)
    tail = body[last + len(slice_name):]
    # drop the trailing ')' of useSelector and any whitespace/comma
    tail = tail.rstrip()
    if tail.endswith(")"):
        tail = tail[:-1]
    tail = tail.strip().lstrip(",").strip()
    prop = ""
    default = ""
    m = re.match(r"^\??\.(\w+)(.*)$", tail, re.S)
    if m:
        prop = "." + m.group(1)
        rest = m.group(2).strip()
        dm = re.match(r"^\?\?\s*(.+)$", rest, re.S)
        if dm:
            default = " ?? " + dm.group(1).strip()
    return hook + prop + default

def inject_import(text, symbol, module):
    if symbol + "(" not in text:
        return text
    if module in text:
        return text
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        if ln.startswith("import "):
            lines.insert(i, f'import {{ {symbol} }} from "{module}";')
            return "\n".join(lines)
    return text

for rel in FILES:
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p):
        print("MISSING", rel); continue
    src = open(p, encoding="utf-8").read()
    orig = src
    # process right-to-left so indices stay valid
    spans = find_calls(src)
    for (s, e) in reversed(spans):
        body = src[s:e]
        rep = convert_body(body)
        if rep is not None:
            src = src[:s] + rep + src[e:]
    src = inject_import(src, "useWalletStore", "@/contexts/WalletDataContext")
    src = inject_import(src, "useCompanyStore", "@/contexts/CompanyDataContext")
    if src != orig:
        open(p, "w", encoding="utf-8").write(src)
    resid = []
    for pat in ["companyReducer", "walletReducer"]:
        c = src.count(pat)
        if c:
            resid.append(f"{pat}={c}")
    print(("CHANGED  " if src != orig else "nochange ") + (", ".join(resid) if resid else "clean"), rel)
