import express from "express";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import jwt from "jsonwebtoken";
import { IUserType } from "../utils/types";
import { planModel } from "../models";
import subscriptionModel from "../models/apiModels/subscriptionModel";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import { apiLogger } from "../utils/loggers";
import crypto from "crypto";
import sequelize from "../utils/dbInstance";
import { Op, QueryTypes } from "sequelize";
import flw from "../apis/flutterwaveApi";
import emailService from "../services/emailService";

/** Next billing date from a plan interval, formatted for emails. */
const computeNextBilling = (interval?: string): string => {
  const d = new Date();
  switch ((interval || "").toLowerCase()) {
    case "daily": d.setDate(d.getDate() + 1); break;
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "yearly": case "annually": d.setFullYear(d.getFullYear() + 1); break;
    case "monthly": default: d.setMonth(d.getMonth() + 1); break;
  }
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
};

const getCompanyName = async (companyId: number | null | undefined): Promise<string> => {
  if (!companyId) return "your account";
  const rows = await sequelize.query<{ company_name: string }>(
    `SELECT company_name FROM tbl_company WHERE company_id = :companyId LIMIT 1`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );
  return rows[0]?.company_name || "your account";
};

const todayFormatted = () =>
  new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

/** Email the subscriber + merchant that a subscription was cancelled. */
const notifySubscriptionCancelled = (sub: Record<string, unknown>, userData: IUserType) => {
  if (!sub.customer_email) return;
  emailService
    .sendSubscriptionCancelledEmail(
      String(sub.customer_email),
      sub.customer_name ? String(sub.customer_name) : null,
      userData.email,
      userData.name || "",
      String(sub.plan_name || "your plan"),
      String(sub.company_name || "your account"),
      todayFormatted(),
      "merchant",
    )
    .catch((err) => apiLogger.warn(`Subscription cancelled email failed: ${getErrorMessage(err)}`));
};

/**
 * Get all subscriptions for user
 * GET /api/subscriptions
 */
const getSubscriptions = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { company_id, status } = req.query;

    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userData.user_id);
      if (!companyData) return;
    }

    // Get user's plans first
    const userPlans = await planModel.findAll({
      attributes: ["plan_id"],
      where: { user_id: userData.user_id },
    });
    const planIds = userPlans.map((p) => p.dataValues.plan_id);

    if (planIds.length === 0) {
      return successResponseHelper(res, 200, "No subscriptions found", []);
    }

    // Build query conditions
    const whereConditions: Record<string, unknown> = {
      plan_id: { [Op.in]: planIds },
    };

    if (status) {
      whereConditions.status = status;
    }

    // Get subscriptions with plan details
    const subscriptions = await sequelize.query(
      `SELECT s.*, p.plan_name, p.amount, p.interval, p.currency, p.company_id, c.company_name
       FROM tbl_subscription s
       JOIN tbl_plan p ON s.plan_id = p.plan_id
       LEFT JOIN tbl_company c ON p.company_id = c.company_id
       WHERE p.user_id = :user_id
       ${company_id ? 'AND p.company_id = :company_id' : ''}
       ${status ? 'AND s.status = :status' : ''}
       ORDER BY s."createdAt" DESC`,
      {
        replacements: { 
          user_id: userData.user_id, 
          company_id: company_id || null,
          status: status || null 
        },
        type: QueryTypes.SELECT,
      }
    );

    successResponseHelper(res, 200, "Subscriptions retrieved successfully", subscriptions);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Get subscription by ID
 * GET /api/subscriptions/:id
 */
const getSubscriptionById = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const subscription_id = req.params.id;

    const subscription = await sequelize.query(
      `SELECT s.*, p.plan_name, p.amount, p.interval, p.currency, p.company_id, c.company_name
       FROM tbl_subscription s
       JOIN tbl_plan p ON s.plan_id = p.plan_id
       LEFT JOIN tbl_company c ON p.company_id = c.company_id
       WHERE s.subscription_id = :subscription_id AND p.user_id = :user_id`,
      {
        replacements: { subscription_id, user_id: userData.user_id },
        type: QueryTypes.SELECT,
      }
    );

    if (!subscription || subscription.length === 0) {
      return errorResponseHelper(res, 404, "Subscription not found");
    }

    successResponseHelper(res, 200, "Subscription retrieved successfully", subscription[0]);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Create subscription
 * POST /api/subscriptions
 */
const createSubscription = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { plan_id, customer_email, customer_name } = req.body;

    if (!plan_id) {
      return errorResponseHelper(res, 400, "plan_id is required");
    }

    // Verify plan belongs to user
    const plan = await planModel.findOne({
      where: {
        plan_id,
        user_id: userData.user_id,
      },
    });

    if (!plan) {
      return errorResponseHelper(res, 404, "Plan not found");
    }

    // Create subscription in Flutterwave
    let flwSubscriptionId = null;
    try {
      // Note: Flutterwave subscriptions are typically created through payment flow
      // This is a placeholder for direct subscription creation
      const subscriptionData = {
        id: crypto.randomUUID(),
        plan_id: plan.dataValues.flw_plan_id,
        customer: {
          email: customer_email || userData.email,
          name: customer_name || userData.name,
        },
      };
      // flwSubscriptionId = subscription.data.id;
    } catch (flwError) {
      apiLogger.warn(`Failed to create subscription in Flutterwave: ${getErrorMessage(flwError)}`);
    }

    // Create local subscription record
    const custEmail = customer_email || userData.email;
    const custName = customer_name || null;
    const subscription = await subscriptionModel.create({
      subscription_id: crypto.randomUUID(),
      flw_subscription_id: flwSubscriptionId,
      plan_id,
      status: "active",
      customer_email: custEmail,
      customer_name: custName,
    });

    // Notify the subscriber + merchant that the subscription is active.
    getCompanyName(plan.dataValues.company_id)
      .then((companyName) =>
        emailService.sendSubscriptionCreatedEmail(
          custEmail,
          custName,
          userData.email,
          userData.name || "",
          plan.dataValues.plan_name,
          String(plan.dataValues.amount),
          plan.dataValues.currency || "USD",
          plan.dataValues.interval || "monthly",
          computeNextBilling(plan.dataValues.interval),
          companyName,
        )
      )
      .catch((err) => apiLogger.warn(`Subscription created email failed: ${getErrorMessage(err)}`));

    apiLogger.info(`Subscription created for plan ${plan_id} by user ${userData.user_id}`);
    successResponseHelper(res, 201, "Subscription created successfully", subscription);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Update subscription status
 * PUT /api/subscriptions/:id
 */
const updateSubscription = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const subscription_id = req.params.id;
    const { status } = req.body;

    const validStatuses = ["active", "paused", "cancelled"];
    if (status && !validStatuses.includes(status)) {
      return errorResponseHelper(res, 400, `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
    }

    // Verify subscription belongs to user's plan
    const subscription = await sequelize.query(
      `SELECT s.*, p.user_id, p.flw_plan_id, p.plan_name, p.company_id, c.company_name
       FROM tbl_subscription s
       JOIN tbl_plan p ON s.plan_id = p.plan_id
       LEFT JOIN tbl_company c ON p.company_id = c.company_id
       WHERE s.subscription_id = :subscription_id AND p.user_id = :user_id`,
      {
        replacements: { subscription_id, user_id: userData.user_id },
        type: QueryTypes.SELECT,
      }
    );

    if (!subscription || subscription.length === 0) {
      return errorResponseHelper(res, 404, "Subscription not found");
    }

    const sub = subscription[0] as Record<string, unknown>;

    // Update in Flutterwave if needed
    if (sub.flw_subscription_id && status === "cancelled") {
      try {
        await (flw as unknown as { Subscription: { cancel: (params: { id: unknown }) => Promise<void> } }).Subscription.cancel({ id: sub.flw_subscription_id });
      } catch (flwError) {
        apiLogger.warn(`Failed to cancel subscription in Flutterwave: ${getErrorMessage(flwError)}`);
      }
    }

    // Update local record
    await subscriptionModel.update(
      { status },
      { where: { subscription_id } }
    );

    if (status === "cancelled") notifySubscriptionCancelled(sub, userData);

    const updatedSubscription = await subscriptionModel.findOne({
      where: { subscription_id },
    });

    apiLogger.info(`Subscription ${subscription_id} updated to ${status} by user ${userData.user_id}`);
    successResponseHelper(res, 200, "Subscription updated successfully", updatedSubscription);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Cancel subscription
 * DELETE /api/subscriptions/:id
 */
const cancelSubscription = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const subscription_id = req.params.id;

    // Verify subscription belongs to user's plan
    const subscription = await sequelize.query(
      `SELECT s.*, p.user_id, p.flw_plan_id, p.plan_name, p.company_id, c.company_name
       FROM tbl_subscription s
       JOIN tbl_plan p ON s.plan_id = p.plan_id
       LEFT JOIN tbl_company c ON p.company_id = c.company_id
       WHERE s.subscription_id = :subscription_id AND p.user_id = :user_id`,
      {
        replacements: { subscription_id, user_id: userData.user_id },
        type: QueryTypes.SELECT,
      }
    );

    if (!subscription || subscription.length === 0) {
      return errorResponseHelper(res, 404, "Subscription not found");
    }

    const sub = subscription[0] as Record<string, unknown>;

    // Cancel in Flutterwave
    if (sub.flw_subscription_id) {
      try {
        await (flw as unknown as { Subscription: { cancel: (params: { id: unknown }) => Promise<void> } }).Subscription.cancel({ id: sub.flw_subscription_id });
      } catch (flwError) {
        apiLogger.warn(`Failed to cancel subscription in Flutterwave: ${getErrorMessage(flwError)}`);
      }
    }

    // Update status to cancelled (soft delete)
    await subscriptionModel.update(
      { status: "cancelled" },
      { where: { subscription_id } }
    );

    notifySubscriptionCancelled(sub, userData);

    apiLogger.info(`Subscription ${subscription_id} cancelled by user ${userData.user_id}`);
    successResponseHelper(res, 200, "Subscription cancelled successfully", { subscription_id });
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

export default {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  cancelSubscription,
};
