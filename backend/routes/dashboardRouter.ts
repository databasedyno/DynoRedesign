import express from "express";
import dashboardController from "../controller/dashboardController";
import dashboardOverviewController from "../controller/dashboardOverviewController";
import payoutsController from "../controller/payoutsController";
import developerHealthController from "../controller/developerHealthController";
import { authMiddleware } from "../middleware";

const dashboardRouter = express.Router();

// All dashboard routes require authentication
dashboardRouter.use(authMiddleware);

// GET /api/dashboard - Get all dashboard statistics
dashboardRouter.get("/", dashboardController.getDashboard);

// GET /api/dashboard/overview - Command-centre aggregates (money in motion,
// checkout health, exceptions, config gaps, top sources) for a range.
// Query params: company_id, period (today|7d|30d|90d|1y), startDate, endDate
dashboardRouter.get("/overview", dashboardOverviewController.getOverview);

// GET /api/dashboard/payouts - Forwarded-to-wallet totals, per-wallet activity,
// recent forwards and stuck items (failed conversions / unswept settlements).
dashboardRouter.get("/payouts", payoutsController.getPayouts);

// GET /api/dashboard/developer-health - Webhook delivery health (24h), API-key
// age + rotation reminder, configured endpoint. Query params: company_id.
dashboardRouter.get("/developer-health", developerHealthController.getDeveloperHealth);

// GET /api/dashboard/chart - Get volume chart data
// Query params: period (7d, 30d, 90d, 1y), company_id
dashboardRouter.get("/chart", dashboardController.getChartData);

// GET /api/dashboard/fee-tiers - Get fee tiers information
dashboardRouter.get("/fee-tiers", dashboardController.getFeeTiers);

// GET /api/dashboard/recent-transactions - Get recent transactions
// Query params: limit (default 10), company_id
dashboardRouter.get("/recent-transactions", dashboardController.getRecentTransactions);

// GET /api/dashboard/pending-summary - Money awaiting on-chain confirmation
// (fresh pending payments + accurate USD total). Query params: company_id.
dashboardRouter.get("/pending-summary", dashboardController.getPendingSummary);

// GET /api/dashboard/conversions - Get conversion status tracker
// Query params: status (optional), company_id (optional), limit (default 20)
dashboardRouter.get("/conversions", dashboardController.getConversions);

// GET /api/dashboard/conversions/:id - Get single conversion detail with timeline
dashboardRouter.get("/conversions/:id", dashboardController.getConversionDetail);

// GET /api/dashboard/action-counts - Live "needs attention" counts powering the
// Quick Action tile badges (unpaid invoices, pending payments, active/expired
// payment links, out-of-stock products, pending referral rewards).
// Query params: company_id (optional). Read-only, Redis-cached 60s.
dashboardRouter.get("/action-counts", dashboardController.getActionCounts);

export default dashboardRouter;
