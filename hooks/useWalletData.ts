import { WalletAction } from "@/Redux/Actions";
import { WALLET_FETCH } from "@/Redux/Actions/WalletAction";
import { rootReducer } from "@/utils/types";
import { useEffect, useMemo, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

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
  "USDC-ERC20": USDTIcon,
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

/* Dashboard display currencies - only show these 5 on dashboard Active Wallets */
const DASHBOARD_DISPLAY_CURRENCIES: readonly string[] = [
  "BTC", "LTC", "ETH", "USDT-TRC20", "USDT-ERC20",
];

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
  { code: "USDC-ERC20", name: "USDC-ERC20", icon: USDTIcon },
  { code: "RLUSD", name: "RLUSD", icon: RLUSDIcon },
  { code: "RLUSD-ERC20", name: "RLUSD-ERC20", icon: RLUSDIcon },
];

const requestedWalletFetchByToken = new Set<string>();

/* ------------------------------- Main Hook -------------------------------- */

export const useWalletData = () => {
  const dispatch = useDispatch();
  const walletState = useSelector((state: rootReducer) => state.walletReducer);
  const selectedCompanyId = useSelector(
    (state: rootReducer) => (state as any).companyReducer?.selectedCompanyId
  );
  const companyFetched = useSelector(
    (state: rootReducer) => (state as any).companyReducer?.fetched
  );
  const walletLoading = Boolean(walletState?.loading);
  const walletListLength = Array.isArray(walletState?.walletList)
    ? walletState.walletList.length
    : 0;
  const [walletWarning, setWalletWarning] = useState(false);

  // Track last fetched company to prevent infinite re-fetching
  const lastFetchedCompanyRef = useRef<string | null | undefined>(undefined);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("token");
    if (!token) return;

    // Wait until company list is fetched and a company is selected
    // This prevents fetching ALL wallets when selectedCompanyId is null during initial load
    if (!companyFetched || !selectedCompanyId) return;

    // Skip if already fetching or if we just fetched for this company
    if (isFetchingRef.current) return;
    if (lastFetchedCompanyRef.current === selectedCompanyId) return;

    lastFetchedCompanyRef.current = selectedCompanyId;
    isFetchingRef.current = true;

    const payload = { company_id: selectedCompanyId };
    dispatch(WalletAction(WALLET_FETCH, payload));

    // Reset fetching flag after a brief delay to allow the saga to complete
    const timer = setTimeout(() => { isFetchingRef.current = false; }, 2000);
    return () => clearTimeout(timer);
  }, [dispatch, selectedCompanyId, companyFetched]);

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
          totalProcessed: Number(wallet.amount_in_usd) || 0,
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
  const hasFetched = useRef(false);

  useEffect(() => {
    if (walletLoading) {
      setWalletWarning(false);
      return;
    }
    // Mark as fetched when loading transitions to false
    if (!walletLoading && (Array.isArray(walletState?.walletList))) {
      hasFetched.current = true;
    }
    // Only show warning after first successful fetch
    if (hasFetched.current) {
      setWalletWarning(walletData.length === 0);
    } else {
      setWalletWarning(false);
    }
  }, [walletLoading, walletData, walletState?.walletList]);

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
