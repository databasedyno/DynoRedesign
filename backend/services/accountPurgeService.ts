import { Op } from "sequelize";
import { userModel, userWalletModel, companyModel, apiModel, paymentLinkModel } from "../models";
import { userWalletAddressModel } from "../models/userModels";
import notificationModel from "../models/notificationModel";
import notificationPreferencesModel from "../models/notificationPreferencesModel";
import kycModel from "../models/kycModel";
import { deleteRedisItem } from "../utils/redisInstance";
import { revokeAllUserSessions } from "./sessionService";
import { invalidateUserAuthCache } from "../middleware/authMiddleware";
import { userLogger } from "../utils/loggers";
import { getErrorMessage } from "../helper";
import { ACCOUNT_DELETE_GRACE_DAYS } from "../helper/accountDeletion";
import { sendAccountDeletedEmail } from "./emailService";

/**
 * Soft-delete a user account: mark it for deletion (7-day grace), then log the
 * user out everywhere (revoke sessions + move the token cutoff) and drop the
 * auth cache so any live JWT is rejected on the next request. NO data is removed
 * here — that happens at purge time (after the grace window) or on admin purge.
 */
export const softDeleteAccount = async (
  userId: number | string,
  deletedBy: number | string,
): Promise<{ ok: boolean; scheduledPurgeAt: Date }> => {
  const now = new Date();
  const scheduledPurgeAt = new Date(now.getTime() + ACCOUNT_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const [affected] = await userModel.update(
    { deleted_at: now, deleted_by: deletedBy, scheduled_purge_at: scheduledPurgeAt } as any,
    { where: { user_id: userId, deleted_at: null } },
  );
  if (!affected) {
    return { ok: false, scheduledPurgeAt };
  }

  // Log out everywhere: deactivate sessions + move tokens_valid_after=now.
  try { await revokeAllUserSessions(Number(userId), "account_soft_deleted"); } catch (e) {
    userLogger.warn(`[softDeleteAccount] session revoke failed for user ${userId}: ${getErrorMessage(e)}`);
  }
  await invalidateUserAuthCache(userId);
  userLogger.info(`Account ${userId} soft-deleted — purge scheduled for ${scheduledPurgeAt.toISOString()}`);
  return { ok: true, scheduledPurgeAt };
};

/** Restore a soft-deleted account (admin, within the grace window). */
export const restoreAccount = async (userId: number | string): Promise<boolean> => {
  const [affected] = await userModel.update(
    { deleted_at: null, deleted_by: null, scheduled_purge_at: null } as any,
    { where: { user_id: userId } },
  );
  await invalidateUserAuthCache(userId);
  if (affected) userLogger.info(`Account ${userId} restored`);
  return affected > 0;
};

/**
 * Permanently delete an account and ALL of its data. This is the irreversible
 * cleanup that used to run inline in deleteAccount — now deferred to purge time.
 * Mirrors the previous cascade order.
 */
export const purgeAccount = async (user: {
  user_id: number | string;
  email?: string | null;
  name?: string | null;
  language?: string | null;
}): Promise<boolean> => {
  const userId = user.user_id;

  await notificationModel.destroy({ where: { user_id: userId } });
  await notificationPreferencesModel.destroy({ where: { user_id: userId } });
  await kycModel.destroy({ where: { user_id: userId } });
  await userWalletAddressModel.destroy({ where: { user_id: userId } });
  await userWalletModel.destroy({ where: { user_id: userId } });
  await apiModel.destroy({ where: { user_id: userId } });
  // force so paranoid companyModel actually removes the brand rows.
  await companyModel.destroy({ where: { user_id: userId }, force: true });

  try {
    const userPaymentLinks = await paymentLinkModel.findAll({ where: { user_id: userId }, attributes: ["payment_link"] });
    for (const link of userPaymentLinks) {
      const urlMatch = link.dataValues.payment_link?.match(/[?&]d=([a-f0-9]+)/i);
      if (urlMatch && urlMatch[1]) await deleteRedisItem("customer-" + urlMatch[1]);
    }
    await paymentLinkModel.destroy({ where: { user_id: userId } });
    await deleteRedisItem(`dashboard:${userId}:all`);
    await deleteRedisItem(`profile:${userId}`);
    await deleteRedisItem(`wallets:${userId}`);
    if (user.email) await deleteRedisItem(user.email + "-withdrawal-otp");
  } catch (redisErr) {
    userLogger.warn(`[purgeAccount] Redis cleanup failed for user ${userId}: ${getErrorMessage(redisErr)}`);
  }

  try { await revokeAllUserSessions(Number(userId), "account_purged"); } catch (_e) { /* non-fatal */ }
  await invalidateUserAuthCache(userId);

  const rows = await userModel.destroy({ where: { user_id: userId } });
  if (rows === 0) {
    userLogger.error(`[purgeAccount] destroy affected 0 rows for user ${userId}`);
    return false;
  }
  userLogger.info(`Account ${userId} permanently purged`);

  if (user.email) {
    try { await sendAccountDeletedEmail(user.email, user.name || "", user.language); } catch (e) {
      userLogger.warn(`[purgeAccount] permanently-deleted email failed for user ${userId}: ${getErrorMessage(e)}`);
    }
  }
  return true;
};

/** Sweep accounts past their 7-day grace window and purge them permanently. */
export const purgeExpiredAccounts = async (): Promise<{ scanned: number; purged: number; failed: number }> => {
  const now = new Date();
  const due = await userModel.findAll({
    where: { deleted_at: { [Op.ne]: null }, scheduled_purge_at: { [Op.ne]: null, [Op.lte]: now } },
    attributes: ["user_id", "email", "name", "language"],
  });

  let purged = 0;
  let failed = 0;
  for (const u of due) {
    try {
      const ok = await purgeAccount({
        user_id: u.dataValues.user_id,
        email: u.dataValues.email,
        name: u.dataValues.name,
        language: u.dataValues.language,
      });
      ok ? purged++ : failed++;
    } catch (e) {
      failed++;
      userLogger.error(`[purgeExpiredAccounts] Failed to purge user ${u.dataValues.user_id}: ${getErrorMessage(e)}`);
    }
  }
  if (due.length > 0) userLogger.info(`[purgeExpiredAccounts] Scanned ${due.length}, purged ${purged}, failed ${failed}`);
  return { scanned: due.length, purged, failed };
};
