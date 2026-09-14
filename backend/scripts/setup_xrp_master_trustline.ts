/**
 * One-shot: set the RLUSD trust line on the XRP_MASTER wallet.
 *
 * The tag-based XRP/RLUSD receiving flow uses a single master account
 * (XRP_MASTER_WALLET) that every merchant's deposit address points to via a
 * unique destination tag. For the master to RECEIVE RLUSD (and for reliable
 * sweeping) it must (1) be activated with the base reserve and (2) hold an
 * RLUSD trust line to the issuer. Funding is done by the operator; this script
 * does step (2) using the master secret stored KMS-encrypted in the DB.
 *
 * Idempotent: exits early if the trust line already exists.
 *
 * Usage:
 *   cd /app/backend
 *   npx ts-node --transpile-only scripts/setup_xrp_master_trustline.ts
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { Sequelize, DataTypes } from "sequelize";
import tatumApi from "../apis/tatumApi";

async function main() {
  const required = [
    "DATABASE_URL",
    "TATUM_KEY",
    "TEMP_KEY_ID",
    "PROJECT_ID",
    "LOCATION_ID",
    "KEY_RING_ID",
    "PRIVATE_KEY_ID",
    "GOOGLE_CLIENT_EMAIL",
    "GOOGLE_CLIENT_KEY",
    "RLUSD_ISSUER",
    "RLUSD_CURRENCY_HEX",
    "XRP_MASTER_WALLET",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("❌ Missing env vars:", missing.join(", "));
    process.exit(1);
  }

  const issuer = process.env.RLUSD_ISSUER!;
  const currencyHex = process.env.RLUSD_CURRENCY_HEX!;
  const envMaster = process.env.XRP_MASTER_WALLET!;

  const sequelize = new Sequelize(process.env.DATABASE_URL!, {
    dialect: "postgres",
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false,
  });

  const AdminFeeWallet = sequelize.define(
    "tbl_admin_fee_wallet",
    {
      fee_wallet_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      wallet_type: { type: DataTypes.STRING(255), defaultValue: "USD" },
      wallet_address: DataTypes.STRING(255),
      xpub: DataTypes.TEXT,
      mnemonic: DataTypes.TEXT,
      privateKey: DataTypes.TEXT,
      amount: { type: DataTypes.DOUBLE, defaultValue: 0 },
    },
    { tableName: "tbl_admin_fee_wallet", timestamps: true }
  );

  try {
    await sequelize.authenticate();
    console.log("✅ Connected to prod DB");

    const row: any = await AdminFeeWallet.findOne({ where: { wallet_type: "XRP_MASTER" } });
    if (!row) throw new Error("No XRP_MASTER row in tbl_admin_fee_wallet — run provision_xrp_master.ts first");

    const masterAddr = row.dataValues.wallet_address;
    const encryptedKey = row.dataValues.privateKey;
    console.log(`   XRP_MASTER (DB):  ${masterAddr}`);
    console.log(`   XRP_MASTER (env): ${envMaster}`);
    if (masterAddr !== envMaster) {
      console.warn(`   ⚠️  DB and env XRP_MASTER differ — proceeding with the DB address (${masterAddr}), which owns the secret.`);
    }

    // 1) Activation check
    console.log("1️⃣  Checking on-ledger activation...");
    const activated = await tatumApi.verifyXrpAccountActivated(masterAddr);
    if (!activated) {
      throw new Error(`Master ${masterAddr} is NOT activated on-ledger. Fund it with >= ~2 XRP first, then re-run.`);
    }
    console.log("   ✅ Activated (funded)");

    // 2) Already has the trust line?
    console.log("2️⃣  Checking for existing RLUSD trust line...");
    const already = await tatumApi.verifyXrpTrustLine(masterAddr, issuer, currencyHex);
    if (already) {
      console.log("   ✅ RLUSD trust line already exists — nothing to do. Setup complete.");
      return;
    }
    console.log("   ℹ️  No RLUSD trust line yet — creating one.");

    // 3) Decrypt master secret (scoped, never logged)
    console.log("3️⃣  Decrypting master secret via KMS (TEMP_KEY_ID)...");
    const secret = await tatumApi.decryptSymmetric(encryptedKey, process.env.TEMP_KEY_ID);
    if (!secret || typeof secret !== "string" || !secret.startsWith("s")) {
      throw new Error("Decrypted secret is not a valid XRP family seed");
    }
    console.log("   ✅ Secret decrypted (KMS roundtrip OK)");

    // 4) Submit the TrustSet (Tatum SDK -> local-sign + RPC fallback, both inside setupXrpTrustLine)
    console.log(`4️⃣  Submitting TrustSet: ${masterAddr} → issuer ${issuer} (RLUSD), limit 999999999 ...`);
    const result: any = await tatumApi.setupXrpTrustLine(masterAddr, secret, issuer, currencyHex, "999999999");
    console.log("   ✅ TrustSet submitted:", JSON.stringify(result));

    // 5) Verify (poll a few times for ledger validation)
    console.log("5️⃣  Verifying on-ledger...");
    let confirmed = false;
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      confirmed = await tatumApi.verifyXrpTrustLine(masterAddr, issuer, currencyHex);
      if (confirmed) break;
      console.log(`   … not yet visible (attempt ${i + 1}/8)`);
    }

    console.log("\n=====================================================");
    if (confirmed) {
      console.log("✅ DONE — RLUSD trust line is LIVE on the master. XRP + RLUSD address generation is ready.");
    } else {
      console.log("⚠️  TrustSet submitted but not yet visible as validated. It usually settles in <60s — re-run to re-verify.");
    }
    console.log("=====================================================");
  } finally {
    await sequelize.close();
  }
}

main().catch((e: any) => {
  console.error("❌ Trust-line setup failed:", e?.message || e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
