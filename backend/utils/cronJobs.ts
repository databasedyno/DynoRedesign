import cron from "node-cron";
import { QueryTypes } from "sequelize";
import sequelize from "./dbInstance";
import { createNotification, NOTIFICATION_TYPES } from "../controller";
import { notificationPreferencesModel, userTransactionModel } from "../models";
import { cronLogger, log } from "./loggers";
import { captureError } from "../services/errorMonitoringService";
// Unused imports removed from top level - dynamically imported where needed

/**
 * Weekly Summary Cron Job
 * Schedule: Every Monday at 9:00 AM UTC
 * Logic:
 * 1. Find users with weekly_summary = true in their preferences
 * 2. Aggregate past 7 days: transactions count, volume, fees
 * 3. Create notification record
 * 4. (Future: Send email with summary via Email Service)
 */
export const setupWeeklySummaryCron = () => {
  // Run every Monday at 9:00 AM UTC
  // Cron format: minute hour day-of-month month day-of-week
  // 0 9 * * 1 = At 09:00 on Monday
  cron.schedule("0 9 * * 1", async () => {
    log("Weekly Summary Cron Job starting...", "info");
    
    try {
      // Get date range for last 7 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      // Find all users with weekly_summary enabled
      const usersWithWeeklySummary = await sequelize.query(
        `SELECT DISTINCT np.user_id, np.company_id, u.name, u.email
         FROM tbl_notification_preferences np
         JOIN tbl_user u ON u.user_id = np.user_id
         WHERE np.weekly_summary = true`,
        { type: QueryTypes.SELECT }
      ) as Array<Record<string, unknown>>;

      log(`Found ${usersWithWeeklySummary.length} users with weekly summary enabled`, "info");

      for (const user of usersWithWeeklySummary) {
        try {
          // Get transaction summary for this user's company
          const summary = await sequelize.query(
            `SELECT 
              COUNT(*) as transaction_count,
              COALESCE(SUM(CASE WHEN status = 'done' THEN base_amount ELSE 0 END), 0) as total_volume,
              COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) as completed_count,
              COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
              COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed_count,
              (SELECT crypto_currency FROM tbl_user_transaction 
               WHERE company_id = :companyId AND status = 'done'
               AND crypto_currency IS NOT NULL AND crypto_currency <> ''
               AND "createdAt" >= :startDate AND "createdAt" <= :endDate
               GROUP BY crypto_currency ORDER BY COUNT(*) DESC LIMIT 1) as top_currency
             FROM tbl_user_transaction 
             WHERE company_id = :companyId 
             AND "createdAt" >= :startDate
             AND "createdAt" <= :endDate`,
            {
              replacements: { 
                companyId: user.company_id,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
              },
              type: QueryTypes.SELECT,
            }
          ) as Array<Record<string, unknown>>;

          const stats = summary[0] || {
            transaction_count: 0,
            total_volume: 0,
            completed_count: 0,
            pending_count: 0,
            failed_count: 0,
          };

          // Define interface for stats
          interface WeeklyStats {
            transaction_count: string | number;
            total_volume: string | number;
            completed_count: string | number;
            pending_count: string | number;
            failed_count: string | number;
            total_count?: string | number;
            top_currency?: string;
          }

          const typedStats = stats as unknown as WeeklyStats;

          // Create notification with summary data
          const notificationData = {
            period_start: startDate.toISOString().split('T')[0],
            period_end: endDate.toISOString().split('T')[0],
            transaction_count: parseInt(String(typedStats.transaction_count)),
            total_volume: parseFloat(String(typedStats.total_volume)),
            completed_count: parseInt(String(typedStats.completed_count)),
            pending_count: parseInt(String(typedStats.pending_count)),
            failed_count: parseInt(String(typedStats.failed_count)),
          };

          const title = "Your Weekly Summary";
          const totalVolume = parseFloat(String(typedStats.total_volume));
          const message = `This week you had ${typedStats.transaction_count} transactions with a total volume of $${toFixedStr(totalVolume, 2)}. ${typedStats.completed_count} completed, ${typedStats.pending_count} pending.`;

          await createNotification(
            Number(user.user_id),
            NOTIFICATION_TYPES.WEEKLY_SUMMARY,
            title,
            message,
            notificationData,
            Number(user.company_id)
          );

          log(`Weekly summary created for user ${user.user_id}`, "info");

          // Send weekly summary email
          try {
            const { sendWeeklySummaryEmail } = await import("../services/emailService");
            const periodStart = startDate.toISOString().split('T')[0];
            const periodEnd = endDate.toISOString().split('T')[0];
            await sendWeeklySummaryEmail(
              String(user.email),
              String(user.name || ''),
              periodStart,
              periodEnd,
              Number(typedStats.transaction_count || 0),
              toFixedStr(totalVolume, 2),
              Number(typedStats.completed_count || 0),
              Number(typedStats.pending_count || 0),
              String(typedStats.top_currency || "None")
            );
            log(`Weekly summary email sent to ${user.email}`, "info");
          } catch (emailError) {
            log(`Failed to send weekly summary email to ${user.email}: ${emailError}`, "error");
          }

        } catch (userError) {
          log(`Error creating weekly summary for user ${user.user_id}: ${userError}`, "error");
        }
      }

      log("Weekly Summary Cron Job completed", "info");
      
    } catch (e) {
      log(`Weekly Summary Cron Job Error: ${e}`, "error");
      cronLogger?.error?.("Weekly Summary Cron Error", {}, new Error(String(e)));
      captureError(e, 'cron', { extraContext: 'setupWeeklySummaryCron' });
    }
  });

  log("Weekly Summary Cron Job scheduled for every Monday at 9:00 AM UTC", "info");
};

/**
 * Trigger weekly summary manually (for testing)
 */
export const triggerWeeklySummary = async (userId?: number, options?: { dryRun?: boolean }) => {
  try {
    const dryRun = options?.dryRun === true;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    let users: Array<Record<string, unknown>>;

    if (userId) {
      // Get specific user
      users = await sequelize.query(
        `SELECT u.user_id, u.name, u.email, np.company_id
         FROM tbl_user u
         LEFT JOIN tbl_notification_preferences np ON np.user_id = u.user_id
         WHERE u.user_id = :userId`,
        { 
          replacements: { userId },
          type: QueryTypes.SELECT 
        }
      ) as Array<Record<string, unknown>>;
    } else {
      // Get all users with weekly summary enabled
      users = await sequelize.query(
        `SELECT DISTINCT np.user_id, np.company_id, u.name, u.email
         FROM tbl_notification_preferences np
         JOIN tbl_user u ON u.user_id = np.user_id
         WHERE np.weekly_summary = true`,
        { type: QueryTypes.SELECT }
      ) as Array<Record<string, unknown>>;
    }

    const results = [];

    for (const user of users) {
      const summary = await sequelize.query(
        `SELECT 
          COUNT(*) as transaction_count,
          COALESCE(SUM(CASE WHEN status = 'done' THEN base_amount ELSE 0 END), 0) as total_volume,
          COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) as completed_count,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
          COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed_count,
          (SELECT crypto_currency FROM tbl_user_transaction 
           WHERE user_id = :userId AND status = 'done'
           AND crypto_currency IS NOT NULL AND crypto_currency <> ''
           AND "createdAt" >= :startDate AND "createdAt" <= :endDate
           GROUP BY crypto_currency ORDER BY COUNT(*) DESC LIMIT 1) as top_currency
         FROM tbl_user_transaction 
         WHERE user_id = :userId 
         AND "createdAt" >= :startDate
         AND "createdAt" <= :endDate`,
        {
          replacements: { 
            userId: String(user.user_id), 
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          },
          type: QueryTypes.SELECT,
        }
      ) as Array<Record<string, unknown>>;

      const stats = summary[0];

      // Define interface for stats
      interface SummaryStats {
        transaction_count: string | number;
        total_volume: string | number;
        completed_count: string | number;
        pending_count: string | number;
        failed_count: string | number;
        top_currency?: string;
      }

      const typedStats = stats as unknown as SummaryStats;
      const totalVolume = parseFloat(String(typedStats.total_volume || 0));

      const notificationData = {
        period_start: startDate.toISOString().split('T')[0],
        period_end: endDate.toISOString().split('T')[0],
        transaction_count: parseInt(String(typedStats.transaction_count)),
        total_volume: totalVolume,
        completed_count: parseInt(String(typedStats.completed_count)),
        pending_count: parseInt(String(typedStats.pending_count)),
        failed_count: parseInt(String(typedStats.failed_count)),
        top_currency: String(typedStats.top_currency || 'None'),
      };

      // dryRun (used by the test harness against the LIVE prod DB) validates the
      // corrected summary query WITHOUT writing a notification row.
      const notification = dryRun
        ? null
        : await createNotification(
            Number(user.user_id),
            NOTIFICATION_TYPES.WEEKLY_SUMMARY,
            "Your Weekly Summary",
            `This week you had ${typedStats.transaction_count} transactions with a total volume of $${toFixedStr(totalVolume, 2)}.`,
            notificationData,
            Number(user.company_id)
          );

      results.push({
        user_id: user.user_id,
        dry_run: dryRun,
        notification,
        summary: notificationData,
      });
    }

    return results;

  } catch (e) {
    captureError(e, 'cron', { extraContext: 'triggerWeeklySummary' });
    throw e;
  }
};

/**
 * Wallet Reminder Cron Job
 * Schedule: Every hour
 * Logic:
 * 1. Find users who registered 24 hours ago
 * 2. Check if they have any wallet addresses
 * 3. If not, send wallet reminder email
 * 4. Mark as reminded to avoid duplicates
 */
export const setupWalletReminderCron = () => {
  // Run every hour
  // Cron format: minute hour day-of-month month day-of-week
  // 0 * * * * = At minute 0 of every hour
  cron.schedule("0 * * * *", async () => {
    log("Wallet Reminder Cron Job starting...", "info");
    
    try {
      // Get date 24 hours ago
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      
      // Get date 25 hours ago (1 hour window)
      const twentyFiveHoursAgo = new Date();
      twentyFiveHoursAgo.setHours(twentyFiveHoursAgo.getHours() - 25);

      // Find users who:
      // 1. Registered between 25-24 hours ago
      // 2. Have at least one company created
      // 3. Have no wallet addresses
      // 4. Haven't been reminded yet
      const usersWithoutWallets = await sequelize.query(
        `SELECT DISTINCT u.user_id, u.name, u.email, c.company_id, c.company_name,
                COALESCE(u.wallet_reminder_sent, false) as wallet_reminder_sent
         FROM tbl_user u
         LEFT JOIN tbl_company c ON c.user_id = u.user_id
         LEFT JOIN tbl_user_addresses wa ON wa.user_id = u.user_id AND wa.company_id = c.company_id
         WHERE u."createdAt" >= :twentyFiveHoursAgo
         AND u."createdAt" <= :twentyFourHoursAgo
         AND c.company_id IS NOT NULL
         AND wa.user_address_id IS NULL
         AND COALESCE(u.wallet_reminder_sent, false) = false`,
        {
          replacements: { 
            twentyFourHoursAgo: twentyFourHoursAgo.toISOString(),
            twentyFiveHoursAgo: twentyFiveHoursAgo.toISOString()
          },
          type: QueryTypes.SELECT
        }
      ) as Array<Record<string, unknown>>;

      log(`Found ${usersWithoutWallets.length} users without wallets to remind`, "info");

      for (const user of usersWithoutWallets) {
        try {
          // Send wallet reminder email
          const { sendAddWalletReminderEmail } = await import("../services/emailService");
          await sendAddWalletReminderEmail(String(user.email), String(user.name), String(user.company_name));

          // Mark user as reminded
          await sequelize.query(
            `UPDATE tbl_user SET wallet_reminder_sent = true WHERE user_id = :userId`,
            {
              replacements: { userId: user.user_id },
              type: QueryTypes.UPDATE
            }
          );

          log(`Wallet reminder sent to user ${user.user_id} (${user.email})`, "info");

        } catch (userError) {
          log(`Error sending wallet reminder to user ${user.user_id}: ${userError}`, "error");
        }
      }

      log("Wallet Reminder Cron Job completed", "info");
      
    } catch (e) {
      log(`Wallet Reminder Cron Job Error: ${e}`, "error");
      cronLogger?.error?.("Wallet Reminder Cron Error", {}, new Error(String(e)));
      captureError(e, 'cron', { extraContext: 'setupWalletReminderCron' });
    }
  });

  log("Wallet Reminder Cron Job scheduled for every hour", "info");
};

/**
 * Trigger wallet reminder manually (for testing)
 */
export const triggerWalletReminder = async (userId?: number) => {
  try {
    let users: Array<Record<string, unknown>>;

    if (userId) {
      // Get specific user
      users = await sequelize.query(
        `SELECT u.user_id, u.name, u.email, c.company_id, c.company_name
         FROM tbl_user u
         LEFT JOIN tbl_company c ON c.user_id = u.user_id
         LEFT JOIN tbl_user_addresses wa ON wa.user_id = u.user_id AND wa.company_id = c.company_id
         WHERE u.user_id = :userId
         AND c.company_id IS NOT NULL
         AND wa.user_address_id IS NULL`,
        { 
          replacements: { userId },
          type: QueryTypes.SELECT 
        }
      ) as Array<Record<string, unknown>>;
    } else {
      // Get all users without wallets (for testing)
      users = await sequelize.query(
        `SELECT DISTINCT u.user_id, u.name, u.email, c.company_id, c.company_name
         FROM tbl_user u
         LEFT JOIN tbl_company c ON c.user_id = u.user_id
         LEFT JOIN tbl_user_addresses wa ON wa.user_id = u.user_id AND wa.company_id = c.company_id
         WHERE c.company_id IS NOT NULL
         AND wa.user_address_id IS NULL
         LIMIT 10`,
        { type: QueryTypes.SELECT }
      ) as Array<Record<string, unknown>>;
    }

    const results = [];

    for (const user of users as Array<{ user_id: number; email: string; name: string; company_name: string }>) {
      const { sendAddWalletReminderEmail } = await import("../services/emailService");
      await sendAddWalletReminderEmail(user.email, user.name, user.company_name);

      results.push({
        user_id: user.user_id,
        email: user.email,
        company_name: user.company_name,
        reminder_sent: true
      });
    }

    return results;

  } catch (e) {
    captureError(e, 'cron', { extraContext: 'triggerWalletReminder' });
    throw e;
  }
};

/**
 * Infrastructure Health Check Cron Job
 * Schedule: Every 15 minutes (OPTIMIZED: was every-5-min, health rarely changes that fast)
 * Logic: Run health checks on all monitored services and store results
 * Savings: 288 to 96 runs/day, ~1440 to ~480 DB rows/day
 */
export const setupHealthCheckCron = () => {
  // OPTIMIZED: Reduced from */5 to */15 — 3x fewer DB writes, health status rarely changes in 5 min
  cron.schedule("*/15 * * * *", async () => {
    try {
      const monitoringService = require("../services/monitoringService").default;
      await monitoringService.runHealthChecks();
    } catch (e) {
      log(`Health Check Cron Job Error: ${e}`, "error");
      captureError(e, 'cron', { extraContext: 'setupHealthCheckCron' });
    }
  });

  // Prune health check records older than 7 days — runs daily at 3:00 AM UTC
  // Prevents unbounded tbl_service_health growth (~480 rows/day × 7 days = ~3,360 rows max)
  cron.schedule("0 3 * * *", async () => {
    try {
      const monitoringService = require("../services/monitoringService").default;
      await monitoringService.pruneOldHealthChecks();
    } catch (e) {
      log(`Health Check Pruning Error: ${e}`, "error");
      captureError(e, 'cron', { extraContext: 'pruneOldHealthChecks' });
    }
  });

  log("Health Check Cron Job scheduled for every 15 minutes", "info");
  log("Health Check Retention Cleanup scheduled daily at 3:00 AM UTC (7-day retention)", "info");

  // Session Cleanup - every 6 hours
  cron.schedule("0 */6 * * *", async () => {
    try {
      const { cleanupExpiredSessions } = require("../services/sessionService");
      const cleaned = await cleanupExpiredSessions();
      if (cleaned > 0) {
        cronLogger.info(`[SessionCleanup] Cleaned ${cleaned} expired sessions`);
      }
    } catch (e) {
      log(`Session Cleanup Error: ${e}`, "error");
      captureError(e, 'cron', { extraContext: 'cleanupExpiredSessions' });
    }
  });
  log("Session Cleanup Cron Job scheduled every 6 hours", "info");
};

/**
 * Referee Code Reminder Cron Job
 * Schedule: Daily at 10:00 AM UTC
 * Logic: Send weekly reminders to users with unused referee codes
 * - Week 1 (7 days): "Don't forget your offer"
 * - Week 2 (14 days): "Your discount is waiting"
 * - Week 3 (21 days): "Only X days left"
 * - Final (27 days): "Last chance - expires in 3 days"
 */
export const setupRefereeCodeReminderCron = () => {
  // Run daily at 10:00 AM UTC
  cron.schedule("0 10 * * *", async () => {
    log("Referee Code Reminder Cron Job starting...", "info");
    
    try {
      const { sendRefereeCodeReminderEmail } = await import("../helper");
      const { refereeCodeModel, userModel } = await import("../models");
      const { Op } = await import("sequelize");
      
      const now = new Date();
      
      // Find all active (sent) referee codes that:
      // 1. Are not expired
      // 2. Have not been unsubscribed
      // 3. Need a reminder based on their age
      const activeCodes = await refereeCodeModel.findAll({
        where: {
          status: 'sent',
          expires_at: { [Op.gt]: now },
          unsubscribed_at: null,
        },
      });
      
      log(`Found ${activeCodes.length} active referee codes to check for reminders`, "info");
      
      let remindersSent = 0;
      let skippedAlreadySignedUp = 0;
      
      for (const code of activeCodes) {
        try {
          const codeData = code.dataValues;
          const sentAt = new Date(codeData.sent_at);
          const expiresAt = new Date(codeData.expires_at);
          const daysSinceSent = Math.floor((now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24));
          const daysRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          // Check if user has already signed up with this email
          const existingUser = await userModel.findOne({
            where: { email: codeData.customer_email },
          });
          
          if (existingUser) {
            skippedAlreadySignedUp++;
            continue; // Skip - user already signed up
          }
          
          let reminderType: 'week1' | 'week2' | 'week3' | 'final' | null = null;
          let reminderColumn: string | null = null;
          
          // Determine which reminder to send based on days since sent
          if (daysSinceSent >= 27 && !codeData.final_reminder_sent_at) {
            reminderType = 'final';
            reminderColumn = 'final_reminder_sent_at';
          } else if (daysSinceSent >= 21 && !codeData.reminder_3_sent_at) {
            reminderType = 'week3';
            reminderColumn = 'reminder_3_sent_at';
          } else if (daysSinceSent >= 14 && !codeData.reminder_2_sent_at) {
            reminderType = 'week2';
            reminderColumn = 'reminder_2_sent_at';
          } else if (daysSinceSent >= 7 && !codeData.reminder_1_sent_at) {
            reminderType = 'week1';
            reminderColumn = 'reminder_1_sent_at';
          }
          
          if (reminderType && reminderColumn) {
            // Send reminder email
            await sendRefereeCodeReminderEmail(
              codeData.customer_email,
              codeData.code,
              Number(codeData.discount_percent),
              codeData.discount_duration_days,
              daysRemaining,
              reminderType,
              codeData.unsubscribe_token
            );
            
            // Mark reminder as sent
            await refereeCodeModel.update(
              { [reminderColumn]: now },
              { where: { code_id: codeData.code_id } }
            );
            
            remindersSent++;
            log(`Sent ${reminderType} reminder to ${codeData.customer_email} (code: ${codeData.code})`, "info");
          }
        } catch (codeError: unknown) {
          const err = codeError as { message?: string };
          log(`Error processing referee code ${code.dataValues.code}: ${err.message}`, "error");
        }
      }
      
      log(`Referee Code Reminder Cron completed: ${remindersSent} reminders sent, ${skippedAlreadySignedUp} skipped (already signed up)`, "info");
      
    } catch (e: unknown) {
      const err = e as { message?: string };
      log(`Referee Code Reminder Cron Job Error: ${err.message}`, "error");
      cronLogger?.error?.("Referee Code Reminder Cron Error", {}, new Error(err.message));
      captureError(e, 'cron', { extraContext: 'setupRefereeCodeReminderCron' });
    }
  });
  
  log("Referee Code Reminder Cron Job scheduled for daily at 10:00 AM UTC", "info");
};

/**
 * Manually trigger referee code reminders (for testing)
 */
export const triggerRefereeCodeReminders = async () => {
  log("Manually triggering Referee Code Reminders...", "info");
  
  const { sendRefereeCodeReminderEmail } = await import("../helper");
  const { refereeCodeModel, userModel } = await import("../models");
  const { Op } = await import("sequelize");
  
  const now = new Date();
  
  const activeCodes = await refereeCodeModel.findAll({
    where: {
      status: 'sent',
      expires_at: { [Op.gt]: now },
      unsubscribed_at: null,
    },
  });
  
  const results = {
    total: activeCodes.length,
    reminders_sent: 0,
    skipped_already_signed_up: 0,
    skipped_no_reminder_due: 0,
    details: [] as Array<Record<string, unknown>>,
  };
  
  for (const code of activeCodes) {
    const codeData = code.dataValues;
    const sentAt = new Date(codeData.sent_at);
    const expiresAt = new Date(codeData.expires_at);
    const daysSinceSent = Math.floor((now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check if user has already signed up
    const existingUser = await userModel.findOne({
      where: { email: codeData.customer_email },
    });
    
    if (existingUser) {
      results.skipped_already_signed_up++;
      results.details.push({
        email: codeData.customer_email,
        code: codeData.code,
        status: 'skipped_already_signed_up',
      });
      continue;
    }
    
    let reminderType: 'week1' | 'week2' | 'week3' | 'final' | null = null;
    let reminderColumn: string | null = null;
    
    if (daysSinceSent >= 27 && !codeData.final_reminder_sent_at) {
      reminderType = 'final';
      reminderColumn = 'final_reminder_sent_at';
    } else if (daysSinceSent >= 21 && !codeData.reminder_3_sent_at) {
      reminderType = 'week3';
      reminderColumn = 'reminder_3_sent_at';
    } else if (daysSinceSent >= 14 && !codeData.reminder_2_sent_at) {
      reminderType = 'week2';
      reminderColumn = 'reminder_2_sent_at';
    } else if (daysSinceSent >= 7 && !codeData.reminder_1_sent_at) {
      reminderType = 'week1';
      reminderColumn = 'reminder_1_sent_at';
    }
    
    if (reminderType && reminderColumn) {
      await sendRefereeCodeReminderEmail(
        codeData.customer_email,
        codeData.code,
        Number(codeData.discount_percent),
        codeData.discount_duration_days,
        daysRemaining,
        reminderType,
        codeData.unsubscribe_token
      );
      
      await refereeCodeModel.update(
        { [reminderColumn]: now },
        { where: { code_id: codeData.code_id } }
      );
      
      results.reminders_sent++;
      results.details.push({
        email: codeData.customer_email,
        code: codeData.code,
        reminder_type: reminderType,
        days_since_sent: daysSinceSent,
        days_remaining: daysRemaining,
        status: 'sent',
      });
    } else {
      results.skipped_no_reminder_due++;
      results.details.push({
        email: codeData.customer_email,
        code: codeData.code,
        days_since_sent: daysSinceSent,
        status: 'no_reminder_due',
      });
    }
  }
  
  return results;
};

// ============================================================
// Extracted crons (2026-08-23n) — kept re-exported from this file so
// external callers (routes, server bootstrap, tests) don't have to change
// import paths. The actual implementations live under `utils/crons/` so
// each stays comfortably under the 500-line file-size baseline.
// ============================================================
import {
  setupPaymentLinkReminderCron,
  triggerPaymentLinkReminders,
} from "./crons/paymentLinkReminder";
export { setupPaymentLinkReminderCron, triggerPaymentLinkReminders };
import {
  setupOnboardingMonitorCron,
  triggerOnboardingWalletNudge,
} from "./crons/onboardingMonitor";
export { setupOnboardingMonitorCron, triggerOnboardingWalletNudge };
import {
  setupFirstPaymentMonitorCron,
} from "./crons/firstPaymentMonitor";
import { toFixedStr } from "./money";
export { setupFirstPaymentMonitorCron };

export default {
  setupWeeklySummaryCron,
  triggerWeeklySummary,
  setupWalletReminderCron,
  triggerWalletReminder,
  setupHealthCheckCron,
  setupRefereeCodeReminderCron,
  triggerRefereeCodeReminders,
  setupPaymentLinkReminderCron,
  triggerPaymentLinkReminders,
  setupOnboardingMonitorCron,
  triggerOnboardingWalletNudge,
  setupFirstPaymentMonitorCron,
};
