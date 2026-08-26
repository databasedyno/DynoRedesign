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
        // Check payment tables are accessible
        await sequelize.query("SELECT COUNT(*) FROM tbl_payment_link LIMIT 1", { type: QueryTypes.SELECT });
        await sequelize.query("SELECT COUNT(*) FROM tbl_customer_transaction LIMIT 1", { type: QueryTypes.SELECT });
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
        // Check wallet tables
        await sequelize.query("SELECT COUNT(*) FROM tbl_user_wallet LIMIT 1", { type: QueryTypes.SELECT });
        await sequelize.query("SELECT COUNT(*) FROM tbl_user_addresses LIMIT 1", { type: QueryTypes.SELECT });
        await sequelize.query("SELECT COUNT(*) FROM tbl_admin_wallet LIMIT 1", { type: QueryTypes.SELECT });
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
        // Check user and company tables (dashboard dependencies)
        await sequelize.query("SELECT COUNT(*) FROM tbl_user LIMIT 1", { type: QueryTypes.SELECT });
        await sequelize.query("SELECT COUNT(*) FROM tbl_company LIMIT 1", { type: QueryTypes.SELECT });
        return { healthy: true, latency: Date.now() - start };
      } catch (error: unknown) {
        return { healthy: false, latency: Date.now() - start, error: (error as { message?: string }).message };
      }
    }
  }
];

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
      
      let status: "operational" | "degraded" | "outage" = "operational";
      if (!result.healthy) {
        status = "outage";
      } else if (result.latency > 1000) {
        status = "degraded"; // Slow response = degraded
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
 * Get all monitored services info
 */
export const getMonitoredServices = () => MONITORED_SERVICES.map(s => ({
  id: s.id,
  name: s.name
}));

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
  pruneOldHealthChecks,
  MONITORED_SERVICES
};
