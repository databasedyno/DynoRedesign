#!/usr/bin/env python3
"""
Endpoints wave — migrate inline API paths to the central API_ENDPOINTS map.

Guarantees byte-identical runtime URLs:
  - STATIC: the constant's VALUE is the exact original string (call-site-aware
    replacement — only axios/fetch first-args are touched, never router paths).
  - DYNAMIC: builder fns interpolate their args verbatim; each call site passes
    the SAME expression(s), so the produced string is identical.
"""
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), "..")
SCAN = ["Components", "pages"]
CALL_RE = re.compile(r'(axiosBaseApi\.(?:get|post|put|delete|patch)|fetch)\s*\(')
IMPORT_LINE = 'import { API_ENDPOINTS } from "@/api/endpoints";'

STATIC_MAP = {
    "/api/user/creator/reserve-handle": "`/api${API_ENDPOINTS.creator.reserveHandle}`",
    "/user/creator/reserve-handle": "API_ENDPOINTS.creator.reserveHandle",
    "/user/creator/profile": "API_ENDPOINTS.creator.profile",
    "/user/creator/stats": "API_ENDPOINTS.creator.stats",
    "/wallet/addFunds": "API_ENDPOINTS.wallet.addFunds",
    "/wallet/authStep": "API_ENDPOINTS.wallet.authStep",
    "/wallet/copyWalletAddresses": "API_ENDPOINTS.wallet.copyWalletAddresses",
    "/wallet/reusable-wallets": "API_ENDPOINTS.wallet.reusableWallets",
    "/wallet/validateWalletAddress": "API_ENDPOINTS.wallet.validateWalletAddress",
    "/wallet/verifyCryptoPayment": "API_ENDPOINTS.wallet.verifyCryptoPayment",
    "/wallet/verifyPayment": "API_ENDPOINTS.wallet.verifyPayment",
    "/pay/addPayment": "API_ENDPOINTS.pay.addPayment",
    "/pay/configured-currencies": "API_ENDPOINTS.pay.configuredCurrencies",
    "/pay/getCurrencyRates": "API_ENDPOINTS.pay.getCurrencyRates",
    "/pay/uploadCampaignImage": "API_ENDPOINTS.pay.uploadCampaignImage",
    "/pay/verifyCryptoPayment": "API_ENDPOINTS.pay.verifyCryptoPayment",
    "/user/addEmail": "API_ENDPOINTS.user.addEmail",
    "/user/addPhone": "API_ENDPOINTS.user.addPhone",
    "/user/checkEmail?email=": "API_ENDPOINTS.user.checkEmail",
    "/user/checkPhone?phone=": "API_ENDPOINTS.user.checkPhone",
    "/user/forgot-password": "API_ENDPOINTS.user.forgotPassword",
    "/user/forgot-password-phone": "API_ENDPOINTS.user.forgotPasswordPhone",
    "/user/forgot-password-phone/verify-otp": "API_ENDPOINTS.user.forgotPasswordPhoneVerifyOtp",
    "/user/forgot-password/verify-otp": "API_ENDPOINTS.user.forgotPasswordVerifyOtp",
    "/user/last-company": "API_ENDPOINTS.user.lastCompany",
    "/user/phone-type-check": "API_ENDPOINTS.user.phoneTypeCheck",
    "/user/registerEmail": "API_ENDPOINTS.user.registerEmail",
    "/user/registerEmail/verify-otp": "API_ENDPOINTS.user.registerEmailVerifyOtp",
    "/user/registerPhone": "API_ENDPOINTS.user.registerPhone",
    "/user/registerPhone/verify": "API_ENDPOINTS.user.registerPhoneVerify",
    "/user/reset-password": "API_ENDPOINTS.user.resetPassword",
    "/user/verifyAddEmail": "API_ENDPOINTS.user.verifyAddEmail",
    "/user/verifyAddPhone": "API_ENDPOINTS.user.verifyAddPhone",
    "/invoices": "API_ENDPOINTS.invoices.list",
    "/invoices/tax-report": "API_ENDPOINTS.invoices.taxReport",
    "/invoices/tax-report/csv": "API_ENDPOINTS.invoices.taxReportCsv",
    "/referral/discount-status": "API_ENDPOINTS.referral.discountStatus",
    "/referral/earnings": "API_ENDPOINTS.referral.earnings",
    "/referral/leaderboard": "API_ENDPOINTS.referral.leaderboard",
    "/referral/list": "API_ENDPOINTS.referral.list",
    "/referral/my-code": "API_ENDPOINTS.referral.myCode",
    "/status/incidents": "API_ENDPOINTS.status.incidents",
    "/status/services": "API_ENDPOINTS.status.services",
    "/status/uptime": "API_ENDPOINTS.status.uptime",
    "/kb/articles?limit=20": "API_ENDPOINTS.kb.articles",
    "/kyc/submit": "API_ENDPOINTS.kyc.submit",
    "/notifications": "API_ENDPOINTS.notifications.list",
    "/notifications/read-all": "API_ENDPOINTS.notifications.readAll",
    "/products": "API_ENDPOINTS.products.list",
    "/userApi/customers": "API_ENDPOINTS.userApi.customers",
}

DYN_RULES = [
    (r'`/company/auto-convert/\$\{([^}]+)\}`', r"API_ENDPOINTS.company.autoConvert(\1)"),
    (r'`/company/webhook-history/\$\{([^}]+?)\}/detail/\$\{([^}]+?)\}`',
     r"API_ENDPOINTS.company.webhookHistoryDetail(\1, \2)"),
    (r'`/company/webhook-history/\$\{([^}]+?)\}\?page=1&limit=20\$\{([^}]+?)\}`',
     r"API_ENDPOINTS.company.webhookHistory(\1, \2)"),
    (r'`/company/webhook-settings/\$\{([^}]+)\}`', r"API_ENDPOINTS.company.webhookSettings(\1)"),
    (r'`/company/webhook-stats/\$\{([^}]+?)\}\?days=30`', r"API_ENDPOINTS.company.webhookStats(\1)"),
    (r'`/company/webhook-test/\$\{([^}]+)\}`', r"API_ENDPOINTS.company.webhookTest(\1)"),
    (r'`/invoices/\$\{([^}]+?)\}/pdf`', r"API_ENDPOINTS.invoices.pdf(\1)"),
    (r'`/kb/articles/\$\{([^}]+?)\}/feedback`', r"API_ENDPOINTS.kb.articleFeedback(\1)"),
    (r'`/kb/articles/\$\{([^}]+)\}`', r"API_ENDPOINTS.kb.article(\1)"),
    (r'`/kb/search\?q=\$\{([^}]+?)\}&limit=20`', r"API_ENDPOINTS.kb.search(\1)"),
    (r'`/notifications/\$\{([^}]+?)\}/read`', r"API_ENDPOINTS.notifications.markRead(\1)"),
    (r'`/pay/campaign/\$\{([^}]+?)\}/tiers`', r"API_ENDPOINTS.pay.campaignTiers(\1)"),
    (r'`/pay/campaign/\$\{([^}]+?)\}/updates`', r"API_ENDPOINTS.pay.campaignUpdates(\1)"),
    (r'`/pay/campaign/\$\{([^}]+?)\}/wall\?limit=100&sort=recent`', r"API_ENDPOINTS.pay.campaignWall(\1)"),
    (r'`/pay/contribution/\$\{([^}]+?)\}/reply`', r"API_ENDPOINTS.pay.contributionReply(\1)"),
    (r'`/pay/links/\$\{([^}]+)\}`', r"API_ENDPOINTS.pay.link(\1)"),
    (r'`/pay/tier/\$\{([^}]+)\}`', r"API_ENDPOINTS.pay.tier(\1)"),
    (r'`/pay/update/\$\{([^}]+)\}`', r"API_ENDPOINTS.pay.update(\1)"),
    (r'`/products/\$\{([^}]+)\}`', r"API_ENDPOINTS.products.byId(\1)"),
    (r'`/transactions/\$\{([^}]+?)\}/invoice`', r"API_ENDPOINTS.transactions.invoice(\1)"),
    (r'`/userApi/customer/\$\{([^}]+)\}`', r"API_ENDPOINTS.userApi.customer(\1)"),
    (r'`/wallet/updateWallet/\$\{([^}]+)\}`', r"API_ENDPOINTS.wallet.updateWallet(\1)"),
]
DYN_RULES = [(re.compile(p), r) for p, r in DYN_RULES]


def capture_arg(text, start):
    i = start
    n = len(text)
    while i < n and text[i] in " \t\n":
        i += 1
    if i >= n or text[i] not in "\"'`":
        return None, None, None
    quote = text[i]
    j = i + 1
    depth = 0
    while j < n:
        c = text[j]
        if c == "\\":
            j += 2
            continue
        if quote == "`" and c == "$" and j + 1 < n and text[j + 1] == "{":
            depth += 1
        elif quote == "`" and c == "}" and depth > 0:
            depth -= 1
        elif c == quote and depth == 0:
            return text[i + 1:j], i, j + 1  # inner, quote_start, end_after_quote
        j += 1
    return None, None, None


def migrate_static(text):
    repls = []  # (start, end, expr)
    for m in CALL_RE.finditer(text):
        inner, qstart, qend = capture_arg(text, m.end())
        if inner is None:
            continue
        if inner in STATIC_MAP:
            repls.append((qstart, qend, STATIC_MAP[inner]))
    for qstart, qend, expr in sorted(repls, key=lambda r: r[0], reverse=True):
        text = text[:qstart] + expr + text[qend:]
    return text, len(repls)


def add_import(text):
    if 'from "@/api/endpoints"' in text:
        return text
    lines = text.split("\n")
    last = -1
    for i, line in enumerate(lines):
        s = line.strip()
        if s.startswith("import ") and s.endswith(";"):
            last = i
    lines.insert(last + 1 if last >= 0 else 0, IMPORT_LINE)
    return "\n".join(lines)


def main():
    tot_files = tot_static = tot_dyn = 0
    for d in SCAN:
        for base, _, files in os.walk(os.path.join(ROOT, d)):
            if "node_modules" in base:
                continue
            for fn in files:
                if not fn.endswith((".ts", ".tsx")):
                    continue
                path = os.path.join(base, fn)
                with open(path, encoding="utf-8") as f:
                    text = f.read()
                orig = text
                dyn_n = 0
                for rx, rep in DYN_RULES:
                    text, k = rx.subn(rep, text)
                    dyn_n += k
                text, stat_n = migrate_static(text)
                if text != orig:
                    text = add_import(text)
                    with open(path, "w", encoding="utf-8") as f:
                        f.write(text)
                    tot_files += 1
                    tot_static += stat_n
                    tot_dyn += dyn_n
                    print(f"{os.path.relpath(path, ROOT)}: {stat_n} static, {dyn_n} dynamic")
    print(f"\nTOTAL: {tot_static} static + {tot_dyn} dynamic across {tot_files} files")


if __name__ == "__main__":
    main()
