import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import serviceHealthModel from "../models/serviceHealthModel";
import { getRedisItem } from "../utils/redisInstance";
import { log } from "../utils/loggers";

/**
 * Infrastructure Monitoring Service
 * Performs real health checks on Dynopay services and stores results
 */

interface HealthCheckResult {
  healthy: boolean;
  latency: number;
  error?: string;
}

// Service definitions with actual health check implementations
const MONITORED_SERVICES = [
  {
    id: "api_gateway",
    name: "API Gateway",
    check: async (): Promise<HealthCheckResult> => {
      const start = Date.now();
      try {
        // Check if database connection is working (core API dependency)
        await sequelize.query("SELECT 1", { type: QueryTypes.SELECT });
        return { healthy: true, latency: Date.now() - start };
      } catch (error: unknown) {
        return { healthy: false, latency: Date.now() - start, error: (error as { message?: string }).message };
      }
    }
  },
  {
    id: "payment_processing",
    name: "Payment Processing",
    check: async (): Promise<HealthCheckResult> => {
      const start = Date.now();
      try {
        // Lightweight accessibility probe — `SELECT 1 ... LIMIT 1` stops at the
        // first row, so it stays fast regardless of table size. (A COUNT(*) here
        // full-scans tbl_customer_transaction on prod and pushed latency over the
        // 1000ms "degraded" threshold even though payments were perfectly healthy.)
        await sequelize.query("SELECT 1 FROM tbl_payment_link LIMIT 1", { type: QueryTypes.SELECT });
        await sequelize.query("SELECT 1 FROM tbl_customer_transaction LIMIT 1", { type: QueryTypes.SELECT });
        return { healthy: true, latency: Date.now() - start };
      } catch (error: unknown) {
        return { healthy: false, latency: Date.now() - start, error: (error as { message?: string }).message };
      }
    }
  },
  {
    id: "wallet_services",
    name: "Wallet Services",
    check: async (): Promise<HealthCheckResult> => {
      const start = Date.now();
      try {
        // Check wallet tables are accessible (lightweight probe — see note above)
        await sequelize.query("SELECT 1 FROM tbl_user_wallet LIMIT 1", { type: QueryTypes.SELECT });
        await sequelize.query("SELECT 1 FROM tbl_user_addresses LIMIT 1", { type: QueryTypes.SELECT });
        await sequelize.query("SELECT 1 FROM tbl_admin_wallet LIMIT 1", { type: QueryTypes.SELECT });
        return { healthy: true, latency: Date.now() - start };
      } catch (error: unknown) {
        return { healthy: false, latency: Date.now() - start, error: (error as { message?: string }).message };
      }
    }
  },
  {
    id: "webhook_delivery",
    name: "Webhook Delivery",
    check: async (): Promise<HealthCheckResult> => {
      const start = Date.now();
      try {
        // Check Redis connectivity (used for webhook queuing)
        await getRedisItem("health_check_test");
        // Redis is connected if no error thrown
        return { healthy: true, latency: Date.now() - start };
      } catch (error: unknown) {
        return { healthy: false, latency: Date.now() - start, error: (error as { message?: string }).message };
      }
    }
  },
  {
    id: "dashboard",
    name: "Dashboard",
    check: async (): Promise<HealthCheckResult> => {
      const start = Date.now();
      try {
        // Check user and company tables (dashboard dependencies) — lightweight probe
        await sequelize.query("SELECT 1 FROM tbl_user LIMIT 1", { type: QueryTypes.SELECT });
        await sequelize.query("SELECT 1 FROM tbl_company LIMIT 1", { type: QueryTypes.SELECT });
        return { healthy: true, latency: Date.now() - start };
      } catch (error: unknown) {
        return { healthy: false, latency: Date.now() - start, error: (error as { message?: string }).message };
      }
    }
  }
];

/**
 * Per-service latency budgets (ms). A healthy-but-slow check is DEGRADED once it
 * crosses `degraded`, and an OUTAGE once it crosses `outage` (or the check throws).
 * Replaces the old blanket 1000ms rule so a naturally-heavier probe (e.g. the
 * 3-table wallet probe) isn't mislabeled degraded while a fast one (api_gateway)
 * is held to a tight budget. Tune per service without touching the check logic.
 */
const LATENCY_BUDGETS: Record<string, { degraded: number; outage: number }> = {
  // Budgets sized with headroom above each service's real observed baseline
  // (dominated by the ~280ms RTT to the managed Railway DB/Redis) so a
  // naturally-heavier probe (3-table wallet check) gets a looser budget than a
  // light one (api_gateway SELECT 1) WITHOUT false-flagging healthy services.
  api_gateway: { degraded: 600, outage: 3000 },
  payment_processing: { degraded: 800, outage: 4000 },
  wallet_services: { degraded: 900, outage: 4000 },
  webhook_delivery: { degraded: 600, outage: 3000 },
  dashboard: { degraded: 700, outage: 4000 },
};
const DEFAULT_BUDGET = { degraded: 1000, outage: 5000 };
export const budgetFor = (serviceId: string): { degraded: number; outage: number } =>
  LATENCY_BUDGETS[serviceId] || DEFAULT_BUDGET;

/**
 * Upsert the PERMANENT daily rollup for one service+day from the raw checks.
 *
 * Recomputes today's aggregate from tbl_service_health (cheap — ≤96 rows/day)
 * and writes a single durable row per (service_id, check_date). This table is
 * never pruned, so the 90-day status chart keeps real history across redeploys
 * even though the raw table is trimmed to 7 days.
 */
const upsertDailyRollup = async (
  serviceId: string,
  serviceName: string,
  dateStr: string
): Promise<void> => {
  await sequelize.query(
    `INSERT INTO "tbl_service_health_daily"
       (service_id, service_name, check_date, total_checks, operational_checks,
        degraded_checks, outage_checks, avg_latency_ms, worst_status,
        first_check_at, last_check_at, updated_at)
     SELECT
       :serviceId, :serviceName, :dateStr,
       COUNT(*),
       SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END),
       SUM(CASE WHEN status = 'degraded'    THEN 1 ELSE 0 END),
       SUM(CASE WHEN status = 'outage'      THEN 1 ELSE 0 END),
       COALESCE(ROUND(AVG(latency_ms))::int, 0),
       CASE
         WHEN SUM(CASE WHEN status = 'outage'   THEN 1 ELSE 0 END) > 0 THEN 'outage'
         WHEN SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) > 0 THEN 'degraded'
         ELSE 'operational'
       END,
       MIN(check_timestamp), MAX(check_timestamp), NOW()
     FROM "tbl_service_health"
     WHERE service_id = :serviceId AND check_date = :dateStr
     ON CONFLICT (service_id, check_date) DO UPDATE SET
       service_name       = EXCLUDED.service_name,
       total_checks       = EXCLUDED.total_checks,
       operational_checks = EXCLUDED.operational_checks,
       degraded_checks    = EXCLUDED.degraded_checks,
       outage_checks      = EXCLUDED.outage_checks,
       avg_latency_ms     = EXCLUDED.avg_latency_ms,
       worst_status       = EXCLUDED.worst_status,
       first_check_at     = LEAST("tbl_service_health_daily".first_check_at, EXCLUDED.first_check_at),
       last_check_at      = GREATEST("tbl_service_health_daily".last_check_at, EXCLUDED.last_check_at),
       updated_at         = NOW()`,
    { replacements: { serviceId, serviceName, dateStr }, type: QueryTypes.INSERT }
  );
};

/**
 * Run health checks for all services and store results
 */
export const runHealthChecks = async (): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];
  
  log(`[Monitor] Running health checks`, "info");
  
  for (const service of MONITORED_SERVICES) {
    try {
      const result = await service.check();
      
      const budget = budgetFor(service.id);
      let status: "operational" | "degraded" | "outage" = "operational";
      if (!result.healthy) {
        status = "outage";
      } else if (result.latency > budget.outage) {
        status = "outage"; // Pathologically slow = as good as down
      } else if (result.latency > budget.degraded) {
        status = "degraded"; // Slow response = degraded (per-service budget)
      }
      
      await serviceHealthModel.create({
        service_id: service.id,
        service_name: service.name,
        status,
        latency_ms: result.latency,
        error_message: result.error || null,
        check_date: today,
        check_timestamp: new Date(),
      });
      
      log(`[Monitor] ${service.name}: ${status} (${result.latency}ms)`, "info");
    } catch (error: unknown) {
      const err = error as { message?: string };
      log(`[Monitor] Error checking ${service.name}: ${err.message}`, "error");
      
      // Store the failure
      await serviceHealthModel.create({
        service_id: service.id,
        service_name: service.name,
        status: "outage",
        latency_ms: 0,
        error_message: err.message,
        check_date: today,
        check_timestamp: new Date(),
      });
    }
  }

  // Update the permanent daily rollup for each service (never pruned) so the
  // public 90-day status chart accumulates real history across redeploys.
  for (const service of MONITORED_SERVICES) {
    try {
      await upsertDailyRollup(service.id, service.name, today);
    } catch (error: unknown) {
      const err = error as { message?: string };
      log(`[Monitor] Error updating daily rollup for ${service.name}: ${err.message}`, "error");
    }
  }
};

/**
 * Get daily status for a service — reads the PERMANENT daily rollup
 * (tbl_service_health_daily), so history is not lost when the raw 7-day table
 * is pruned. One row per day; `worst_status` is the day's worst observed state.
 */
export const getDailyServiceStatus = async (
  serviceId: string,
  days: number = 90
): Promise<Array<{ date: string; status: string; checks: number; avg_latency: number }>> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const results = await sequelize.query<{ date: string; status: string; checks: number; avg_latency: number }>(
    `SELECT
      check_date as date,
      CASE
        WHEN total_checks = 0 THEN 'no_data'
        WHEN outage_checks::float / total_checks >= 0.05 THEN 'outage'
        WHEN (outage_checks + degraded_checks)::float / total_checks >= 0.10 THEN 'degraded'
        ELSE 'operational'
      END as status,
      total_checks as checks,
      avg_latency_ms as avg_latency
    FROM tbl_service_health_daily
    WHERE service_id = :serviceId
    AND check_date >= :startDate
    ORDER BY check_date ASC`,
    {
      replacements: { serviceId, startDate: startDate.toISOString().split('T')[0] },
      type: QueryTypes.SELECT
    }
  );

  return results;
};

/**
 * Get current status for all services (latest check)
 */
export const getCurrentServiceStatus = async (): Promise<Array<{
  service_id: string;
  service_name: string;
  status: string;
  latency_ms: number;
  last_check: Date;
}>> => {
  const results = await sequelize.query<{ service_id: string; service_name: string; status: string; latency_ms: number; last_check: Date }>(
    `SELECT DISTINCT ON (service_id) 
      service_id, service_name, status, latency_ms, check_timestamp as last_check
    FROM tbl_service_health
    ORDER BY service_id, check_timestamp DESC`,
    { type: QueryTypes.SELECT }
  );
  
  return results;
};

/**
 * Calculate uptime percentage for a service — from the PERMANENT daily rollup
 * so it reflects the full retained history (not just the raw 7-day window).
 */
export const calculateServiceUptime = async (
  serviceId: string,
  days: number = 90
): Promise<{ uptime_percentage: number; total_checks: number; failed_checks: number }> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const results = await sequelize.query<{ total_checks: string; operational_checks: string; failed_checks: string }>(
    `SELECT 
      COALESCE(SUM(total_checks), 0) as total_checks,
      COALESCE(SUM(operational_checks), 0) as operational_checks,
      COALESCE(SUM(outage_checks), 0) as failed_checks
    FROM tbl_service_health_daily
    WHERE service_id = :serviceId
    AND check_date >= :startDate`,
    {
      replacements: { serviceId, startDate: startDate.toISOString().split('T')[0] },
      type: QueryTypes.SELECT
    }
  );
  
  const data = results[0] || { total_checks: '0', operational_checks: '0', failed_checks: '0' };
  const total = parseInt(String(data.total_checks)) || 0;
  const operational = parseInt(String(data.operational_checks)) || 0;
  const failed = parseInt(String(data.failed_checks)) || 0;
  
  return {
    uptime_percentage: total > 0 ? (operational / total) * 100 : 100,
    total_checks: total,
    failed_checks: failed
  };
};

/**
 * Get all monitored services info (incl. their per-service latency budgets so
 * the status page / API can show the threshold each service is held to).
 */
export const getMonitoredServices = () => MONITORED_SERVICES.map(s => ({
  id: s.id,
  name: s.name,
  degraded_ms: budgetFor(s.id).degraded,
  outage_ms: budgetFor(s.id).outage,
}));

export interface DerivedIncident {
  id: string;
  service_id: string;
  service_name: string;
  severity: "degraded" | "outage";
  status: "resolved" | "ongoing";
  title: string;
  description: string;
  started_at: string;
  resolved_at: string | null;
  duration_minutes: number | null;
  services_affected: string[];
  auto: true;
}

/**
 * Derive incidents from the raw health-check history (READ-ONLY — no writes, no
 * new table). A contiguous run of degraded/outage checks for a service becomes
 * ONE incident: it auto-OPENS at the first bad check and auto-RESOLVES at the
 * first operational check that follows (recovery). A run with no recovery yet is
 * an ONGOING incident. Noise guard: a lone single degraded blip is ignored
 * unless it's an outage. The raw table keeps ~7 days, so this is the public
 * "recent incidents / status history" feed and updates itself as the monitor
 * cron writes new checks (on the primary worker).
 */
export const getDerivedIncidents = async (windowDays = 7): Promise<DerivedIncident[]> => {
  const rows = await sequelize.query<{
    service_id: string;
    service_name: string;
    status: string;
    check_timestamp: string;
  }>(
    `SELECT service_id, service_name, status, check_timestamp
       FROM tbl_service_health
      WHERE check_timestamp >= NOW() - (:days || ' days')::interval
      ORDER BY service_id, check_timestamp ASC`,
    { replacements: { days: windowDays }, type: QueryTypes.SELECT }
  );

  const byService = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byService.get(r.service_id);
    if (list) list.push(r);
    else byService.set(r.service_id, [r]);
  }

  const incidents: DerivedIncident[] = [];

  for (const [sid, list] of byService) {
    let run:
      | { start: string; lastBad: string; worst: "degraded" | "outage"; name: string; count: number }
      | null = null;

    const flush = (resolvedAt: string | null) => {
      if (!run) return;
      // Noise guard: drop a lone single degraded check (keep any outage).
      if (run.count < 2 && run.worst !== "outage") {
        run = null;
        return;
      }
      const started = new Date(run.start);
      const end = resolvedAt ? new Date(resolvedAt) : null;
      const dur = end ? Math.max(1, Math.round((end.getTime() - started.getTime()) / 60000)) : null;
      const sev = run.worst;
      incidents.push({
        id: `auto-${sid}-${run.start}`,
        service_id: sid,
        service_name: run.name,
        severity: sev,
        status: resolvedAt ? "resolved" : "ongoing",
        title: resolvedAt
          ? `${run.name} recovered`
          : `${run.name} ${sev === "outage" ? "outage" : "degraded performance"}`,
        description: resolvedAt
          ? `${run.name} experienced ${sev === "outage" ? "an outage" : "degraded performance"} and has recovered.`
          : `${run.name} is currently ${sev === "outage" ? "experiencing an outage" : "showing degraded performance"}. We're investigating.`,
        started_at: run.start,
        resolved_at: resolvedAt,
        duration_minutes: dur,
        services_affected: [sid],
        auto: true,
      });
      run = null;
    };

    for (const r of list) {
      const bad = r.status === "degraded" || r.status === "outage";
      if (bad) {
        if (!run) {
          run = { start: r.check_timestamp, lastBad: r.check_timestamp, worst: r.status as "degraded" | "outage", name: r.service_name, count: 1 };
        } else {
          run.lastBad = r.check_timestamp;
          run.count += 1;
          if (r.status === "outage") run.worst = "outage";
        }
      } else if (run) {
        // First operational check after a bad run = recovery.
        flush(r.check_timestamp);
      }
    }
    if (run) flush(null); // trailing, unresolved run = ongoing incident
  }

  incidents.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  return incidents;
};

/**
 * Prune old health check records to prevent unbounded table growth
 * Keeps only the last 7 days of data
 * ~1,440 rows/day × 7 days = ~10,080 rows max (vs unbounded growth)
 */
export const pruneOldHealthChecks = async (): Promise<{ deleted: number }> => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await sequelize.query(
      `DELETE FROM tbl_service_health WHERE check_timestamp < :cutoff`,
      {
        replacements: { cutoff: sevenDaysAgo.toISOString() },
        type: QueryTypes.DELETE,
      }
    );

    const deletedCount = typeof result === "number" ? result : 0;
    if (deletedCount > 0) {
      log(`[Monitor] Pruned ${deletedCount} health check records older than 7 days`, "info");
    }
    return { deleted: deletedCount };
  } catch (error: unknown) {
    const err = error as { message?: string };
    log(`[Monitor] Error pruning old health checks: ${err.message}`, "error");
    return { deleted: 0 };
  }
};

export default {
  runHealthChecks,
  getDailyServiceStatus,
  getCurrentServiceStatus,
  calculateServiceUptime,
  getMonitoredServices,
  getDerivedIncidents,
  budgetFor,
  pruneOldHealthChecks,
  MONITORED_SERVICES
};
