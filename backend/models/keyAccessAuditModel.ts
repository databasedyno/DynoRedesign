/**
 * Key Access Audit Model — explicit, append-only trail of private-key material
 * access (Refactor Tier-2 Item #8).
 *
 * Every time application code decrypts a wallet private key (today: sweeps, gas
 * funding, settlement) a row is written here: who/why/which wallet/when/outcome.
 * We NEVER store the plaintext key or the raw ciphertext — only a SHA-256 hash
 * of the ciphertext reference, so accesses can be correlated without leaking
 * secret material.
 *
 * This is step 1 of the key-custody hardening: centralise + audit all decryption
 * behind a single boundary (services/keyCustody). Step 2 (remote signing so raw
 * keys never enter app memory) is tracked in memory/KEY_CUSTODY_THREAT_MODEL.md.
 */

import { DataTypes, Model } from "sequelize";
import sequelize from "../utils/dbInstance";

export interface KeyAccessAuditAttributes {
  id?: number;
  key_ref_hash: string;          // sha256(ciphertext) — correlation, never the secret
  key_id: string | null;         // KMS key id / TEMP_KEY_ID name used to decrypt
  purpose: string;               // 'gas_funding' | 'pool_sweep' | 'settlement' | ...
  actor: string;                 // 'system' | 'worker' | admin id
  wallet_type: string | null;    // BTC, ETH, USDT-TRC20, ...
  wallet_address: string | null;
  payment_id: string | null;
  correlation_id: string | null;
  success: boolean;
  error: string | null;
  created_at?: Date;
}

class KeyAccessAudit extends Model<KeyAccessAuditAttributes> implements KeyAccessAuditAttributes {
  declare id: number;
  declare key_ref_hash: string;
  declare key_id: string | null;
  declare purpose: string;
  declare actor: string;
  declare wallet_type: string | null;
  declare wallet_address: string | null;
  declare payment_id: string | null;
  declare correlation_id: string | null;
  declare success: boolean;
  declare error: string | null;
  declare created_at: Date;
}

KeyAccessAudit.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    key_ref_hash: { type: DataTypes.STRING(64), allowNull: false },
    key_id: { type: DataTypes.STRING(64), allowNull: true },
    purpose: { type: DataTypes.STRING(64), allowNull: false },
    actor: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "system" },
    wallet_type: { type: DataTypes.STRING(32), allowNull: true },
    wallet_address: { type: DataTypes.STRING(128), allowNull: true },
    payment_id: { type: DataTypes.STRING(100), allowNull: true },
    correlation_id: { type: DataTypes.STRING(64), allowNull: true },
    success: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "tbl_key_access_audit",
    timestamps: false,
    indexes: [
      { fields: ["created_at"] },
      { fields: ["purpose"] },
      { fields: ["wallet_address"] },
      { fields: ["payment_id"] },
    ],
  }
);

export default KeyAccessAudit;
