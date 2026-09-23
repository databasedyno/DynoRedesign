/**
 * Reown AppKit singleton (client-only). Created lazily on the first wallet action so the
 * ~600 KB of wallet SDK never lands in the initial checkout bundle.
 *
 * Rails: EVM (Ethereum + Polygon via Wagmi adapter), Solana, Tron (TronLink / Trust / OKX +
 * WalletConnect wallets). The Project ID is public by design (allow-listed per domain in the
 * Reown dashboard).
 */
import type { AppKit } from "@reown/appkit/react";
import type { AppKitNetwork } from "@reown/appkit/networks";

export const REOWN_PROJECT_ID = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "";

let instance: AppKit | null = null;
let creating: Promise<AppKit> | null = null;

export const isWalletKitConfigured = (): boolean => !!REOWN_PROJECT_ID;

export async function ensureAppKit(themeMode: "light" | "dark" = "light"): Promise<AppKit> {
  if (typeof window === "undefined") throw new Error("AppKit is browser-only");
  if (instance) {
    instance.setThemeMode(themeMode);
    return instance;
  }
  if (!creating) {
    creating = (async () => {
      const [{ createAppKit }, { WagmiAdapter }, { SolanaAdapter }, { TronAdapter }, networks, { TronLinkAdapter }, { TrustAdapter }, { OkxWalletAdapter }] = await Promise.all([
        import("@reown/appkit/react"),
        import("@reown/appkit-adapter-wagmi"),
        import("@reown/appkit-adapter-solana"),
        import("@reown/appkit-adapter-tron"),
        import("@reown/appkit/networks"),
        import("@tronweb3/tronwallet-adapter-tronlink"),
        import("@tronweb3/tronwallet-adapter-trust"),
        import("@tronweb3/tronwallet-adapter-okxwallet"),
      ]);
      const evm: [AppKitNetwork, ...AppKitNetwork[]] = [networks.mainnet, networks.polygon];
      const all: [AppKitNetwork, ...AppKitNetwork[]] = [networks.mainnet, networks.polygon, networks.solana, networks.tronMainnet];
      const wagmiAdapter = new WagmiAdapter({ projectId: REOWN_PROJECT_ID, networks: evm, ssr: false });
      const solanaAdapter = new SolanaAdapter();
      const tronAdapter = new TronAdapter({
        walletAdapters: [
          new TronLinkAdapter({ openUrlWhenWalletNotFound: false, checkTimeout: 3000 }),
          new TrustAdapter({ openUrlWhenWalletNotFound: false }),
          new OkxWalletAdapter({ openUrlWhenWalletNotFound: false }),
        ],
      });
      const origin = window.location.origin;
      const isSafeDeal = /safedeal/i.test(window.location.host) || window.location.pathname.startsWith("/safedeal");
      const kit = createAppKit({
        adapters: [wagmiAdapter, solanaAdapter, tronAdapter],
        networks: all,
        projectId: REOWN_PROJECT_ID,
        metadata: {
          name: isSafeDeal ? "SafeDeal" : "Dynopay",
          description: isSafeDeal ? "SafeDeal — escrow for online deals" : "Dynopay — crypto payments for businesses",
          url: origin,
          icons: [`${origin}${isSafeDeal ? "/safedeal/favicon-192.png" : "/favicon-192.png"}`],
        },
        themeMode,
        themeVariables: {
          "--w3m-accent": isSafeDeal ? "#B77E00" : "#8B5E00",
          "--w3m-border-radius-master": "2px",
          "--w3m-z-index": 20000,
        },
        features: { analytics: false, email: false, socials: false, swaps: false, onramp: false, send: false, history: false, receive: false },
        enableWalletGuide: false,
        allWallets: "SHOW",
      });
      instance = kit;
      return kit;
    })().catch((e) => {
      creating = null;
      throw e;
    });
  }
  return creating;
}

export const CAIP_NETWORK_ID = {
  1: "eip155:1",
  137: "eip155:137",
  solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  tron: "tron:0x2b6653dc",
} as const;
