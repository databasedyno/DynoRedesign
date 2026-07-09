import BitcoinIcon from "@/assets/cryptocurrency/Bitcoin-icon.svg";
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
import { ArrowOutward as ArrowOutwardIcon } from "@mui/icons-material";
import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
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

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedTransaction(null);
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
      label: tTransactions("usdValue"),
      key: "usdValue",
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

  /** Smart format for USD values — clean, no trailing zeros */
  const formatUsd = (usdValue: any) => {
    const num = parseFloat(String(usdValue).replace(/[$,]/g, ""));
    if (isNaN(num) || num === 0) return "$0.00";
    if (num >= 1) return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (num >= 0.01) return `$${num.toFixed(4).replace(/0+$/, "").replace(/\.$/, ".00")}`;
    return `$${num.toFixed(6).replace(/0+$/, "").replace(/\.$/, ".00")}`;
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
        currentTransactions.map((transaction) => (
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
              <Typography sx={{ fontSize: "16px", fontFamily: "var(--font-sans)", fontWeight: 700, color: theme.palette.text.primary }}>
                {formatAmount(transaction.amount)}
              </Typography>
              <Typography sx={{ fontSize: "14px", fontFamily: "var(--font-sans)", fontWeight: 500, color: theme.palette.primary.main }}>
                {formatUsd(transaction.usdValue)}
              </Typography>
            </Box>
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
        ))
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
                    {transaction.id}
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
                        <ArrowOutwardIcon
                          sx={{
                            fontSize: 16,
                            transform: "rotate(45deg)",
                            color: theme.palette.text.secondary,
                            lineHeight: "100%",
                          }}
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

                  <TransactionsTableCell>
                    {formatAmount(transaction.amount)}
                  </TransactionsTableCell>

                  <TransactionsTableCell>
                    {formatUsd(transaction.usdValue)}
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
              {tTransactions("showingTransactions", {
                count: currentTransactions.length,
                total: transactions.length,
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

      <TransactionDetailsModal
        open={modalOpen}
        onClose={handleCloseModal}
        transaction={selectedTransaction}
      />
    </Box>
  );
};

export default TransactionsTable;
