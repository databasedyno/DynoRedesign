import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  CloseRounded,
  ContentCopyRounded,
  HandshakeRounded,
  OpenInNewRounded,
  CheckCircleRounded,
} from "@mui/icons-material";
import { useDispatch } from "react-redux";
import { escrowApi, EscrowDeal, FeeBreakdown, FeePayer, EscrowRole } from "@/api/escrow";
import { BRAND_ACCENT, brandAlpha } from "@/constants/theme";
import { money } from "./escrowUtils";

interface Props {
  open: boolean;
  companyId: number | null;
  onClose: () => void;
  onCreated: (deal: EscrowDeal) => void;
}

const FUNDING_COINS = ["BTC", "ETH", "USDT-TRON", "USDT-ERC20", "USDC", "LTC", "SOL", "XRP"];

export default function CreateEscrowDialog({ open, companyId, onClose, onCreated }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const dispatch = useDispatch();
  const notify = (message: string, severity: "success" | "error" = "success") =>
    dispatch({ type: "TOAST_SHOW", payload: { message, severity } });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency] = useState("USD");
  const [creatorRole, setCreatorRole] = useState<EscrowRole>("seller");
  const [counterpartyEmail, setCounterpartyEmail] = useState("");
  const [feePercent, setFeePercent] = useState("5");
  const [feePayer, setFeePayer] = useState<FeePayer>("buyer");
  const [autoReleaseDays, setAutoReleaseDays] = useState("3");
  const [acceptedCoins, setAcceptedCoins] = useState<string[]>(["USDT-TRON", "BTC", "ETH"]);
  const [terms, setTerms] = useState("");

  const [preview, setPreview] = useState<FeeBreakdown | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<EscrowDeal | null>(null);

  const reset = useCallback(() => {
    setTitle("");
    setDescription("");
    setAmount("");
    setCreatorRole("seller");
    setCounterpartyEmail("");
    setFeePercent("5");
    setFeePayer("buyer");
    setAutoReleaseDays("3");
    setAcceptedCoins(["USDT-TRON", "BTC", "ETH"]);
    setTerms("");
    setPreview(null);
    setCreated(null);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // Live fee preview (debounced).
  useEffect(() => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setPreview(null);
      return;
    }
    const handle = setTimeout(() => {
      escrowApi
        .feePreview({ amount: amt, currency, fee_percent: Number(feePercent) || 0, fee_payer: feePayer })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 350);
    return () => clearTimeout(handle);
  }, [amount, currency, feePercent, feePayer]);

  const emailValid = useMemo(() => /.+@.+\..+/.test(counterpartyEmail.trim()), [counterpartyEmail]);
  const canSubmit = title.trim().length >= 2 && Number(amount) > 0 && emailValid && !!companyId && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const deal = await escrowApi.create({
        company_id: companyId,
        title: title.trim(),
        description: description.trim() || undefined,
        amount: Number(amount),
        currency,
        accepted_coins: acceptedCoins.length ? acceptedCoins.join(",") : undefined,
        terms: terms.trim() || undefined,
        counterparty_email: counterpartyEmail.trim(),
        creator_role: creatorRole,
        fee_percent: Number(feePercent) || 0,
        fee_payer: feePayer,
        auto_release_days: Number(autoReleaseDays) || 3,
        send_invite: true,
      });
      setCreated(deal);
      notify("Escrow deal created — invitation sent to the counterparty.");
      onCreated(deal);
    } catch (e: any) {
      notify(e?.response?.data?.message || "Could not create the escrow deal.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      notify("Copied to clipboard.");
    } catch {
      notify("Could not copy.", "error");
    }
  };

  const cardSx = {
    p: 2,
    borderRadius: 2,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "#F9FAFB",
  } as const;

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.2, pr: 6 }}>
        <HandshakeRounded sx={{ color: BRAND_ACCENT }} />
        <Typography component="span" sx={{ fontWeight: 700, fontSize: 18 }}>
          {created ? "Escrow deal created" : "New escrow deal"}
        </Typography>
        <IconButton
          onClick={onClose}
          disabled={submitting}
          data-testid="escrow-create-close"
          sx={{ position: "absolute", right: 12, top: 12 }}
        >
          <CloseRounded />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {created ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
              <CheckCircleRounded sx={{ color: "#12B76A" }} />
              <Typography sx={{ fontSize: 14.5 }}>
                Share this secure link with <b>{created.counterparty_email}</b>. They verify their email with a
                one-time code, then accept and act on the deal — no account needed.
              </Typography>
            </Box>
            <Box sx={cardSx}>
              <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.5 }}>Shareable invite link</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  data-testid="escrow-created-invite-url"
                  sx={{ fontSize: 13, wordBreak: "break-all", flex: 1, fontFamily: "monospace" }}
                >
                  {created.invite_url}
                </Typography>
                <Tooltip title="Copy link">
                  <IconButton size="small" onClick={() => copy(created.invite_url)} data-testid="escrow-created-copy">
                    <ContentCopyRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Open">
                  <IconButton size="small" component="a" href={created.invite_url} target="_blank">
                    <OpenInNewRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Stack direction="row" spacing={1.5} justifyContent="flex-end">
              <Button onClick={reset} data-testid="escrow-create-another">
                Create another
              </Button>
              <Button
                variant="contained"
                onClick={onClose}
                data-testid="escrow-created-done"
                sx={{ backgroundColor: BRAND_ACCENT, textTransform: "none", fontWeight: 600 }}
              >
                Done
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2.2} sx={{ pt: 1 }}>
            <TextField
              label="Deal title"
              placeholder="e.g. Website redesign — milestone 1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              size="small"
              required
              inputProps={{ "data-testid": "escrow-create-title-input" }}
            />
            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={2}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                size="small"
                required
                sx={{ flex: 1 }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                inputProps={{ inputMode: "decimal", "data-testid": "escrow-create-amount-input" }}
              />
              <TextField label="Currency" value={currency} size="small" disabled sx={{ width: 110 }} />
            </Stack>

            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Your role in this deal</Typography>
              <RadioGroup
                row
                value={creatorRole}
                onChange={(e) => setCreatorRole(e.target.value as EscrowRole)}
              >
                <FormControlLabel
                  value="seller"
                  control={<Radio size="small" data-testid="escrow-role-seller" />}
                  label="I'm the seller (I receive funds)"
                />
                <FormControlLabel
                  value="buyer"
                  control={<Radio size="small" data-testid="escrow-role-buyer" />}
                  label="I'm the buyer (I pay)"
                />
              </RadioGroup>
            </Box>

            <TextField
              label={creatorRole === "seller" ? "Buyer's email" : "Seller's email"}
              placeholder="counterparty@email.com"
              value={counterpartyEmail}
              onChange={(e) => setCounterpartyEmail(e.target.value)}
              fullWidth
              size="small"
              required
              error={counterpartyEmail.length > 0 && !emailValid}
              helperText={counterpartyEmail.length > 0 && !emailValid ? "Enter a valid email address" : " "}
              inputProps={{ "data-testid": "escrow-create-email-input" }}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Escrow fee %"
                value={feePercent}
                onChange={(e) => setFeePercent(e.target.value.replace(/[^0-9.]/g, ""))}
                size="small"
                sx={{ flex: 1 }}
                inputProps={{ inputMode: "decimal", "data-testid": "escrow-create-feepercent-input" }}
              />
              <TextField
                label="Auto-release (days)"
                value={autoReleaseDays}
                onChange={(e) => setAutoReleaseDays(e.target.value.replace(/[^0-9]/g, ""))}
                size="small"
                sx={{ flex: 1 }}
                inputProps={{ inputMode: "numeric", "data-testid": "escrow-create-autorelease-input" }}
              />
            </Stack>

            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Who pays the escrow fee?</Typography>
              <RadioGroup row value={feePayer} onChange={(e) => setFeePayer(e.target.value as FeePayer)}>
                <FormControlLabel value="buyer" control={<Radio size="small" data-testid="escrow-feepayer-buyer" />} label="Buyer" />
                <FormControlLabel value="seller" control={<Radio size="small" data-testid="escrow-feepayer-seller" />} label="Seller" />
                <FormControlLabel value="split" control={<Radio size="small" data-testid="escrow-feepayer-split" />} label="Split 50/50" />
              </RadioGroup>
            </Box>

            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Coins the buyer can pay with</Typography>
              <Select
                multiple
                size="small"
                fullWidth
                value={acceptedCoins}
                onChange={(e) => setAcceptedCoins(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)}
                renderValue={(sel) => (sel as string[]).join(", ") || "All supported coins"}
                data-testid="escrow-create-coins-select"
              >
                {FUNDING_COINS.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <TextField
              label="Terms / notes (optional)"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={2}
              placeholder="What must happen for the funds to be released?"
            />

            {/* Live fee preview */}
            <Box sx={{ ...cardSx, backgroundColor: brandAlpha(isDark ? 0.1 : 0.05) }} data-testid="escrow-fee-preview">
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: BRAND_ACCENT, mb: 1 }}>
                Fee breakdown
              </Typography>
              {preview ? (
                <Stack spacing={0.6}>
                  <Row label="Deal amount" value={money(preview.amount, currency)} />
                  <Row label={`Escrow fee (${preview.feePercent}%)`} value={money(preview.escrowFee, currency)} />
                  <Divider sx={{ my: 0.5 }} />
                  <Row label="Buyer pays" value={money(preview.buyerPays, currency)} bold testId="escrow-preview-buyerpays" />
                  <Row label="Seller receives" value={money(preview.sellerReceives, currency)} bold testId="escrow-preview-sellerreceives" />
                </Stack>
              ) : (
                <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                  Enter an amount to see who pays what.
                </Typography>
              )}
            </Box>

            <Button
              variant="contained"
              size="large"
              disabled={!canSubmit}
              onClick={handleSubmit}
              data-testid="escrow-create-submit"
              sx={{ backgroundColor: BRAND_ACCENT, textTransform: "none", fontWeight: 700, py: 1.2 }}
            >
              {submitting ? "Creating…" : "Create & send invite"}
            </Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold, testId }: { label: string; value: string; bold?: boolean; testId?: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Typography sx={{ fontSize: 13, color: bold ? "text.primary" : "text.secondary", fontWeight: bold ? 700 : 400 }}>
        {label}
      </Typography>
      <Typography data-testid={testId} sx={{ fontSize: 13.5, fontWeight: bold ? 700 : 500 }}>
        {value}
      </Typography>
    </Box>
  );
}
