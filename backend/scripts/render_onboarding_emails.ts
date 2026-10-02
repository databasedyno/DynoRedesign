/**
 * QA: render the onboarding emails added 2026-10 to EMAIL_DUMP_DIR (nothing sent).
 *   cd backend && EMAIL_DUMP_DIR=/tmp/onb_emails DISABLE_OUTBOUND_EMAIL=true \
 *     node_modules/.bin/ts-node --transpile-only scripts/render_onboarding_emails.ts [companyId] [userId]
 */
import "dotenv/config";
import { deliverBrandWelcome } from "../services/email/brandWelcomeScheduler";
import { sendBrandWelcomeEmail } from "../services/email/companyEmails";
import { sendEmailCodesEnabledEmail } from "../services/email/securityEmails";
import { connectRedis, deleteRedisItem } from "../utils/redisInstance";

const main = async () => {
  const companyId = Number(process.argv[2] || 0);
  const userId = Number(process.argv[3] || 0);
  await connectRedis();
  await sendBrandWelcomeEmail("qa_render@example.com", "Mark Kane", "Northwind Studio", { hasWallet: false }, "en");
  await sendBrandWelcomeEmail("qa_render@example.com", "Mark Kane", "Northwind Studio", { hasWallet: true }, "de");
  await sendEmailCodesEnabledEmail("qa_render@example.com", "Mark Kane", "en");
  if (companyId && userId) {
    await deleteRedisItem(`brand_welcome_sent:${companyId}`);
    console.log("live delivery:", await deliverBrandWelcome({ userId, companyId }));
    await deleteRedisItem(`brand_welcome_sent:${companyId}`);
  }
  process.exit(0);
};
main().catch((e) => { console.error(e); process.exit(1); });
