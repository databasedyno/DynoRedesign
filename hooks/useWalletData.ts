import { useWalletStore } from "@/contexts/WalletDataContext";
import { useEffect, useMemo, useState } from "react";

import BitcoinIcon from "@/assets/cryptocurrency/Bitcoin-icon.svg";
import BitcoinCashIcon from "@/assets/cryptocurrency/BitcoinCash-icon.svg";
import BNBIcon from "@/assets/cryptocurrency/BNB-icon.svg";
import DogecoinIcon from "@/assets/cryptocurrency/Dogecoin-icon.svg";
import EthereumIcon from "@/assets/cryptocurrency/Ethereum-icon.svg";
import LitecoinIcon from "@/assets/cryptocurrency/Litecoin-icon.svg";
import PolygonIcon from "@/assets/cryptocurrency/Polygon-icon.svg";
import RLUSDIcon from "@/assets/cryptocurrency/RLUSD-icon.svg";
import SolanaIcon from "@/assets/cryptocurrency/Solana-icon.svg";
import TronIcon from "@/assets/cryptocurrency/Tron-icon.svg";
import USDTIcon from "@/assets/cryptocurrency/USDT-icon.svg";
import USDCIcon from "@/assets/cryptocurrency/USDC-icon.svg";
import XRPIcon from "@/assets/cryptocurrency/XRP-icon.svg";
import {
  Cryptocurrency,
  WalletDataType,
  WalletType,
} from "@/utils/types/wallet";

/* ------------------------------- Static Maps ------------------------------- */

const WALLET_ORDER: readonly WalletType[] = [
  "BTC",
  "ETH",
  "LTC",
  "DOGE",
  "BCH",
  "TRX",
  "SOL",
  "XRP",
  "POLYGON",
  "USDT-ERC20",
  "USDT-TRC20",
  "USDT-POLYGON",
  "USDC-ERC20",
  "RLUSD",
  "RLUSD-ERC20",
];

const WALLET_ICONS: Record<WalletType, any> = {
  BTC: BitcoinIcon,
  ETH: EthereumIcon,
  LTC: LitecoinIcon,
  DOGE: DogecoinIcon,
  BCH: BitcoinCashIcon,
  TRX: TronIcon,
  SOL: SolanaIcon,
  XRP: XRPIcon,
  BNB: BNBIcon,
  POLYGON: PolygonIcon,
  "USDT-ERC20": USDTIcon,
  "USDT-TRC20": USDTIcon,
  "USDT-POLYGON": USDTIcon,
  // BUG FIX (2026-08): USDC used the USDT icon (no USDC asset existed), so the
  // USDC-ERC20 wallet card looked like a DUPLICATE "USDT ERC20" card — same
  // green Tether logo + ERC-20 chip. Canonical blue USDC disc now.
  "USDC-ERC20": USDCIcon,
  RLUSD: RLUSDIcon,
  "RLUSD-ERC20": RLUSDIcon,
};

const WALLET_NAMES: Record<WalletType, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  LTC: "Litecoin",
  DOGE: "Dogecoin",
  BCH: "Bitcoin Cash",
  TRX: "Tron",
  SOL: "Solana",
  XRP: "Ripple",
  BNB: "Binance Coin",
  POLYGON: "Polygon (POL)",
  "USDT-ERC20": "USDT-ERC20",
  "USDT-TRC20": "USDT-TRC20",
  "USDT-POLYGON": "USDT-Polygon",
  "USDC-ERC20": "USDC-ERC20",
  RLUSD: "RLUSD",
  "RLUSD-ERC20": "RLUSD-ERC20",
};


export const ALLCRYPTOCURRENCIES: readonly Cryptocurrency[] = [
  { code: "BTC", name: "Bitcoin", icon: BitcoinIcon },
  { code: "ETH", name: "Ethereum", icon: EthereumIcon },
  { code: "LTC", name: "Litecoin", icon: LitecoinIcon },
  { code: "DOGE", name: "Dogecoin", icon: DogecoinIcon },
  { code: "BCH", name: "Bitcoin Cash", icon: BitcoinCashIcon },
  { code: "TRX", name: "Tron", icon: TronIcon },
  { code: "SOL", name: "Solana", icon: SolanaIcon },
  { code: "XRP", name: "Ripple", icon: XRPIcon },
  { code: "POLYGON", name: "Polygon (POL)", icon: PolygonIcon },
  { code: "USDT-ERC20", name: "USDT-ERC20", icon: USDTIcon },
  { code: "USDT-TRC20", name: "USDT-TRC20", icon: USDTIcon },
  { code: "USDT-POLYGON", name: "USDT-Polygon", icon: USDTIcon },
  { code: "USDC-ERC20", name: "USDC-ERC20", icon: USDCIcon },
  { code: "RLUSD", name: "RLUSD", icon: RLUSDIcon },
  { code: "RLUSD-ERC20", name: "RLUSD-ERC20", icon: RLUSDIcon },
];


/* ------------------------------- Main Hook -------------------------------- */

export const useWalletData = () => {
  const walletState = useWalletStore();
  const walletLoading = Boolean(walletState?.loading);
  const [walletWarning, setWalletWarning] = useState(false);

  // Wallet fetching is now owned by WalletDataContext (SWR keyed on the
  // selected company). It auto-fetches on mount and re-fetches whenever the
  // selected company changes — so no manual dispatch/cooldown effect is needed
  // here anymore.

  /* ---------------------------- Wallet Data ---------------------------- */

  const walletData = useMemo<WalletDataType[]>(() => {
    const list = Array.isArray(walletState?.walletList)
      ? walletState.walletList
      : [];
    if (!list.length) return [];

    return list
      .filter(
        (wallet) =>
          WALLET_ORDER.includes(wallet.wallet_type as WalletType) &&
          Boolean(wallet.wallet_address),
      )
      .sort(
        (a, b) =>
          WALLET_ORDER.indexOf(a.wallet_type as WalletType) -
          WALLET_ORDER.indexOf(b.wallet_type as WalletType),
      )
      .map((wallet) => {
        const type = wallet.wallet_type as WalletType;

        return {
          id: wallet.id || wallet.wallet_id || "",
          icon: WALLET_ICONS[type],
          walletTitle: type,
          walletAddress: wallet.wallet_address,
          name: WALLET_NAMES[type],
          walletName: wallet.wallet_name || "",
          destinationTag: wallet.destination_tag != null ? String(wallet.destination_tag) : "",
          totalProcessed: Number(wallet.amount_in_usd) || 0,
          ownershipVerifiedAt: wallet.ownership_verified_at || null,
          ownershipVerifiedVia: wallet.ownership_verified_via || null,
        };
      });
  }, [walletState?.walletList]);

  /* ------------------ Cryptocurrencies NOT in Wallet ------------------ */

  const cryptocurrencies = useMemo<Cryptocurrency[]>(() => {
    if (!walletData.length) return [...ALLCRYPTOCURRENCIES];

    return ALLCRYPTOCURRENCIES.filter(
      (crypto) =>
        !walletData.some((wallet) => wallet.walletTitle === crypto.code),
    );
  }, [walletData]);

  // Track whether wallets have been fetched at least once
  // `fetched` = the wallet request for the selected brand has really returned
  // (SWR data !== undefined). Before that the store holds a placeholder empty
  // list with loading=false (the SWR key is null until the brand is known), and
  // treating that as "0 payout addresses" flashed the header's "payout address
  // setup" chip on every page refresh.
  const walletFetched = Boolean(walletState?.fetched);

  useEffect(() => {
    setWalletWarning(walletFetched && !walletLoading && walletData.length === 0);
  }, [walletFetched, walletLoading, walletData]);

  const activeWalletsData = useMemo(() => {
    return ALLCRYPTOCURRENCIES.filter((crypto) => {
      // Show all active wallets (those that have been configured with addresses)
      return !cryptocurrencies.some((c) => c.code === crypto.code);
    });
  }, [cryptocurrencies]);

  return {
    walletLoading,
    walletData,
    cryptocurrencies,
    walletWarning,
    activeWalletsData,
    allCryptocurrencies: ALLCRYPTOCURRENCIES,
  };
};
