import express from "express";
import { apiLogger } from "../../utils/loggers";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { successResponseHelper, errorResponseHelper } from "../../helper";
import monitoringService from "../../services/monitoringService";

/**
 * Status Controller — uptime handlers (extracted from statusController.ts to
 * keep that file under the 500-line budget). Behaviour is byte-identical.
 */

/**
 * GET /api/status/service/:serviceId/uptime
 * Get REAL uptime history for a specific service
 */
export const getServiceUptime = async (req: express.Request, res: express.Response) => {
  try {
    const { serviceId } = req.params;
    const days = parseInt(req.query.days as string) || 90;

    const services = monitoringService.getMonitoredServices();
    const service = services.find(s => s.id === serviceId);

    if (!service) {
      return errorResponseHelper(res, 404, "Service not found");
    }

    const dailyStatus = await monitoringService.getDailyServiceStatus(serviceId, days);
    const uptimeData = await monitoringService.calculateServiceUptime(serviceId, days);

    // Fill in missing days with "no_data" status
    const today = new Date();
    const allDays: Array<{ date: string; status: string; checks: number; avg_latency: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const existing = dailyStatus.find(d => d.date === dateStr);
      if (existing) {
        allDays.push(existing);
      } else {
        allDays.push({ date: dateStr, status: "no_data", checks: 0, avg_latency: 0 });
      }
    }

    // Calculate summary
    const operational = allDays.filter(d => d.status === "operational").length;
    const degraded = allDays.filter(d => d.status === "degraded").length;
    const outage = allDays.filter(d => d.status === "outage").length;
    const noData = allDays.filter(d => d.status === "no_data").length;

    const response = {
      service_id: service.id,
      service_name: service.name,
      period_days: days,
      uptime_percentage: uptimeData.uptime_percentage.toFixed(2),
      total_checks: uptimeData.total_checks,
      failed_checks: uptimeData.failed_checks,
      summary: {
        operational_days: operational,
        degraded_days: degraded,
        outage_days: outage,
        no_data_days: noData
      },
      daily_status: allDays
    };

    successResponseHelper(res, 200, "Service uptime data retrieved", response);
  } catch (e) {

      handleControllerError(res, e, apiLogger);
  }
};

/**
 * GET /api/status/services/uptime
 * Get REAL uptime history for ALL services
 */
export const getAllServicesUptime = async (req: express.Request, res: express.Response) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const services = monitoringService.getMonitoredServices();

    const servicesUptime = await Promise.all(
      services.map(async (service) => {
        const dailyStatus = await monitoringService.getDailyServiceStatus(service.id, days);
        const uptimeData = await monitoringService.calculateServiceUptime(service.id, days);

        // Fill in missing days
        const today = new Date();
        const allDays: Array<{ date: string; status: string }> = [];

        for (let i = days - 1; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];

          const existing = dailyStatus.find(d => d.date === dateStr);
          allDays.push({
            date: dateStr,
            status: existing?.status || "no_data"
          });
        }

        const operational = allDays.filter(d => d.status === "operational").length;
        const degraded = allDays.filter(d => d.status === "degraded").length;
        const outage = allDays.filter(d => d.status === "outage").length;

        return {
          service_id: service.id,
          service_name: service.name,
          period_days: days,
          uptime_percentage: uptimeData.uptime_percentage.toFixed(2),
          total_checks: uptimeData.total_checks,
          summary: {
            operational_days: operational,
            degraded_days: degraded,
            outage_days: outage
          },
          daily_status: allDays
        };
      })
    );

    successResponseHelper(res, 200, "All services uptime data retrieved", { services: servicesUptime });
  } catch (e) {

      handleControllerError(res, e, apiLogger);
  }
};

/**
 * GET /api/status/uptime
 * Get overall 90-day uptime data (aggregate of all services)
 */
export const getUptimeChart = async (req: express.Request, res: express.Response) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const services = monitoringService.getMonitoredServices();

    // Get all service daily statuses
    const allServicesData = await Promise.all(
      services.map(s => monitoringService.getDailyServiceStatus(s.id, days))
    );

    // Aggregate by date - worst status wins
    const today = new Date();
    const aggregatedDays: Array<{ date: string; status: string }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Check all services for this date
      let dayStatus = "no_data";
      let hasData = false;

      for (const serviceData of allServicesData) {
        const dayData = serviceData.find(d => d.date === dateStr);
        if (dayData) {
          hasData = true;
          if (dayData.status === "outage") {
            dayStatus = "outage";
            break; // Worst case, stop checking
          } else if (dayData.status === "degraded" && dayStatus !== "outage") {
            dayStatus = "degraded";
          } else if (dayData.status === "operational" && dayStatus === "no_data") {
            dayStatus = "operational";
          }
        }
      }

      if (hasData && dayStatus === "no_data") {
        dayStatus = "operational";
      }

      aggregatedDays.push({ date: dateStr, status: dayStatus });
    }

    const operational = aggregatedDays.filter(d => d.status === "operational").length;
    const degraded = aggregatedDays.filter(d => d.status === "degraded").length;
    const outage = aggregatedDays.filter(d => d.status === "outage").length;
    const daysWithData = days - aggregatedDays.filter(d => d.status === "no_data").length;

    const response = {
      period_days: days,
      uptime_percentage: daysWithData > 0 ? ((operational / daysWithData) * 100).toFixed(2) : "100.00",
      summary: {
        operational_days: operational,
        degraded_days: degraded,
        outage_days: outage
      },
      daily_status: aggregatedDays
    };

    successResponseHelper(res, 200, "Uptime data retrieved", response);
  } catch (e) {

      handleControllerError(res, e, apiLogger);
  }
};
