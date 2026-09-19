/**
 * SafeDeal maintenance cron — hourly: auto-release elapsed inspection timers,
 * auto-escalate stale disputes, send once-only reminders. Same gating as the
 * other utils/crons setups (registered from server.ts on the primary worker).
 */
import cron from "node-cron";
import { cronLogger, log } from "../loggers";
import { captureError } from "../../services/errorMonitoringService";

export const setupSafeDealMaintenanceCron = () => {
  // Boot: make sure Dynopay signs SafeDeal's webhooks with our secret (API-key merchant integration).
  setTimeout(() => {
    import("../../services/safedeal/safedealCheckout").then((m) => m.syncSafeDealApiKey()).catch((e) => log(`SafeDeal API key sync error: ${e}`, "error"));
  }, 15000);
  cron.schedule("7 * * * *", async () => {
    try {
      const { runSafeDealMaintenance } = await import("../../services/safedeal/safedealReminders");
      const r = await runSafeDealMaintenance();
      const sent = Object.values(r.reminders).reduce((n, ids) => n + ids.length, 0);
      if (r.auto_release.length || r.escalated.length || sent || r.parked_released) {
        cronLogger.info(`[SafeDealMaintenance] auto-released ${r.auto_release.length}, escalated ${r.escalated.length}, reminders ${sent}, parked payouts released ${r.parked_released}`);
      }
    } catch (e) {
      log(`SafeDeal Maintenance Cron Error: ${e}`, "error");
      captureError(e, "cron", { extraContext: "setupSafeDealMaintenanceCron" });
    }
  });
  log("SafeDeal Maintenance Cron Job scheduled hourly (auto-release, auto-escalate, reminders)", "info");
};
