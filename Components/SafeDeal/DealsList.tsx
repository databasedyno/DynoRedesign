import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Box, Button, Chip, Container, Skeleton, Stack, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import safedealApi, { SdDeal, sdError } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { useRequireSdSession, useSdHref } from "./sdRouting";
import SdStatusChip from "./SdStatusChip";
import DeadlinePill from "./DeadlinePill";
import { TABULAR, absTime, nextStep, relTime, useNow } from "./sdFormat";

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

const EMPTY: Record<string, { icon: string; title: string; body: string; cta?: string }> = {
  all: { icon: "mdi:handshake-outline", title: "No deals yet", body: "Create a deal and invite the other party by email — they don't need an account.", cta: "Start your first deal" },
  action: { icon: "mdi:check-all", title: "Nothing needs you right now", body: "Deals waiting on the other party show under Open. We'll email you when it's your move." },
  open: { icon: "mdi:folder-open-outline", title: "No open deals", body: "Every deal you're part of has been completed, refunded or cancelled.", cta: "Start a new deal" },
  closed: { icon: "mdi:archive-outline", title: "No closed deals yet", body: "Completed, refunded, split and cancelled deals will show here." },
};

function todoLabel(d: SdDeal): string | null {
  const s = nextStep(d);
  return s.who === "you" ? s.text : null;
}

export default function DealsList() {
  const { user, ready } = useRequireSdSession();
  const href = useSdHref();
  const now = useNow(30000);
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

  const empty = EMPTY[filter] || EMPTY.all;

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

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }} role="tablist" aria-label="Filter deals">
        {FILTERS.map((f) => (
          <Chip key={f.key} role="tab" aria-selected={filter === f.key} label={f.label} onClick={() => setFilter(f.key)} data-testid={`sd-filter-${f.key}`} sx={{ fontWeight: 700, backgroundColor: filter === f.key ? BRAND_ACCENT : "#fff", color: filter === f.key ? "#fff" : "#374151", border: "1px solid #E5E7EB", "&:hover": { backgroundColor: filter === f.key ? "#3730A3" : "#F3F4F6" } }} />
        ))}
        <Box sx={{ flex: 1 }} />
        {ROLES.map((r) => (
          <Chip key={r.key} label={r.label} variant="outlined" onClick={() => setRole(r.key)} data-testid={`sd-role-${r.key}`} aria-pressed={role === r.key} sx={{ fontWeight: 700, borderColor: role === r.key ? BRAND_ACCENT : "#E5E7EB", color: role === r.key ? BRAND_ACCENT : "#6B7280" }} />
        ))}
      </Stack>

      {error && <Typography color="error" sx={{ mb: 2 }} data-testid="sd-deals-error">{error}</Typography>}

      {!deals ? (
        <Stack spacing={1.2}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={84} />)}</Stack>
      ) : deals.length === 0 ? (
        <Box sx={{ p: 5, textAlign: "center", borderRadius: 3, backgroundColor: "#fff", border: "1px dashed #D1D5DB" }} data-testid="sd-deals-empty" data-filter={filter}>
          <Icon icon={empty.icon} width={40} color="#9CA3AF" aria-hidden />
          <Typography sx={{ fontWeight: 800, mt: 1 }} data-testid="sd-deals-empty-title">{empty.title}</Typography>
          <Typography sx={{ fontSize: 13.5, color: "#6B7280", mb: empty.cta ? 2 : 0 }}>{empty.body}</Typography>
          {empty.cta && (
            <Link href={href("/deals/new")} style={{ textDecoration: "none" }}>
              <Button variant="outlined" sx={{ textTransform: "none", fontWeight: 700, borderRadius: 99 }}>{empty.cta}</Button>
            </Link>
          )}
        </Box>
      ) : (
        <Stack spacing={1.2} data-testid="sd-deals-list">
          {deals.map((d) => {
            const todo = todoLabel(d);
            const isBuyer = d.my_role === "buyer";
            const other = isBuyer ? d.seller_email : d.buyer_email;
            const updated = d.updated_at || d.created_at;
            return (
              <Link key={d.escrow_id} href={href(`/deal/${d.deal_token}`)} style={{ textDecoration: "none", color: "inherit" }} data-testid={`sd-deal-row-${d.escrow_id}`} aria-label={`${d.title}, ${money(d.amount, d.currency)}`}>
                <Box sx={{ p: { xs: 1.6, sm: 2 }, borderRadius: 3, backgroundColor: "#fff", border: `1px solid ${todo ? "#C7D2FE" : "#E5E7EB"}`, display: "flex", alignItems: "center", gap: { xs: 1.2, sm: 2 }, transition: "box-shadow .15s, transform .15s", "&:hover": { boxShadow: "0 10px 26px rgba(15,23,42,0.07)", transform: "translateY(-1px)" } }}>
                  <Box sx={{ width: 42, height: 42, borderRadius: 2, flexShrink: 0, display: { xs: "none", sm: "grid" }, placeItems: "center", backgroundColor: isBuyer ? "#EEF2FF" : "#ECFDF5" }} aria-hidden>
                    <Icon icon={isBuyer ? "mdi:cart-outline" : "mdi:storefront-outline"} width={22} color={isBuyer ? BRAND_ACCENT : "#047857"} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography sx={{ fontWeight: 800, fontSize: 15, minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</Typography>
                      <SdStatusChip deal={d} size="sm" testId={`sd-deal-status-${d.escrow_id}`} />
                      {todo && <Chip size="small" label={todo} data-testid={`sd-deal-todo-${d.escrow_id}`} sx={{ fontWeight: 800, fontSize: 11, height: 22, backgroundColor: "#EEF2FF", color: "#3730A3", display: { xs: "none", md: "inline-flex" } }} />}
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                      <Typography sx={{ fontSize: 12.5, color: "#6B7280", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {isBuyer ? "Buying from" : "Selling to"} <b>{other}</b> · #{d.escrow_id}
                      </Typography>
                      <DeadlinePill deal={d} testId={`sd-deal-deadline-${d.escrow_id}`} />
                      <Tooltip title={absTime(updated)} arrow>
                        <Typography component="time" dateTime={updated || undefined} sx={{ fontSize: 11.5, color: "#9CA3AF", display: { xs: "none", sm: "inline" } }}>updated {relTime(updated, now)}</Typography>
                      </Tooltip>
                    </Stack>
                  </Box>
                  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 16, ...TABULAR }}>{money(d.amount, d.currency)}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: "#6B7280", ...TABULAR }}>{isBuyer ? `you pay ${money(d.breakdown?.buyerPays, d.currency)}` : `you get ${money(d.breakdown?.sellerReceives, d.currency)}`}</Typography>
                  </Box>
                  <Box sx={{ display: { xs: "none", sm: "block" } }} aria-hidden>
                    <Icon icon="mdi:chevron-right" width={22} color="#9CA3AF" />
                  </Box>
                </Box>
              </Link>
            );
          })}
        </Stack>
      )}
    </Container>
  );
}
