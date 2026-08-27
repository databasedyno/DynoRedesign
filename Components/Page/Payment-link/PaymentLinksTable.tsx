import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePaymentLinks } from "@/hooks/usePaymentLinks";
import {
  FooterText,
  TableBodyCell,
  TableFooter,
  TransactionsTableContainer,
  TransactionsTableScrollWrapper,
} from "./styled";

import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";

import ActionIcon from "@/assets/Icons/Actions.svg";
import CopyIcon from "@/assets/Icons/copy-icon.svg";
import DescriptiontoIcon from "@/assets/Icons/crypto-icon.svg";
import TimeUsedIcon from "@/assets/Icons/cryptocurrency_link.svg";
import CoinChips from "@/Components/UI/CoinChips";
import { StatusDot } from "@/Components/UI/StatusDot";
import { formatDisplayDateTime } from "@/helpers/displayDate";
import TransactionSourceBadge from "@/Components/UI/TransactionSourceBadge";
import CryptoIcon from "@/assets/Icons/CryptoIcon.svg";
import EditIcon from "@/assets/Icons/edit-icon.svg";
import EyeIcon from "@/assets/Icons/eye-icon.svg";
import HexagonIcon from "@/assets/Icons/hexagon-icon.svg";
import TimeIcon from "@/assets/Icons/time-icon.svg";
import TransactionIcon from "@/assets/Icons/transaction-icon.svg";
import TrashIcon from "@/assets/Icons/trash-icon.svg";
import UsdIcon from "@/assets/Icons/USDIcon.svg";

import Image from "next/image";

import { MobileNavigationButtons } from "@/Components/Page/Transactions/styled";
import { MONO } from "@/styles/uiKit";
import CustomButton from "@/Components/UI/Buttons";
import RowsPerPageSelector from "@/Components/UI/RowsPerPageSelector";
import Toast from "@/Components/UI/Toast";
import { copyToClipboard } from "@/helpers/copyToClipboard";
import { useEdgeFades } from "@/Components/Common/ScrollHint";
import useIsMobile from "@/hooks/useIsMobile";
import useTableCardView from "@/hooks/useTableCardView";
import {
  PaymentLinkData,
  PaymentLinksTableProps,
} from "@/utils/types/paymentLink";
import { useRouter } from "next/router";
import PaymentLinkSuccessModal from "../CreatePaymentLink/PaymentLinkSuccessModal";
import { CopyButton } from "../Transactions/TransactionDetailsModal.styled";
import CurrencyExchangeRounded from "@mui/icons-material/CurrencyExchangeRounded";
import CryptoRefundModal from "@/Components/Page/Refund/CryptoRefundModal";
import { useRefundMap, RefundStatusChip } from "@/Components/Page/Refund/refundStatus";

const CRYPTO_REFUNDS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_CRYPTO_REFUNDS === "true";
const isRefundableLinkStatus = (status?: string) =>
  status === "paid" || status === "completed";

const headerIconMap: Record<string, any> = {
  linkIdHeader: TransactionIcon,
  descriptionHeader: DescriptiontoIcon,
  usdValueHeader: UsdIcon,
  cryptoValueHeader: CryptoIcon,
  createdHeader: TimeIcon,
  expiresHeader: TimeIcon,
  statusHeader: HexagonIcon,
  timesUsedHeader: TimeUsedIcon,
  actionsHeader: ActionIcon,
};

const Header = React.memo(({ label, tooltip, align }: { label: string; tooltip?: string; align?: "left" | "right" }) => {
  const { t } = useTranslation("paymentLinks");
  const isMobile = useIsMobile("md");
  const headerTheme = useTheme();
  const content = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        gap: isMobile ? "6px" : "10px",
        cursor: tooltip ? "help" : undefined,
      }}
    >
      {headerIconMap[label] && (
        <Image
          src={headerIconMap[label]}
          alt={label}
          width={isMobile ? 15 : 18}
          height={isMobile ? 15 : 18}
          draggable={false}
          style={{
            marginTop: "-1px",
          }}
          className="themed-icon"
        />
      )}

      <Typography
        sx={{
          fontSize: isMobile ? "10px" : "15px",
          fontWeight: 500,
          fontFamily: "var(--font-sans)",
          lineHeight: 1.2,
          letterSpacing: 0,
          color: headerTheme.palette.text.primary,
          whiteSpace: "nowrap",
        }}
      >
        {t(label)}
      </Typography>
      {tooltip && (
        <InfoOutlinedIcon
          sx={{
            fontSize: isMobile ? 12 : 14,
            color: headerTheme.palette.text.secondary,
            marginTop: "-1px",
          }}
        />
      )}
    </Box>
  );
  if (!tooltip) return content;
  return (
    <Tooltip title={t(tooltip)} placement="top" arrow>
      {content}
    </Tooltip>
  );
});

Header.displayName = "Header";

const PaymentLinksTable = ({
  paymentLinks,
  rowsPerPage = 10,
  loading = false,
}: PaymentLinksTableProps & { loading?: boolean }) => {
  const router = useRouter();
  const { deletePaymentLink } = usePaymentLinks();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(rowsPerPage);
  const { t } = useTranslation("paymentLinks");
  const tCommon = useCallback((key: string) => t(key, { ns: "common" }), [t]);
  const theme = useTheme();
  const isMobile = useTableCardView();
  // §4.2 rulebook: pinned first (ID) column + edge-fade scroll hints ≥768px.
  const { ref: hscrollRef, showLeft: hasScrolledX, showRight: hasMoreRight } = useEdgeFades<HTMLDivElement>();
  const frozenEdgeShadow = hasScrolledX
    ? theme.palette.mode === "dark"
      ? "8px 0 12px -8px rgba(0,0,0,0.6)"
      : "8px 0 12px -8px rgba(15,15,20,0.22)"
    : "none";
  const headBg = theme.palette.mode === "dark" ? theme.palette.background.paper : theme.palette.primary.light;
  const stickyFirstHeadSx = {
    position: "sticky" as const,
    left: 0,
    zIndex: 3,
    backgroundColor: headBg,
    boxShadow: frozenEdgeShadow,
    transition: "box-shadow 160ms ease",
  };
  const stickyFirstCellSx = {
    position: "sticky" as const,
    left: 0,
    zIndex: 1,
    backgroundColor: theme.palette.mode === "dark" ? theme.palette.background.paper : "#FFFFFF",
    boxShadow: frozenEdgeShadow,
    transition: "box-shadow 160ms ease",
  };
  const [openToast, setOpenToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openViewModel, setOpenViewModel] = useState<boolean>(false);
  const [viewModelData, setViewModelData] = useState<{
    value: string;
    cryptoValue: string;
    expire: string;
    description: string;
    blockchainFees: string;
    linkId: string;
  }>({
    value: "",
    cryptoValue: "",
    expire: "",
    description: "",
    blockchainFees: "",
    linkId: "",
  });
  const [paymentLink, setPaymentLink] = useState<string>("");
  const [deleteModel, setDeleteModel] = useState<boolean>(false);
  const [cryptoRefundLinkId, setCryptoRefundLinkId] = useState<string | null>(null);
  const { refundMap, mutateRefunds } = useRefundMap("payment_link");
  const [deleteId, setDeletId] = useState<string>("");

  const total = paymentLinks.length;
  const start = page * rows;
  const end = Math.min(start + rows, total);

  const paginatedData = paymentLinks.slice(start, end);

  // ── Donation campaign helpers ──────────────────────────────────────
  const donationChip = (
    <TransactionSourceBadge source={{ type: "contribution", title: null }} />
  );

  const donationProgressBar = (row: PaymentLinkData, maxWidth = 96) =>
    row.donation?.goalAmount ? (
      <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Box
          sx={{
            flex: 1,
            maxWidth,
            height: 4,
            borderRadius: 999,
            backgroundColor:
              theme.palette.mode === "dark" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: `${Math.min(100, row.donation.progressPercent || 0)}%`,
              height: "100%",
              borderRadius: 999,
              backgroundColor: "#10B981",
            }}
          />
        </Box>
        <Typography
          component="span"
          sx={{
            fontSize: "11px",
            fontFamily: "var(--font-sans)",
            color: theme.palette.text.secondary,
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}
        >
          {Math.min(100, row.donation.progressPercent || 0)}%
        </Typography>
      </Box>
    ) : null;

  const fireToast = (message: string, severity: "success" | "error") => {
    setToastMessage(message);
    setToastSeverity(severity);
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

  const handleCopy = async (url: string) => {
    if (!url) {
      fireToast(String(tCommon("copyFailed")), "error");
      return;
    }
    const ok = await copyToClipboard(url);
    fireToast(
      ok ? String(tCommon("copiedToClipboard")) : String(tCommon("copyFailed")),
      ok ? "success" : "error",
    );
  };

  // Parse DD/MM/YYYY HH:MM:SS format from API
  function parseDateSafe(dateString: string): Date {
    if (!dateString) return new Date(NaN);
    const ddmmyyyy = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (ddmmyyyy) {
      const [, day, month, year, hours, minutes, seconds] = ddmmyyyy;
      return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`);
    }
    return new Date(dateString);
  }

  function getDateDiffShort(from: string, to: string): string {
    if (!from || !to) return "";

    const start = parseDateSafe(from).getTime();
    const end = parseDateSafe(to).getTime();

    if (isNaN(start) || isNaN(end)) return "";

    let diff = Math.abs(end - start);

    const SECOND = 1000;
    const MINUTE = 60 * SECOND;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const MONTH = 30 * DAY;
    const YEAR = 365 * DAY;

    if (diff >= YEAR) return `${Math.floor(diff / YEAR)}y`;
    if (diff >= MONTH) return `${Math.floor(diff / MONTH)}m`;
    if (diff >= DAY) return `${Math.floor(diff / DAY)}d`;
    if (diff >= HOUR) return `${Math.floor(diff / HOUR)}h`;
    if (diff >= MINUTE) return `${Math.floor(diff / MINUTE)}m`;
    return `${Math.floor(diff / SECOND)}s`;
  }

  const handleViewModelOpen = (row: PaymentLinkData) => {
    setViewModelData({
      value: row.usdValue,
      cryptoValue: row.cryptoValue || "",
      expire: getDateDiffShort(row.createdAt, row.expiresAt),
      description: row.description,
      blockchainFees: row.status,
      linkId: row.id,
    });
    setPaymentLink(row.paymentUrl);
    setOpenViewModel(true);
  };

  const handleCopyLink = async () => {
    if (!paymentLink) {
      fireToast(String(tCommon("copyFailed")), "error");
      return;
    }
    const ok = await copyToClipboard(paymentLink);
    fireToast(
      ok ? String(tCommon("copiedToClipboard")) : String(tCommon("copyFailed")),
      ok ? "success" : "error",
    );
  };

  // Shared unambiguous format ("13 Aug 2026, 13:10") — same as Transactions
  // and API Keys (UI/UX audit date-format unification; was MM.DD.YYYY).
  function formatUtcToDisplay(dateString: string): string {
    if (!dateString) return "";
    const date = parseDateSafe(dateString);
    if (isNaN(date.getTime())) return dateString || "";
    return formatDisplayDateTime(date);
  }

  return (
    <>
      <PaymentLinkSuccessModal
        open={openViewModel}
        onClose={() => setOpenViewModel(false)}
        paymentLink={paymentLink}
        paymentSettings={viewModelData}
        onCopyLink={handleCopyLink}
      />
      {CRYPTO_REFUNDS_ENABLED && cryptoRefundLinkId && (
        <CryptoRefundModal
          open={!!cryptoRefundLinkId}
          onClose={() => setCryptoRefundLinkId(null)}
          sourceType="payment_link"
          sourceRef={cryptoRefundLinkId}
          onDone={() => mutateRefunds()}
        />
      )}
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
        {/* MOBILE: Card layout */}
        {isMobile ? (
          <>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, px: 2 }}>
            {paginatedData.length === 0 ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <Typography sx={{ fontSize: "14px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                  {tCommon("noDataAvailable")}
                </Typography>
              </Box>
            ) : (
              paginatedData.map((row, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 2,
                    borderRadius: "12px",
                    border: `1px solid ${(theme.palette as any).border?.main ?? "#E9ECF2"}`,
                    bgcolor: theme.palette.background.paper,
                  }}
                >
                  {/* Top: Description + Status */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.25 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, mr: 1, flexWrap: "wrap" }}>
                      <Typography sx={{ fontSize: "14px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary, lineHeight: 1.3 }}>
                        {row.description || "Payment Link"}
                      </Typography>
                      {row.linkType === "donation" && donationChip}
                    </Box>
                    <StatusDot
                      tone={
                        row.status === "paid" || row.status === "completed"
                          ? "settled"
                          : row.status === "active"
                            ? "info"
                            : row.status === "expired"
                              ? "neutral"
                              : "pending"
                      }
                    >
                      {row.status === "active" ? "Active" : row.status === "expired" ? "Expired" : row.status === "paid" || row.status === "completed" ? "Paid" : "Pending"}
                    </StatusDot>
                  </Box>
                  {/* Middle: USD + Crypto */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1 }}>
                    <Typography sx={{ fontSize: "16px", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: theme.palette.text.primary }}>
                      {row.usdValue}
                    </Typography>
                    {row.cryptoValue && (
                      <CoinChips value={row.cryptoValue} size="xs" max={2} />
                    )}
                  </Box>
                  {row.linkType === "donation" && row.donation?.goalAmount ? (
                    <Box sx={{ mb: 1 }}>{donationProgressBar(row, 999)}</Box>
                  ) : null}
                  {/* Bottom: Date + Actions */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontSize: "11px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                      {formatUtcToDisplay(row.createdAt)}
                      {row.timesUsed > 0 ? ` · ${t("paymentsReceivedShort", { count: row.timesUsed })}` : ""}
                    </Typography>
                    <Box sx={{ display: "flex", gap: "6px" }}>
                      {row.status !== "expired" && (
                        <Tooltip title={t("copyLinkTooltip", { defaultValue: "Copy link" })} arrow>
                          <CopyButton
                            aria-label={t("copyLinkTooltip", { defaultValue: "Copy link" })}
                            onClick={() => handleCopy(row.paymentUrl)}
                            sx={{ width: 32, height: 32, minWidth: 32, p: "6px" }}
                          >
                            <Image src={CopyIcon} alt="" width={14} height={14} draggable={false} className="themed-icon-primary" />
                          </CopyButton>
                        </Tooltip>
                      )}
                      <Tooltip
                        title={
                          row.status === "expired"
                            ? (t("editLinkTooltip", { defaultValue: "Edit link" }))
                            : row.status === "paid" || row.status === "completed"
                              ? (t("viewTransactionsTooltip", { defaultValue: "View transactions" }))
                              : (t("viewLinkTooltip", { defaultValue: "View details" }))
                        }
                        arrow
                      >
                        <CopyButton
                          aria-label={
                            row.status === "expired"
                              ? (t("editLinkTooltip", { defaultValue: "Edit link" }))
                              : row.status === "paid" || row.status === "completed"
                                ? (t("viewTransactionsTooltip", { defaultValue: "View transactions" }))
                                : (t("viewLinkTooltip", { defaultValue: "View details" }))
                          }
                          onClick={() => {
                            row.status === "expired"
                              ? router.push(`/pay-links/${row?.id}`)
                              : row.status === "paid" || row.status === "completed"
                                ? router.push(`/transactions`)
                                : handleViewModelOpen(row);
                          }}
                          sx={{ width: 32, height: 32, minWidth: 32, p: "6px", borderColor: theme.palette.text.primary }}
                        >
                          <Image src={EyeIcon} alt="" width={14} height={14} draggable={false} className="themed-icon" />
                        </CopyButton>
                      </Tooltip>
                      {row.status !== "expired" && row.status !== "paid" && row.status !== "completed" && (
                        <Tooltip title={t("editLinkTooltip", { defaultValue: "Edit link" })} arrow>
                          <CopyButton
                            aria-label={t("editLinkTooltip", { defaultValue: "Edit link" })}
                            onClick={() => router.push(`/pay-links/${row?.id}`)}
                            sx={{ width: 32, height: 32, minWidth: 32, p: "6px", borderColor: theme.palette.text.primary }}
                          >
                            <Image src={EditIcon} alt="" width={14} height={14} draggable={false} className="themed-icon" />
                          </CopyButton>
                        </Tooltip>
                      )}
                      {row.status !== "expired" && row.status !== "paid" && row.status !== "completed" && (
                        <Tooltip title={t("deleteLinkTooltip", { defaultValue: "Delete link" })} arrow>
                          <CopyButton
                            aria-label={t("deleteLinkTooltip", { defaultValue: "Delete link" })}
                            onClick={() => {
                              setDeleteModel(true);
                              setDeletId(row.id);
                            }}
                            sx={{ width: 32, height: 32, minWidth: 32, p: "6px", borderColor: theme.palette.error.main }}
                          >
                            <Image src={TrashIcon} alt="" width={14} height={14} draggable={false} style={{ filter: "brightness(0) saturate(100%) invert(27%) sepia(86%) saturate(5000%) hue-rotate(355deg) brightness(97%) contrast(120%)" }} />
                          </CopyButton>
                        </Tooltip>
                      )}
                      {CRYPTO_REFUNDS_ENABLED && refundMap[String(row.id)] && (
                        <RefundStatusChip
                          status={refundMap[String(row.id)].status}
                          testid={`paylink-refund-status-mobile-${row.id}`}
                        />
                      )}
                      {CRYPTO_REFUNDS_ENABLED && isRefundableLinkStatus(row.status) && (
                        <Tooltip title={t("cryptoRefundTooltip", { defaultValue: "Crypto refund" })} arrow>
                          <CopyButton
                            aria-label="Crypto refund"
                            data-testid={`paylink-crypto-refund-mobile-${row.id}`}
                            onClick={() => setCryptoRefundLinkId(String(row.id))}
                            sx={{ width: 32, height: 32, minWidth: 32, p: "6px", borderColor: theme.palette.primary.main }}
                          >
                            <CurrencyExchangeRounded sx={{ fontSize: 14, color: theme.palette.primary.main }} />
                          </CopyButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                </Box>
              ))
            )}
          </Box>

          {/* MOBILE pagination footer (session 72). The desktop pager lives
              inside the table container below, which is NOT rendered on mobile,
              so mobile needs its own pager. The 180px spacer lifts it clear of
              the fixed support-chat FAB + bottom nav pill. */}
          <TableFooter>
            <RowsPerPageSelector
              value={rows}
              onChange={(value) => {
                setRows(value);
                setPage(0);
              }}
              menuItems={[
                { value: 5, label: 5 },
                { value: 10, label: 10 },
                { value: 15, label: 15 },
                { value: 20, label: 20 },
              ]}
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FooterText>
                {/* Session 75 fix — show an explicit range so the counter
                    actually changes each page click ("1-10 of 458" →
                    "11-20 of 458"). Previously only `count: end` was passed
                    so mobile users saw the offset climb in +10 increments
                    with no indication of the starting row. */}
                {t("showingLinks", {
                  start: total === 0 ? 0 : start + 1,
                  end: end,
                  total: total,
                  count: end,
                })}
              </FooterText>
              <MobileNavigationButtons
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={page === 0}
              >
                <KeyboardArrowLeftRoundedIcon
                  sx={{ height: "16px", width: "16px", color: "inherit" }}
                />
              </MobileNavigationButtons>
              <MobileNavigationButtons
                onClick={() => setPage((p) => p + 1)}
                disabled={end >= total}
              >
                <KeyboardArrowRightRoundedIcon
                  sx={{ height: "16px", width: "16px", color: "inherit" }}
                />
              </MobileNavigationButtons>
            </Box>
          </TableFooter>
          <Box sx={{ height: "180px", flexShrink: 0 }} />
          </>
        ) : (
        /* DESKTOP: Table layout */
        <TransactionsTableContainer sx={{ position: "relative" }}>
          <TransactionsTableScrollWrapper ref={hscrollRef}>
            <Table>
              <TableHead
                sx={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  backgroundColor: theme.palette.mode === "dark" ? theme.palette.background.paper : theme.palette.primary.light,
                }}
              >
                <TableRow sx={{ backgroundColor: theme.palette.mode === "dark" ? theme.palette.background.paper : theme.palette.primary.light }}>
                  <TableCell sx={stickyFirstHeadSx}>
                    <Header label="linkIdHeader" />
                  </TableCell>
                  <TableCell>
                    <Header label="descriptionHeader" />
                  </TableCell>
                  <TableCell>
                    <Header label="usdValueHeader" align="right" />
                  </TableCell>
                  <TableCell>
                    <Header label="cryptoValueHeader" />
                  </TableCell>
                  <TableCell>
                    <Header label="createdHeader" />
                  </TableCell>
                  <TableCell>
                    <Header label="expiresHeader" />
                  </TableCell>
                  <TableCell>
                    <Header label="statusHeader" />
                  </TableCell>
                  <TableCell>
                    <Header label="timesUsedHeader" tooltip="timesUsedTooltip" />
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      // Sticky so row actions are NEVER cut off when the
                      // table scrolls horizontally (UI/UX audit P1 fix).
                      position: "sticky",
                      right: 0,
                      zIndex: 3,
                      backgroundColor: theme.palette.mode === "dark" ? theme.palette.background.paper : theme.palette.primary.light,
                      // §4.2 — left-edge shadow doubles as the "more content
                      // to the right" scroll hint.
                      boxShadow: hasMoreRight
                        ? theme.palette.mode === "dark"
                          ? "-8px 0 12px -8px rgba(0,0,0,0.6)"
                          : "-8px 0 12px -8px rgba(15,15,20,0.22)"
                        : "none",
                      transition: "box-shadow 160ms ease",
                    }}
                  >
                    <Header label="actionsHeader" />
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody sx={{ overflowY: "auto" }}>
                {/* Loading skeleton — 6 shimmer rows (M4). Renders whenever the API is
                     in-flight so users see structure immediately instead of a spinner. */}
                {loading && paginatedData.length === 0
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow
                        key={`skel-${i}`}
                        sx={{
                          height: "52px",
                          borderTop: i === 0 ? "none" : "1px solid #E5E7EB",
                        }}
                      >
                        {Array.from({ length: 9 }).map((__, colIdx) => (
                          <TableBodyCell key={colIdx} sx={{ pl: colIdx === 0 ? "15px" : undefined }}>
                            <Skeleton
                              variant="text"
                              width={colIdx === 0 ? 30 : colIdx === 8 ? 92 : 90}
                              height={16}
                              sx={{ bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
                            />
                          </TableBodyCell>
                        ))}
                      </TableRow>
                    ))
                  : paginatedData.map((row, index) => (
                  <TableRow
                    key={index}
                    sx={{
                      // L1 — tighter row density: was 59/63px, now 48/52px so ~15% more rows
                      // fit above the fold on a 900px viewport without feeling cramped.
                      height: isMobile ? "48px" : "52px",
                      borderTop: index === 0 ? "none" : "1px solid #E5E7EB",
                    }}
                  >
                    <TableBodyCell sx={{ pl: "15px", ...stickyFirstCellSx }}>{row.id}</TableBodyCell>
                    <TableBodyCell>
                      {row.linkType === "donation" ? (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 130 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Box component="span">{row.description || "—"}</Box>
                            {donationChip}
                          </Box>
                          {donationProgressBar(row)}
                        </Box>
                      ) : (
                        row.description || "—"
                      )}
                    </TableBodyCell>
                    <TableBodyCell sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{row.usdValue}</TableBodyCell>
                    <TableBodyCell><CoinChips value={row.cryptoValue} /></TableBodyCell>
                    <TableBodyCell>
                      {formatUtcToDisplay(row.createdAt)}
                    </TableBodyCell>
                    <TableBodyCell>
                      {formatUtcToDisplay(row.expiresAt)}
                    </TableBodyCell>

                    <TableBodyCell>
                      <StatusDot
                        tone={
                          row.status === "paid" || row.status === "completed"
                            ? "settled"
                            : row.status === "active"
                              ? "info"
                              : row.status === "expired"
                                ? "neutral"
                                : "pending"
                        }
                      >
                        {row.status === "active"
                          ? "Active"
                          : row.status === "expired"
                            ? "Expired"
                            : row.status === "paid" || row.status === "completed"
                              ? "Completed"
                              : "Pending"}
                      </StatusDot>
                    </TableBodyCell>

                    <TableBodyCell sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>{row.timesUsed}</TableBodyCell>

                    <TableBodyCell
                      align="center"
                      sx={{
                        // H2 — was `width: fit-content; display: flex` on the <td> which
                        // pushed the whole cell past the container. Now the cell just holds
                        // an inner flex Box so the table can compute the column width
                        // properly and the icons stay inside the visible area.
                        whiteSpace: "nowrap",
                        // Sticky-right so actions stay visible while the rest
                        // of the row scrolls under them (UI/UX audit P1 fix).
                        position: "sticky",
                        right: 0,
                        zIndex: 2,
                        backgroundColor: theme.palette.mode === "dark" ? theme.palette.background.paper : "#FFFFFF",
                        boxShadow: hasMoreRight
                          ? theme.palette.mode === "dark"
                            ? "-8px 0 12px -8px rgba(0,0,0,0.6)"
                            : "-8px 0 12px -8px rgba(15,15,20,0.22)"
                          : "none",
                        transition: "box-shadow 160ms ease",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                        }}
                      >
                      {row.status !== "expired" && (
                        <Tooltip title={t("copyLinkTooltip", { defaultValue: "Copy link" })} arrow>
                          <CopyButton aria-label={t("copyLinkTooltip", { defaultValue: "Copy link" })} onClick={() => handleCopy(row.paymentUrl)}>
                            <Image
                              src={CopyIcon}
                              alt=""
                              width={isMobile ? 12 : 14}
                              height={isMobile ? 12 : 14}
                              draggable={false}
                              className="themed-icon-primary"
                            />
                          </CopyButton>
                        </Tooltip>
                      )}
                      <Tooltip
                        title={
                          row.status === "expired"
                            ? (t("editLinkTooltip", { defaultValue: "Edit link" }))
                            : row.status === "paid" || row.status === "completed"
                              ? (t("viewTransactionsTooltip", { defaultValue: "View transactions" }))
                              : (t("viewLinkTooltip", { defaultValue: "View details" }))
                        }
                        arrow
                      >
                        <CopyButton
                          aria-label={
                            row.status === "expired"
                              ? (t("editLinkTooltip", { defaultValue: "Edit link" }))
                              : row.status === "paid" || row.status === "completed"
                                ? (t("viewTransactionsTooltip", { defaultValue: "View transactions" }))
                                : (t("viewLinkTooltip", { defaultValue: "View details" }))
                          }
                          onClick={() => {
                            row.status === "expired"
                              ? router.push(`/pay-links/${row?.id}`)
                              : row.status === "paid" || row.status === "completed"
                                ? router.push(`/transactions`)
                                : handleViewModelOpen(row);
                          }}
                          sx={{
                            borderColor: theme.palette.text.primary,
                            "&:hover": {
                              backgroundColor: "transparent",
                              boxShadow: "none",
                            },
                          }}
                        >
                          <Image
                            src={EyeIcon}
                            alt=""
                            width={isMobile ? 12 : 20}
                            height={isMobile ? 12 : 14}
                            draggable={false}
                            className="themed-icon"
                          />
                        </CopyButton>
                      </Tooltip>
                      {row.status !== "expired" && row.status !== "paid" && row.status !== "completed" && (
                        <Tooltip title={t("editLinkTooltip", { defaultValue: "Edit link" })} arrow>
                          <CopyButton
                            aria-label={t("editLinkTooltip", { defaultValue: "Edit link" })}
                            onClick={() => router.push(`/pay-links/${row?.id}`)}
                            sx={{
                              borderColor: theme.palette.text.primary,
                              "&:hover": {
                                backgroundColor: "transparent",
                                boxShadow: "none",
                              },
                            }}
                          >
                            <Image
                              src={EditIcon}
                              alt=""
                              width={isMobile ? 12 : 20}
                              height={isMobile ? 12 : 16}
                              draggable={false}
                              className="themed-icon"
                            />
                          </CopyButton>
                        </Tooltip>
                      )}
                      {row.status !== "expired" && row.status !== "paid" && row.status !== "completed" && (
                        <Tooltip title={t("deleteLinkTooltip", { defaultValue: "Delete link" })} arrow>
                          <CopyButton
                            aria-label={t("deleteLinkTooltip", { defaultValue: "Delete link" })}
                            onClick={() => {
                              setDeleteModel(true);
                              setDeletId(row.id);
                            }}
                            sx={{
                              borderColor: theme.palette.text.primary,
                              "&:hover": {
                                backgroundColor: "transparent",
                                boxShadow: "none",
                              },
                            }}
                          >
                            <Image
                              src={TrashIcon}
                              alt=""
                              width={isMobile ? 12 : 20}
                              height={isMobile ? 12 : 16}
                              draggable={false}
                              style={{
                                filter: "brightness(0) saturate(100%) invert(27%) sepia(86%) saturate(5000%) hue-rotate(355deg) brightness(97%) contrast(120%)",
                              }}
                            />
                          </CopyButton>
                        </Tooltip>
                      )}
                      {CRYPTO_REFUNDS_ENABLED && refundMap[String(row.id)] && (
                        <RefundStatusChip
                          status={refundMap[String(row.id)].status}
                          testid={`paylink-refund-status-${row.id}`}
                        />
                      )}
                      {CRYPTO_REFUNDS_ENABLED && isRefundableLinkStatus(row.status) && (
                        <Tooltip title={t("cryptoRefundTooltip", { defaultValue: "Crypto refund" })} arrow>
                          <CopyButton
                            aria-label="Crypto refund"
                            data-testid={`paylink-crypto-refund-${row.id}`}
                            onClick={() => setCryptoRefundLinkId(String(row.id))}
                            sx={{
                              borderColor: theme.palette.primary.main,
                              "&:hover": { backgroundColor: "transparent", boxShadow: "none" },
                            }}
                          >
                            <CurrencyExchangeRounded sx={{ fontSize: isMobile ? 14 : 18, color: theme.palette.primary.main }} />
                          </CopyButton>
                        </Tooltip>
                      )}
                      </Box>
                    </TableBodyCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TransactionsTableScrollWrapper>
          {/* §4.2 — scroll hints: the pinned ID column (left) and sticky
              actions column (right) carry edge shadows while scrollable. */}

          <TableFooter>
            <RowsPerPageSelector
              value={rows}
              onChange={(value) => {
                setRows(value);
                setPage(0);
              }}
              menuItems={[
                { value: 5, label: 5 },
                { value: 10, label: 10 },
                { value: 15, label: 15 },
                { value: 20, label: 20 },
              ]}
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FooterText>
                {/* Session 75 fix — desktop pager: same range-explicit format
                    as mobile so both surfaces stay consistent. */}
                {t("showingLinks", {
                  start: total === 0 ? 0 : start + 1,
                  end: end,
                  total: total,
                  count: end,
                })}
              </FooterText>
              <CustomButton
                label={t("previous")}
                variant="outlined"
                size="medium"
                sx={{
                  width: "fit-content",
                  height: "36px",
                  padding: "0px 12px",
                  "&:disabled": {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    border: `1px solid ${(theme.palette as any).border?.main ?? "#E9ECF2"}`,
                    cursor: "not-allowed",
                    opacity: 0.5,
                  },
                  ".custom-button-label": {
                    fontSize: "13px !important",
                    fontFamily: "var(--font-sans)",
                    lineHeight: "100%",
                    fontWeight: 500,
                  },
                  [theme.breakpoints.down("md")]: {
                    display: "none",
                  },
                }}
                startIcon={
                  <KeyboardArrowLeftRoundedIcon
                    sx={{ height: "20px", width: "20px" }}
                  />
                }
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
              />
              <CustomButton
                label={t("next")}
                variant="outlined"
                size="medium"
                sx={{
                  width: "fit-content",
                  height: "36px",
                  padding: "0px 12px",
                  "&:disabled": {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    border: `1px solid ${(theme.palette as any).border?.main ?? "#E9ECF2"}`,
                    cursor: "not-allowed",
                    opacity: 0.5,
                  },
                  ".custom-button-label": {
                    fontSize: "13px !important",
                    fontFamily: "var(--font-sans)",
                    lineHeight: "100%",
                    fontWeight: 500,
                  },
                  [theme.breakpoints.down("md")]: {
                    display: "none",
                  },
                }}
                endIcon={
                  <KeyboardArrowRightRoundedIcon
                    sx={{ height: "20px", width: "20px" }}
                  />
                }
                disabled={end >= total}
                onClick={() => setPage((p) => p + 1)}
              />

              <MobileNavigationButtons
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={page === 0}
              >
                <KeyboardArrowLeftRoundedIcon
                  sx={{ height: "16px", width: "16px", color: "inherit" }}
                />
              </MobileNavigationButtons>
              <MobileNavigationButtons
                onClick={() => setPage((p) => p + 1)}
                disabled={end >= total}
              >
                <KeyboardArrowRightRoundedIcon
                  sx={{ height: "16px", width: "16px", color: "inherit" }}
                />
              </MobileNavigationButtons>
            </Box>
          </TableFooter>
        </TransactionsTableContainer>
        )}
      </Box>

      <Toast
        open={openToast}
        message={toastMessage || tCommon("copiedToClipboard")}
        severity={toastSeverity}
      />

      <Dialog
        open={deleteModel}
        onClose={() => {
          setDeleteModel(false);
          setDeletId("");
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            p: 0,
            maxWidth: 576,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 0,
            pt: isMobile ? "16px" : "30px",
            px: isMobile ? "16px" : "30px",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: isMobile ? "16px" : "24px",
            }}
          >
            <Image
              src={TrashIcon}
              alt="Info Icon"
              width={isMobile ? 12 : 22}
              height={isMobile ? 12 : 16}
              draggable={false}
            />
            <Typography
              sx={{
                fontWeight: 500,
                fontSize: isMobile ? "16px" : "20px",
                fontFamily: "var(--font-sans)",
                color: "text.primary",
                lineHeight: "24px",
              }}
            >
              {t("deleteModelTitle")} {deleteId}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: isMobile ? "16px" : "30px", pt: 1.5, pb: 0 }}>
          <Typography
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              color: "text.secondary",
              lineHeight: "18px",
              fontFamily: "var(--font-sans)",
            }}
          >
            {t("deleteModelDescription")}
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: "flex-end",
            gap: 1,
            px: 2.5,
            pb: 2.5,
            pt: 3,
          }}
        >
          <CustomButton
            label={t("cancel")}
            variant="outlined"
            size={isMobile ? "small" : "medium"}
            onClick={() => {
              setDeleteModel(false);
              setDeletId("");
            }}
            sx={{ fontSize: isMobile ? "13px" : "14px", width: "100%" }}
          />
          <CustomButton
            label={t("delete")}
            variant="danger"
            size={isMobile ? "small" : "medium"}
            onClick={() => {
              if (deleteId) {
                void deletePaymentLink(deleteId);
              }
              setDeleteModel(false);
              setDeletId("");
            }}
            sx={{ fontSize: isMobile ? "13px" : "14px", width: "100%" }}
          />
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PaymentLinksTable;
