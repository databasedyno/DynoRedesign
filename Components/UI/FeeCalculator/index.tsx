import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Typography,
  CircularProgress,
  InputAdornment,
  SelectChangeEvent,
} from "@mui/material";
import { styled, alpha, useTheme } from "@mui/material/styles";
import axiosBaseApi from "@/axiosConfig";
import Image from "next/image";

/* ================= CRYPTO ICONS ================= */
import BitcoinIcon from "@/assets/cryptocurrency/Bitcoin-icon.svg";
import EthereumIcon from "@/assets/cryptocurrency/Ethereum-icon.svg";
import LitecoinIcon from "@/assets/cryptocurrency/Litecoin-icon.svg";
import DogecoinIcon from "@/assets/cryptocurrency/Dogecoin-icon.svg";
import TronIcon from "@/assets/cryptocurrency/Tron-icon.svg";
import BitcoinCashIcon from "@/assets/cryptocurrency/BitcoinCash-icon.svg";
import SolanaIcon from "@/assets/cryptocurrency/Solana-icon.svg";
import XRPIcon from "@/assets/cryptocurrency/XRP-icon.svg";
import USDTIcon from "@/assets/cryptocurrency/USDT-icon.svg";
import PolygonIcon from "@/assets/cryptocurrency/Polygon-icon.svg";
import RLUSDIcon from "@/assets/cryptocurrency/RLUSD-icon.svg";

import type { StaticImageData } from "next/image";

const CRYPTO_ICON_MAP: Record<string, StaticImageData> = {
  BTC: BitcoinIcon,
  ETH: EthereumIcon,
  LTC: LitecoinIcon,
  DOGE: DogecoinIcon,
  TRX: TronIcon,
  BCH: BitcoinCashIcon,
  SOL: SolanaIcon,
  XRP: XRPIcon,
  "USDT-TRC20": USDTIcon,
  "USDT-ERC20": USDTIcon,
  USDC: USDTIcon,
  POLYGON: PolygonIcon,
  "RLUSD-XRPL": RLUSDIcon,
};

/* ================= TYPES ================= */

interface FeeResult {
  payment_amount: number;
  currency: string;
  cryptocurrency: string;
  fee_breakdown: {
    platform_fee: number;
    platform_fee_percent: number;
    blockchain_fee: number;
    total_fees: number;
  };
  net_to_merchant: number;
  usd_equivalents: {
    payment_amount_usd: number;
    total_fees_usd: number;
    net_to_merchant_usd: number;
    exchange_rate: number;
  };
}

interface FeeCalculatorProps {
  compact?: boolean;
}

/* ================= CONSTANTS ================= */

const FIAT_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "NZD", "CHF", "JPY", "BRL", "NGN"];

const CRYPTO_OPTIONS = [
  { value: "BTC", label: "Bitcoin (BTC)", network: "Bitcoin" },
  { value: "ETH", label: "Ethereum (ETH)", network: "Ethereum" },
  { value: "LTC", label: "Litecoin (LTC)", network: "Litecoin" },
  { value: "DOGE", label: "Dogecoin (DOGE)", network: "Dogecoin" },
  { value: "TRX", label: "Tron (TRX)", network: "Tron" },
  { value: "BCH", label: "Bitcoin Cash (BCH)", network: "Bitcoin Cash" },
  { value: "SOL", label: "Solana (SOL)", network: "Solana" },
  { value: "XRP", label: "Ripple (XRP)", network: "XRP Ledger" },
  { value: "USDT-TRC20", label: "USDT (TRC20)", network: "Tron" },
  { value: "USDT-ERC20", label: "USDT (ERC20)", network: "Ethereum" },
  { value: "USDC", label: "USDC (ERC20)", network: "Ethereum" },
  { value: "POLYGON", label: "Polygon (MATIC)", network: "Polygon" },
  { value: "RLUSD-XRPL", label: "RLUSD (XRP Ledger)", network: "XRP Ledger" },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", AUD: "A$", CAD: "C$",
  NZD: "NZ$", CHF: "CHF", JPY: "¥", BRL: "R$", NGN: "₦",
};

/* ================= STYLED COMPONENTS ================= */

const CalculatorCard = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    background: isDark ? "rgba(255,255,255,0.045)" : "#FFFFFF",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)"}`,
    borderRadius: "20px",
    padding: "32px",
    position: "relative",
    overflow: "hidden",
    "&::before": {
      content: '""',
      position: "absolute",
      bottom: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: "80%",
      height: "60%",
      background: `radial-gradient(at center bottom, ${isDark ? "#818CF83D" : "#4F46E51A"}, transparent)`,
      filter: "blur(80px)",
      opacity: 0.5,
      zIndex: 0,
      pointerEvents: "none",
    },
    "& > *": { position: "relative", zIndex: 1 },
    [theme.breakpoints.down("md")]: {
      padding: "20px",
    },
  };
});

const ResultRow = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  "&:not(:last-child)": {
    borderBottom: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)"}`,
  },
}));

const ResultLabel = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  fontWeight: 400,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.secondary,
}));

const ResultValue = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
}));

const HighlightBox = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    background: isDark ? "rgba(129,140,248,0.12)" : "#0A0A0A08",
    border: `1px solid ${isDark ? "rgba(129,140,248,0.24)" : "#0A0A0A1A"}`,
    borderRadius: "12px",
    padding: "16px",
    marginTop: "16px",
  };
});

const SummaryRow = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  "&:not(:last-child)": { marginBottom: "8px" },
}));

const SummaryLabel = styled(Typography)(({ theme }) => ({
  fontSize: "16px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.secondary,
}));

const SummaryValue = styled(Typography)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    fontSize: "20px",
    fontWeight: 600,
    fontFamily: "OutfitSemiBold",
    color: isDark ? "#818CF8" : "#4F46E5",
  };
});

const NetworkNote = styled(Typography)(({ theme }) => ({
  fontSize: "12px",
  fontWeight: 400,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.secondary,
  marginTop: "12px",
  textAlign: "center",
  fontStyle: "italic",
}));

const styledSelect = {
  fontFamily: "var(--font-sans)",
  fontSize: "14px",
  borderRadius: "12px",
  "& .MuiOutlinedInput-notchedOutline": {
    borderRadius: "12px",
  },
};

const styledInput = {
  fontFamily: "var(--font-sans)",
  fontSize: "14px",
  "& .MuiOutlinedInput-root": {
    borderRadius: "12px",
    fontFamily: "var(--font-sans)",
  },
  "& .MuiInputLabel-root": {
    fontFamily: "var(--font-sans)",
  },
};

/* ================= COMPONENT ================= */

const FeeCalculator: React.FC<FeeCalculatorProps> = ({ compact = false }) => {
  const { t } = useTranslation("fees");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [amount, setAmount] = useState<string>("100");
  const [currency, setCurrency] = useState<string>("USD");
  const [crypto, setCrypto] = useState<string>("BTC");
  const [result, setResult] = useState<FeeResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef<boolean>(true);
  const cacheRef = useRef<Map<string, FeeResult>>(new Map());

  const symbol = useMemo(() => CURRENCY_SYMBOLS[currency] || currency + " ", [currency]);

  const formatAmount = useCallback(
    (val: number) => `${symbol}${val.toFixed(2)}`,
    [symbol]
  );

  const calculateFees = useCallback(async (amt: string, cur: string, cry: string) => {
    const numAmt = parseFloat(amt);
    if (!numAmt || numAmt <= 0) {
      setResult(null);
      setError("");
      return;
    }

    // Check cache first
    const cacheKey = `${numAmt}-${cur}-${cry}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setResult(cached);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await axiosBaseApi.post("pay/calculateFees", {
        amount: numAmt,
        cryptocurrency: cry,
        currency: cur,
      });
      if (data?.data) {
        setResult(data.data);
        // Store in cache (keep last 20 entries)
        if (cacheRef.current.size > 20) {
          const firstKey = cacheRef.current.keys().next().value;
          if (firstKey) cacheRef.current.delete(firstKey);
        }
        cacheRef.current.set(cacheKey, data.data);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Calculation failed";
      setError(errorMsg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced calculation — immediate on first render, debounced thereafter
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      calculateFees(amount, currency, crypto);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      calculateFees(amount, currency, crypto);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [amount, currency, crypto, calculateFees]);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
      setAmount(val);
    }
  }, []);

  const handleCurrencyChange = useCallback((e: SelectChangeEvent<string>) => {
    setCurrency(e.target.value);
  }, []);

  const handleCryptoChange = useCallback((e: SelectChangeEvent<string>) => {
    setCrypto(e.target.value);
  }, []);

  return (
    <CalculatorCard>
      {/* Inputs */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: compact
            ? { xs: "1fr", sm: "1fr 1fr", md: "2fr 1fr 1.5fr" }
            : { xs: "1fr", sm: "1fr 1fr", md: "2fr 1fr 2fr" },
          gap: 2,
          mb: 3,
        }}
      >
        <TextField
          label={t("inputAmount")}
          value={amount}
          onChange={handleAmountChange}
          variant="outlined"
          fullWidth
          type="text"
          inputMode="decimal"
          sx={styledInput}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Typography sx={{ fontFamily: "var(--font-sans)", color: isDark ? "#818CF8" : "#4F46E5" }}>
                  {symbol}
                </Typography>
              </InputAdornment>
            ),
          }}
        />

        <FormControl fullWidth>
          <InputLabel sx={{ fontFamily: "var(--font-sans)" }}>{t("inputCurrency")}</InputLabel>
          <Select
            value={currency}
            onChange={handleCurrencyChange}
            label={t("inputCurrency")}
            sx={styledSelect}
          >
            {FIAT_CURRENCIES.map((c) => (
              <MenuItem key={c} value={c} sx={{ fontFamily: "var(--font-sans)" }}>
                {c}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel sx={{ fontFamily: "var(--font-sans)" }}>{t("inputCrypto")}</InputLabel>
          <Select
            value={crypto}
            onChange={handleCryptoChange}
            label={t("inputCrypto")}
            sx={styledSelect}
            renderValue={(selected) => {
              const opt = CRYPTO_OPTIONS.find((c) => c.value === selected);
              const icon = CRYPTO_ICON_MAP[selected];
              return (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {icon && (
                    <Image src={icon} alt={selected} width={20} height={20} style={{ flexShrink: 0 }} />
                  )}
                  <span>{opt?.label || selected}</span>
                </Box>
              );
            }}
          >
            {CRYPTO_OPTIONS.map((c) => {
              const icon = CRYPTO_ICON_MAP[c.value];
              return (
                <MenuItem key={c.value} value={c.value} sx={{ fontFamily: "var(--font-sans)" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    {icon && (
                      <Image src={icon} alt={c.value} width={22} height={22} style={{ flexShrink: 0 }} />
                    )}
                    <Box>
                      <Typography sx={{ fontSize: "14px", fontFamily: "var(--font-sans)", lineHeight: 1.3 }}>
                        {c.label}
                      </Typography>
                      <Typography sx={{ fontSize: "11px", fontFamily: "var(--font-sans)", color: "text.secondary", lineHeight: 1.2 }}>
                        {c.network}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </Box>

      {/* Results */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={28} sx={{ color: isDark ? "#818CF8" : "#4F46E5" }} />
          <Typography sx={{ ml: 2, fontFamily: "var(--font-sans)", color: "text.secondary", fontSize: "14px" }}>
            {t("calculating")}
          </Typography>
        </Box>
      ) : result ? (
        <>
          {/* Fee Breakdown */}
          <Box>
            <ResultRow>
              <ResultLabel>{t("resultPlatformFee")} ({result.fee_breakdown.platform_fee_percent}%)</ResultLabel>
              <ResultValue>{formatAmount(result.fee_breakdown.platform_fee)}</ResultValue>
            </ResultRow>
            <ResultRow>
              <ResultLabel>{t("resultBlockchainFee")}</ResultLabel>
              <ResultValue>{formatAmount(result.fee_breakdown.blockchain_fee)}</ResultValue>
            </ResultRow>
            <ResultRow>
              <ResultLabel sx={{ fontWeight: 500, fontFamily: "var(--font-sans)" }}>{t("resultTotalFees")}</ResultLabel>
              <ResultValue sx={{ fontWeight: 600, fontFamily: "OutfitSemiBold" }}>
                {formatAmount(result.fee_breakdown.total_fees)}
              </ResultValue>
            </ResultRow>
          </Box>

          {/* Summary Highlight */}
          <HighlightBox>
            <SummaryRow>
              <SummaryLabel>{t("resultCustomerPays")}</SummaryLabel>
              <SummaryValue>{formatAmount(result.payment_amount)}</SummaryValue>
            </SummaryRow>
            <SummaryRow>
              <SummaryLabel>{t("resultYouReceive")}</SummaryLabel>
              <SummaryValue sx={{ fontSize: "24px" }}>
                {formatAmount(result.net_to_merchant)}
              </SummaryValue>
            </SummaryRow>
          </HighlightBox>

          <NetworkNote>{t("networkNote")}</NetworkNote>
        </>
      ) : (
        <Box sx={{ textAlign: "center", py: 3 }}>
          <Typography sx={{ fontFamily: "var(--font-sans)", color: "text.secondary", fontSize: "14px" }}>
            {error || t("enterAmount")}
          </Typography>
        </Box>
      )}
    </CalculatorCard>
  );
};

export default memo(FeeCalculator);
