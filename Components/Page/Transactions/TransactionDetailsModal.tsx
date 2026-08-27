import CustomButton from "@/Components/UI/Buttons";
import CopyIcon from "@/assets/Icons/copy-icon.svg";
import { Box, Drawer, IconButton, Typography, useTheme } from "@mui/material";
import { Icon, MONO } from "@/styles/uiKit";
import Image from "next/image";
import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import CorrectIcon from "@/assets/Icons/correct-icon.png";
import HashIcon from "@/assets/Icons/hash-icon.svg";
import RightArrowIcon from "@/assets/Icons/right-arrow-icon.svg";
import WrongIcon from "@/assets/Icons/wrong-icon.png";
import BNBIcon from "@/assets/cryptocurrency/BNB-icon.svg";
import BitcoinIcon from "@/assets/cryptocurrency/Bitcoin-icon.svg";
import BitcoinCashIcon from "@/assets/cryptocurrency/BitcoinCash-icon.svg";
import DogecoinIcon from "@/assets/cryptocurrency/Dogecoin-icon.svg";
import EthereumIcon from "@/assets/cryptocurrency/Ethereum-icon.svg";
import LitecoinIcon from "@/assets/cryptocurrency/Litecoin-icon.svg";
import TronIcon from "@/assets/cryptocurrency/Tron-icon.svg";
import USDTIcon from "@/assets/cryptocurrency/USDT-icon.svg";
import USDCIcon from "@/assets/cryptocurrency/USDC-icon.svg";

import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import TransactionIcon from "@/assets/Icons/transaction-icon.svg";

import InputField from "@/Components/UI/AuthLayout/InputFields";
import Toast from "@/Components/UI/Toast";
import useIsMobile from "@/hooks/useIsMobile";
import { useDisplayFx } from "@/hooks/useDisplayFx";
import axiosBaseApi from "@/axiosConfig";
import { HourGlassIcon } from "@/utils/customIcons";
import { TransactionDetailsModalProps } from "@/utils/types/transaction";
import {
  ActionButtonGroup,
  CopyButton,
  DetailRow,
  ExplorerButton,
  HashRow,
  HeaderTitleRow,
  SectionDivider,
  SectionTitle,
  SectionTitleWithIcon,
  StatusBadge,
  StatusIconWrapper,
  StatusText,
  TitleColumn,
  TitleLabel,
  TitleValue,
  WebhookResponseBox,
} from "./TransactionDetailsModal.styled";
import { CryptoIconChip } from "./styled";
import copyToClipboard from "@/helpers/copyToClipboard";
import { API_ENDPOINTS } from "@/api/endpoints";

const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  open,
  onClose,
  transaction,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("transactions");
  const tTransactions = useCallback(
    (key: string, options?: any): string => {
      const result = t(key, { ns: "transactions", ...options });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );
  const [openToast, setOpenToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fx = useDisplayFx();

  if (!transaction) return null;

  const getCryptoIcon = (crypto: string) => {
    const normalized = crypto?.toUpperCase() || "";
    if (normalized === "BTC") return BitcoinIcon;
    if (normalized === "ETH") return EthereumIcon;
    if (normalized === "LTC") return LitecoinIcon;
    if (normalized === "DOGE") return DogecoinIcon;
    if (normalized === "BCH") return BitcoinCashIcon;
    if (normalized === "TRX") return TronIcon;
    if (normalized === "BNB") return BNBIcon;
    if (normalized.includes("USDC")) return USDCIcon;
    if (normalized.includes("USDT")) return USDTIcon;
    return BitcoinIcon;
  };

  const getStatusIcon = (status: "pending" | "confirmed" | "settled" | "failed" | "processing" | "unpaid" | "awaiting_payment") => {
    switch (status) {
      case "settled":
        return <Image src={CorrectIcon} alt="correct" draggable={false} />;
      case "confirmed":
        return <Image src={CorrectIcon} alt="confirmed" draggable={false} />;
      case "pending":
      case "processing":
        return <HourGlassIcon fill={"#F57C00"} size={isMobile ? 12 : 16} />;
      case "unpaid":
      case "awaiting_payment":
        return <HourGlassIcon fill={"#9CA3AF"} size={isMobile ? 12 : 16} />;
      case "failed":
        return <Image src={WrongIcon} alt="incorrect" draggable={false} />;
    }
  };

  const handleCopy = (text: string) => {
    copyToClipboard(text);

    setOpenToast(false);

    setTimeout(() => {
      setOpenToast(true);
    }, 0);

    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    toastTimer.current = setTimeout(() => {
      setOpenToast(false);
    }, 2000);
  };

  const getBlockchairUrl = (crypto: string, txHash: string): string => {
    const chainMap: Record<string, string> = {
      BTC: "bitcoin",
      ETH: "ethereum",
      LTC: "litecoin",
      DOGE: "dogecoin",
      BCH: "bitcoin-cash",
      SOL: "solana",
      XRP: "ripple",
      POLYGON: "polygon",
      BNB: "bnb",
    };
    // TRC20 tokens use Tronscan (better support than Blockchair for TRON)
    const upperCrypto = crypto.toUpperCase();
    if (upperCrypto.includes("TRC20") || upperCrypto === "TRX") {
      return `https://tronscan.org/#/transaction/${txHash}`;
    }
    // ERC20 tokens use Ethereum explorer
    if (upperCrypto.includes("ERC20") || upperCrypto.includes("RLUSD-ERC20")) {
      return `https://blockchair.com/ethereum/transaction/${txHash}`;
    }
    // USDT-POLYGON uses Polygon explorer
    if (upperCrypto.includes("POLYGON")) {
      return `https://blockchair.com/polygon/transaction/${txHash}`;
    }
    const chain = chainMap[upperCrypto] || "bitcoin";
    return `https://blockchair.com/${chain}/transaction/${txHash}`;
  };

  const handleViewOnExplorer = (txHash?: string) => {
    const hash = txHash || transaction.incomingTransactionId || transaction.id;
    if (!hash) return;
    const url = getBlockchairUrl(transaction.crypto, hash);
    window.open(url, "_blank");
  };

  const handleDownloadInvoice = async () => {
    if (!transaction) return;
    try {
      // Step 1: Get invoice data (JSON) to get invoice_id
      const jsonRes = await axiosBaseApi.get(
        API_ENDPOINTS.transactions.invoice(transaction.id)
      );

      const invoiceData = jsonRes?.data?.data;
      if (!invoiceData?.invoice_id) {
        console.error("No invoice found for this transaction");
        return;
      }

      // Step 2: Download PDF using the invoice_id
      const pdfRes = await axiosBaseApi.get(
        API_ENDPOINTS.invoices.pdf(invoiceData.invoice_id),
        { responseType: "blob" }
      );

      if (pdfRes.data && pdfRes.data.size > 0) {
        const url = window.URL.createObjectURL(
          new Blob([pdfRes.data], { type: "application/pdf" })
        );
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `invoice-${invoiceData.invoice_number || invoiceData.invoice_id}.pdf`
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Invoice not available for this transaction", err);
    }
  };

  return (
    <>
      {/* Side drawer (design audit 2026-08-05, Phase 3 transactions polish).
          Was previously a centered dialog via `<PopupModal>` — the modal
          blocked the transactions table beneath so it wasn't possible to
          click through a list of transactions in sequence. As a right-side
          drawer the table stays in view, keyboard focus is preserved, and
          the escape/back-tap gesture on mobile closes it naturally. */}
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        keepMounted={false}
        transitionDuration={{ enter: 260, exit: 200 }}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 460, md: 520 },
            maxWidth: "100%",
            bgcolor: theme.palette.background.paper,
            borderLeft: `1px solid ${theme.palette.border?.main || "rgba(10,10,15,0.08)"}`,
            backgroundImage: "none",
            display: "flex",
            flexDirection: "column",
          },
        }}
        BackdropProps={{
          sx: {
            backgroundColor: theme.palette.mode === "dark"
              ? "rgba(0,0,0,0.55)"
              : "rgba(10,10,15,0.35)",
            backdropFilter: "blur(2px)",
          },
        }}
      >
        {/* Sticky drawer header — title + status badge + close */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            padding: theme.spacing(2.5, 3, 2, 3),
            borderBottom: `1px solid ${theme.palette.border?.main || "rgba(10,10,15,0.08)"}`,
            flexShrink: 0,
          }}
        >
          <Typography
            component="h2"
            sx={{
              flex: 1,
              minWidth: 0,
              fontFamily: "var(--font-hero), var(--font-body)",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: theme.palette.text.primary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {tTransactions("transactionDetails")}
          </Typography>
          <StatusBadge status={transaction.status}>
            <StatusIconWrapper>
              {getStatusIcon(transaction.status)}
            </StatusIconWrapper>
            <StatusText status={transaction.status}>
              {tTransactions(transaction.status)}
            </StatusText>
          </StatusBadge>
          <IconButton
            onClick={onClose}
            aria-label="Close transaction details"
            size="small"
            sx={{
              color: theme.palette.text.secondary,
              "&:hover": { color: theme.palette.text.primary, backgroundColor: theme.palette.action.hover },
            }}
          >
            <Icon name="x" size={18} />
          </IconButton>
        </Box>

        {/* Scrollable body */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile
              ? theme.spacing(2)
              : theme.spacing(3),
          }}
        >
          <Box>
            <HeaderTitleRow>
              <TitleColumn>
                <TitleLabel>{tTransactions("transactionId")}</TitleLabel>
                <TitleValue>{transaction.id}</TitleValue>
              </TitleColumn>
              <TitleColumn>
                <TitleLabel>{tTransactions("dateTime")}</TitleLabel>
                <TitleValue>{transaction.dateTime}</TitleValue>
              </TitleColumn>
            </HeaderTitleRow>
          </Box>
          <SectionDivider />

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "10px" : "20px",
            }}
          >
            <SectionTitleWithIcon>
              <Image
                src={RoundedStackIcon}
                alt="Amount Details"
                width={15}
                height={15}
                draggable={false}
              />
              <SectionTitle>{tTransactions("amountDetails")}</SectionTitle>
            </SectionTitleWithIcon>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? "8px" : "14px",
              }}
            >
              <DetailRow>
                <TitleLabel>{tTransactions("cryptocurrency")}</TitleLabel>
                <CryptoIconChip sx={{ width: "fit-content" }}>
                  <Image
                    src={getCryptoIcon(transaction.crypto)}
                    alt={transaction.crypto}
                    draggable={false}
                  />
                  <Typography
                    component={"span"}
                    sx={{
                      color:
                        transaction.crypto === "BTC"
                          ? theme.palette.text.primary
                          : theme.palette.text.secondary,
                    }}
                  >
                    {transaction.crypto}
                  </Typography>
                </CryptoIconChip>
              </DetailRow>
              <DetailRow>
                <TitleLabel>{tTransactions("amount")}</TitleLabel>
                <TitleValue>{transaction.amount}</TitleValue>
              </DetailRow>
              <DetailRow>
                <TitleLabel>
                  {fx.currency && fx.currency !== "USD"
                    ? `${tTransactions("value", { defaultValue: "Value" })} (${fx.currency})`
                    : tTransactions("usdValue")}
                </TitleLabel>
                <TitleValue data-testid="tx-detail-fiat-value">
                  {!transaction.usdValueRaw || Number(transaction.usdValueRaw) <= 0
                    ? "—"
                    : fx.formatFromUsd(transaction.usdValueRaw) ?? transaction.usdValue}
                </TitleValue>
              </DetailRow>
              {transaction.reverseCharge ? (
                <DetailRow>
                  <TitleLabel>Tax</TitleLabel>
                  <TitleValue>Reverse-charge (0%)</TitleValue>
                </DetailRow>
              ) : Number(transaction.taxAmount) > 0 ? (
                <DetailRow>
                  <TitleLabel>
                    {`${transaction.taxLabel || "VAT"}${
                      transaction.taxRate != null ? ` (${Number(transaction.taxRate)}%)` : ""
                    }`}
                  </TitleLabel>
                  <TitleValue>
                    {Number(transaction.taxAmount).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TitleValue>
                </DetailRow>
              ) : null}
              {transaction.customerVatId && (
                <DetailRow>
                  <TitleLabel>Customer VAT ID</TitleLabel>
                  <TitleValue>{transaction.customerVatId}</TitleValue>
                </DetailRow>
              )}
              {(Number(transaction.fees) > 0 || (transaction.feesBreakdown && (transaction.feesBreakdown.platform > 0 || transaction.feesBreakdown.blockchain > 0))) && (
                <>
                  <DetailRow>
                    <TitleLabel>{tTransactions("totalFees")}</TitleLabel>
                    <TitleValue>
                      {fx.formatFromUsd(Number(transaction.fees) || 0) ?? `$${Number(transaction.fees).toFixed(2)}`}
                    </TitleValue>
                  </DetailRow>
                  <DetailRow>
                    <TitleLabel>{tTransactions("amountReceived")}</TitleLabel>
                    <TitleValue sx={{ color: "#10B981", fontWeight: 600 }}>
                      {fx.formatFromUsd(
                        (Number(transaction.usdValueRaw) || 0) - (Number(transaction.fees) || 0),
                      ) ?? `$${((Number(transaction.usdValueRaw) || 0) - (Number(transaction.fees) || 0)).toFixed(2)}`}
                    </TitleValue>
                  </DetailRow>
                </>
              )}
              {transaction.confirmations && (
                <DetailRow>
                  <TitleLabel>{tTransactions("confirmations")}</TitleLabel>
                  <TitleValue>{transaction.confirmations}</TitleValue>
                </DetailRow>
              )}
              {transaction.settlementAddress && (
                <DetailRow>
                  <TitleLabel>{tTransactions("settledTo")}</TitleLabel>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <TitleValue sx={{ fontSize: isMobile ? "13px" : "15px" }}>
                      {`${transaction.settlementAddress.slice(0, 6)}...${transaction.settlementAddress.slice(-4)}`}
                    </TitleValue>
                    <CopyButton
                      onClick={() => handleCopy(transaction.settlementAddress!)}
                      title={tTransactions("copy")}
                    >
                      <Image
                        src={CopyIcon}
                        alt="Copy"
                        width={isMobile ? 12 : 16}
                        height={isMobile ? 12 : 16}
                        draggable={false}
                      />
                    </CopyButton>
                  </Box>
                </DetailRow>
              )}
            </Box>
          </Box>
          <SectionDivider />

          {(transaction.incomingTransactionId ||
            transaction.outgoingTransactionId) && (
            <>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: isMobile ? "10px" : "20px",
                }}
              >
                <SectionTitleWithIcon>
                  <Image
                    src={HashIcon}
                    alt="Transaction Hashes"
                    width={20}
                    height={20}
                    draggable={false}
                  />
                  <SectionTitle>
                    {tTransactions("transactionHashes")}
                  </SectionTitle>
                </SectionTitleWithIcon>
                <Box
                  sx={{ display: "flex", flexDirection: "column", gap: "16px" }}
                >
                  {transaction.incomingTransactionId && (
                    <Box>
                      <HashRow>
                        <InputField
                          value={transaction.incomingTransactionId}
                          readOnly
                          label={
                            <TitleLabel>
                              {tTransactions("incomingTransactionId")}
                            </TitleLabel>
                          }
                          inputHeight={isMobile ? "32px" : "40px"}
                          sx={{
                            gap: isMobile ? "6px" : "12px",
                          }}
                        />
                        <ActionButtonGroup>
                          <CopyButton
                            onClick={() =>
                              handleCopy(transaction.incomingTransactionId!)
                            }
                            title={tTransactions("copy")}
                          >
                            <Image
                              src={CopyIcon}
                              alt="Copy"
                              width={isMobile ? 12 : 16}
                              height={isMobile ? 12 : 16}
                              draggable={false}
                            />
                          </CopyButton>
                          <ExplorerButton
                            onClick={() => handleViewOnExplorer(transaction.incomingTransactionId!)}
                            title={tTransactions("viewOnExplorer")}
                          >
                            <Image
                              src={RightArrowIcon}
                              alt="Right Arrow"
                              width={isMobile ? 12 : 16}
                              height={isMobile ? 12 : 16}
                              draggable={false}
                            />
                          </ExplorerButton>
                        </ActionButtonGroup>
                      </HashRow>
                    </Box>
                  )}
                  {transaction.outgoingTransactionId && (
                    <Box>
                      <HashRow>
                        <InputField
                          value={transaction.outgoingTransactionId}
                          readOnly
                          label={
                            <TitleLabel>
                              {tTransactions("outgoingTransactionId")}
                            </TitleLabel>
                          }
                          inputHeight={isMobile ? "32px" : "40px"}
                          sx={{
                            gap: isMobile ? "6px" : "12px",
                          }}
                        />

                        <ActionButtonGroup>
                          <CopyButton
                            onClick={() =>
                              handleCopy(transaction.outgoingTransactionId!)
                            }
                            title={tTransactions("copy")}
                          >
                            <Image
                              src={CopyIcon}
                              alt="Copy"
                              width={isMobile ? 12 : 16}
                              height={isMobile ? 12 : 16}
                              draggable={false}
                            />
                          </CopyButton>
                          <ExplorerButton
                            onClick={() => handleViewOnExplorer(transaction.outgoingTransactionId!)}
                            title={tTransactions("viewOnExplorer")}
                          >
                            <Image
                              src={RightArrowIcon}
                              alt="Right Arrow"
                              width={isMobile ? 12 : 16}
                              height={isMobile ? 12 : 16}
                              draggable={false}
                            />
                          </ExplorerButton>
                        </ActionButtonGroup>
                      </HashRow>
                    </Box>
                  )}
                </Box>
              </Box>
              <SectionDivider />
            </>
          )}

          {(transaction.callbackUrl || transaction.webhookResponse) && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? "10px" : "20px",
              }}
            >
              <SectionTitle>
                {tTransactions("callbackInformation")}
              </SectionTitle>
              <Box
                sx={{ display: "flex", flexDirection: "column", gap: "16px" }}
              >
                {transaction.callbackUrl && (
                  <Box>
                    <HashRow>
                      <InputField
                        value={transaction.callbackUrl}
                        readOnly
                        label={
                          <TitleLabel>
                            {tTransactions("callbackUrl")}
                          </TitleLabel>
                        }
                        inputHeight={isMobile ? "32px" : "40px"}
                        sx={{
                          gap: isMobile ? "6px" : "12px",
                        }}
                      />
                      <CopyButton
                        onClick={() => handleCopy(transaction.callbackUrl!)}
                        title={tTransactions("copy")}
                      >
                        <Image
                          src={CopyIcon}
                          alt="Copy"
                          width={isMobile ? 12 : 16}
                          height={isMobile ? 12 : 16}
                          draggable={false}
                        />
                      </CopyButton>
                    </HashRow>
                  </Box>
                )}
                {transaction.webhookResponse && (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: isMobile ? "6px" : "12px",
                      scrollbarWidth: "none",
                    }}
                  >
                    <TitleLabel>{tTransactions("webhookResponse")}</TitleLabel>
                    <Box
                      sx={{
                        border: `1px solid ${theme.palette.border.main}`,
                        borderRadius: "6px",
                      }}
                    >
                      <WebhookResponseBox>
                        <pre
                          style={{
                            margin: 0,
                            fontFamily: MONO,
                            fontSize: isMobile ? "10px" : "13px",
                            lineHeight: 1.2,
                            letterSpacing: 0,
                          }}
                        >
                          {JSON.stringify(transaction.webhookResponse, null, 2)}
                        </pre>
                      </WebhookResponseBox>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          )}

          <Box
            sx={{
              display: "flex",
              gap: isMobile ? "12px" : 2.5,
              marginTop: isMobile ? 2 : 3,
            }}
          >
            <CustomButton
              label={tTransactions("close")}
              variant="outlined"
              size="medium"
              onClick={onClose}
              fullWidth
              sx={{
                [theme.breakpoints.down("md")]: {
                  width: "fit-content",
                  flex: 1,
                  height: "32px",
                },
              }}
            />
            {(transaction?.status === "settled" || transaction?.status === "confirmed") && (
              <CustomButton
                label="Invoice"
                startIcon={<Icon name="download" size={16} />}
                variant="outlined"
                size="medium"
                onClick={handleDownloadInvoice}
                fullWidth
                sx={{
                  [theme.breakpoints.down("md")]: {
                    width: "fit-content",
                    flex: 1,
                    height: "32px",
                  },
                }}
              />
            )}
            <CustomButton
              label={tTransactions("viewOnExplorer")}
              variant="primary"
              size="medium"
              onClick={() => handleViewOnExplorer()}
              fullWidth
              sx={{
                [theme.breakpoints.down("md")]: {
                  width: "fit-content",
                  flex: 1,
                  height: "32px",
                },
              }}
            />
          </Box>
        </Box>
      </Drawer>
      <Toast
        open={openToast}
        message={tTransactions("copiedToClipboard")}
        severity="success"
      />
    </>
  );
};

export default TransactionDetailsModal;
