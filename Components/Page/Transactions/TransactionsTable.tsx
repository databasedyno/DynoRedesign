import BitcoinIcon from "@/assets/cryptocurrency/Bitcoin-icon.svg";
import { formatWithSeparators } from "@/utils/currencyFormat";
import BitcoinCashIcon from "@/assets/cryptocurrency/BitcoinCash-icon.svg";
import DogecoinIcon from "@/assets/cryptocurrency/Dogecoin-icon.svg";
import EthereumIcon from "@/assets/cryptocurrency/Ethereum-icon.svg";
import LitecoinIcon from "@/assets/cryptocurrency/Litecoin-icon.svg";
import TronIcon from "@/assets/cryptocurrency/Tron-icon.svg";
import USDTIcon from "@/assets/cryptocurrency/USDT-icon.svg";
import SolanaIcon from "@/assets/cryptocurrency/Solana-icon.svg";
import XRPIcon from "@/assets/cryptocurrency/XRP-icon.svg";
import PolygonIcon from "@/assets/cryptocurrency/Polygon-icon.svg";
import RLUSDIcon from "@/assets/cryptocurrency/RLUSD-icon.svg";
import { Icon, MONO } from "@/styles/uiKit";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import DonutSmallRounded from "@mui/icons-material/DonutSmallRounded";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import { Box, Tooltip, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import CorrectIcon from "@/assets/Icons/correct-icon.png";
import WrongIcon from "@/assets/Icons/wrong-icon.png";

import CryptoIcon from "@/assets/Icons/crypto-icon.svg";
import CurrencyIcon from "@/assets/Icons/dollar-sign-icon.svg";
import HexagonIcon from "@/assets/Icons/hexagon-icon.svg";
import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import SwapHorizIcon from "@/assets/Icons/swap-round-icon.svg";
import TimeIcon from "@/assets/Icons/time-icon.svg";
import TransactionIcon from "@/assets/Icons/transaction-icon.svg";

import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";

import CustomButton from "@/Components/UI/Buttons";
import RowsPerPageSelector from "@/Components/UI/RowsPerPageSelector";
import useIsMobile from "@/hooks/useIsMobile";
import { useDisplayFx } from "@/hooks/useDisplayFx";
import { HourGlassIcon } from "@/utils/customIcons";
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
  SourceBadge,
  StatusBadge,
  StatusIconWrapper,
  StatusText,
  TransactionsTableBody,
  TransactionsTableCell,
  TransactionsTableFooter,
  TransactionsTableFooterText,
  TransactionsTableHeader,
  TransactionsTableHeaderItem,
  TransactionsTableRow,
} from "./styled";
import TransactionDetailsModal from "./TransactionDetailsModal";

const TransactionsTable: React.FC<TransactionsTableProps> = ({
  transactions,
  rowsPerPage: initialRowsPerPage = 10,
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

  const isMobile = useIsMobile("md");
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
    if (normalized.includes("USDC")) return USDTIcon;
    if (normalized === "SOL") return SolanaIcon;
    if (normalized === "XRP") return XRPIcon;
    if (normalized.includes("POLYGON")) return PolygonIcon;
    if (normalized.includes("RLUSD")) return RLUSDIcon;
    return BitcoinIcon;
  };

  const getStatusIcon = (status: "pending" | "confirmed" | "settled" | "failed" | "processing") => {
    switch (status) {
      case "settled":
        return <Image src={CorrectIcon} alt="correct" draggable={false} />;
      case "confirmed":
        return <Image src={CorrectIcon} alt="confirmed" draggable={false} />;
      case "pending":
      case "processing":
        return <HourGlassIcon fill={"#F57C00"} size={isMobile ? 12 : 16} />;
      case "failed":
        return <Image src={WrongIcon} alt="incorrect" draggable={false} />;
    }
  };

  /** Session 48: compact "Source" chip attached to each transaction row.
   *  5 sources: payment_link / contribution / tip / product / direct.
   *  Each has a distinct icon + tinted background so users can eyeball
   *  what a transaction is without opening the detail modal. */
  const renderSourceBadge = (
    source?: ExtendedTransaction["source"],
    opts?: { compact?: boolean; withTitle?: boolean },
  ) => {
    const type = source?.type || "direct";
    const showTitle = !!opts?.withTitle && !!source?.title;
    const iconSize = opts?.compact ? 11 : 12;
    const icon =
      type === "payment_link" ? (
        <LinkRounded sx={{ fontSize: iconSize }} />
      ) : type === "contribution" ? (
        <FavoriteRounded sx={{ fontSize: iconSize }} />
      ) : type === "tip" ? (
        <AutoAwesomeRounded sx={{ fontSize: iconSize }} />
      ) : type === "product" ? (
        <Inventory2Rounded sx={{ fontSize: iconSize }} />
      ) : (
        <DonutSmallRounded sx={{ fontSize: iconSize }} />
      );
    const typeLabels: Record<string, string> = {
      payment_link: tTransactions("sourcePaymentLinkShort", { defaultValue: "Link" }),
      contribution: tTransactions("sourceContributionShort", {
        defaultValue: "Contribution",
      }),
      tip: tTransactions("sourceTipShort", { defaultValue: "Tip" }),
      product: tTransactions("sourceProductShort", { defaultValue: "Product" }),
      direct: tTransactions("sourceDirectShort", { defaultValue: "Direct" }),
    };
    const label = typeLabels[type] || typeLabels.direct;
    const badge = (
      <SourceBadge
        sourceType={type}
        data-testid={`tx-source-badge-${type}`}
        aria-label={`Source: ${label}${source?.title ? " · " + source.title : ""}`}
      >
        {icon}
        <span>{label}</span>
        {showTitle && source?.title && (
          <>
            <span aria-hidden="true" style={{ opacity: 0.5, margin: "0 2px" }}>
              ·
            </span>
            <span className="badge-title">{source.title}</span>
          </>
        )}
      </SourceBadge>
    );
    if (source?.title) {
      return (
        <Tooltip title={`${label} · ${source.title}`} placement="top" arrow>
          {badge}
        </Tooltip>
      );
    }
    return badge;
  };

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
      return `${value.toFixed(2)} ${unit}`;
    }

    // Crypto: up to 8 decimals for BTC, 6 for others, trim trailing zeros
    const maxDecimals = upperUnit === "BTC" ? 8 : 6;
    const formatted = value.toFixed(maxDecimals).replace(/\.?0+$/, "");
    // Ensure at least 2 decimals for readability
    const dotIndex = formatted.indexOf(".");
    const currentDecimals = dotIndex >= 0 ? formatted.length - dotIndex - 1 : 0;
    const result = currentDecimals < 2 && dotIndex >= 0
      ? value.toFixed(2)
      : currentDecimals === 0
        ? value.toFixed(2)
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
                <StatusBadge status={transaction.status}>
                  <StatusIconWrapper status={transaction.status}>
                    {getStatusIcon(transaction.status)}
                  </StatusIconWrapper>
                  <StatusText status={transaction.status}>
                    {tTransactions(transaction.status)}
                    {transaction.autoConverted && transaction.status === "settled" && (
                      <Typography component="span" sx={{ fontSize: "10px", fontFamily: "var(--font-sans)", color: "#1565C0", ml: 0.5 }}>
                        · Converted
                      </Typography>
                    )}
                  </StatusText>
                </StatusBadge>
              </Box>
              {/* Middle row: Amount + USD */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.75 }}>
                <Typography sx={{ fontSize: "16px", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: theme.palette.text.primary }}>
                  {formatAmount(transaction.amount)}
                </Typography>
                <Typography sx={{ fontSize: "14px", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontWeight: 500, color: theme.palette.primary.main }} data-testid="tx-fiat-value">
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

  // Desktop table layout
  const renderDesktopTable = () => (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          minWidth: "max-content",
          height: "100%",
        }}
      >
        {/* Header Section */}
        <Box sx={{ display: "flex", height: 56 }}>
          <TransactionsTableHeader>
            {HeaderData.map((item) => (
              <TransactionsTableHeaderItem key={item.key}>
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
        </Box>

        {/* Body Section */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <TransactionsTableBody>
            {isDataEmpty ? (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  mt: 3,
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
                  <TransactionsTableCell>
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
                    <CryptoIconChip sx={{ width: "fit-content" }}>
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

                  <TransactionsTableCell sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                    {formatAmount(transaction.amount)}
                  </TransactionsTableCell>

                  <TransactionsTableCell data-testid="tx-fiat-value" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                    {displayValue(transaction)}
                  </TransactionsTableCell>

                  <TransactionsTableCell>
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
                      <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <Typography
                          component="span"
                          sx={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: theme.palette.text.primary }}
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
                    <StatusBadge status={transaction.status}>
                      <StatusIconWrapper status={transaction.status}>
                        {getStatusIcon(transaction.status)}
                      </StatusIconWrapper>
                      <StatusText status={transaction.status}>
                        {tTransactions(transaction.status)}
                        {transaction.autoConverted && transaction.status === "settled" && (
                          <Typography component="span" sx={{ fontSize: "11px", fontFamily: "var(--font-sans)", color: "#1565C0", ml: 0.5 }}>
                            · Converted
                          </Typography>
                        )}
                      </StatusText>
                    </StatusBadge>
                  </TransactionsTableCell>
                </TransactionsTableRow>
              ))
            )}
          </TransactionsTableBody>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        maxHeight: "fit-content",
        p: isMobile ? 0 : "0px",
      }}
    >
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
