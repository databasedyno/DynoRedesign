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
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { MONO } from "@/styles/uiKit";
import { formatDateI18n } from "@/utils/formatDate";
import { avatarGradient } from "@/helpers/avatarGradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
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
  Drawer,
  CircularProgress,
  Tooltip,
  MenuItem,
  Select,
  Alert,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
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
import { formatCryptoAmount } from "@/utils/currencyFormat";
import { useDisplayFx } from "@/hooks/useDisplayFx";
import useTableCardView from "@/hooks/useTableCardView";
import useIsMobile from "@/hooks/useIsMobile";
import { useRouter } from "next/router";
import CustomButton from "@/Components/UI/Buttons";
import { StatusDot, StatusTone } from "@/Components/UI/StatusDot";
import TransactionSourceBadge from "@/Components/UI/TransactionSourceBadge";
import { API_ENDPOINTS } from "@/api/endpoints";
import { useEdgeFades, EdgeFades } from "@/Components/Common/ScrollHint";
import { toFixedStr } from "@/utils/money";

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
}

interface Aggregates {
  total_customers: number;
  revenue_usd: number;
  identified_revenue_usd: number;
  repeat_rate: number;
  new_this_month: number;
  anonymous_payments: number;
  anonymous_revenue_usd: number;
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

const SEGMENT_FILTERS = ["all", "repeat", "new", "dormant", "prospects", "anonymous"] as const;
type SegmentFilter = (typeof SEGMENT_FILTERS)[number];

const statusTone = (status: string): StatusTone => {
  const s = (status || "").toLowerCase();
  if (["successful", "success", "completed", "done", "settled"].includes(s)) return "settled";
  if (["pending", "processing", "confirmed"].includes(s)) return "pending";
  if (["failed", "cancelled", "expired"].includes(s)) return "failed";
  if (s === "unpaid") return "unpaid";
  return "neutral";
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
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

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
  const accent = isDark ? "#818CF8" : "#4F46E5";

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

  const { data: resp, isLoading } = useApiSWR<any>(
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
      const header = ["name", "email", "mobile", "segment", "channels", "payments", "pending", "lifetime_value_usd", "first_seen", "last_payment"];
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
        label: t("customers.statCustomers", { defaultValue: "Customers" }),
        value: String(aggregates.total_customers),
        icon: <PeopleAltRounded sx={{ fontSize: 18 }} />,
      },
      {
        id: "revenue",
        label: t("customers.statRevenue", { defaultValue: "Revenue" }),
        value: fx.formatFromUsd(aggregates.revenue_usd) || `$${toFixedStr(aggregates.revenue_usd, 2)}`,
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
    [aggregates, fx, t]
  );

  const segmentChipLabel = (s: SegmentFilter) => {
    const map: Record<SegmentFilter, string> = {
      all: t("customers.filterAll", { defaultValue: "All" }),
      repeat: t("customers.filterRepeat", { defaultValue: "Repeat" }),
      new: t("customers.filterNew", { defaultValue: "New" }),
      dormant: t("customers.filterDormant", { defaultValue: "Dormant" }),
      prospects: t("customers.filterProspects", { defaultValue: "Invited" }),
      anonymous: t("customers.filterAnonymous", { defaultValue: "Anonymous" }),
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
      {/* Stats — 2×2 on phones, 4-up from sm */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          gap: { xs: "10px", md: "16px" },
          mb: { xs: 2, md: 3 },
        }}
      >
        {statCards.map((card) => (
          <Box
            key={card.id}
            data-testid={`customers-stat-${card.id}`}
            sx={{
              bgcolor: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: "14px",
              p: { xs: "12px 14px", md: "18px 22px" },
              display: "flex",
              flexDirection: "column",
              gap: { xs: "6px", md: "10px" },
              minWidth: 0,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Typography sx={{ ...eyebrowSx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {card.label}
              </Typography>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "8px",
                  bgcolor: softBg,
                  display: { xs: "none", md: "flex" },
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.palette.text.secondary,
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </Box>
            </Box>
            <Typography
              className="tabular-nums"
              sx={{
                fontSize: { xs: "20px", md: "clamp(17px, 1.9vw, 28px)" },
                fontWeight: 700,
                lineHeight: 1.15,
                color: theme.palette.text.primary,
                fontFamily: MONO,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {loading ? <Skeleton width={70} /> : card.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Toolbar: search + sort + export */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          mb: 1.5,
          flexWrap: { xs: "wrap", sm: "nowrap" },
        }}
      >
        <TextField
          placeholder={t("customers.searchPlaceholder")}
          value={search}
          size="small"
          data-testid="customers-search-input"
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 19, color: theme.palette.text.secondary }} />
              </InputAdornment>
            ),
          }}
          sx={{
            flexGrow: 1,
            minWidth: { xs: "100%", sm: 220 },
            maxWidth: { sm: 380 },
            "& .MuiOutlinedInput-root": {
              borderRadius: "10px",
              bgcolor: cardBg,
              ...sansSx,
              fontSize: "14px",
              "& fieldset": { borderColor: cardBorder },
            },
          }}
        />
        <Select
          value={sort}
          size="small"
          data-testid="customers-sort-select"
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          sx={{
            borderRadius: "10px",
            bgcolor: cardBg,
            ...sansSx,
            fontSize: "13px",
            minWidth: 150,
            flexGrow: { xs: 1, sm: 0 },
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
              data-testid={`customers-segment-${s}`}
              onClick={() => {
                setSegment(s);
                setPage(1);
              }}
              sx={{
                appearance: "none",
                border: `1px solid ${active ? accent : cardBorder}`,
                bgcolor: active ? (isDark ? "rgba(99,102,241,0.15)" : "rgba(79,70,229,0.07)") : cardBg,
                color: active ? accent : theme.palette.text.secondary,
                borderRadius: "999px",
                px: 1.5,
                py: 0.6,
                fontSize: "12.5px",
                fontWeight: 600,
                ...sansSx,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 120ms ease",
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
            />
          ) : (
            customers.map((c) => (
              <Box
                key={c.key}
                data-testid={`customer-card-${c.key}`}
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
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography sx={{ fontSize: "11.5px", color: theme.palette.text.secondary, ...sansSx }}>
                    {c.last_payment ? fmtDate(c.last_payment) : t("customers.noPaymentsYet", { defaultValue: "No payments yet" })}
                  </Typography>
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
                  // < 900px: drop "Last payment" so Status never falls off-screen
                  ...(isMobile
                    ? []
                    : [{ label: t("customers.colLastPayment", { defaultValue: "Last payment" }), align: "left" as const }]),
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
                    <TableCell colSpan={7} sx={{ borderColor: cardBorder }}>
                      <Skeleton height={36} />
                    </TableCell>
                  </TableRow>
                ))
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ border: 0, py: 6 }}>
                    <EmptyState
                      search={debouncedSearch}
                      segment={segment}
                      t={t}
                      theme={theme}
                      cardBg="transparent"
                      cardBorder="transparent"
                      onCreate={() => router.push("/create-pay-link")}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow
                    key={c.key}
                    hover
                    data-testid={`customer-row-${c.key}`}
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
                      <TableCell sx={{ borderColor: cardBorder, whiteSpace: "nowrap" }}>
                        <Typography component="span" sx={{ fontSize: "12.5px", color: theme.palette.text.secondary, ...sansSx }}>
                          {c.last_payment ? fmtDate(c.last_payment) : "—"}
                        </Typography>
                      </TableCell>
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
      <Drawer
        anchor={isMobile ? "bottom" : "right"}
        open={!!detailKey}
        onClose={closeDetail}
        data-testid="customer-detail-drawer"
        PaperProps={{
          sx: {
            width: isMobile ? "100%" : 460,
            maxHeight: isMobile ? "92vh" : "100%",
            borderTopLeftRadius: isMobile ? "16px" : 0,
            borderTopRightRadius: isMobile ? "16px" : 0,
            bgcolor: isDark ? "#101014" : "#FFFFFF",
            backgroundImage: "none",
          },
        }}
      >
        {detailLoading || !detail ? (
          <Box sx={{ p: 6, display: "flex", justifyContent: "center" }}>
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
          />
        )}
      </Drawer>
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
}> = ({ search, segment, t, theme, cardBg, cardBorder, onCreate }) => (
  <Box
    sx={{
      p: 4,
      borderRadius: "12px",
      border: cardBorder === "transparent" ? 0 : `1px solid ${cardBorder}`,
      bgcolor: cardBg,
      textAlign: "center",
    }}
    data-testid="customers-empty-state"
  >
    <Typography sx={{ fontWeight: 600, color: theme.palette.text.primary, fontFamily: "var(--font-sans)", mb: 0.5 }}>
      {search
        ? t("customers.noCustomersSearch")
        : segment !== "all"
          ? t("customers.noCustomersSegment", { defaultValue: "No customers in this segment yet" })
          : t("customers.noCustomersTitle")}
    </Typography>
    <Typography sx={{ fontSize: "13px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
      {!search && segment === "all" && t("customers.noCustomersHint", { defaultValue: "Customers appear here automatically when someone pays a link, buys from your store, tips or donates." })}
    </Typography>
    {!search && segment === "all" && (
      <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
        <CustomButton
          label={t("customers.noCustomersCtaCreate", { defaultValue: "Create a payment link" })}
          variant="primary"
          size="small"
          onClick={onCreate}
        />
      </Box>
    )}
  </Box>
);

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
}) => {
  const c = detail.profile;
  const sansSx = { fontFamily: "var(--font-sans)" };
  const isPerson = c.kind === "person";

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
    <Box sx={{ p: { xs: 2, md: 2.5 }, overflowY: "auto" }}>
      {/* header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 2 }}>
        {renderAvatar(c, 46)}
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: "16.5px",
              color: theme.palette.text.primary,
              ...sansSx,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            data-testid="customer-detail-name"
          >
            {displayName(c)}
          </Typography>
          {isPerson && c.email && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: "12.5px",
                  color: theme.palette.text.secondary,
                  ...sansSx,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.email}
              </Typography>
              <IconButton
                size="small"
                onClick={() => onCopyEmail(c.email!)}
                data-testid="customer-detail-copy-email"
                sx={{ p: 0.4 }}
                aria-label={t("customers.copyEmail", { defaultValue: "Copy email" })}
              >
                {copied ? (
                  <CheckRounded sx={{ fontSize: 14, color: "#10B981" }} />
                ) : (
                  <ContentCopyRounded sx={{ fontSize: 13, color: theme.palette.text.secondary }} />
                )}
              </IconButton>
            </Box>
          )}
          {!isPerson && (
            <Typography sx={{ fontSize: "12.5px", color: theme.palette.text.secondary, ...sansSx }}>
              {t("customers.anonHint", { defaultValue: "No contact details captured" })}
            </Typography>
          )}
          {c.mobile && (
            <Typography sx={{ fontSize: "12.5px", color: theme.palette.text.secondary, ...sansSx }}>
              {c.mobile}
            </Typography>
          )}
          <Box sx={{ mt: 0.75 }}>
            <StatusDot tone={segmentTone(c.segment)}>{segmentLabel(c.segment)}</StatusDot>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" data-testid="customer-detail-close" aria-label="Close">
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

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

      {/* wallet — API-platform feature, only when it actually exists */}
      {detail.wallet && (
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
            {formatCryptoAmount(Number(detail.wallet.amount || 0), detail.wallet.wallet_type || "USD")}{" "}
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
                    : `${formatCryptoAmount(Number(p.crypto_amount || p.base_amount || 0), p.crypto_currency || p.base_currency || "USD")} ${p.crypto_currency || p.base_currency || ""}`}
                </Typography>
                <StatusDot tone={statusTone(p.status)}>{t(`customers.status_${p.status}`, { defaultValue: p.status })}</StatusDot>
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

export default CustomersPage;
