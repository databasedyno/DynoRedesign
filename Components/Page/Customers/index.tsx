/**
 * Customers — re-imagined as a payments-derived CRM-lite (2026-08).
 *
 * Shows everyone who has paid (or been asked to pay) the merchant, unified by
 * email across payment links, store orders, tips, donations and API payments.
 * Anonymous payments (no contact captured) collapse into ONE bucket per
 * channel instead of dozens of "@dynopay.internal" placeholder rows.
 *
 * Data: GET /userApi/customers/directory (+ /detail) — see
 * backend/controller/customerDirectoryController.ts for the contract.
 * Channel chips reuse <TransactionSourceBadge> so classification is visually
 * identical to /transactions and the dashboard.
 */
import { tabPillActive } from "@/styles/tabPill";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { rowKeyProps } from "@/helpers/a11y";
import { MONO, Icon } from "@/styles/uiKit";
import { formatDateI18n } from "@/utils/formatDate";
import { avatarGradient } from "@/helpers/avatarGradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Skeleton,
  useTheme,
  Pagination,
  CircularProgress,
  Tooltip,
  MenuItem,
  Select,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
} from "@mui/material";
import useToast from "@/hooks/useToast";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import PersonAddAltRounded from "@mui/icons-material/PersonAddAltRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import SendRounded from "@mui/icons-material/SendRounded";
import CodeRounded from "@mui/icons-material/CodeRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import DonutSmallRounded from "@mui/icons-material/DonutSmallRounded";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import axiosBaseApi from "@/axiosConfig";
import { useApiSWR } from "@/hooks/useApiSWR";
import { useTranslation } from "react-i18next";
import { formatDisplayAmount } from "@/utils/currencyFormat";
import { useDisplayFx } from "@/hooks/useDisplayFx";
import useTableCardView from "@/hooks/useTableCardView";
import useIsMobile from "@/hooks/useIsMobile";
import { useRouter } from "next/router";
import CustomButton from "@/Components/UI/Buttons";
import { StatusDot, StatusTone } from "@/Components/UI/StatusDot";
import StatusChip from "@/Components/UI/StatusChip";
import { txStatusTone } from "@/helpers/txStatus";
import TransactionSourceBadge from "@/Components/UI/TransactionSourceBadge";
import CoinChips from "@/Components/UI/CoinChips";
import { API_ENDPOINTS } from "@/api/endpoints";
import { CustomerWalletPanel } from "./CustomerWalletPanel";
import BrandEscrowTotals from "./BrandEscrowTotals";
import { useEdgeFades, EdgeFades } from "@/Components/Common/ScrollHint";
import { toFixedStr } from "@/utils/money";
import ConsoleSummaryStrip from "@/Components/Console/SummaryStrip";
import ConsoleFilterBar from "@/Components/Console/FilterBar";
import ConsoleEmptyState from "@/Components/Console/EmptyState";
import ConsoleDetailSlideOver from "@/Components/Console/DetailSlideOver";
import { FilterChoiceGroup, PhoneFilters } from "@/Components/Common/FilterSheet";

/* ------------------------------------------------------------------ types */

type Channel = "payment_link" | "api" | "tip" | "product" | "contribution" | "direct";
type Segment = "prospect" | "new" | "active" | "repeat" | "dormant" | "anonymous";

interface DirectoryEntry {
  key: string;
  kind: "person" | "anonymous";
  name: string | null;
  email: string | null;
  mobile: string | null;
  channels: Channel[];
  payments_count: number;
  pending_count: number;
  links_count: number;
  ltv_usd: number;
  first_seen: string | null;
  last_payment: string | null;
  segment: Segment;
  has_wallet: boolean;
  wallet_balance: number;
  wallet_currency: string | null;
  customer_ids: number[];
  preferred_asset?: string | null;
  last_paid_usd?: number | null;
  last_paid_asset?: string | null;
  notes?: string | null;
  tags?: string[];
  manual?: boolean;
}

interface Aggregates {
  total_customers: number;
  revenue_usd: number;
  identified_revenue_usd: number;
  repeat_rate: number;
  new_this_month: number;
  anonymous_payments: number;
  anonymous_revenue_usd: number;
  paying_customers?: number;
  invited_count?: number;
  anonymous_buckets?: number;
}

interface DetailPayment {
  id: number;
  transaction_id: string | null;
  usd_value: number;
  base_amount: number | string | null;
  base_currency: string | null;
  crypto_amount: number | string | null;
  crypto_currency: string | null;
  status: string;
  channel: Channel;
  title: string | null;
  createdAt: string;
  transaction_reference: string | null;
}

interface DetailData {
  profile: DirectoryEntry;
  payments: DetailPayment[];
  payments_total: number;
  links: Array<Record<string, any>>;
  orders: Array<Record<string, any>>;
  wallet: { amount: number; wallet_type: string | null } | null;
}

/* ------------------------------------------------------------- constants */

// Paying customers first (default); invited people + unidentified payment buckets sit in their own filters.
const SEGMENT_FILTERS = ["paying", "repeat", "new", "dormant", "prospects", "anonymous", "all"] as const;
type SegmentFilter = (typeof SEGMENT_FILTERS)[number];

// Orders / payment links share the transaction colour map; a lapsed link or
// cancelled order is neutral (nothing went wrong), not a failure.
const statusTone = (status: string): StatusTone => {
  const s = (status || "").toLowerCase();
  if (s === "expired" || s === "cancelled") return "neutral";
  return txStatusTone(s);
};

const anonIcon = (channel: string, size = 18) => {
  switch (channel) {
    case "api":
      return <CodeRounded sx={{ fontSize: size }} />;
    case "payment_link":
      return <LinkRounded sx={{ fontSize: size }} />;
    case "tip":
      return <AutoAwesomeRounded sx={{ fontSize: size }} />;
    case "product":
      return <Inventory2Rounded sx={{ fontSize: size }} />;
    case "contribution":
      return <FavoriteRounded sx={{ fontSize: size }} />;
    default:
      return <DonutSmallRounded sx={{ fontSize: size }} />;
  }
};

/* ---------------------------------------------------------------- page */

const CustomersPage: React.FC = () => {
  const router = useRouter();
  const theme = useTheme();
  const cardView = useTableCardView(); // < 768px → card list
  const isMobile = useIsMobile("md");
  const isNarrow = useMediaQuery("(max-width:359.95px)");
  const isTablet = useIsMobile("lg"); // < 1200px → condensed table
  const { t } = useTranslation("common");
  const fx = useDisplayFx();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Move 4 (⌘K palette): seed the search box from a `?search=` deep link.
  const [searchSeeded, setSearchSeeded] = useState(false);
  useEffect(() => {
    if (!router.isReady || searchSeeded) return;
    const q = typeof router.query.search === "string" ? router.query.search : "";
    if (q) setSearch(q);
    setSearchSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, searchSeeded]);
  const [segment, setSegment] = useState<SegmentFilter>("paying");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { showToast } = useToast();
  const notify = (text: string, kind: "ok" | "err" = "ok") => showToast({ message: text, severity: kind === "err" ? "error" : "success" });

  const selectedCompanyId = useCompanyStore().selectedCompanyId;

  const isDark = theme.palette.mode === "dark";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#E9ECF2";
  // §4.2 rulebook: pinned first (Customer) column + edge-fade scroll hints ≥768px.
  const { ref: custScrollRef, showLeft: custScrolledX, showRight: custMoreRight } = useEdgeFades<HTMLDivElement>();
  const custFrozenShadow = custScrolledX
    ? isDark
      ? "8px 0 12px -8px rgba(0,0,0,0.6)"
      : "8px 0 12px -8px rgba(15,15,20,0.22)"
    : "none";
  const custStickyFirstSx = {
    position: "sticky" as const,
    left: 0,
    zIndex: 1,
    backgroundColor: isDark ? "#131316" : "#FFFFFF", // opaque ≈ cardBg over page bg
    boxShadow: custFrozenShadow,
    transition: "box-shadow 160ms ease",
  };
  const softBg = isDark ? "rgba(255,255,255,0.05)" : "#F6F7F9";
  const accent = isDark ? "#FFD100" : "#8B5E00";

  const eyebrowSx = {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: theme.palette.text.secondary,
    fontFamily: "var(--font-sans)",
  };
  const sansSx = { fontFamily: "var(--font-sans)" };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  /* --------------------------------------------------------- list fetch */
  const listParams = new URLSearchParams();
  listParams.set("page", String(page));
  listParams.set("limit", "20");
  listParams.set("segment", segment);
  listParams.set("sort", sort);
  if (debouncedSearch.trim()) listParams.set("search", debouncedSearch.trim());
  if (selectedCompanyId) listParams.set("company_id", String(selectedCompanyId));

  const { data: resp, isLoading, mutate } = useApiSWR<any>(
    [`${API_ENDPOINTS.userApi.customersDirectory}?${listParams.toString()}`, selectedCompanyId],
    { unwrap: true, keepPreviousData: true }
  );
  const customers: DirectoryEntry[] = resp?.customers || [];
  const totalPages: number = resp?.pages || 1;
  const total: number = resp?.total || 0;
  const aggregates: Aggregates = resp?.aggregates || {
    total_customers: 0,
    revenue_usd: 0,
    identified_revenue_usd: 0,
    repeat_rate: 0,
    new_this_month: 0,
    anonymous_payments: 0,
    anonymous_revenue_usd: 0,
  };
  const payingCount = aggregates.paying_customers ?? aggregates.total_customers;
  const invitedCount = aggregates.invited_count ?? 0;
  const unidentifiedInfo =
    aggregates.anonymous_payments > 0
      ? {
          count: aggregates.anonymous_payments,
          amount: fx.formatFromUsd(aggregates.anonymous_revenue_usd) || `$${toFixedStr(aggregates.anonymous_revenue_usd, 2)}`,
          onView: () => {
            setSegment("anonymous");
            setPage(1);
          },
        }
      : undefined;
  const loading = isLoading && resp === undefined;

  /* ---------------------------------------------------------- detail */
  const openDetail = async (key: string) => {
    setDetailKey(key);
    setDetail(null);
    setDetailLoading(true);
    try {
      const params: Record<string, string> = { key };
      if (selectedCompanyId) params.company_id = String(selectedCompanyId);
      const res = await axiosBaseApi.get(API_ENDPOINTS.userApi.customersDirectoryDetail, { params });
      setDetail(res.data?.data || null);
    } catch (err) {
      console.error("Failed to fetch customer detail", err);
    } finally {
      setDetailLoading(false);
    }
  };
  const closeDetail = () => {
    setDetailKey(null);
    setDetail(null);
    setCopied(false);
  };

  /* ---------------------------------------------------------- helpers */
  const fmtDate = (d?: string | null) =>
    d ? formatDateI18n(d, { year: "numeric", month: "short", day: "numeric" }) : "—";

  const anonName = (key: string) => {
    const ch = key.replace(/^anon:/, "");
    const map: Record<string, string> = {
      api: t("customers.anonApi", { defaultValue: "API payments" }),
      payment_link: t("customers.anonPaymentLink", { defaultValue: "Payment link payers" }),
      tip: t("customers.anonTip", { defaultValue: "Tip supporters" }),
      product: t("customers.anonProduct", { defaultValue: "Store buyers" }),
      contribution: t("customers.anonContribution", { defaultValue: "Donors" }),
      direct: t("customers.anonDirect", { defaultValue: "Direct payments" }),
    };
    return map[ch] || map.direct;
  };

  const displayName = (c: DirectoryEntry) =>
    c.kind === "anonymous" ? anonName(c.key) : c.name || c.email || "—";

  const segmentLabel = (s: Segment) => {
    const map: Record<Segment, string> = {
      prospect: t("customers.segProspect", { defaultValue: "Invited" }),
      new: t("customers.segNew", { defaultValue: "New" }),
      active: t("customers.segActive", { defaultValue: "Active" }),
      repeat: t("customers.segRepeat", { defaultValue: "Repeat" }),
      dormant: t("customers.segDormant", { defaultValue: "Dormant" }),
      anonymous: t("customers.segAnonymous", { defaultValue: "Anonymous" }),
    };
    return map[s];
  };

  const segmentTone = (s: Segment): StatusTone => {
    if (s === "repeat") return "settled";
    if (s === "new") return "info";
    if (s === "dormant") return "unpaid";
    if (s === "prospect") return "pending";
    if (s === "anonymous") return "neutral";
    return "neutral";
  };

  const requestPayment = (c: DirectoryEntry) => {
    const q = new URLSearchParams();
    if (c.email) q.set("email", c.email);
    if (c.name) q.set("name", c.name);
    router.push(`/create-pay-link?${q.toString()}`);
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  /* --------------------------------------------------------- CSV export */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "1000");
      params.set("segment", segment);
      params.set("sort", sort);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (selectedCompanyId) params.set("company_id", String(selectedCompanyId));
      const res = await axiosBaseApi.get(`${API_ENDPOINTS.userApi.customersDirectory}?${params.toString()}`);
      const rows: DirectoryEntry[] = res.data?.data?.customers || [];
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const header = ["name", "email", "mobile", "segment", "channels", "payments", "pending", "lifetime_value_usd", "first_seen", "last_payment", "last_paid_usd", "preferred_asset"];
      const lines = [header.join(",")].concat(
        rows.map((r) =>
          [
            esc(r.kind === "anonymous" ? anonName(r.key) : r.name || ""),
            esc(r.email || ""),
            esc(r.mobile || ""),
            esc(r.segment),
            esc(r.channels.join("|")),
            r.payments_count,
            r.pending_count,
            toFixedStr(r.ltv_usd, 2),
            esc(r.first_seen ? r.first_seen.slice(0, 10) : ""),
            esc(r.last_payment ? r.last_payment.slice(0, 10) : ""),
            r.last_paid_usd != null ? toFixedStr(r.last_paid_usd, 2) : "",
            esc(r.preferred_asset || ""),
          ].join(",")
        )
      );
      const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV export failed", err);
    } finally {
      setExporting(false);
    }
  };

  /* ------------------------------------------------------------ stats */
  const statCards = useMemo(
    () => [
      {
        id: "customers",
        label: t("customers.statPaying", { defaultValue: "Paying customers" }),
        value: String(payingCount),
        sub: invitedCount > 0 ? t("customers.statInvitedSub", { count: invitedCount, defaultValue: "+ {{count}} invited, not paid yet" }) : undefined,
        icon: <PeopleAltRounded sx={{ fontSize: 18 }} />,
      },
      {
        id: "revenue",
        label: t("customers.statNetRevenue", { defaultValue: "Net revenue" }),
        value: fx.formatFromUsd(aggregates.revenue_usd) || `$${toFixedStr(aggregates.revenue_usd, 2)}`,
        hint: t("customers.statNetRevenueHint", { defaultValue: "What you received after Dynopay fees, all time, from completed payments — including payments with no contact details. Tax is not included." }),
        icon: <PaymentsRounded sx={{ fontSize: 18 }} />,
      },
      {
        id: "repeat",
        label: t("customers.statRepeatRate", { defaultValue: "Repeat rate" }),
        value: `${Math.round(aggregates.repeat_rate * 100)}%`,
        icon: <ReplayRounded sx={{ fontSize: 18 }} />,
      },
      {
        id: "new",
        label: t("customers.statNew30d", { defaultValue: "New (30d)" }),
        value: String(aggregates.new_this_month),
        icon: <PersonAddAltRounded sx={{ fontSize: 18 }} />,
      },
    ],
    [aggregates, fx, t, payingCount, invitedCount]
  );

  const segmentChipLabel = (s: SegmentFilter) => {
    const map: Record<SegmentFilter, string> = {
      paying: t("customers.filterPaying", { defaultValue: "Paying" }),
      all: t("customers.filterAll", { defaultValue: "All" }),
      repeat: t("customers.filterRepeat", { defaultValue: "Repeat" }),
      new: t("customers.filterNew", { defaultValue: "New" }),
      dormant: t("customers.filterDormant", { defaultValue: "Dormant" }),
      prospects: t("customers.filterProspects", { defaultValue: "Invited" }),
      anonymous: t("customers.filterUnidentified", { defaultValue: "Unidentified payments" }),
    };
    return map[s];
  };

  /* -------------------------------------------------------- row pieces */
  const renderAvatar = (c: DirectoryEntry, size = 40) => (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: `${Math.round(size / 4)}px`,
        flexShrink: 0,
        bgcolor: c.kind === "anonymous" ? softBg : undefined,
        background: c.kind === "anonymous" ? undefined : avatarGradient(displayName(c)),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        color: c.kind === "anonymous" ? theme.palette.text.secondary : "#FFFFFF",
        fontSize: Math.round(size * 0.38),
        ...sansSx,
      }}
      aria-hidden="true"
    >
      {c.kind === "anonymous"
        ? anonIcon(c.key.replace(/^anon:/, ""), Math.round(size * 0.45))
        : (displayName(c)[0] || "?").toUpperCase()}
    </Box>
  );

  const renderTags = (c: DirectoryEntry, max = 3) => {
    const tg = c.tags || [];
    if (!tg.length) return null;
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }} data-testid={`customer-tags-${c.key}`}>
        {tg.slice(0, max).map((tag) => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            sx={{ height: 18, fontSize: "10.5px", fontWeight: 600, ...sansSx, bgcolor: isDark ? "rgba(255,209,0,0.15)" : "rgba(139,94,0,0.08)", color: accent, "& .MuiChip-label": { px: 0.75 } }}
          />
        ))}
        {tg.length > max && (
          <Typography sx={{ fontSize: "10.5px", color: theme.palette.text.secondary, ...sansSx }}>+{tg.length - max}</Typography>
        )}
      </Box>
    );
  };

  const renderChannelChips = (c: DirectoryEntry, max = 3) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
      {c.channels.slice(0, max).map((ch) => (
        <TransactionSourceBadge key={ch} source={{ type: ch }} compact />
      ))}
      {c.channels.length > max && (
        <Typography component="span" sx={{ fontSize: "11px", color: theme.palette.text.secondary, ...sansSx }}>
          +{c.channels.length - max}
        </Typography>
      )}
    </Box>
  );

  /* Wave 3c — "Last paid": date + the settled amount/asset of that payment. */
  const renderLastPaid = (c: DirectoryEntry, compact = false) => {
    if (!c.last_payment) {
      return (
        <Typography component="span" sx={{ fontSize: compact ? "11.5px" : "12.5px", color: theme.palette.text.secondary, ...sansSx }}>
          {compact ? t("customers.noPaymentsYet", { defaultValue: "No payments yet" }) : "—"}
        </Typography>
      );
    }
    const amount = c.last_paid_usd != null ? fx.formatFromUsd(c.last_paid_usd) || `$${toFixedStr(c.last_paid_usd, 2)}` : null;
    return (
      <Box component="span" data-testid={`customer-last-paid-${c.key}`} sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.75, whiteSpace: "nowrap" }}>
        {amount && (
          <Typography component="span" className="tabular-nums" sx={{ fontSize: compact ? "12px" : "13px", fontWeight: 600, fontFamily: MONO, color: theme.palette.text.primary }}>
            {amount}
          </Typography>
        )}
        <Typography component="span" sx={{ fontSize: compact ? "11.5px" : "12px", color: theme.palette.text.secondary, ...sansSx }}>
          {amount ? `· ${fmtDate(c.last_payment)}` : fmtDate(c.last_payment)}
        </Typography>
      </Box>
    );
  };

  /* Wave 3c — preferred asset chip (most-used coin across settled payments). */
  const renderPreferredAsset = (c: DirectoryEntry) =>
    c.preferred_asset ? (
      <Box component="span" data-testid={`customer-asset-${c.key}`} sx={{ display: "inline-flex" }}>
        <CoinChips value={c.preferred_asset} max={1} size="xs" />
      </Box>
    ) : (
      <Typography component="span" sx={{ fontSize: "12px", color: theme.palette.text.secondary, ...sansSx }}>—</Typography>
    );

  const secondaryLine = (c: DirectoryEntry) => {
    if (c.kind === "anonymous") return t("customers.anonHint", { defaultValue: "No contact details captured" });
    if (c.name) return c.email || "—";
    // Title already shows the email — avoid repeating it on the second line.
    if (c.payments_count === 0 && c.links_count > 0)
      return t("customers.linksSentShort", { count: c.links_count, defaultValue: "{{count}} payment request sent" });
    return t("customers.firstSeenShort", { date: fmtDate(c.first_seen), defaultValue: "First seen {{date}}" });
  };

  /* ============================================================ render */
  return (
    <Box sx={{ px: { xs: 2, md: 0 }, py: { xs: 1, md: 0 } }}>
      {/* Stats — airy Console SummaryStrip (2×2 on phones, 4-up from sm) */}
      <ConsoleSummaryStrip
        testid="customers-summary-strip"
        items={statCards.map((card) => ({
          testid: `customers-stat-${card.id}`,
          label: card.label,
          value: loading ? <Skeleton width={64} /> : card.value,
          sub: loading ? undefined : (card as { sub?: string }).sub,
          hint: (card as { hint?: string }).hint,
        }))}
      />

      <BrandEscrowTotals companyId={selectedCompanyId} cardBorder={cardBorder} />

      {/* Toolbar: search + sort + export — Console FilterBar */}
      <ConsoleFilterBar
        testid="customers-filter-bar"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("customers.searchPlaceholder"),
          testid: "customers-search-input",
        }}
      >
        <Box
          data-testid="customers-toolbar-controls"
          sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "nowrap", minWidth: 0, flex: { xs: "1 1 100%", sm: "0 0 auto" } }}
        >
        {isMobile ? (
          // Phones (blueprint §8.4): [search] [Filters] — Sort lives in the shared bottom sheet.
          <Box sx={{ flex: "1 1 0", minWidth: 0, display: "flex", "& > button": { flex: 1, justifyContent: "center" } }}>
            <PhoneFilters
              testIdPrefix="customers"
              activeCount={sort !== "recent" ? 1 : 0}
              onClear={() => {
                setSort("recent");
                setPage(1);
              }}
            >
              <FilterChoiceGroup
                label={t("customers.sortLabel", { defaultValue: "Sort customers" })}
                value={sort as string}
                onChange={(v) => {
                  setSort(v);
                  setPage(1);
                }}
                testIdPrefix="customers-sort"
                options={[
                  { value: "recent", label: t("customers.sortRecent", { defaultValue: "Most recent" }) },
                  { value: "ltv", label: t("customers.sortLtv", { defaultValue: "Highest value" }) },
                  { value: "payments", label: t("customers.sortPayments", { defaultValue: "Most payments" }) },
                  { value: "name", label: t("customers.sortName", { defaultValue: "Name" }) },
                ]}
              />
            </PhoneFilters>
          </Box>
        ) : (
        <Select
          value={sort}
          size="small"
          data-testid="customers-sort-select"
          inputProps={{ "aria-label": t("customers.sortLabel", { defaultValue: "Sort customers" }) }}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          sx={{
            borderRadius: "10px",
            bgcolor: cardBg,
            ...sansSx,
            fontSize: "13px",
            minWidth: { xs: 0, sm: 150 },
            flex: { xs: "1 1 0", sm: "0 0 auto" },
            "& .MuiSelect-select": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
            "& fieldset": { borderColor: cardBorder },
          }}
        >
          <MenuItem value="recent" sx={{ fontSize: "13px", ...sansSx }}>
            {t("customers.sortRecent", { defaultValue: "Most recent" })}
          </MenuItem>
          <MenuItem value="ltv" sx={{ fontSize: "13px", ...sansSx }}>
            {t("customers.sortLtv", { defaultValue: "Highest value" })}
          </MenuItem>
          <MenuItem value="payments" sx={{ fontSize: "13px", ...sansSx }}>
            {t("customers.sortPayments", { defaultValue: "Most payments" })}
          </MenuItem>
          <MenuItem value="name" sx={{ fontSize: "13px", ...sansSx }}>
            {t("customers.sortName", { defaultValue: "Name" })}
          </MenuItem>
        </Select>
        )}
        <CustomButton
          label={t("customers.addCustomer", { defaultValue: "Add customer" })}
          variant="primary"
          size="small"
          startIcon={<PersonAddAltRounded sx={{ fontSize: 17 }} />}
          hideLabel={isNarrow}
          sx={{ flexShrink: 0, ...(isNarrow ? { minWidth: 44, px: 1.25 } : {}) }}
          onClick={() => setAddOpen(true)}
          data-testid="customers-add-btn"
        />
        <Tooltip title={t("customers.exportCsvHint", { defaultValue: "Download the current list as CSV" })} arrow>
          <span>
            <IconButton
              onClick={exportCsv}
              disabled={exporting || loading || total === 0}
              data-testid="customers-export-csv"
              sx={{
                border: `1px solid ${cardBorder}`,
                borderRadius: "10px",
                bgcolor: cardBg,
                width: 40,
                height: 40,
              }}
              aria-label={t("customers.exportCsv", { defaultValue: "Export CSV" })}
            >
              {exporting ? (
                <CircularProgress size={16} />
              ) : (
                <FileDownloadOutlined sx={{ fontSize: 19, color: theme.palette.text.secondary }} />
              )}
            </IconButton>
          </span>
        </Tooltip>
        </Box>
      </ConsoleFilterBar>

      {/* Segment chips — horizontally scrollable on small screens */}
      <Box
        sx={{
          display: "flex",
          gap: 0.75,
          mb: 2,
          overflowX: "auto",
          pb: 0.5,
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
        }}
        data-testid="customers-segment-chips"
      >
        {SEGMENT_FILTERS.map((s) => {
          const active = segment === s;
          return (
            <Box
              key={s}
              component="button"
              data-testid={`customers-segment-${s}`} data-touch-44=""
              onClick={() => {
                setSegment(s);
                setPage(1);
              }}
              sx={{
                appearance: "none",
                border: `1px solid ${cardBorder}`,
                bgcolor: cardBg,
                ...(active
                  ? tabPillActive(theme)
                  : { color: theme.palette.text.secondary, "&:hover": { color: theme.palette.text.primary } }),
                borderRadius: "999px",
                px: 1.5,
                py: 0.6,
                minHeight: { xs: 36, md: 0 },
                fontSize: "13px",
                fontWeight: 600,
                ...sansSx,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "background-color 120ms ease, color 120ms ease, border-color 120ms ease",
              }}
            >
              {segmentChipLabel(s)}
            </Box>
          );
        })}
        <Box sx={{ flexGrow: 1 }} />
        {!loading && total > 0 && (
          <Typography
            data-testid="customers-count-label"
            sx={{
              fontSize: "12.5px",
              color: theme.palette.text.secondary,
              ...sansSx,
              whiteSpace: "nowrap",
              alignSelf: "center",
              display: { xs: "none", sm: "block" },
            }}
          >
            {t("customers.countLabel", { count: total })}
          </Typography>
        )}
      </Box>

      {/* Unidentified payments are summarised here instead of mixed in with people. */}
      {segment === "paying" && !debouncedSearch.trim() && aggregates.anonymous_payments > 0 && customers.length > 0 && (
        <Box
          data-testid="customers-unidentified-summary"
          sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 2, px: 1.75, py: 1.25, borderRadius: "10px", border: `1px dashed ${cardBorder}`, ...sansSx, fontSize: "13px", color: theme.palette.text.secondary }}
        >
          <Icon name="user-x" size={15} />
          <Box component="span" sx={{ flex: 1, minWidth: 200 }}>
            {t("customers.unidentifiedSummary", {
              count: aggregates.anonymous_payments,
              amount: fx.formatFromUsd(aggregates.anonymous_revenue_usd) || `$${toFixedStr(aggregates.anonymous_revenue_usd, 2)}`,
              defaultValue: "Plus {{count}} payments ({{amount}}) with no contact details — API, payment links and direct payments.",
            })}
          </Box>
          <Box
            component="button"
            type="button"
            data-testid="customers-unidentified-view"
            onClick={() => {
              setSegment("anonymous");
              setPage(1);
            }}
            sx={{ all: "unset", cursor: "pointer", fontWeight: 600, color: theme.palette.text.primary, textDecoration: "underline", textUnderlineOffset: 3, "&:focus-visible": { outline: `2px solid ${accent}`, outlineOffset: 2 } }}
          >
            {t("customers.unidentifiedView", { defaultValue: "View breakdown" })}
          </Box>
        </Box>
      )}

      {/* ---------------------------------------------------------- list */}
      {cardView ? (
        /* ------------------------------------------- mobile card list */
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }} data-testid="customers-card-list">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Box key={i} sx={{ p: 2, borderRadius: "12px", border: `1px solid ${cardBorder}`, bgcolor: cardBg }}>
                <Skeleton width="55%" height={18} />
                <Skeleton width="35%" height={16} />
              </Box>
            ))
          ) : customers.length === 0 ? (
            <EmptyState
              search={debouncedSearch}
              segment={segment}
              t={t}
              theme={theme}
              cardBg={cardBg}
              cardBorder={cardBorder}
              onCreate={() => router.push("/create-pay-link")}
              unidentified={unidentifiedInfo}
            />
          ) : (
            customers.map((c) => (
              <Box
                key={c.key}
                data-testid={`customer-card-${c.key}`}
                {...rowKeyProps(() => openDetail(c.key))}
                onClick={() => openDetail(c.key)}
                sx={{
                  p: "14px 16px",
                  borderRadius: "12px",
                  border: `1px solid ${cardBorder}`,
                  bgcolor: cardBg,
                  cursor: "pointer",
                  "&:active": { bgcolor: softBg },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  {renderAvatar(c)}
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography
                      sx={{
                        fontWeight: 600,
                        fontSize: "14.5px",
                        color: theme.palette.text.primary,
                        ...sansSx,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {displayName(c)}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "12.5px",
                        color: theme.palette.text.secondary,
                        ...sansSx,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {secondaryLine(c)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    <Typography
                      className="tabular-nums"
                      sx={{ fontWeight: 700, fontSize: "14.5px", fontFamily: MONO, color: theme.palette.text.primary }}
                    >
                      {fx.formatFromUsd(c.ltv_usd) || `$${toFixedStr(c.ltv_usd, 2)}`}
                    </Typography>
                    <Typography sx={{ fontSize: "11.5px", color: theme.palette.text.secondary, ...sansSx }}>
                      {t("customers.paymentsShort", { count: c.payments_count, defaultValue: "{{count}} payments" })}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.25, flexWrap: "wrap" }}>
                  <StatusDot tone={segmentTone(c.segment)}>{segmentLabel(c.segment)}</StatusDot>
                  {renderChannelChips(c, 2)}
                  {renderTags(c, 2)}
                  {c.preferred_asset && renderPreferredAsset(c)}
                  <Box sx={{ flexGrow: 1 }} />
                  {renderLastPaid(c, true)}
                </Box>
              </Box>
            ))
          )}
        </Box>
      ) : (
        /* --------------------------------------------------- table view */
        <Box sx={{ position: "relative" }}>
        <TableContainer
          ref={custScrollRef}
          sx={{
            borderRadius: "14px",
            border: `1px solid ${cardBorder}`,
            bgcolor: cardBg,
          }}
          data-testid="customers-table"
        >
          <Table size="small" sx={{ minWidth: isMobile ? 560 : 640 }}>
            <TableHead>
              <TableRow>
                {[
                  { label: t("customers.colCustomer"), align: "left" as const },
                  ...(isTablet
                    ? []
                    : [{ label: t("customers.colChannels", { defaultValue: "Channels" }), align: "left" as const }]),
                  { label: t("customers.colPayments", { defaultValue: "Payments" }), align: "right" as const },
                  { label: t("customers.colLifetimeValue", { defaultValue: "Lifetime value" }), align: "right" as const },
                  // < 900px: drop "Asset" + "Last paid" so Status never falls off-screen
                  ...(isMobile
                    ? []
                    : [
                        { label: t("customers.colPreferredAsset", { defaultValue: "Pays with" }), align: "left" as const },
                        { label: t("customers.colLastPaid", { defaultValue: "Last paid" }), align: "left" as const },
                      ]),
                  { label: t("customers.colStatus"), align: "left" as const },
                  ...(isMobile ? [] : [{ label: "", align: "right" as const }]),
                ].map((col, i) => (
                  <TableCell
                    key={i}
                    align={col.align}
                    sx={{
                      ...eyebrowSx,
                      py: 1.5,
                      borderColor: cardBorder,
                      whiteSpace: "nowrap",
                      ...(i === 0 ? { ...custStickyFirstSx, zIndex: 2 } : {}),
                    }}
                  >
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} sx={{ borderColor: cardBorder }}>
                      <Skeleton height={36} />
                    </TableCell>
                  </TableRow>
                ))
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ border: 0, py: 6 }}>
                    <EmptyState
                      search={debouncedSearch}
                      segment={segment}
                      t={t}
                      theme={theme}
                      cardBg="transparent"
                      cardBorder="transparent"
                      onCreate={() => router.push("/create-pay-link")}
                      unidentified={unidentifiedInfo}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow
                    key={c.key}
                    hover
                    data-testid={`customer-row-${c.key}`}
                    {...rowKeyProps(() => openDetail(c.key))}
                    onClick={() => openDetail(c.key)}
                    sx={{ cursor: "pointer", "&:last-child td": { borderBottom: 0 } }}
                  >
                    <TableCell sx={{ borderColor: cardBorder, py: 1.25, maxWidth: 320, ...custStickyFirstSx }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                        {renderAvatar(c, 36)}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            sx={{
                              fontWeight: 600,
                              fontSize: "13.5px",
                              color: theme.palette.text.primary,
                              ...sansSx,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {displayName(c)}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: "12px",
                              color: theme.palette.text.secondary,
                              ...sansSx,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {secondaryLine(c)}
                          </Typography>
                          {c.tags && c.tags.length > 0 && (
                            <Box sx={{ mt: 0.5 }}>{renderTags(c, 3)}</Box>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    {!isTablet && (
                      <TableCell sx={{ borderColor: cardBorder }}>
                        {renderChannelChips(c)}
                      </TableCell>
                    )}
                    <TableCell align="right" sx={{ borderColor: cardBorder }}>
                      <Typography
                        component="span"
                        className="tabular-nums"
                        sx={{ fontSize: "13px", fontFamily: MONO, color: theme.palette.text.primary }}
                      >
                        {c.payments_count}
                      </Typography>
                      {c.pending_count > 0 && (
                        <Typography
                          component="span"
                          sx={{ fontSize: "11px", color: "#B45309", ml: 0.75, ...sansSx }}
                        >
                          +{c.pending_count} {t("customers.pendingShort", { defaultValue: "pending" })}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ borderColor: cardBorder }}>
                      <Typography
                        component="span"
                        className="tabular-nums"
                        sx={{ fontSize: "13px", fontWeight: 700, fontFamily: MONO, color: theme.palette.text.primary }}
                      >
                        {fx.formatFromUsd(c.ltv_usd) || `$${toFixedStr(c.ltv_usd, 2)}`}
                      </Typography>
                    </TableCell>
                    {!isMobile && (
                      <>
                        <TableCell sx={{ borderColor: cardBorder, whiteSpace: "nowrap" }}>{renderPreferredAsset(c)}</TableCell>
                        <TableCell sx={{ borderColor: cardBorder, whiteSpace: "nowrap" }}>{renderLastPaid(c)}</TableCell>
                      </>
                    )}
                    <TableCell sx={{ borderColor: cardBorder, whiteSpace: "nowrap" }}>
                      <StatusDot tone={segmentTone(c.segment)}>{segmentLabel(c.segment)}</StatusDot>
                    </TableCell>
                    {!isMobile && (
                      <TableCell align="right" sx={{ borderColor: cardBorder, width: 36, pr: 1.5 }}>
                        <ChevronRightRounded sx={{ fontSize: 18, color: theme.palette.text.secondary, verticalAlign: "middle" }} />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {/* §4.2 — right edge fade signals more columns off-screen. */}
        <EdgeFades showLeft={false} showRight={custMoreRight} />
        </Box>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2.5 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            size={isMobile ? "small" : "medium"}
            data-testid="customers-pagination"
          />
        </Box>
      )}

      {/* ------------------------------------------------- detail drawer */}
      <ConsoleDetailSlideOver
        open={!!detailKey}
        onClose={closeDetail}
        testid="customer-detail-drawer"
        closeTestid="customer-detail-close"
        width={480}
        title={
          detail ? (
            <Box component="span" data-testid="customer-detail-name">{displayName(detail.profile)}</Box>
          ) : (
            t("customers.detailTitle", { defaultValue: "Customer" })
          )
        }
        subtitle={
          detail
            ? detail.profile.kind === "person" && detail.profile.email
              ? (
                  <>
                    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail.profile.email}</Box>
                    <IconButton size="small" onClick={() => copyEmail(detail.profile.email!)} data-testid="customer-detail-copy-email" sx={{ p: 0.3, color: "inherit" }} aria-label={t("customers.copyEmail", { defaultValue: "Copy email" })}>
                      {copied ? <CheckRounded sx={{ fontSize: 13, color: "#10B981" }} /> : <ContentCopyRounded sx={{ fontSize: 12, color: "inherit" }} />}
                    </IconButton>
                  </>
                )
              : (detail.profile.mobile || t("customers.anonHint", { defaultValue: "No contact details captured" }))
            : undefined
        }
        headerAccessory={
          detail ? (
            <StatusDot tone={segmentTone(detail.profile.segment)}>{segmentLabel(detail.profile.segment)}</StatusDot>
          ) : undefined
        }
      >
        {detailLoading || !detail ? (
          <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <DetailPanel
            detail={detail}
            t={t}
            theme={theme}
            fx={fx}
            cardBorder={cardBorder}
            softBg={softBg}
            copied={copied}
            onCopyEmail={copyEmail}
            onRequestPayment={requestPayment}
            onClose={closeDetail}
            fmtDate={fmtDate}
            displayName={displayName}
            segmentLabel={segmentLabel}
            segmentTone={segmentTone}
            renderAvatar={renderAvatar}
            companyId={selectedCompanyId}
            onWalletChanged={() => { if (detailKey) void openDetail(detailKey); }}
            notify={notify}
            onAnnotationSaved={() => { void mutate(); if (detailKey) void openDetail(detailKey); }}
            onDeleted={() => { setDetailKey(null); void mutate(); }}
          />
        )}
      </ConsoleDetailSlideOver>

      <AddCustomerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        companyId={selectedCompanyId}
        onCreated={(email) => { setAddOpen(false); void mutate(); void openDetail(email); }}
        notify={notify}
        t={t}
        theme={theme}
        accent={accent}
      />
    </Box>
  );
};

/* --------------------------------------------------------- empty state */
const EmptyState: React.FC<{
  search: string;
  segment: string;
  t: any;
  theme: any;
  cardBg: string;
  cardBorder: string;
  onCreate: () => void;
  unidentified?: { count: number; amount: string; onView: () => void };
}> = ({ search, segment, t, cardBg, cardBorder, onCreate, unidentified }) => {
  // Payments exist but none carried contact details → point at the breakdown, not "create a link".
  if (!search && segment === "paying" && unidentified) {
    return (
      <Box data-testid="customers-empty-state" sx={{ borderRadius: "12px", border: cardBorder === "transparent" ? 0 : `1px solid ${cardBorder}`, bgcolor: cardBg }}>
        <ConsoleEmptyState
          testid="customers-empty-unidentified"
          icon={<Icon name="user-x" size={22} />}
          title={t("customers.noPayingTitle", { defaultValue: "No paying customers with contact details yet" })}
          description={t("customers.noPayingHint", {
            count: unidentified.count,
            amount: unidentified.amount,
            defaultValue: "Your {{count}} payments ({{amount}}) came through checkouts that didn't capture a name or email — API, payment links and direct payments.",
          })}
          action={{ label: t("customers.noPayingCta", { defaultValue: "View unidentified payments" }), onClick: unidentified.onView, testid: "customers-empty-view-unidentified" }}
          compact
        />
      </Box>
    );
  }
  const showCta = !search && (segment === "all" || segment === "paying");
  const title = search
    ? t("customers.noCustomersSearch")
    : segment !== "all" && segment !== "paying"
      ? t("customers.noCustomersSegment", { defaultValue: "No customers in this segment yet" })
      : t("customers.noCustomersTitle");
  return (
    <Box
      data-testid="customers-empty-state"
      sx={{
        borderRadius: "12px",
        border: cardBorder === "transparent" ? 0 : `1px solid ${cardBorder}`,
        bgcolor: cardBg,
      }}
    >
      <ConsoleEmptyState
        testid="customers-empty-inner"
        icon={<Icon name="users" size={22} />}
        title={title}
        description={
          showCta
            ? t("customers.noCustomersHint", {
                defaultValue:
                  "Customers appear here automatically when someone pays a link, buys from your store, tips or donates.",
              })
            : undefined
        }
        action={
          showCta
            ? { label: t("customers.noCustomersCtaCreate", { defaultValue: "Create a payment link" }), onClick: onCreate }
            : undefined
        }
        compact
      />
    </Box>
  );
};

/* --------------------------------------------------------- detail panel */
const DetailPanel: React.FC<{
  detail: DetailData;
  t: any;
  theme: any;
  fx: ReturnType<typeof useDisplayFx>;
  cardBorder: string;
  softBg: string;
  copied: boolean;
  onCopyEmail: (email: string) => void;
  onRequestPayment: (c: DirectoryEntry) => void;
  onClose: () => void;
  fmtDate: (d?: string | null) => string;
  displayName: (c: DirectoryEntry) => string;
  segmentLabel: (s: Segment) => string;
  segmentTone: (s: Segment) => StatusTone;
  renderAvatar: (c: DirectoryEntry, size?: number) => React.ReactNode;
  companyId?: string | number | null;
  onWalletChanged?: () => void;
  notify?: (text: string, kind?: "ok" | "err") => void;
  onAnnotationSaved?: () => void;
  onDeleted?: () => void;
}> = ({
  detail,
  t,
  theme,
  fx,
  cardBorder,
  softBg,
  copied,
  onCopyEmail,
  onRequestPayment,
  onClose,
  fmtDate,
  displayName,
  segmentLabel,
  segmentTone,
  renderAvatar,
  companyId,
  onWalletChanged,
  notify,
  onAnnotationSaved,
  onDeleted,
}) => {
  const c = detail.profile;
  const sansSx = { fontFamily: "var(--font-sans)" };
  const isPerson = c.kind === "person";
  const accent = theme.palette.mode === "dark" ? "#FFD100" : "#8B5E00";
  const [annNotes, setAnnNotes] = useState<string>(c.notes || "");
  const [annTags, setAnnTags] = useState<string[]>(c.tags || []);
  const [savingAnn, setSavingAnn] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const handleDeleteCustomer = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    if (!companyId || !c.email) return;
    setDeletingCustomer(true);
    try {
      await axiosBaseApi.delete(API_ENDPOINTS.userApi.customersManual, { data: { company_id: companyId, email: c.email } });
      notify?.(t("customers.deleted", { defaultValue: "Customer removed" }), "ok");
      onClose();
      onDeleted?.();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notify?.(msg || t("customers.deleteFailed", { defaultValue: "Couldn't remove customer" }), "err");
    } finally {
      setDeletingCustomer(false);
      setConfirmDelete(false);
    }
  };
  useEffect(() => {
    setAnnNotes(c.notes || "");
    setAnnTags(c.tags || []);
    setConfirmDelete(false);
  }, [c.key, c.notes, c.tags]);
  const annDirty = annNotes !== (c.notes || "") || JSON.stringify(annTags) !== JSON.stringify(c.tags || []);
  const saveAnnotation = async () => {
    if (!isPerson || !c.email || !companyId) return;
    setSavingAnn(true);
    try {
      await axiosBaseApi.post(API_ENDPOINTS.userApi.customersAnnotation, {
        company_id: String(companyId),
        email: c.email,
        notes: annNotes.trim() || null,
        tags: annTags,
      });
      notify?.(t("customers.notesSaved", { defaultValue: "Saved." }), "ok");
      onAnnotationSaved?.();
    } catch (e: any) {
      notify?.(e?.response?.data?.message || t("customers.notesFailed", { defaultValue: "Could not save." }), "err");
    } finally {
      setSavingAnn(false);
    }
  };

  const kpi = (label: string, value: React.ReactNode) => (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: "10.5px",
          fontWeight: 700,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: theme.palette.text.secondary,
          ...sansSx,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Typography>
      <Typography
        className="tabular-nums"
        sx={{
          fontSize: "15px",
          fontWeight: 700,
          fontFamily: MONO,
          color: theme.palette.text.primary,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </Typography>
    </Box>
  );

  const sectionTitle = (label: string) => (
    <Typography
      sx={{
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: theme.palette.text.secondary,
        ...sansSx,
        mb: 1,
        mt: 2.5,
      }}
    >
      {label}
    </Typography>
  );

  return (
    <Box>
      {/* actions */}
      {isPerson && c.email && (
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <CustomButton
            label={t("customers.requestPayment", { defaultValue: "Request payment" })}
            variant="primary"
            size="small"
            startIcon={<SendRounded sx={{ fontSize: 15 }} />}
            onClick={() => onRequestPayment(c)}
            data-testid="customer-detail-request-payment"
          />
          {c.manual && companyId && (
            <CustomButton
              label={deletingCustomer ? t("customers.deleting", { defaultValue: "Removing…" }) : confirmDelete ? t("customers.confirmRemove", { defaultValue: "Confirm remove" }) : t("customers.remove", { defaultValue: "Remove" })}
              variant="outlined"
              size="small"
              onClick={handleDeleteCustomer}
              disabled={deletingCustomer}
              data-testid="customer-detail-delete"
            />
          )}
        </Box>
      )}

      {/* KPIs */}
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          p: "12px 14px",
          borderRadius: "12px",
          border: `1px solid ${cardBorder}`,
          bgcolor: softBg,
        }}
      >
        {kpi(
          t("customers.kpiLifetime", { defaultValue: "Lifetime" }),
          fx.formatFromUsd(c.ltv_usd) || `$${toFixedStr(c.ltv_usd, 2)}`
        )}
        {kpi(t("customers.kpiPayments", { defaultValue: "Payments" }), c.payments_count)}
        {kpi(t("customers.kpiFirstSeen", { defaultValue: "First seen" }), fmtDate(c.first_seen))}
      </Box>

      {/* Notes & tags — merchant-private CRM overlay (identified customers only) */}
      {isPerson && c.email && (
        <Box sx={{ mt: 1.5, p: "12px 14px", borderRadius: "12px", border: `1px solid ${cardBorder}` }} data-testid="customer-detail-crm">
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography sx={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.palette.text.secondary, ...sansSx }}>
              {t("customers.crmSection", { defaultValue: "Notes & tags" })}
            </Typography>
            {c.manual && (
              <Chip size="small" label={t("customers.manualBadge", { defaultValue: "Added manually" })} data-testid="customer-detail-manual-badge" sx={{ height: 20, fontSize: "10.5px", ...sansSx }} />
            )}
          </Box>
          {companyId ? (
            <>
              <TagsEditor
                tags={annTags}
                onChange={setAnnTags}
                theme={theme}
                accent={accent}
                testIdPrefix="customer-detail"
                placeholder={t("customers.tagPlaceholder", { defaultValue: "Add a tag, press Enter" })}
                disabled={savingAnn}
              />
              <TextField
                value={annNotes}
                onChange={(e) => setAnnNotes(e.target.value)}
                placeholder={t("customers.notesPlaceholder", { defaultValue: "Private notes only you can see…" })}
                size="small"
                fullWidth
                multiline
                minRows={3}
                sx={{ mt: 1.5 }}
                inputProps={{ "data-testid": "customer-detail-notes-input", maxLength: 5000 }}
              />
              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                <CustomButton
                  label={t("customers.saveNotes", { defaultValue: "Save" })}
                  variant="primary"
                  size="small"
                  onClick={saveAnnotation}
                  loading={savingAnn}
                  disabled={savingAnn || !annDirty}
                  data-testid="customer-detail-notes-save"
                />
              </Box>
            </>
          ) : (
            <Typography sx={{ fontSize: "12.5px", color: theme.palette.text.secondary, ...sansSx }} data-testid="customer-detail-crm-need-brand">
              {t("customers.crmNeedBrand", { defaultValue: "Switch to a single brand to add private notes and tags." })}
            </Typography>
          )}
        </Box>
      )}

      {/* store credit — identified customers only, needs a single brand selected */}
      {isPerson ? (
        <CustomerWalletPanel
          customerKey={c.key}
          customerName={c.name}
          companyId={companyId}
          cardBorder={cardBorder}
          softBg={softBg}
          onChanged={onWalletChanged}
        />
      ) : detail.wallet && (
        <Box
          sx={{
            mt: 1.5,
            p: "12px 14px",
            borderRadius: "12px",
            border: `1px solid ${cardBorder}`,
            display: "flex",
            alignItems: "center",
            gap: 1.25,
          }}
          data-testid="customer-detail-wallet"
        >
          <AccountBalanceWalletRounded sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
          <Typography sx={{ fontSize: "13px", color: theme.palette.text.secondary, ...sansSx, flexGrow: 1 }}>
            {t("customers.walletBalance", { defaultValue: "Wallet balance" })}
          </Typography>
          <Typography className="tabular-nums" sx={{ fontSize: "14px", fontWeight: 700, fontFamily: MONO }}>
            {formatDisplayAmount(Number(detail.wallet.amount || 0), detail.wallet.wallet_type || "USD")}{" "}
            {detail.wallet.wallet_type || "USD"}
          </Typography>
        </Box>
      )}

      {/* payments */}
      {sectionTitle(
        t("customers.paymentsSection", {
          defaultValue: "Payments",
        }) + (detail.payments_total ? ` · ${detail.payments_total}` : "")
      )}
      {detail.payments.length === 0 ? (
        <Typography sx={{ fontSize: "13px", color: theme.palette.text.secondary, ...sansSx }}>
          {t("customers.noPaymentsYet", { defaultValue: "No payments yet" })}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {detail.payments.map((p) => (
            <Box
              key={p.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 1,
                borderBottom: `1px solid ${cardBorder}`,
                "&:last-child": { borderBottom: 0 },
              }}
              data-testid={`customer-detail-payment-${p.id}`}
            >
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                  <TransactionSourceBadge source={{ type: p.channel, title: p.title }} compact />
                </Box>
                <Typography sx={{ fontSize: "11.5px", color: theme.palette.text.secondary, ...sansSx, mt: 0.25 }}>
                  {fmtDate(p.createdAt)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                <Typography className="tabular-nums" sx={{ fontSize: "13px", fontWeight: 700, fontFamily: MONO }}>
                  {p.usd_value > 0
                    ? fx.formatFromUsd(p.usd_value) || `$${toFixedStr(p.usd_value, 2)}`
                    : `${formatDisplayAmount(Number(p.crypto_amount || p.base_amount || 0), p.crypto_currency || p.base_currency || "USD")} ${p.crypto_currency || p.base_currency || ""}`}
                </Typography>
                <StatusChip status={String(p.status || "")} short sx={{ fontSize: "12px" }} />
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* orders */}
      {detail.orders.length > 0 && (
        <>
          {sectionTitle(t("customers.ordersSection", { defaultValue: "Store orders" }))}
          {detail.orders.map((o) => (
            <Box
              key={String(o.order_id)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 0.9,
                borderBottom: `1px solid ${cardBorder}`,
                "&:last-child": { borderBottom: 0 },
              }}
            >
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography sx={{ fontSize: "13px", fontWeight: 600, color: theme.palette.text.primary, ...sansSx }}>
                  {String(o.order_number || o.public_ref || `#${o.order_id}`)}
                </Typography>
                <Typography sx={{ fontSize: "11.5px", color: theme.palette.text.secondary, ...sansSx }}>
                  {fmtDate(o.paid_at || o.createdAt)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography className="tabular-nums" sx={{ fontSize: "13px", fontWeight: 700, fontFamily: MONO }}>
                  {toFixedStr((Number(o.total_cents || 0) / 100), 2)} {String(o.currency || "USD")}
                </Typography>
                <StatusDot tone={statusTone(String(o.payment_status))}>
                  {t(`customers.status_${o.payment_status}`, { defaultValue: String(o.payment_status || "") })}
                </StatusDot>
              </Box>
            </Box>
          ))}
        </>
      )}

      {/* payment links sent */}
      {detail.links.length > 0 && (
        <>
          {sectionTitle(t("customers.linksSection", { defaultValue: "Links sent" }))}
          {detail.links.map((l) => (
            <Box
              key={String(l.link_id)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 0.9,
                borderBottom: `1px solid ${cardBorder}`,
                "&:last-child": { borderBottom: 0 },
              }}
            >
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography
                  sx={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    ...sansSx,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {String(l.title || t("customers.paymentLinkFallback", { defaultValue: "Payment link" }))}
                </Typography>
                <Typography sx={{ fontSize: "11.5px", color: theme.palette.text.secondary, ...sansSx }}>
                  {fmtDate(String(l.createdAt))}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                {Number(l.base_amount) > 0 && (
                  <Typography className="tabular-nums" sx={{ fontSize: "13px", fontWeight: 700, fontFamily: MONO }}>
                    {toFixedStr(l.base_amount, 2)} {String(l.base_currency || "")}
                  </Typography>
                )}
                <StatusDot tone={statusTone(String(l.status))}>
                  {t(`customers.status_${l.status}`, { defaultValue: String(l.status || "") })}
                </StatusDot>
              </Box>
            </Box>
          ))}
        </>
      )}

      {/* anonymous explainer */}
      {!isPerson && (
        <Alert
          severity="info"
          icon={false}
          sx={{
            mt: 2.5,
            borderRadius: "12px",
            fontSize: "12.5px",
            ...sansSx,
            bgcolor: softBg,
            color: theme.palette.text.secondary,
            border: `1px solid ${cardBorder}`,
          }}
          data-testid="customer-detail-anon-hint"
        >
          {t("customers.anonExplainer", {
            defaultValue:
              "These payments arrived without contact details (e.g. API payments or checkouts where email was optional). New store checkouts now always capture an email.",
          })}
        </Alert>
      )}
    </Box>
  );
};

/* ------------------------------------------------ tags editor (shared) */
const TagsEditor: React.FC<{
  tags: string[];
  onChange: (next: string[]) => void;
  theme: any;
  accent: string;
  testIdPrefix: string;
  placeholder: string;
  disabled?: boolean;
}> = ({ tags, onChange, theme, accent, testIdPrefix, placeholder, disabled }) => {
  const [draft, setDraft] = useState("");
  const sansSx = { fontFamily: "var(--font-sans)" };
  const isDark = theme.palette.mode === "dark";
  const addTag = (raw: string) => {
    const v = raw.trim().slice(0, 40);
    setDraft("");
    if (!v) return;
    if (tags.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    if (tags.length >= 20) return;
    onChange([...tags, v]);
  };
  return (
    <Box>
      {tags.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1 }} data-testid={`${testIdPrefix}-tags`}>
          {tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              onDelete={disabled ? undefined : () => onChange(tags.filter((x) => x !== tag))}
              data-testid={`${testIdPrefix}-tag-${tag.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}
              sx={{ ...sansSx, fontSize: "12px", fontWeight: 600, bgcolor: isDark ? "rgba(255,209,0,0.15)" : "rgba(139,94,0,0.08)", color: accent }}
            />
          ))}
        </Box>
      )}
      <TextField
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(draft);
          }
        }}
        onBlur={() => { if (draft.trim()) addTag(draft); }}
        placeholder={placeholder}
        size="small"
        fullWidth
        disabled={disabled}
        inputProps={{ "data-testid": `${testIdPrefix}-tag-input`, maxLength: 40 }}
      />
    </Box>
  );
};

/* --------------------------------------------- add customer dialog */
const AddCustomerDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  companyId?: string | number | null;
  onCreated: (email: string) => void;
  notify: (text: string, kind?: "ok" | "err") => void;
  t: any;
  theme: any;
  accent: string;
}> = ({ open, onClose, companyId, onCreated, notify, t, theme, accent }) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const sansSx = { fontFamily: "var(--font-sans)" };
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const reset = () => {
    setEmail("");
    setName("");
    setMobile("");
    setNotes("");
    setTags([]);
  };

  const submit = async () => {
    if (!emailValid) {
      notify(t("customers.add.invalidEmail", { defaultValue: "Enter a valid email address." }), "err");
      return;
    }
    if (!companyId) {
      notify(t("customers.add.needBrand", { defaultValue: "Switch to a single brand to add a customer." }), "err");
      return;
    }
    setSaving(true);
    try {
      await axiosBaseApi.post(API_ENDPOINTS.userApi.customersManual, {
        company_id: String(companyId),
        email: email.trim(),
        name: name.trim() || undefined,
        mobile: mobile.trim() || undefined,
        notes: notes.trim() || undefined,
        tags,
      });
      notify(t("customers.add.saved", { defaultValue: "Customer added." }), "ok");
      const created = email.trim().toLowerCase();
      reset();
      onCreated(created);
    } catch (e: any) {
      notify(e?.response?.data?.message || t("customers.add.failed", { defaultValue: "Could not add customer." }), "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: "16px", bgcolor: theme.palette.mode === "dark" ? "#101014" : "#FFFFFF", backgroundImage: "none" } }}
      data-testid="customers-add-dialog"
    >
      <DialogTitle sx={{ ...sansSx, fontWeight: 700, fontSize: "17px" }}>
        {t("customers.add.title", { defaultValue: "Add customer" })}
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.75, pt: "8px !important" }}>
        <Typography sx={{ fontSize: "12.5px", color: theme.palette.text.secondary, ...sansSx }}>
          {t("customers.add.subtitle", { defaultValue: "Add a contact manually. They appear as a prospect until they pay." })}
        </Typography>
        <TextField
          label={t("customers.add.email", { defaultValue: "Email" })}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          size="small"
          fullWidth
          required
          type="email"
          inputProps={{ "data-testid": "customers-add-email", maxLength: 255 }}
        />
        <TextField
          label={t("customers.add.name", { defaultValue: "Name (optional)" })}
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          fullWidth
          inputProps={{ "data-testid": "customers-add-name", maxLength: 120 }}
        />
        <TextField
          label={t("customers.add.mobile", { defaultValue: "Mobile (optional)" })}
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          size="small"
          fullWidth
          inputProps={{ "data-testid": "customers-add-mobile", maxLength: 40 }}
        />
        <Box>
          <Typography sx={{ fontSize: "12px", fontWeight: 600, color: theme.palette.text.secondary, ...sansSx, mb: 0.75 }}>
            {t("customers.add.tags", { defaultValue: "Tags (optional)" })}
          </Typography>
          <TagsEditor
            tags={tags}
            onChange={setTags}
            theme={theme}
            accent={accent}
            testIdPrefix="customers-add"
            placeholder={t("customers.tagPlaceholder", { defaultValue: "Add a tag, press Enter" })}
            disabled={saving}
          />
        </Box>
        <TextField
          label={t("customers.add.notes", { defaultValue: "Private notes (optional)" })}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          size="small"
          fullWidth
          multiline
          minRows={2}
          inputProps={{ "data-testid": "customers-add-notes", maxLength: 5000 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <CustomButton
          label={t("customers.add.cancel", { defaultValue: "Cancel" })}
          variant="outlined"
          size="small"
          onClick={onClose}
          disabled={saving}
          data-testid="customers-add-cancel"
        />
        <CustomButton
          label={t("customers.add.submit", { defaultValue: "Add customer" })}
          variant="primary"
          size="small"
          onClick={submit}
          loading={saving}
          disabled={saving || !emailValid}
          data-testid="customers-add-submit"
        />
      </DialogActions>
    </Dialog>
  );
};

export default CustomersPage;
