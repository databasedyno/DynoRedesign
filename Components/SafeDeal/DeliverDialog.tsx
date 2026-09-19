import React, { useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { SD_GOLD, SD_GOLD_DARK, SD_INK } from "./sdTheme";
import safedealApi, { SdAttachment, SdDeal } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import AttachmentPicker from "./AttachmentPicker";

const primaryBtn = { textTransform: "none", fontWeight: 800, borderRadius: 99, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } } as const;

export interface DeliverPayload {
  delivery_note: string;
  tracking?: { carrier: string; number: string } | null;
  links: string[];
  attachment_ids: number[];
}

/** Seller: mark delivered with proof — note, tracking, links and up to 5 files. */
export default function DeliverDialog({ open, deal, token, busy, onClose, onSubmit, onError }: {
  open: boolean; deal: SdDeal; token: string; busy: boolean; onClose: () => void; onSubmit: (p: DeliverPayload) => void; onError: (m: string) => void;
}) {
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<SdAttachment[]>([]);
  const isGoods = deal.deal_type === "goods";
  const linkList = links.split(/\n|,/).map((l) => l.trim()).filter(Boolean);
  const badLink = linkList.find((l) => !/^https?:\/\/\S+$/i.test(l));
  const hasProof = !!note.trim() || !!tracking.trim() || linkList.length > 0 || files.length > 0;
  const round = Number(deal.revision_round || 0);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>{round > 0 ? "Deliver the changes" : "Mark as delivered"}</DialogTitle>
      <DialogContent data-testid="sd-deliver-dialog">
        {round > 0 && deal.revision_note && (
          <Alert severity="warning" sx={{ mb: 1.5 }} data-testid="sd-deliver-revision-note"><b>The buyer asked for:</b> {deal.revision_note}</Alert>
        )}
        <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 1.5 }}>
          The buyer gets {deal.auto_release_days} days to check. If they do nothing, {money(deal.breakdown.sellerReceives, deal.currency)} releases to your wallet automatically. Proof of delivery makes disputes far less likely.
        </Typography>
        <Stack spacing={1.5}>
          <TextField label="What did you deliver?" placeholder="Where to find it, what's included, anything the buyer should check…" value={note} onChange={(e) => setNote(e.target.value)} fullWidth size="small" multiline minRows={2} inputProps={{ "data-testid": "sd-deliver-note", maxLength: 5000 }} />
          <Stack direction="row" spacing={1}>
            <TextField label="Carrier" placeholder={isGoods ? "DHL, UPS, PostNL…" : "Optional"} value={carrier} onChange={(e) => setCarrier(e.target.value)} size="small" sx={{ width: "40%" }} inputProps={{ "data-testid": "sd-deliver-carrier", maxLength: 60 }} />
            <TextField label="Tracking number" placeholder={isGoods ? "Recommended for shipped items" : "Optional"} value={tracking} onChange={(e) => setTracking(e.target.value)} size="small" fullWidth inputProps={{ "data-testid": "sd-deliver-tracking", maxLength: 80 }} />
          </Stack>
          <TextField label="Links (one per line)" placeholder="https://… tracking page, shared folder, live site" value={links} onChange={(e) => setLinks(e.target.value)} fullWidth size="small" multiline minRows={2} error={!!badLink} helperText={badLink ? `"${badLink}" must start with http:// or https://` : `${linkList.length}/5 links`} inputProps={{ "data-testid": "sd-deliver-links" }} />
          <Box>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, mb: 0.6 }}>Photos / documents</Typography>
            <AttachmentPicker upload={(f, p) => safedealApi.uploadFile(token, f, p)} value={files} onChange={setFiles} onError={onError} disabled={busy} testid="sd-deliver-files" />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none" }}>Back</Button>
        <Button
          variant="contained"
          disabled={busy || !!badLink || linkList.length > 5}
          onClick={() => onSubmit({ delivery_note: note.trim(), tracking: tracking.trim() ? { carrier: carrier.trim(), number: tracking.trim() } : null, links: linkList, attachment_ids: files.map((f) => f.attachment_id) })}
          data-testid="sd-act-deliver"
          sx={primaryBtn}
        >
          {busy ? "Sending…" : hasProof ? "Mark delivered with proof" : "Mark delivered"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
