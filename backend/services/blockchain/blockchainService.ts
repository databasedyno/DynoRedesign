/**
 * BlockchainService — domain-facing chain operations facade (Tier-2 Item #7).
 *
 * This is the layer application/payment code SHOULD depend on for on-chain
 * actions, so that swapping the underlying provider (Tatum -> alt) is a change
 * in ONE place (integrations/tatum/TatumClient) rather than across ~20
 * controllers. It intentionally exposes DynoPay-meaningful verbs and hides the
 * Tatum-specific client.
 *
 * Scope note (Tier-2 Item #7, increment 1): this establishes the seam and the
 * import target. Method coverage is expanded as controllers are migrated off
 * the raw `apis/tatumApi` import — tracked in REFACTOR_STATUS.md. Until a verb
 * exists here, callers may still use TatumClient directly.
 */

import { tatumClient } from "../../integrations/tatum/TatumClient";

export class BlockchainService {
  /** Decrypt is deliberately NOT exposed here — use services/keyCustody (Item #8). */

  /** Escape hatch during incremental migration — the raw Tatum client. */
  static get client() {
    return tatumClient;
  }
}

export const blockchainService = BlockchainService;
export default BlockchainService;
