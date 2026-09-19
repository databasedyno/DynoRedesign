import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Box, Button, Chip, Container, Skeleton, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import safedealApi, { SdDeal, sdError } from "@/api/safedeal";
import StatusChip from "@/Components/Page/Escrow/StatusChip";
import { money, shortDate } from "@/Components/Page/Escrow/escrowUtils";
import { useRequireSdSession, useSdHref } from "./sdRouting";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "action", label: "Needs my attention" },
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
];
const ROLES: { key: string; label: string }[] = [
  { key: "all", label: "Any role" },
  { key: "buyer", label: "I'm buying" },
  { key: "seller", label: "I'm selling" },
];

function needsMe(d: SdDeal): string | null {
  const me = d.my_role;
  if (d.status === "invited" && !d.is_creator) return "Accept or decline";
  if (d.status === "awaiting_payment" && me === "buyer") return "Fund the escrow";
  if (d.status === "funded" && me === "seller") return "Deliver";
  if (d.status === "delivered" && me === "buyer") return "Confirm & release";
  if (d.status === "disputed" && d.dispute_stage !== "escalated" && d.dispute_proposal && d.dispute_proposal_by !== me) return "Respond to proposal";
  return null;
}

export default function DealsList() {
  const { user, ready } = useRequireSdSession();
  const href = useSdHref();
  const [deals, setDeals] = useState<SdDeal[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [role, setRole] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDeals(await safedealApi.listDeals(filter, role));
    } catch (e) {
      setError(sdError(e));
    }
  }, [filter, role]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }} data-testid="sd-deals-page">
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography component="h1" sx={{ fontSize: { xs: 26, md: 32 }, fontWeight: 900, letterSpacing: -0.8 }}>My deals</Typography>
          <Typography sx={{ fontSize: 13.5, color: "#6B7280" }}>{user?.email}</Typography>
        </Box>
        <Link href={href("/deals/new")} data-testid="sd-new-deal" style={{ textDecoration: "none" }}>
          <Button variant="contained" startIcon={<Icon icon="mdi:plus" />} sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, px: 2.4, backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#3730A3" } }}>
            New deal
          </Button>
        </Link>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} onClick={() => setFilter(f.key)} data-testid={`sd-filter-${f.key}`} sx={{ fontWeight: 700, backgroundColor: filter === f.key ? BRAND_ACCENT : "#fff", color: filter === f.key ? "#fff" : "#374151", border: "1px solid #E5E7EB", "&:hover": { backgroundColor: filter === f.key ? "#3730A3" : "#F3F4F6" } }} />
        ))}
        <Box sx={{ flex: 1 }} />
        {ROLES.map((r) => (
          <Chip key={r.key} label={r.label} variant="outlined" onClick={() => setRole(r.key)} data-testid={`sd-role-${r.key}`} sx={{ fontWeight: 700, borderColor: role === r.key ? BRAND_ACCENT : "#E5E7EB", color: role === r.key ? BRAND_ACCENT : "#6B7280" }} />
        ))}
      </Stack>

      {error && <Typography color="error" sx={{ mb: 2 }} data-testid="sd-deals-error">{error}</Typography>}

      {!deals ? (
        <Stack spacing={1.2}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={76} />)}</Stack>
      ) : deals.length === 0 ? (
        <Box sx={{ p: 5, textAlign: "center", borderRadius: 3, backgroundColor: "#fff", border: "1px dashed #D1D5DB" }} data-testid="sd-deals-empty">
          <Icon icon="mdi:handshake-outline" width={40} color="#9CA3AF" />
          <Typography sx={{ fontWeight: 800, mt: 1 }}>No deals here yet</Typography>
          <Typography sx={{ fontSize: 13.5, color: "#6B7280", mb: 2 }}>Create a deal and invite the other party by email — they don&apos;t need an account.</Typography>
          <Link href={href("/deals/new")} style={{ textDecoration: "none" }}>
            <Button variant="outlined" sx={{ textTransform: "none", fontWeight: 700, borderRadius: 99 }}>Start your first deal</Button>
          </Link>
        </Box>
      ) : (
        <Stack spacing={1.2} data-testid="sd-deals-list">
          {deals.map((d) => {
            const todo = needsMe(d);
            const other = d.my_role === "buyer" ? d.seller_email : d.buyer_email;
            return (
              <Link key={d.escrow_id} href={href(`/deal/${d.deal_token}`)} style={{ textDecoration: "none", color: "inherit" }} data-testid={`sd-deal-row-${d.escrow_id}`}>
                <Box sx={{ p: 2, borderRadius: 3, backgroundColor: "#fff", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 2, transition: "box-shadow .15s, transform .15s", "&:hover": { boxShadow: "0 10px 26px rgba(15,23,42,0.07)", transform: "translateY(-1px)" } }}>
                  <Box sx={{ width: 42, height: 42, borderRadius: 2, flexShrink: 0, display: "grid", placeItems: "center", backgroundColor: d.my_role === "buyer" ? "#EEF2FF" : "#ECFDF5" }}>
                    <Icon icon={d.my_role === "buyer" ? "mdi:cart-outline" : "mdi:storefront-outline"} width={22} color={d.my_role === "buyer" ? BRAND_ACCENT : "#047857"} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography sx={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</Typography>
                      <StatusChip deal={d} size="sm" testId={`sd-deal-status-${d.escrow_id}`} />
                      {todo && <Chip size="small" label={todo} data-testid={`sd-deal-todo-${d.escrow_id}`} sx={{ fontWeight: 800, fontSize: 11, backgroundColor: "#FEF3C7", color: "#92400E" }} />}
                    </Stack>
                    <Typography sx={{ fontSize: 12.5, color: "#6B7280", mt: 0.3 }}>
                      {d.my_role === "buyer" ? "Buying from" : "Selling to"} <b>{other}</b> · #{d.escrow_id} · {shortDate(d.updated_at || d.created_at)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 16 }}>{money(d.amount, d.currency)}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: "#9CA3AF" }}>{d.my_role === "buyer" ? `you pay ${money(d.breakdown?.buyerPays, d.currency)}` : `you get ${money(d.breakdown?.sellerReceives, d.currency)}`}</Typography>
                  </Box>
                  <Icon icon="mdi:chevron-right" width={22} color="#9CA3AF" />
                </Box>
              </Link>
            );
          })}
        </Stack>
      )}
    </Container>
  );
}
