import express from "express";
import dashboardController from "../controller/dashboardController";
import { authMiddleware } from "../middleware";

const dashboardRouter = express.Router();

// All dashboard routes require authentication
dashboardRouter.use(authMiddleware);

// GET /api/dashboard - Get all dashboard statistics
dashboardRouter.get("/", dashboardController.getDashboard);

// GET /api/dashboard/chart - Get volume chart data
// Query params: period (7d, 30d, 90d, 1y), company_id
dashboardRouter.get("/chart", dashboardController.getChartData);

// GET /api/dashboard/fee-tiers - Get fee tiers information
dashboardRouter.get("/fee-tiers", dashboardController.getFeeTiers);

// GET /api/dashboard/recent-transactions - Get recent transactions
// Query params: limit (default 10), company_id
dashboardRouter.get("/recent-transactions", dashboardController.getRecentTransactions);

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
