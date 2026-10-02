import CustomButton from "@/Components/UI/Buttons";
import { Box, Drawer, IconButton, Typography, useTheme } from "@mui/material";
import { Icon, MONO } from "@/styles/uiKit";
import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import HashIcon from "@/assets/Icons/hash-icon.svg";
import RightArrowIcon from "@/assets/Icons/right-arrow-icon.svg";
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

import InputField from "@/Components/UI/AuthLayout/InputFields";
import Toast from "@/Components/UI/Toast";
import useIsMobile from "@/hooks/useIsMobile";
import { useDisplayFx } from "@/hooks/useDisplayFx";
import axiosBaseApi from "@/axiosConfig";
import { TransactionDetailsModalProps } from "@/utils/types/transaction";
import TransactionStatusBadge from "@/Components/UI/TransactionStatusBadge";
import {
  ActionButtonGroup,
  DetailRow,
  ExplorerButton,
  HashRow,
  HeaderTitleRow,
  SectionDivider,
  SectionTitle,
  SectionTitleWithIcon,
  TitleColumn,
  TitleLabel,
  TitleValue,
  WebhookResponseBox,
} from "./TransactionDetailsModal.styled";
import { CryptoIconChip } from "./styled";
import { AutoConvertPayoutRow } from "./AutoConvertPayoutRow";
import TxResolveActions from "./TxResolveActions";
import TxStatusTimeline from "./TxStatusTimeline";
import { explorerTxUrl } from "@/helpers/explorerUrl";
import CopyInline from "@/Components/UX/CopyInline";
import { API_ENDPOINTS } from "@/api/endpoints";
import { toFixedStr } from "@/utils/money";
import { formatLocaleNumber } from "@/utils/locale";
import { formatDisplayDateTime } from "@/helpers/displayDate";
import { isSyntheticCustomer } from "@/utils/txDisplay";

const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  open,
  onClose,
  transaction,
  event = null,
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

  // Read-time NETWORK-FEE estimate. Gas is deducted on-chain for every
  // settlement but is not stored on the row, so the details endpoint returns a
  // live estimate when none is persisted. Fetched lazily on open so a settled
  // payment always shows the network fee — even when the platform fee was fully
  // covered by referral credit (network fee is paid by everyone regardless).
  const [estNetworkFeeUsd, setEstNetworkFeeUsd] = useState<number | null>(null);

  useEffect(() => {
    setEstNetworkFeeUsd(null);
    if (!open || !transaction?.id) return;
    const tx = transaction;
    // Skip when a real network fee is already persisted on the row.
    if (Number(tx.feesBreakdown?.blockchain) > 0) return;
    // Gas is only paid once a payment actually settles on-chain.
    const s = String(tx.status || "").toLowerCase();
    const settled =
      ["settled", "confirmed", "completed", "success", "successful", "paid", "converted", "recovered", "payout_complete", "done"].includes(s) ||
      Boolean(tx.outgoingTransactionId);
    if (!settled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosBaseApi.get(API_ENDPOINTS.transactions.detail(tx.id));
        const est = Number(res?.data?.data?.network_fee_estimated_usd) || 0;
        if (!cancelled && est > 0) setEstNetworkFeeUsd(est);
      } catch {
        /* estimate is best-effort; ignore failures */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id]);

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

  // The CopyInline tick is the success confirmation; the toast only reports failures.
  const onCopied = (ok: boolean) => {
    if (ok) return;
    setOpenToast(false);
    setTimeout(() => setOpenToast(true), 0);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setOpenToast(false), 2000);
  };
  const copySx = {
    [theme.breakpoints.down("md")]: { width: 44, height: 44 },
  };

  const handleViewOnExplorer = (txHash?: string) => {
    const hash = txHash || transaction.incomingTransactionId || transaction.id;
    if (!hash) return;
    const url = explorerTxUrl(transaction.crypto, hash);
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

  // ── Settlement / receipt state (support session df0936d9) ────────────────
  // A "pending" payment with NO on-chain incoming hash means nothing has been
  // received yet, so we must never imply funds were "Settled To" the merchant's
  // wallet. Only treat it as settled when there is real on-chain movement.
  const _status = String(transaction.status || "").toLowerCase();
  const isSettledState = [
    "settled", "confirmed", "completed", "success", "successful",
    "paid", "converted", "recovered", "payout_complete", "done",
  ].includes(_status);
  const hasIncoming = Boolean(transaction.incomingTransactionId);
  const hasOutgoing = Boolean(transaction.outgoingTransactionId);
  const isSettled = isSettledState || hasOutgoing;

  // ── Notification event snapshot (2026-10-01) ─────────────────────────────
  // Opened from a notification → show what THAT event reported. Detection-stage
  // snapshots (detected / confirming / short payment) never show settlement-only
  // things (fees, payout, invoice, resolve actions) — those happened later.
  const isDetectionEvent = !!event && ["detected", "confirming", "partial", "partial_expired"].includes(event.kind);
  const eventTimeLabel = (() => {
    switch (event?.kind) {
      case "detected": return tTransactions("eventDetectedAt", { defaultValue: "Detected at" });
      case "confirming": return tTransactions("eventConfirmingAt", { defaultValue: "Confirmation update at" });
      case "partial": return tTransactions("eventPartialAt", { defaultValue: "Short payment detected at" });
      case "partial_expired": return tTransactions("eventProcessedAt", { defaultValue: "Processed at" });
      case "overpaid": return tTransactions("eventOverpaidAt", { defaultValue: "Overpayment recorded at" });
      case "confirmed": return tTransactions("eventConfirmedAt", { defaultValue: "Confirmed at" });
      case "settled": return tTransactions("eventSettledAt", { defaultValue: "Settled at" });
      default: return tTransactions("dateTime");
    }
  })();
  const showCurrentStatus = !!event?.currentStatus && event.currentStatus !== transaction.status;

  // Estimated network fee to fold into the totals (only when nothing persisted).
  const estNetForTotal =
    estNetworkFeeUsd != null && estNetworkFeeUsd > 0 && !(Number(transaction.feesBreakdown?.blockchain) > 0)
      ? estNetworkFeeUsd
      : 0;
  const totalFeesDisplay = (Number(transaction.fees) || 0) + estNetForTotal;


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
            <Box component="span" data-testid="tx-modal-title">
              {event?.title || tTransactions("transactionDetails")}
            </Box>
          </Typography>
          <TransactionStatusBadge
            status={transaction.status}
            autoConverted={transaction.autoConverted}
            variant="pill"
            data-testid="tx-modal-status"
          />
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
                <TitleLabel data-testid="tx-detail-time-label">{event ? eventTimeLabel : tTransactions("dateTime")}</TitleLabel>
                <TitleValue data-testid="tx-detail-time">{transaction.dateTime}</TitleValue>
              </TitleColumn>
            </HeaderTitleRow>
          </Box>
          {event?.checkoutOpenedAt && (
            <DetailRow data-testid="tx-event-checkout-opened" sx={{ mt: isMobile ? 1.25 : 1.75 }}>
              <TitleLabel>{tTransactions("checkoutOpened", { defaultValue: "Checkout opened" })}</TitleLabel>
              <TitleValue data-testid="tx-event-checkout-opened-value">{event.checkoutOpenedLabel || formatDisplayDateTime(event.checkoutOpenedAt)}</TitleValue>
            </DetailRow>
          )}
          {event && (
            <Box
              data-testid="tx-event-snapshot"
              sx={{
                mt: isMobile ? 1.25 : 1.75,
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
                px: 1.5,
                py: 1,
                borderRadius: "10px",
                backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(10,10,15,0.035)",
              }}
            >
              <Box sx={{ display: "flex", color: theme.palette.text.secondary }}>
                <Icon name="clock" size={14} />
              </Box>
              <Typography sx={{ flex: 1, minWidth: 160, fontSize: 12.5, lineHeight: 1.45, color: theme.palette.text.secondary }}>
                {tTransactions("eventSnapshotNote", { defaultValue: "Details as of this notification." })}
              </Typography>
              {showCurrentStatus && (
                <Box data-testid="tx-event-current-status" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, color: theme.palette.text.secondary }}>
                    {tTransactions("eventCurrentStatus", { defaultValue: "Now:" })}
                  </Typography>
                  <TransactionStatusBadge status={event.currentStatus as string} variant="pill" />
                </Box>
              )}
            </Box>
          )}
          {/* Trace which payment link produced this payment, and when that link
              was created. Shown only for link-backed sources (payment link /
              tip / donation) — see resolveTransactionSource.link_created_at. */}
          {transaction.source?.link_created_at &&
            ["payment_link", "tip", "contribution"].includes(
              transaction.source.type,
            ) && (
              <DetailRow data-testid="tx-detail-link-created" sx={{ mt: isMobile ? 1.25 : 1.75 }}>
                <TitleLabel>
                  {transaction.source.type === "tip"
                    ? tTransactions("tipLinkCreated", { defaultValue: "Tip link created" })
                    : transaction.source.type === "contribution"
                      ? tTransactions("donationLinkCreated", { defaultValue: "Donation link created" })
                      : tTransactions("paymentLinkCreated", { defaultValue: "Payment link created" })}
                </TitleLabel>
                <TitleValue data-testid="tx-detail-link-created-value">
                  {formatDisplayDateTime(transaction.source.link_created_at)}
                </TitleValue>
              </DetailRow>
            )}
          <SectionDivider />

          {/* State-specific status banner + progress rail (awaiting → confirming
              → confirmed → settled). Replaces the old awaiting-only notice so the
              drawer clearly distinguishes each state — especially when opened from
              a notification. */}
          <TxStatusTimeline
            status={transaction.status}
            autoConverted={transaction.autoConverted}
            confirmations={transaction.confirmations}
            hasIncoming={hasIncoming}
            hasOutgoing={hasOutgoing}
            isMobile={isMobile}
          />


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
                <TitleLabel>
                  {event?.kind === "detected"
                    ? tTransactions("amountDetected", { defaultValue: "Amount detected" })
                    : event?.kind === "partial" || event?.kind === "partial_expired"
                      ? tTransactions("amountRequested", { defaultValue: "Amount requested" })
                      : event?.kind === "settled"
                        ? tTransactions("amountPaid", { defaultValue: "Amount paid" })
                        : tTransactions("amount")}
                </TitleLabel>
                <TitleValue data-testid="tx-detail-amount">{transaction.amount}</TitleValue>
              </DetailRow>
              {event?.netAmount && (
                <DetailRow data-testid="tx-event-net">
                  <TitleLabel>{tTransactions("creditedToYou", { defaultValue: "Credited to you" })}</TitleLabel>
                  <TitleValue sx={{ color: "#10B981", fontWeight: 600 }}>{event.netAmount}</TitleValue>
                </DetailRow>
              )}
              {event?.excessAmount && (
                <DetailRow data-testid="tx-event-excess">
                  <TitleLabel>{tTransactions("overpaidBy", { defaultValue: "Overpaid by" })}</TitleLabel>
                  <TitleValue sx={{ fontWeight: 600 }}>{event.excessAmount}</TitleValue>
                </DetailRow>
              )}
              {event?.receivingAddress && (
                <DetailRow data-testid="tx-event-address">
                  <TitleLabel>{tTransactions("receivingAddress", { defaultValue: "Receiving address" })}</TitleLabel>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                    <TitleValue title={event.receivingAddress} sx={{ fontFamily: "var(--font-mono, monospace)" }}>
                      {event.receivingAddress.length > 16
                        ? `${event.receivingAddress.slice(0, 8)}…${event.receivingAddress.slice(-6)}`
                        : event.receivingAddress}
                    </TitleValue>
                    <CopyInline value={event.receivingAddress} size={14} onCopied={onCopied} testId="tx-event-copy-address" />
                  </Box>
                </DetailRow>
              )}
              {event?.estimatedTime && (
                <DetailRow data-testid="tx-event-eta">
                  <TitleLabel>{tTransactions("estimatedConfirmation", { defaultValue: "Estimated confirmation" })}</TitleLabel>
                  <TitleValue>{event.estimatedTime}</TitleValue>
                </DetailRow>
              )}
              {transaction.status === "underpaid" && (transaction as any).receivedAmountRaw != null && (
                <>
                  <DetailRow>
                    <TitleLabel>{tTransactions("amountReceived", { defaultValue: "Amount received" })}</TitleLabel>
                    <TitleValue data-testid="tx-detail-received" sx={{ color: "#C2410C", fontWeight: 600 }}>
                      {`${toFixedStr(Number((transaction as any).receivedAmountRaw), 8).replace(/\.?0+$/, "") || "0"} ${transaction.crypto}`}
                    </TitleValue>
                  </DetailRow>
                  <DetailRow>
                    <TitleLabel>{tTransactions("remaining", { defaultValue: "Remaining" })}</TitleLabel>
                    <TitleValue data-testid="tx-detail-remaining" sx={{ color: "#C2410C", fontWeight: 700 }}>
                      {(() => {
                        const remaining = (transaction as any).remainingAmountRaw != null
                          ? Number((transaction as any).remainingAmountRaw)
                          : Math.max(0, (Number(transaction.cryptoAmountRaw) || 0) - Number((transaction as any).receivedAmountRaw));
                        return `${toFixedStr(remaining, 8).replace(/\.?0+$/, "") || "0"} ${transaction.crypto}`;
                      })()}
                    </TitleValue>
                  </DetailRow>
                </>
              )}
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
                  <TitleLabel>{tTransactions("taxLabel", { defaultValue: "Tax" })}</TitleLabel>
                  <TitleValue>{tTransactions("reverseCharge")} (0%)</TitleValue>
                </DetailRow>
              ) : Number(transaction.taxAmount) > 0 ? (
                <DetailRow>
                  <TitleLabel>
                    {`${transaction.taxLabel || "VAT"}${
                      transaction.taxRate != null ? ` (${Number(transaction.taxRate)}%)` : ""
                    }`}
                  </TitleLabel>
                  <TitleValue>
                    {formatLocaleNumber(Number(transaction.taxAmount), 2)}
                  </TitleValue>
                </DetailRow>
              ) : null}
              {transaction.customerVatId && (
                <DetailRow>
                  <TitleLabel>{tTransactions("customerVatId", { defaultValue: "Customer VAT ID" })}</TitleLabel>
                  <TitleValue>{transaction.customerVatId}</TitleValue>
                </DetailRow>
              )}
              {isSyntheticCustomer(transaction.customerName, transaction.customerEmail) ? (
                <DetailRow>
                  <TitleLabel>{tTransactions("customer", { defaultValue: "Customer" })}</TitleLabel>
                  <TitleValue data-testid="tx-detail-customer" sx={{ textAlign: "right", minWidth: 0 }}>
                    {tTransactions("viaApi", { defaultValue: "via API" })}
                  </TitleValue>
                </DetailRow>
              ) : (transaction.customerName || transaction.customerEmail) && (
                <DetailRow>
                  <TitleLabel>{tTransactions("customer", { defaultValue: "Customer" })}</TitleLabel>
                  <TitleValue data-testid="tx-detail-customer" sx={{ textAlign: "right", minWidth: 0 }}>
                    {transaction.customerName || transaction.customerEmail}
                    {transaction.customerName && transaction.customerEmail && (
                      <Typography component="span" sx={{ display: "block", fontSize: 12, color: theme.palette.text.secondary, fontWeight: 400 }}>
                        {transaction.customerEmail}
                      </Typography>
                    )}
                  </TitleValue>
                </DetailRow>
              )}
              {(Number(transaction.fees) > 0 || estNetForTotal > 0 || (transaction.feesBreakdown && (transaction.feesBreakdown.platform > 0 || transaction.feesBreakdown.blockchain > 0 || transaction.feesBreakdown.fixed > 0))) && (
                <>
                  {transaction.feesBreakdown && transaction.feesBreakdown.platform > 0 && (
                    <DetailRow data-testid="tx-fee-platform">
                      <TitleLabel sx={{ pl: 1.5, fontWeight: 400 }}>{tTransactions("platformFee", { defaultValue: "Platform fee" })}</TitleLabel>
                      <TitleValue sx={{ fontWeight: 400 }}>
                        {fx.formatFromUsd(transaction.feesBreakdown.platform) ?? `$${toFixedStr(transaction.feesBreakdown.platform, 2)}`}
                      </TitleValue>
                    </DetailRow>
                  )}
                  {transaction.feesBreakdown && transaction.feesBreakdown.blockchain > 0 && (
                    <DetailRow data-testid="tx-fee-network">
                      <TitleLabel sx={{ pl: 1.5, fontWeight: 400 }}>{tTransactions("networkFee", { defaultValue: "Network fee" })}</TitleLabel>
                      <TitleValue sx={{ fontWeight: 400 }}>
                        {fx.formatFromUsd(transaction.feesBreakdown.blockchain) ?? `$${toFixedStr(transaction.feesBreakdown.blockchain, 2)}`}
                      </TitleValue>
                    </DetailRow>
                  )}
                  {estNetForTotal > 0 && (
                    <DetailRow data-testid="tx-fee-network-est">
                      <TitleLabel sx={{ pl: 1.5, fontWeight: 400 }}>{tTransactions("networkFeeEstimated", { defaultValue: "Network fee (est.)" })}</TitleLabel>
                      <TitleValue sx={{ fontWeight: 400 }}>
                        {`~ ${fx.formatFromUsd(estNetForTotal) ?? `$${toFixedStr(estNetForTotal, 2)}`}`}
                      </TitleValue>
                    </DetailRow>
                  )}
                  {transaction.feesBreakdown && transaction.feesBreakdown.fixed > 0 && (
                    <DetailRow data-testid="tx-fee-fixed">
                      <TitleLabel sx={{ pl: 1.5, fontWeight: 400 }}>{tTransactions("fixedFee", { defaultValue: "Fixed fee" })}</TitleLabel>
                      <TitleValue sx={{ fontWeight: 400 }}>
                        {fx.formatFromUsd(transaction.feesBreakdown.fixed) ?? `$${toFixedStr(transaction.feesBreakdown.fixed, 2)}`}
                      </TitleValue>
                    </DetailRow>
                  )}
                  <DetailRow data-testid="tx-fee-total">
                    <TitleLabel>{tTransactions("totalFees")}</TitleLabel>
                    <TitleValue>
                      {`${estNetForTotal > 0 ? "~ " : ""}${fx.formatFromUsd(totalFeesDisplay) ?? `$${toFixedStr(totalFeesDisplay, 2)}`}`}
                    </TitleValue>
                  </DetailRow>
                  <DetailRow>
                    <TitleLabel>{tTransactions("amountReceived")}</TitleLabel>
                    <TitleValue sx={{ color: "#10B981", fontWeight: 600 }}>
                      {fx.formatFromUsd(
                        (Number(transaction.usdValueRaw) || 0) - totalFeesDisplay,
                      ) ?? `$${toFixedStr(((Number(transaction.usdValueRaw) || 0) - totalFeesDisplay), 2)}`}
                    </TitleValue>
                  </DetailRow>
                </>
              )}
              {Number(transaction.referralCreditUsd) > 0 && (
                <DetailRow>
                  <TitleLabel>{tTransactions("feeCoveredByCredit", { defaultValue: "Referral credit applied" })}</TitleLabel>
                  <TitleValue sx={{ color: "#10B981", fontWeight: 600 }}>
                    {`\u2212 ${fx.formatFromUsd(Number(transaction.referralCreditUsd)) ?? `$${toFixedStr(transaction.referralCreditUsd, 2)}`}`}
                  </TitleValue>
                </DetailRow>
              )}
              {transaction.autoConvert && (
                <DetailRow data-testid="tx-payout-amount-row">
                  <TitleLabel>{tTransactions("paidOutAs", { defaultValue: "Paid out as" })}</TitleLabel>
                  <TitleValue sx={{ fontWeight: 600 }} data-testid="tx-payout-amount">
                    {transaction.autoConvert.status === "COMPLETED" && transaction.autoConvert.merchantPayoutUsd != null
                      ? `${toFixedStr(transaction.autoConvert.merchantPayoutUsd, 2)} ${transaction.autoConvert.targetCurrency}${transaction.autoConvert.settlementChain ? ` (${transaction.autoConvert.settlementChain})` : ""}`
                      : transaction.autoConvert.status === "FAILED"
                        ? tTransactions("payoutFailedShort", { defaultValue: "Conversion failed — manual settlement" })
                        : tTransactions("payoutPendingShort", { defaultValue: "Converting to {{to}}…", to: transaction.autoConvert.targetCurrency })}
                  </TitleValue>
                </DetailRow>
              )}
              {transaction.confirmations && (
                <DetailRow>
                  <TitleLabel>{tTransactions("confirmations")}</TitleLabel>
                  <TitleValue>{transaction.confirmations}</TitleValue>
                </DetailRow>
              )}
              {transaction.settlementAddress && (
                <DetailRow>
                  <TitleLabel>
                    {isSettled
                      ? tTransactions("settledTo")
                      : tTransactions("settlementWallet", {
                          defaultValue: "Settlement address",
                        })}
                  </TitleLabel>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <TitleValue sx={{ fontSize: isMobile ? "13px" : "15px" }}>
                      {`${transaction.settlementAddress.slice(0, 6)}...${transaction.settlementAddress.slice(-4)}`}
                    </TitleValue>
                    <CopyInline
                      variant="boxed"
                      value={transaction.settlementAddress}
                      size={isMobile ? 14 : 16}
                      onCopied={onCopied}
                      testId="tx-copy-settlement-address"
                      sx={{ width: 32, height: 32, [theme.breakpoints.down("md")]: { width: 36, height: 36 } }}
                    />
                  </Box>
                </DetailRow>
              )}
              {transaction.settlementAddress && !isSettled && (
                <Typography
                  sx={{
                    fontSize: 11.5,
                    color: theme.palette.text.secondary,
                    lineHeight: "16px",
                    mt: "-4px",
                  }}
                >
                  {tTransactions("settlementWalletHint", {
                    defaultValue:
                      "Funds are sent here only after the payment is received and confirmed on-chain.",
                  })}
                </Typography>
              )}
            </Box>
          </Box>
          <SectionDivider />

          {(transaction.incomingTransactionId ||
            transaction.outgoingTransactionId ||
            transaction.autoConvert) && (
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
                          <CopyInline
                            variant="boxed"
                            value={transaction.incomingTransactionId}
                            size={isMobile ? 14 : 16}
                            onCopied={onCopied}
                            testId="tx-copy-incoming-hash"
                            sx={copySx}
                          />
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
                  {transaction.autoConvert ? (
                    <AutoConvertPayoutRow
                      info={transaction.autoConvert}
                      isMobile={isMobile}
                      onCopied={onCopied}
                      copySx={copySx}
                    />
                  ) : transaction.outgoingTransactionId && (
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
                          <CopyInline
                            variant="boxed"
                            value={transaction.outgoingTransactionId}
                            size={isMobile ? 14 : 16}
                            onCopied={onCopied}
                            testId="tx-copy-outgoing-hash"
                            sx={copySx}
                          />
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
                      <CopyInline
                        variant="boxed"
                        value={transaction.callbackUrl}
                        size={isMobile ? 14 : 16}
                        onCopied={onCopied}
                        testId="tx-copy-callback-url"
                        sx={copySx}
                      />
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

          {!isDetectionEvent && <TxResolveActions transaction={transaction} />}

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
            {!isDetectionEvent && (transaction?.status === "settled" || transaction?.status === "confirmed") && (
              <CustomButton
                label={tTransactions("invoice")}
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
        message={t("copyFailed", { ns: "common", defaultValue: "Couldn't copy — please copy it manually" })}
        severity="error"
      />
    </>
  );
};

export default TransactionDetailsModal;
