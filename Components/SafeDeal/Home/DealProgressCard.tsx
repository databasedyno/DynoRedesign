import React from "react";
import Link from "next/link";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SdDeal, prettyParty } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import SdStatusChip from "../SdStatusChip";
import DeadlinePill from "../DeadlinePill";
import { TABULAR, absTime, nextStep, relTime } from "../sdFormat";
import { SD_GOLD, SD_GOLD_DEEP, SD_BORDER, SD_TEXT_MUTED, SD_NOTE_BG, SD_NOTE_FG, SD_NOTE_BORDER, SD_INK, goldAlpha } from "../sdTheme";

const STAGES = ["Invited", "Accepted", "Funded", "Delivered", "Released"];
const CLOSED = new Set(["completed", "refunded", "cancelled", "declined", "split", "expired"]);

export const isClosedDeal = (d: SdDeal) => CLOSED.has(d.status);

/** 0..4 = index of the stage the deal has reached; disputed keeps its last reached stage. */
const stageIndex = (d: SdDeal): number => {
  if (d.status === "completed") return 4;
  if (d.delivered_at || d.status === "delivered") return 3;
  if (d.funded_at || d.status === "funded") return 2;
  if (d.accepted_at || d.status === "awaiting_payment") return 1;
  return 0;
};

function Tracker({ deal }: { deal: SdDeal }) {
  const reached = stageIndex(deal);
  const disputed = deal.status === "disputed";
  const closedEarly = isClosedDeal(deal) && deal.status !== "completed";
  return (
    <Box data-testid={`sd-deal-tracker-${deal.escrow_id}`} aria-label={`Stage ${reached + 1} of 5: ${STAGES[reached]}`} sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0.5, mt: 1.6 }}>
      {STAGES.map((s, i) => {
        const done = i < reached || (i === reached && deal.status === "completed");
        const current = i === reached && deal.status !== "completed";
        const color = closedEarly ? "#C7C4BA" : disputed && current ? "#FF9F0A" : done || current ? SD_GOLD : "#E1E5EA";
        return (
          <Box key={s}>
            <Box sx={{ height: 5, borderRadius: 99, backgroundColor: color, position: "relative", overflow: "hidden" }}>
              {current && !closedEarly && <Box aria-hidden sx={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)`, animation: "sdShimmer 1.8s linear infinite", "@keyframes sdShimmer": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(100%)" } } }} />}
            </Box>
            <Typography sx={{ fontSize: 10.5, fontWeight: current ? 900 : 700, color: current ? (disputed ? "#B45309" : SD_GOLD_DEEP) : done ? SD_INK : "#A8A49A", mt: 0.5, letterSpacing: 0.2, display: { xs: i === reached ? "block" : "none", sm: "block" } }}>{s}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/** One deal as a progress card: role, counterparty, amount, deadline, 5-stage tracker, your-move flag. */
export default function DealProgressCard({ deal, href, now }: { deal: SdDeal; href: string; now: number }) {
  const isBuyer = deal.my_role === "buyer";
  const other = isBuyer ? deal.seller_email : deal.buyer_email;
  const otherDisplay = other ? prettyParty(other) : deal.invite_kind === "link" ? "Shareable link · not joined yet" : "the other party";
  const step = nextStep(deal);
  const yourMove = step.who === "you";
  const updated = deal.updated_at || deal.created_at;
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }} data-testid={`sd-deal-row-${deal.escrow_id}`} aria-label={`${deal.title}, ${money(deal.amount, deal.currency)}`}>
      <Box sx={{ p: { xs: 1.8, md: 2.2 }, height: "100%", borderRadius: 4, backgroundColor: "#fff", border: `1px solid ${yourMove ? SD_NOTE_BORDER : SD_BORDER}`, boxShadow: yourMove ? `0 0 0 3px ${goldAlpha(0.12)}` : "none", transition: "transform .18s, box-shadow .18s, border-color .18s", "&:hover": { transform: "translateY(-2px)", boxShadow: "0 16px 32px rgba(10,10,11,0.10)", borderColor: goldAlpha(0.6) } }}>
        <Stack direction="row" spacing={1.2} alignItems="flex-start">
          <Box sx={{ width: 40, height: 40, borderRadius: 2.5, flexShrink: 0, display: "grid", placeItems: "center", backgroundColor: isBuyer ? SD_NOTE_BG : "rgba(18,183,106,0.12)", color: isBuyer ? SD_GOLD_DEEP : "#0E9F5C" }} aria-hidden>
            <Icon icon={isBuyer ? "mdi:cart-outline" : "mdi:storefront-outline"} width={21} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: 15.5, letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deal.title}</Typography>
            <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isBuyer ? "Buying from" : "Selling to"} <b style={{ color: SD_INK }}>{otherDisplay}</b> · #{deal.escrow_id}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", flexShrink: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: 16.5, letterSpacing: -0.3, ...TABULAR }}>{money(deal.amount, deal.currency)}</Typography>
            <Typography sx={{ fontSize: 11, color: SD_TEXT_MUTED, ...TABULAR }}>{isBuyer ? `you pay ${money(deal.breakdown?.buyerPays, deal.currency)}` : `you get ${money(deal.breakdown?.sellerReceives, deal.currency)}`}</Typography>
          </Box>
        </Stack>

        <Tracker deal={deal} />

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.6 }}>
          <SdStatusChip deal={deal} size="sm" testId={`sd-deal-status-${deal.escrow_id}`} />
          <DeadlinePill deal={deal} testId={`sd-deal-deadline-${deal.escrow_id}`} />
          {yourMove && <Chip size="small" icon={<Icon icon="mdi:hand-pointing-right" width={14} />} label={step.text} data-testid={`sd-deal-todo-${deal.escrow_id}`} sx={{ fontWeight: 800, fontSize: 11, height: 24, backgroundColor: SD_NOTE_BG, color: SD_NOTE_FG, "& .MuiChip-icon": { color: SD_NOTE_FG }, maxWidth: "100%" }} />}
          <Box sx={{ flex: 1 }} />
          <Tooltip title={absTime(updated)} arrow>
            <Typography component="time" dateTime={updated || undefined} sx={{ fontSize: 11.5, color: "#A8A49A" }}>{relTime(updated, now)}</Typography>
          </Tooltip>
        </Stack>
      </Box>
    </Link>
  );
}
