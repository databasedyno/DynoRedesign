/**
 * One-shot recovery script — creates fresh ETH and TRX fee wallets for
 * SmartGas, KMS-encrypts their private keys via Google Cloud KMS
 * (TEMP_KEY_ID=temp-address-key), and inserts them into the production
 * tbl_admin_fee_wallet.
 *
 * The mnemonic is printed ONCE to stdout so the operator can save it to a
 * password manager. It is also stored encrypted in the mnemonic column,
 * so it can be re-derived later using the same GCP KMS key.
 *
 * Reads DB + KMS + Tatum creds from ./scripts/.env.prod-recovery so we
 * do NOT touch the sandbox's main .env.
 *
 * Usage:
 *   cd /app/backend
 *   npx ts-node --transpile-only scripts/recover_fee_wallets_prod.ts
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({
  path: path.resolve(__dirname, ".env.prod-recovery"),
  override: true,
});

import { Sequelize, DataTypes } from "sequelize";
import tatumApi from "../apis/tatumApi";

const WALLETS: Array<{ currency: string; note: string }> = [
  {
    currency: "ETH",
    note: "USDT-ERC20 / USDC-ERC20 / RLUSD-ERC20 gas funding. Fund with ≥0.02 ETH.",
  },
  {
    currency: "TRX",
    note: "USDT-TRC20 energy / bandwidth funding. Fund with ≥300 TRX (plus stake some for energy).",
  },
];

async function main() {
  // Sanity check required env
  const required = [
    "HOST",
    "DB_PORT",
    "DB_NAME",
    "USER_NAME",
    "PASSWORD",
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

  // Build a prod-pointed Sequelize instance
  const sequelize = new Sequelize(
    process.env.DB_NAME!,
    process.env.USER_NAME!,
    process.env.PASSWORD!,
    {
      host: process.env.HOST!,
      port: Number(process.env.DB_PORT!),
      dialect: "postgres",
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED === "true",
        },
      },
      logging: false,
    }
  );

  // Define the model inline to avoid importing shared dbInstance (which points elsewhere)
  const AdminFeeWallet = sequelize.define(
    "tbl_admin_fee_wallet",
    {
      fee_wallet_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      wallet_type: { type: DataTypes.STRING(255), defaultValue: "USD" },
      wallet_address: DataTypes.STRING(255),
      xpub: DataTypes.TEXT,
      mnemonic: DataTypes.TEXT,
      privateKey: DataTypes.TEXT,
      amount: { type: DataTypes.DOUBLE, defaultValue: 0 },
      feeLimit: { type: DataTypes.DOUBLE, defaultValue: 100 },
      alert_duration: { type: DataTypes.INTEGER, defaultValue: 12 },
    },
    {
      tableName: "tbl_admin_fee_wallet",
      timestamps: true,
    }
  );

  try {
    await sequelize.authenticate();
    console.log(
      `✅ Connected to prod DB: ${process.env.USER_NAME}@${process.env.HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
    );

    const existing: any[] = await AdminFeeWallet.findAll({
      attributes: ["fee_wallet_id", "wallet_type", "wallet_address"],
    });
    console.log(`\n📋 Existing fee wallets: ${existing.length}`);
    existing.forEach((w: any) =>
      console.log(
        `   ${w.dataValues.wallet_type}: ${w.dataValues.wallet_address} (id=${w.dataValues.fee_wallet_id})`
      )
    );
    const existingTypes = existing.map((w: any) => w.dataValues.wallet_type);

    const backups: Array<{
      currency: string;
      address: string;
      mnemonic: string | undefined;
      xpub: string | undefined;
    }> = [];

    for (const { currency, note } of WALLETS) {
      console.log(`\n========================================================`);
      console.log(`🔧 ${currency} fee wallet`);
      console.log(`========================================================`);

      if (existingTypes.includes(currency)) {
        console.log(
          `⏭️  ${currency} already exists in tbl_admin_fee_wallet — skipping (delete the row first if you want to replace it)`
        );
        continue;
      }

      console.log(`1️⃣  Generating ${currency} wallet via Tatum SDK...`);
      const wallet = await tatumApi.generateWallet(currency);
      if (!wallet || !wallet.address || !wallet.privateKey) {
        console.error(
          `   ❌ Failed — wallet response missing address or privateKey:`,
          wallet
        );
        continue;
      }
      console.log(`   ✅ Address:  ${wallet.address}`);
      console.log(`   ✅ Has mnemonic: ${!!wallet.mnemonic}`);
      console.log(`   ✅ Has xpub:     ${!!wallet.xpub}`);

      console.log(
        `2️⃣  Encrypting private key via GCP KMS (TEMP_KEY_ID=${process.env.TEMP_KEY_ID})...`
      );
      const encryptedPK = await tatumApi.encryptSymmetric(
        wallet.privateKey,
        process.env.TEMP_KEY_ID
      );
      if (!encryptedPK) throw new Error(`KMS encrypt failed for ${currency} privateKey`);
      console.log(`   ✅ Ciphertext length: ${encryptedPK.length}`);

      console.log(`3️⃣  Verifying decrypt roundtrip...`);
      const roundtrip = await tatumApi.decryptSymmetric(
        encryptedPK,
        process.env.TEMP_KEY_ID
      );
      if (roundtrip !== wallet.privateKey) {
        throw new Error(`Decrypt roundtrip FAILED for ${currency} — aborting`);
      }
      console.log(`   ✅ Decrypt matches`);

      let encryptedMnemonic: string | null = null;
      if (wallet.mnemonic) {
        encryptedMnemonic = await tatumApi.encryptSymmetric(
          wallet.mnemonic,
          process.env.TEMP_KEY_ID
        );
      }

      console.log(`4️⃣  Inserting into tbl_admin_fee_wallet...`);
      const record: any = await AdminFeeWallet.create({
        wallet_type: currency,
        wallet_address: wallet.address,
        privateKey: encryptedPK,
        xpub: wallet.xpub || null,
        mnemonic: encryptedMnemonic,
        amount: 0,
        feeLimit: currency === "TRX" ? 65 : 100,
        alert_duration: 12,
      } as any);
      console.log(
        `   ✅ Inserted fee_wallet_id=${record.dataValues.fee_wallet_id}`
      );

      backups.push({
        currency,
        address: wallet.address,
        mnemonic: wallet.mnemonic,
        xpub: wallet.xpub,
      });

      console.log(`\n   ⚠️  ${note}`);
    }

    // Final state
    console.log(`\n\n=====================================================`);
    console.log(`📋 Final tbl_admin_fee_wallet state`);
    console.log(`=====================================================`);
    const final: any[] = await AdminFeeWallet.findAll({
      attributes: [
        "fee_wallet_id",
        "wallet_type",
        "wallet_address",
        "amount",
        "feeLimit",
      ],
      order: [["wallet_type", "ASC"]],
    });
    final.forEach((w: any) =>
      console.log(
        `   ${w.dataValues.wallet_type}: ${w.dataValues.wallet_address} (id=${w.dataValues.fee_wallet_id}, balance=${w.dataValues.amount}, feeLimit=${w.dataValues.feeLimit})`
      )
    );

    // Print MNEMONIC BACKUPS — operator must save these externally
    console.log(`\n\n=====================================================`);
    console.log(`🔐 SEED-PHRASE BACKUP — SAVE THESE IN A PASSWORD MANAGER`);
    console.log(`    (They are stored encrypted in the DB, but do NOT`);
    console.log(`     rely on the DB alone — GCP KMS + DB = single point)`);
    console.log(`=====================================================`);
    backups.forEach((b) => {
      console.log(`\n### ${b.currency} fee wallet`);
      console.log(`Address:  ${b.address}`);
      if (b.xpub) console.log(`xpub:     ${b.xpub}`);
      if (b.mnemonic) console.log(`Mnemonic: ${b.mnemonic}`);
      else console.log(`(no mnemonic returned by Tatum for this chain)`);
    });

    console.log(`\n\n📝 ENV UPDATES REQUIRED ON RAILWAY:`);
    backups.forEach((b) => {
      console.log(`   ${b.currency}_FEE_WALLET=${b.address}`);
    });
    console.log(`\n✅ Done.`);
  } catch (e: any) {
    console.error("❌ Recovery failed:", e?.message || e);
    if (e?.stack) console.error(e.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
