/**
 * Volume-tier reconciliation.
 *
 * Runs nightly. For every non-trial merchant, computes their all-time confirmed
 * USD transaction volume and looks up which tier they should be on (per
 * `volumeTierUtils.getTierForVolume`). If the tier differs from the value in
 * `tbl_user.fee_tier`, it is updated in place. Upgrades trigger a "your fee tier
 * just dropped" email. Downgrades are silent (they still happen — but sending an
 * email that says "your fees just went up" is a bad experience; the merchant will
 * see the new tier the next time they open the dashboard).
 *
 * The `trial` state is untouched by this cron — that flow is owned by
 * `feeFreeService.completeFeeFree` (fires when a trial user exceeds
 * FREE_TRIAL_VOLUME_USD, moves them to `starter`).
 *
 * SAFE against production: read-heavy, single UPDATE per changed row, and
 * disabled entirely when ENABLE_BACKGROUND_JOBS=false (guarded in server.ts).
 */
import { cronLogger } from "../utils/loggers";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import { getTierForVolume, getTierByName } from "../utils/volumeTierUtils";
import emailService from "./emailService";
import { toFixedStr } from "../utils/money";

interface UserRow {
  user_id: number;
  email: string;
  name: string;
  fee_tier: string;
  language?: string;
  total_usd_volume: number | string;
}

const USD_LIKE = [
  "USD", "USDT", "USDC", "BUSD", "DAI",
  "USDT-TRC20", "USDT-ERC20", "USDC-ERC20", "USDT-POLYGON",
  "USDT_TRC20", "USDT_ERC20", "USDC_ERC20",
];

export const reconcileVolumeTiers = async (): Promise<{
  upgraded: number;
  downgraded: number;
  unchanged: number;
  skipped: number;
  total: number;
}> => {
  cronLogger.info("[volumeTierReconciliation] Starting nightly tier reconciliation...");

  // Fetch every non-trial merchant + their confirmed all-time USD volume.
  // Matches the same USD-fallback formula used by dashboardController::getFeeTiers.
  const users = (await sequelize.query(
    `SELECT u.user_id, u.email, u.name, u.fee_tier, u.language,
      COALESCE(SUM(
        COALESCE(
          NULLIF(ut.usd_value, 0),
          CASE WHEN UPPER(ut.base_currency) IN (:usdLike)
               THEN ut.base_amount ELSE 0 END
        )
      ), 0) AS total_usd_volume
     FROM tbl_user u
     LEFT JOIN tbl_user_transaction ut ON ut.user_id = u.user_id
     WHERE u.fee_tier IS NOT NULL
       AND u.fee_tier != 'trial'
     GROUP BY u.user_id, u.email, u.name, u.fee_tier, u.language`,
    {
      replacements: { usdLike: USD_LIKE },
      type: QueryTypes.SELECT,
    },
  )) as UserRow[];

  let upgraded = 0;
  let downgraded = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const user of users) {
    const currentTierName = (user.fee_tier || "").toLowerCase().trim();
    const volumeUSD = Number(user.total_usd_volume) || 0;
    const target = getTierForVolume(volumeUSD);
    const current = getTierByName(currentTierName);

    if (target.name === current.name) {
      unchanged++;
      continue;
    }

    try {
      await sequelize.query(
        `UPDATE tbl_user
           SET fee_tier = :tier, "updatedAt" = NOW()
         WHERE user_id = :userId`,
        {
          replacements: { tier: target.name, userId: user.user_id },
          type: QueryTypes.UPDATE,
        },
      );

      // Lower % = better tier = upgrade
      const isUpgrade = target.percent < current.percent;
      if (isUpgrade) {
        upgraded++;
        cronLogger.info(
          `[volumeTierReconciliation] UPGRADE user=${user.user_id} ` +
            `(${current.displayName} ${current.percent}% → ${target.displayName} ${target.percent}%) ` +
            `volume=$${toFixedStr(volumeUSD, 2)}`,
        );
        // Fire-and-forget upgrade email (best-effort, does not block reconciliation)
        try {
          if (typeof (emailService as any).sendVolumeTierUpgradeEmail === "function") {
            await (emailService as any).sendVolumeTierUpgradeEmail(user.email, {
              name: user.name || user.email.split("@")[0],
              previousTier: current.displayName,
              previousPercent: current.percent,
              newTier: target.displayName,
              newPercent: target.percent,
              totalVolumeUsd: volumeUSD,
              language: user.language || "en",
            });
          }
        } catch (emailErr) {
          cronLogger.warn(
            `[volumeTierReconciliation] Failed to send upgrade email to ${user.email}: ${(emailErr as Error).message}`,
          );
        }
      } else {
        downgraded++;
        cronLogger.info(
          `[volumeTierReconciliation] DOWNGRADE user=${user.user_id} ` +
            `(${current.displayName} ${current.percent}% → ${target.displayName} ${target.percent}%) ` +
            `volume=$${toFixedStr(volumeUSD, 2)}`,
        );
      }
    } catch (err) {
      skipped++;
      cronLogger.error(
        `[volumeTierReconciliation] Failed to update user ${user.user_id}: ${(err as Error).message}`,
      );
    }
  }

  const total = users.length;
  cronLogger.info(
    `[volumeTierReconciliation] Complete: total=${total}, upgraded=${upgraded}, downgraded=${downgraded}, unchanged=${unchanged}, skipped=${skipped}`,
  );

  return { upgraded, downgraded, unchanged, skipped, total };
};

export default reconcileVolumeTiers;
