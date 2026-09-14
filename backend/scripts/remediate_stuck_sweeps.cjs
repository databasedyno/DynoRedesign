#!/usr/bin/env node
// Ops tool: force-sweep pool addresses whose auto-convert sweep was skipped by a
// stale "unprofitable" deferral, and pin the sweep tx to the right conversion row.
// Runs against the COMPILED backend (dist/). Copy next to dist/ inside the prod
// container and run:  node remediate_stuck_sweeps.cjs [--dry] <addrId>:<conversionId> ...
const path = require("path");

const DIST = process.env.DIST || path.join(__dirname, "dist");
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const pairs = args.filter((a) => /^\d+:\d+$/.test(a)).map((p) => {
  const [addrId, convId] = p.split(":").map(Number);
  return { addrId, convId };
});
if (pairs.length === 0) {
  console.error("usage: node remediate_stuck_sweeps.cjs [--dry] <addrId>:<conversionId> ...");
  process.exit(2);
}

(async () => {
  const { connectRedis, deleteRedisItem, getRedisItem, acquireLock, releaseLock } = require(`${DIST}/utils/redisInstance`);
  const { sweepPoolAddress } = require(`${DIST}/services/merchantPool/merchantPoolSweep`);
  const sequelize = require(`${DIST}/utils/dbInstance`).default;
  const { QueryTypes } = require("sequelize");
  await connectRedis();

  const q = (sql, bind) => sequelize.query(sql, { bind, type: QueryTypes.SELECT });

  for (const { addrId, convId } of pairs) {
    console.log(`\n=== address ${addrId} → conversion #${convId} ===`);
    const [conv] = await q(`SELECT conversion_id, status, source_currency, source_amount, deposit_tx_hash, retry_count FROM tbl_stablecoin_conversion WHERE conversion_id = $1`, [convId]);
    const [addr] = await q(`SELECT temp_address_id, wallet_type, wallet_address, status, admin_fee_balance FROM tbl_merchant_temp_address WHERE temp_address_id = $1`, [addrId]);
    console.log("conversion:", conv);
    console.log("address:", addr);
    if (!conv || !addr) { console.error("row missing — skipping"); continue; }
    if (conv.status !== "PENDING_DEPOSIT" || conv.deposit_tx_hash) { console.error("conversion not PENDING_DEPOSIT/untagged — skipping"); continue; }
    if (conv.source_currency !== addr.wallet_type) { console.error("currency mismatch — skipping"); continue; }

    const deferKey = `sweep:unprofitable:${addrId}`;
    console.log("deferral:", await getRedisItem(deferKey));
    if (dry) { console.log("[dry] would clear deferral + sweep"); continue; }

    const lockKey = `sweep:address:${addrId}`;
    const locked = await acquireLock(lockKey, 300, 3, 1000, true);
    if (!locked) { console.error("could not acquire sweep lock — skipping"); continue; }
    try {
      await deleteRedisItem(deferKey);
      console.log("deferral cleared; sweeping…");
      const result = await sweepPoolAddress(addrId);
      console.log("sweep result:", result);
      const tx = result && result.txId;
      if (tx) {
        await sequelize.query(`UPDATE tbl_stablecoin_conversion SET deposit_tx_hash = $1 WHERE conversion_id = $2`, { bind: [tx, convId] });
        const [, meta] = await sequelize.query(
          `UPDATE tbl_stablecoin_conversion SET deposit_tx_hash = NULL WHERE conversion_id <> $2 AND deposit_tx_hash = $1 AND status = 'PENDING_DEPOSIT'`,
          { bind: [tx, convId] }
        );
        console.log(`pinned ${tx} to conversion #${convId}; untagged ${meta && meta.rowCount != null ? meta.rowCount : "?"} other row(s)`);
      } else {
        console.error("sweep did not return a txId — conversion left untouched");
      }
    } finally {
      await releaseLock(lockKey);
    }
  }
  process.exit(0);
})().catch((e) => { console.error("FATAL", e && e.message ? e.message : e); process.exit(1); });
