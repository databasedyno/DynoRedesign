# Key Custody Threat Model & Hardening Plan (Refactor Tier-2 Item #8)

**Status:** Increment 1 shipped (audited decryption boundary). Increment 2 (remote signing) = design only.
**Owner:** payments/security. **Created:** this session.

---

## 1. What DynoPay actually does with keys today

Wallet private keys are stored **encrypted** (Tatum symmetric encryption, key id from
`TEMP_KEY_ID` / KMS `KEY_RING_ID`). At sweep / gas-funding / settlement time the
backend calls `tatumApi.decryptSymmetric(ciphertext, keyId)` and holds the **plaintext
private key in Node process memory** while it signs and broadcasts (see
`services/merchantPool/merchantPoolSweep.ts`, `directEvmTransfer.ts`).

### Wallet classes (should be treated with different blast radius)
| Class | Example (.env) | Risk if key leaks |
|---|---|---|
| Per-merchant pool / temp deposit addresses | dynamically generated | funds in-flight for that merchant |
| Fee / gas wallets | `TRX_FEE_WALLET`, `ETH_FEE_WALLET`, `POLYGON_FEE_WALLET` | gas float drain |
| Admin / treasury (sweep destinations) | `BTC`, `ETH`, `XRP_MASTER_WALLET`, `RLUSD_ADMIN_WALLET` | platform treasury |

## 2. Threats
- **T1 — Plaintext key in memory:** a heap dump / RCE / malicious dependency during a
  sweep can exfiltrate a live private key. (Present today.)
- **T2 — Unaudited access:** before this change there was no record of *when* a key was
  decrypted, by which path, for which wallet. Forensics after an incident were blind.
- **T3 — Over-broad access:** any code importing `tatumApi` could call `decryptSymmetric`
  directly — no single choke point.
- **T4 — Blast-radius mixing:** merchant, gas, and treasury keys go through the same
  code path with the same trust level.

## 3. Increment 1 (SHIPPED) — audited single boundary
`services/keyCustody/keyCustodyService.ts` is now the **only sanctioned** place to turn
ciphertext into a usable key:
- `decryptPrivateKey(ciphertext, keyId, ctx)` — drop-in replacement for the old direct
  `tatumApi.decryptSymmetric(...)` calls. Writes an append-only `tbl_key_access_audit`
  row (purpose, wallet, payment, correlation id, success/failure) — mitigates **T2/T3**.
- `withPrivateKey(ciphertext, keyId, ctx, fn)` — preferred: scopes the plaintext to the
  callback and best-effort scrubs the reference after use (narrows **T1** exposure window).
- Never logs / never persists the plaintext or the raw ciphertext (only `sha256(ciphertext)`).

Migrated call sites: `merchantPoolSweep.ts` gas-funding + pool-sweep decrypts.

## 4. Increment 2 (DESIGN ONLY — not yet built)
- **Remote signing:** sign transactions where the key lives (Tatum KMS / a signing
  service / HSM) so the plaintext key **never enters the Node heap** — fully closes **T1**.
- **Key-class separation (T4):** distinct KMS key rings + distinct code paths + stricter
  actor checks for treasury vs gas vs merchant keys; require an explicit `purpose` scope.
- **Alerting:** anomaly alerts off `tbl_key_access_audit` (e.g. treasury key accessed
  outside a scheduled sweep window) via the existing Slack alert service.
- **Least privilege:** the API/web role (`WORKER_ROLE=secondary`) should have **no** ability
  to decrypt keys at all — only the worker signer path.
