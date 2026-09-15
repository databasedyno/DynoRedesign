import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { formatWithSeparators, formatDisplayAmount } from "@/utils/currencyFormat";
import EmptyDataModel from "@/Components/UI/EmptyDataModel";
import { TransactionAction } from "@/Redux/Actions";
import { TRANSACTION_FETCH, TRANSACTION_EXPORT } from "@/Redux/Actions/TransactionAction";
import { ICustomerTransactions, rootReducer } from "@/utils/types";
import { DateRange } from "@/utils/types/dashboard";
import {
  ExtendedTransaction,
  TransactionSource,
  TransactionSourceType,
  TxRangePreset,
  TxStatusFilter,
  toAutoConvertInfo,
} from "@/utils/types/transaction";
import { Box, Dialog, IconButton, Typography, useTheme } from "@mui/material";
import { Icon, MONO } from "@/styles/uiKit";
// canvas-confetti is lazy-loaded at the celebration call site (below)
import CustomButton from "@/Components/UI/Buttons";
import { endOfDay, format, startOfDay } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import TransactionsTable from "./TransactionsTable";
import { formatDisplayDateTime } from "@/helpers/displayDate";
import { isNeedsAction, toTxStatusBucket } from "@/helpers/txStatus";
import { getNetworkLabel } from "@/utils/networkLabels";
import TransactionsTopBar from "./TransactionsTopBar";
import TransactionsToolbar, { STATUS_FILTERS } from "./TransactionsToolbar";
import TransactionsSkeleton from "./TransactionsSkeleton";
import TransactionsFilterSheet from "./TransactionsFilterSheet";
import useTableCardView from "@/hooks/useTableCardView";
import { toFixedStr, toNumber } from "@/utils/money";
import { SOURCE_OPTIONS, TxFilters, countActiveFilters, cryptoToWalletKey, hasDateRange, matchesBaseFilters, walletMapping } from "./txFilters";
import { DEFAULT_TX_RANGE, isTxRangePreset, rangeToDates } from "./txRange";

/** Open states are actionable no matter how old — deep links to them default to "all time". */
const OPEN_STATE_FILTERS: TxStatusFilter[] = ["needs_action", "underpaid", "processing", "confirmed", "pending"];

const TransactionPage = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");

  const [searchTerm, setSearchTerm] = useState("");
  // Default view is the last 30 days (plan.md §4); "all" lifts the window, "custom" = explicit dates.
  const [range, setRange] = useState<TxRangePreset>(DEFAULT_TX_RANGE);
  const [dateRange, setDateRange] = useState<DateRange>(() => rangeToDates(DEFAULT_TX_RANGE));
  const [selectedWallet, setSelectedWallet] = useState("all");
  const [selectedSource, setSelectedSource] = useState<TransactionSourceType | "all">(
    "all",
  );
  const [selectedStatus, setSelectedStatus] = useState<TxStatusFilter>("all");
  // Bumped by "Clear filters" so the top bar's internal search/date state resets too.
  const [filterResetKey, setFilterResetKey] = useState(0);

  // Read status filter from query parameter (e.g., /transactions?status=unpaid —
  // the dashboard's "pending" tile deep-links here).
  useEffect(() => {
    if (!router.isReady || !router.query.status) return;
    const raw = String(router.query.status).toLowerCase();
    const aliases: Record<string, TxStatusFilter> = {
      all: "all",
      awaiting: "awaiting_payment",
      success: "settled",
      successful: "settled",
      completed: "settled",
      needs_action: "needs_action",
      "needs-action": "needs_action",
    };
    const mapped = aliases[raw] ?? ((STATUS_FILTERS as string[]).includes(raw) ? (raw as TxStatusFilter) : null);
    if (mapped) setSelectedStatus(mapped);
    if (mapped && OPEN_STATE_FILTERS.includes(mapped) && !router.query.range) {
      setRange("all");
      setDateRange(rangeToDates("all"));
    }
  }, [router.isReady, router.query.status]);

  // Read the date preset from the URL (e.g. /transactions?range=today from the dashboard).
  useEffect(() => {
    if (!router.isReady || !router.query.range) return;
    const raw = String(router.query.range).toLowerCase();
    if (isTxRangePreset(raw) && raw !== "custom") {
      setRange(raw);
      setDateRange(rangeToDates(raw));
    }
  }, [router.isReady, router.query.range]);

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
    const aliases: Record<string, TransactionSourceType | "all"> = {
      all: "all",
      api: "api",
      tip: "tip",
      tips: "tip",
      product: "product",
      products: "product",
      orders: "product",
      store: "product",
      contribution: "contribution",
      contributions: "contribution",
      donation: "contribution",
      donations: "contribution",
      payment_link: "payment_link",
      "payment-links": "payment_link",
      payment_links: "payment_link",
      direct: "direct",
    };
    const mapped: TransactionSourceType | "all" | null = aliases[raw] ?? null;
    if (mapped) setSelectedSource(mapped);
  }, [router.isReady, router.query.source]);

  // Move 4 (⌘K palette): seed the search filter from a `?search=` deep link
  // (e.g. "Search transactions for <id>" in the global command palette).
  useEffect(() => {
    if (!router.isReady || !router.query.search) return;
    const q = String(router.query.search);
    if (q) setSearchTerm(q);
  }, [router.isReady, router.query.search]);

  const transactionState = useSelector(
    (state: rootReducer) => state.transactionReducer,
  );

  const selectedCompanyId = useCompanyStore().selectedCompanyId;

  useEffect(() => {
    // Skip if a hover-prefetch (from the sidebar) is already loading this
    // data — avoids a double fetch on hover → click. Otherwise fetch /
    // revalidate for the current company.
    if (transactionState.loading) return;
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
    // canvas-confetti loaded lazily so it stays out of the dashboard bundle.
    void import("canvas-confetti").then(({ default: confetti }) => {
      const colors = ["#3FD98A", "#05936A", "#10B981", "#F59E0B", "#7C5CFF"];
      confetti({ disableForReducedMotion: true, particleCount: 90, spread: 70, startVelocity: 45, origin: { x: 0.2, y: 0.6 }, colors, scalar: 1 });
      confetti({ disableForReducedMotion: true, particleCount: 90, spread: 70, startVelocity: 45, origin: { x: 0.8, y: 0.6 }, colors, scalar: 1 });
      setTimeout(() => {
        confetti({ disableForReducedMotion: true, particleCount: 60, spread: 80, startVelocity: 35, origin: { x: 0.5, y: 0.3 }, colors, scalar: 0.9 });
      }, 350);
    }).catch(() => { /* canvas-confetti is client-only, safe to ignore */ });
  }, [confirmedPaymentCount, selectedCompanyId]);

  // Shared unambiguous format ("13 Aug 2026, 13:10") — same as Payment Links
  // and API Keys (UI/UX audit date-format unification).
  const formatDateTime = (isoString: string) => formatDisplayDateTime(isoString);

  // Every filter EXCEPT status — the status chips count against this slice so
  // the numbers stay live as search / date / wallet / source change.
  const baseTransactions: ExtendedTransaction[] = useMemo(() => {
    if (!transactionState?.customers_transactions) return [];

    return transactionState.customers_transactions
      .filter((item: ICustomerTransactions) =>
        matchesBaseFilters(item, { searchTerm, selectedWallet, selectedSource, dateRange }),
      )
      .map((item: ICustomerTransactions) => {
        const cryptoCurrency = (item as any).crypto_currency || (item as any).crypto || item.base_currency;
        const cryptoAmount = Number((item as any).crypto_amount) || Number(item.base_amount) || 0;
        const autoConverted = (item as any).auto_converted === true || (item as any).auto_converted === 'true';
        const autoConvertData = (item as any).auto_convert || null;
        const autoConvertTarget = autoConvertData?.target_currency || null;
        const autoConvertDisplayStatus = autoConvertData?.display_status || null;
        const autoConvert = toAutoConvertInfo(autoConvertData);

        return {
          id: String((item as any).transaction_id || item.id || `TX-${Math.random().toString(36).substr(2, 9)}`),
          crypto: cryptoCurrency,
          amount: `${formatDisplayAmount(cryptoAmount, cryptoCurrency)} ${cryptoCurrency}`,
          cryptoAmountRaw: cryptoAmount,
          usdValue: (() => {
            // Only show a USD figure when the backend has an actual stored
            // usd_value. Pending / unvalued crypto rows (no stored value) show
            // "—" instead of misleadingly rendering the crypto base_amount as
            // dollars — and we never do a slow live conversion for them.
            const raw = Number((item as any).usd_value) || 0;
            if (raw <= 0) return "—";
            if (raw >= 1) return `$${formatWithSeparators(raw, undefined, 2)}`;
            if (raw >= 0.01) return `$${toFixedStr(raw, 4).replace(/0+$/, "").replace(/\.$/, ".00")}`;
            return `$${toFixedStr(raw, 6).replace(/0+$/, "").replace(/\.$/, ".00")}`;
          })(),
          usdValueRaw: Number((item as any).usd_value) || 0,
          dateTime: formatDateTime(item.createdAt),
          createdAtTs: (() => {
            const ts = item.createdAt ? new Date(item.createdAt).getTime() : NaN;
            return Number.isFinite(ts) ? ts : 0;
          })(),
          status: toTxStatusBucket(item.status),
          customerName: (item as any).customer_name || null,
          customerEmail: (item as any).email || null,
          network: getNetworkLabel(cryptoCurrency),
          receivedAmountRaw: (item as any).received_amount != null ? Number((item as any).received_amount) : null,
          remainingAmountRaw: (item as any).remaining_amount != null ? Number((item as any).remaining_amount) : null,
          fees: (() => {
            const txFee = Number((item as any).transaction_fee) || 0;
            const fixedFee = Number((item as any).fixed_fee) || 0;
            const blockchainFee = Number((item as any).blockchain_buffer_fee) || 0;
            const totalFeeCrypto = txFee + fixedFee + blockchainFee;
            // Convert fee to USD using the same rate as the transaction
            const cryptoAmt = Number((item as any).crypto_amount) || 0;
            const usdVal = Number((item as any).usd_value) || 0;
            const rate = cryptoAmt > 0 ? usdVal / cryptoAmt : 0;
            return toNumber(totalFeeCrypto * rate, 2);
          })(),
          feesBreakdown: {
            platform: (() => {
              const fee = Number((item as any).transaction_fee) || 0;
              const cryptoAmt = Number((item as any).crypto_amount) || 0;
              const usdVal = Number((item as any).usd_value) || 0;
              const rate = cryptoAmt > 0 ? usdVal / cryptoAmt : 0;
              return toNumber(fee * rate, 2);
            })(),
            blockchain: (() => {
              const fee = Number((item as any).blockchain_buffer_fee) || 0;
              const cryptoAmt = Number((item as any).crypto_amount) || 0;
              const usdVal = Number((item as any).usd_value) || 0;
              const rate = cryptoAmt > 0 ? usdVal / cryptoAmt : 0;
              return toNumber(fee * rate, 2);
            })(),
            fixed: (() => {
              const fee = Number((item as any).fixed_fee) || 0;
              const cryptoAmt = Number((item as any).crypto_amount) || 0;
              const usdVal = Number((item as any).usd_value) || 0;
              const rate = cryptoAmt > 0 ? usdVal / cryptoAmt : 0;
              return toNumber(fee * rate, 2);
            })(),
          },
          confirmations: (() => {
            const s = (item.status || "").toLowerCase().trim();
            // Never-funded attempts (nothing on-chain) shouldn't show a "0/6"
            // counter that implies a payment is confirming. Empty hides the row.
            if (s === "awaiting_payment" || s === "awaiting" || s === "unpaid") return "";
            const complete = ["success", "successful", "completed", "payout_complete", "converted", "recovered", "done", "settled", "confirmed"].includes(s);
            const conf = Number((item as any).confirmations) || 0;
            const req = Number((item as any).required_confirmations) || 0;
            // Completed payments are fully confirmed on-chain (the counter isn't persisted post-settlement)
            if (complete) return req > 0 ? `${req}/${req}` : "Confirmed";
            if (conf > 0) return `${conf}/${req || 0}`;
            return req > 0 ? `0/${req}` : "0/0";
          })(),
          // Converted payments settle to the merchant's stablecoin payout wallet, not the source-coin wallet.
          settlementAddress: autoConvert?.settlementWalletAddress || (item as any).settlement_address || (item as any).wallet_address || "",
          incomingTransactionId: (item as any).incoming_tx_hash || (item as any).incoming_txid || (item as any).incomingTransactionId || (item as any).transaction_reference || "",
          // Backend already swaps in the Binance → merchant payout hash for converted rows.
          outgoingTransactionId: (item as any).outgoing_tx_hash || (item as any).outgoing_txid || (item as any).outgoingTransactionId || "",
          callbackUrl: (item as any).callback_url || (item as any).callbackUrl || "",
          webhookResponse: (item as any).webhook_response || (item as any).webhookResponse || null,
          autoConverted,
          autoConvertTarget,
          autoConvertDisplayStatus,
          autoConvert,
          // Session 48: source metadata for the UX (filter chips + row badge)
          source: (item as any).source as TransactionSource | undefined,
          // Session 57: tax fields (persisted on tbl_user_transaction at settlement)
          taxAmount: Number((item as any).tax_amount) || 0,
          taxRate: (item as any).tax_rate != null ? Number((item as any).tax_rate) : undefined,
          taxLabel: (item as any).tax_label || undefined,
          taxCountryCode: (item as any).tax_country_code || undefined,
          customerVatId: (item as any).customer_vat_id || undefined,
          reverseCharge: (item as any).reverse_charge === true || (item as any).reverse_charge === "true",
          // Referral fee-credit (Option 1.a): platform fee covered by the merchant's referral balance
          referralCreditUsd: Number((item as any).referral_credit_applied_usd) || 0,
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

  const statusCounts = useMemo(() => {
    const counts = { all: baseTransactions.length, needs_action: 0 } as Record<TxStatusFilter, number>;
    for (const s of STATUS_FILTERS) counts[s] = 0;
    for (const tx of baseTransactions) {
      counts[tx.status] = (counts[tx.status] || 0) + 1;
      if (isNeedsAction(tx.status, tx.createdAtTs || 0)) counts.needs_action += 1;
    }
    return counts;
  }, [baseTransactions]);

  const processedTransactions: ExtendedTransaction[] = useMemo(
    () =>
      selectedStatus === "all"
        ? baseTransactions
        : selectedStatus === "needs_action"
          ? baseTransactions.filter((tx) => isNeedsAction(tx.status, tx.createdAtTs || 0))
          : baseTransactions.filter((tx) => tx.status === selectedStatus),
    [baseTransactions, selectedStatus],
  );

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

  const syncRangeQuery = (preset: TxRangePreset) => {
    const query: Record<string, string> = { ...(router.query as any) };
    if (preset === DEFAULT_TX_RANGE || preset === "custom") delete query.range;
    else query.range = preset;
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  };

  const handleRangeChange = (preset: Exclude<TxRangePreset, "custom">) => {
    setRange(preset);
    setDateRange(rangeToDates(preset));
    syncRangeQuery(preset);
  };

  // Explicit dates from the calendar (desktop) or the phone filter sheet.
  const handleDateRangeChange = (next: DateRange) => {
    setDateRange(next);
    const preset: TxRangePreset = hasDateRange(next) ? "custom" : "all";
    setRange(preset);
    syncRangeQuery(preset);
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

  const handleStatusChange = (status: TxStatusFilter) => {
    setSelectedStatus(status);
    const query: Record<string, string> = { ...(router.query as any) };
    if (status === "all") delete query.status;
    else query.status = status;
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  };

  // "Clear filters" lifts everything — including the date window — so results always come back.
  const clearFilters = () => {
    setSearchTerm("");
    setRange("all");
    setDateRange(rangeToDates("all"));
    setSelectedWallet("all");
    setSelectedSource("all");
    setSelectedStatus("all");
    setFilterResetKey((k) => k + 1);
    const query: Record<string, string> = { ...(router.query as any) };
    delete query.source;
    delete query.wallet;
    delete query.status;
    query.range = "all";
    router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  };

  // Phone (<768px) bottom-sheet filter — plan 2.5. Applies every non-search
  // filter at once and mirrors source / status / wallet into the URL.
  const cardView = useTableCardView();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const { t: tTx } = useTranslation("transactions");
  const currentFilters: TxFilters = { searchTerm, dateRange, selectedWallet, selectedSource, selectedStatus };
  // Preset windows (30d default…) are the page's normal view, not an "active filter"; only explicit dates count.
  const filtersForCount: TxFilters = { ...currentFilters, dateRange: range === "custom" ? dateRange : { startDate: null, endDate: null } };
  const applyFilters = (next: TxFilters) => {
    if (next.dateRange.startDate !== dateRange.startDate || next.dateRange.endDate !== dateRange.endDate) {
      const preset: TxRangePreset = hasDateRange(next.dateRange) ? "custom" : "all";
      setRange(preset);
    }
    setDateRange(next.dateRange);
    setSelectedWallet(next.selectedWallet);
    setSelectedSource(next.selectedSource);
    setSelectedStatus(next.selectedStatus);
    const query: Record<string, string> = { ...(router.query as any) };
    if (next.selectedSource === "all") delete query.source; else query.source = next.selectedSource;
    if (next.selectedStatus === "all") delete query.status; else query.status = next.selectedStatus;
    if (next.selectedWallet === "all") delete query.wallet; else query.wallet = walletMapping[next.selectedWallet];
    if (next.dateRange.startDate !== dateRange.startDate || next.dateRange.endDate !== dateRange.endDate) {
      if (hasDateRange(next.dateRange)) delete query.range; else query.range = "all";
    }
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  };
  const activeFilterPills = [
    selectedSource !== "all" && {
      key: "source",
      label: tTx(SOURCE_OPTIONS.find((o) => o.value === selectedSource)?.key || "sourceAll", { defaultValue: selectedSource }),
      onRemove: () => applyFilters({ ...currentFilters, selectedSource: "all" }),
    },
    selectedStatus !== "all" && {
      key: "status",
      label:
        selectedStatus === "awaiting_payment"
          ? tTx("awaitingShort", { defaultValue: "Awaiting" })
          : selectedStatus === "needs_action"
            ? tTx("needsAction", { defaultValue: "Needs action" })
            : String(tTx(selectedStatus)),
      onRemove: () => applyFilters({ ...currentFilters, selectedStatus: "all" }),
    },
    selectedWallet !== "all" && {
      key: "wallet",
      label: walletMapping[selectedWallet] || selectedWallet,
      onRemove: () => applyFilters({ ...currentFilters, selectedWallet: "all" }),
    },
    range === "custom" && hasDateRange(dateRange) && {
      key: "date",
      label: `${format(dateRange.startDate as Date, "d MMM")} – ${format(dateRange.endDate as Date, "d MMM")}`,
      onRemove: () => applyFilters({ ...currentFilters, dateRange: { startDate: null, endDate: null } }),
    },
  ].filter(Boolean) as Array<{ key: string; label: string; onRemove: () => void }>;

  const [settledExport, setSettledExport] = useState(false);
  // Export honours EVERY active filter — search, date range (whole days, like
  // the on-screen filter), wallet, source and the status chip. A status chip
  // supersedes "Settled only".
  const handleExport = () => {
    const hasDates = !!(dateRange.startDate && dateRange.endDate);
    dispatch(TransactionAction(TRANSACTION_EXPORT, {
      wallet: selectedWallet !== "all" ? walletMapping[selectedWallet] : undefined,
      source: selectedSource !== "all" ? selectedSource : undefined,
      status: selectedStatus !== "all" ? selectedStatus : undefined,
      date_from: hasDates ? startOfDay(dateRange.startDate as Date).toISOString() : undefined,
      date_to: hasDates ? endOfDay(dateRange.endDate as Date).toISOString() : undefined,
      search: searchTerm || undefined,
      company_id: selectedCompanyId || undefined,
      settled_only: selectedStatus === "all" && settledExport,
    }));
  };

  // Stale-while-revalidate: only show the full skeleton on a genuine first
  // load — i.e. when we have NO cached rows yet, or the cached rows belong to a
  // DIFFERENT company (just switched). On a repeat visit to the same company we
  // paint the cached transactions instantly and refetch in the background, so
  // navigating to /transactions no longer flashes a skeleton for the whole
  // 300ms–2s backend round-trip.
  const hasCachedTx = (transactionState?.customers_transactions?.length ?? 0) > 0;
  const cacheMatchesCompany =
    transactionState?.loaded_company_id === (selectedCompanyId ?? null);
  if (transactionState.loading && (!hasCachedTx || !cacheMatchesCompany)) {
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
        key={filterResetKey}
        onSearch={handleSearch}
        onDateRangeChange={handleDateRangeChange}
        onWalletChange={handleWalletChange}
        onSourceChange={handleSourceChange}
        onOpenFilters={() => setFilterSheetOpen(true)}
        activeFilterCount={countActiveFilters(filtersForCount)}
        initialWallet={selectedWallet}
        initialSource={selectedSource}
        initialSearch={searchTerm}
        initialDateRange={dateRange}
        range={range}
        onRangeChange={handleRangeChange}
      />
      {cardView && (
        <TransactionsFilterSheet
          open={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          filters={currentFilters}
          rows={transactionState?.customers_transactions || []}
          onApply={applyFilters}
        />
      )}
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
            borderRadius: "12px",
            border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.10)" : "rgba(10,10,15,0.08)"}`,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Typography sx={{ fontSize: "11px", fontFamily: "var(--font-tech), monospace", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
            {t("taxCollected", { defaultValue: "Tax collected" })}
          </Typography>
          <Typography sx={{ fontSize: "14px", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: theme.palette.text.primary }}>
            {formatWithSeparators(taxSummary.total, undefined, 2)}
          </Typography>
          <Typography sx={{ fontSize: "11.5px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
            {t("taxAcross", {
              count: taxSummary.count,
              defaultValue: `across ${taxSummary.count} ${taxSummary.count === 1 ? "payment" : "payments"}`,
            })}
          </Typography>
        </Box>
      )}
      {(() => {
        const renderToolbar = (standalone?: boolean) => (
          <TransactionsToolbar
            counts={statusCounts}
            selected={selectedStatus}
            onChange={handleStatusChange}
            onExport={handleExport}
            settledOnly={settledExport}
            onSettledOnlyChange={setSettledExport}
            standalone={standalone}
            activeFilters={cardView ? activeFilterPills : undefined}
            resultCount={processedTransactions.length}
          />
        );
        return processedTransactions.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {baseTransactions.length > 0 && renderToolbar(true)}
            <EmptyDataModel
              pageName="transactions"
              variant="no-results"
              onClearFilters={clearFilters}
            />
          </Box>
        ) : (
          <TransactionsTable transactions={processedTransactions} rowsPerPage={10} toolbar={renderToolbar()} />
        );
      })()}

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
