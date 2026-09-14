# Hybrid Key Custody — Implementation Plan (Tier A: Tatum KMS · Tier B: Google Cloud HSM)

**Status:** approved in principle; Google Cloud KMS/HSM fees approved. Scheduled as a follow-up project after the API-key, custody-hardening and PII phases ship.
**Sequencing note (2026-09-13):** gating phases are tracked in `plan.md` §0. Phase 1 (API-key hashing) is ✅ complete; Phases 2.1 / 3a / 3b are the remaining prerequisites and are **not yet started**. Do NOT begin this hybrid work until those ship and the owner supplies the §2 prerequisites (droplet SSH, GCP billing/HSM region, maintenance windows). **Out of scope for the current session.**
**Goal:** no wallet private key — of any class — ever exists in plaintext inside the DynoPay application process or on Tatum's servers.

> **STATUS AUDIT (2026-09-14, against live codebase):** The hybrid work itself is **NOT started** — there is no Tatum KMS daemon integration, no `signatureId` signing path, no Google Cloud HSM keys/adapters, no `pending_kms_tx` tracker, and no four-eyes `/api/internal/kms/approve` endpoint. What **has** shipped is the prerequisite **custody-hardening boundary** referenced in §5: `backend/services/keyCustody/keyCustodyService.ts` is now the single sanctioned decrypt path (`withPrivateKey` scoped access + `decryptPrivateKey`), every access writes an append-only `tbl_key_access_audit` row, and calls carry a `purpose` context (`gas_funding` / `pool_sweep` / `settlement`, …). That service today has exactly **one backend — the legacy `tatumApi.decryptSymmetric`**; the two new backends this plan calls for (`tatumKms`, `gcpHsm`) are not present. So the gating hardening is in place, but Tier A and Tier B below remain entirely pending and still blocked on owner prerequisites P1–P6.


---

## 1. Target architecture

```
                    ┌──────────────────────────────────────────────┐
                    │  DynoPay app (web + worker)  — holds NO keys │
                    └───────────────┬──────────────────┬───────────┘
                                    │                  │
              "sign tx with signatureId X"      "sign digest with HSM key Y"
                                    │                  │
                    ┌───────────────▼──────┐   ┌───────▼────────────────────┐
                    │ Tatum API (queue)    │   │ Google Cloud KMS — HSM     │
                    │ pending tx for KMS   │   │ EC_SIGN_SECP256K1_SHA256   │
                    └───────────────┬──────┘   │ keys non-exportable        │
                                    │          └───────┬────────────────────┘
                    ┌───────────────▼──────┐           │ signature (r,s)
                    │ Tatum KMS daemon     │           ▼
                    │ (Docker, on droplet) │   app assembles signed tx,
                    │ wallet.dat encrypted │   broadcasts via Tatum/RPC
                    │ signs + broadcasts   │
                    └──────────────────────┘
```

| Tier | Key class | Where the key lives | Who signs | Address change? |
|---|---|---|---|---|
| **A** | Deposit-pool / per-payment / merchant temp addresses (hundreds → thousands) | Tatum KMS encrypted keystore on the droplet | Tatum KMS daemon, locally | **No** — existing keys imported |
| **A** | Solana treasury/fee wallet (ed25519 — not supported by Cloud HSM) | Tatum KMS keystore | Tatum KMS daemon | No |
| **B** | Treasury / admin sweep destinations (BTC, ETH, POLYGON, BSC, TRX, LTC, DOGE, BCH, XRP master, RLUSD admin) | Google Cloud HSM (FIPS 140-2 L3) | Cloud HSM returns signature; app assembles tx | **Yes** — new address per wallet, funds migrated |
| **B** | Gas / fee wallets (TRX_FEE_WALLET, ETH_FEE_WALLET, POLYGON_FEE_WALLET, BSC gas) | Google Cloud HSM | Cloud HSM | **Yes** |

The current symmetric KMS key (used to encrypt keys at rest) is retired at the end; nothing decrypts a private key any more.

---

## 2. Prerequisites (owner-provided)

| # | Item | Needed for | Notes |
|---|---|---|---|
| P1 | SSH/console access to the DigitalOcean droplet | Tier A install | Docker must be installable. ~1 vCPU / 512 MB is enough for the daemon |
| P2 | Tatum KMS keystore password + escrow decision | Tier A | If lost, pool keys in the keystore are unrecoverable. Store in a password manager with 2 named holders |
| P3 | Google Cloud project with billing; Cloud KMS API enabled; HSM allowed in one region (e.g. `europe-west1`) | Tier B | Region fixed at key creation; pick the one closest to the droplet |
| P4 | A dedicated service account with **only** `cloudkms.signerVerifier` on the treasury key ring; credentials delivered to the droplet as a file, never in the repo | Tier B | Separate from the existing KMS encrypt/decrypt service account |
| P5 | Maintenance window per chain (30–60 min, sweeps paused for that chain; merchant checkouts unaffected) | Tier B fund migration | One chain at a time |
| P6 | Confirmed chain order | Tier B | Default: TRX/USDT-TRC20 → ETH/Polygon (+USDT/USDC) → BSC → BTC → LTC/DOGE/BCH → XRP/RLUSD |

**Recurring cost (Tier B):** ~$3.00 per HSM key version per month (≈ 15 keys → ~$45/month) + ~$0.02 per 1,000 signatures. Tier A has no licence fee; Tatum API credits are consumed by the daemon's polling (default every 5 s; set to 15–30 s to reduce credit burn).

---

## 3. Tier A — Tatum KMS for the deposit pool

### 3.1 Install & configure (droplet)
1. `docker pull tatumio/tatum-kms`; create `/opt/tatum-kms/.env` with `TATUM_API_KEY`, `TATUM_KMS_PASSWORD` (from P2), `TATUM_KMS_WALLET_PATH=/root/.tatumrc/wallet.dat`.
2. Run `checkconfig` to confirm keystore path and API key.
3. Start the daemon as a systemd service: `tatum-kms daemon --period=15 --externalUrl=https://<backend>/api/internal/kms/approve` — the `externalUrl` is the **four-eyes check**: KMS asks the DynoPay backend "may I sign transaction T?" before signing. The backend answers 200 only if T matches a sweep/settlement it created itself and the destination is an allow-listed treasury/merchant-payout address. Anything else → refused, alerted.
4. Keystore backup: encrypted `wallet.dat` copied nightly to the existing backup bucket; restore drill documented.

### 3.2 Import existing pool keys (no address change)
- For each active pool address with a non-zero or expected balance: decrypt with today's path **inside a one-off, audited, operator-run script on the droplet** (not the web app), pipe into `tatum-kms storemanagedprivatekey <CHAIN>` (interactive — one key at a time; a small expect wrapper is acceptable for the bulk import since it runs only on the droplet), record the returned `signatureId` against the address in a new mapping (`wallet address → signatureId, chain, tier`).
- Pool addresses with zero balance and no pending payment are **not** imported — they are retired and new ones generated inside KMS.
- After import: the app-side encrypted private key for that address is nulled; only the `signatureId` remains.

### 3.3 New pool addresses are born in KMS
- Address generation switches to `tatum-kms generatemanagedwallet <CHAIN>` (one mnemonic per chain) + derivation index per address; the app stores `signatureId + index + address`. Private material never exists in the app.

### 3.4 Application changes
- Sweep, gas-funding-from-pool and settlement calls send `signatureId` (+ `index`) instead of `fromPrivateKey`. Tatum responds with a **pending signature id**, not a tx hash.
- A pending-signature tracker: `pending_kms_tx(signatureId, chain, purpose, payment_id, created_at, tx_hash, status)`. The worker polls `/v3/kms/pending/{chain}` / `/v3/kms/{id}` and, when the daemon reports the broadcast hash, completes the sweep exactly as today (webhook to merchant, ledger entry).
- Four-eyes approval endpoint (`GET /api/internal/kms/approve/:txId`): returns 200 only if `txId` exists in `pending_kms_tx` **and** the destination is allow-listed **and** the amount is within the payment's expected range. Every decision written to the key-access audit table.
- Timeouts: a pending signature not broadcast within 10 min raises an alert (daemon down, keystore locked, Tatum outage) and the sweep is retried once the daemon is healthy — funds are never at risk, they simply sit in the pool address.

### 3.5 Per-chain rollout & verification
1. TRX first (highest volume, USDT-TRC20 gas funding is the most frequent signing path).
2. For the chain: enable `signatureId` path behind a per-chain flag → make a real small payment → confirm the daemon signs, broadcasts, the tracker completes, merchant webhook fires → soak 48 h → flip the flag for the next chain.
3. Rollback per chain = flip the flag back (old path still works because keys are imported, not moved — until the app-side ciphertext is nulled, which happens only after the 48 h soak).

---

## 4. Tier B — Google Cloud HSM for treasury and gas wallets

### 4.1 Create keys
- One key ring `dynopay-treasury` (region from P3, protection level **HSM**, algorithm `EC_SIGN_SECP256K1_SHA256`, purpose `ASYMMETRIC_SIGN`).
- One key per wallet, named by class and chain: `treasury-eth`, `treasury-trx`, `gas-trx`, `gas-eth`, `gas-polygon`, `treasury-btc`, … XRP master and RLUSD admin get their own keys.
- Export the **public key** of each; derive the address per chain (Keccak for EVM/TRX; P2WPKH/legacy for BTC-family; XRP address from the compressed pubkey). These are the **new treasury/gas addresses**.
- IAM: only the P4 service account may sign; nobody has `cryptoKeyVersions.destroy` without a two-person approval; key destruction scheduled-delay set to 30 days.

### 4.2 Signing adapter (per chain family)
| Family | How the app signs |
|---|---|
| EVM (ETH, POLYGON, BSC) | Build the unsigned EIP-1559 tx with ethers; hash → Cloud KMS `asymmetricSign` (digest mode, Keccak-256 hash supplied as the "sha256" digest — permitted by KMS) → parse DER (r,s) → low-S normalise (EIP-2) → compute recovery id by recovering the pubkey → attach `v` → broadcast via Tatum broadcast endpoint or RPC. An existing ethers-v6 GCP KMS signer package can be used as the adapter. |
| TRX / USDT-TRC20 | Same secp256k1/Keccak signature over the raw tx id (TronWeb builds the tx; signature appended); broadcast via Tatum. |
| BTC, LTC, DOGE, BCH | Build a PSBT with the UTXO set (Tatum UTXO endpoints); per-input sighash → Cloud KMS sign → DER-encode + sighash byte → finalise → broadcast. BCH uses the SIGHASH_FORKID variant. |
| XRP / RLUSD | Build the unsigned tx (xrpl.js), compute the signing hash → Cloud KMS sign → DER (r,s) → attach `TxnSignature` + `SigningPubKey` → submit via Tatum XRP broadcast. Trustline and RLUSD admin operations follow the same path. |
| SOL | **Stays in Tier A** (ed25519). |

Each adapter exposes the same interface as today's signing call, so callers only change the "which key" argument from a ciphertext to an HSM key name.

### 4.3 Fund migration (per chain, in its maintenance window)
1. Fund the new address with a **test amount**; execute one HSM-signed transfer **out** of it (proves signing works end-to-end).
2. Pause sweeps for the chain (flag).
3. Update every reference to the old address: droplet `.env` / vault (`*_FEE_WALLET`, `*_ADMIN_WALLET`, `XRP_MASTER_WALLET`, `RLUSD_ADMIN_WALLET`), DB wallet records, Tatum address-webhook subscriptions, any merchant-visible "platform address" text.
4. Drain the old wallet into the new one (one HSM-independent transaction using the old path, the **last time** that key is ever decrypted); keep a small reserve until step 6.
5. Resume sweeps; the first sweep must land at the new treasury address — verified on the explorer.
6. Watch the old address for 30 days (stragglers, exchange refunds); then drain the reserve and delete the old encrypted key material.

### 4.4 Rollback per chain
- Before step 4 completes: flip the flag back to the old address/path — nothing has moved.
- After: the old key still exists until step 6; re-pointing the address back is a config change. No situation exists where funds are unreachable.

---

## 5. Application-side hardening that lands with the hybrid
- `keyCustodyService` gains two new backends (`tatumKms`, `gcpHsm`); the legacy `decrypt` backend is limited to the migration scripts and removed at the end.
- Purpose scoping already shipped in Phase 2.1 is enforced at the adapter: an HSM treasury key cannot be asked to sign a "pool_sweep"; a pool `signatureId` cannot be used for "settlement".
- Destination allow-list: treasury/gas signers only ever sign to (a) merchant payout addresses on file, (b) other DynoPay treasury/gas addresses, (c) exchange deposit addresses on an admin-approved list. Anything else is refused and alerted.
- Spending limits: per-key daily and per-tx caps in the adapter (soft alert at 80 %, hard refusal at 100 %) — a compromised worker can no longer drain a treasury in one call.
- Alerts (Slack + email): daemon heartbeat missing, pending signature > 10 min, four-eyes refusal, HSM sign error, allow-list refusal, cap breach.

---

## 6. Operations runbook (post-migration)
- **Rotate Tatum KMS password:** `tatum-kms` export → re-import with new password; daemon restart. Quarterly.
- **HSM key rotation:** create a new key version → derive new address → run §4.3 for that wallet. Yearly or on incident.
- **Daemon down:** sweeps queue safely; alert fires after 10 min; restart via systemd; no funds at risk.
- **Break-glass:** if Tatum is unavailable for > X hours, treasury HSM signers can broadcast via a public RPC (EVM/TRX) — the adapter accepts an alternative broadcaster.
- **Backups:** `wallet.dat` nightly (encrypted at rest already); Cloud KMS needs no backup (Google-managed durability) but the key **names/IDs and derived addresses** are recorded in the vault.
- **Access reviews:** monthly review of who holds the keystore password and which principals have `signerVerifier`.

---

## 7. Timeline & sequencing

| Step | Duration | Depends on |
|---|---|---|
| A0 Daemon install, four-eyes endpoint, tracker | 3–4 days | P1, P2 |
| A1 TRX pool on `signatureId` + soak | 3–4 days | A0 |
| A2 Remaining chains (EVM, BTC-family, XRP, SOL) | 5–7 days | A1 |
| B0 Key ring + 15 HSM keys + adapters (EVM, TRX first) | 4–5 days | P3, P4 |
| B1 TRX + EVM treasury/gas migration | 2–3 days incl. windows | B0, P5, P6 |
| B2 BTC-family adapter + migration | 5–7 days | B1 |
| B3 XRP/RLUSD adapter + migration | 3–4 days | B2 |
| C  Retire legacy decrypt path + symmetric key; final audit | 2 days | A2, B3 |

Tier A and Tier B can proceed in parallel once prerequisites are in. Total ≈ 5–7 weeks calendar time.

---

## 8. Definition of done
- Zero calls to the legacy decrypt path in production for 30 consecutive days (audit table).
- Every treasury/gas wallet address in the vault resolves to a Cloud HSM key; every active pool address resolves to a `signatureId`.
- Tatum API logs show no request body containing `fromPrivateKey`.
- Four-eyes refusal, cap breach and allow-list alerts each tested with a deliberate negative test.
- Restore drill for `wallet.dat` completed once.
