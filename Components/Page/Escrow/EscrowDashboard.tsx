import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { AddRounded, HandshakeRounded, ChevronRightRounded, RefreshRounded } from "@mui/icons-material";
import { useRouter } from "next/router";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { escrowApi, EscrowDeal } from "@/api/escrow";
import { BRAND_ACCENT, brandAlpha } from "@/constants/theme";
import StatusChip from "./StatusChip";
import CreateEscrowDialog from "./CreateEscrowDialog";
import { money, shortDate, titleize } from "./escrowUtils";

type FilterKey = "all" | "open" | "settling" | "done" | "disputed";

const FILTERS: { key: FilterKey; label: string; match: (d: EscrowDeal) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "open", label: "Active", match: (d) => ["draft", "invited", "awaiting_payment", "funded", "delivered"].includes(d.status) },
  { key: "settling", label: "Payout pending", match: (d) => d.settlement_phase === "pending" || d.settlement_phase === "partial" },
  { key: "done", label: "Completed", match: (d) => ["completed", "refunded", "split"].includes(d.status) && d.settlement_phase === "paid" },
  { key: "disputed", label: "Disputed", match: (d) => d.status === "disputed" },
];

export default function EscrowDashboard() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const companyState = useCompanyStore();
  const companyId = companyState.selectedCompanyId;

  const [deals, setDeals] = useState<EscrowDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const list = await escrowApi.list({ company_id: companyId });
      setDeals(list);
    } catch {
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  // Allow the sidebar/header "+ New" or empty-state to open the create dialog.
  useEffect(() => {
    const open = () => setCreateOpen(true);
    window.addEventListener("escrow:new", open);
    return () => window.removeEventListener("escrow:new", open);
  }, []);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: 0, open: 0, settling: 0, done: 0, disputed: 0 };
    for (const f of FILTERS) c[f.key] = deals.filter(f.match).length;
    return c;
  }, [deals]);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    return deals.filter(f.match);
  }, [deals, filter]);

  const cardBorder = `1px solid ${theme.palette.divider}`;

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", width: "100%", pb: 6 }}>
      {/* Intro / value prop banner */}
      <Box
        sx={{
          p: 2.5,
          mb: 2.5,
          borderRadius: 3,
          border: cardBorder,
          background: `linear-gradient(135deg, ${brandAlpha(isDark ? 0.16 : 0.08)}, transparent)`,
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
          flexDirection: { xs: "column", sm: "row" },
        }}
      >
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              backgroundColor: brandAlpha(0.14),
              color: BRAND_ACCENT,
              flexShrink: 0,
            }}
          >
            <HandshakeRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Hold crypto safely until the deal is done</Typography>
            <Typography sx={{ fontSize: 13.5, color: "text.secondary", maxWidth: 560 }}>
              DynoPay holds the buyer&apos;s payment and releases it to the seller only when the deal completes or a
              dispute is resolved. Value is converted to a stablecoin on funding so it never drifts.
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => setCreateOpen(true)}
          data-testid="escrow-new-btn"
          sx={{ backgroundColor: BRAND_ACCENT, textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}
        >
          New escrow
        </Button>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", rowGap: 1, alignItems: "center" }}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={`${f.label}${counts[f.key] ? ` · ${counts[f.key]}` : ""}`}
            onClick={() => setFilter(f.key)}
            data-testid={`escrow-filter-${f.key}`}
            variant={filter === f.key ? "filled" : "outlined"}
            sx={{
              fontWeight: 600,
              borderColor: filter === f.key ? BRAND_ACCENT : theme.palette.divider,
              backgroundColor: filter === f.key ? BRAND_ACCENT : "transparent",
              color: filter === f.key ? "#fff" : "text.primary",
              "&:hover": { backgroundColor: filter === f.key ? BRAND_ACCENT : theme.palette.action.hover },
            }}
          />
        ))}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<RefreshRounded />}
          onClick={load}
          data-testid="escrow-refresh"
          sx={{ textTransform: "none", color: "text.secondary" }}
        >
          Refresh
        </Button>
      </Stack>

      {/* List */}
      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
          <CircularProgress size={28} sx={{ color: BRAND_ACCENT }} />
        </Box>
      ) : visible.length === 0 ? (
        <Box
          sx={{
            py: 7,
            px: 3,
            textAlign: "center",
            borderRadius: 3,
            border: `1px dashed ${theme.palette.divider}`,
          }}
          data-testid="escrow-empty"
        >
          <HandshakeRounded sx={{ fontSize: 42, color: BRAND_ACCENT, opacity: 0.7, mb: 1 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 16 }}>
            {filter === "all" ? "No escrow deals yet" : "Nothing here"}
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: "text.secondary", mb: 2 }}>
            {filter === "all"
              ? "Create your first escrow deal and share a secure link with your counterparty."
              : "Try a different filter."}
          </Typography>
          {filter === "all" && (
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setCreateOpen(true)}
              data-testid="escrow-empty-new-btn"
              sx={{ backgroundColor: BRAND_ACCENT, textTransform: "none", fontWeight: 700 }}
            >
              New escrow
            </Button>
          )}
        </Box>
      ) : (
        <Stack spacing={1.2} data-testid="escrow-list">
          {visible.map((d) => (
            <Box
              key={d.escrow_id}
              onClick={() => router.push(`/escrow/${d.escrow_id}`)}
              data-testid={`escrow-row-${d.escrow_id}`}
              sx={{
                p: 2,
                borderRadius: 2.5,
                border: cardBorder,
                backgroundColor: theme.palette.background.paper,
                display: "flex",
                alignItems: "center",
                gap: 2,
                cursor: "pointer",
                transition: "border-color .15s, transform .05s",
                "&:hover": { borderColor: BRAND_ACCENT },
                "&:active": { transform: "scale(0.997)" },
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                    {d.title}
                  </Typography>
                  <StatusChip deal={d} size="sm" testId={`escrow-row-status-${d.escrow_id}`} />
                </Box>
                <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.3 }}>
                  You are the <b>{titleize(d.my_role || d.creator_role)}</b> · with {d.counterparty_email} · {shortDate(d.created_at)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{money(d.amount, d.currency)}</Typography>
                <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{d.currency}</Typography>
              </Box>
              <ChevronRightRounded sx={{ color: "text.disabled" }} />
            </Box>
          ))}
        </Stack>
      )}

      <CreateEscrowDialog
        open={createOpen}
        companyId={companyId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => load()}
      />
    </Box>
  );
}
