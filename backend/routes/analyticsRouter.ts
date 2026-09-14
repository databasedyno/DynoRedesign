/**
 * Analytics Router
 * 
 * Admin-only endpoints for revenue, growth, cohort, and funnel analytics.
 */
import express from "express";
import { adminAuthMiddleware } from "../middleware";
import analyticsController from "../controller/analyticsController";

const analyticsRouter = express.Router();

// Revenue analytics
analyticsRouter.get("/revenue", adminAuthMiddleware, analyticsController.revenue);

// User growth analytics
analyticsRouter.get("/users", adminAuthMiddleware, analyticsController.userGrowth);

// Cohort retention analysis
analyticsRouter.get("/cohorts", adminAuthMiddleware, analyticsController.cohorts);

// Payment funnel analysis
analyticsRouter.get("/funnel", adminAuthMiddleware, analyticsController.funnel);

// Onboarding-checklist drop-off funnel
analyticsRouter.get("/onboarding", adminAuthMiddleware, analyticsController.onboardingFunnel);

// Signup source → conversion attribution funnel
analyticsRouter.get("/attribution", adminAuthMiddleware, analyticsController.attribution);

export default analyticsRouter;
