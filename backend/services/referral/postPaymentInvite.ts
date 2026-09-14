/**
 * REAL-TIME post-payment referee invite (extracted from referralService.ts to
 * keep that file under the 500-line R2 budget — strangler pattern).
 *
 * Called from the settlement path the moment a customer's payment is confirmed,
 * so a paying customer who left an email is invited the instant they pay instead
 * of waiting up to 24h for the sweep cron. Fully deduplicated + idempotent via
 * the same guards the cron uses (checkEmailHasAccount / checkRefereeCodeSent /
 * createRefereeCode). Swallows every error — a referral side-effect must NEVER
 * fail a settlement. Sending is gated by DISABLE_OUTBOUND_EMAIL (mailTransporter).
 *
 * The referral helpers are pulled via a lazy require to avoid an import cycle
 * with referralService.ts (which re-exports this function).
 */
import { apiLogger } from "../../utils/loggers";

export const maybeSendPostPaymentInvite = async (params: {
  email?: string | null;
  companyId?: number | null;
  userId?: number | null;
}): Promise<void> => {
  try {
    const email = String(params.email || "").toLowerCase().trim();
    if (!email || !params.companyId || !params.userId) return;

    // Skip synthetic/internal placeholder emails (same exclusions as the cron SQL).
    if (
      email.endsWith("@dynopay.internal") ||
      email.endsWith("@dynopay.local") ||
      email.startsWith("legacy-api-") ||
      email.startsWith("pk-buyer-") ||
      email.startsWith("elements-buyer-") ||
      email.startsWith("recovered-")
    ) {
      return;
    }

    // Lazy require breaks the referralService <-> postPaymentInvite import cycle.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { checkEmailHasAccount, checkRefereeCodeSent, createRefereeCode } = require("../referralService");

    if (await checkEmailHasAccount(email)) return;
    if (await checkRefereeCodeSent(email)) return;

    const code = await createRefereeCode({
      customerEmail: email,
      referrerCompanyId: Number(params.companyId),
      referrerUserId: Number(params.userId),
    });

    if (code) {
      const { sendRefereeInviteEmail } = await import("../emailService");
      await sendRefereeInviteEmail(email, code.code, code.discount, code.duration, code.unsubscribeToken);
      apiLogger.info(`[RefereeInvite] real-time post-payment invite sent to ${email}`);
    }
  } catch (e) {
    apiLogger.error(`[RefereeInvite] real-time invite error: ${e}`);
  }
};

export default { maybeSendPostPaymentInvite };
