import { useCompanyStore } from "@/contexts/CompanyDataContext";
import EmptyDataModel from "@/Components/UI/EmptyDataModel";
import { TransactionAction } from "@/Redux/Actions";
import { TRANSACTION_FETCH, TRANSACTION_EXPORT } from "@/Redux/Actions/TransactionAction";
import { ICustomerTransactions, rootReducer } from "@/utils/types";
import { DateRange } from "@/utils/types/dashboard";
import {
  ExtendedTransaction,
  TransactionSource,
  TransactionSourceType,
} from "@/utils/types/transaction";
import { Box, Dialog, IconButton, Typography, useTheme } from "@mui/material";
import { Icon, MONO } from "@/styles/uiKit";
import confetti from "canvas-confetti";
import CustomButton from "@/Components/UI/Buttons";
import { endOfDay, isWithinInterval, parseISO, startOfDay } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import TransactionsTable from "./TransactionsTable";
import TransactionsTopBar from "./TransactionsTopBar";
import TransactionsSkeleton from "./TransactionsSkeleton";

const walletMapping: { [key: string]: string } = {
  all: "all",
  wallet1: "BTC",
  wallet2: "ETH",
  wallet3: "LTC",
  wallet4: "DOGE",
  wallet5: "BCH",
  wallet6: "TRX",
  wallet7: "USDT-ERC20",
  wallet8: "USDT-TRC20",
  wallet9: "SOL",
  wallet10: "XRP",
  wallet11: "USDC-ERC20",
  wallet12: "POLYGON",
  wallet13: "RLUSD",
  wallet14: "USDT-POLYGON",
  wallet15: "RLUSD-ERC20",
};

// Reverse mapping: crypto name -> wallet key
const cryptoToWalletKey: { [key: string]: string } = {};
Object.entries(walletMapping).forEach(([key, value]) => {
  if (value !== "all") {
    cryptoToWalletKey[value.toUpperCase()] = key;
  }
});

const TransactionPage = () => {
  const dispatch = useDispatch();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });
  const [selectedWallet, setSelectedWallet] = useState("all");
  const [selectedSource, setSelectedSource] = useState<TransactionSourceType | "all">(
    "all",
  );

  // Read wallet filter from query parameter (e.g., /transactions?wallet=ETH)
  useEffect(() => {
    if (router.isReady && router.query.wallet) {
      const walletParam = String(router.query.wallet).toUpperCase();
      const walletKey = cryptoToWalletKey[walletParam];
      if (walletKey) {
        setSelectedWallet(walletKey);
      }
    }
  }, [router.isReady, router.query.wallet]);

  // Read source filter from query parameter (e.g., /transactions?source=tips).
  // Alias 'tips' -> 'tip' and 'orders'/'products' -> 'product' for readable
  // deep-links from feature pages (Phase 3 cross-links).
  useEffect(() => {
    if (!router.isReady || !router.query.source) return;
    const raw = String(router.query.source).toLowerCase();
    const mapped: TransactionSourceType | "all" | null =
      raw === "all"
        ? "all"
        : raw === "tips" || raw === "tip"
          ? "tip"
          : raw === "orders" || raw === "products" || raw === "product"
            ? "product"
            : raw === "contributions" || raw === "contribution"
              ? "contribution"
              : raw === "payment_link" || raw === "payment-links" || raw === "payment_links"
                ? "payment_link"
                : raw === "direct"
                  ? "direct"
                  : null;
    if (mapped) setSelectedSource(mapped);
  }, [router.isReady, router.query.source]);

  const transactionState = useSelector(
    (state: rootReducer) => state.transactionReducer,
  );

  const selectedCompanyId = useCompanyStore().selectedCompanyId;

  useEffect(() => {
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    dispatch(TransactionAction(TRANSACTION_FETCH, payload));
  }, [dispatch, selectedCompanyId]);

  // "First payment received" celebration ─────────────────────────────────────
  // Fires ONCE per company_id the first time we detect at least one CONFIRMED
  // or COMPLETED payment in the transaction list. Persists in localStorage
  // so it doesn't re-trigger on subsequent visits.
  const theme = useTheme();
  const [firstPaymentCelebrationOpen, setFirstPaymentCelebrationOpen] = useState(false);
  const firstPaymentFiredRef = useRef(false);

  const confirmedPaymentCount = useMemo(() => {
    const list = transactionState?.customers_transactions || [];
    return list.reduce((n: number, t: any) => {
      const status = String(t?.status || "").toLowerCase();
      // Backend uses "successful" (not "success") for confirmed payments — include both.
      return ["confirmed", "completed", "settled", "success", "successful", "paid"].includes(status)
        ? n + 1
        : n;
    }, 0);
  }, [transactionState?.customers_transactions]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    // Only celebrate a GENUINE first payment (exactly one confirmed payment ever).
    // Existing merchants with a transaction history must never see this.
    if (confirmedPaymentCount !== 1) return;
    if (firstPaymentFiredRef.current) return;
    const storageKey = `dynopay_first_payment_celebrated_${selectedCompanyId}`;
    let alreadyCelebrated = false;
    try {
      alreadyCelebrated = typeof window !== "undefined" && !!localStorage.getItem(storageKey);
    } catch {
      /* private-mode safe */
    }
    if (alreadyCelebrated) {
      firstPaymentFiredRef.current = true;
      return;
    }
    firstPaymentFiredRef.current = true;
    try {
      localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      /* private-mode safe */
    }
    // Fire the celebration: three confetti bursts + open the modal.
    setFirstPaymentCelebrationOpen(true);
    try {
      const colors = ["#CCFF00", "#B4E600", "#10B981", "#F59E0B", "#EC4899"];
      confetti({ particleCount: 90, spread: 70, startVelocity: 45, origin: { x: 0.2, y: 0.6 }, colors, scalar: 1 });
      confetti({ particleCount: 90, spread: 70, startVelocity: 45, origin: { x: 0.8, y: 0.6 }, colors, scalar: 1 });
      setTimeout(() => {
        confetti({ particleCount: 60, spread: 80, startVelocity: 35, origin: { x: 0.5, y: 0.3 }, colors, scalar: 0.9 });
      }, 350);
    } catch {
      /* canvas-confetti is client-only, safe to ignore */
    }
  }, [confirmedPaymentCount, selectedCompanyId]);

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  };

  const processedTransactions: ExtendedTransaction[] = useMemo(() => {
    if (!transactionState?.customers_transactions) return [];

    return transactionState.customers_transactions
      .filter((item: ICustomerTransactions) => {
        if (searchTerm) {
          const lowerSearch = searchTerm.toLowerCase();
          const matchesId = item.id?.toLowerCase().includes(lowerSearch);
          const matchesAmount = item.base_amount
            ?.toString()
            .includes(lowerSearch);
          const matchesCrypto = item.base_currency
            ?.toLowerCase()
            .includes(lowerSearch);

          if (!matchesId && !matchesAmount && !matchesCrypto) return false;
        }

        if (selectedWallet !== "all") {
          const targetCurrency = walletMapping[selectedWallet];
          const itemCrypto = (item as any).crypto_currency || (item as any).crypto || item.base_currency;
          if (targetCurrency && itemCrypto !== targetCurrency) {
            return false;
          }
        }

        // Source-type filter (Session 48)
        if (selectedSource !== "all") {
          const itemSource = (item as any).source as TransactionSource | undefined;
          const itemType = itemSource?.type || "direct";
          if (itemType !== selectedSource) return false;
        }

        if (dateRange.startDate && dateRange.endDate && item.createdAt) {
          try {
            const transactionDate = parseISO(item.createdAt);
            if (
              !isWithinInterval(transactionDate, {
                start: startOfDay(dateRange.startDate),
                end: endOfDay(dateRange.endDate),
              })
            ) {
              return false;
            }
          } catch (e) {
            console.error("Date parsing error", item.createdAt);
            return false;
          }
        }

        return true;
      })
      .map((item: ICustomerTransactions) => {
        const cryptoCurrency = (item as any).crypto_currency || (item as any).crypto || item.base_currency;
        const cryptoAmount = Number((item as any).crypto_amount) || Number(item.base_amount) || 0;
        const autoConverted = (item as any).auto_converted === true || (item as any).auto_converted === 'true';
        const autoConvertData = (item as any).auto_convert || null;
        const autoConvertTarget = autoConvertData?.target_currency || null;
        const autoConvertDisplayStatus = autoConvertData?.display_status || null;

        return {
          id: String((item as any).transaction_id || item.id || `TX-${Math.random().toString(36).substr(2, 9)}`),
          crypto: cryptoCurrency,
          amount: `${cryptoAmount} ${cryptoCurrency}`,
          usdValue: (() => {
            const raw = Number((item as any).usd_value) || Number(item.base_amount) || 0;
            if (raw === 0) return "$0.00";
            if (raw >= 1) return `$${raw.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            if (raw >= 0.01) return `$${raw.toFixed(4).replace(/0+$/, "").replace(/\.$/, ".00")}`;
            return `$${raw.toFixed(6).replace(/0+$/, "").replace(/\.$/, ".00")}`;
          })(),
          usdValueRaw: Number((item as any).usd_value) || Number(item.base_amount) || 0,
          dateTime: formatDateTime(item.createdAt),
          status: (() => {
            const s = (item.status || "").toLowerCase().trim();
            if (s === "success" || s === "successful" || s === "completed" || s === "payout_complete" || s === "converted" || s === "recovered" || s === "done" || s === "settled")
              return "settled" as const;
            if (s === "confirmed")
              return "confirmed" as const;
            if (s === "processing")
              return "processing" as const;
            if (s === "failed" || s === "expired" || s === "refunded" || s === "settlement_failed")
              return "failed" as const;
            return "pending" as const;
          })(),
          fees: (() => {
            const txFee = Number((item as any).transaction_fee) || 0;
            const fixedFee = Number((item as any).fixed_fee) || 0;
            const blockchainFee = Number((item as any).blockchain_buffer_fee) || 0;
            const totalFeeCrypto = txFee + fixedFee + blockchainFee;
            // Convert fee to USD using the same rate as the transaction
            const cryptoAmt = Number((item as any).crypto_amount) || 0;
            const usdVal = Number((item as any).usd_value) || 0;
            const rate = cryptoAmt > 0 ? usdVal / cryptoAmt : 0;
            return Math.round(totalFeeCrypto * rate * 100) / 100;
          })(),
          feesBreakdown: {
            platform: (() => {
              const fee = Number((item as any).transaction_fee) || 0;
              const cryptoAmt = Number((item as any).crypto_amount) || 0;
              const usdVal = Number((item as any).usd_value) || 0;
              const rate = cryptoAmt > 0 ? usdVal / cryptoAmt : 0;
              return Math.round(fee * rate * 100) / 100;
            })(),
            blockchain: (() => {
              const fee = Number((item as any).blockchain_buffer_fee) || 0;
              const cryptoAmt = Number((item as any).crypto_amount) || 0;
              const usdVal = Number((item as any).usd_value) || 0;
              const rate = cryptoAmt > 0 ? usdVal / cryptoAmt : 0;
              return Math.round(fee * rate * 100) / 100;
            })(),
            fixed: (() => {
              const fee = Number((item as any).fixed_fee) || 0;
              const cryptoAmt = Number((item as any).crypto_amount) || 0;
              const usdVal = Number((item as any).usd_value) || 0;
              const rate = cryptoAmt > 0 ? usdVal / cryptoAmt : 0;
              return Math.round(fee * rate * 100) / 100;
            })(),
          },
          confirmations: (() => {
            const s = (item.status || "").toLowerCase().trim();
            const complete = ["success", "successful", "completed", "payout_complete", "converted", "recovered", "done", "settled", "confirmed"].includes(s);
            const conf = Number((item as any).confirmations) || 0;
            const req = Number((item as any).required_confirmations) || 0;
            // Completed payments are fully confirmed on-chain (the counter isn't persisted post-settlement)
            if (complete) return req > 0 ? `${req}/${req}` : "Confirmed";
            if (conf > 0) return `${conf}/${req || 0}`;
            return req > 0 ? `0/${req}` : "0/0";
          })(),
          settlementAddress: (item as any).settlement_address || (item as any).wallet_address || "",
          incomingTransactionId: (item as any).incoming_tx_hash || (item as any).incoming_txid || (item as any).incomingTransactionId || (item as any).transaction_reference || "",
          outgoingTransactionId: (item as any).outgoing_tx_hash || (item as any).outgoing_txid || (item as any).outgoingTransactionId || "",
          callbackUrl: (item as any).callback_url || (item as any).callbackUrl || "",
          webhookResponse: (item as any).webhook_response || (item as any).webhookResponse || null,
          autoConverted,
          autoConvertTarget,
          autoConvertDisplayStatus,
          // Session 48: source metadata for the UX (filter chips + row badge)
          source: (item as any).source as TransactionSource | undefined,
          // Session 57: tax fields (persisted on tbl_user_transaction at settlement)
          taxAmount: Number((item as any).tax_amount) || 0,
          taxRate: (item as any).tax_rate != null ? Number((item as any).tax_rate) : undefined,
          taxLabel: (item as any).tax_label || undefined,
          taxCountryCode: (item as any).tax_country_code || undefined,
          customerVatId: (item as any).customer_vat_id || undefined,
          reverseCharge: (item as any).reverse_charge === true || (item as any).reverse_charge === "true",
        };
      });
  }, [
    transactionState.customers_transactions,
    searchTerm,
    selectedWallet,
    selectedSource,
    dateRange.startDate,
    dateRange.endDate,
  ]);

  // Session 57: "Tax collected" running total across the currently-filtered rows.
  const taxSummary = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const tx of processedTransactions) {
      const amt = Number(tx.taxAmount) || 0;
      if (amt > 0) {
        total += amt;
        count += 1;
      }
    }
    return { total, count };
  }, [processedTransactions]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
  };

  const handleWalletChange = (wallet: string) => {
    setSelectedWallet(wallet);
  };

  const handleSourceChange = (source: TransactionSourceType | "all") => {
    setSelectedSource(source);
    // Keep URL in sync so deep-links from feature pages work + so filter
    // survives a page reload / back-nav.
    const query: Record<string, string> = { ...(router.query as any) };
    if (source === "all") delete query.source;
    else query.source = source;
    router.replace(
      { pathname: router.pathname, query },
      undefined,
      { shallow: true },
    );
  };

  const handleExport = () => {
    dispatch(TransactionAction(TRANSACTION_EXPORT, {
      wallet: selectedWallet !== "all" ? walletMapping[selectedWallet] : undefined,
      startDate: dateRange.startDate?.toISOString(),
      endDate: dateRange.endDate?.toISOString(),
      search: searchTerm || undefined,
      company_id: selectedCompanyId || undefined,
    }));
  };

  if (transactionState.loading) {
    return <TransactionsSkeleton />;
  }

  if (
    transactionState?.customers_transactions?.length === 0 &&
    !transactionState.loading
  ) {
    return <EmptyDataModel pageName="transactions" />;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        "> :not(:last-child)": {
          marginBottom: { md: "20px", xs: "16px" },
        },
      }}
    >
      <TransactionsTopBar
        onSearch={handleSearch}
        onDateRangeChange={handleDateRangeChange}
        onWalletChange={handleWalletChange}
        onSourceChange={handleSourceChange}
        onExport={handleExport}
        initialWallet={selectedWallet}
        initialSource={selectedSource}
      />
      {taxSummary.total > 0 && (
        <Box
          data-testid="tax-collected-summary"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            alignSelf: "flex-start",
            px: 1.75,
            py: 1,
            borderRadius: "10px",
            border: `1px solid ${theme.palette.border?.main || theme.palette.divider}`,
            backgroundColor: theme.palette.primary.light,
          }}
        >
          <Typography sx={{ fontSize: "12.5px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
            Tax collected
          </Typography>
          <Typography sx={{ fontSize: "14px", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: theme.palette.text.primary }}>
            {taxSummary.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Typography>
          <Typography sx={{ fontSize: "11.5px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
            {`across ${taxSummary.count} ${taxSummary.count === 1 ? "payment" : "payments"}`}
          </Typography>
        </Box>
      )}
      <TransactionsTable transactions={processedTransactions} rowsPerPage={10} />

      {/* First-payment celebration modal — one-time per company. */}
      <Dialog
        open={firstPaymentCelebrationOpen}
        onClose={() => setFirstPaymentCelebrationOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "20px",
            overflow: "visible",
            maxWidth: "440px",
          },
        }}
        data-testid="first-payment-celebration-modal"
      >
        <IconButton
          onClick={() => setFirstPaymentCelebrationOpen(false)}
          aria-label="Close"
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 1,
            color: theme.palette.text.secondary,
          }}
        >
          <Icon name="x" size={20} />
        </IconButton>
        <Box sx={{ px: 3, pt: 4, pb: 3, textAlign: "center" }}>
          <Box
            sx={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #10B981, #059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: "0 10px 32px rgba(16, 185, 129, 0.35)",
            }}
          >
            <Icon name="check" size={48} color="#fff" />
          </Box>
          <Typography
            sx={{
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              fontSize: "22px",
              color: theme.palette.text.primary,
              mb: 1,
            }}
          >
            First payment landed! 🎉
          </Typography>
          <Typography
            sx={{
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              color: theme.palette.text.secondary,
              lineHeight: 1.55,
              mb: 3,
            }}
          >
            You&apos;re officially a Dynopay merchant. This is a big one — your first
            real payment is settled in your dashboard.
          </Typography>
          <CustomButton
            data-testid="first-payment-celebration-cta"
            label="View my transactions"
            variant="primary"
            size="medium"
            fullWidth
            onClick={() => setFirstPaymentCelebrationOpen(false)}
          />
        </Box>
      </Dialog>
    </Box>
  );
};

export default TransactionPage;
