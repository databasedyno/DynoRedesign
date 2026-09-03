import BitcoinIcon from "@/assets/cryptocurrency/Bitcoin-icon.svg";
import { formatWithSeparators } from "@/utils/currencyFormat";
import BitcoinCashIcon from "@/assets/cryptocurrency/BitcoinCash-icon.svg";
import DogecoinIcon from "@/assets/cryptocurrency/Dogecoin-icon.svg";
import EthereumIcon from "@/assets/cryptocurrency/Ethereum-icon.svg";
import LitecoinIcon from "@/assets/cryptocurrency/Litecoin-icon.svg";
import TronIcon from "@/assets/cryptocurrency/Tron-icon.svg";
import USDTIcon from "@/assets/cryptocurrency/USDT-icon.svg";
import USDCIcon from "@/assets/cryptocurrency/USDC-icon.svg";
import SolanaIcon from "@/assets/cryptocurrency/Solana-icon.svg";
import XRPIcon from "@/assets/cryptocurrency/XRP-icon.svg";
import PolygonIcon from "@/assets/cryptocurrency/Polygon-icon.svg";
import RLUSDIcon from "@/assets/cryptocurrency/RLUSD-icon.svg";
import { Icon, MONO } from "@/styles/uiKit";
import TransactionStatusBadge from "@/Components/UI/TransactionStatusBadge";
import { getAssetColor } from "@/helpers/assetColor";
import TransactionSourceBadge from "@/Components/UI/TransactionSourceBadge";
import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import CryptoIcon from "@/assets/Icons/crypto-icon.svg";
import CurrencyIcon from "@/assets/Icons/dollar-sign-icon.svg";
import HexagonIcon from "@/assets/Icons/hexagon-icon.svg";
import SwapHorizIcon from "@/assets/Icons/swap-round-icon.svg";
import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import TimeIcon from "@/assets/Icons/time-icon.svg";
import TransactionIcon from "@/assets/Icons/transaction-icon.svg";

import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";

import CustomButton from "@/Components/UI/Buttons";
import RowsPerPageSelector from "@/Components/UI/RowsPerPageSelector";
import useTableCardView from "@/hooks/useTableCardView";
import { useDisplayFx } from "@/hooks/useDisplayFx";
import {
  ExtendedTransaction,
  TransactionsTableProps,
} from "@/utils/types/transaction";
import { TransactionAction } from "@/Redux/Actions";
import { TRANSACTION_DETAIL_FETCH } from "@/Redux/Actions/TransactionAction";
import { useDispatch } from "react-redux";
import { Text } from "../CreatePaymentLink/styled";
import {
  CryptoIconChip,
  MobileNavigationButtons,
  TransactionsTableBody,
  TransactionsTableCell,
  TransactionsTableFooter,
  TransactionsTableFooterText,
  TransactionsTableHeader,
  TransactionsTableHeaderItem,
  TransactionsTableRow,
} from "./styled";
import TransactionDetailsModal from "./TransactionDetailsModal";
import { brandFg } from "@/constants/theme";
import { toFixedStr } from "@/utils/money";

const TransactionsTable: React.FC<TransactionsTableProps> = ({
  transactions,
  rowsPerPage: initialRowsPerPage = 10,
  toolbar,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const router = useRouter();
  const { t } = useTranslation("transactions");
  const tTransactions = useCallback(
    (key: string, options?: any): string => {
      const result = t(key, { ns: "transactions", ...options });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);
  const [selectedTransaction, setSelectedTransaction] =
    useState<ExtendedTransaction | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Frozen-column support: the desktop/tablet table is a single scroll
  // container so the first column (Transaction ID) can be pinned with
  // position: sticky; left: 0. We only paint the freeze shadow once the user
  // actually scrolls sideways (scrolledX) so wide screens stay flat/clean.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrolledX, setScrolledX] = useState(false);
  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const isScrolled = e.currentTarget.scrollLeft > 0;
    setScrolledX((prev) => (prev === isScrolled ? prev : isScrolled));
  }, []);

  const isMobile = useTableCardView();
  const fx = useDisplayFx();

  /** Fiat value in the merchant's display currency (falls back to the raw
   *  USD string until the FX rate resolves / if it's USD anyway). */
  const displayValue = useCallback(
    (tx: ExtendedTransaction): string => {
      // No stored USD value (pending / unvalued) → show "—", never a converted
      // crypto amount masquerading as dollars.
      if (!tx.usdValueRaw || tx.usdValueRaw <= 0) return "—";
      return fx.formatFromUsd(tx.usdValueRaw) ?? tx.usdValue;
    },
    [fx],
  );

  const totalPages = Math.ceil(transactions.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentTransactions = transactions.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [transactions]);

  const getCryptoIcon = (crypto: string) => {
    const normalized = crypto?.toUpperCase() || "";
    if (normalized === "BTC") return BitcoinIcon;
    if (normalized === "ETH") return EthereumIcon;
    if (normalized === "LTC") return LitecoinIcon;
    if (normalized === "DOGE") return DogecoinIcon;
    if (normalized === "BCH") return BitcoinCashIcon;
    if (normalized === "TRX") return TronIcon;
    if (normalized.includes("USDT")) return USDTIcon;
    if (normalized.includes("USDC")) return USDCIcon;
    if (normalized === "SOL") return SolanaIcon;
    if (normalized === "XRP") return XRPIcon;
    if (normalized.includes("POLYGON")) return PolygonIcon;
    if (normalized.includes("RLUSD")) return RLUSDIcon;
    return BitcoinIcon;
  };

  /** Session 55: unified source badge — delegates to the single shared
   *  <TransactionSourceBadge> so the transactions table, dashboard "Recent
   *  transactions", the details modal and the payment-links table all render
   *  the exact same icon + label for every canonical source type
   *  (payment_link / api / tip / product / contribution / direct). */
  const renderSourceBadge = (
    source?: ExtendedTransaction["source"],
    opts?: { compact?: boolean; withTitle?: boolean },
  ) => (
    <TransactionSourceBadge
      source={source}
      compact={opts?.compact}
      withTitle={opts?.withTitle}
    />
  );

  const handleRowsPerPageChange = (value: number) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handleRowClick = (transaction: ExtendedTransaction) => {
    setSelectedTransaction(transaction);
    setModalOpen(true);
    // Fetch full transaction detail from API
    if (transaction.id) {
      dispatch(TransactionAction(TRANSACTION_DETAIL_FETCH, { id: transaction.id }));
    }
  };

  // Session 54 fix (Bug A): deep-link support. When the dashboard "recent
  // transactions" widget (or any feature page) links to
  // /transactions?tx=<id>, auto-open the details modal for that transaction
  // instead of just dumping the user on the list. `handledTxParam` guards
  // against reopening after the user closes it.
  const [handledTxParam, setHandledTxParam] = useState<string | null>(null);
  useEffect(() => {
    if (!router.isReady) return;
    const txId = router.query.tx ? String(router.query.tx) : null;
    if (!txId) {
      if (handledTxParam !== null) setHandledTxParam(null);
      return;
    }
    if (txId === handledTxParam) return;
    const match = transactions.find((tx) => String(tx.id) === txId);
    if (match) {
      setSelectedTransaction(match);
      setModalOpen(true);
      setHandledTxParam(txId);
      if (match.id) {
        dispatch(TransactionAction(TRANSACTION_DETAIL_FETCH, { id: match.id }));
      }
    }
  }, [router.isReady, router.query.tx, transactions, handledTxParam, dispatch]);

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedTransaction(null);
    // Strip the ?tx= param on close so the URL is clean and the effect above
    // won't reopen the modal.
    if (router.query.tx) {
      const nextQuery = { ...router.query };
      delete nextQuery.tx;
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
        shallow: true,
      });
    }
  };

  const MONETARY_KEYS = new Set(["amount", "usdValue", "vat"]);

  const HeaderData = [
    {
      label: isMobile ? tTransactions("id") : tTransactions("transactionId"),
      key: "id",
      icon: TransactionIcon,
    },
    {
      label: tTransactions("crypto"),
      key: "crypto",
      icon: CryptoIcon,
    },
    {
      label: tTransactions("amount"),
      key: "amount",
      icon: RoundedStackIcon,
    },
    {
      label:
        fx.currency && fx.currency !== "USD"
          ? `${tTransactions("value", { defaultValue: "Value" })} (${fx.currency})`
          : tTransactions("usdValue"),
      key: "usdValue",
      icon: CurrencyIcon,
    },
    {
      label: tTransactions("vat", { defaultValue: "VAT / Tax" }),
      key: "vat",
      icon: CurrencyIcon,
    },
    {
      label: tTransactions("dateTime"),
      key: "dateTime",
      icon: TimeIcon,
    },
    {
      label: tTransactions("status"),
      key: "status",
      icon: HexagonIcon,
    },
  ];

  const navButtonStyle = {
    width: "fit-content",
    height: "36px",
    padding: "0px 12px",
    "&:disabled": {
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
      border: `1px solid ${theme.palette.border.main}`,
      cursor: "not-allowed",
      opacity: 0.5,
    },
    ".custom-button-label": {
      fontSize: "13px !important",
      fontFamily: "var(--font-sans)",
      lineHeight: "16px",
      fontWeight: 500,
    },
    [theme.breakpoints.down("md")]: {
      display: "none",
    },
  };

  /** Smart format for crypto amounts — trim trailing zeros, sensible precision */
  const formatAmount = (amount: any) => {
    const parts = String(amount).split(" ");
    const value = Number(parts[0]);
    const unit = parts.slice(1).join(" ") || "";
    const upperUnit = unit.toUpperCase();

    // Stablecoins: 2 decimals
    if (upperUnit.includes("USDT") || upperUnit.includes("USDC") || upperUnit === "USD" || upperUnit.includes("BUSD") || upperUnit.includes("DAI")) {
      return `${toFixedStr(value, 2)} ${unit}`;
    }

    // Crypto: up to 8 decimals for BTC, 6 for others, trim trailing zeros
    const maxDecimals = upperUnit === "BTC" ? 8 : 6;
    const formatted = toFixedStr(value, maxDecimals).replace(/\.?0+$/, "");
    // Ensure at least 2 decimals for readability
    const dotIndex = formatted.indexOf(".");
    const currentDecimals = dotIndex >= 0 ? formatted.length - dotIndex - 1 : 0;
    const result = currentDecimals < 2 && dotIndex >= 0
      ? toFixedStr(value, 2)
      : currentDecimals === 0
        ? toFixedStr(value, 2)
        : formatted;
    return `${result} ${unit}`;
  };

  const isDataEmpty = currentTransactions.length === 0;

  // Mobile card layout for transactions
  const renderMobileCards = () => (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, px: 2 }}>
      {isDataEmpty ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 4 }}>
          <Typography sx={{ fontSize: "14px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
            {t("transactionsNotAvailable", { ns: "common" })}
          </Typography>
        </Box>
      ) : (
        <>
          {currentTransactions.map((transaction) => (
            <Box
              key={transaction.id}
              onClick={() => handleRowClick(transaction)}
              sx={{
                p: 2,
                borderRadius: "12px",
                border: `1px solid ${theme.palette.border.main}`,
                borderLeft: `3px solid ${getAssetColor(transaction.crypto)}`,
                bgcolor: theme.palette.background.paper,
                cursor: "pointer",
                transition: "background 0.15s",
                "&:active": { bgcolor: theme.palette.secondary.main },
              }}
            >
              {/* Source badge — session 48. Sits above the crypto row so the
                  merchant sees the revenue origin first. */}
              {transaction.source && (
                <Box sx={{ mb: 1 }}>
                  {renderSourceBadge(transaction.source, { withTitle: true, compact: true })}
                </Box>
              )}
              {/* Top row: Crypto + Status */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.25 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Image
                    src={getCryptoIcon(transaction.crypto)}
                    alt={transaction.crypto}
                    width={24}
                    height={24}
                    draggable={false}
                  />
                  <Typography sx={{ fontSize: "15px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary }}>
                    {transaction.crypto}
                  </Typography>
                </Box>
                <TransactionStatusBadge
                  status={transaction.status}
                  autoConverted={transaction.autoConverted}
                  data-testid="tx-card-status"
                />
              </Box>
              {/* Middle row: Amount + USD */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.75 }}>
                <Typography sx={{ fontSize: "16px", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: theme.palette.text.primary }}>
                  {formatAmount(transaction.amount)}
                </Typography>
                <Typography sx={{ fontSize: "14px", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontWeight: 500, color: brandFg(theme.palette.mode === "dark") }} data-testid="tx-fiat-value">
                  {displayValue(transaction)}
                </Typography>
              </Box>
              {(transaction.reverseCharge || Number(transaction.taxAmount) > 0) && (
                <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.75 }}>
                  <Typography sx={{ fontSize: "11px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                    {transaction.reverseCharge
                      ? tTransactions("reverseCharge", { defaultValue: "Reverse-charge" })
                      : `${tTransactions("vatShort", { defaultValue: "incl. VAT" })} ${formatWithSeparators(Number(transaction.taxAmount), undefined, 2)}${transaction.taxRate != null ? ` (${Number(transaction.taxRate)}%)` : ""}`}
                  </Typography>
                </Box>
              )}
              {/* Bottom row: ID + Date */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: "11px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, maxWidth: "50%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {transaction.id}
                </Typography>
                <Typography sx={{ fontSize: "11px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                  {transaction.dateTime}
                </Typography>
              </Box>
            </Box>
          ))}
        </>
      )}
    </Box>
  );

  // Desktop / tablet table layout — ONE scroll container (both axes) so the
  // first column (Transaction ID) can be frozen with position: sticky; left: 0
  // while the remaining columns scroll sideways on tablets. The header stays
  // pinned via position: sticky; top: 0. A soft edge shadow on the frozen
  // column only appears once the user actually scrolls right (scrolledX).
  const renderDesktopTable = () => {
    const frozenEdgeShadow = scrolledX
      ? theme.palette.mode === "dark"
        ? "8px 0 12px -8px rgba(0,0,0,0.6)"
        : "8px 0 12px -8px rgba(15,15,20,0.22)"
      : "none";
    const stickyFirstHeaderSx = {
      position: "sticky" as const,
      left: 0,
      zIndex: 4,
      backgroundColor: theme.palette.background.paper,
      backgroundImage: `linear-gradient(${theme.palette.primary.light}, ${theme.palette.primary.light})`,
      boxShadow: frozenEdgeShadow,
      transition: "box-shadow 160ms ease",
    };
    const stickyFirstCellSx = {
      position: "sticky" as const,
      left: 0,
      zIndex: 1,
      backgroundColor: theme.palette.background.paper,
      boxShadow: frozenEdgeShadow,
      transition: "box-shadow 160ms ease",
    };

    return (
      <Box
        ref={scrollRef}
        onScroll={handleTableScroll}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          backgroundColor: theme.palette.background.paper,
          // Thin visible scrollbar so it's obvious the table scrolls sideways.
          scrollbarWidth: "thin",
          scrollbarColor:
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.28) transparent"
              : "rgba(15,15,20,0.28) transparent",
          "&::-webkit-scrollbar": { height: 8, width: 8 },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            backgroundColor:
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.22)"
                : "rgba(15,15,20,0.22)",
          },
        }}
      >
        <Box sx={{ minWidth: "max-content" }}>
          {/* Header Section — sticky top (stays on vertical scroll); the first
              item is also sticky left so it freezes with the ID column. */}
          <TransactionsTableHeader
            sx={{
              position: "sticky",
              top: 0,
              zIndex: 3,
              // primary.light is a translucent tint — composite it over the
              // paper colour so scrolled rows never bleed through the header.
              backgroundColor: theme.palette.background.paper,
              backgroundImage: `linear-gradient(${theme.palette.primary.light}, ${theme.palette.primary.light})`,
              ...(toolbar ? { borderRadius: 0 } : {}),
            }}
          >
            {HeaderData.map((item, idx) => (
              <TransactionsTableHeaderItem
                key={item.key}
                sx={{
                  ...(idx === 0 ? stickyFirstHeaderSx : {}),
                  ...(MONETARY_KEYS.has(item.key)
                    ? { justifyContent: "flex-end" }
                    : {}),
                }}
              >
                <Image
                  src={item.icon}
                  alt={item.label}
                  className="themed-icon"
                  draggable={false}
                />
                <span>{item.label}</span>
              </TransactionsTableHeaderItem>
            ))}
          </TransactionsTableHeader>

          {/* Body Section — no inner scroll; the single outer container scrolls
              both axes so the frozen first column resolves correctly. */}
          <TransactionsTableBody sx={{ overflow: "visible", flex: "0 0 auto", minHeight: 0 }}>
            {isDataEmpty ? (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  py: 6,
                }}
              >
                {t("transactionsNotAvailable", { ns: "common" })}
              </Box>
            ) : (
              currentTransactions.map((transaction) => (
                <TransactionsTableRow
                  key={transaction.id}
                  onClick={() => handleRowClick(transaction)}
                  sx={{
                    paddingY: "10px !important",
                    cursor: "pointer",
                  }}
                >
                  <TransactionsTableCell sx={stickyFirstCellSx}>
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        minWidth: 0,
                      }}
                    >
                      {renderSourceBadge(transaction.source, { withTitle: true })}
                      <Typography
                        component="span"
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "13px",
                          color: theme.palette.text.secondary,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "22ch",
                        }}
                      >
                        {transaction.id}
                      </Typography>
                    </Box>
                  </TransactionsTableCell>

                  <TransactionsTableCell>
                    <CryptoIconChip accent={getAssetColor(transaction.crypto)} sx={{ width: "fit-content" }}>
                      <Image
                        src={getCryptoIcon(transaction.crypto)}
                        alt={transaction.crypto}
                        draggable={false}
                      />
                      <Typography
                        component="span"
                        sx={{ color: theme.palette.text.secondary }}
                      >
                        {transaction.crypto}
                      </Typography>
                    </CryptoIconChip>
                    {transaction.autoConverted && (
                      <Box
                        sx={{
                          display: "flex",
                          gap: "3px",
                          alignItems: "center",
                        }}
                      >
                        <Image
                          src={SwapHorizIcon}
                          alt="swap horiz"
                          width={15}
                          height={15}
                          draggable={false}
                          className="themed-icon"
                        />
                        <Icon
                          name="arrow-up-right"
                          size={16}
                          color={theme.palette.text.secondary}
                        />
                        <Text
                          sx={{
                            fontSize: "13px",
                            color: theme.palette.text.secondary,
                          }}
                        >
                          {transaction.autoConvertTarget || "USDT"}
                        </Text>
                      </Box>
                    )}
                  </TransactionsTableCell>

                  <TransactionsTableCell sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", justifyContent: "flex-end" }}>
                    {formatAmount(transaction.amount)}
                  </TransactionsTableCell>

                  <TransactionsTableCell data-testid="tx-fiat-value" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", justifyContent: "flex-end" }}>
                    {displayValue(transaction)}
                  </TransactionsTableCell>

                  <TransactionsTableCell sx={{ justifyContent: "flex-end", fontVariantNumeric: "tabular-nums" }}>
                    {transaction.reverseCharge ? (
                      <Typography
                        component="span"
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: theme.palette.text.secondary,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tTransactions("reverseCharge", { defaultValue: "Reverse-charge" })}
                      </Typography>
                    ) : Number(transaction.taxAmount) > 0 ? (
                      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: 0 }}>
                        <Typography
                          component="span"
                          sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: "13px", fontWeight: 600, color: theme.palette.text.primary }}
                        >
                          {formatWithSeparators(Number(transaction.taxAmount), undefined, 2)}
                        </Typography>
                        <Typography
                          component="span"
                          sx={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: theme.palette.text.secondary }}
                        >
                          {(transaction.taxLabel || "VAT")}
                          {transaction.taxRate != null ? ` ${Number(transaction.taxRate)}%` : ""}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography component="span" sx={{ color: theme.palette.text.disabled }}>—</Typography>
                    )}
                  </TransactionsTableCell>

                  <TransactionsTableCell>
                    {transaction.dateTime}
                  </TransactionsTableCell>

                  <TransactionsTableCell>
                    <TransactionStatusBadge
                      status={transaction.status}
                      autoConverted={transaction.autoConverted}
                      data-testid="tx-row-status"
                    />
                  </TransactionsTableCell>
                </TransactionsTableRow>
              ))
            )}
          </TransactionsTableBody>
        </Box>
      </Box>
    );
  };

  return (
    <Box
      data-testid="transactions-table-card"
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        p: 0,
        // Desktop: the card shrinks to the space left under the top bar (never
        // taller than the viewport) so the inner scroll box scrolls vertically
        // and the column header genuinely sticks. Mobile keeps content flow —
        // the cards scroll with the page.
        flex: isMobile ? 1 : "0 1 auto",
        maxHeight: isMobile ? "fit-content" : undefined,
        backgroundColor: isMobile ? "transparent" : theme.palette.background.paper,
        borderRadius: "14px",
      }}
    >
      {toolbar}
      {isMobile ? renderMobileCards() : renderDesktopTable()}

      {/* Footer Section */}
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderEndStartRadius: "14px",
          borderEndEndRadius: "14px",
          // Small separation from the last card on mobile (the big FAB/nav
          // clearance now lives in the spacer AFTER this footer — see below).
          mt: { xs: 1, md: 0 },
        }}
      >
        <TransactionsTableFooter>
          <RowsPerPageSelector
            value={rowsPerPage}
            onChange={handleRowsPerPageChange}
            menuItems={[5, 10, 15, 20].map((v) => ({ value: v, label: v }))}
          />

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <TransactionsTableFooterText>
              {/* Session 75 fix — the counter used `currentTransactions.length`
                  which is ALWAYS `rowsPerPage` (10) on non-last pages, so
                  clicking "Next" changed the table but the "Showing 10 of 458"
                  label stayed stuck at 10. Switch to an explicit range
                  ({{start}}-{{end}}) so the numbers actually move as the user
                  paginates. */}
              {tTransactions("showingTransactions", {
                start: transactions.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1,
                end: Math.min(currentPage * rowsPerPage, transactions.length),
                total: transactions.length,
                // Legacy interpolation values kept in case any locale still
                // references {{count}} — safe no-op if unused.
                count: currentTransactions.length,
              })}
            </TransactionsTableFooterText>

            <CustomButton
              label={tTransactions("previous")}
              variant="outlined"
              sx={navButtonStyle}
              startIcon={
                <KeyboardArrowLeftRoundedIcon
                  sx={{ height: "20px", width: "20px" }}
                />
              }
              disabled={currentPage === 1 || isDataEmpty}
              onClick={() => setCurrentPage((prev) => prev - 1)}
            />

            <CustomButton
              label={tTransactions("next")}
              variant="outlined"
              sx={navButtonStyle}
              endIcon={
                <KeyboardArrowRightRoundedIcon
                  sx={{ height: "20px", width: "20px" }}
                />
              }
              disabled={currentPage === totalPages || isDataEmpty}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            />

            {/* Mobile Nav */}
            <MobileNavigationButtons
              onClick={() => setCurrentPage((prev) => prev - 1)}
              disabled={currentPage === 1 || isDataEmpty}
            >
              <KeyboardArrowLeftRoundedIcon
                sx={{ height: "16px", width: "16px", color: "inherit" }}
              />
            </MobileNavigationButtons>

            <MobileNavigationButtons
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={currentPage === totalPages || isDataEmpty}
            >
              <KeyboardArrowRightRoundedIcon
                sx={{ height: "16px", width: "16px", color: "inherit" }}
              />
            </MobileNavigationButtons>
          </Box>
        </TransactionsTableFooter>
      </Box>

      {/* Mobile-only bottom clearance (session 72 fix).
          Placed AFTER the footer so the PAGINATION CONTROLS themselves clear
          the fixed "Emily" support-chat FAB (top edge ~164px above viewport
          bottom) + the bottom nav pill. On mobile the footer is the bottom-most
          interactive row and, because this table uses maxHeight:"fit-content",
          the layout's own container padding does NOT lift it (see session 71) —
          an in-component spacer is required. 180px = FAB top (164px) + breathing.
          This also clears the last card (which now sits above the footer). */}
      {isMobile && <Box sx={{ height: "180px", flexShrink: 0 }} />}

      <TransactionDetailsModal
        open={modalOpen}
        onClose={handleCloseModal}
        transaction={selectedTransaction}
      />
    </Box>
  );
};

export default TransactionsTable;
