import React, { useEffect, useState, useRef } from "react";
import { ArrowBack } from "@mui/icons-material";
import {
  Box,
  FormControl,
  IconButton,
  Paper,
  Typography,
  Divider,
  CircularProgress,
  Tooltip,
  Button,
  useTheme,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CopyIcon from "@/assets/Icons/CopyIcon";
import ClockIcon from "@/assets/Icons/ClockIcon";
import axiosBaseApi from "@/axiosConfig";
import { currencyData, walletState } from "@/utils/types/paymentTypes";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useDispatch } from "react-redux";
import { paymentTypes } from "@/utils/enums";
import { createEncryption } from "@/helpers";
import { Icon } from "@iconify/react/dist/iconify.js";
import DoneIcon from "@mui/icons-material/Done";
import USDT from "@/assets/Icons/coins/USDT";
import USDC from "@/assets/Icons/coins/USDC";
import BTC from "@/assets/Icons/coins/BTC";
import ETH from "@/assets/Icons/coins/ETH";
import BNB from "@/assets/Icons/coins/BNB";
import SOL from "@/assets/Icons/coins/SOL";
import XRP from "@/assets/Icons/coins/XRP";
import POLYGON from "@/assets/Icons/coins/POLYGON";
import RLUSD from "@/assets/Icons/coins/RLUSD";
import Image from "next/image";
import UnderPayment from "@/Components/UI/UnderPayment/Index";
import OverPayment from "@/Components/UI/OverPayment/Index";
import TransferExpectedCard from "@/Components/UI/TransferExpectedCard/Index";
import { useTranslation } from 'react-i18next';
import { formatWithSeparators, formatCryptoAmount } from "@/utils/currencyFormat";

import LTCicon from "../../../assets/Icons/coins/LTC.png";
import BCHicon from "../../../assets/Icons/coins/BCH.png";
import DOGEicon from "../../../assets/Icons/coins/DOGE.png";
import TRXicon from "../../../assets/Icons/coins/TRX.png";

// Payment status types
type PaymentStatusType = 
  | "waiting"      // No payment detected yet
  | "pending"      // Payment detected, awaiting confirmation
  | "confirmed"    // Payment confirmed successfully
  | "underpaid"    // Partial payment received
  | "overpaid"     // More than expected was paid
  | "expired"      // Payment window expired
  | "failed";      // Payment processing failed

// Merchant settings from backend
interface MerchantSettings {
  overpayment_threshold_usd: number;
  grace_period_minutes: number;
}

interface PartialPaymentData {
  paidAmount: number;
  expectedAmount: number;
  remainingAmount: number;
  currency: string;
  txId?: string;
  graceMinutes?: number;
  address?: string;
  paidAmountUsd?: number;
  expectedAmountUsd?: number;
  remainingAmountUsd?: number;
  baseCurrency?: string;
}

interface OverpaymentData {
  paidAmount: number;
  expectedAmount: number;
  excessAmount: number;
  currency: string;
  txId?: string;
  paidAmountUsd?: number;
  expectedAmountUsd?: number;
  excessAmountUsd?: number;
  baseCurrency?: string;
}

interface CryptoTransferProps {
  activeStep: number;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  walletState: walletState;
  feePayer?: string;
  redirectUrl?: string | null;
  taxInfo?: {
    rate: number;
    amount: number;
    country: string;
    type: string;
  } | null;
  feeInfo?: {
    processing_fee: number;
    fee_payer: 'customer' | 'merchant';
  } | null;
  merchantInfo?: {
    name: string;
    company_logo: string | null;
  } | null;
  displayCurrency?: string;
  transferRate?: number;
  email?: string;
  transactionId?: string;
  customerName?: string;
  // Contribution context — donation-flavored success card when present
  linkType?: string;
  contributionInfo?: {
    parent_link_id?: number | string | null;
    campaign_title?: string | null;
    campaign_description?: string | null;
    campaign_image?: string | null;
    campaign_currency?: string | null;
    campaign_pay_url?: string | null;
    goal_amount?: number | null;
    raised_amount?: number | null;
    supporters_count?: number | null;
    progress_percent?: number | null;
    show_progress?: boolean;
    show_supporters?: boolean;
    donor_name?: string | null;
    donor_message?: string | null;
    is_anonymous?: boolean;
  } | null;
}

// Cache duration for rate prefetching
const RATE_CACHE_DURATION_MS = 30000; // 30 seconds

const cryptoOptions = [
  {
    value: "USDT",
    label: "USDT (TRC-20, ERC-20)",
    icon: <USDT width={25} height={25} />,
  },
  {
    value: "USDC",
    label: "USD Coin (USDC - ERC-20)",
    icon: <USDC size={25} />,
    currency: "USDC",
  },
  {
    value: "BTC",
    label: "Bitcoin (BTC)",
    icon: <BTC width={25} height={25} />,
    currency: "BTC",
  },
  {
    value: "ETH",
    label: "Ethereum (ETH)",
    icon: <ETH width={25} height={25} />,
    currency: "ETH",
  },
  {
    value: "LTC",
    label: "Litecoin (LTC)",
    icon: <Image src={LTCicon} alt="LTC" width={25} height={25} unoptimized />,
    currency: "LTC",
  },
  {
    value: "DOGE",
    label: "Dogecoin (DOGE)",
    icon: <Image src={DOGEicon} alt="DOGE" width={25} height={25} unoptimized />,
    currency: "DOGE",
  },
  {
    value: "BCH",
    label: "Bitcoin Cash (BCH)",
    icon: <Image src={BCHicon} alt="BCH" width={25} height={25} unoptimized />,
    currency: "BCH",
  },
  {
    value: "TRX",
    label: "Tron (TRX)",
    icon: <Image src={TRXicon} alt="TRX" width={25} height={25} unoptimized />,
    currency: "TRX",
  },
  {
    value: "SOL",
    label: "Solana (SOL)",
    icon: <SOL width={25} height={25} />,
    currency: "SOL",
  },
  {
    value: "XRP",
    label: "Ripple (XRP)",
    icon: <XRP width={25} height={25} />,
    currency: "XRP",
  },
  {
    value: "POLYGON",
    label: "Polygon (POL)",
    icon: <POLYGON width={25} height={25} />,
    currency: "POLYGON",
  },
  {
    value: "RLUSD",
    label: "RLUSD (XRPL, ERC-20)",
    icon: <RLUSD width={25} height={25} />,
    currency: "RLUSD",
  },
];

interface CryptoDetails {
  qr_code: string;
  address: string;
  hash: string;
  memo?: string;
}

const CryptoTransfer = ({
  activeStep,
  setActiveStep,
  walletState,
  feePayer,
  redirectUrl,
  taxInfo,
  feeInfo,
  merchantInfo,
  displayCurrency: parentDisplayCurrency,
  transferRate: parentTransferRate,
  email,
  transactionId,
  customerName,
  linkType,
  contributionInfo,
}: CryptoTransferProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const dispatch = useDispatch();
  // Brand accent (lime) — used for selection + primary affordances to match
  // the landing page and donation checkout. Green (#10B981/#12B76A) is kept
  // ONLY for payment-detected/confirmed states (universal "success" signal).
  const ACCENT = '#4F46E5';
  const ON_ACCENT = '#0A0A0B';
  const ACCENT_SOFT = isDark ? 'rgba(79,70,229,0.12)' : 'rgba(79,70,229,0.16)';
  const [selectedCrypto, setSelectedCrypto] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<
    "" | "TRC20" | "ERC20" | "POLYGON" | "XRPL"
  >("");

  const [copied, setCopied] = useState(false);
  const [currencyRates, setCurrencyRates] = useState<currencyData[]>();
  const [selectedCurrency, setSelectedCurrency] = useState<currencyData>();
  const [cryptoDetails, setCryptoDetails] = useState<CryptoDetails>({
    qr_code: "",
    hash: "",
    address: "",
    memo: "",
  });
  const [loading, setLoading] = useState(false);

  // Use parent's display currency and transfer rate, fallback to source currency
  const displayCurrency = parentDisplayCurrency || walletState?.currency;
  const transferRate = parentTransferRate || 1;
  
  // Calculate converted values for display
  const convertedSubtotal = Number(walletState?.amount || 0) * transferRate;
  const convertedTaxAmount = Number(taxInfo?.amount || 0) * transferRate;
  const convertedProcessingFee = Number(feeInfo?.processing_fee || 0) * transferRate;

  const [isRecived, setIsReceived] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // Will be set from backend API

  const [isUrl, setIsUrl] = useState<string | null>("");

  const [isNetwork, setIsNetwork] = useState("");

  const [isStart, setIsStart] = useState(false);

  // New state for payment status handling
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusType>("waiting");
  const [partialPaymentData, setPartialPaymentData] = useState<PartialPaymentData | null>(null);
  const [overpaymentData, setOverpaymentData] = useState<OverpaymentData | null>(null);
  
  // Track if we've seen a final status to prevent flicker
  const [hasCompletedPayment, setHasCompletedPayment] = useState(false);
  const hasCompletedPaymentRef = useRef(false);
  
  // Merchant settings from backend (with defaults)
  const [merchantSettings, setMerchantSettings] = useState<MerchantSettings>({
    overpayment_threshold_usd: 5,  // Default $5, will be updated from backend
    grace_period_minutes: 30       // Default 30 min, will be updated from backend (matches backend default)
  });

  // Polling trigger to restart polling after underpayment
  const [pollingTrigger, setPollingTrigger] = useState(0);
  
  // Polling active indicator
  const [isPolling, setIsPolling] = useState(false);
  
  // Copy feedback state
  const [showCopyToast, setShowCopyToast] = useState(false);

  // State for configured currencies
  const [availableCryptos, setAvailableCryptos] = useState<string[]>([]);
  const [availableUSDTNetworks, setAvailableUSDTNetworks] = useState<('TRC20' | 'ERC20' | 'POLYGON')[]>([]);
  const [availableRLUSDNetworks, setAvailableRLUSDNetworks] = useState<('XRPL' | 'ERC20')[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);
  const [skipSelection, setSkipSelection] = useState(false);
  const [currencyError, setCurrencyError] = useState<string | null>(null);

  // Rate caching state
  const [prefetchedRates, setPrefetchedRates] = useState<currencyData[] | null>(null);
  const [ratesFetchedAt, setRatesFetchedAt] = useState<number>(0);
  const [loadingStep, setLoadingStep] = useState<'rates' | 'payment' | null>(null);
  // Track which fee_payer value was used for cached rates
  const [cachedFeePayer, setCachedFeePayer] = useState<string>('');

  // Track if we're in partial payment completion mode
  const [isPartialPaymentMode, setIsPartialPaymentMode] = useState(false);
  const isPartialPaymentModeRef = useRef(false);
  // Monotonic request id — only the latest coin/network selection's response is applied
  const requestSeqRef = useRef(0);
  // Targets (e.g. "USDT-TRC20", "ETH") currently being fetched — blocks duplicate
  // concurrent calls so the same address is never reserved twice.
  const inFlightTargetsRef = useRef<Set<string>>(new Set());
  const [remainingPaymentInfo, setRemainingPaymentInfo] = useState<{
    remainingAmount: number;
    remainingAmountUsd: number;
    currency: string;
  } | null>(null);

  // Track if this is a continuation of an existing payment
  const [isContinuation, setIsContinuation] = useState(false);
  const [continuationMessage, setContinuationMessage] = useState<string | null>(null);

  // Storage key for persisting payment state across language changes
  const PAYMENT_STATE_KEY = `payment_state_${transactionId || 'default'}`;

  // Restore payment state on mount (for language change persistence)
  useEffect(() => {
    if (typeof window !== 'undefined' && transactionId) {
      const savedState = sessionStorage.getItem(PAYMENT_STATE_KEY);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (parsed.transactionId === transactionId) {
            // Restore the payment status
            if (parsed.paymentStatus) {
              setPaymentStatus(parsed.paymentStatus);
            }
            if (parsed.selectedCurrency) {
              setSelectedCurrency(parsed.selectedCurrency);
            }
            
            // Restore confirmed state
            if (parsed.paymentStatus === "confirmed") {
              setIsReceived(true);
              setHasCompletedPayment(true);
              hasCompletedPaymentRef.current = true;
              console.log('[CryptoTransfer] Restored payment CONFIRMED state from sessionStorage');
            }
            // Restore underpaid state
            else if (parsed.paymentStatus === "underpaid" && parsed.partialPaymentData) {
              setPartialPaymentData(parsed.partialPaymentData);
              setIsStart(true);
              console.log('[CryptoTransfer] Restored payment UNDERPAID state from sessionStorage');
            }
            // Restore overpaid state
            else if (parsed.paymentStatus === "overpaid" && parsed.overpaymentData) {
              setOverpaymentData(parsed.overpaymentData);
              setIsReceived(true);
              setIsStart(true);
              console.log('[CryptoTransfer] Restored payment OVERPAID state from sessionStorage');
            }
            // Restore expired state
            else if (parsed.paymentStatus === "expired") {
              console.log('[CryptoTransfer] Restored payment EXPIRED state from sessionStorage');
            }
          }
        } catch (e) {
          console.error('[CryptoTransfer] Failed to parse saved state:', e);
        }
      }
    }
  }, [transactionId, PAYMENT_STATE_KEY]);

  // Save payment state when it changes (for language change persistence)
  useEffect(() => {
    if (typeof window !== 'undefined' && transactionId && paymentStatus !== "waiting") {
      const stateToSave: any = {
        paymentStatus,
        transactionId,
        selectedCurrency,
        timestamp: Date.now()
      };
      
      // Include underpaid data if applicable
      if (paymentStatus === "underpaid" && partialPaymentData) {
        stateToSave.partialPaymentData = partialPaymentData;
      }
      // Include overpaid data if applicable
      if (paymentStatus === "overpaid" && overpaymentData) {
        stateToSave.overpaymentData = overpaymentData;
      }
      
      sessionStorage.setItem(PAYMENT_STATE_KEY, JSON.stringify(stateToSave));
      console.log('[CryptoTransfer] Saved payment state to sessionStorage:', paymentStatus);
    }
  }, [paymentStatus, transactionId, selectedCurrency, partialPaymentData, overpaymentData, PAYMENT_STATE_KEY]);

  // Fetch configured currencies on mount
  useEffect(() => {
    const fetchConfiguredCurrencies = async () => {
      try {
        setLoadingCurrencies(true);
        setCurrencyError(null);
        
        const response = await axiosBaseApi.get("/pay/configured-currencies");
        const data = response?.data?.data || response?.data;
        
        const configuredCurrencies: string[] = data?.configured_currencies || [];
        const shouldSkipSelection = data?.skip_selection || false;
        
        // Parse currencies - separate base currencies and USDT/RLUSD networks
        const baseCryptos: string[] = [];
        const usdtNetworks: ('TRC20' | 'ERC20' | 'POLYGON')[] = [];
        const rlusdNetworks: ('XRPL' | 'ERC20')[] = [];
        
        configuredCurrencies.forEach((currency: string) => {
          if (currency.startsWith('USDT-')) {
            const network = currency.replace('USDT-', '') as 'TRC20' | 'ERC20' | 'POLYGON';
            if (network === 'TRC20' || network === 'ERC20' || network === 'POLYGON') {
              usdtNetworks.push(network);
              if (!baseCryptos.includes('USDT')) {
                baseCryptos.push('USDT');
              }
            }
          } else if (currency.startsWith('RLUSD-')) {
            const network = currency.replace('RLUSD-', '') as 'XRPL' | 'ERC20';
            if (network === 'XRPL' || network === 'ERC20') {
              rlusdNetworks.push(network);
              if (!baseCryptos.includes('RLUSD')) {
                baseCryptos.push('RLUSD');
              }
            }
          } else if (currency === 'RLUSD') {
            // Plain RLUSD without network defaults to XRPL
            if (!rlusdNetworks.includes('XRPL')) {
              rlusdNetworks.push('XRPL');
            }
            if (!baseCryptos.includes('RLUSD')) {
              baseCryptos.push('RLUSD');
            }
          } else {
            baseCryptos.push(currency);
          }
        });
        
        setAvailableCryptos(baseCryptos);
        setAvailableUSDTNetworks(usdtNetworks);
        setAvailableRLUSDNetworks(rlusdNetworks);
        setSkipSelection(shouldSkipSelection);
        
        // Auto-select if skip_selection is true and only one option
        if (shouldSkipSelection && baseCryptos.length === 1) {
          const autoSelectedCrypto = baseCryptos[0];
          setSelectedCrypto(autoSelectedCrypto);
          setIsNetwork(autoSelectedCrypto);
          
          if (autoSelectedCrypto === 'USDT' && usdtNetworks.length === 1) {
            setSelectedNetwork(usdtNetworks[0]);
            getCurrencyRateAndSubmit('USDT', usdtNetworks[0]);
          } else if (autoSelectedCrypto === 'RLUSD' && rlusdNetworks.length === 1) {
            setSelectedNetwork(rlusdNetworks[0]);
            getCurrencyRateAndSubmit('RLUSD', rlusdNetworks[0]);
          } else if (autoSelectedCrypto !== 'USDT' && autoSelectedCrypto !== 'RLUSD') {
            getCurrencyRateAndSubmit(autoSelectedCrypto);
          }
        }
      } catch (e: any) {
        const message = e?.response?.data?.message ?? e?.message ?? "Failed to load currencies";
        setCurrencyError(message);
        // Set defaults if API fails - show all currencies
        setAvailableCryptos(cryptoOptions.map(opt => opt.value));
        setAvailableUSDTNetworks(['TRC20', 'ERC20', 'POLYGON']);
        setAvailableRLUSDNetworks(['XRPL', 'ERC20']);
      } finally {
        setLoadingCurrencies(false);
      }
    };
    
    fetchConfiguredCurrencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefetch currency rates when component mounts
  useEffect(() => {
    const prefetchRates = async () => {
      if (!walletState?.amount || !walletState?.currency) return;
      
      console.log("Prefetching rates with feePayer:", feePayer);
      
      try {
        // Calculate total amount including tax
        const baseAmount = Number(walletState?.amount || 0);
        const taxAmount = Number(taxInfo?.amount || 0);
        const totalAmountWithTax = baseAmount + taxAmount;
        
        // When customer pays fees, send base amount only — backend adds tax + fees
        // When company pays fees, send tax-inclusive amount — backend returns raw conversion
        const amountForRates = feePayer === 'customer' ? baseAmount : totalAmountWithTax;
        
        const rateResponse = await axiosBaseApi.post("/pay/getCurrencyRates", {
          source: walletState?.currency,
          amount: amountForRates,
          currencyList: cryptoOptions.map((x) => x.value),
          fixedDecimal: false,
          fee_payer: feePayer,
          tax_amount: taxAmount,
        });
        
        const rateData = rateResponse?.data?.data;
        console.log("Prefetch response:", rateData);
        if (rateData) {
          setPrefetchedRates(rateData);
          setRatesFetchedAt(Date.now());
          setCachedFeePayer(feePayer || '');  // Track fee_payer used for this cache
        }
      } catch (e) {
        // Silent fail for prefetch - will fetch again when needed
        console.log("Rate prefetch failed, will fetch on demand");
      }
    };
    
    prefetchRates();
  }, [walletState?.amount, walletState?.currency, feePayer, taxInfo?.amount]);

  // Filter crypto options based on available currencies
  const filteredCryptoOptions = cryptoOptions.filter(opt => 
    availableCryptos.includes(opt.value)
  );

  const getApiCurrency = () => {
    if (selectedCrypto === "USDT") return `USDT-${selectedNetwork}`;
    if (selectedCrypto === "RLUSD") return `RLUSD-${selectedNetwork}`;
    return (
      cryptoOptions.find((opt) => opt.value === selectedCrypto)?.currency || ""
    );
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(cryptoDetails?.address);
    setCopied(true);
    setShowCopyToast(true);
    dispatch({
      type: TOAST_SHOW,
      payload: {
        message: t('crypto.addressCopied'),
        severity: "success",
      },
    });
    setTimeout(() => {
      setCopied(false);
      setShowCopyToast(false);
    }, 2000);
  };

  // Copy memo/tag to clipboard
  const handleCopyMemo = () => {
    if (!cryptoDetails?.memo) return;
    navigator.clipboard.writeText(cryptoDetails.memo);
    setShowCopyToast(true);
    dispatch({
      type: TOAST_SHOW,
      payload: {
        message: t('crypto.memoCopied', { defaultValue: 'Memo/Tag copied to clipboard' }),
        severity: "success",
      },
    });
    setTimeout(() => {
      setShowCopyToast(false);
    }, 2000);
  };

  // Check if the selected crypto requires a memo/destination tag
  const requiresMemo = (crypto: string, network?: string): boolean => {
    return crypto === 'XRP' || (crypto === 'RLUSD' && network === 'XRPL');
  };
  
  // Copy amount to clipboard
  const handleCopyAmount = () => {
    const amount = isPartialPaymentMode && remainingPaymentInfo
      ? remainingPaymentInfo.remainingAmount
      : (selectedCurrency?.total_amount || selectedCurrency?.amount || 0);
    navigator.clipboard.writeText(String(amount));
    dispatch({
      type: TOAST_SHOW,
      payload: {
        message: t('crypto.amountCopied'),
        severity: "success",
      },
    });
  };
  
  // Get polling interval based on chain (faster chains poll more frequently)
  const getPollingInterval = (crypto: string, network?: string): number => {
    // TRX and USDT-TRC20 are faster
    if (crypto === 'TRX' || (crypto === 'USDT' && network === 'TRC20')) {
      return 10000; // 10 seconds
    }
    // BTC is slower
    if (crypto === 'BTC') {
      return 30000; // 30 seconds
    }
    // ETH and ERC20 tokens
    if (crypto === 'ETH' || (crypto === 'USDT' && network === 'ERC20') || (crypto === 'RLUSD' && network === 'ERC20')) {
      return 15000; // 15 seconds
    }
    // SOL is fast
    if (crypto === 'SOL') {
      return 10000; // 10 seconds
    }
    // XRP / RLUSD on XRPL are fast
    if (crypto === 'XRP' || (crypto === 'RLUSD' && network === 'XRPL')) {
      return 10000; // 10 seconds
    }
    // Polygon is relatively fast
    if (crypto === 'POLYGON' || (crypto === 'USDT' && network === 'POLYGON')) {
      return 10000; // 10 seconds
    }
    // Default for other chains
    return 15000; // 15 seconds
  };

  const getCurrencyRateAndSubmit = async (
    cryptoValue: string,
    network: "TRC20" | "ERC20" | "POLYGON" | "XRPL" = "TRC20"
  ) => {
    // This is what you display or send to backend
    const displayCurrency =
      cryptoValue === "USDT" ? `USDT-${network}`
      : cryptoValue === "RLUSD" ? `RLUSD-${network}`
      : cryptoValue;
    // Dedupe identical concurrent requests → never reserve the same address twice
    if (inFlightTargetsRef.current.has(displayCurrency)) return;
    inFlightTargetsRef.current.add(displayCurrency);
    // Latest-request-wins: a superseded selection's response is discarded below
    const seq = ++requestSeqRef.current;
    try {
      setLoading(true);
      // Reflect the new selection instantly + clear the previous chain's
      // address/QR so a stale (wrong-chain) address is never shown mid-switch.
      setSelectedCrypto(cryptoValue);
      setCryptoDetails({ qr_code: "", address: "", hash: "", memo: "" });

      // This is the actual currency key used in rateData
      const baseCurrency =
        cryptoValue === "USDT"
          ? "USDT"
          : cryptoValue === "RLUSD"
          ? "RLUSD"
          : cryptoOptions.find((x) => x.value === cryptoValue)?.currency || "";

      console.log("displayCurrency:", displayCurrency);
      console.log("baseCurrency (lookup key):", baseCurrency);

      // Calculate total amount including tax
      const baseAmount = Number(walletState?.amount || 0);
      const taxAmount = Number(taxInfo?.amount || 0);
      const totalAmountWithTax = baseAmount + taxAmount;
      
      // When customer pays fees, send base amount only — backend adds tax + fees to avoid double-counting
      // When company pays fees, send tax-inclusive amount — backend returns raw conversion
      const amountForRates = feePayer === 'customer' ? baseAmount : totalAmountWithTax;
      
      console.log(`Crypto conversion: base=${baseAmount}, tax=${taxAmount}, total=${totalAmountWithTax}, amountForRates=${amountForRates} (feePayer=${feePayer})`);

      let rateData: currencyData[] | null = null;
      
      // Check if we have fresh cached rates
      const isCacheValid = prefetchedRates && 
        (Date.now() - ratesFetchedAt) < RATE_CACHE_DURATION_MS &&
        cachedFeePayer === (feePayer || '');  // Invalidate cache if fee_payer changed
      
      if (isCacheValid) {
        console.log("Using cached rates");
        rateData = prefetchedRates;
      } else {
        // Fetch fresh rates with silent auto-retry (up to 3 attempts)
        setLoadingStep('rates');
        const MAX_RATE_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RATE_RETRIES; attempt++) {
          try {
            const rateResponse = await axiosBaseApi.post("/pay/getCurrencyRates", {
              source: walletState?.currency,
              amount: amountForRates,
              currencyList: cryptoOptions.map((x) => x.value),
              fixedDecimal: false,
              fee_payer: feePayer,
              tax_amount: taxAmount,
            });
            rateData = rateResponse?.data?.data;
            if (rateData && rateData.length > 0) break; // Success — exit retry loop
          } catch (rateErr) {
            console.warn(`[Crypto] Rate fetch attempt ${attempt}/${MAX_RATE_RETRIES} failed:`, rateErr);
          }
          // Brief delay before retry (500ms, 1000ms)
          if (attempt < MAX_RATE_RETRIES) {
            await new Promise(r => setTimeout(r, attempt * 500));
          }
        }
        
        // Update cache
        if (rateData) {
          setPrefetchedRates(rateData);
          setRatesFetchedAt(Date.now());
          setCachedFeePayer(feePayer || '');  // Track fee_payer used for this cache
        }
      }

      // Discard if a newer selection superseded this request while rates were fetching
      if (seq !== requestSeqRef.current) return;

      const findRate = rateData?.find(
        (item: any) => item.currency === baseCurrency
      );

      console.log("findRate for", baseCurrency, ":", findRate);
      console.log("total_amount_source:", findRate?.total_amount_source);

      // Guard: If rate data is unavailable after retries, abort cleanly
      if (!findRate || (!findRate.total_amount && !findRate.amount)) {
        dispatch({ type: TOAST_SHOW, payload: { message: "Unable to fetch conversion rate. Please try again.", severity: "error" } });
        return;
      }

      setCurrencyRates(rateData || undefined);
      setSelectedCurrency(findRate);

      // Create payment
      setLoadingStep('payment');
      
      const finalPayload = {
        currency: displayCurrency, // e.g., "USDT-TRC20"
        amount: findRate.total_amount || findRate.amount, // use total_amount when customer pays fees
        paymentType: paymentTypes.CRYPTO,
      };

      console.log("finalPayload", finalPayload);

      const encrypted = await createEncryption(JSON.stringify(finalPayload));
      const submitResponse = await axiosBaseApi.post("/pay/addPayment", {
        data: encrypted,
      });

      const result = submitResponse?.data?.data;

      // Discard if superseded during payment creation (never show a stale address)
      if (seq !== requestSeqRef.current) return;

      if (result?.redirect) {
        window.location.replace(result.redirect);
      } else {
        // Check if this is a continuation of existing payment
        if (result?.is_continuation) {
          setIsContinuation(true);
          setContinuationMessage(result.message || 'Continuing existing payment');
          console.log('[Crypto Payment] Continuation of existing payment:', result.message);
        }
        
        // Set timer from response - works for both new and continuation payments
        // Backend may return remaining_minutes, expires_in_minutes, or expiration_minutes
        const timerMinutes = result?.remaining_minutes || result?.expires_in_minutes || result?.expiration_minutes;
        if (timerMinutes && timerMinutes > 0) {
          setTimeLeft(timerMinutes * 60);
          console.log('[Crypto Payment] Timer set to', timerMinutes, 'minutes');
        }
        
        // Extract memo/destination tag - backend may return as memo, tag, destination_tag, or dt
        const memo = result?.memo || result?.tag || result?.destination_tag || result?.dt || "";
        
        setCryptoDetails({
          qr_code: result?.qr_code || "",
          address: result?.address || "",
          hash: result?.hash || "",
          memo: memo,
        });
        
        if (memo) {
          console.log('[Crypto Payment] Memo/Tag received:', memo);
        }
      }
    } catch (e: any) {
      const message = e?.response?.data?.message ?? e.message;
      dispatch({ type: TOAST_SHOW, payload: { message, severity: "error" } });
    } finally {
      inFlightTargetsRef.current.delete(displayCurrency);
      // Only the latest request owns the loading UI
      if (seq === requestSeqRef.current) {
        setLoading(false);
        setLoadingStep(null);
      }
    }
  };

  const handleChange = (event: any) => {
    const value = event.target.value;
    setIsNetwork(value);
    if (value === "USDT") {
      // setSelectedNetwork('TRC20')
      setSelectedCrypto("USDT");
      setIsStart(false);
      checkNetwork(value);
    } else if (value === "RLUSD") {
      setSelectedCrypto("RLUSD");
      setIsStart(false);
      checkNetworkRLUSD(value);
    } else {
      setSelectedNetwork("");
      setIsStart(false);
      getCurrencyRateAndSubmit(value, value === "USDT" ? "TRC20" : undefined);
    }
  };

  const checkNetwork = (value: any) => {
    if (selectedNetwork) {
      setIsStart(false);
      getCurrencyRateAndSubmit(value, value === "USDT" ? "TRC20" : undefined);
    }
  };

  const checkNetworkRLUSD = (value: any) => {
    if (selectedNetwork) {
      setIsStart(false);
      getCurrencyRateAndSubmit(value, selectedNetwork as "XRPL" | "ERC20");
    }
  };

  const handleNetworkChange = (network: "TRC20" | "ERC20" | "POLYGON") => {
    setSelectedNetwork(network);
    setIsStart(false);
    getCurrencyRateAndSubmit("USDT", network);
  };

  const handleRLUSDNetworkChange = (network: "XRPL" | "ERC20") => {
    setSelectedNetwork(network);
    setIsStart(false);
    getCurrencyRateAndSubmit("RLUSD", network);
  };

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, selectedCrypto]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  };

  /**
   * Format the crypto amount displayed on the checkout page.
   *
   * Delegates to the shared `formatCryptoAmount` helper in
   * `utils/currencyFormat.ts` — which:
   *   • recognises every supported crypto (BTC/ETH/USDC/USDT/RLUSD/XRP/SOL/…)
   *     including chain-suffixed variants (USDT-TRC20, RLUSD-XRPL, …),
   *   • uses up to 8 decimals of precision (never loses on-chain amount detail),
   *   • trims trailing zeros so a whole 25 renders as "25", not "25.000000".
   *
   * Session 44 bug fix (2026-07-13): the previous local implementation hard-
   * coded `.toFixed(6)` for every crypto — so 25 USDC rendered as
   * "25.000000 USDC" on the checkout, and the same padding happened for USDT,
   * RLUSD, BTC (as "0.001000") etc. The single source of truth now lives in
   * the shared helper — do NOT re-add crypto lists here.
   */
  function formatAmount(amount: any, currency: string): string {
    if (amount === undefined || amount === null || amount === '') return '0';
    const num = typeof amount === 'number' ? amount : Number(amount);
    if (!isFinite(num)) return '0';
    // Non-crypto (fiat) fallback goes through formatCryptoAmount too — it
    // routes to formatWithSeparators(2dp) internally for anything not on
    // the crypto list.
    return formatCryptoAmount(num, currency || '');
  }

  useEffect(() => {
    // if (!selectedCrypto) return

    const isValidSelection =
      selectedCrypto &&
      (selectedCrypto !== "USDT" ||
        ["TRC20", "ERC20", "POLYGON"].includes(selectedNetwork)) &&
      (selectedCrypto !== "RLUSD" ||
        ["XRPL", "ERC20"].includes(selectedNetwork));

    if (!isValidSelection) return;
    
    // Don't start polling if no address yet
    if (!cryptoDetails?.address) return;

    // CRITICAL: Don't reset state or restart polling if payment is already completed
    // This prevents the confirmed state from being overwritten during language changes
    if (hasCompletedPaymentRef.current) {
      console.log('[CryptoTransfer] Payment already completed, skipping polling restart');
      return;
    }

    setIsReceived(false);
    setPaymentStatus("waiting");
    setIsPolling(true); // Start polling indicator
    
    // Get appropriate polling interval based on chain
    const pollingIntervalMs = getPollingInterval(selectedCrypto, selectedNetwork);
    
    // Track if this is first poll to show "pending" toast only once
    let hasPendingToastShown = false;

    const pollInterval = setInterval(async () => {
      try {
        const response = await axiosBaseApi.post("/pay/verifyCryptoPayment", {
          address: cryptoDetails?.address,
        });
        const data = response?.data?.data;
        const status = data?.status as PaymentStatusType;
        const redirectUrl = data?.redirect;
        
        // Update merchant settings if provided by backend
        if (data?.merchant_settings) {
          setMerchantSettings({
            overpayment_threshold_usd: data.merchant_settings.overpayment_threshold_usd ?? 5,
            grace_period_minutes: data.merchant_settings.grace_period_minutes ?? 15
          });
        }
        
        // Update timer from backend's remaining_seconds if provided
        if (data?.remaining_seconds !== undefined && data?.remaining_seconds > 0) {
          setTimeLeft(data.remaining_seconds);
        }

        // Before processing any status, check if we received a final status
        // Final statuses take precedence over intermediate states
        if (["confirmed", "overpaid"].includes(status)) {
          // Clear any partial payment UI immediately
          setPartialPaymentData(null);
          setHasCompletedPayment(true);
          hasCompletedPaymentRef.current = true;
        }

        setPaymentStatus(status);

        switch (status) {
          case "waiting":
            // No payment detected yet - keep waiting
            setIsStart(false);
            setIsReceived(false);
            break;

          case "pending":
            // Payment detected, awaiting blockchain confirmation
            // If in partial payment mode, don't show "payment detected" for old payment
            // Keep showing "monitoring for payment" until we get confirmed/underpaid again
            if (isPartialPaymentModeRef.current) {
              // In partial payment mode - keep monitoring, don't show detected message
              // The old payment is already processed, we're waiting for new payment
              setIsStart(false);
              setIsReceived(false);
              // Don't clear interval - keep polling
              break;
            }
            
            setIsStart(true);
            setIsReceived(false);
            // Show user feedback that payment was detected (only once)
            if (!hasPendingToastShown) {
              hasPendingToastShown = true;
              dispatch({
                type: TOAST_SHOW,
                payload: {
                  message: t('crypto.paymentDetectedToast'),
                  severity: "info",
                },
              });
            }
            // Don't clear interval - keep polling until confirmed/failed
            break;

          case "confirmed":
            // Payment confirmed successfully
            setPaymentStatus("confirmed");
            setIsStart(true);
            setIsReceived(true);
            setIsUrl(redirectUrl);
            setIsPartialPaymentMode(false);  // Reset partial payment mode
            isPartialPaymentModeRef.current = false;
            setRemainingPaymentInfo(null);    // Clear remaining payment info
            setIsPolling(false); // Stop polling indicator
            clearInterval(pollInterval);
            break;

          case "underpaid":
            // Don't go back to underpaid if we've already completed (use ref to avoid stale closure)
            if (hasCompletedPaymentRef.current) {
              break;
            }
            
            // Double-check this isn't stale data from a completed payment
            if (data?.completedAt) {
              // Payment was actually completed - treat as confirmed
              setPaymentStatus("confirmed");
              setIsStart(true);
              setIsReceived(true);
              break;
            }
            
            // If already in partial payment mode, don't show underpayment screen again
            // Just keep polling for the remaining payment - keep showing "Monitoring" message
            if (isPartialPaymentModeRef.current) {
              // Stay on payment screen with monitoring message, don't set isStart
              setIsStart(false);
              setIsReceived(false);
              // Don't clear interval - keep polling for new payment
              break;
            }
            
            // Partial payment received (first time)
            setIsStart(true);
            setIsReceived(false);
            
            setPartialPaymentData({
              paidAmount: data?.paidAmount || 0,
              expectedAmount: data?.expectedAmount || 0,
              remainingAmount: data?.remainingAmount || 0,
              currency: data?.currency || walletState?.currency || "USD",
              txId: data?.txId || "",
              graceMinutes: data?.grace_period_minutes ?? data?.merchant_settings?.grace_period_minutes ?? 15,
              address: cryptoDetails?.address,
              paidAmountUsd: data?.paidAmountUsd || 0,
              expectedAmountUsd: data?.expectedAmountUsd || 0,
              remainingAmountUsd: data?.remainingAmountUsd || 0,
              baseCurrency: data?.baseCurrency || "USD",
            });
            setIsPolling(false); // Stop polling indicator
            clearInterval(pollInterval);
            break;

          case "overpaid":
            // More than expected was paid
            setIsStart(true);
            setIsReceived(true);

            // Only show overpayment screen if excess amount > merchant's threshold
            const excessUsd = data?.excessAmountUsd || 0;
            // Use merchant_settings from backend response, fallback to current state default
            const threshold = data?.merchant_settings?.overpayment_threshold_usd ?? merchantSettings.overpayment_threshold_usd;
            
            console.log('[CryptoTransfer] Overpayment detected - excessUsd:', excessUsd, 'threshold:', threshold);

            if (excessUsd > threshold) {
              // Significant overpayment - show overpayment screen
              setOverpaymentData({
                paidAmount: data?.paidAmount || 0,
                expectedAmount: data?.expectedAmount || 0,
                excessAmount: data?.excessAmount || 0,
                currency: data?.currency || walletState?.currency || "USD",
                txId: data?.txId || "",
                paidAmountUsd: data?.paidAmountUsd || 0,
                expectedAmountUsd: data?.expectedAmountUsd || 0,
                excessAmountUsd: data?.excessAmountUsd || 0,
                baseCurrency: data?.baseCurrency || "USD",
              });
            } else {
              // Minor overpayment (<= threshold) - treat as confirmed and show success screen
              setPaymentStatus("confirmed");
              setHasCompletedPayment(true);
              hasCompletedPaymentRef.current = true;
              setIsPartialPaymentMode(false);
              isPartialPaymentModeRef.current = false;
              setRemainingPaymentInfo(null);
              console.log('[CryptoTransfer] Minor overpayment treated as confirmed');
              
              // Redirect if URL provided
              setIsUrl(redirectUrl);
              if (redirectUrl) {
                window.location.replace(redirectUrl);
              }
            }
            setIsUrl(redirectUrl);
            setIsPolling(false); // Stop polling indicator
            clearInterval(pollInterval);
            break;

          case "expired":
            // Payment window expired
            setIsStart(false);
            setIsReceived(false);
            setIsPolling(false); // Stop polling indicator
            clearInterval(pollInterval);
            dispatch({
              type: TOAST_SHOW,
              payload: {
                message: t('crypto.paymentExpired'),
                severity: "error",
              },
            });
            break;

          case "failed":
            // Payment processing failed
            setIsStart(false);
            setIsReceived(false);
            setIsPolling(false);
            clearInterval(pollInterval);
            dispatch({
              type: TOAST_SHOW,
              payload: {
                message: data.message || t('crypto.paymentFailed', { defaultValue: 'Payment processing failed. Please try again.' }),
                severity: "error",
              },
            });
            break;

          default:
            // Unknown status - handle gracefully
            break;
        }
      } catch (e: any) {
        const message = e?.response?.data?.message ?? e?.message;
        const status = e?.response?.status;
        
        // Handle specific error cases
        if (status === 400) {
          // Check for expiry-related errors
          if (message?.toLowerCase().includes('expired')) {
            setPaymentStatus("expired");
            setIsPolling(false);
            clearInterval(pollInterval);
            dispatch({
              type: TOAST_SHOW,
              payload: {
                message: t('crypto.paymentLinkExpired', { defaultValue: 'This payment link has expired.' }),
                severity: "error",
              },
            });
            return;
          }
          // Check for other validation errors
          if (message?.toLowerCase().includes('invalid') || message?.toLowerCase().includes('not found')) {
            setPaymentStatus("failed");
            setIsPolling(false);
            clearInterval(pollInterval);
            dispatch({
              type: TOAST_SHOW,
              payload: {
                message: message || t('crypto.paymentError', { defaultValue: 'Payment error occurred.' }),
                severity: "error",
              },
            });
            return;
          }
        }
        
        // Handle server errors (500)
        if (status === 500) {
          console.error('[CryptoTransfer] Server error during polling:', message);
          // Don't stop polling for transient server errors, but log them
        }
        
        // Log other errors but don't interrupt user experience
        console.error('[CryptoTransfer] Polling error:', message);
      }
    }, pollingIntervalMs);

    return () => {
      clearInterval(pollInterval);
      setIsPolling(false); // Clean up polling indicator
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCrypto, cryptoDetails?.address, dispatch, selectedNetwork, walletState?.currency, pollingTrigger]);

  // const handleVerify = async () => {
  //   try {
  //     const {
  //       data: { data }
  //     } = await axiosBaseApi.post('/pay/verifyCryptoPayment', {
  //       address: cryptoDetails?.address
  //     })
  //     window.location.replace(data)
  //     console.log('data', data)
  //   } catch (e: any) {
  //     const message = e?.response?.data?.message ?? e?.message
  //     dispatch({
  //       type: TOAST_SHOW,
  //       payload: {
  //         message: message,
  //         severity: 'error'
  //       }
  //     })
  //   }
  // }

  const btnGotoWeb = () => {
    // Use redirectUrl prop if available, otherwise fall back to isUrl from API response
    const targetUrl = redirectUrl || isUrl;
    if (targetUrl) {
      // If redirectUrl prop is used, append transaction info
      if (redirectUrl && cryptoDetails?.hash) {
        try {
          const url = new URL(redirectUrl);
          url.searchParams.set('transaction_id', cryptoDetails.hash);
          url.searchParams.set('status', 'success');
          window.location.replace(url.toString());
          return;
        } catch (e) {
          // If URL parsing fails, use as-is
          window.location.replace(redirectUrl);
          return;
        }
      }
      window.location.replace(targetUrl);
    } else {
      console.log("No URL provided");
    }
  };

  // Handler for paying remaining amount in underpayment scenario
  const handlePayRemaining = (method: "bank" | "crypto") => {
    if (method === "crypto") {
      // IMPORTANT: Keep the same address for partial payment completion
      // Do NOT regenerate address or clear cryptoDetails
      
      if (partialPaymentData) {
        // Store remaining payment info for display
        setRemainingPaymentInfo({
          remainingAmount: partialPaymentData.remainingAmount,
          remainingAmountUsd: partialPaymentData.remainingAmountUsd || 0,
          currency: partialPaymentData.currency,
        });
        
        // Update selectedCurrency to show REMAINING amount
        setSelectedCurrency((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            currency: partialPaymentData.currency,
            amount: partialPaymentData.remainingAmount,
            total_amount: partialPaymentData.remainingAmount,
            total_amount_usd: partialPaymentData.remainingAmountUsd || 0,
            total_amount_source: partialPaymentData.remainingAmountUsd || 0,
          } as currencyData;
        });
        
        setIsPartialPaymentMode(true);
        isPartialPaymentModeRef.current = true;
      }
      
      setPaymentStatus("waiting");
      setIsStart(false);  // Show "To Pay" card with remaining amount
      setIsReceived(false);
      setPartialPaymentData(null); // Clear to exit UnderPayment screen
      
      // FIX: Reset timer to grace period (from backend or default 15 minutes)
      const gracePeriodSeconds = (partialPaymentData?.graceMinutes || merchantSettings.grace_period_minutes) * 60;
      setTimeLeft(gracePeriodSeconds);
      
      // FIX: Increment polling trigger to restart polling
      setPollingTrigger(prev => prev + 1);
    } else {
      // Bank transfer - reset for different payment method
      setPaymentStatus("waiting");
      setPartialPaymentData(null);
      setIsPartialPaymentMode(false);
      isPartialPaymentModeRef.current = false;
      setRemainingPaymentInfo(null);
      setActiveStep(1);
    }
  };

  // Handler for going to website after overpayment
  const handleOverpaymentGoToWebsite = () => {
    btnGotoWeb();
  };

  // Render UnderPayment component
  if (paymentStatus === "underpaid" && partialPaymentData) {
    return (
      <UnderPayment
        paidAmount={partialPaymentData.paidAmount}
        expectedAmount={partialPaymentData.expectedAmount}
        remainingAmount={partialPaymentData.remainingAmount}
        currency={partialPaymentData.currency}
        onPayRemaining={handlePayRemaining}
        transactionId={partialPaymentData.txId}
        paidAmountUsd={partialPaymentData.paidAmountUsd}
        expectedAmountUsd={partialPaymentData.expectedAmountUsd}
        remainingAmountUsd={partialPaymentData.remainingAmountUsd}
        baseCurrency={partialPaymentData.baseCurrency}
        graceMinutes={partialPaymentData.graceMinutes}
        displayCurrency={displayCurrency}
        transferRate={transferRate}
      />
    );
  }

  // Render OverPayment component
  if (paymentStatus === "overpaid" && overpaymentData) {
    return (
      <OverPayment
        paidAmount={overpaymentData.paidAmount}
        expectedAmount={overpaymentData.expectedAmount}
        excessAmount={overpaymentData.excessAmount}
        currency={overpaymentData.currency}
        onGoToWebsite={handleOverpaymentGoToWebsite}
        transactionId={overpaymentData.txId}
        paidAmountUsd={overpaymentData.paidAmountUsd}
        expectedAmountUsd={overpaymentData.expectedAmountUsd}
        excessAmountUsd={overpaymentData.excessAmountUsd}
        baseCurrency={overpaymentData.baseCurrency}
        displayCurrency={displayCurrency}
        transferRate={transferRate}
      />
    );
  }

  // Render Success screen using TransferExpectedCard when payment is confirmed
  if (isRecived && paymentStatus === "confirmed") {
    const cryptoAmount = formatAmount(
      isPartialPaymentMode && remainingPaymentInfo
        ? remainingPaymentInfo.remainingAmount
        : (selectedCurrency?.total_amount || selectedCurrency?.amount || 0),
      selectedCurrency?.currency || ""
    );
    const fiatAmount = formatWithSeparators(
      Number(selectedCurrency?.total_amount_usd || selectedCurrency?.total_amount_source || walletState?.amount || 0) * transferRate,
      displayCurrency
    );
    const amountDisplay = `${cryptoAmount} ${selectedCurrency?.currency || ''} (≈ ${fiatAmount} ${displayCurrency})`;
    
    return (
      <TransferExpectedCard
        isTrue={true}
        dataUrl=""
        type="crypto"
        redirectUrl={redirectUrl}
        transactionId={transactionId || cryptoDetails?.hash}
        merchantName={merchantInfo?.name}
        amount={amountDisplay}
        email={email}
        customerName={customerName}
        linkType={linkType}
        contributionInfo={contributionInfo}
      />
    );
  }

  // Render Failed Payment UI
  if (paymentStatus === "failed") {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={2}
        minHeight="calc(100vh - 340px)"
      >
        <Paper
          elevation={3}
          sx={{
            borderRadius: 4,
            p: "34px",
            width: "100%",
            maxWidth: 450,
            textAlign: "center",
            border: `1px solid ${isDark ? '#FCA5A5' : '#FFE0E0'}`,
            boxShadow: isDark ? "0px 45px 64px 0px rgba(0,0,0,0.3)" : "0px 45px 64px 0px #0D03230F",
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              backgroundColor: isDark ? 'rgba(254, 242, 242, 0.15)' : "#FEF2F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <Icon icon="solar:close-circle-bold" width={40} height={40} color="#EF4444" />
          </Box>

          <Typography
            variant="h5"
            fontWeight={600}
            fontFamily="var(--font-sans)"
            color={theme.palette.text.primary}
            mb={2}
          >
            {t('failed.title', { defaultValue: 'Payment Failed' })}
          </Typography>

          <Typography
            variant="body1"
            fontFamily="var(--font-sans)"
            color={theme.palette.text.secondary}
            mb={3}
            lineHeight={1.6}
          >
            {t('failed.message', { defaultValue: 'There was an issue processing your payment. Please try again or contact support if the problem persists.' })}
          </Typography>

          {merchantInfo?.name && (
            <Box
              sx={{
                backgroundColor: theme.palette.action.hover,
                borderRadius: 2,
                p: 2,
                mb: 3,
              }}
            >
              <Typography
                variant="body2"
                fontFamily="var(--font-sans)"
                color={theme.palette.text.secondary}
              >
                {t('failed.merchant', { defaultValue: 'Merchant' })}
              </Typography>
              <Typography
                variant="body1"
                fontWeight={600}
                fontFamily="var(--font-sans)"
                color={theme.palette.text.primary}
              >
                {merchantInfo.name}
              </Typography>
            </Box>
          )}

          <Button
            variant="contained"
            fullWidth
            onClick={() => {
              // Reset state to allow retry
              setPaymentStatus("waiting");
              setSelectedCrypto("");
              setSelectedNetwork("");
              setCryptoDetails({ qr_code: "", hash: "", address: "", memo: "" });
              setIsStart(false);
            }}
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              borderRadius: "30px",
              py: 1.5,
              fontWeight: 500,
              textTransform: "none",
              mb: 2,
              "&:hover": {
                backgroundColor: theme.palette.primary.dark || theme.palette.primary.main,
              },
            }}
          >
            {t('failed.tryAgain', { defaultValue: 'Try Again' })}
          </Button>

          <Button
            variant="outlined"
            fullWidth
            onClick={() => setActiveStep(0)}
            sx={{
              borderColor: theme.palette.border.main,
              color: theme.palette.text.primary,
              borderRadius: "30px",
              py: 1.5,
              fontWeight: 500,
              textTransform: "none",
              "&:hover": {
                borderColor: theme.palette.border.main,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            {t('failed.goBack', { defaultValue: 'Go Back' })}
          </Button>
        </Paper>
      </Box>
    );
  }

  // Render Expired Payment UI
  if (paymentStatus === "expired") {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={2}
        minHeight="calc(100vh - 340px)"
      >
        <Paper
          elevation={3}
          sx={{
            borderRadius: 4,
            p: "34px",
            width: "100%",
            maxWidth: 450,
            textAlign: "center",
            border: "1px solid #FFE0E0",
            boxShadow: "0px 45px 64px 0px #0D03230F",
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              backgroundColor: isDark ? 'rgba(240, 68, 56, 0.15)' : "#FEF3F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <Icon icon="solar:clock-circle-bold" width={40} height={40} color="#F04438" />
          </Box>

          <Typography
            variant="h5"
            fontWeight={600}
            fontFamily="var(--font-sans)"
            color={theme.palette.text.primary}
            mb={2}
          >
            {t('expired.title')}
          </Typography>

          <Typography
            variant="body1"
            fontFamily="var(--font-sans)"
            color={theme.palette.text.secondary}
            mb={3}
            lineHeight={1.6}
          >
            {t('expired.message')}
          </Typography>

          {merchantInfo?.name && (
            <Box
              sx={{
                backgroundColor: theme.palette.action.hover,
                borderRadius: 2,
                p: 2,
                mb: 3,
              }}
            >
              <Typography
                variant="body2"
                fontFamily="var(--font-sans)"
                color={theme.palette.text.secondary}
              >
                {t('expired.merchant')}
              </Typography>
              <Typography
                variant="body1"
                fontWeight={600}
                fontFamily="var(--font-sans)"
                color={theme.palette.text.primary}
              >
                {merchantInfo.name}
              </Typography>
            </Box>
          )}

          <Button
            variant="outlined"
            fullWidth
            onClick={() => setActiveStep(0)}
            sx={{
              borderColor: theme.palette.border.main,
              color: theme.palette.text.primary,
              borderRadius: "30px",
              py: 1.5,
              fontWeight: 500,
              textTransform: "none",
              "&:hover": {
                borderColor: theme.palette.border.main,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            {t('expired.goBack')}
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={2}
      minHeight="calc(100vh - 340px)"
    >
      <Paper
        elevation={3}
        sx={{
          borderRadius: 4,
          p: "34px",
          width: "100%",
          maxWidth: 450,
          marginTop: 0,
          border: `1px solid ${theme.palette.border.main}`,
          boxShadow: isDark ? "0px 45px 64px 0px rgba(0,0,0,0.3)" : "0px 45px 64px 0px #0D03230F",
          bgcolor: theme.palette.background.paper,
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5} mb={0.5}>
          <IconButton
            onClick={() => setActiveStep(activeStep - 1)}
            size="small"
            aria-label="Go back"
            sx={{
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
              borderRadius: "10px",
              width: 36,
              height: 36,
              "&:hover": { backgroundColor: theme.palette.action.selected },
            }}
          >
            <ArrowBack sx={{ fontSize: 19 }} />
          </IconButton>
          <Typography
            variant="h6"
            fontWeight={600}
            fontSize="19px"
            fontFamily="var(--font-sans)"
            color={theme.palette.text.primary}
          >
            {t('crypto.title')}
          </Typography>
        </Box>

        <Box mt={2.5} mb={1.25}>
          <Typography
            variant="subtitle2"
            fontWeight={500}
            fontSize="13px"
            fontFamily="var(--font-sans)"
            color={theme.palette.text.secondary}
          >
            {t('crypto.preferredCrypto')}
          </Typography>
        </Box>

        <FormControl fullWidth>
          {loadingCurrencies ? (
            <Box 
              display="flex" 
              alignItems="center" 
              justifyContent="center" 
              py={2}
              border={`1px solid ${theme.palette.border.main}`}
              borderRadius="10px"
            >
              <CircularProgress size={24} sx={{ color: theme.palette.primary.main }} />
              <Typography ml={2} fontFamily="var(--font-sans)" color={theme.palette.text.secondary}>
                {t('crypto.loadingCurrencies')}
              </Typography>
            </Box>
          ) : currencyError && filteredCryptoOptions.length === 0 ? (
            <Box 
              display="flex" 
              alignItems="center" 
              justifyContent="center" 
              py={2}
              border="1px solid #ef4444"
              borderRadius="10px"
              bgcolor={isDark ? 'rgba(254, 242, 242, 0.1)' : "#fef2f2"}
            >
              <Typography fontFamily="var(--font-sans)" color="#ef4444">
                {t('crypto.noCurrenciesConfigured')}
              </Typography>
            </Box>
          ) : filteredCryptoOptions.length === 0 ? (
            <Box 
              display="flex" 
              alignItems="center" 
              justifyContent="center" 
              py={2}
              border="1px solid #f59e0b"
              borderRadius="10px"
              bgcolor={isDark ? 'rgba(255, 251, 235, 0.1)' : "#fffbeb"}
            >
              <Typography fontFamily="var(--font-sans)" color="#f59e0b">
                {t('crypto.noCryptoAvailable')}
              </Typography>
            </Box>
          ) : (
            /* Clean tile grid — every available coin visible at once
               (replaces the old dropdown <Select>; same handleChange semantics) */
            <Box
              data-testid="crypto-tile-grid"
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(4, 1fr)" },
                gap: 1,
              }}
            >
              {filteredCryptoOptions?.map((option) => {
                const isSelected = selectedCrypto === option.value;
                return (
                  <Box
                    key={option.value}
                    component="button"
                    type="button"
                    data-testid={`crypto-tile-${option.value}`}
                    onClick={() => handleChange({ target: { value: option.value } })}
                    aria-pressed={isSelected}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 0.75,
                      py: 1.25,
                      px: 0.5,
                      cursor: "pointer",
                      borderRadius: "12px",
                      border: `1.5px solid ${isSelected ? ACCENT : theme.palette.border.main}`,
                      backgroundColor: isSelected
                        ? ACCENT_SOFT
                        : theme.palette.background.paper,
                      transition: "border-color 0.15s ease, background-color 0.15s ease",
                      "&:hover": {
                        borderColor: isSelected ? ACCENT : theme.palette.text.disabled,
                      },
                    }}
                  >
                    <Box sx={{ height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {option.icon}
                    </Box>
                    <Typography
                      fontSize="12px"
                      fontWeight={600}
                      fontFamily="var(--font-sans)"
                      color={theme.palette.text.primary}
                      lineHeight={1}
                    >
                      {option.value === "POLYGON" ? "POL" : option.value}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </FormControl>

        {isNetwork === "USDT" && (
          <Box mt={2}>
            <Typography
              variant="subtitle2"
              fontWeight={500}
              fontSize="13px"
              fontFamily="var(--font-sans)"
              color={theme.palette.text.secondary}
            >
              {t('crypto.preferredNetwork')}
            </Typography>
          </Box>
        )}

        {isNetwork === "USDT" && (
          availableUSDTNetworks.length > 0 ? (
            <Box mt={1} mb={2.5} display="flex" gap={1} alignItems="center" flexWrap="wrap">
              {availableUSDTNetworks.map((net) => (
                <Typography
                  key={net}
                  component="button"
                  data-testid={`network-tile-${net}`}
                  border={`1.5px solid ${selectedNetwork === net ? ACCENT : theme.palette.border.main}`}
                  padding="7px 16px"
                  fontSize="13px"
                  fontWeight={600}
                  bgcolor={selectedNetwork === net
                    ? ACCENT_SOFT
                    : theme.palette.background.paper}
                  color={theme.palette.text.primary}
                  borderRadius="10px"
                  sx={{ cursor: "pointer", transition: "border-color 0.15s ease, background-color 0.15s ease" }}
                  onClick={() => handleNetworkChange(net)}
                  fontFamily="var(--font-sans)"
                >
                  {net}
                </Typography>
              ))}
              {availableUSDTNetworks.includes('TRC20') && (
                <Typography
                  component="span"
                  data-testid="lowfee-hint"
                  sx={{
                    width: '100%',
                    mt: 0.25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11.5px',
                    color: theme.palette.text.secondary,
                  }}
                >
                  <Icon icon="mdi:leaf" width={13} color="#10B981" />
                  {t('crypto.lowestFeeHint', { defaultValue: 'TRC-20 usually has the lowest network fees.' })}
                </Typography>
              )}
            </Box>
          ) : (
            <Box 
              mt={"10px"} 
              mb={3} 
              display="flex" 
              alignItems="center"
              py={1}
              px={2}
              border="1px solid #f59e0b"
              borderRadius="8px"
              bgcolor={isDark ? 'rgba(255, 251, 235, 0.1)' : "#fffbeb"}
            >
              <Typography fontFamily="var(--font-sans)" color="#f59e0b" fontSize="small">
                {t('crypto.noUsdtNetworks')}
              </Typography>
            </Box>
          )
        )}

        {isNetwork === "RLUSD" && (
          <Box mt={2}>
            <Typography
              variant="subtitle2"
              fontWeight={500}
              fontSize="13px"
              fontFamily="var(--font-sans)"
              color={theme.palette.text.secondary}
            >
              {t('crypto.preferredNetwork')}
            </Typography>
          </Box>
        )}

        {isNetwork === "RLUSD" && (
          availableRLUSDNetworks.length > 0 ? (
            <Box mt={1} mb={2.5} display="flex" gap={1} alignItems="center" flexWrap="wrap">
              {availableRLUSDNetworks.map((net) => (
                <Typography
                  key={net}
                  component="button"
                  data-testid={`network-tile-${net}`}
                  border={`1.5px solid ${selectedNetwork === net ? ACCENT : theme.palette.border.main}`}
                  padding="7px 16px"
                  fontSize="13px"
                  fontWeight={600}
                  bgcolor={selectedNetwork === net
                    ? ACCENT_SOFT
                    : theme.palette.background.paper}
                  color={theme.palette.text.primary}
                  borderRadius="10px"
                  sx={{ cursor: "pointer", transition: "border-color 0.15s ease, background-color 0.15s ease" }}
                  onClick={() => handleRLUSDNetworkChange(net)}
                  fontFamily="var(--font-sans)"
                >
                  {net}
                </Typography>
              ))}
            </Box>
          ) : (
            <Box 
              mt={"10px"} 
              mb={3} 
              display="flex" 
              alignItems="center"
              py={1}
              px={2}
              border="1px solid #f59e0b"
              borderRadius="8px"
              bgcolor={isDark ? 'rgba(255, 251, 235, 0.1)' : "#fffbeb"}
            >
              <Typography fontFamily="var(--font-sans)" color="#f59e0b" fontSize="small">
                {t('crypto.noRlusdNetworks', { defaultValue: 'No RLUSD networks configured' })}
              </Typography>
            </Box>
          )
        )}

        {selectedCrypto &&
          (selectedCrypto !== "USDT" ||
            ["TRC20", "ERC20", "POLYGON"].includes(selectedNetwork)) &&
          (selectedCrypto !== "RLUSD" ||
            ["XRPL", "ERC20"].includes(selectedNetwork)) && (
            <>
              <Typography
                variant="h6"
                fontWeight={500}
                mt={2.5}
                mb={1}
                fontSize="13px"
                fontFamily="var(--font-sans)"
                color={theme.palette.text.secondary}
              >
                {selectedCrypto === "USDT" 
                  ? t('crypto.sendToAddress', { crypto: selectedCrypto, network: selectedNetwork })
                  : selectedCrypto === "RLUSD"
                  ? t('crypto.sendToAddress', { crypto: selectedCrypto, network: selectedNetwork })
                  : t('crypto.sendToAddressSimple', { crypto: selectedCrypto })}
              </Typography>
              <Box
                textAlign="center"
                border={`1px solid ${theme.palette.border.main}`}
                padding="20px"
                borderRadius="14px"
                bgcolor={isDark ? "rgba(255,255,255,0.03)" : "#FAFAFB"}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mx: "auto",
                    mb: 2,
                    width: loading ? "100%" : 196,
                    height: loading ? "auto" : 196,
                    bgcolor: "#FFFFFF",
                    borderRadius: "12px",
                    border: `1px solid ${theme.palette.border.main}`,
                    overflow: "hidden",
                    p: loading ? 0 : "8px",
                  }}
                >
                  {loading ? (
                    <Box sx={{ padding: 2, textAlign: 'center' }}>
                      <CircularProgress sx={{ color: "#10B981" }} />
                      <Typography 
                        variant="body2" 
                        sx={{ mt: 1, color: theme.palette.text.secondary }}
                        fontFamily="var(--font-sans)"
                      >
                        {loadingStep === 'rates' 
                          ? t('crypto.gettingRates')
                          : loadingStep === 'payment' 
                            ? t('crypto.creatingPayment')
                            : t('crypto.loading')}
                      </Typography>
                    </Box>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={cryptoDetails?.qr_code}
                      width={180}
                      height={180}
                      style={{ display: "block" }}
                      alt={t("checkout.qrAlt", { ns: "landing" })}
                    />
                  )}
                </Box>
                <Box
                  onClick={handleCopyAddress}
                  data-testid="copy-address-row"
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                  border={`1px solid ${theme.palette.border.main}`}
                  padding="10px 12px"
                  borderRadius="10px"
                  bgcolor={theme.palette.background.paper}
                  sx={{ cursor: 'pointer', transition: 'border-color 0.15s ease', '&:hover': { borderColor: ACCENT } }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: theme.palette.text.primary, fontFamily: "var(--font-mono), monospace" }}
                    fontWeight={500}
                    fontSize="12px"
                    maxWidth="88%"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {loading
                      ? t('crypto.generatingAddress', { defaultValue: 'Generating address…' })
                      : cryptoDetails?.address}
                  </Typography>
                  <Tooltip title={t('common.copy')}>
                    <IconButton
                      size="small"
                      sx={{
                        bgcolor: theme.palette.action.hover,
                        p: 0.5,
                        height: "26px",
                        width: "26px",
                        borderRadius: "7px",
                        "&:hover": { bgcolor: theme.palette.action.selected },
                      }}
                      onClick={handleCopyAddress}
                    >
                      <CopyIcon />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Memo / Destination Tag - shown for XRP and RLUSD (XRPL) */}
                {requiresMemo(selectedCrypto, selectedNetwork) && cryptoDetails?.memo && (
                  <Box mt={1.5}>
                    <Typography
                      variant="caption"
                      fontWeight={600}
                      fontFamily="var(--font-sans)"
                      color={isDark ? '#FF9F43' : '#E67E22'}
                      fontSize="11px"
                      letterSpacing={0.5}
                      data-testid="memo-label"
                    >
                      {t('crypto.memoTag', { defaultValue: 'MEMO / DESTINATION TAG' })}
                    </Typography>
                    <Box
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      border={`1px solid ${isDark ? '#FF9F43' : '#F0C27A'}`}
                      padding="10px"
                      borderRadius="8px"
                      bgcolor={isDark ? 'rgba(255, 159, 67, 0.08)' : '#FFF8F0'}
                      mt={0.5}
                      data-testid="memo-value-box"
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: isDark ? '#FF9F43' : '#E67E22' }}
                        fontWeight="600"
                        fontSize="13px"
                        maxWidth="85%"
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                        fontFamily="var(--font-sans)"
                        data-testid="memo-value"
                      >
                        {cryptoDetails.memo}
                      </Typography>
                      <Tooltip title={t('crypto.copyMemo', { defaultValue: 'Copy Memo' })}>
                        <IconButton
                          size="small"
                          sx={{
                            bgcolor: isDark ? 'rgba(255, 159, 67, 0.2)' : "#FDEBD0",
                            p: 0.5,
                            height: "24px",
                            width: "24px",
                            borderRadius: "5px",
                            "&:hover": { bgcolor: isDark ? 'rgba(255, 159, 67, 0.3)' : "#F9D9B0" },
                          }}
                          onClick={handleCopyMemo}
                          data-testid="copy-memo-btn"
                        >
                          <CopyIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5} mt={0.75}>
                      <Icon icon="mdi:alert-circle-outline" width={14} color={isDark ? '#FF9F43' : '#E67E22'} />
                      <Typography
                        fontSize="11px"
                        fontFamily="var(--font-sans)"
                        color={isDark ? '#FF9F43' : '#E67E22'}
                        fontWeight={500}
                      >
                        {t('crypto.memoWarning', { defaultValue: 'You MUST include this memo/tag or your funds may be lost' })}
                      </Typography>
                    </Box>
                  </Box>
                )}

                <Box display="flex" alignItems="center" gap={1}>
                  <InfoOutlinedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                  <Typography
                    variant="h6"
                    fontWeight="400"
                    mt={1}
                    color={theme.palette.text.primary}
                    fontSize="small"
                    textAlign="left"
                    lineHeight="18px"
                    fontFamily="var(--font-sans)"
                  >
                    {selectedCrypto === "USDT"
                      ? t('crypto.sendOnlyWarning', { crypto: selectedCrypto, network: selectedNetwork })
                      : selectedCrypto === "RLUSD"
                      ? t('crypto.sendOnlyWarning', { crypto: selectedCrypto, network: selectedNetwork })
                      : t('crypto.sendOnlyWarningSimple', { crypto: selectedCrypto })}
                  </Typography>
                </Box>
                
                {/* Polling indicator */}
                {isPolling && !isStart && (
                  <Box 
                    display="flex" 
                    alignItems="center" 
                    justifyContent="center" 
                    gap={1}
                    mt={2}
                    bgcolor={isDark ? 'rgba(16, 185, 129, 0.1)' : "#F0FDF4"}
                    borderRadius={2}
                    py={1}
                    px={2}
                  >
                    <CircularProgress size={14} sx={{ color: "#10B981" }} />
                    <Typography
                      variant="caption"
                      color="#10B981"
                      fontFamily="var(--font-sans)"
                      fontWeight={500}
                    >
                      {t('crypto.monitoringPayment')}
                    </Typography>
                  </Box>
                )}
              </Box>

              <Box
                data-testid="checkout-trust-strip"
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={0.75}
                mt={1.5}
                px={1}
              >
                <Icon icon="mdi:shield-check" width={14} color={isDark ? ACCENT : '#10B981'} />
                <Typography
                  fontSize="11.5px"
                  fontFamily="var(--font-sans)"
                  color={theme.palette.text.secondary}
                  textAlign="center"
                >
                  {t('crypto.trustNote', { defaultValue: 'Funds go directly to the merchant · amount locked until the timer ends' })}
                </Typography>
              </Box>

              {!isRecived && (
                <Box
                  mt={2.5}
                  border={`1px solid ${theme.palette.border.main}`}
                  padding="16px 18px"
                  borderRadius="14px"
                  bgcolor={theme.palette.background.paper}
                  height={"auto"}
                  sx={{ opacity: isStart ? 0.5 : 1 }}
                >
                  {/* Show "Remaining Balance" header if in partial payment mode */}
                  {isPartialPaymentMode && (
                    <Box 
                      bgcolor={isDark ? 'rgba(254, 243, 199, 0.15)' : "#FEF3C7"} 
                      borderRadius={1} 
                      px={1} 
                      py={0.5} 
                      mb={1}
                      display="inline-block"
                    >
                      <Typography
                        variant="caption"
                        color="#f59e0b"
                        fontFamily="var(--font-sans)"
                        fontWeight={500}
                      >
                        {t('crypto.remainingBalance')}
                      </Typography>
                    </Box>
                  )}

                  {/* Fee breakdown - shown when tax or customer-paid processing fee is present */}
                  {!isPartialPaymentMode && (
                    (taxInfo && taxInfo.amount > 0) || 
                    (feeInfo && feeInfo.fee_payer === 'customer' && ((feeInfo.processing_fee ?? 0) > 0 || (selectedCurrency?.processing_fee ?? 0) > 0))
                  ) && (
                    <Box mb={2} data-testid="fee-breakdown">
                      {/* Subtotal */}
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography
                          variant="body2"
                          color={theme.palette.text.secondary}
                          fontFamily="var(--font-sans)"
                          data-testid="fee-breakdown-subtotal-label"
                        >
                          {t('checkout.subtotal')}
                        </Typography>
                        <Typography
                          variant="body2"
                          color={theme.palette.text.primary}
                          fontFamily="var(--font-sans)"
                          fontWeight={500}
                          data-testid="fee-breakdown-subtotal-value"
                        >
                          {formatWithSeparators(convertedSubtotal, displayCurrency)} {displayCurrency}
                        </Typography>
                      </Box>
                      {/* Tax row - only when tax exists */}
                      {taxInfo && taxInfo.amount > 0 && (
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography
                            variant="body2"
                            color={theme.palette.text.secondary}
                            fontFamily="var(--font-sans)"
                            data-testid="fee-breakdown-tax-label"
                          >
                            {taxInfo.country 
                              ? t('checkout.vatRate', { rate: taxInfo.rate, country: taxInfo.country })
                              : `${taxInfo.type || t('checkout.tax')} (${taxInfo.rate}%)`}
                          </Typography>
                          <Typography
                            variant="body2"
                            color={theme.palette.text.primary}
                            fontFamily="var(--font-sans)"
                            fontWeight={500}
                            data-testid="fee-breakdown-tax-value"
                          >
                            {formatWithSeparators(convertedTaxAmount, displayCurrency)} {displayCurrency}
                          </Typography>
                        </Box>
                      )}
                      {/* Processing fee row */}
                      {feeInfo && ((feeInfo.processing_fee ?? 0) > 0 || (selectedCurrency?.processing_fee ?? 0) > 0) && (
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography
                            variant="body2"
                            color={theme.palette.text.secondary}
                            fontFamily="var(--font-sans)"
                            data-testid="fee-breakdown-processing-fee-label"
                          >
                            {t('checkout.processingFee')}
                          </Typography>
                          <Typography
                            variant="body2"
                            color={feeInfo.fee_payer === 'merchant' ? '#10B981' : theme.palette.text.primary}
                            fontFamily="var(--font-sans)"
                            fontWeight={500}
                            data-testid="fee-breakdown-processing-fee-value"
                          >
                            {feeInfo.fee_payer === 'merchant' 
                              ? t('checkout.processingFeesIncluded')
                              : `${formatWithSeparators((selectedCurrency?.processing_fee || feeInfo.processing_fee) * transferRate, displayCurrency)} ${displayCurrency}`}
                          </Typography>
                        </Box>
                      )}
                      <Divider sx={{ my: 1, borderColor: isDark ? theme.palette.divider : undefined }} />
                    </Box>
                  )}

                  <Box display="flex" gap={2} justifyContent="space-between" alignItems="flex-start">
                    <Typography
                      variant="h6"
                      fontWeight={500}
                      fontSize="13px"
                      fontFamily="var(--font-sans)"
                      whiteSpace="nowrap"
                      color={theme.palette.text.secondary}
                      mt={0.75}
                    >
                      {t('checkout.toPay')}
                    </Typography>
                    <Box display="flex" alignItems="start" gap={1}>
                      <Box textAlign="end">
                        <Typography
                          variant="body1"
                          fontSize="23px"
                          fontWeight={600}
                          display="flex"
                          alignItems="center"
                          justifyContent="flex-end"
                          gap={1}
                          whiteSpace="nowrap"
                          color={theme.palette.text.primary}
                          sx={{ fontFamily: "var(--font-mono), monospace", fontVariantNumeric: "tabular-nums" }}
                        >
                          {formatAmount(
                            isPartialPaymentMode && remainingPaymentInfo
                              ? remainingPaymentInfo.remainingAmount
                              : (selectedCurrency?.total_amount || selectedCurrency?.amount || 0),
                            selectedCurrency?.currency || ""
                          )}{" "}
                          {selectedCurrency?.currency}
                        </Typography>
                        <Typography
                          variant="body1"
                          color={theme.palette.text.secondary}
                          fontFamily="var(--font-sans)"
                          whiteSpace="nowrap"
                          fontSize="13px"
                          fontWeight={500}
                        >
                          ≈ {formatWithSeparators(Number(
                            isPartialPaymentMode && remainingPaymentInfo
                              ? Number(remainingPaymentInfo.remainingAmountUsd || 0) * transferRate
                              : Number(selectedCurrency?.total_amount_usd || selectedCurrency?.total_amount_source || walletState?.amount || 0) * transferRate
                          ), displayCurrency)}{" "}
                          {displayCurrency}
                        </Typography>
                      </Box>
                      <Tooltip title={t('common.copy')}>
                        <IconButton
                          size="small"
                          sx={{
                            bgcolor: theme.palette.action.hover,
                            p: 0.5,
                            height: "26px",
                            width: "26px",
                            borderRadius: "7px",
                            "&:hover": { bgcolor: theme.palette.action.selected },
                            mt: 0.75,
                          }}
                          onClick={handleCopyAmount}
                        >
                          <CopyIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  <Divider sx={{ my: "10px" }} />
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    gap={1}
                    sx={{
                      // Timer warning when < 5 minutes
                      ...(timeLeft !== null && timeLeft < 5 * 60 && {
                        bgcolor: isDark ? 'rgba(254, 226, 226, 0.15)' : '#FEE2E2',
                        borderRadius: 1,
                        py: 0.5,
                        px: 1,
                        animation: timeLeft < 2 * 60 ? 'pulse 1.5s infinite' : 'none',
                        '@keyframes pulse': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.7 },
                        },
                      }),
                    }}
                  >
                    <ClockIcon />
                    <Typography
                      variant="body2"
                      fontWeight={timeLeft !== null && timeLeft < 5 * 60 ? 600 : "normal"}
                      fontSize="13px"
                      fontFamily="var(--font-sans)"
                      color={timeLeft !== null && timeLeft < 5 * 60 ? "#DC2626" : theme.palette.text.primary}
                    >
                      {t('checkout.invoiceExpiresIn')} {formatTime(timeLeft)}
                      {timeLeft !== null && timeLeft < 5 * 60 && timeLeft > 0 && " ⚠️"}
                    </Typography>
                  </Box>
                </Box>
              )}

              {isStart && paymentStatus !== "confirmed" && (
                <Box
                  sx={{ mt: 2 }}
                  border={1}
                  borderColor={isDark ? '#4ade80' : "#B5D3C6"}
                  borderRadius={"12px"}
                >
                  <Paper
                    sx={{
                      bgcolor: isDark ? 'rgba(16, 185, 129, 0.1)' : "#EBFFF6",
                      borderRadius: "12px",
                      p: 3,
                      textAlign: "center",
                      mx: "auto",
                    }}
                  >
                    <Typography
                      variant="h5"
                      fontWeight={600}
                      sx={{ color: isRecived ? "#13B76A" : (isDark ? '#86efac' : "#7CAB96") }}
                      fontFamily="var(--font-sans)"
                    >
                      {formatAmount(
                        isPartialPaymentMode && remainingPaymentInfo
                          ? remainingPaymentInfo.remainingAmount
                          : (selectedCurrency?.total_amount || selectedCurrency?.amount || 0),
                        selectedCurrency?.currency || ""
                      )}{" "}
                      {selectedCurrency?.currency}
                    </Typography>
                    
                    {/* Fiat equivalent display */}
                    <Typography
                      variant="body2"
                      color={theme.palette.text.secondary}
                      fontFamily="var(--font-sans)"
                      fontSize={14}
                      mt={0.5}
                    >
                      ≈ {formatWithSeparators(Number(selectedCurrency?.total_amount_usd || selectedCurrency?.total_amount_source || walletState?.amount || 0) * transferRate, displayCurrency)} {displayCurrency}
                    </Typography>

                    {/* Payment detected - waiting for confirmation */}
                    <CircularProgress
                      size={30}
                      sx={{ color: "#13B76A", my: "16px" }}
                    />

                    <Typography
                      variant="subtitle1"
                      fontWeight={500}
                      fontFamily="var(--font-sans)"
                      fontSize={"15px"}
                      color={theme.palette.text.primary}
                    >
                      {t('crypto.paymentDetected')}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: theme.palette.text.secondary }}
                      fontSize={"12px"}
                      fontWeight={400}
                      fontFamily="var(--font-sans)"
                    >
                      {t('crypto.paymentDetectedDesc', { confirmations: 1 })}
                    </Typography>
                  </Paper>
                </Box>
              )}
            </>
          )}
      </Paper>
    </Box>
  );
};

export default CryptoTransfer;
