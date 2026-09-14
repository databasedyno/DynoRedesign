type AddrLike = { walletAddress: string; walletTitle: string };

/** EVM addresses are case-insensitive (checksum casing varies); every other chain is exact. */
export const normalizeAddress = (a?: string | null) => {
  const s = (a || "").trim();
  return /^0x/i.test(s) ? s.toLowerCase() : s;
};

/** address → every network it is saved under (within one brand). */
export const buildSharedAddressMap = (wallets: AddrLike[]) => {
  const map = new Map<string, string[]>();
  for (const w of wallets) {
    const k = normalizeAddress(w.walletAddress);
    if (!k) continue;
    map.set(k, [...(map.get(k) || []), w.walletTitle]);
  }
  return map;
};

/** The OTHER networks sharing this wallet's address (empty when the address is unique). */
export const sharedNetworksFor = (map: Map<string, string[]>, w: AddrLike) =>
  (map.get(normalizeAddress(w.walletAddress)) || []).filter((c) => c !== w.walletTitle);
