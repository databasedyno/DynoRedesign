#!/usr/bin/env python3
"""
Wider Primitive Rollout — clipboard wave.

Routes every ad-hoc `navigator.clipboard(.|?.)writeText(...)` call through the
robust `copyToClipboard` helper (async Clipboard API + execCommand fallback for
non-secure / iframe / unfocused contexts). Fixes the fire-and-forget bug class
flagged in REFACTOR_PLAN.md.

Excludes files that define their OWN `copyToClipboard` (blind replace would
recurse / collide): pages/pay/demo.tsx and CleanCheckoutV2.tsx.
"""

import os

ROOT = os.path.join(os.path.dirname(__file__), "..")

FILES = [
    "Components/Layout/ReferralAndKnowledge/index.tsx",
    "Components/Modals/ExitIntentModal.tsx",
    "Components/Page/API/ApiKeysPage.tsx",
    "Components/Page/API/BuyButtonsSection.tsx",
    "Components/Page/API/PublishableKeysSection.tsx",
    "Components/Page/API/WebhookConsoleSection.tsx",
    "Components/Page/CreatePaymentLink/index.tsx",
    "Components/Page/Creator/HandleQrCode.tsx",
    "Components/Page/Dashboard/CreatorPageCard.tsx",
    "Components/Page/Home/v3/TryItNowV3.tsx",
    "Components/Page/Pay3Components/bankTransferCompo.tsx",
    "Components/Page/Pay3Components/campaign/CampaignShareTray.tsx",
    "Components/Page/Pay3Components/cryptoTransfer.tsx",
    "Components/Page/Payment/CryptoComponent.tsx",
    "Components/Page/Shop/ShopHero.tsx",
    "Components/Page/Transactions/TransactionDetailsModal.tsx",
    "Components/Page/Wallet/index.tsx",
    "Components/UI/ApiKeysModel/SuccessAPIModel/index.tsx",
    "Components/UI/CompanySettingsDialog/WebhookNotificationsSection.tsx",
    "Components/UI/MobileReferralBanner/index.tsx",
    "Components/UI/OverPayment/Index.tsx",
    "Components/UI/TransferExpectedCard/Index.tsx",
    "Components/UI/UnderPayment/Index.tsx",
    "pages/QA.tsx",
    "pages/admin/fee.tsx",
    "pages/documentation.tsx",
    "pages/order/[publicRef].tsx",
    "pages/pay/index.tsx",
    "pages/referrals.tsx",
]

IMPORT_LINE = 'import copyToClipboard from "@/helpers/copyToClipboard";'


def add_import(text: str) -> str:
    if "copyToClipboard" in text and "@/helpers/copyToClipboard" in text:
        return text  # already imports it
    lines = text.split("\n")
    last_import_idx = -1
    for i, line in enumerate(lines):
        s = line.strip()
        if s.startswith("import ") and s.endswith(";"):
            last_import_idx = i
    if last_import_idx == -1:
        # fall back: after a leading "use client" / directive if present, else top
        insert_at = 0
        for i, line in enumerate(lines[:3]):
            if line.strip().startswith(('"use', "'use")):
                insert_at = i + 1
        lines.insert(insert_at, IMPORT_LINE)
    else:
        lines.insert(last_import_idx + 1, IMPORT_LINE)
    return "\n".join(lines)


def main() -> None:
    for rel in FILES:
        path = os.path.join(ROOT, rel)
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        orig = text
        n = text.count("navigator.clipboard.writeText(") + text.count("navigator.clipboard?.writeText(")
        text = text.replace("navigator.clipboard.writeText(", "copyToClipboard(")
        text = text.replace("navigator.clipboard?.writeText(", "copyToClipboard(")
        if text != orig:
            text = add_import(text)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"{rel}: {n} call(s) migrated")


if __name__ == "__main__":
    main()
