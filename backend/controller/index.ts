import apiController from "./apiController";
import companyController from "./companyController";
import paymentController from "./paymentController";
import userController from "./userController";
import walletController from "./walletController";
import taxController from "./taxController";
import dashboardController from "./dashboardController";
import notificationController, { createNotification, NOTIFICATION_TYPES } from "./notificationController";
import subscriptionController from "./subscriptionController";

// Re-export fee functions from centralized service (backward compatibility)
export {
  getTransactionFee,
  getDiscountedTransactionFee,
  getBlockchainFee,
  getBlockchainConfig,
  calculateTransactionFees,
  calculateTransactionFeesWithDiscount,
} from '../services/feeService';

export {
  userController,
  companyController,
  paymentController,
  walletController,
  apiController,
  taxController,
  dashboardController,
  notificationController,
  subscriptionController,
  createNotification,
  NOTIFICATION_TYPES,
};
