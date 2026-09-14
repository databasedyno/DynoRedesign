/**
 * Side-effect-free check for the referral ACCRUAL ALERT email.
 * In preview DISABLE_OUTBOUND_EMAIL=true, so mailTransporter must SUPPRESS the
 * send (no real Brevo call) while the email path still composes a valid subject.
 * NO DB writes, NO real email.
 */
import { sendReferralAccrualEmail } from "../services/email/referralEmails";

(async () => {
  // eslint-disable-next-line no-console
  console.log("DISABLE_OUTBOUND_EMAIL =", process.env.DISABLE_OUTBOUND_EMAIL);
  await sendReferralAccrualEmail("[email protected]", "Test Referrer", 1.23, "Acme Store", 4.56);
  // eslint-disable-next-line no-console
  console.log("RESULT: sendReferralAccrualEmail completed without throwing");
  process.exit(0);
})();
