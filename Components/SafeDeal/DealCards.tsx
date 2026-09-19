import React from "react";
import { Alert, Box, Chip, Link as MuiLink, Stack, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import type { SdDeal } from "@/api/safedeal";
import { AttachmentList } from "./AttachmentPicker";
import { absTime, relTime } from "./sdFormat";
import { dealTypeMeta, fmtDate } from "./sdDealTypes";

const card = { p: { xs: 2, md: 2.5 }, borderRadius: 3, backgroundColor: "#fff", border: "1px solid #E5E7EB" } as const;

/** Delivery proof (note, tracking, links, files) + the "changes requested" state. */
export function DeliveryProofCard({ deal, isBuyer, onOpenFile }: { deal: SdDeal; isBuyer: boolean; onOpenFile: (id: number) => void }) {
  const proof = deal.delivery_proof;
  const files = (deal.attachments || []).filter((a) => a.context === "delivery");
  const round = Number(deal.revision_round || 0);
  const max = Number(deal.max_revision_rounds || 2);
  const changesPending = deal.status === "funded" && round > 0 && !!deal.revision_note;
  if (!proof && !deal.delivery_note && !changesPending) return null;
  return (
    <Box sx={card} data-testid="sd-delivery-proof">
      {changesPending && (
        <Alert severity="warning" icon={<Icon icon="mdi:undo-variant" />} sx={{ mb: proof ? 1.5 : 0 }} data-testid="sd-changes-requested-banner">
          <b>{isBuyer ? "You asked for changes" : "The buyer asked for changes"}</b> (round {round} of {max}): {deal.revision_note}
          {!isBuyer && <Typography sx={{ fontSize: 12.5, mt: 0.4 }}>Make the changes, then mark the deal delivered again.</Typography>}
        </Alert>
      )}
      {(proof || deal.delivery_note) && (
        <>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
            <Icon icon="mdi:package-variant-closed-check" width={18} color={BRAND_ACCENT} />
            <Typography sx={{ fontWeight: 800, fontSize: 14 }}>Delivery proof</Typography>
            {deal.delivered_at && <Tooltip title={absTime(deal.delivered_at)}><Typography sx={{ fontSize: 12, color: "#6B7280" }}>{relTime(deal.delivered_at)}</Typography></Tooltip>}
          </Stack>
          {(proof?.note || deal.delivery_note) && <Typography sx={{ fontSize: 13.5, color: "#374151", whiteSpace: "pre-wrap", mb: 1 }} data-testid="sd-proof-note">{proof?.note || deal.delivery_note}</Typography>}
          {proof?.tracking?.number && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} data-testid="sd-proof-tracking">
              <Icon icon="mdi:truck-fast-outline" width={18} color="#6B7280" />
              <Typography sx={{ fontSize: 13.5 }}>{proof.tracking.carrier ? <b>{proof.tracking.carrier} · </b> : null}<span style={{ fontFamily: "monospace" }}>{proof.tracking.number}</span></Typography>
            </Stack>
          )}
          {!!proof?.links?.length && (
            <Stack spacing={0.4} sx={{ mb: 1 }} data-testid="sd-proof-links">
              {proof.links.map((l) => (
                <MuiLink key={l} href={l} target="_blank" rel="noopener noreferrer" sx={{ fontSize: 13, color: BRAND_ACCENT, fontWeight: 700, wordBreak: "break-all", display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  <Icon icon="mdi:open-in-new" width={14} /> {l}
                </MuiLink>
              ))}
            </Stack>
          )}
          <AttachmentList files={files} onOpen={onOpenFile} testid="sd-proof-files" />
        </>
      )}
    </Box>
  );
}

/** Counts-only trust card for the other party (no names). */
export function CounterpartyCard({ deal, isBuyer }: { deal: SdDeal; isBuyer: boolean }) {
  const c = deal.counterparty;
  if (!c) return null;
  const other = isBuyer ? deal.seller_email : deal.buyer_email;
  const since = c.member_since ? new Date(c.member_since) : null;
  const isNew = c.completed_deals === 0;
  return (
    <Box sx={card} data-testid="sd-counterparty-card">
      <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#9CA3AF", mb: 1 }}>{isBuyer ? "Seller" : "Buyer"}</Typography>
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.2 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", backgroundColor: isBuyer ? "#ECFDF5" : "#EEF2FF", flexShrink: 0 }} aria-hidden>
          <Icon icon={isBuyer ? "mdi:storefront-outline" : "mdi:cart-outline"} width={20} color={isBuyer ? "#047857" : BRAND_ACCENT} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} data-testid="sd-counterparty-email">{other}</Typography>
          <Stack direction="row" spacing={0.6} alignItems="center">
            <Icon icon={c.verified_email ? "mdi:check-decagram" : "mdi:email-outline"} width={14} color={c.verified_email ? "#047857" : "#9CA3AF"} />
            <Typography sx={{ fontSize: 12, color: "#6B7280" }}>{c.verified_email ? "Email verified" : "Hasn't signed in yet"}</Typography>
          </Stack>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1}>
        <Stat label="Completed deals" value={String(c.completed_deals)} testid="sd-counterparty-completed" />
        <Stat label="Member since" value={since ? since.toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—"} testid="sd-counterparty-since" />
      </Stack>
      {isNew && <Chip size="small" label="New to SafeDeal" sx={{ mt: 1.2, fontWeight: 700, fontSize: 11, backgroundColor: "#F3F4F6", color: "#374151" }} data-testid="sd-counterparty-new" />}
      <Typography sx={{ fontSize: 11.5, color: "#9CA3AF", mt: 1 }}>Counts come from completed SafeDeal escrows. Money is only ever held by Dynopay, never by the other party.</Typography>
    </Box>
  );
}

function Stat({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <Box sx={{ flex: 1, p: 1.2, borderRadius: 2, backgroundColor: "#F9FAFB", border: "1px solid #F3F4F6" }} data-testid={testid}>
      <Typography sx={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4 }}>{value}</Typography>
      <Typography sx={{ fontSize: 11.5, color: "#6B7280" }}>{label}</Typography>
    </Box>
  );
}

/** Small "type · due date" facts used on the deal page header. */
export function DealFacts({ deal }: { deal: SdDeal }) {
  const t = dealTypeMeta(deal.deal_type);
  if (!t && !deal.delivery_due_at) return null;
  const overdue = !!deal.delivery_due_at && ["funded"].includes(deal.status) && new Date(deal.delivery_due_at).getTime() < Date.now();
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.8 }} data-testid="sd-deal-facts">
      {t && <Chip size="small" icon={<Icon icon={t.icon} width={14} />} label={t.label} sx={{ fontWeight: 700, fontSize: 11.5 }} data-testid="sd-deal-type" />}
      {deal.delivery_due_at && (
        <Chip size="small" icon={<Icon icon="mdi:calendar-clock" width={14} />} label={`${overdue ? "Was due" : "Due"} ${fmtDate(deal.delivery_due_at)}`} data-testid="sd-deal-due" sx={{ fontWeight: 700, fontSize: 11.5, backgroundColor: overdue ? "#FEF2F2" : undefined, color: overdue ? "#B91C1C" : undefined }} />
      )}
    </Stack>
  );
}
