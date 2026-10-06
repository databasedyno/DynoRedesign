# Prod ETH payment forensics — 2026-10-06 (read-only: prod Postgres + public ETH RPC)

Droplet SSH: NEW key generated this pod `/root/.ssh/dynopay_prod_ed25519` (pub: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPQzcwFiFnLyHRucf2XexjqMu6sAbWuJ46wa5CEbxgM4 emergent-agent-dynopay-prodlogs-2026-10-06`) — AUTHORIZED by owner 2026-10-06 ~17:50Z — `ssh -i /root/.ssh/dynopay_prod_ed25519 root@134.209.94.115` works (key wiped on new pods; re-generate + have owner run: mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '<pub>' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys). Logs: `/opt/dynopay/logs/*.log`, `docker logs dynopay`.

## Merchant
- company_id 399 "intisearch" · user_id 394 "pace sec" · pacesec1337@gmail.com · US · individual · email verified · signed up 2026-10-04 22:21Z · fee_tier standard
- Integration: direct API (customer = synthetic "Legacy API Customer" 1099), webhook → `https://stout-schilling-sloppily.ngrok-free.dev/institution-search/api/dynopay_webhook.php` (ngrok dev tunnel). meta order_id `WALLET-1-1791305864-28c6c9` "Wallet top-up (Dynopay)".
- Other tx: #1394 10 USDT-ERC20 created 16:44Z still `pending` (no deposit).

## Payment (tbl_user_transaction id 3105cb92…, #1395)
- $5.00 = 0.00185436 ETH @ ~2694.76. Created 16:57:59Z.
- In: 0xb36322c3…72a3 (from 0xdf4d3027…e28c → pool 0x28d8fcbe…fa67), block 26134680, status 1.
- Out: 0xb2c6fc07…81d2 → merchant wallet 0x584A9917…14Da (tbl_user_wallet 2130, ETH), 0.00184136 ETH, block 26134785, status 1. Gas 0.000013 ETH. Platform fee 0.
- Pool tx 587 completed.

## Timeline (tbl_payment_journal 3253-3260)
- 17:01:06 detected (webhook) → 17:01:07 settlement_started → returned idempotency status "settlement_in_progress" with no TX, funds still in pool → threw (chainVerification.ts ~L902) → state failed; `payment.settlement_failed` webhook sent 17:01:16.
- 17:10:01 reconciliation re-detected (failed→processing), no settlement.
- 17:20:01 reconciliation → 17:20:02 settlement_started → 17:20:03 broadcast → 17:20:18 sent → 17:20:19 payment_completed. ~19 min delay.
- Hypothesis (needs droplet logs): stale/concurrent settlement idempotency lock held ~19 min.

## Webhooks (tbl_webhook_delivery_log 4283-4286): ALL 4 failed HTTP 401 (pending, confirmed, settlement_failed, settled), retry_count 1.
- Merchant's endpoint rejects → their system likely never credited the top-up. Also the settled payload says merchant_amount 0.00185436 but actual on-chain payout 0.00184136 (gas deducted).

## ROOT CAUSE (confirmed from droplet logs cronLogger2.log + webhookLogs.log)
1. **Off-by-1-gwei native sweep (PRIMARY)** — 17:01:08 settleTransaction.ts (Account chain ETH, ~L834) deducted network fee 0.00002564 ETH (21000 × 1.221 gwei = 0.000025641, truncated to 8 dp) → DirectEvmSweep (services/merchantPool/directEvmTransfer.ts ~L373 native branch) sent value 0.00182872 with maxFee 1.221 gwei → RPC INSUFFICIENT_FUNDS "have 1854360000000000 want 1854361000000000" (short by 1e9 wei). Fix: clamp native value in wei to `balance - gasLimit*maxFeePerGas` at sign time (or ceil the fee).
2. **Settlement idempotency claim not released on failure** — paymentReliability.ts ~L467: retries 17:01:10, 17:01:15, 17:10:02-09 all hit "Atomic claim failed — another worker won the race" (the failed 17:01:07 attempt's in-progress claim). Claim expired before 17:20 reconciliation, which then succeeded at 0.488 gwei. → ~19 min delay + 2 false `payment.settlement_failed` webhooks.
3. Minor: fee-free volume reversal log says "Remaining: $500" after reversing $5 (check reversal math). Webhook `merchant_amount` reports pre-gas amount.
