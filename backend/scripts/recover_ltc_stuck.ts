/**
 * Manual LTC Recovery Transfer
 * Sends stuck LTC from merchant pool temp address to Nomadly1 company wallet.
 * 
 * Source:      LV5DB56dPsrDbt3K22JCEGYCHTNeUXYoA3 (temp_address_id: 62)
 * Destination: LM179QVx32QMtEzkhJZnvMdQgJfkAbf3fm (Nomadly1 LTC wallet)
 * 
 * Usage: cd /app/backend && npx ts-node --transpile-only scripts/recover_ltc_stuck.ts
 */
import dotenv from "dotenv";
dotenv.config();

import tatumApi from "../apis/tatumApi";
import { Sequelize, QueryTypes } from "sequelize";

const FROM_ADDRESS = "LV5DB56dPsrDbt3K22JCEGYCHTNeUXYoA3";
const TO_ADDRESS = "LM179QVx32QMtEzkhJZnvMdQgJfkAbf3fm";
const CURRENCY = "LTC";

const sequelize = new Sequelize(
  process.env.DB_NAME!,
  process.env.USER_NAME!,
  process.env.PASSWORD!,
  {
    host: process.env.HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' 
        ? { require: true, rejectUnauthorized: false } 
        : undefined,
    },
  }
);

async function main() {
  console.log(`\n=== Manual LTC Recovery Transfer ===`);
  console.log(`From: ${FROM_ADDRESS}`);
  console.log(`To:   ${TO_ADDRESS}`);
  console.log(`Currency: ${CURRENCY}\n`);

  // Step 1: Get on-chain balance
  console.log("Step 1: Checking on-chain balance...");
  const balanceData = await tatumApi.getAddressBalance(FROM_ADDRESS, CURRENCY);
  const rawBalance = parseFloat(balanceData?.incoming || balanceData?.balance || "0") - parseFloat(balanceData?.outgoing || "0");
  // Truncate to 8 decimal places to avoid Tatum validation errors
  const balance = Math.floor(rawBalance * 100000000) / 100000000;
  console.log(`Balance data:`, JSON.stringify(balanceData));
  console.log(`Calculated balance: ${balance} LTC (raw: ${rawBalance})`);

  if (balance <= 0) {
    console.error("No LTC balance to transfer!");
    process.exit(1);
  }

  // Step 2: Get private key from DB
  console.log("\nStep 2: Retrieving private key from merchant_temp_address...");
  const addrRows = await sequelize.query<{ private_key: string }>(
    `SELECT private_key FROM tbl_merchant_temp_address WHERE wallet_address = $1`,
    { bind: [FROM_ADDRESS], type: QueryTypes.SELECT }
  );

  if (!addrRows.length || !addrRows[0].private_key) {
    console.error("Private key not found in database!");
    process.exit(1);
  }
  console.log("Private key found (encrypted). Decrypting via Google Cloud KMS...");

  const privateKey = await tatumApi.decryptSymmetric(
    addrRows[0].private_key,
    process.env.TEMP_KEY_ID
  );
  console.log("Private key decrypted successfully. Length:", privateKey.length);

  // Step 3: Estimate fees
  console.log("\nStep 3: Estimating LTC fees...");
  const feeData = await tatumApi.feeEstimation(
    CURRENCY,
    FROM_ADDRESS,
    TO_ADDRESS,
    balance.toString()
  );
  console.log("Fee estimate:", JSON.stringify(feeData, null, 2));

  // For UTXO chains, the fee object has slow/medium/fast
  const feeAmount = parseFloat(feeData?.slow || feeData?.medium || feeData?.fast || "0.0001");
  console.log(`Fee (slow): ${feeAmount} LTC`);

  // Step 4: Calculate amount to send (balance - fee)
  let amountToSend = balance - feeAmount;
  // Truncate to 8 decimal places (LTC precision)
  amountToSend = Math.floor(amountToSend * 100000000) / 100000000;

  console.log(`\nAmount to send: ${balance} - ${feeAmount} = ${amountToSend} LTC`);

  if (amountToSend <= 0) {
    console.error("Amount to send is <= 0 after fee deduction!");
    process.exit(1);
  }

  // Step 5: Execute transfer
  console.log("\nStep 5: Executing LTC transfer...");
  console.log(`  Sending ${amountToSend} LTC`);
  console.log(`  From: ${FROM_ADDRESS}`);
  console.log(`  To:   ${TO_ADDRESS}`);

  const result = await tatumApi.assetToOtherAddress({
    currency: CURRENCY,
    fromAddress: FROM_ADDRESS,
    toAddress: TO_ADDRESS,
    privateKey,
    amount: amountToSend.toString(),
    fee: feeData,
  });

  console.log("\n=== Transfer Result ===");
  console.log(JSON.stringify(result, null, 2));

  if (result?.txId) {
    console.log(`\n✅ SUCCESS! TX Hash: ${result.txId}`);
    console.log(`View on BlockCypher: https://live.blockcypher.com/ltc/tx/${result.txId}/`);
    
    // Update DB status
    console.log("\nUpdating database status...");
    await sequelize.query(
      `UPDATE tbl_merchant_temp_address SET status = 'SWEPT', updated_at = NOW() WHERE wallet_address = $1`,
      { bind: [FROM_ADDRESS] }
    );
    console.log("Database updated: status = SWEPT");
  } else {
    console.error("\n❌ Transfer failed - no txId returned");
    console.error("Result:", JSON.stringify(result));
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
