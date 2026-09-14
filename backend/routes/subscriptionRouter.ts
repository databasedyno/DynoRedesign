import express from "express";
import subscriptionController from "../controller/subscriptionController";
import { authMiddleware } from "../middleware";

const subscriptionRouter = express.Router();

// All subscription routes require authentication
subscriptionRouter.use(authMiddleware);

// GET /api/subscriptions - List all subscriptions
// Query params: company_id, status
subscriptionRouter.get("/", subscriptionController.getSubscriptions);

// GET /api/subscriptions/:id - Get subscription by ID
subscriptionRouter.get("/:id", subscriptionController.getSubscriptionById);

// POST /api/subscriptions - Create a new subscription
subscriptionRouter.post("/", subscriptionController.createSubscription);

// PUT /api/subscriptions/:id - Update subscription status
subscriptionRouter.put("/:id", subscriptionController.updateSubscription);

// DELETE /api/subscriptions/:id - Cancel subscription
subscriptionRouter.delete("/:id", subscriptionController.cancelSubscription);

export default subscriptionRouter;
