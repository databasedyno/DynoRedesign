#!/usr/bin/env python3
"""One-shot codemod: swap single-line redux object-selectors for the new SWR
hooks (useWalletStore / useCompanyStore) and inject imports. Multiline /
property-form selectors and dispatch sites are reported for manual handling."""
import re, os, sys

ROOT = "/app"
FILES = [
    "Components/Layout/MobileNavigationBar/index.tsx",
    "Components/Layout/NewHeader/index.tsx",
    "Components/Page/Common/HOC/paymentAuth.tsx",
    "Components/Page/Dashboard/ConversionBanner.tsx",
    "Components/Page/Dashboard/DashboardLeftSection.tsx",
    "Components/Page/Dashboard/coinbase/AssetBreakdownRows.tsx",
    "Components/Page/Dashboard/coinbase/AttentionCardsRow.tsx",
    "Components/Page/Dashboard/coinbase/QuickActionsPanel.tsx",
    "Components/Page/Dashboard/v2026/index.tsx",
    "Components/Page/Payment/BankAccountComponent.tsx",
    "Components/Page/Payment/BankTransferComponent.tsx",
    "Components/Page/Payment/CardComponent.tsx",
    "Components/Page/Payment/CryptoComponent.tsx",
    "Components/Page/Payment/GooglePayComponent.tsx",
    "Components/Page/Payment/MobileMoneyComponent.tsx",
    "Components/Page/Payment/QRCodeComponent.tsx",
    "Components/Page/Payment/USSDComponent.tsx",
    "Components/UI/AddWalletModal/index.tsx",
    "Components/UI/CompanySettingsDialog/CompanyDetailsSection.tsx",
    "Components/UI/CompanySettingsDialog/index.tsx",
    "Components/UI/OnboardingFlow/CreateCompanyModal.tsx",
    "Components/UI/OnboardingFlow/index.tsx",
    "Components/UI/CompanySelector/index.tsx",
    "Components/Page/Payment-link/index.tsx",
    "Components/Page/Transactions/index.tsx",
    "Components/Page/Customers/index.tsx",
    "Components/Page/Notification/NotificationPage.tsx",
    "Components/Page/API/ApiKeysPage.tsx",
    "Components/Page/API/BuyButtonsSection.tsx",
    "Components/Page/API/PublishableKeysSection.tsx",
    "Components/Page/API/WebhookConsoleSection.tsx",
    "Components/Page/CreatePaymentLink/index.tsx",
    "Components/Page/Wallet/index.tsx",
    "Containers/Client/index.tsx",
    "hooks/useWalletData.ts",
    "hooks/useDashboardData.ts",
    "hooks/useNotificationPreferences.ts",
    "hooks/useUnreadNotificationsCount.ts",
    "pages/company.tsx",
    "pages/create-pay-link.tsx",
    "pages/dashboard.tsx",
    "pages/invoices.tsx",
    "pages/payment/index.tsx",
    "pages/settings/index.tsx",
    "pages/wallet.tsx",
]

# Single-line object-selector patterns -> hook call
WALLET_OBJ = re.compile(r"useSelector\(\s*\(?\s*\w+\s*:\s*rootReducer\s*\)?\s*=>\s*\w+\.walletReducer(?:\s+as\s+any)?\s*\)")
COMPANY_OBJ = re.compile(r"useSelector\(\s*\(?\s*\w+\s*:\s*rootReducer\s*\)?\s*=>\s*\w+\.companyReducer\s*\)")
COMPANY_OBJ_ANY = re.compile(r"useSelector\(\s*\(\s*\w+\s*:\s*any\s*\)\s*=>\s*\w+\.companyReducer\s*\)")
COMPANY_OBJ_ASANY = re.compile(r"useSelector\(\s*\(\s*\w+\s*:\s*rootReducer\s*\)\s*=>\s*\(\s*\w+\s+as\s+any\s*\)\.companyReducer\s*\)")

def inject_import(text, symbol, module):
    if symbol + "(" not in text and symbol + "()" not in text:
        return text
    if module in text:
        return text
    # insert after the first import line
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        if ln.startswith("import "):
            lines.insert(i, f'import {{ {symbol} }} from "{module}";')
            return "\n".join(lines)
    return text

report = {}
for rel in FILES:
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p):
        report[rel] = "MISSING"
        continue
    src = open(p, encoding="utf-8").read()
    orig = src
    out_lines = []
    for line in src.split("\n"):
        nl = line
        nl = WALLET_OBJ.sub("useWalletStore()", nl)
        nl = COMPANY_OBJ.sub("useCompanyStore()", nl)
        nl = COMPANY_OBJ_ANY.sub("useCompanyStore()", nl)
        nl = COMPANY_OBJ_ASANY.sub("useCompanyStore()", nl)
        out_lines.append(nl)
    src = "\n".join(out_lines)
    # inject imports if the hooks are now used
    src = inject_import(src, "useWalletStore", "@/contexts/WalletDataContext")
    src = inject_import(src, "useCompanyStore", "@/contexts/CompanyDataContext")
    if src != orig:
        open(p, "w", encoding="utf-8").write(src)
    # residuals needing manual work
    residuals = []
    for pat in ["companyReducer", "walletReducer", "WALLET_FETCH", "COMPANY_FETCH",
                "selectCompany(", "CompanyAction(", "WalletAction(",
                "COMPANY_INSERT", "COMPANY_UPDATE", "COMPANY_VALIDATE_TAX"]:
        c = src.count(pat)
        if c:
            residuals.append(f"{pat}={c}")
    report[rel] = ("CHANGED " if src != orig else "nochange ") + (", ".join(residuals) if residuals else "clean")

for rel in FILES:
    print(f"{report[rel]:<60} {rel}")
