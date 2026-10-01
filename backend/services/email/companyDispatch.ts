/**
 * companyDispatch — central fan-out for MERCHANT-facing (company-scoped) emails.
 *
 * Wraps the existing per-template send functions so an operational email
 * (payments / payouts / orders / digests) is delivered to the company
 * notification address AND any team members who hold the relevant permission,
 * de-duplicated case-insensitively (see utils/notificationRecipients).
 *
 * Safety contract (money-path adjacent):
 *   - No companyId               -> legacy single send to the owner fallback.
 *   - Resolver returns recipients -> send to each (deduped); one failure never
 *                                    blocks the others.
 *   - Resolver returns []:
 *       • category EXPLICITLY disabled by the merchant -> suppress (respect it).
 *       • otherwise (resolver miss / error)            -> fall back to owner so
 *         a critical email is never silently dropped.
 *   - CUSTOMER-facing emails (payer receipts, payment-failed-to-customer) must
 *     NOT use this helper — they go to the buyer, never the company/team.
 */
import {
  resolveCompanyRecipients,
  isCategoryDisabled,
  NotificationCategory,
  Recipient,
} from "../../utils/notificationRecipients";
import { apiLogger } from "../../utils/loggers";

export async function dispatchCompanyEmail(
  companyId: number | null | undefined,
  category: NotificationCategory,
  fallback: { email?: string | null; name?: string | null },
  sendOne: (email: string, name: string) => Promise<unknown>,
): Promise<{ attempted: number; succeeded: number }> {
  const cid = companyId ? Number(companyId) : 0;
  const fallbackName = fallback.name || "there";

  // Track delivery so callers can seal a dedup key ONLY after a confirmed send.
  // Contract with sendOne: it resolves a TRUTHY value on success (Brevo response
  // or {suppressed:true} on a preview pod) and a FALSY value (undefined) when it
  // swallowed a send error; a thrown error is also treated as a failure.
  let attempted = 0;
  let succeeded = 0;
  const sendTo = async (email: string, name: string) => {
    attempted++;
    try {
      const r = await sendOne(email, name);
      if (r === undefined || r === null || r === false) {
        apiLogger.error(`[companyDispatch] send reported failure to ${email} (category=${category})`);
      } else {
        succeeded++;
      }
    } catch (e) {
      apiLogger.error(`[companyDispatch] send failed to ${email} (category=${category})`, e);
    }
  };

  // No company scope — preserve the legacy single send.
  if (!cid) {
    if (fallback.email) await sendTo(fallback.email, fallbackName);
    return { attempted, succeeded };
  }

  let recipients: Recipient[] = [];
  let resolverErrored = false;
  try {
    recipients = await resolveCompanyRecipients(cid, category);
  } catch (e) {
    resolverErrored = true;
    apiLogger.error(`[companyDispatch] resolveCompanyRecipients failed (company=${cid}, category=${category})`, e);
  }

  if (recipients.length > 0) {
    for (const r of recipients) await sendTo(r.email, r.name);
    return { attempted, succeeded };
  }

  // Empty list: suppress only when the merchant EXPLICITLY disabled this
  // category; any other reason (resolver error, missing company) falls back to
  // the owner so we never silently drop a critical operational email.
  if (!resolverErrored) {
    try {
      if (await isCategoryDisabled(cid, category)) {
        apiLogger.info(`[companyDispatch] category '${category}' disabled for company ${cid} — suppressed`);
        return { attempted, succeeded };
      }
    } catch (e) {
      apiLogger.error(`[companyDispatch] isCategoryDisabled failed (company=${cid})`, e);
    }
  }
  if (fallback.email) await sendTo(fallback.email, fallbackName);
  return { attempted, succeeded };
}

export default { dispatchCompanyEmail };
