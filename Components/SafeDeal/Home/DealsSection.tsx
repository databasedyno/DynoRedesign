import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Box, Button, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SdDeal } from "@/api/safedeal";
import { nextStep } from "../sdFormat";
import { SD_BORDER, SD_GOLD, SD_GOLD_DEEP, SD_INK, SD_NOTE_BG, SD_PAGE, SD_TEXT_MUTED } from "../sdTheme";
import DealProgressCard, { isClosedDeal } from "./DealProgressCard";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "action", label: "Needs my attention" },
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
] as const;
const ROLES = [
  { key: "all", label: "Any role" },
  { key: "buyer", label: "I'm buying" },
  { key: "seller", label: "I'm selling" },
] as const;

const EMPTY: Record<string, { icon: string; title: string; body: string; cta?: string }> = {
  all: { icon: "mdi:handshake-outline", title: "No deals yet", body: "Create a deal and invite the other party by email — they don't need an account.", cta: "Start your first deal" },
  action: { icon: "mdi:check-all", title: "Nothing needs you right now", body: "Deals waiting on the other party show under Open. We'll email you when it's your move." },
  open: { icon: "mdi:folder-open-outline", title: "No open deals", body: "Every deal you're part of has been completed, refunded or cancelled.", cta: "Start a new deal" },
  closed: { icon: "mdi:archive-outline", title: "No closed deals yet", body: "Completed, refunded, split and cancelled deals will show here." },
};

export const yourMove = (d: SdDeal) => !isClosedDeal(d) && nextStep(d).who === "you";
const ts = (d: SdDeal) => new Date(d.updated_at || d.created_at || 0).getTime();
/** Your-move deals first, then most recently updated. */
export const sortDeals = (list: SdDeal[]) => [...list].sort((a, b) => Number(yourMove(b)) - Number(yourMove(a)) || ts(b) - ts(a));

interface Props {
  deals: SdDeal[] | null;
  error: string | null;
  href: (p: string) => string;
  now: number;
}

/** All my deals as progress cards, filterable by state and role. */
export default function DealsSection({ deals, error, href, now }: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [role, setRole] = useState<(typeof ROLES)[number]["key"]>("all");

  const list = useMemo(() => sortDeals((deals || []).filter((d) =>
    (role === "all" || d.my_role === role) &&
    (filter === "all" || (filter === "closed" ? isClosedDeal(d) : filter === "open" ? !isClosedDeal(d) : yourMove(d))))), [deals, filter, role]);
  const empty = EMPTY[filter];

  return (
    <Box data-testid="sd-deals-section">
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }} role="tablist" aria-label="Filter deals">
        {FILTERS.map((f) => (
          <Chip key={f.key} role="tab" aria-selected={filter === f.key} label={f.label} onClick={() => setFilter(f.key)} data-testid={`sd-filter-${f.key}`} sx={{ fontWeight: 800, fontSize: 12.5, backgroundColor: filter === f.key ? SD_GOLD : "#fff", color: SD_INK, border: `1px solid ${filter === f.key ? SD_GOLD : SD_BORDER}`, "&:hover": { backgroundColor: filter === f.key ? SD_GOLD : SD_PAGE } }} />
        ))}
        <Box sx={{ flex: 1 }} />
        {ROLES.map((r) => (
          <Chip key={r.key} label={r.label} variant="outlined" onClick={() => setRole(r.key)} data-testid={`sd-role-${r.key}`} aria-pressed={role === r.key} sx={{ fontWeight: 800, fontSize: 12.5, borderColor: role === r.key ? SD_GOLD_DEEP : SD_BORDER, color: role === r.key ? SD_GOLD_DEEP : SD_TEXT_MUTED, backgroundColor: role === r.key ? SD_NOTE_BG : "transparent" }} />
        ))}
      </Stack>

      {error && <Typography color="error" sx={{ mb: 2 }} data-testid="sd-deals-error">{error}</Typography>}

      {!deals ? (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={150} />)}</Box>
      ) : list.length === 0 ? (
        <Box sx={{ p: 5, textAlign: "center", borderRadius: 4, backgroundColor: "#fff", border: `1px dashed ${SD_BORDER}` }} data-testid="sd-deals-empty" data-filter={filter}>
          <Icon icon={empty.icon} width={40} color="#C9C6BC" aria-hidden />
          <Typography sx={{ fontWeight: 800, mt: 1 }} data-testid="sd-deals-empty-title">{empty.title}</Typography>
          <Typography sx={{ fontSize: 13.5, color: SD_TEXT_MUTED, mb: empty.cta ? 2 : 0 }}>{empty.body}</Typography>
          {empty.cta && (
            <Link href={href("/deals/new")} style={{ textDecoration: "none" }} data-testid="sd-deals-empty-cta">
              <Button variant="outlined" sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, color: SD_GOLD_DEEP, borderColor: SD_GOLD_DEEP, "&:hover": { backgroundColor: SD_NOTE_BG, borderColor: SD_GOLD_DEEP } }}>{empty.cta}</Button>
            </Link>
          )}
        </Box>
      ) : (
        <Box data-testid="sd-deals-list" sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>
          {list.map((d) => <DealProgressCard key={d.escrow_id} deal={d} href={href(`/deal/${d.deal_token}`)} now={now} />)}
        </Box>
      )}
    </Box>
  );
}
