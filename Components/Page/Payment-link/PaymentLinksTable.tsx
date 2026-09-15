import { rowKeyProps } from "@/helpers/a11y";
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
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { PaymentLinkAction, PAYLINK_DELETE } from "@/Redux/Actions/PaymentLinkAction";
import {
  FooterText,
  TableBodyCell,
  TableFooter,
  TransactionsTableContainer,
  TransactionsTableScrollWrapper,
  RowActionButton,
  CARD_RADIUS,
  EYEBROW_SX,
  hairline,
  rowDivider,
  rowHover,
} from "./styled";

import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";

import CopyIcon from "@/assets/Icons/copy-icon.svg";
import LinkCoinsBadge from "./LinkCoinsBadge";
import { ExpiringSoonBadge, Last30Cell, QrShareActions } from "./LinkRowExtras";
import { StatusDot } from "@/Components/UI/StatusDot";
import { formatDisplayDateTime } from "@/helpers/displayDate";
import TransactionSourceBadge from "@/Components/UI/TransactionSourceBadge";
import EditIcon from "@/assets/Icons/edit-icon.svg";
import EyeIcon from "@/assets/Icons/eye-icon.svg";
import TrashIcon from "@/assets/Icons/trash-icon.svg";

import Image from "next/image";

import { MobileNavigationButtons } from "@/Components/Page/Transactions/styled";
import { MONO } from "@/styles/uiKit";
import CustomButton from "@/Components/UI/Buttons";
import RowsPerPageSelector from "@/Components/UI/RowsPerPageSelector";
import Toast from "@/Components/UI/Toast";
import { copyToClipboard } from "@/helpers/copyToClipboard";
import { toShortPayLink } from "@/helpers/payLinkUrl";
import { useEdgeFades } from "@/Components/Common/ScrollHint";
import useIsMobile from "@/hooks/useIsMobile";
import useTableCardView from "@/hooks/useTableCardView";
import {
  PaymentLinkData,
  PaymentLinksTableProps,
} from "@/utils/types/paymentLink";
import { useRouter } from "next/router";
import PaymentLinkDetailPanel from "./PaymentLinkDetailPanel";
import CurrencyExchangeRounded from "@mui/icons-material/CurrencyExchangeRounded";
import CryptoRefundModal from "@/Components/Page/Refund/CryptoRefundModal";
import { useRefundMap, RefundStatusChip } from "@/Components/Page/Refund/refundStatus";
import { getRuntimeFlags } from "@/helpers/runtimeFlags";

const CRYPTO_REFUNDS_ENABLED = getRuntimeFlags().enableCryptoRefunds;
const isRefundableLinkStatus = (status?: string) =>
  status === "paid" || status === "completed";


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
      {/* Dashboard parity: uppercase tech-font eyebrow, no header icons. */}
      <Typography
        sx={{
          ...EYEBROW_SX,
          fontSize: isMobile ? 10.5 : 11,
          lineHeight: 1.2,
          color: headerTheme.palette.text.secondary,
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
  const dispatch = useDispatch();
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
  const headBg = theme.palette.background.paper;
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
    backgroundColor: theme.palette.background.paper,
    boxShadow: frozenEdgeShadow,
    transition: "box-shadow 160ms ease, background-color 120ms ease",
  };
  const [openToast, setOpenToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Plan 2.2 — detail panel (drawer / phone sheet). Kept by id so a refetch
  // (e.g. after delete or edit) always shows the freshest row.
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailLink = detailId ? paymentLinks.find((l) => String(l.id) === detailId) ?? null : null;
  const openDetail = (row: PaymentLinkData) => setDetailId(String(row.id));
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
      <PaymentLinkDetailPanel
        open={!!detailLink}
        link={detailLink}
        onClose={() => setDetailId(null)}
        onEdit={(id) => router.push(`/pay-links/${id}`)}
        onDelete={(id) => {
          setDetailId(null);
          setDeleteModel(true);
          setDeletId(id);
        }}
        onRefund={CRYPTO_REFUNDS_ENABLED ? (id) => { setDetailId(null); setCryptoRefundLinkId(id); } : undefined}
        refundStatus={detailLink ? refundMap[String(detailLink.id)]?.status ?? null : null}
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
                  data-testid="paylink-card"
                  data-link-id={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetail(row)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetail(row);
                    }
                  }}
                  sx={{
                    // Flat card (dashboard parity): 16px radius + hairline, no shadow.
                    p: 1.75,
                    borderRadius: `${CARD_RADIUS}px`,
                    border: `1px solid ${hairline(theme)}`,
                    bgcolor: theme.palette.background.paper,
                    cursor: "pointer",
                    outline: "none",
                    "&:focus-visible": { boxShadow: `0 0 0 2px ${theme.palette.primary.main}` },
                  }}
                >
                  {/* Top: Description + Status */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.25 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, mr: 1, flexWrap: "wrap" }}>
                      <Typography sx={{ fontSize: "14px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary, lineHeight: 1.3 }}>
                        {row.description || t("paymentLinkFallback", { defaultValue: "Payment Link" })}
                      </Typography>
                      {row.linkType === "donation" && donationChip}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap", justifyContent: "flex-end" }}>
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
                        {row.status === "active" ? t("statusActive", { defaultValue: "Active" }) : row.status === "expired" ? t("statusExpired", { defaultValue: "Expired" }) : row.status === "paid" || row.status === "completed" ? t("statusPaid", { defaultValue: "Paid" }) : t("statusPending", { defaultValue: "Pending" })}
                      </StatusDot>
                      <ExpiringSoonBadge link={row} testId={`paylink-expiring-mobile-${row.id}`} />
                    </Box>
                  </Box>
                  {/* Middle: USD + Crypto */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1 }}>
                    <Typography sx={{ fontSize: "16px", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: theme.palette.text.primary }}>
                      {row.usdValue}
                    </Typography>
                    <LinkCoinsBadge value={row.cryptoValue} size="xs" max={2} />
                  </Box>
                  <Box sx={{ mb: 1 }}><Last30Cell link={row} compact /></Box>
                  {row.linkType === "donation" && row.donation?.goalAmount ? (
                    <Box sx={{ mb: 1 }}>{donationProgressBar(row, 999)}</Box>
                  ) : null}
                  {/* Bottom: Date + Actions */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontSize: "11px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                      {formatUtcToDisplay(row.createdAt)}
                      {row.timesUsed > 0 ? ` · ${t("paymentsReceivedShort", { count: row.timesUsed })}` : ""}
                    </Typography>
                    <Box sx={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                      {row.status !== "expired" && (
                        <Tooltip title={t("copyLinkTooltip", { defaultValue: "Copy link" })} arrow>
                          <RowActionButton
                            tone="primary"
                            aria-label={t("copyLinkTooltip", { defaultValue: "Copy link" })}
                            onClick={() => handleCopy(toShortPayLink(row.paymentUrl))}
                            sx={{ width: 36, height: 36, minWidth: 36, borderRadius: "10px" }}
                          >
                            <Image src={CopyIcon} alt="" width={14} height={14} draggable={false} className="themed-icon-primary" />
                          </RowActionButton>
                        </Tooltip>
                      )}
                      <QrShareActions link={row} onToast={fireToast} compact />
                      <Tooltip title={t("viewLinkTooltip", { defaultValue: "View details" })} arrow>
                        <RowActionButton
                          aria-label={t("viewLinkTooltip", { defaultValue: "View details" })}
                          data-testid={`paylink-view-mobile-${row.id}`}
                          onClick={() => openDetail(row)}
                          sx={{ width: 36, height: 36, minWidth: 36, borderRadius: "10px" }}
                        >
                          <Image src={EyeIcon} alt="" width={14} height={14} draggable={false} className="themed-icon" />
                        </RowActionButton>
                      </Tooltip>
                      {row.status !== "expired" && row.status !== "paid" && row.status !== "completed" && (
                        <Tooltip title={t("editLinkTooltip", { defaultValue: "Edit link" })} arrow>
                          <RowActionButton
                            aria-label={t("editLinkTooltip", { defaultValue: "Edit link" })}
                            onClick={() => router.push(`/pay-links/${row?.id}`)}
                            sx={{ width: 36, height: 36, minWidth: 36, borderRadius: "10px" }}
                          >
                            <Image src={EditIcon} alt="" width={14} height={14} draggable={false} className="themed-icon" />
                          </RowActionButton>
                        </Tooltip>
                      )}
                      {row.status !== "expired" && row.status !== "paid" && row.status !== "completed" && (
                        <Tooltip title={t("deleteLinkTooltip", { defaultValue: "Delete link" })} arrow>
                          <RowActionButton
                            tone="danger"
                            aria-label={t("deleteLinkTooltip", { defaultValue: "Delete link" })}
                            onClick={() => {
                              setDeleteModel(true);
                              setDeletId(row.id);
                            }}
                            sx={{ width: 36, height: 36, minWidth: 36, borderRadius: "10px" }}
                          >
                            <Image src={TrashIcon} alt="" width={14} height={14} draggable={false} style={{ filter: "brightness(0) saturate(100%) invert(27%) sepia(86%) saturate(5000%) hue-rotate(355deg) brightness(97%) contrast(120%)" }} />
                          </RowActionButton>
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
                          <RowActionButton
                            tone="primary"
                            aria-label={t("cryptoRefundTooltip", { defaultValue: "Crypto refund" })}
                            data-testid={`paylink-crypto-refund-mobile-${row.id}`}
                            onClick={() => setCryptoRefundLinkId(String(row.id))}
                            sx={{ width: 36, height: 36, minWidth: 36, borderRadius: "10px" }}
                          >
                            <CurrencyExchangeRounded sx={{ fontSize: 16 }} />
                          </RowActionButton>
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
                aria-label={t("previousPage", { ns: "common", defaultValue: "Previous page" })}
                data-testid="pagination-prev"
                disabled={page === 0}
              >
                <KeyboardArrowLeftRoundedIcon
                  sx={{ height: "16px", width: "16px", color: "inherit" }}
                />
              </MobileNavigationButtons>
              <MobileNavigationButtons
                onClick={() => setPage((p) => p + 1)}
                aria-label={t("nextPage", { ns: "common", defaultValue: "Next page" })}
                data-testid="pagination-next"
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
                  backgroundColor: headBg,
                  // Flat header: paper surface + hairline rule instead of a filled band.
                  "& .MuiTableCell-root": { borderBottom: `1px solid ${hairline(theme)}`, py: "10px" },
                }}
              >
                <TableRow sx={{ backgroundColor: headBg }}>
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
                    <Header label="last30Header" tooltip="last30Tooltip" />
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      // Sticky so row actions are NEVER cut off when the
                      // table scrolls horizontally (UI/UX audit P1 fix).
                      position: "sticky",
                      right: 0,
                      zIndex: 3,
                      backgroundColor: headBg,
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
                          borderTop: i === 0 ? "none" : `1px solid ${rowDivider(theme)}`,
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
                    data-testid="paylink-row"
                    data-link-id={row.id}
                    {...rowKeyProps(() => openDetail(row))}
                    onClick={() => openDetail(row)}
                    sx={{
                      // L1 — tighter row density: was 59/63px, now 48/52px so ~15% more rows
                      // fit above the fold on a 900px viewport without feeling cramped.
                      height: isMobile ? "48px" : "52px",
                      borderTop: index === 0 ? "none" : `1px solid ${rowDivider(theme)}`,
                      cursor: "pointer",
                      transition: "background-color 120ms ease",
                      "&:hover, &:hover .sticky-cell": { backgroundColor: rowHover(theme) },
                    }}
                  >
                    <TableBodyCell className="sticky-cell" sx={{ pl: "15px", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: "13px", color: theme.palette.text.secondary, ...stickyFirstCellSx }}>{row.id}</TableBodyCell>
                    <TableBodyCell sx={{ maxWidth: 360 }} title={row.description || undefined}>
                      {row.linkType === "donation" ? (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 130 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                            <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{row.description || "—"}</Box>
                            {donationChip}
                          </Box>
                          {donationProgressBar(row)}
                        </Box>
                      ) : (
                        <Box component="span" sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{row.description || "—"}</Box>
                      )}
                    </TableBodyCell>
                    <TableBodyCell sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{row.usdValue}</TableBodyCell>
                    <TableBodyCell><LinkCoinsBadge value={row.cryptoValue} /></TableBodyCell>
                    <TableBodyCell>
                      {formatUtcToDisplay(row.createdAt)}
                    </TableBodyCell>
                    <TableBodyCell>
                      {formatUtcToDisplay(row.expiresAt)}
                    </TableBodyCell>

                    <TableBodyCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
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
                            ? t("statusActive", { defaultValue: "Active" })
                            : row.status === "expired"
                              ? t("statusExpired", { defaultValue: "Expired" })
                              : row.status === "paid" || row.status === "completed"
                                ? t("statusPaid", { defaultValue: "Paid" })
                                : t("statusPending", { defaultValue: "Pending" })}
                        </StatusDot>
                        <ExpiringSoonBadge link={row} testId={`paylink-expiring-${row.id}`} />
                      </Box>
                    </TableBodyCell>

                    <TableBodyCell><Last30Cell link={row} /></TableBodyCell>

                    <TableBodyCell
                      align="center"
                      className="sticky-cell"
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
                        backgroundColor: theme.palette.background.paper,
                        boxShadow: hasMoreRight
                          ? theme.palette.mode === "dark"
                            ? "-8px 0 12px -8px rgba(0,0,0,0.6)"
                            : "-8px 0 12px -8px rgba(15,15,20,0.22)"
                          : "none",
                        transition: "box-shadow 160ms ease",
                      }}
                    >
                      <Box
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                        }}
                      >
                      {row.status !== "expired" && (
                        <Tooltip title={t("copyLinkTooltip", { defaultValue: "Copy link" })} arrow>
                          <RowActionButton tone="primary" aria-label={t("copyLinkTooltip", { defaultValue: "Copy link" })} onClick={() => handleCopy(toShortPayLink(row.paymentUrl))}>
                            <Image
                              src={CopyIcon}
                              alt=""
                              width={14}
                              height={14}
                              draggable={false}
                              className="themed-icon-primary"
                            />
                          </RowActionButton>
                        </Tooltip>
                      )}
                      <QrShareActions link={row} onToast={fireToast} />
                      <Tooltip title={t("viewLinkTooltip", { defaultValue: "View details" })} arrow>
                        <RowActionButton
                          aria-label={t("viewLinkTooltip", { defaultValue: "View details" })}
                          data-testid={`paylink-view-${row.id}`}
                          onClick={() => openDetail(row)}
                        >
                          <Image
                            src={EyeIcon}
                            alt=""
                            width={18}
                            height={14}
                            draggable={false}
                            className="themed-icon"
                          />
                        </RowActionButton>
                      </Tooltip>
                      {row.status !== "expired" && row.status !== "paid" && row.status !== "completed" && (
                        <Tooltip title={t("editLinkTooltip", { defaultValue: "Edit link" })} arrow>
                          <RowActionButton
                            aria-label={t("editLinkTooltip", { defaultValue: "Edit link" })}
                            onClick={() => router.push(`/pay-links/${row?.id}`)}
                          >
                            <Image
                              src={EditIcon}
                              alt=""
                              width={16}
                              height={16}
                              draggable={false}
                              className="themed-icon"
                            />
                          </RowActionButton>
                        </Tooltip>
                      )}
                      {row.status !== "expired" && row.status !== "paid" && row.status !== "completed" && (
                        <Tooltip title={t("deleteLinkTooltip", { defaultValue: "Delete link" })} arrow>
                          <RowActionButton
                            tone="danger"
                            aria-label={t("deleteLinkTooltip", { defaultValue: "Delete link" })}
                            onClick={() => {
                              setDeleteModel(true);
                              setDeletId(row.id);
                            }}
                          >
                            <Image
                              src={TrashIcon}
                              alt=""
                              width={16}
                              height={16}
                              draggable={false}
                              style={{
                                filter: "brightness(0) saturate(100%) invert(27%) sepia(86%) saturate(5000%) hue-rotate(355deg) brightness(97%) contrast(120%)",
                              }}
                            />
                          </RowActionButton>
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
                          <RowActionButton
                            tone="primary"
                            aria-label={t("cryptoRefundTooltip", { defaultValue: "Crypto refund" })}
                            data-testid={`paylink-crypto-refund-${row.id}`}
                            onClick={() => setCryptoRefundLinkId(String(row.id))}
                          >
                            <CurrencyExchangeRounded sx={{ fontSize: 18 }} />
                          </RowActionButton>
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
                aria-label={t("previousPage", { ns: "common", defaultValue: "Previous page" })}
                data-testid="pagination-prev"
                disabled={page === 0}
              >
                <KeyboardArrowLeftRoundedIcon
                  sx={{ height: "16px", width: "16px", color: "inherit" }}
                />
              </MobileNavigationButtons>
              <MobileNavigationButtons
                onClick={() => setPage((p) => p + 1)}
                aria-label={t("nextPage", { ns: "common", defaultValue: "Next page" })}
                data-testid="pagination-next"
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
                dispatch(PaymentLinkAction(PAYLINK_DELETE, { id: deleteId }));
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
