import { raw as envRaw } from "../utils/config";
import { Request, Response } from 'express';
import { apiLogger } from "../utils/loggers";
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Referral from '../models/referralModels/referralModel';
import ReferralReward from '../models/referralModels/referralRewardModel';
import User from '../models/userModels/userModel';
import { Op } from 'sequelize';
import { IUserType } from '../utils/types';

// Set up associations (only if not already set)
if (!(Referral as unknown as { associations?: Record<string, unknown> }).associations?.referrer) {
  Referral.belongsTo(User, { foreignKey: 'referrer_user_id', as: 'referrer' });
  Referral.belongsTo(User, { foreignKey: 'referred_user_id', as: 'referred_user' });
  User.hasMany(Referral, { foreignKey: 'referrer_user_id', as: 'referrals_made' });
  User.hasMany(Referral, { foreignKey: 'referred_user_id', as: 'referrals_received' });
  ReferralReward.belongsTo(Referral, { foreignKey: 'referral_id', as: 'referral' });
  ReferralReward.belongsTo(User, { foreignKey: 'user_id', as: 'reward_user' });
  Referral.hasMany(ReferralReward, { foreignKey: 'referral_id', as: 'rewards' });
  User.hasMany(ReferralReward, { foreignKey: 'user_id', as: 'referral_rewards' });
}

/**
 * Generate unique referral code for user
 */
export const generateReferralCode = (_userId: number, userName: string): string => {
  const prefix = "DYNO";
  const year = new Date().getFullYear();
  const userPart = userName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${year}${userPart}${randomPart}`;
};

/**
 * Get user's referral code and statistics
 * GET /api/referral/my-code
 */
export const getMyReferralCode = async (_req: Request, res: Response) => {
  try {
    const userData = jwt.decode(res.locals.token) as IUserType;
    const userId = userData?.user_id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized. Please login.",
      });
    }

    const user = await User.findByPk(userId, {
      attributes: ['user_id', 'name', 'email', 'referral_code', 'referral_count', 'referral_bonus_earned'],
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // If user doesn't have a referral code, generate one
    let referralCode = (user as { dataValues: { referral_code?: string; name?: string; email?: string; referral_bonus_earned?: number } }).dataValues.referral_code;
    if (!referralCode) {
      referralCode = generateReferralCode(userId, String(user.dataValues.name || 'USER'));
      await User.update(
        { referral_code: referralCode },
        { where: { user_id: userId } }
      );
    }

    // Get referral statistics
    const referrals = await Referral.findAll({
      where: { referrer_user_id: userId },
      include: [
        {
          model: User,
          as: 'referred_user',
          attributes: ['user_id', 'name', 'email', 'createdAt'],
        },
      ],
      order: [['referred_at', 'DESC']],
    });

    const stats = {
      total_referrals: referrals.length,
      pending_referrals: referrals.filter(r => r.status === 'pending').length,
      active_referrals: referrals.filter(r => r.status === 'active').length,
      rewarded_referrals: referrals.filter(r => r.status === 'rewarded').length,
      total_earnings: user.dataValues.referral_bonus_earned || 0,
    };

    return res.status(200).json({
      message: "Referral code retrieved successfully",
      data: {
        referral_code: referralCode,
        referral_link: `${envRaw("FRONTEND_URL") || envRaw("SERVER_URL")}/signup?ref=${referralCode}`,
        stats,
        user: {
          name: user.dataValues.name,
          email: user.dataValues.email,
        },
      },
    });
  } catch (error) {
    apiLogger.error("Error in getMyReferralCode:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get list of user's referrals
 * GET /api/referral/list
 */
export const listMyReferrals = async (req: Request, res: Response) => {
  try {
    const userData = jwt.decode(res.locals.token) as IUserType;
    const userId = userData?.user_id;
    const { page = 1, limit = 10, status } = req.query;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized. Please login.",
      });
    }

    const offset = (Number(page) - 1) * Number(limit);
    const whereClause: Record<string, unknown> = { referrer_user_id: userId };

    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await Referral.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'referred_user',
          attributes: ['user_id', 'name', 'email', 'createdAt'],
        },
      ],
      order: [['referred_at', 'DESC']],
      limit: Number(limit),
      offset,
    });

    return res.status(200).json({
      message: "Referrals retrieved successfully",
      data: {
        referrals: rows,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          total_pages: Math.ceil(count / Number(limit)),
        },
      },
    });
  } catch (error) {
    apiLogger.error("Error in listMyReferrals:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Apply referral code during signup
 * POST /api/referral/apply
 */
export const applyReferralCode = async (req: Request, res: Response) => {
  try {
    const { referral_code, user_id } = req.body;

    if (!referral_code || !user_id) {
      return res.status(400).json({
        message: "Referral code and user ID are required",
      });
    }

    // Find the referrer
    const referrer = await User.findOne({
      where: { referral_code },
    });

    if (!referrer) {
      return res.status(404).json({
        message: "Invalid referral code",
      });
    }

    // Check if user is trying to refer themselves
    if ((referrer as unknown as Record<string, unknown>).user_id === user_id) {
      return res.status(400).json({
        message: "You cannot refer yourself",
      });
    }

    // Check if referral already exists
    const existingReferral = await Referral.findOne({
      where: {
        referrer_user_id: (referrer as unknown as Record<string, unknown>).user_id,
        referred_user_id: user_id,
      },
    });

    if (existingReferral) {
      return res.status(400).json({
        message: "Referral already applied",
      });
    }

    // Create referral record
    const referral = await Referral.create({
      referrer_user_id: (referrer as unknown as Record<string, unknown>).user_id,
      referred_user_id: user_id,
      referral_code,
      status: 'pending',
      activation_requirement: 'first_transaction_100',
      bonus_amount: 10.00,
      bonus_currency: 'USD',
      referee_discount_percent: 50.00,
      referee_discount_duration_days: 30,
      referred_at: new Date(),
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    } as Record<string, unknown>);

    // Update referred_by_code in user table
    await User.update(
      { referred_by_code: referral_code },
      { where: { user_id } }
    );

    return res.status(200).json({
      message: "Referral code applied successfully",
      data: {
        referral_id: referral.referral_id,
        status: referral.status,
        bonus_info: {
          referrer_bonus: `$${referral.bonus_amount} ${referral.bonus_currency}`,
          referee_discount: `${referral.referee_discount_percent}% off fees for ${referral.referee_discount_duration_days} days`,
        },
      },
    });
  } catch (error) {
    apiLogger.error("Error in applyReferralCode:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Validate referral code
 * POST /api/referral/validate
 */
export const validateReferralCode = async (req: Request, res: Response) => {
  try {
    const { referral_code } = req.body;

    if (!referral_code) {
      return res.status(400).json({
        message: "Referral code is required",
      });
    }

    const referrer = await User.findOne({
      where: { referral_code },
      attributes: ['user_id', 'name', 'email'],
    });

    if (!referrer) {
      return res.status(404).json({
        message: "Invalid referral code",
        valid: false,
      });
    }

    return res.status(200).json({
      message: "Referral code is valid",
      valid: true,
      data: {
        referrer_name: (referrer as unknown as Record<string, unknown>).name,
        bonus_info: {
          referrer_bonus: "$10 USD",
          referee_discount: "50% off fees for 30 days",
        },
      },
    });
  } catch (error) {
    apiLogger.error("Error in validateReferralCode:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get referral earnings and rewards
 * GET /api/referral/earnings
 */
export const getReferralEarnings = async (_req: Request, res: Response) => {
  try {
    const userData = jwt.decode(res.locals.token) as IUserType;
    const userId = userData?.user_id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized. Please login.",
      });
    }

    const rewards = await ReferralReward.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Referral,
          as: 'referral',
          include: [
            {
              model: User,
              as: 'referred_user',
              attributes: ['name', 'email'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const summary = {
      total_earnings: rewards.reduce((sum, r) => sum + Number(r.amount), 0),
      pending_earnings: rewards
        .filter(r => r.status === 'pending')
        .reduce((sum, r) => sum + Number(r.amount), 0),
      credited_earnings: rewards
        .filter(r => r.status === 'credited')
        .reduce((sum, r) => sum + Number(r.amount), 0),
      withdrawn_earnings: rewards
        .filter(r => r.status === 'withdrawn')
        .reduce((sum, r) => sum + Number(r.amount), 0),
    };

    return res.status(200).json({
      message: "Earnings retrieved successfully",
      data: {
        summary,
        rewards,
      },
    });
  } catch (error) {
    apiLogger.error("Error in getReferralEarnings:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Process referral reward (internal function, called when conditions are met)
 * This should be called from transaction controller when a referred user completes qualifying transaction
 */
export const processReferralReward = async (userId: number, transactionAmount: number) => {
  try {
    // Find if user was referred
    const user = await User.findByPk(userId);
    if (!user || !(user as unknown as Record<string, unknown>).referred_by_code) {
      return null; // User wasn't referred
    }

    // Find referral record
    const referral = await Referral.findOne({
      where: {
        referred_user_id: userId,
        status: 'pending',
      },
    });

    if (!referral) {
      return null; // No pending referral
    }

    // Check if transaction meets activation requirement
    if (transactionAmount < 100) {
      return null; // Doesn't meet minimum transaction amount
    }

    // Activate referral
    await referral.update({
      status: 'active',
      activated_at: new Date(),
    });

    // Create reward for referrer
    const referrerReward = await ReferralReward.create({
      referral_id: referral.referral_id,
      user_id: referral.referrer_user_id,
      reward_type: 'bonus_credit',
      amount: referral.bonus_amount,
      currency: referral.bonus_currency,
      status: 'pending',
    } as Record<string, unknown>);

    // Update referrer's total earnings
    await User.increment(
      { referral_bonus_earned: referral.bonus_amount },
      { where: { user_id: referral.referrer_user_id } }
    );

    // Mark referral as rewarded
    await referral.update({
      status: 'rewarded',
      rewarded_at: new Date(),
    });

    // Referral reward = Transaction fee discount for both parties
    // The discount is applied during fee calculation in paymentController
    // based on user's referral_discount_percent in tbl_user
    apiLogger.info(`[Referral] Reward processed for user ${referral.referrer_user_id} - Fee discount will apply on future transactions`);

    return {
      referral_id: referral.referral_id,
      reward_id: referrerReward.reward_id,
      amount: referral.bonus_amount,
      currency: referral.bonus_currency,
    };
  } catch (error) {
    apiLogger.error("Error in processReferralReward:", error);
    throw error;
  }
};

/**
 * Get referral leaderboard (top referrers)
 * GET /api/referral/leaderboard
 */
export const getReferralLeaderboard = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const leaderboard = await User.findAll({
      attributes: [
        'user_id',
        'name',
        'referral_code',
        'referral_count',
        'referral_bonus_earned',
      ],
      where: {
        referral_count: {
          [Op.gt]: 0,
        },
      },
      order: [['referral_count', 'DESC']],
      limit: Number(limit),
    });

    return res.status(200).json({
      message: "Leaderboard retrieved successfully",
      data: {
        leaderboard: leaderboard.map((user, index) => ({
          rank: index + 1,
          user_id: (user as unknown as Record<string, unknown>).user_id,
          name: (user as unknown as Record<string, unknown>).name,
          referral_count: (user as unknown as Record<string, unknown>).referral_count,
          total_earnings: (user as unknown as Record<string, unknown>).referral_bonus_earned,
        })),
      },
    });
  } catch (error) {
    apiLogger.error("Error in getReferralLeaderboard:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ============================================
// REFEREE CODE ENDPOINTS (Type 2)
// ============================================

/**
 * Validate referee code (from payment link email)
 * POST /api/referral/referee/validate
 */
const validateRefereeCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        message: "Referee code is required",
        valid: false,
      });
    }

    // Import referee code model
    const RefereeCode = (await import('../models/referralModels/refereeCodeModel')).default;

    const refereeCode = await RefereeCode.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!refereeCode) {
      return res.status(404).json({
        message: "Invalid referee code",
        valid: false,
      });
    }

    // Check if expired
    if (new Date() > refereeCode.expires_at) {
      return res.status(400).json({
        message: "Referee code has expired",
        valid: false,
      });
    }

    // Check if already used
    if (refereeCode.status === 'used') {
      return res.status(400).json({
        message: "Referee code has already been used",
        valid: false,
      });
    }

    return res.status(200).json({
      message: "Valid referee code",
      valid: true,
      data: {
        discount_percent: refereeCode.discount_percent,
        discount_duration_days: refereeCode.discount_duration_days,
        expires_at: refereeCode.expires_at,
      },
    });
  } catch (error) {
    apiLogger.error("Error in validateRefereeCode:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Redeem referee code (called during/after signup)
 * POST /api/referral/referee/redeem
 */
const redeemRefereeCode = async (req: Request, res: Response) => {
  try {
    const { code, user_id, email } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Referee code is required",
      });
    }

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Import referee code service
    const { redeemRefereeCode: redeemCode } = await import('../services/referralService');

    const result = await redeemCode({
      code,
      userEmail: email || '',
      userId: user_id,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    apiLogger.error("Error in redeemRefereeCode:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get current user's discount status
 * GET /api/referral/discount-status
 */
const getDiscountStatus = async (req: Request, res: Response) => {
  try {
    // Get user from res.locals (set by authMiddleware)
    const token = (req as any).headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "Authorization required" });
    }

    const decoded = jwt.decode(token) as { user_id?: number; email?: string; [key: string]: unknown };
    if (!decoded || !decoded.user_id) {
      return res.status(401).json({ message: "Invalid token" });
    }
    
    const userId = decoded.user_id;

    const user = await User.findByPk(userId, {
      attributes: [
        'fee_discount_percent',
        'fee_discount_expires_at',
        'fee_discount_reason',
        'referred_by_code',
        'referred_by_referee_code',
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = user as unknown as Record<string, unknown>;
    const discountPercent = Number(userData.fee_discount_percent) || 0;
    const expiresAt = userData.fee_discount_expires_at as Date | null;
    const reason = userData.fee_discount_reason as string | null;

    // Check if discount is still active
    const isActive = expiresAt && new Date() < new Date(expiresAt) && discountPercent > 0;

    return res.status(200).json({
      message: "Discount status retrieved successfully",
      data: {
        has_discount: isActive,
        discount_percent: isActive ? discountPercent : 0,
        expires_at: isActive ? expiresAt : null,
        reason: isActive ? reason : null,
        days_remaining: isActive
          ? Math.ceil((new Date(expiresAt as Date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 0,
      },
    });
  } catch (error) {
    apiLogger.error("Error in getDiscountStatus:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export default {
  getMyReferralCode,
  listMyReferrals,
  applyReferralCode,
  validateReferralCode,
  getReferralEarnings,
  processReferralReward,
  getReferralLeaderboard,
  generateReferralCode,
  // Referee Code (Type 2)
  validateRefereeCode,
  redeemRefereeCode,
  getDiscountStatus,
};
