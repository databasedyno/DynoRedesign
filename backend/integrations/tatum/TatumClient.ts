/**
 * TatumClient — the explicit integration boundary for Tatum (Tier-2 Item #7).
 *
 * TARGET ARCHITECTURE:
 *   controller -> PaymentService/WalletService
 *              -> services/blockchain/BlockchainService
 *              -> integrations/tatum/TatumClient   (THIS)
 *              -> apis/tatumApi (raw HTTP/SDK)
 *
 * Today ~20 controllers import `apis/tatumApi` directly. This module is the
 * single seam we migrate them onto incrementally: it re-exports the existing
 * low-level client unchanged (zero behaviour change) so new/edited code can
 * depend on the boundary instead of the raw client. Do NOT add business logic
 * here — this layer only speaks "Tatum", not "DynoPay payments".
 *
 * Migration rule going forward:
 *   - New code: import from integrations/tatum, not apis/tatumApi.
 *   - Touched code: opportunistically switch the import.
 */

import tatumApi from "../../apis/tatumApi";

export const tatumClient = tatumApi;
export default tatumApi;
