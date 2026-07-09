/**
 * Lightweight verification: no Sequelize, no ts-node, just pg + fetch.
 * Should finish in < 10 seconds.
 *
 * Confirms the fix path in adminController.getFeeWalletBalance:
 *   1. Read DB value for every admin fee wallet
 *   2. Read fresh on-chain balance from Tatum REST (matches what skipCache=true does)
 *   3. Report drift, so the user knows the fix is producing real values
 */

require('dotenv').config({ path: '/app/backend/.env' });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.USER_NAME,
    password: process.env.PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const { rows } = await client.query(
    `SELECT fee_wallet_id, wallet_type, wallet_address, amount, "updatedAt"
       FROM tbl_admin_fee_wallet
       ORDER BY fee_wallet_id ASC`
  );

  console.log(`\nAdmin fee wallets in DB: ${rows.length}\n`);
  console.log('Wallet             | DB.amount            | On-chain (Tatum)     | Drift          | Status');
  console.log('-------------------|----------------------|----------------------|----------------|--------');

  const tatumHeaders = { 'x-api-key': process.env.TATUM_KEY };
  const trxContract = process.env.TRX_CONTRACT || '';

  for (const w of rows) {
    const wt = String(w.wallet_type || '').trim();
    const addr = w.wallet_address;
    let onChain = 'n/a';
    let drift = 'n/a';
    let status = '';

    try {
      if (wt === 'TRX' || wt === 'USDT-TRC20') {
        const r = await fetch(
          `https://api.tatum.io/v3/tron/account/${addr}`,
          { headers: tatumHeaders }
        );
        if (!r.ok) {
          onChain = `HTTP ${r.status}`;
          status = r.status === 404 ? '⏭️  not activated' : '❌ tatum err';
        } else {
          const j = await r.json();
          if (wt === 'TRX') {
            onChain = String(Number(j.balance || 0) / 1_000_000);
          } else {
            // USDT-TRC20: iterate trc20 array to find the USDT contract
            let usdt = 0;
            if (Array.isArray(j.trc20)) {
              for (const entry of j.trc20) {
                if (entry && trxContract && entry[trxContract] !== undefined) {
                  usdt = Number(entry[trxContract]) / 1_000_000;
                  break;
                }
              }
            }
            onChain = String(usdt);
          }
        }
      } else if (wt === 'ETH' || wt === 'USDT-ERC20' || wt === 'USDC-ERC20' || wt === 'RLUSD-ERC20') {
        if (wt === 'ETH') {
          const r = await fetch(`https://api.tatum.io/v3/ethereum/account/balance/${addr}`, { headers: tatumHeaders });
          if (!r.ok) { onChain = `HTTP ${r.status}`; status = '❌ tatum err'; }
          else { const j = await r.json(); onChain = String(j.balance || 0); }
        } else {
          const contractByType = {
            'USDT-ERC20': process.env.ETH_CONTRACT,
            'USDC-ERC20': process.env.USDC_CONTRACT,
            'RLUSD-ERC20': process.env.RLUSD_ERC20_CONTRACT,
          }[wt];
          const r = await fetch(`https://api.tatum.io/v3/ethereum/account/balance/erc20/${addr}?contractAddress=${contractByType}`, { headers: tatumHeaders });
          if (!r.ok) { onChain = `HTTP ${r.status}`; status = '❌ tatum err'; }
          else {
            const j = await r.json();
            const decimals = wt === 'RLUSD-ERC20' ? 1e18 : 1e6;
            onChain = String(Number(j.balance || 0) / decimals);
          }
        }
      } else if (wt === 'BTC' || wt === 'LTC' || wt === 'DOGE' || wt === 'BCH') {
        // skip UTXO chains for this quick check
        onChain = 'skipped';
      } else {
        onChain = `type ${wt} skipped`;
      }
    } catch (e) {
      onChain = 'exception';
      status = '❌ ' + e.message.slice(0, 30);
    }

    if (onChain !== 'n/a' && onChain !== 'skipped' && !onChain.startsWith('HTTP') && onChain !== 'exception' && !onChain.startsWith('type')) {
      const d = Number(onChain) - Number(w.amount);
      if (Number.isFinite(d)) {
        drift = d.toFixed(6);
        if (Math.abs(d) < 0.000001) status = status || '✅ in sync';
        else status = status || '⚠️  drift ' + (d > 0 ? '↑' : '↓');
      }
    }

    console.log(
      `${wt.padEnd(18)} | ${String(w.amount).padEnd(20)} | ${String(onChain).padEnd(20)} | ${String(drift).padEnd(14)} | ${status}`
    );
  }

  await client.end();
  console.log('\nDone.\n');
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
