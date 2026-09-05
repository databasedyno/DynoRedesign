#!/usr/bin/env python3
"""Part 2 — wire preheaders into all locale-driven email builders.
Idempotent-ish: asserts each target appears exactly once before replacing.
Run: python3 scripts/apply_part2_wiring.py   (from backend/)
"""
import sys, pathlib

BASE = pathlib.Path(__file__).resolve().parent.parent  # backend/

EDITS = [
    # ---------- paymentEmails.ts ----------
    ("services/email/paymentEmails.ts",
     """    const html = dynoPayEmailTemplate(
      isContribution ? t('contributionReceived.heading', L) : t('paymentReceived.heading', L),
      content,
      true,
      isContribution ? t('contributionReceived.cta', L) : t('paymentReceived.cta', L),
      `${FRONTEND_BASE_URL}/transactions`
    );""",
     """    const html = dynoPayEmailTemplate(
      isContribution ? t('contributionReceived.heading', L) : t('paymentReceived.heading', L),
      content,
      true,
      isContribution ? t('contributionReceived.cta', L) : t('paymentReceived.cta', L),
      `${FRONTEND_BASE_URL}/transactions`,
      isContribution ? t('contributionReceived.preheader', L) : t('paymentReceived.preheader', L)
    );"""),

    ("services/email/paymentEmails.ts",
     "    const html = dynoPayEmailTemplate(t('paymentPending.heading', L), content);",
     "    const html = dynoPayEmailTemplate(t('paymentPending.heading', L), content, false, \"\", \"\", t('paymentPending.preheader', L));"),

    ("services/email/paymentEmails.ts",
     "    const html = dynoPayEmailTemplate(t('paymentConfirming.heading', L), htmlContent);",
     "    const html = dynoPayEmailTemplate(t('paymentConfirming.heading', L), htmlContent, false, \"\", \"\", t('paymentConfirming.preheader', L));"),

    ("services/email/paymentEmails.ts",
     "    const html = dynoPayEmailTemplate(t('transactionConfirmed.heading', L, { status }), content);",
     "    const html = dynoPayEmailTemplate(t('transactionConfirmed.heading', L, { status }), content, false, \"\", \"\", t('transactionConfirmed.preheader', L));"),

    ("services/email/paymentEmails.ts",
     "    const html = dynoPayEmailTemplate(t('paymentPartial.heading', L), content);",
     "    const html = dynoPayEmailTemplate(t('paymentPartial.heading', L), content, false, \"\", \"\", t('paymentPartial.preheader', L));"),

    ("services/email/paymentEmails.ts",
     "    const html = dynoPayEmailTemplate(heading, content);",
     "    const html = dynoPayEmailTemplate(heading, content, false, \"\", \"\", isCompleted ? t('paymentPartialExpired.preheaderCompleted', L) : t('paymentPartialExpired.preheaderExpired', L));"),

    ("services/email/paymentEmails.ts",
     "    const customerHtml = dynoPayEmailTemplate(t('paymentFailed.heading', CL), customerContent);",
     "    const customerHtml = dynoPayEmailTemplate(t('paymentFailed.heading', CL), customerContent, false, \"\", \"\", t('paymentFailed.preheader', CL));"),

    ("services/email/paymentEmails.ts",
     "      const merchantHtml = dynoPayEmailTemplate(t('paymentFailed.merchantHeading', ML), merchantContent, true, t('paymentFailed.cta', ML), `${FRONTEND_BASE_URL}/transactions`);",
     "      const merchantHtml = dynoPayEmailTemplate(t('paymentFailed.merchantHeading', ML), merchantContent, true, t('paymentFailed.cta', ML), `${FRONTEND_BASE_URL}/transactions`, t('paymentFailed.merchantPreheader', ML));"),

    # ---------- accountEmails.ts ----------
    ("services/email/accountEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.welcome.heading', L), content, true, t('merchant.welcome.cta', L), `${FRONTEND_BASE_URL}/dashboard`);",
     "    const html = dynoPayEmailTemplate(t('merchant.welcome.heading', L), content, true, t('merchant.welcome.cta', L), `${FRONTEND_BASE_URL}/dashboard`, t('merchant.welcome.preheader', L));"),

    ("services/email/accountEmails.ts",
     """    const html = dynoPayEmailTemplate(
      t('merchant.volumeTierUpgrade.heading', L, { newTier, newPercent }),
      content,
      true,
      t('merchant.volumeTierUpgrade.cta', L),
      `${FRONTEND_BASE_URL}/dashboard`
    );""",
     """    const html = dynoPayEmailTemplate(
      t('merchant.volumeTierUpgrade.heading', L, { newTier, newPercent }),
      content,
      true,
      t('merchant.volumeTierUpgrade.cta', L),
      `${FRONTEND_BASE_URL}/dashboard`,
      t('merchant.volumeTierUpgrade.preheader', L, { newPercent })
    );"""),

    ("services/email/accountEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.emailVerifyOtp.heading', L), content);",
     "    const html = dynoPayEmailTemplate(t('merchant.emailVerifyOtp.heading', L), content, false, \"\", \"\", t('merchant.emailVerifyOtp.preheader', L));"),

    ("services/email/accountEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.loginOtp.heading', L), content);",
     "    const html = dynoPayEmailTemplate(t('merchant.loginOtp.heading', L), content, false, \"\", \"\", t('merchant.loginOtp.preheader', L));"),

    ("services/email/accountEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.passwordChanged.heading', L), content, true, t('merchant.passwordChanged.cta', L), `${FRONTEND_BASE_URL}/settings`);",
     "    const html = dynoPayEmailTemplate(t('merchant.passwordChanged.heading', L), content, true, t('merchant.passwordChanged.cta', L), `${FRONTEND_BASE_URL}/settings`, t('merchant.passwordChanged.preheader', L));"),

    ("services/email/accountEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.profileUpdated.heading', L), content, true, t('merchant.profileUpdated.cta', L), `${FRONTEND_BASE_URL}/profile`);",
     "    const html = dynoPayEmailTemplate(t('merchant.profileUpdated.heading', L), content, true, t('merchant.profileUpdated.cta', L), `${FRONTEND_BASE_URL}/profile`, t('merchant.profileUpdated.preheader', L));"),

    ("services/email/accountEmails.ts",
     "      const oldEmailHtml = dynoPayEmailTemplate(t('merchant.profileUpdated.emailChangedHeading', L), content2, true, t('merchant.profileUpdated.emailChangedCta', L), `${FRONTEND_BASE_URL}/help-support`);",
     "      const oldEmailHtml = dynoPayEmailTemplate(t('merchant.profileUpdated.emailChangedHeading', L), content2, true, t('merchant.profileUpdated.emailChangedCta', L), `${FRONTEND_BASE_URL}/help-support`, t('merchant.profileUpdated.emailChangedPreheader', L));"),

    ("services/email/accountEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.securityAlert.heading', L), content, true, t('merchant.securityAlert.cta', L), `${FRONTEND_BASE_URL}/settings`);",
     "    const html = dynoPayEmailTemplate(t('merchant.securityAlert.heading', L), content, true, t('merchant.securityAlert.cta', L), `${FRONTEND_BASE_URL}/settings`, t('merchant.securityAlert.preheader', L));"),

    ("services/email/accountEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.loginNotification.heading', L), content, true, t('merchant.loginNotification.cta', L), secureAccountUrl);",
     "    const html = dynoPayEmailTemplate(t('merchant.loginNotification.heading', L), content, true, t('merchant.loginNotification.cta', L), secureAccountUrl, t('merchant.loginNotification.preheader', L));"),

    ("services/email/accountEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.failedLogins.heading', L), content, true, t('merchant.failedLogins.cta', L), `${FRONTEND_BASE_URL}/auth/login`);",
     "    const html = dynoPayEmailTemplate(t('merchant.failedLogins.heading', L), content, true, t('merchant.failedLogins.cta', L), `${FRONTEND_BASE_URL}/auth/login`, t('merchant.failedLogins.preheader', L));"),

    # ---------- companyEmails.ts ----------
    ("services/email/companyEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.companyCreated.heading', L), content, true, t('merchant.companyCreated.cta', L), `${FRONTEND_BASE_URL}/wallet`);",
     "    const html = dynoPayEmailTemplate(t('merchant.companyCreated.heading', L), content, true, t('merchant.companyCreated.cta', L), `${FRONTEND_BASE_URL}/wallet`, t('merchant.companyCreated.preheader', L));"),

    ("services/email/companyEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.companyContactWelcome.heading', L), content, true, t('merchant.companyContactWelcome.cta', L), `${FRONTEND_BASE_URL}`);",
     "    const html = dynoPayEmailTemplate(t('merchant.companyContactWelcome.heading', L), content, true, t('merchant.companyContactWelcome.cta', L), `${FRONTEND_BASE_URL}`, t('merchant.companyContactWelcome.preheader', L));"),

    ("services/email/companyEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.companyUpdated.heading', L), content, true, t('merchant.companyUpdated.cta', L), `${FRONTEND_BASE_URL}/company`);",
     "    const html = dynoPayEmailTemplate(t('merchant.companyUpdated.heading', L), content, true, t('merchant.companyUpdated.cta', L), `${FRONTEND_BASE_URL}/company`, t('merchant.companyUpdated.preheader', L));"),

    # ---------- kycEmails.ts ----------
    ("services/email/kycEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.kycApproved.heading', L), content, true, t('merchant.kycApproved.cta', L), `${FRONTEND_BASE_URL}/dashboard`);",
     "    const html = dynoPayEmailTemplate(t('merchant.kycApproved.heading', L), content, true, t('merchant.kycApproved.cta', L), `${FRONTEND_BASE_URL}/dashboard`, t('merchant.kycApproved.preheader', L));"),

    ("services/email/kycEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.kycRejected.heading', L), content, true, t('merchant.kycRejected.cta', L), `${FRONTEND_BASE_URL}/dashboard`);",
     "    const html = dynoPayEmailTemplate(t('merchant.kycRejected.heading', L), content, true, t('merchant.kycRejected.cta', L), `${FRONTEND_BASE_URL}/dashboard`, t('merchant.kycRejected.preheader', L));"),

    ("services/email/kycEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.kycStarted.heading', L), content, true, t('merchant.kycStarted.cta', L), verificationUrl);",
     "    const html = dynoPayEmailTemplate(t('merchant.kycStarted.heading', L), content, true, t('merchant.kycStarted.cta', L), verificationUrl, t('merchant.kycStarted.preheader', L));"),

    ("services/email/kycEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.kycResubmission.heading', L), content, true, t('merchant.kycResubmission.cta', L), `${FRONTEND_BASE_URL}/dashboard`);",
     "    const html = dynoPayEmailTemplate(t('merchant.kycResubmission.heading', L), content, true, t('merchant.kycResubmission.cta', L), `${FRONTEND_BASE_URL}/dashboard`, t('merchant.kycResubmission.preheader', L));"),

    # ---------- conversionEmails.ts ----------
    ("services/email/conversionEmails.ts",
     "    const htmlBody = dynoPayEmailTemplate(t('merchant.autoConversion.heading', L), `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}\\n${htmlContent}`);",
     "    const htmlBody = dynoPayEmailTemplate(t('merchant.autoConversion.heading', L), `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}\\n${htmlContent}`, false, \"\", \"\", t('merchant.autoConversion.preheader', L));"),

    ("services/email/conversionEmails.ts",
     "    const htmlBody = dynoPayEmailTemplate(t('merchant.weeklyConversion.heading', L), `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}\\n${htmlContent}`);",
     "    const htmlBody = dynoPayEmailTemplate(t('merchant.weeklyConversion.heading', L), `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}\\n${htmlContent}`, false, \"\", \"\", t('merchant.weeklyConversion.preheader', L));"),

    # ---------- customerReceiptEmail.ts ----------
    ("services/email/customerReceiptEmail.ts",
     """    const html = dynoPayEmailTemplate(
      isContribution
        ? t('contributionThankYou.heading', L, { campaignName })
        : t('customerPaymentConfirmation.heading', L),
      content
    );""",
     """    const html = dynoPayEmailTemplate(
      isContribution
        ? t('contributionThankYou.heading', L, { campaignName })
        : t('customerPaymentConfirmation.heading', L),
      content,
      false,
      "",
      "",
      isContribution ? t('contributionThankYou.preheader', L) : t('customerPaymentConfirmation.preheader', L)
    );"""),

    # ---------- billingReportEmails.ts ----------
    ("services/email/billingReportEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.weeklySummary.heading', L), content, true, t('merchant.weeklySummary.cta', L), `${FRONTEND_BASE_URL}/dashboard`);",
     "    const html = dynoPayEmailTemplate(t('merchant.weeklySummary.heading', L), content, true, t('merchant.weeklySummary.cta', L), `${FRONTEND_BASE_URL}/dashboard`, t('merchant.weeklySummary.preheader', L));"),

    ("services/email/billingReportEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.invoice.heading', L), content, true, t('merchant.invoice.cta', L), invoiceData.invoice_url);",
     "    const html = dynoPayEmailTemplate(t('merchant.invoice.heading', L), content, true, t('merchant.invoice.cta', L), invoiceData.invoice_url, t('merchant.invoice.preheader', L));"),

    ("services/email/billingReportEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.apiKey.heading', L), content, true, t('merchant.apiKey.cta', L), `${FRONTEND_BASE_URL}/developer-keys`);",
     "    const html = dynoPayEmailTemplate(t('merchant.apiKey.heading', L), content, true, t('merchant.apiKey.cta', L), `${FRONTEND_BASE_URL}/developer-keys`, t('merchant.apiKey.preheader', L));"),

    ("services/email/billingReportEmails.ts",
     "    const customerHtml = dynoPayEmailTemplate(t('merchant.subscriptionCreated.custHeading', CL), customerContent);",
     "    const customerHtml = dynoPayEmailTemplate(t('merchant.subscriptionCreated.custHeading', CL), customerContent, false, \"\", \"\", t('merchant.subscriptionCreated.custPreheader', CL));"),

    ("services/email/billingReportEmails.ts",
     "    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionCreated.merchHeading', ML), merchantContent, true, t('merchant.subscriptionCreated.cta', ML), `${FRONTEND_BASE_URL}/dashboard`);",
     "    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionCreated.merchHeading', ML), merchantContent, true, t('merchant.subscriptionCreated.cta', ML), `${FRONTEND_BASE_URL}/dashboard`, t('merchant.subscriptionCreated.merchPreheader', ML));"),

    ("services/email/billingReportEmails.ts",
     "    const customerHtml = dynoPayEmailTemplate(t('merchant.subscriptionCancelled.heading', CL), customerContent);",
     "    const customerHtml = dynoPayEmailTemplate(t('merchant.subscriptionCancelled.heading', CL), customerContent, false, \"\", \"\", t('merchant.subscriptionCancelled.custPreheader', CL));"),

    ("services/email/billingReportEmails.ts",
     "    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionCancelled.heading', ML), merchantContent, true, t('merchant.subscriptionCancelled.cta', ML), `${FRONTEND_BASE_URL}/dashboard`);",
     "    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionCancelled.heading', ML), merchantContent, true, t('merchant.subscriptionCancelled.cta', ML), `${FRONTEND_BASE_URL}/dashboard`, t('merchant.subscriptionCancelled.merchPreheader', ML));"),

    ("services/email/billingReportEmails.ts",
     "    const customerHtml = dynoPayEmailTemplate(t('merchant.subscriptionPaymentFailed.custHeading', CL), customerContent, true, t('merchant.subscriptionPaymentFailed.custCta', CL), `${FRONTEND_BASE_URL}/dashboard`);",
     "    const customerHtml = dynoPayEmailTemplate(t('merchant.subscriptionPaymentFailed.custHeading', CL), customerContent, true, t('merchant.subscriptionPaymentFailed.custCta', CL), `${FRONTEND_BASE_URL}/dashboard`, t('merchant.subscriptionPaymentFailed.custPreheader', CL));"),

    ("services/email/billingReportEmails.ts",
     "    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionPaymentFailed.merchHeading', ML), merchantContent, true, t('merchant.subscriptionPaymentFailed.merchCta', ML), `${FRONTEND_BASE_URL}/dashboard`);",
     "    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionPaymentFailed.merchHeading', ML), merchantContent, true, t('merchant.subscriptionPaymentFailed.merchCta', ML), `${FRONTEND_BASE_URL}/dashboard`, t('merchant.subscriptionPaymentFailed.merchPreheader', ML));"),

    # ---------- linkCampaignEmails.ts ----------
    ("services/email/linkCampaignEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.paymentLinkCreated.heading', L), content, true, t('merchant.paymentLinkCreated.cta', L), paymentLink);",
     "    const html = dynoPayEmailTemplate(t('merchant.paymentLinkCreated.heading', L), content, true, t('merchant.paymentLinkCreated.cta', L), paymentLink, t('merchant.paymentLinkCreated.preheader', L));"),

    ("services/email/linkCampaignEmails.ts",
     "    const html = dynoPayEmailTemplate(t('merchant.crowdfundingCreated.heading', L), content, true, t('merchant.crowdfundingCreated.cta', L), campaignLink);",
     "    const html = dynoPayEmailTemplate(t('merchant.crowdfundingCreated.heading', L), content, true, t('merchant.crowdfundingCreated.cta', L), campaignLink, t('merchant.crowdfundingCreated.preheader', L));"),

    ("services/email/linkCampaignEmails.ts",
     """    const html = dynoPayEmailTemplate(
      t('contributor.crowdfundingUpdate.heading', L, { campaign: safeCampaign }),
      content,
      true,
      t('contributor.crowdfundingUpdate.cta', L),
      campaignLink
    );""",
     """    const html = dynoPayEmailTemplate(
      t('contributor.crowdfundingUpdate.heading', L, { campaign: safeCampaign }),
      content,
      true,
      t('contributor.crowdfundingUpdate.cta', L),
      campaignLink,
      t('contributor.crowdfundingUpdate.preheader', L, { campaign: safeCampaign })
    );"""),

    # ---------- payoutDigestService.ts (also fixes missing lang on chrome) ----------
    ("services/payoutDigestService.ts",
     """    const html = baseEmailTemplate(heading, content, {
      showButton: true,
      buttonText: t("payoutDigest.openDashboard", lang),
      buttonLink: `${FRONTEND_BASE_URL}/dashboard`,
    });""",
     """    const html = baseEmailTemplate(heading, content, {
      lang,
      preheader: d.hasActivity
        ? t("payoutDigest.preheaderActive", lang)
        : t("payoutDigest.preheaderQuiet", lang),
      showButton: true,
      buttonText: t("payoutDigest.openDashboard", lang),
      buttonLink: `${FRONTEND_BASE_URL}/dashboard`,
    });"""),
]

def main():
    failures = []
    applied = 0
    for rel, old, new in EDITS:
        fp = BASE / rel
        text = fp.read_text()
        n = text.count(old)
        if n != 1:
            failures.append((rel, n, old.splitlines()[0][:80]))
            continue
        fp.write_text(text.replace(old, new))
        applied += 1
    print(f"applied={applied} total={len(EDITS)} failures={len(failures)}")
    for rel, n, snippet in failures:
        print(f"  FAIL count={n} {rel} :: {snippet}")
    return 1 if failures else 0

if __name__ == "__main__":
    sys.exit(main())
