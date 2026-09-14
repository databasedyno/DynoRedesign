// Model associations for referral and knowledge base models
// Using a flag to ensure associations are only set up once
import { apiLogger } from '../utils/loggers';
import User from './userModels/userModel';
import Referral from './referralModels/referralModel';
import ReferralReward from './referralModels/referralRewardModel';
import KBCategory from './knowledgeBaseModels/kbCategoryModel';
import KBArticle from './knowledgeBaseModels/kbArticleModel';
import KBArticleFeedback from './knowledgeBaseModels/kbArticleFeedbackModel';
import User2FA from './securityModels/user2FAModel';
import UserSession from './securityModels/userSessionModel';
import LoginHistory from './securityModels/loginHistoryModel';
import SecurityLog from './securityModels/securityLogModel';

// Check if associations have already been set up
const associationsSetUp = (User as unknown as { associations?: Record<string, unknown> }).associations && Object.keys((User as unknown as { associations?: Record<string, unknown> }).associations).length > 5;

if (!associationsSetUp) {
  // Referral associations
  Referral.belongsTo(User, { foreignKey: 'referrer_user_id', as: 'referrer' });
  Referral.belongsTo(User, { foreignKey: 'referred_user_id', as: 'referred_user' });

  User.hasMany(Referral, { foreignKey: 'referrer_user_id', as: 'referrals_made' });
  User.hasMany(Referral, { foreignKey: 'referred_user_id', as: 'referrals_received' });

  ReferralReward.belongsTo(Referral, { foreignKey: 'referral_id', as: 'referral' });
  ReferralReward.belongsTo(User, { foreignKey: 'user_id', as: 'reward_user' });

  Referral.hasMany(ReferralReward, { foreignKey: 'referral_id', as: 'rewards' });
  User.hasMany(ReferralReward, { foreignKey: 'user_id', as: 'referral_rewards' });

  // Knowledge Base associations
  KBArticle.belongsTo(KBCategory, { foreignKey: 'category_id', as: 'category' });
  KBArticle.belongsTo(User, { foreignKey: 'author_id', as: 'author' });

  KBCategory.hasMany(KBArticle, { foreignKey: 'category_id', as: 'articles' });
  User.hasMany(KBArticle, { foreignKey: 'author_id', as: 'kb_articles' });

  KBArticleFeedback.belongsTo(KBArticle, { foreignKey: 'article_id', as: 'article' });
  KBArticleFeedback.belongsTo(User, { foreignKey: 'user_id', as: 'feedback_user' });

  KBArticle.hasMany(KBArticleFeedback, { foreignKey: 'article_id', as: 'feedbacks' });

  // Security associations
  User2FA.belongsTo(User, { foreignKey: 'user_id', as: 'twofa_user' });
  User.hasOne(User2FA, { foreignKey: 'user_id', as: 'two_factor_auth' });

  UserSession.belongsTo(User, { foreignKey: 'user_id', as: 'session_user' });
  User.hasMany(UserSession, { foreignKey: 'user_id', as: 'sessions' });

  LoginHistory.belongsTo(User, { foreignKey: 'user_id', as: 'login_user' });
  User.hasMany(LoginHistory, { foreignKey: 'user_id', as: 'login_history' });

  SecurityLog.belongsTo(User, { foreignKey: 'user_id', as: 'security_user' });
  User.hasMany(SecurityLog, { foreignKey: 'user_id', as: 'security_logs' });
  
  apiLogger.info('Model associations set up successfully');
}

// Export models for easy access
export {
  User,
  Referral,
  ReferralReward,
  KBCategory,
  KBArticle,
  KBArticleFeedback,
  User2FA,
  UserSession,
  LoginHistory,
  SecurityLog,
};
