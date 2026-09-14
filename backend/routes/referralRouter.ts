import express from 'express';
import referralController from '../controller/referralController';
import referralPayoutController from '../controller/referralPayoutController';
import { authMiddleware } from '../middleware';
import { requireStepUp } from '../middleware/requireStepUp';

const referralRouter = express.Router();

// Public routes - User Referral Code (Type 1)
referralRouter.post('/validate', referralController.validateReferralCode);
referralRouter.post('/apply', referralController.applyReferralCode);
referralRouter.get('/leaderboard', referralController.getReferralLeaderboard);
referralRouter.get('/leaderboard/public', referralController.getPublicReferralLeaderboard);

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
// Every payout-method change (mode, address, cash-out request, auto on/off) is
// step-up gated (scope `payout`) via the unified /api/stepup engine.
referralRouter.post('/payout/opt-in', authMiddleware, requireStepUp('payout'), referralPayoutController.payoutOptIn);
referralRouter.post('/payout/request', authMiddleware, requireStepUp('payout'), referralPayoutController.payoutRequest);
referralRouter.post('/payout/auto', authMiddleware, requireStepUp('payout'), referralPayoutController.payoutAuto);
referralRouter.get('/payout/history', authMiddleware, referralPayoutController.payoutHistory);
referralRouter.get('/payout/history/export', authMiddleware, referralPayoutController.payoutHistoryExport);

export default referralRouter;
