/**
 * Recovery script: untracked 125 USDT-TRC20 deposit on pool address #38
 *
 * Situation (verified 2026, read-only):
 *   - 125 USDT-TRC20 landed on-chain at TVvzUEXdq3DrmB7ktNbs64n8pDpPbQEUXr
 *     (tbl_merchant_temp_address #38, owner_user_id 1 = The Dev Store / company 1)
 *   - The address is registered as a NATIVE `TRX` pool slot, so DynoPay's
 *     USDT-TRC20 deposit detection never watched it -> the deposit was never
 *     ingested/settled (tbl DB shows total_transactions 0, admin_fee_balance 0).
 *   - Incoming tx: 7d7cc6202b1f40b805e922dadfecb1d2043980232cebc4b4be34a34b7fba4177
 *     from TU4vEruvZwLLkSfV9bNw12EJTPvNr7Pvaa, 2026-09-20 17:09 UTC.
 *
 * Destination: The Dev Store's REGISTERED USDT-TRC20 payout wallet
 *   TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR (tbl_user_wallet wallet_id 4, company 1).
 *   The script REFUSES to send anywhere else — it re-verifies this against the DB
 *   at runtime so it can never be pointed at an arbitrary address.
 *
 * SAFETY: dry-run by default. It only reads balances and prints the plan.
 *   To actually broadcast, the operator must run it with CONFIRM_SEND=YES.
 *   The plaintext key is decrypted only inside this process, immediately before
 *   the single transfer, and never logged.
 *
 * Run (dry-run):     cd /app/backend && npx ts-node scripts/recover_devstore_125usdt.ts
 * Run (broadcast):   cd /app/backend && CONFIRM_SEND=YES npx ts-node scripts/recover_devstore_125usdt.ts
 */

import 'dotenv/config';
import axios from 'axios';
import tatumApi from '../apis/tatumApi';
import { calculateDynamicTRC20Fee } from '../services/tronEnergyService';
import { fundGasIfNeeded } from '../services/merchantPool/merchantPoolSweep';
import sequelize from '../utils/dbInstance';

// Reliable on-chain USDT-TRC20 balance via TronGrid balanceOf (Tatum does not
// index this address, so tatumApi.getAddressBalance falsely returns 0 here).
async function onchainUsdtBalance(address: string): Promise<number> {
  const hex = tronBase58ToEvmHexParam(address);
  const res = await axios.post(
    'https://api.trongrid.io/wallet/triggerconstantcontract',
    {
      owner_address: address,
      contract_address: USDT_CONTRACT,
      function_selector: 'balanceOf(address)',
      parameter: hex,
      visible: true,
    },
    { timeout: 15000 }
  );
  const cr = res.data?.constant_result;
  return cr && cr[0] ? parseInt(cr[0], 16) / 1_000_000 : 0;
}

function tronBase58ToEvmHexParam(addr: string): string {
  const ALPH = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n;
  for (const c of addr) n = n * 58n + BigInt(ALPH.indexOf(c));
  const bytes = Buffer.from(n.toString(16).padStart(50, '0'), 'hex'); // 25 bytes
  const addr20 = bytes.subarray(1, 21); // drop 0x41 prefix + trailing checksum
  return Buffer.concat([Buffer.alloc(12), addr20]).toString('hex'); // left-pad to 32 bytes
}

const POOL_ADDRESS = 'TVvzUEXdq3DrmB7ktNbs64n8pDpPbQEUXr';
const EXPECTED_DEST = 'TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR'; // The Dev Store registered USDT-TRC20 wallet
const DEST_USER_ID = 1;   // The Dev Store owner
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const CURRENCY = 'USDT-TRC20';

const CONFIRM = process.env.CONFIRM_SEND === 'YES';

async function main() {
  console.log('=== STUCK USDT RECOVERY — pool #38 -> The Dev Store ===');
  console.log(`Mode: ${CONFIRM ? '⚠️  LIVE BROADCAST (CONFIRM_SEND=YES)' : 'DRY-RUN (no funds will move)'}`);
  console.log('');

  await sequelize.authenticate();
  console.log('✅ DB connected');

  // Guard 1: destination MUST be a registered payout wallet for this user. Never
  // trust a hardcoded/typed address alone — re-verify against the source of truth.
  const [walletRows] = (await sequelize.query(
    `SELECT wallet_id, wallet_address FROM tbl_user_wallet
      WHERE user_id = ${DEST_USER_ID} AND wallet_type = 'USDT-TRC20'
        AND wallet_address = '${EXPECTED_DEST}'`
  )) as any;
  if (!walletRows || walletRows.length === 0) {
    console.error(`❌ ABORT: ${EXPECTED_DEST} is not a registered USDT-TRC20 payout wallet for user ${DEST_USER_ID}. Refusing to send.`);
    process.exit(1);
  }
  console.log(`✅ Destination verified as registered wallet (wallet_id ${walletRows[0].wallet_id})`);

  // Guard 2: load the encrypted key for the source pool address
  const [addrRows] = (await sequelize.query(
    `SELECT private_key, wallet_type, status FROM tbl_merchant_temp_address WHERE wallet_address = '${POOL_ADDRESS}'`
  )) as any;
  if (!addrRows || addrRows.length === 0) {
    console.error('❌ ABORT: pool address not found in DB');
    process.exit(1);
  }
  const encryptedKey = addrRows[0].private_key;
  console.log(`✅ Source pool address found (registered type: ${addrRows[0].wallet_type}, status: ${addrRows[0].status})`);

  // On-chain balances (USDT read directly from chain — Tatum does not index this address)
  const usdtBalance = await onchainUsdtBalance(POOL_ADDRESS);
  const trxResult = await tatumApi.getAddressBalance(POOL_ADDRESS, 'TRX');
  const trxBalance = Number(trxResult?.balance ?? 0);
  console.log(`✅ On-chain: ${usdtBalance} USDT, ${trxBalance} TRX`);

  if (usdtBalance <= 0) {
    console.log('⚠️  No USDT balance — funds may already be recovered. Nothing to do.');
    process.exit(0);
  }

  const dynamicFee = await calculateDynamicTRC20Fee(POOL_ADDRESS, EXPECTED_DEST, USDT_CONTRACT);
  console.log(`ℹ️  Estimated gas for transfer: ${dynamicFee.fast} TRX (energy needed ${dynamicFee.energyNeeded}, recipient ${dynamicFee.isNewRecipient ? 'NEW' : 'ACTIVATED'})`);

  console.log('');
  console.log('----- PLAN -----');
  console.log(`  Send:   ${usdtBalance} USDT-TRC20`);
  console.log(`  From:   ${POOL_ADDRESS}`);
  console.log(`  To:     ${EXPECTED_DEST} (The Dev Store registered wallet)`);
  console.log(`  Gas:    fund from admin fee wallet if TRX < ~${dynamicFee.fast}`);
  console.log('----------------');

  if (!CONFIRM) {
    console.log('\n🟡 DRY-RUN complete. No funds moved.');
    console.log('   To broadcast, an operator re-runs with:  CONFIRM_SEND=YES npx ts-node scripts/recover_devstore_125usdt.ts');
    await sequelize.close();
    return;
  }

  // ---- LIVE PATH (only with CONFIRM_SEND=YES) ----
  console.log('\n🔧 Funding gas if needed...');
  const fundResult = await fundGasIfNeeded(
    { dataValues: { wallet_address: POOL_ADDRESS }, update: async () => {} } as any,
    CURRENCY,
    usdtBalance,
    EXPECTED_DEST
  );
  console.log(`   Gas funding: funded=${fundResult.funded}, amount=${fundResult.amount}, txId=${fundResult.txId || 'n/a'} (${fundResult.reason})`);
  if (fundResult.funded) {
    console.log('   ⏳ Waiting 12s for gas confirmation...');
    await new Promise((r) => setTimeout(r, 12000));
  }

  let privateKey: string;
  const decrypted = await tatumApi.decryptSymmetric(encryptedKey, process.env.TEMP_KEY_ID);
  const walletData = JSON.parse(decrypted);
  privateKey = walletData.privateKey || walletData.secret || walletData;

  console.log(`\n🔄 Broadcasting transfer of ${usdtBalance} USDT -> ${EXPECTED_DEST} ...`);
  const result = await tatumApi.assetToOtherAddress({
    currency: CURRENCY,
    fromAddress: POOL_ADDRESS,
    toAddress: EXPECTED_DEST,
    privateKey,
    amount: usdtBalance,
    fee: { fast: 30 },
    _contractAddress: USDT_CONTRACT,
  } as any);
  const txId = result?.txId || result?.id || JSON.stringify(result);
  console.log(`\n✅ TRANSFER BROADCAST — tx: ${txId}`);
  console.log(`   Verify: https://tronscan.org/#/transaction/${txId}`);

  await sequelize.query(
    `UPDATE tbl_merchant_temp_address SET status = 'AVAILABLE', admin_fee_balance = 0, current_payment_id = NULL, last_swept_at = NOW() WHERE wallet_address = '${POOL_ADDRESS}'`
  );
  console.log('   ✅ Pool address released to AVAILABLE');
  await sequelize.close();
  console.log('\n✅✅ RECOVERY COMPLETE ✅✅');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
