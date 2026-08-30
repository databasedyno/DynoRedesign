import express from 'express';
import referralController from '../controller/referralController';
import referralPayoutController from '../controller/referralPayoutController';
import { authMiddleware } from '../middleware';

const referralRouter = express.Router();

// Public routes - User Referral Code (Type 1)
referralRouter.post('/validate', referralController.validateReferralCode);
referralRouter.post('/apply', referralController.applyReferralCode);
referralRouter.get('/leaderboard', referralController.getReferralLeaderboard);

// Public routes - Referee Code (Type 2 - from payment link email)
referralRouter.post('/referee/validate', referralController.validateRefereeCode);
referralRouter.post('/referee/redeem', referralController.redeemRefereeCode);

// Protected routes (require authentication)
referralRouter.get('/my-code', authMiddleware, referralController.getMyReferralCode);
referralRouter.get('/list', authMiddleware, referralController.listMyReferrals);
referralRouter.get('/earnings', authMiddleware, referralController.getReferralEarnings);
referralRouter.get('/discount-status', authMiddleware, referralController.getDiscountStatus);

// Revenue-share CASH-OUT (Phase 2 — opt-in USDT-TRC20 via Binance)
referralRouter.get('/payout/overview', authMiddleware, referralPayoutController.payoutOverview);
referralRouter.post('/payout/otp', authMiddleware, referralPayoutController.payoutOtp);
referralRouter.post('/payout/opt-in', authMiddleware, referralPayoutController.payoutOptIn);
referralRouter.post('/payout/request', authMiddleware, referralPayoutController.payoutRequest);
referralRouter.post('/payout/auto', authMiddleware, referralPayoutController.payoutAuto);
referralRouter.get('/payout/history', authMiddleware, referralPayoutController.payoutHistory);
referralRouter.get('/payout/history/export', authMiddleware, referralPayoutController.payoutHistoryExport);

export default referralRouter;
