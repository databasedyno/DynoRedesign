/**
 * Onboarding Monitor Cron (A + B) + manual wallet-nudge trigger.
 *
 * Schedule: Every hour at :15.
 *
 * (A) Stuck Detection:
 *   - Checks users registered in the last 72 hours
 *   - Determines which onboarding step they're stuck at
 *   - Sends admin email at tiered intervals (4h, 12h, 24h, 48h)
 *   - Redis dedup prevents duplicate notifications per step per tier
 *
 * (B) Completion Detection:
 *   - Checks if any recently-registered users have completed all onboarding steps
 *   - Sends admin email once per user when onboarding_complete flips to true
 *
 * (A2) User-facing wallet nudge:
 *   - When the ONLY step left is adding a payout wallet, emails the merchant a
 *     branded 1-tap CTA (14-day per-user Redis dedup so we never spam)
 *
 * Extracted from `utils/cronJobs.ts` (2026-08-23n) so cronJobs stays under
 * the file-size baseline.
 */
import cron from "node-cron";
import { QueryTypes } from "sequelize";
import sequelize from "../dbInstance";
import { log } from "../loggers";
import { captureError } from "../../services/errorMonitoringService";

export const setupOnboardingMonitorCron = () => {
  // Run every hour at minute 15
  cron.schedule("15 * * * *", async () => {
    log("Onboarding Monitor Cron starting...", "info");

    try {
      const { getRedisItem, setRedisItemWithTTL } = await import("../redisInstance");
      const { sendOnboardingStuckAdminEmail, sendOnboardingCompletedAdminEmail, sendAddWalletReminderEmail } = await import("../../services/emailService");

      // Fetch users registered in the last 72 hours
      const users = await sequelize.query<{
        user_id: number;
        name: string | null;
        email: string | null;
        mobile: string | null;
        email_verified: boolean;
        createdAt: string;
      }>(
        `SELECT user_id, name, email, mobile, email_verified, "createdAt"
         FROM tbl_user
         WHERE "createdAt" >= NOW() - INTERVAL '72 hours'
         ORDER BY "createdAt" DESC`,
        { type: QueryTypes.SELECT }
      );

      if (users.length === 0) {
        log("Onboarding Monitor: No recent users to check", "info");
        return;
      }

      log(`Onboarding Monitor: Checking ${users.length} users registered in last 72h`, "info");

      let stuckCount = 0;
      let completedCount = 0;

      for (const user of users) {
        try {
          const userId = user.user_id;
          const createdAt = new Date(user.createdAt);
          const hoursSinceReg = Math.floor((Date.now() - createdAt.getTime()) / 3600000);

          // Check onboarding steps
          const isEmailVerified = user.email_verified === true;

          // Company check
          const companyResult = await sequelize.query<{ company_id: number; company_name: string }>(
            `SELECT company_id, company_name FROM tbl_company WHERE user_id = :userId LIMIT 1`,
            { replacements: { userId }, type: QueryTypes.SELECT }
          );
          const hasCompany = companyResult.length > 0;
          const companyName = companyResult[0]?.company_name || null;

          // Wallet address check (crypto wallets with actual addresses)
          const walletResult = await sequelize.query<{ cnt: string }>(
            `SELECT COUNT(*) as cnt FROM (
               SELECT 1 FROM tbl_user_wallet
               WHERE user_id = :userId AND currency_type = 'CRYPTO'
                 AND wallet_address IS NOT NULL AND wallet_address != ''
               UNION ALL
               SELECT 1 FROM tbl_user_addresses WHERE user_id = :userId
             ) combined`,
            { replacements: { userId }, type: QueryTypes.SELECT }
          );
          const walletCount = parseInt(walletResult[0]?.cnt || "0");
          const hasWallet = walletCount > 0;

          const onboardingComplete = isEmailVerified && hasCompany && hasWallet;

          // ─── (B) Completion check ───
          if (onboardingComplete) {
            const completedKey = `onboarding-complete-notified:${userId}`;
            const alreadyNotified = await getRedisItem(completedKey);
            if (!alreadyNotified || Object.keys(alreadyNotified).length === 0) {
              await setRedisItemWithTTL(completedKey, { notified: true }, 30 * 86400); // 30-day dedup
              completedCount++;

              await sendOnboardingCompletedAdminEmail({
                user_id: userId,
                name: user.name,
                email: user.email,
                company_name: companyName,
                wallet_count: walletCount,
                registered_at: createdAt.toLocaleString("en-US", {
                  dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
                }) + " UTC",
                hours_to_complete: hoursSinceReg,
              });
            }
            continue; // Onboarding complete — no stuck check needed
          }

          // ─── (A) Stuck detection ───
          // Determine which step they're stuck at (first incomplete step)
          let stuckStep = "";
          const completedSteps: string[] = [];
          const pendingSteps: string[] = [];

          if (isEmailVerified) {
            completedSteps.push("Email Verified");
          } else {
            if (!stuckStep) stuckStep = "Email Verification";
            pendingSteps.push("Email Verification");
          }

          if (hasCompany) {
            completedSteps.push("Company Created");
          } else {
            if (!stuckStep) stuckStep = "Company Setup";
            pendingSteps.push("Company Setup");
          }

          if (hasWallet) {
            completedSteps.push("Wallet Address Configured");
          } else {
            if (!stuckStep) stuckStep = "Wallet Setup";
            pendingSteps.push("Wallet Setup");
          }

          // Tiered notification: send at 4h, 12h, 24h, 48h milestones
          const tiers = [
            { hours: 4, label: "4h" },
            { hours: 12, label: "12h" },
            { hours: 24, label: "24h" },
            { hours: 48, label: "48h" },
          ];

          // Find the highest tier the user qualifies for
          const applicableTier = tiers.filter(t => hoursSinceReg >= t.hours).pop();
          if (!applicableTier) continue; // Less than 4 hours — too early

          // ── (A2) User-facing "add your wallet" nudge ───────────────────
          // When the ONLY step left is adding a payout wallet (email verified +
          // account created), email the merchant a branded 1-tap CTA (→ /wallet)
          // so more of them finish onboarding. Once per user (14-day Redis
          // dedup) so we never spam. Independent of the admin tier dedup below.
          if (stuckStep === "Wallet Setup" && user.email) {
            const walletNudgeKey = `onboarding-wallet-nudge:${userId}`;
            const nudged = await getRedisItem(walletNudgeKey);
            if (!nudged || Object.keys(nudged).length === 0) {
              await setRedisItemWithTTL(walletNudgeKey, { nudged: true }, 14 * 86400);
              try {
                await sendAddWalletReminderEmail(
                  user.email,
                  user.name || "there",
                  companyName || "your account",
                );
                log(`Onboarding Monitor: wallet nudge emailed to user ${userId} (${user.email})`, "info");
              } catch (nudgeErr) {
                log(`Onboarding Monitor: wallet nudge email failed for user ${userId}: ${nudgeErr}`, "error");
              }
            }
          }

          const stuckKey = `onboarding-stuck:${userId}:${applicableTier.label}`;
          const alreadyNotified = await getRedisItem(stuckKey);
          if (alreadyNotified && Object.keys(alreadyNotified).length > 0) continue; // Already sent for this tier

          // Mark as notified for this tier (TTL = 7 days)
          await setRedisItemWithTTL(stuckKey, { notified: true, step: stuckStep }, 7 * 86400);
          stuckCount++;

          await sendOnboardingStuckAdminEmail({
            user_id: userId,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            registered_at: createdAt.toLocaleString("en-US", {
              dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
            }) + " UTC",
            hours_since_registration: hoursSinceReg,
            stuck_step: stuckStep,
            completed_steps: completedSteps,
            pending_steps: pendingSteps,
          });

        } catch (userErr) {
          log(`Onboarding Monitor: Error checking user ${user.user_id}: ${userErr}`, "error");
        }
      }

      log(`Onboarding Monitor completed: ${stuckCount} stuck notifications, ${completedCount} completion notifications`, "info");

    } catch (e) {
      log(`Onboarding Monitor Error: ${e}`, "error");
      captureError(e, 'cron', { extraContext: 'setupOnboardingMonitorCron' });
    }
  });

  log("Onboarding Monitor Cron scheduled for every hour at :15", "info");
};

/**
 * Manually trigger the onboarding "add your wallet" nudge (for testing / ops).
 * dryRun=true (default) returns the exact cohort that WOULD be nudged WITHOUT
 * sending any email — safe to run against production. Set dryRun=false to
 * actually send (respects the same 14-day per-user Redis dedup as the cron).
 */
export const triggerOnboardingWalletNudge = async (dryRun = true) => {
  const { getRedisItem, setRedisItemWithTTL } = await import("../redisInstance");
  const { sendAddWalletReminderEmail } = await import("../../services/emailService");

  const users = await sequelize.query<{
    user_id: number;
    name: string | null;
    email: string | null;
    email_verified: boolean;
    createdAt: string;
  }>(
    `SELECT user_id, name, email, email_verified, "createdAt"
     FROM tbl_user
     WHERE "createdAt" >= NOW() - INTERVAL '72 hours'
     ORDER BY "createdAt" DESC`,
    { type: QueryTypes.SELECT }
  );

  const results = {
    dryRun,
    checked: users.length,
    would_nudge: [] as Array<Record<string, unknown>>,
    sent: 0,
    skipped_already_nudged: 0,
  };

  for (const user of users) {
    const userId = user.user_id;
    // Wallet Setup cohort = email verified + has account + NO payout wallet.
    if (!user.email || user.email_verified !== true) continue;
    const hoursSinceReg = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 3600000);
    if (hoursSinceReg < 4) continue;

    const companyResult = await sequelize.query<{ company_id: number; company_name: string }>(
      `SELECT company_id, company_name FROM tbl_company WHERE user_id = :userId LIMIT 1`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    if (companyResult.length === 0) continue; // still at Company Setup, not Wallet
    const companyName = companyResult[0]?.company_name || "your account";

    const walletResult = await sequelize.query<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM (
         SELECT 1 FROM tbl_user_wallet
         WHERE user_id = :userId AND currency_type = 'CRYPTO'
           AND wallet_address IS NOT NULL AND wallet_address != ''
         UNION ALL
         SELECT 1 FROM tbl_user_addresses WHERE user_id = :userId
       ) combined`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    if (parseInt(walletResult[0]?.cnt || "0") > 0) continue; // has a wallet — done

    const walletNudgeKey = `onboarding-wallet-nudge:${userId}`;
    const nudged = await getRedisItem(walletNudgeKey);
    const alreadyNudged = Boolean(nudged && Object.keys(nudged).length > 0);

    results.would_nudge.push({
      user_id: userId,
      email: user.email,
      company_name: companyName,
      hours_since_reg: hoursSinceReg,
      already_nudged: alreadyNudged,
    });

    if (alreadyNudged) {
      results.skipped_already_nudged++;
    } else if (!dryRun) {
      await setRedisItemWithTTL(walletNudgeKey, { nudged: true }, 14 * 86400);
      await sendAddWalletReminderEmail(user.email, user.name || "there", companyName);
      results.sent++;
    }
  }

  return results;
};
