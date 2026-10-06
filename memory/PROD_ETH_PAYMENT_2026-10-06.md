# Prod ETH payment forensics — 2026-10-06 (read-only: prod Postgres + public ETH RPC)

Droplet SSH: NEW key generated this pod `/root/.ssh/dynopay_prod_ed25519` (pub: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPQzcwFiFnLyHRucf2XexjqMu6sAbWuJ46wa5CEbxgM4 emergent-agent-dynopay-prodlogs-2026-10-06`) — NOT yet authorized on root@134.209.94.115 (Permission denied). Logs: `/opt/dynopay/logs/*.log`, `docker logs dynopay`.

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
