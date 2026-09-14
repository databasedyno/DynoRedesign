/**
 * One-time recovery script for the stuck $42 BTC payment (link_id=920)
 * 
 * This script:
 * 1. Sets the crypto-{address} Redis key with payment data
 * 2. Clears any processed-tx marker
 * 3. Enqueues the webhook for processing by the BullMQ worker
 * 
 * Run from /app/backend: npx ts-node scripts/recover-payment-920.ts
 */

import IORedis from "ioredis";
import { Queue } from "bullmq";

const REDIS_URL = process.env.REDIS_PUBLIC_URL || "redis://default:nGRWpSIBrXftcfgRCQDxtAJGowmXlgUg@turntable.proxy.rlwy.net:21752";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
    username: parsed.username && parsed.username !== "default" ? parsed.username : undefined,
    maxRetriesPerRequest: null as null,
  };
}

async function main() {
  console.log("🔧 Starting payment recovery for link_id=920...\n");

  const redisConfig = parseRedisUrl(REDIS_URL);
  const redis = new IORedis(redisConfig);

  try {
    // Test connection
    await redis.ping();
    console.log("✅ Connected to Redis\n");

    // Payment details
    const ADDRESS = "bc1q8dz3yeqkp37uewpsul0h68mj5srwg2akds8get";
    const TX_ID = "3f1a82a823b5ab20a0576067f6f967e17f8c1dbbf8ab740296f4ef964515b690";
    const AMOUNT = "0.00060867";
    const ASSET = "BTC";
    const TEMP_ADDRESS_ID = 197;
    const LINK_ID = 920;
    const TRANSACTION_ID = "3447e1f8-7ba7-4a6d-9f95-e8be47516b98";
    const UNIQUE_REF = "11cf30c7f8fcc76dc274a3260727807e18ba2b4236cfc8da";
    const COMPANY_ID = 3;
    const USER_ID = 4;

    const cryptoRedisKey = `crypto-${ADDRESS}`;

    // Step 1: Check existing crypto key
    const existing = await redis.get(cryptoRedisKey);
    if (existing) {
      const parsed = JSON.parse(existing);
      console.log(`⚠️  Existing crypto key found: status=${parsed.status}`);
      if (parsed.status === "successful" || parsed.status === "payout_complete") {
        console.log("❌ Payment already completed. Aborting.");
        process.exit(0);
      }
    }

    // Step 2: Set the crypto-{address} Redis key
    const cryptoData = {
      mode: "crypto",
      base_amount_usd: "42",
      total_amount_usd: "42",
      status: "pending",
      ref: UNIQUE_REF,
      currency: ASSET,
      payment_id: TRANSACTION_ID,
      unique_tx_id: TRANSACTION_ID,
      walletType: "customer",
      temp_id: TEMP_ADDRESS_ID,
      is_merchant_pool: "true",
      fee_payer: "company",
      company_id: COMPANY_ID,
      link_id: LINK_ID,
      recovery_origin: "manual_script_recovery",
      recovered_at: new Date().toISOString(),
    };

    await redis.set(cryptoRedisKey + ':json', JSON.stringify(cryptoData));
    // Also set as hash for backward compatibility
    for (const [field, val] of Object.entries(cryptoData)) {
      if (val !== null && val !== undefined) {
        await redis.hset(cryptoRedisKey, field, String(val));
      }
    }
    console.log(`✅ Set ${cryptoRedisKey} with payment data (json + hash)`);
    console.log(`   Amount: $42 USD, Payment: ${ASSET}`);
    console.log(`   Link ID: ${LINK_ID}, Temp Address ID: ${TEMP_ADDRESS_ID}\n`);

    // Step 3: Clear any processed-tx marker
    const processedTxKey = `processed-tx-${TX_ID}`;
    const processedMarker = await redis.get(processedTxKey);
    if (processedMarker) {
      await redis.del(processedTxKey);
      console.log(`✅ Cleared processed-tx marker for ${TX_ID.substring(0, 16)}...`);
    } else {
      console.log(`ℹ️  No processed-tx marker found (expected - job was never processed)`);
    }

    // Step 4: Clear any lock
    const lockKey = `tatum-webhook-${TX_ID}`;
    await redis.del(lockKey);
    console.log(`✅ Cleared any stale lock for tx\n`);

    // Step 5: Enqueue webhook to BullMQ
    const queue = new Queue("tatum-webhooks", {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 30000 },
      },
    });

    const webhookData = {
      payload: {
        address: ADDRESS,
        amount: AMOUNT,
        txId: TX_ID,
        asset: ASSET,
      },
      queryParams: {
        company_id: COMPANY_ID,
        user_id: USER_ID,
        address_id: TEMP_ADDRESS_ID,
      },
      receivedAt: new Date().toISOString(),
      source: "reconciliation",
    };

    const jobId = `recovery-${TX_ID.substring(0, 16)}-${Date.now()}`;
    const job = await queue.add("process-webhook", webhookData, {
      jobId,
      priority: 1, // High priority
    });

    console.log(`✅ Enqueued recovery webhook job: ${job.id}`);
    console.log(`   TX: ${TX_ID.substring(0, 32)}...`);
    console.log(`   Amount: ${AMOUNT} ${ASSET}`);
    console.log(`   Address: ${ADDRESS}\n`);

    // Step 6: Verify queue health
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    console.log(`📊 Queue status: waiting=${waiting}, active=${active}, completed=${completed}`);

    console.log("\n🎯 Recovery job enqueued! The BullMQ worker should process it shortly.");
    console.log("   Check backend logs for [WebhookProcessor] and [WebhookQueue] messages.\n");

    await queue.close();
  } finally {
    await redis.quit();
  }
}

main().catch(console.error);
