/**
 * One-shot provisioning — creates a BRAND-NEW XRP master wallet for the
 * tag-based XRP/RLUSD receiving flow, KMS-encrypts its secret via GCP KMS
 * (TEMP_KEY_ID), and inserts it into tbl_admin_fee_wallet as wallet_type='XRP_MASTER'.
 *
 * Why: addAddressToMerchantPool() looks up the XRP_MASTER admin-fee row to copy
 * the master private key into each tag-based pool address. Without it, XRP/RLUSD
 * address generation throws and no deposit address is ever produced.
 *
 * The new secret is printed ONCE to stdout so the operator can (1) fund the
 * address with >= ~2 XRP (base reserve + RLUSD trust-line reserve) and (2) set up
 * the RLUSD trust line. It is also stored KMS-encrypted in the privateKey column.
 *
 * Idempotent: refuses to run if an XRP_MASTER row already exists.
 *
 * Usage:
 *   cd /app/backend
 *   npx ts-node --transpile-only scripts/provision_xrp_master.ts
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
    "PROJECT_ID",
    "LOCATION_ID",
    "KEY_RING_ID",
    "TEMP_KEY_ID",
    "PRIVATE_KEY_ID",
    "GOOGLE_CLIENT_EMAIL",
    "GOOGLE_CLIENT_KEY",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("❌ Missing env vars:", missing.join(", "));
    process.exit(1);
  }

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
      feeLimit: { type: DataTypes.DOUBLE, defaultValue: 100 },
      alert_duration: { type: DataTypes.INTEGER, defaultValue: 12 },
    },
    { tableName: "tbl_admin_fee_wallet", timestamps: true }
  );

  try {
    await sequelize.authenticate();
    console.log("✅ Connected to prod DB via DATABASE_URL");

    // ── Idempotency guard ────────────────────────────────────────────────
    const existing: any = await AdminFeeWallet.findOne({ where: { wallet_type: "XRP_MASTER" } });
    if (existing) {
      console.log(
        `⏭️  XRP_MASTER already exists (id=${existing.dataValues.fee_wallet_id}, address=${existing.dataValues.wallet_address}). Nothing to do.`
      );
      return;
    }

    // ── KMS preflight (fail fast before generating a real wallet) ─────────
    console.log("1️⃣  KMS preflight (encrypt/decrypt roundtrip on a throwaway string)...");
    const probe = "xrp-master-kms-probe";
    const probeCt = await tatumApi.encryptSymmetric(probe, process.env.TEMP_KEY_ID);
    const probeRt = await tatumApi.decryptSymmetric(probeCt, process.env.TEMP_KEY_ID);
    if (probeRt !== probe) throw new Error("KMS roundtrip failed — aborting before wallet generation");
    console.log("   ✅ KMS encrypt/decrypt OK");

    // ── Generate the new XRP master wallet ────────────────────────────────
    console.log("2️⃣  Generating new XRP wallet via Tatum SDK...");
    const wallet = await tatumApi.generateWallet("XRP");
    if (!wallet || !wallet.address || !wallet.privateKey) {
      throw new Error("XRP wallet generation failed — missing address or secret");
    }
    console.log(`   ✅ New XRP master address: ${wallet.address}`);

    // ── Encrypt the secret + verify roundtrip ─────────────────────────────
    console.log("3️⃣  KMS-encrypting the master secret (TEMP_KEY_ID)...");
    const encryptedSecret = await tatumApi.encryptSymmetric(wallet.privateKey, process.env.TEMP_KEY_ID);
    const roundtrip = await tatumApi.decryptSymmetric(encryptedSecret, process.env.TEMP_KEY_ID);
    if (roundtrip !== wallet.privateKey) throw new Error("Secret decrypt roundtrip FAILED — aborting");
    console.log(`   ✅ Encrypted (ciphertext len=${encryptedSecret.length}), decrypt verified`);

    // ── Insert XRP_MASTER row (transactional) ─────────────────────────────
    console.log("4️⃣  Inserting XRP_MASTER row into tbl_admin_fee_wallet...");
    const tx = await sequelize.transaction();
    let record: any;
    try {
      record = await AdminFeeWallet.create(
        {
          wallet_type: "XRP_MASTER",
          wallet_address: wallet.address,
          privateKey: encryptedSecret,
          xpub: `NON_HD_XRP_${wallet.address.substring(0, 8)}`,
          mnemonic: "NON_HD",
          amount: 0,
          feeLimit: 0, // 0 => excluded from gas-funding monitor (XRP_MASTER receives, not funds gas)
          alert_duration: 12,
        } as any,
        { transaction: tx }
      );
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }
    console.log(`   ✅ Inserted fee_wallet_id=${record.dataValues.fee_wallet_id}`);

    console.log("\n=====================================================");
    console.log("🔐 NEW XRP MASTER WALLET — SAVE THE SECRET SECURELY");
    console.log("=====================================================");
    console.log(`Address (set as XRP_MASTER_WALLET): ${wallet.address}`);
    console.log(`Secret (family seed / private key): ${wallet.privateKey}`);
    console.log("\nNEXT STEPS (operator):");
    console.log(" 1. Fund this address with >= ~2 XRP (1 XRP base reserve + 0.2 XRP per trust line + gas).");
    console.log(" 2. Set up the RLUSD trust line on this address (issuer rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De) if you accept RLUSD.");
    console.log(" 3. Confirm XRP_MASTER_WALLET in backend/.env now equals the address above.");
    console.log("\n✅ Done.");
  } finally {
    await sequelize.close();
  }
}

main().catch((e: any) => {
  console.error("❌ Provisioning failed:", e?.message || e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
