import express from "express";
import statusController from "../controller/statusController";
import { getGatewayHealth } from "../controller/status/gatewayController";
import { getLandingMetrics } from "../controller/status/landingMetricsController";
import { getRecentSettlements, getOnchainProof } from "../controller/status/landingProofController";

const statusRouter = express.Router();

// Public endpoints (no auth required for status page)

// GET /api/status - Overall system status
statusRouter.get("/", statusController.getStatus);

// GET /api/status/landing-metrics - Public reliability numbers for the landing proof strip
statusRouter.get("/landing-metrics", getLandingMetrics);

// GET /api/status/recent-settlements - Anonymized live settlement feed (coin + network + time only)
statusRouter.get("/recent-settlements", getRecentSettlements);

// GET /api/status/onchain-proof - Verifiable on-chain settlements from Dynopay's own store
statusRouter.get("/onchain-proof", getOnchainProof);

// GET /api/status/gateway - Merchant dashboard gateway-health strip (payments · rates · webhooks · api)
statusRouter.get("/gateway", getGatewayHealth);

// GET /api/status/health - Simple health check
statusRouter.get("/health", statusController.healthCheck);

// POST /api/status/check - Manually trigger health checks
statusRouter.post("/check", statusController.triggerHealthCheck);

// GET /api/status/services - All services status
statusRouter.get("/services", statusController.getServicesStatus);

// GET /api/status/services/uptime - All services uptime history
statusRouter.get("/services/uptime", statusController.getAllServicesUptime);

// GET /api/status/service/:serviceId - Specific service status
statusRouter.get("/service/:serviceId", statusController.getServiceStatus);

// GET /api/status/service/:serviceId/uptime - Specific service uptime history
statusRouter.get("/service/:serviceId/uptime", statusController.getServiceUptime);

// GET /api/status/uptime - 90-day uptime chart data (overall system)
statusRouter.get("/uptime", statusController.getUptimeChart);

// GET /api/status/incidents - Recent incidents
statusRouter.get("/incidents", statusController.getIncidents);

// GET /api/status/incidents/:id - Specific incident
statusRouter.get("/incidents/:id", statusController.getIncident);

export default statusRouter;
