#!/usr/bin/env python3
"""Wire a per-action hero icon (and the CTAs flagged by the 2026-09 email audit) into every
email builder. Re-runnable: skips calls that already carry a hero argument."""
import re
from pathlib import Path

EMAIL_DIR = Path(__file__).resolve().parents[1] / "services" / "email"

# function -> hero icon name (public/email/hero/<name>.png)
HERO = {
    # account & security
    "sendWelcomeEmail": "rocket", "sendVolumeTierUpgradeEmail": "trophy", "sendEmailVerificationOTPEmail": "mail",
    "sendLoginOTPEmail": "key", "sendPasswordChangedEmail": "lock", "sendUserProfileUpdatedEmail": "person",
    "sendCreatorHandleUpdatedEmail": "person", "sendSecurityAlertEmail": "shield-alert", "sendLoginNotificationEmail": "device",
    "sendFailedLoginAttemptsEmail": "danger", "sendActivationEmail": "rocket",
    # brand / team
    "sendCompanyProfileCreatedEmail": "store", "sendCompanyContactWelcomeEmail": "store", "sendCompanyProfileUpdatedEmail": "store",
    "sendTeamMemberJoinedEmail": "team",
    # wallet
    "sendWalletUpdateOTPEmail": "lock", "sendWalletSudoOTPEmail": "lock", "sendWalletBatchSummaryEmail": "wallet",
    "sendWalletDeletedEmail": "wallet-red", "sendAddWalletReminderEmail": "wallet", "sendWalletAddedEmail": "wallet-green",
    "sendWalletUpdatedEmail": "wallet", "sendWithdrawalOTPEmail": "lock", "sendWithdrawalSuccessEmail": "payout",
    "sendExchangeOTPEmail": "lock", "sendWalletDeleteOTPEmail": "lock-red", "sendWalletEditOTPEmail": "lock",
    # developer & billing
    "sendWeeklySummaryEmail": "chart", "sendInvoiceGeneratedEmail": "receipt", "sendApiKeyCreatedEmail": "key",
    "sendSubscriptionCreatedEmail": "receipt", "sendSubscriptionCancelledEmail": "expired", "sendSubscriptionPaymentFailedEmail": "danger",
    # links & campaigns
    "sendPaymentLinkCreatedEmail": "link", "sendCrowdfundingCampaignCreatedEmail": "campaign", "sendCrowdfundingUpdateEmail": "campaign",
    "sendRefereeCodeReminderEmail": "gift", "sendRefereeInviteEmail": "gift", "sendPaymentLinkReminderEmail": "link",
    # payments (merchant)
    "sendPaymentReceivedEmail": "check", "sendPaymentPendingEmail": "hourglass", "sendPaymentConfirmingEmail": "hourglass",
    "sendTransactionConfirmedEmail": "check", "sendPaymentPartialEmail": "alert", "sendPaymentPartialExpiredEmail": "expired",
    "sendPaymentFailedEmail": "danger", "sendCustomerPaymentConfirmationEmail": "check",
    # conversions
    "sendAutoConversionPayoutEmail": "swap", "sendWeeklyConversionSummaryEmail": "chart",
    # kyc
    "sendKYCRequiredEmail": "id-card", "sendKYCApprovedEmail": "id-card-green", "sendKYCRejectedEmail": "id-card-red",
    "sendKYCStartedEmail": "id-card", "sendKYCResubmissionRequiredEmail": "id-card-red",
    # referrals
    "sendReferralPayoutReadyEmail": "gift", "sendReferralAutoPayEnabledEmail": "gift", "sendReferralPayoutRequestedEmail": "payout",
    "sendReferralPayoutFailedEmail": "danger", "sendReferralAccrualEmail": "gift", "sendReferralActivatedEmail": "gift",
    "sendReferralMonthlyDigestEmail": "chart", "sendReferralShareNudgeEmail": "gift",
    # orders
    "sendOrderReceiptEmail": "receipt", "sendOrderReceiptMerchantEmail": "bag", "sendOrderExpiredEmail": "expired",
    "sendOrderRefundedEmail": "refund", "sendOrderShippedEmail": "truck", "sendDigitalDownloadReminderEmail": "download",
    # admin ops
    "sendLargeTransactionAlertEmail": "alert", "sendWebhookDisabledEmail": "webhook", "sendWebhookRedirectEmail": "webhook",
    "sendAdminFeeReceivedEmail": "check", "sendAdminFeeSweepEmail": "payout", "sendTreasuryLowAlertEmail": "danger",
}

# Audit items #2/#3: emails that dead-ended with no CTA -> (button text i18n key, path, default text)
ADD_CTA = {
    "sendPaymentPendingEmail": ("paymentReceived.cta", "/transactions"),
    "sendPaymentConfirmingEmail": ("paymentReceived.cta", "/transactions"),
    "sendTransactionConfirmedEmail": ("paymentReceived.cta", "/transactions"),
    "sendPaymentPartialEmail": ("paymentReceived.cta", "/transactions"),
    "sendPaymentPartialExpiredEmail": ("paymentReceived.cta", "/transactions"),
    "sendAutoConversionPayoutEmail": ("withdrawalSuccess.cta", "/transactions"),
    "sendWeeklyConversionSummaryEmail": ("weeklySummary.cta", "/dashboard"),
}

TEMPLATES = ("dynoPayEmailTemplate", "dynoPayGreetingTemplate")
FUNC_RE = re.compile(r"^export const (send\w+) = async", re.M)


def split_args(s: str):
    """Split a call's argument text on top-level commas (handles (), {}, [], quotes, template literals)."""
    args, depth, buf, i, quote = [], 0, "", 0, None
    while i < len(s):
        c = s[i]
        if quote:
            buf += c
            if c == "\\":
                buf += s[i + 1]; i += 1
            elif c == quote:
                quote = None
            elif quote == "`" and c == "$" and s[i + 1] == "{":
                # template expression: copy until the matching brace
                d = 0
                while True:
                    i += 1; ch = s[i]; buf += ch
                    if ch == "{": d += 1
                    elif ch == "}":
                        d -= 1
                        if d == 0: break
        elif c in "\"'`":
            quote = c; buf += c
        elif c in "([{":
            depth += 1; buf += c
        elif c in ")]}":
            depth -= 1; buf += c
        elif c == "," and depth == 0:
            args.append(buf.strip()); buf = ""
        else:
            buf += c
        i += 1
    if buf.strip():
        args.append(buf.strip())
    return args


def find_call(src: str, start: int, name: str):
    """Return (open_idx, close_idx) of the first `name(` call after start, balancing parens/strings."""
    idx = src.find(name + "(", start)
    if idx < 0:
        return None
    i = idx + len(name) + 1
    depth, quote = 1, None
    while i < len(src):
        c = src[i]
        if quote:
            if c == "\\": i += 1
            elif c == quote: quote = None
        elif c in "\"'`": quote = c
        elif c == "(": depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return idx + len(name) + 1, i
        i += 1
    return None


def process(path: Path) -> int:
    src = path.read_text(encoding="utf-8")
    funcs = [(m.group(1), m.start()) for m in FUNC_RE.finditer(src)]
    edits = []
    for n, (fname, fstart) in enumerate(funcs):
        fend = funcs[n + 1][1] if n + 1 < len(funcs) else len(src)
        icon = HERO.get(fname)
        if not icon:
            continue
        pos = fstart
        while True:
            hit = None
            for tpl in TEMPLATES:
                h = find_call(src, pos, tpl)
                if h and h[0] < fend and (hit is None or h[0] < hit[1][0]):
                    hit = (tpl, h)
            if not hit:
                break
            tpl, (o, c) = hit
            args = split_args(src[o:c])
            if any(a.startswith("'") and a.strip("'") in HERO.values() for a in args) or any("hero" in a for a in args):
                pos = c + 1; continue
            if tpl == "dynoPayEmailTemplate":
                # (heading, content, showButton, buttonText, buttonLink, preheader, lang, hero)
                defaults = ["false", '""', '""', '""', "undefined"]
                while len(args) < 7:
                    args.append(defaults[len(args) - 2])
                cta = ADD_CTA.get(fname)
                if cta and args[2] == "false":
                    lang_var = args[6] if args[6] != "undefined" else "undefined"
                    args[2], args[3], args[4] = "true", f"t('merchant.{cta[0]}', {lang_var})" if cta[0].startswith(("withdrawalSuccess", "weeklySummary")) else f"t('{cta[0]}', {lang_var})", f"`${{FRONTEND_BASE_URL}}{cta[1]}`"
                args = args[:7] + [f"'{icon}'"]
            else:
                # (name, message, heading, showImage, lang, preheader, hero, cta)
                defaults = ["false", "undefined", "undefined"]
                while len(args) < 6:
                    args.append(defaults[len(args) - 3])
                args = args[:6] + [f"'{icon}'"]
            edits.append((o, c, ", ".join(args)))
            pos = c + 1
    for o, c, text in sorted(edits, reverse=True):
        src = src[:o] + text + src[c:]
    if edits:
        path.write_text(src, encoding="utf-8")
    return len(edits)


def main() -> None:
    total = 0
    for f in sorted(EMAIL_DIR.glob("*.ts")):
        if f.name == "emailShared.ts":
            continue
        n = process(f)
        total += n
        print(f"{f.name}: {n} call(s) wired")
    print("total", total)


if __name__ == "__main__":
    main()
