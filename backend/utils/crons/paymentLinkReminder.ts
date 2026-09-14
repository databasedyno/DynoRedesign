/**
 * Payment Link Reminder Cron
 * Schedule: Every hour (`0 * * * *`)
 *
 * For every `tbl_payment_link` row in `pending` status with an email + no
 * unsubscribe, send tiered reminders based on the link's expiry window
 * (24h / 7d / 30d / no-expiry) — 3 reminders total per link, deduped via
 * dedicated `reminder_1_sent_at` / `reminder_2_sent_at` / `final_reminder_sent_at`
 * timestamps on the row. Extracted from `utils/cronJobs.ts` (2026-08-23n)
 * so cronJobs stays under the file-size baseline.
 */
import cron from "node-cron";
import { cronLogger, log } from "../loggers";
import { captureError } from "../../services/errorMonitoringService";

export const setupPaymentLinkReminderCron = () => {
  // Run every hour
  cron.schedule("0 * * * *", async () => {
    log("Payment Link Reminder Cron Job starting...", "info");

    try {
      const { sendPaymentLinkReminderEmail } = await import("../../helper");
      const { paymentLinkModel, companyModel, userModel } = await import("../../models");
      const { resolveCustomerLanguage } = await import("../emailI18n");
      const { Op } = await import("sequelize");
      // Buyer language is not captured on a pending link, so reminders follow the
      // merchant's account language (their customers are usually in the same locale).
      const merchantLangCache = new Map<number, string | null>();
      const merchantLang = async (userId: number | null | undefined): Promise<string | null> => {
        if (!userId) return null;
        if (!merchantLangCache.has(userId)) {
          const u = await userModel.findByPk(userId, { attributes: ["language"] });
          merchantLangCache.set(userId, (u as { language?: string | null } | null)?.language ?? null);
        }
        return merchantLangCache.get(userId) ?? null;
      };

      const now = new Date();

      // Find all pending payment links with email that:
      // 1. Have status = 'pending'
      // 2. Have an email address
      // 3. Are not expired (or have no expiry)
      // 4. Have not been unsubscribed
      const pendingLinks = await paymentLinkModel.findAll({
        where: {
          status: 'pending',
          email: { [Op.not]: null },
          unsubscribed_at: null,
          [Op.or]: [
            { expires_at: null },
            { expires_at: { [Op.gt]: now } },
          ],
        },
      });

      log(`Found ${pendingLinks.length} pending payment links to check for reminders`, "info");

      let remindersSent = 0;

      for (const link of pendingLinks) {
        try {
          const linkData = link.dataValues;
          const createdAt = new Date(linkData.createdAt);
          const expiresAt = linkData.expires_at ? new Date(linkData.expires_at) : null;

          // Calculate hours/days since creation
          const hoursSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
          const daysSinceCreation = Math.floor(hoursSinceCreation / 24);

          // Determine expiry type
          let expiryType: '24h' | '7d' | '30d' | 'none' = 'none';
          if (expiresAt) {
            const totalHours = Math.floor((expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
            if (totalHours <= 25) expiryType = '24h';
            else if (totalHours <= 168 + 1) expiryType = '7d'; // 7 days
            else expiryType = '30d';
          }

          let reminderType: 'reminder1' | 'reminder2' | 'final' | null = null;
          let reminderColumn: string | null = null;

          // Determine which reminder to send based on expiry type and time elapsed
          switch (expiryType) {
            case '24h':
              // 6h, 18h, 23h
              if (hoursSinceCreation >= 23 && !linkData.final_reminder_sent_at) {
                reminderType = 'final';
                reminderColumn = 'final_reminder_sent_at';
              } else if (hoursSinceCreation >= 18 && !linkData.reminder_2_sent_at) {
                reminderType = 'reminder2';
                reminderColumn = 'reminder_2_sent_at';
              } else if (hoursSinceCreation >= 6 && !linkData.reminder_1_sent_at) {
                reminderType = 'reminder1';
                reminderColumn = 'reminder_1_sent_at';
              }
              break;

            case '7d':
              // Day 2, Day 5, Day 7
              if (daysSinceCreation >= 6 && !linkData.final_reminder_sent_at) {
                reminderType = 'final';
                reminderColumn = 'final_reminder_sent_at';
              } else if (daysSinceCreation >= 5 && !linkData.reminder_2_sent_at) {
                reminderType = 'reminder2';
                reminderColumn = 'reminder_2_sent_at';
              } else if (daysSinceCreation >= 2 && !linkData.reminder_1_sent_at) {
                reminderType = 'reminder1';
                reminderColumn = 'reminder_1_sent_at';
              }
              break;

            case '30d':
              // Day 7, Day 21, Day 29
              if (daysSinceCreation >= 29 && !linkData.final_reminder_sent_at) {
                reminderType = 'final';
                reminderColumn = 'final_reminder_sent_at';
              } else if (daysSinceCreation >= 21 && !linkData.reminder_2_sent_at) {
                reminderType = 'reminder2';
                reminderColumn = 'reminder_2_sent_at';
              } else if (daysSinceCreation >= 7 && !linkData.reminder_1_sent_at) {
                reminderType = 'reminder1';
                reminderColumn = 'reminder_1_sent_at';
              }
              break;

            case 'none':
              // Day 7, Day 30, Day 60
              if (daysSinceCreation >= 60 && !linkData.final_reminder_sent_at) {
                reminderType = 'final';
                reminderColumn = 'final_reminder_sent_at';
              } else if (daysSinceCreation >= 30 && !linkData.reminder_2_sent_at) {
                reminderType = 'reminder2';
                reminderColumn = 'reminder_2_sent_at';
              } else if (daysSinceCreation >= 7 && !linkData.reminder_1_sent_at) {
                reminderType = 'reminder1';
                reminderColumn = 'reminder_1_sent_at';
              }
              break;
          }

          if (reminderType && reminderColumn) {
            // Get company name
            let companyName = "Dynopay Merchant";
            if (linkData.company_id) {
              const company = await companyModel.findByPk(linkData.company_id);
              if (company) {
                companyName = (company as { company_name?: string }).company_name || companyName;
              }
            }

            // Generate unsubscribe token if not exists
            let unsubscribeToken = linkData.unsubscribe_token;
            if (!unsubscribeToken) {
              const crypto = await import("crypto");
              unsubscribeToken = crypto.randomBytes(32).toString('hex');
              await paymentLinkModel.update(
                { unsubscribe_token: unsubscribeToken },
                { where: { link_id: linkData.link_id } }
              );
            }

            // Send reminder email
            await sendPaymentLinkReminderEmail(
              linkData.email,
              companyName,
              String(linkData.base_amount),
              linkData.base_currency,
              linkData.description,
              linkData.payment_link,
              expiresAt,
              reminderType,
              unsubscribeToken,
              resolveCustomerLanguage({ checkoutLang: linkData.default_language, merchantLang: await merchantLang(linkData.user_id) })
            );

            // Mark reminder as sent
            await paymentLinkModel.update(
              { [reminderColumn]: now },
              { where: { link_id: linkData.link_id } }
            );

            remindersSent++;
            log(`Sent ${reminderType} to ${linkData.email} for payment link ${linkData.link_id} (${expiryType} expiry)`, "info");
          }
        } catch (linkError: unknown) {
          const err = linkError as { message?: string };
          log(`Error processing payment link ${link.dataValues.link_id}: ${err.message}`, "error");
        }
      }

      log(`Payment Link Reminder Cron completed: ${remindersSent} reminders sent`, "info");

    } catch (e: unknown) {
      const err = e as { message?: string };
      log(`Payment Link Reminder Cron Job Error: ${err.message}`, "error");
      cronLogger?.error?.("Payment Link Reminder Cron Error", {}, new Error(err.message));
      captureError(e, 'cron', { extraContext: 'setupPaymentLinkReminderCron' });
    }
  });

  log("Payment Link Reminder Cron Job scheduled for every hour", "info");
};

/**
 * Manually trigger payment link reminders (for testing)
 */
export const triggerPaymentLinkReminders = async () => {
  log("Manually triggering Payment Link Reminders...", "info");

  await import("../../helper");
  const { paymentLinkModel } = await import("../../models");
  const { Op } = await import("sequelize");

  const now = new Date();

  const pendingLinks = await paymentLinkModel.findAll({
    where: {
      status: 'pending',
      email: { [Op.not]: null },
      unsubscribed_at: null,
      [Op.or]: [
        { expires_at: null },
        { expires_at: { [Op.gt]: now } },
      ],
    },
  });

  const results = {
    total: pendingLinks.length,
    reminders_sent: 0,
    skipped_no_reminder_due: 0,
    details: [] as Array<Record<string, unknown>>,
  };

  for (const link of pendingLinks) {
    const linkData = link.dataValues;
    const createdAt = new Date(linkData.createdAt);
    const expiresAt = linkData.expires_at ? new Date(linkData.expires_at) : null;

    const hoursSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    const daysSinceCreation = Math.floor(hoursSinceCreation / 24);

    // Determine expiry type
    let expiryType: '24h' | '7d' | '30d' | 'none' = 'none';
    if (expiresAt) {
      const totalHours = Math.floor((expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
      if (totalHours <= 25) expiryType = '24h';
      else if (totalHours <= 168 + 1) expiryType = '7d';
      else expiryType = '30d';
    }

    results.details.push({
      link_id: linkData.link_id,
      email: linkData.email,
      expiry_type: expiryType,
      hours_since_creation: hoursSinceCreation,
      days_since_creation: daysSinceCreation,
      reminder_1_sent: !!linkData.reminder_1_sent_at,
      reminder_2_sent: !!linkData.reminder_2_sent_at,
      final_reminder_sent: !!linkData.final_reminder_sent_at,
    });
  }

  return results;
};
