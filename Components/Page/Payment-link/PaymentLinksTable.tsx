import { rowKeyProps } from "@/helpers/a11y";
import {
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import React, { useCallback, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { PaymentLinkAction, PAYLINK_DELETE, PAYLINK_FETCH } from "@/Redux/Actions/PaymentLinkAction";
import axiosBaseApi from "@/axiosConfig";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
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
import { ExpiringSoonBadge, Last30Cell, QrShareActions, RowQrPopover } from "./LinkRowExtras";
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
import SelectionBar from "@/Components/Common/SelectionBar";
import { downloadCsv } from "@/helpers/downloadCsv";
import { useEdgeFades } from "@/Components/Common/ScrollHint";
import useIsMobile from "@/hooks/useIsMobile";
import {
  PaymentLinkData,
  PaymentLinksTableProps,
} from "@/utils/types/paymentLink";
import { useRouter } from "next/router";
import PaymentLinkDetailPanel from "./PaymentLinkDetailPanel";
import CurrencyExchangeRounded from "@mui/icons-material/CurrencyExchangeRounded";
import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
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
  // Cards below 1200px: the 7-column table needs ~1100px, so tablets (768-1199)
  // get a 2-column card grid instead of a sideways-scrolling table.
  const isMobile = useMediaQuery("(max-width:1199.95px)");
  const isPhone = useMediaQuery("(max-width:767.95px)");
  // §4.2 rulebook: pinned first (ID) column + edge-fade scroll hints ≥768px.
  const { ref: hscrollRef, showLeft: hasScrolledX, showRight: hasMoreRight } = useEdgeFades<HTMLDivElement>();
  const frozenEdgeShadow = hasScrolledX
    ? theme.palette.mode === "dark"
      ? "10px 0 14px -8px rgba(0,0,0,0.75)"
      : "10px 0 14px -8px rgba(15,15,20,0.32)"
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
  const { selectedCompanyId } = useCompanyStore();
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [deleteModel, setDeleteModel] = useState<boolean>(false);
  const [cryptoRefundLinkId, setCryptoRefundLinkId] = useState<string | null>(null);
  const { refundMap, mutateRefunds } = useRefundMap("payment_link");
  const [deleteId, setDeletId] = useState<string>("");
  // Desktop row overflow ("⋯") menu + its QR popover — keeps the actions
  // column to 4 controls so Status / Last 30 days are visible without a
  // horizontal scroll.
  const [rowMenu, setRowMenu] = useState<{ anchor: HTMLElement; row: PaymentLinkData } | null>(null);
  const [qrRow, setQrRow] = useState<{ anchor: HTMLElement; row: PaymentLinkData } | null>(null);
  // Bulk selection (across pages — keyed by link id).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const orderChip = (
    <TransactionSourceBadge source={{ type: "product", title: null }} />
  );

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

  // ── Expired-link rescue: one-tap reactivate (fresh 7-day expiry) ──
  const refetchLinks = () =>
    dispatch(PaymentLinkAction(PAYLINK_FETCH, selectedCompanyId ? { company_id: selectedCompanyId } : undefined));
  const handleExtend = async (id: string) => {
    if (extendingId) return;
    const linkId = String(id);
    setExtendingId(linkId);
    try {
      const res = await axiosBaseApi.put(`/pay/links/${linkId}`, { expire: "7d" });
      if (res?.data?.data) {
        fireToast(String(t("extendSuccess", { defaultValue: "Link reactivated — live for 7 more days" })), "success");
        setDetailId(null);
        refetchLinks();
      } else {
        fireToast(res?.data?.message || String(t("extendError", { defaultValue: "Couldn't reactivate the link" })), "error");
      }
    } catch (e: any) {
      fireToast(e?.response?.data?.message || String(t("extendError", { defaultValue: "Couldn't reactivate the link" })), "error");
    } finally {
      setExtendingId(null);
    }
  };

  // ── Bulk-action derived state + handlers ──
  const pageIds = paginatedData.map((r) => String(r.id));
  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const selectPage = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => next.add(id));
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());
  const selectedLinks = paymentLinks.filter((l) => selectedIds.has(String(l.id)));
  const exportSelectedCsv = () => {
    downloadCsv(
      "payment-links.csv",
      ["Link ID", "Description", "Amount", "Crypto", "Status", "Created", "Payments"],
      selectedLinks.map((l) => [
        l.id,
        l.description || "",
        l.usdValue || "",
        l.cryptoValue || "",
        l.status || "",
        l.createdAt || "",
        l.timesUsed ?? 0,
      ]),
    );
  };
  const copySelectedLinks = async () => {
    const urls = selectedLinks
      .map((l) => toShortPayLink(l.paymentUrl))
      .filter(Boolean)
      .join("\n");
    const ok = await copyToClipboard(urls);
    fireToast(ok ? String(tCommon("copiedToClipboard")) : String(tCommon("copyFailed")), ok ? "success" : "error");
  };
  const selectionBar = (
    <SelectionBar
      testid="paylinks-selection-bar"
      count={selectedIds.size}
      pageAllSelected={pageAllSelected}
      onSelectPage={selectPage}
      onClear={clearSelection}
      actions={[
        { label: t("exportSelected", { defaultValue: "Export CSV" }), onClick: exportSelectedCsv, icon: "download", testid: "paylinks-export-selected" },
        { label: t("copySelectedLinks", { defaultValue: "Copy links" }), onClick: copySelectedLinks, icon: "copy", testid: "paylinks-copy-selected" },
      ]}
    />
  );

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
        onExtend={handleExtend}
        extending={!!detailLink && extendingId === String(detailLink.id)}
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
          minHeight: 0,
          p: isMobile ? 0 : "0px",
        }}
      >
        {selectionBar}
        {/* MOBILE: Card layout */}
        {isMobile ? (
          <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: isPhone ? "1fr" : "repeat(2, minmax(0, 1fr))",
              gap: isPhone ? 1 : 1.5,
              px: isPhone ? 2 : 0,
            }}
          >
            {paginatedData.length === 0 ? (
              <Box sx={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", py: 4 }}>
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
                    <Box component="span" onClick={(e) => e.stopPropagation()} sx={{ display: "inline-flex" }}>
                    <Checkbox
                      size="small"
                      checked={selectedIds.has(String(row.id))}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(String(row.id))}
                      data-testid={`paylink-select-${row.id}`}
                      inputProps={{ "aria-label": "Select payment link" }}
                      sx={{ p: 0.5, mr: 0.25, mt: -0.5 }}
                    />
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, mr: 1, flexWrap: "wrap" }}>
                      <Typography sx={{ fontSize: "14px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary, lineHeight: 1.3 }}>
                        {row.description || t("paymentLinkFallback", { defaultValue: "Payment Link" })}
                      </Typography>
                      {row.linkType === "donation" && donationChip}
                      {row.linkType === "cart" && orderChip}
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
                      {row.linkType === "donation" && (
                        <Box component="span" sx={{ ml: 0.75, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, color: theme.palette.text.secondary }}>
                          {t("raisedCaption", { defaultValue: "raised" })}
                        </Box>
                      )}
                    </Typography>
                    <LinkCoinsBadge value={row.cryptoValue} size="xs" max={2} short />
                  </Box>
                  <Box sx={{ mb: 1 }}><Last30Cell link={row} compact /></Box>
                  {row.linkType === "donation" && row.donation?.goalAmount ? (
                    <Box sx={{ mb: 1 }}>{donationProgressBar(row, 999)}</Box>
                  ) : null}
                  {/* Meta line on its own row (was squeezed beside 6 buttons and wrapped to 4 lines) */}
                  <Typography sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, mb: 1.25 }}>
                    {formatUtcToDisplay(row.createdAt)}
                    {row.timesUsed > 0 ? ` · ${t("paymentsReceivedShort", { count: row.timesUsed })}` : ""}
                  </Typography>
                  {/* Actions: copy · share · view (+ reactivate) — QR / edit / delete / refund live in ⋯ */}
                  <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                    <Box sx={{ display: "flex", gap: "8px" }} onClick={(e) => e.stopPropagation()}>
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
                      <QrShareActions link={row} onToast={fireToast} compact hideQr />
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
                      {row.status === "expired" && row.linkType === "standard" && (
                        <Tooltip title={t("extendLinkTooltip", { defaultValue: "Reactivate link (7 days)" })} arrow>
                          <RowActionButton
                            tone="primary"
                            aria-label={t("extendLinkTooltip", { defaultValue: "Reactivate link (7 days)" })}
                            data-testid={`paylink-extend-mobile-${row.id}`}
                            disabled={extendingId === String(row.id)}
                            onClick={() => handleExtend(String(row.id))}
                            sx={{ width: 36, height: 36, minWidth: 36, borderRadius: "10px" }}
                          >
                            <AutorenewRounded sx={{ fontSize: 16 }} />
                          </RowActionButton>
                        </Tooltip>
                      )}
                      {CRYPTO_REFUNDS_ENABLED && refundMap[String(row.id)] && (
                        <RefundStatusChip
                          status={refundMap[String(row.id)].status}
                          testid={`paylink-refund-status-mobile-${row.id}`}
                        />
                      )}
                      {(row.status !== "expired" || (CRYPTO_REFUNDS_ENABLED && isRefundableLinkStatus(row.status))) && (
                        <Tooltip title={t("moreActionsTooltip", { defaultValue: "More actions" })} arrow>
                          <RowActionButton
                            aria-label={t("moreActionsTooltip", { defaultValue: "More actions" })}
                            aria-haspopup="menu"
                            data-testid={`paylink-more-mobile-${row.id}`}
                            onClick={(e) => setRowMenu({ anchor: e.currentTarget, row })}
                            sx={{ width: 36, height: 36, minWidth: 36, borderRadius: "10px" }}
                          >
                            <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
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
            <Table sx={{ width: "max-content", minWidth: "100%" }}>
              <TableHead
                sx={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  backgroundColor: headBg,
                  // Flat header: paper surface + hairline rule instead of a filled band.
                  "& .MuiTableCell-root": { borderBottom: `1px solid ${hairline(theme)}`, py: "14px", px: "14px" },
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
                  <TableCell sx={{ minWidth: 120 }}>
                    <Header label="statusHeader" tooltip="statusHeaderTip" />
                  </TableCell>
                  <TableCell
                    align="right"
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
                          ? "-10px 0 14px -8px rgba(0,0,0,0.75)"
                          : "-10px 0 14px -8px rgba(15,15,20,0.32)"
                        : "none",
                      transition: "box-shadow 160ms ease",
                    }}
                  >
                    <Header label="actionsHeader" align="right" />
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
                          height: "64px",
                          borderTop: i === 0 ? "none" : `1px solid ${rowDivider(theme)}`,
                        }}
                      >
                        {Array.from({ length: 7 }).map((__, colIdx) => (
                          <TableBodyCell key={colIdx} sx={{ pl: colIdx === 0 ? "15px" : undefined }}>
                            <Skeleton
                              variant="text"
                              width={colIdx === 0 ? 30 : colIdx === 6 ? 92 : 90}
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
                      // Roomier row rhythm (2026-10 polish): 64px desktop / 56px mobile
                      // gives the list clear breathing room so it no longer feels cramped,
                      // while still fitting plenty of rows above the fold.
                      height: isMobile ? "56px" : "64px",
                      borderTop: index === 0 ? "none" : `1px solid ${rowDivider(theme)}`,
                      cursor: "pointer",
                      transition: "background-color 120ms ease",
                      "&:hover, &:hover .sticky-cell": { backgroundColor: rowHover(theme) },
                    }}
                  >
                    <TableBodyCell className="sticky-cell" sx={{ pl: "8px", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: "13px", color: theme.palette.text.secondary, ...stickyFirstCellSx }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                        <Box component="span" onClick={(e) => e.stopPropagation()} sx={{ display: "inline-flex" }}>
                        <Checkbox
                          size="small"
                          checked={selectedIds.has(String(row.id))}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelect(String(row.id))}
                          data-testid={`paylink-select-${row.id}`}
                          inputProps={{ "aria-label": "Select payment link" }}
                          sx={{ p: 0.25 }}
                        />
                        </Box>
                        <Box component="span">{row.id}</Box>
                      </Box>
                    </TableBodyCell>
                    <TableBodyCell sx={{ maxWidth: 270 }} title={row.description || undefined}>
                      {row.linkType === "donation" ? (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 130 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                            <Box component="span" sx={{ minWidth: 0, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.description || "—"}</Box>
                            {donationChip}
                          </Box>
                          {donationProgressBar(row)}
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                          <Box component="span" sx={{ minWidth: 0, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.description || "—"}</Box>
                          {row.linkType === "cart" && orderChip}
                        </Box>
                      )}
                    </TableBodyCell>
                    <TableBodyCell sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", textAlign: "right", fontWeight: 600 }}>
                      {row.usdValue}
                      {row.linkType === "donation" && (
                        <Box component="span" sx={{ display: "block", fontFamily: "var(--font-sans)", fontSize: "11.5px", fontWeight: 500, color: theme.palette.text.secondary }}>
                          {t("raisedCaption", { defaultValue: "raised" })}
                        </Box>
                      )}
                    </TableBodyCell>
                    <TableBodyCell><LinkCoinsBadge value={row.cryptoValue} short /></TableBodyCell>
                    {/* Created + expiry stacked in ONE column — frees ~150px so
                        Status and Last 30 days fit without a horizontal scroll. */}
                    <TableBodyCell sx={{ whiteSpace: "nowrap" }} data-testid={`paylink-dates-${row.id}`}>
                      <Box component="span" sx={{ display: "block", lineHeight: 1.3 }}>{formatUtcToDisplay(row.createdAt)}</Box>
                      <Box component="span" sx={{ display: "block", fontSize: "11.5px", lineHeight: 1.3, color: theme.palette.text.secondary }}>
                        {row.expiresAt && row.expiresAt !== "Never"
                          ? t("expiresInline", { defaultValue: "Expires {{date}}", date: formatUtcToDisplay(row.expiresAt) })
                          : t("neverExpires", { defaultValue: "No expiry" })}
                      </Box>
                    </TableBodyCell>

                    <TableBodyCell sx={{ minWidth: 120 }}>
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
                      <Box sx={{ mt: "3px" }}><Last30Cell link={row} compact /></Box>
                    </TableBodyCell>

                    <TableBodyCell
                      align="right"
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
                            ? "-10px 0 14px -8px rgba(0,0,0,0.75)"
                            : "-10px 0 14px -8px rgba(15,15,20,0.32)"
                          : "none",
                        transition: "box-shadow 160ms ease",
                      }}
                    >
                      <Box
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
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
                      <QrShareActions link={row} onToast={fireToast} hideQr />
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
                      {row.status === "expired" && row.linkType === "standard" && (
                        <Tooltip title={t("extendLinkTooltip", { defaultValue: "Reactivate link (7 days)" })} arrow>
                          <RowActionButton
                            tone="primary"
                            aria-label={t("extendLinkTooltip", { defaultValue: "Reactivate link (7 days)" })}
                            data-testid={`paylink-extend-${row.id}`}
                            disabled={extendingId === String(row.id)}
                            onClick={() => handleExtend(String(row.id))}
                          >
                            <AutorenewRounded sx={{ fontSize: 17 }} />
                          </RowActionButton>
                        </Tooltip>
                      )}
                      {CRYPTO_REFUNDS_ENABLED && refundMap[String(row.id)] && (
                        <RefundStatusChip
                          status={refundMap[String(row.id)].status}
                          testid={`paylink-refund-status-${row.id}`}
                        />
                      )}
                      {(row.status !== "expired" || (CRYPTO_REFUNDS_ENABLED && isRefundableLinkStatus(row.status))) && (
                        <Tooltip title={t("moreActionsTooltip", { defaultValue: "More actions" })} arrow>
                          <RowActionButton
                            aria-label={t("moreActionsTooltip", { defaultValue: "More actions" })}
                            aria-haspopup="menu"
                            data-testid={`paylink-more-${row.id}`}
                            onClick={(e) => setRowMenu({ anchor: e.currentTarget, row })}
                          >
                            <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
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

      {/* Desktop row overflow menu — QR · Edit · Delete · Refund */}
      <Menu
        open={!!rowMenu}
        anchorEl={rowMenu?.anchor ?? null}
        onClose={() => setRowMenu(null)}
        data-testid="paylink-row-menu"
        slotProps={{ paper: { sx: { minWidth: 200, borderRadius: "12px", backgroundImage: "none", border: `1px solid ${hairline(theme)}` } } }}
      >
        {rowMenu && rowMenu.row.status !== "expired" && (
          <MenuItem
            data-testid="paylink-menu-qr"
            onClick={() => { setQrRow({ anchor: rowMenu.anchor, row: rowMenu.row }); setRowMenu(null); }}
          >
            <ListItemIcon><QrCode2RoundedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontFamily: "var(--font-sans)" }}>{t("qrTooltip", { defaultValue: "Show QR code" })}</ListItemText>
          </MenuItem>
        )}
        {rowMenu && rowMenu.row.status !== "expired" && rowMenu.row.status !== "paid" && rowMenu.row.status !== "completed" && rowMenu.row.linkType !== "cart" && (
          <MenuItem data-testid="paylink-menu-edit" onClick={() => { const id = rowMenu.row.id; setRowMenu(null); router.push(`/pay-links/${id}`); }}>
            <ListItemIcon><Image src={EditIcon} alt="" width={16} height={16} draggable={false} className="themed-icon" /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontFamily: "var(--font-sans)" }}>{t("editLinkTooltip", { defaultValue: "Edit link" })}</ListItemText>
          </MenuItem>
        )}
        {rowMenu && CRYPTO_REFUNDS_ENABLED && isRefundableLinkStatus(rowMenu.row.status) && (
          <MenuItem data-testid={`paylink-crypto-refund-${rowMenu.row.id}`} onClick={() => { const id = String(rowMenu.row.id); setRowMenu(null); setCryptoRefundLinkId(id); }}>
            <ListItemIcon><CurrencyExchangeRounded sx={{ fontSize: 18 }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontFamily: "var(--font-sans)" }}>{t("cryptoRefundTooltip", { defaultValue: "Crypto refund" })}</ListItemText>
          </MenuItem>
        )}
        {rowMenu && rowMenu.row.status !== "expired" && rowMenu.row.status !== "paid" && rowMenu.row.status !== "completed" && rowMenu.row.linkType !== "cart" && (
          <MenuItem
            data-testid="paylink-menu-delete"
            onClick={() => { const id = rowMenu.row.id; setRowMenu(null); setDeleteModel(true); setDeletId(id); }}
            sx={{ color: theme.palette.error.main }}
          >
            <ListItemIcon><Image src={TrashIcon} alt="" width={16} height={16} draggable={false} style={{ filter: "brightness(0) saturate(100%) invert(27%) sepia(86%) saturate(5000%) hue-rotate(355deg) brightness(97%) contrast(120%)" }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13.5, fontFamily: "var(--font-sans)", color: theme.palette.error.main }}>{t("deleteLinkTooltip", { defaultValue: "Delete link" })}</ListItemText>
          </MenuItem>
        )}
      </Menu>
      {qrRow && <RowQrPopover link={qrRow.row} anchor={qrRow.anchor} onClose={() => setQrRow(null)} />}

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
