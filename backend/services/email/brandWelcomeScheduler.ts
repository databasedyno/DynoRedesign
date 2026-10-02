/**
 * Delayed "brand welcome" email (onboarding UX, 2026-10).
 *
 * When a merchant completes their brand details for the FIRST time (wizard step
 * "About you"), we do not fire the "brand details were changed" alert. Instead a
 * welcome email is scheduled ~10 minutes later, so it lands after they have
 * (most likely) finished the wizard rather than interrupting it.
 *
 * Delivery: a BullMQ delayed job on the shared Redis (survives restarts; the
 * worker runs on the background-jobs instance like the webhook worker). When
 * outbound email is disabled on this instance (preview pod wired to the LIVE
 * Redis) we deliberately do NOT enqueue — the production worker would pick the
 * job up and send for real — and fall back to an in-process timer so the email
 * still reaches EMAIL_DUMP_DIR for review.
 */
import { Queue, Worker } from "bullmq";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { raw as envRaw } from "../../utils/config";
import { apiLogger, log } from "../../utils/loggers";
import { getRedisItem, setRedisItemWithTTL } from "../../utils/redisInstance";
import { captureError } from "../errorMonitoringService";
import { sendBrandWelcomeEmail } from "./companyEmails";

const QUEUE_NAME = "onboarding-emails";
const JOB_BRAND_WELCOME = "brand_welcome";
export const BRAND_WELCOME_DELAY_MS = Number(envRaw("BRAND_WELCOME_DELAY_MS")) || 10 * 60 * 1000;
const SENT_KEY = (companyId: number) => `brand_welcome_sent:${companyId}`;
const SENT_TTL_SEC = 30 * 24 * 3600;

interface BrandWelcomeJob {
  userId: number;
  companyId: number;
}

const parseRedisUrl = (url: string) => {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
    username: parsed.username && parsed.username !== "default" ? parsed.username : undefined,
  };
};

let queue: Queue | null = null;
const getQueue = () => {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: parseRedisUrl(envRaw("REDIS_PUBLIC_URL") || "redis://localhost:6379"),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 60_000 },
        removeOnComplete: { age: 7 * 86400, count: 1000 },
        removeOnFail: { age: 30 * 86400 },
      },
    });
  }
  return queue;
};

const outboundDisabled = () => envRaw("DISABLE_OUTBOUND_EMAIL") === "true";

/** Runs at delivery time: re-reads live data so name/brand/wallet state are current, dedupes per brand. */
export const deliverBrandWelcome = async ({ userId, companyId }: BrandWelcomeJob): Promise<"sent" | "skipped"> => {
  const already = await getRedisItem(SENT_KEY(companyId));
  if (already && Object.keys(already as object).length > 0) return "skipped";

  const rows = await sequelize.query<{
    email: string | null;
    name: string | null;
    language: string | null;
    company_name: string | null;
    country: string | null;
    wallets: string;
  }>(
    `SELECT u.email, u.name, u.language, c.company_name, c.country,
            (SELECT COUNT(*) FROM tbl_user_wallet w
              WHERE w.company_id = c.company_id AND COALESCE(w.wallet_address, '') <> '') AS wallets
       FROM tbl_company c
       JOIN tbl_user u ON u.user_id = c.user_id
      WHERE c.company_id = :companyId AND c.user_id = :userId
      LIMIT 1`,
    { replacements: { companyId, userId }, type: QueryTypes.SELECT }
  );
  const row = rows[0];
  // Brand deleted, or details rolled back before delivery → nothing to welcome.
  if (!row?.email || !String(row.country ?? "").trim()) return "skipped";

  await setRedisItemWithTTL(SENT_KEY(companyId), { sent_at: new Date().toISOString() }, SENT_TTL_SEC);
  await sendBrandWelcomeEmail(row.email, row.name || "", row.company_name || "", { hasWallet: Number(row.wallets) > 0 }, row.language);
  return "sent";
};

/** Called from updateCompany on the first completion of brand details. Fire-and-forget safe. */
export const scheduleBrandWelcomeEmail = async (job: BrandWelcomeJob): Promise<void> => {
  try {
    if (outboundDisabled()) {
      // Preview: keep the job OFF the shared Redis (prod worker would send it for real).
      const timer = setTimeout(() => {
        deliverBrandWelcome(job).catch((e) => apiLogger.error("[BrandWelcome] preview delivery failed", e));
      }, BRAND_WELCOME_DELAY_MS);
      timer.unref();
      apiLogger.info(`[BrandWelcome] preview timer set (${BRAND_WELCOME_DELAY_MS}ms) for company ${job.companyId}`);
      return;
    }
    await getQueue().add(JOB_BRAND_WELCOME, job, {
      delay: BRAND_WELCOME_DELAY_MS,
      jobId: `${JOB_BRAND_WELCOME}:${job.companyId}`,
    });
    apiLogger.info(`[BrandWelcome] scheduled in ${BRAND_WELCOME_DELAY_MS}ms for company ${job.companyId}`);
  } catch (e) {
    captureError(e, "email", { extraContext: "scheduleBrandWelcomeEmail" });
  }
};

let worker: Worker | null = null;
/** Start on the background-jobs instance only (same place as the webhook worker). */
export const startBrandWelcomeWorker = (): void => {
  if (worker) return;
  worker = new Worker<BrandWelcomeJob>(
    QUEUE_NAME,
    async (job) => {
      if (job.name !== JOB_BRAND_WELCOME) return;
      const outcome = await deliverBrandWelcome(job.data);
      log(`[BrandWelcome] job ${job.id} ${outcome} (company ${job.data.companyId})`, "info");
    },
    { connection: parseRedisUrl(envRaw("REDIS_PUBLIC_URL") || "redis://localhost:6379"), concurrency: 2 }
  );
  worker.on("failed", (job, err) => {
    log(`[BrandWelcome] job ${job?.id} failed: ${err.message}`, "error");
    captureError(err, "email", { extraContext: "brandWelcomeWorker" });
  });
};
