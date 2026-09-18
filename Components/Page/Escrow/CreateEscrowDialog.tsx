import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { CloseRounded, ContentCopyRounded, OpenInNewRounded, CheckCircleRounded } from "@mui/icons-material";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import { useDispatch } from "react-redux";
import Logo from "@/assets/Icons/Logo";
import { escrowApi, EscrowDeal, FeeBreakdown, FeePayer, EscrowRole } from "@/api/escrow";
import { BRAND_ACCENT, brandAlpha, brandFg } from "@/constants/theme";
import { FUNDING_COINS, PAYOUT_OPTIONS } from "./escrowUtils";
import { CoinIcon, coinInfo } from "./CoinIcon";
import FeeBreakdownCard from "./FeeBreakdownCard";

interface Props {
  open: boolean;
  companyId: number | null;
  onClose: () => void;
  onCreated: (deal: EscrowDeal) => void;
}

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
  const [feePayer, setFeePayer] = useState<FeePayer>("buyer");
  const [autoReleaseDays, setAutoReleaseDays] = useState("3");
  const [acceptedCoins, setAcceptedCoins] = useState<string[]>(["USDT-TRON", "BTC", "ETH"]);
  // Payout network used for the withdrawal-fee estimate in the quote. The seller
  // picks the final network at cash-out; this only affects the estimate shown here.
  const [payoutCoin, setPayoutCoin] = useState("USDT-TRON");
  const [terms, setTerms] = useState("");

  const [preview, setPreview] = useState<FeeBreakdown | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<EscrowDeal | null>(null);
  const qrWrapRef = useRef<HTMLDivElement | null>(null);

  const reset = useCallback(() => {
    setTitle("");
    setDescription("");
    setAmount("");
    setCreatorRole("seller");
    setCounterpartyEmail("");
    setFeePayer("buyer");
    setAutoReleaseDays("3");
    setAcceptedCoins(["USDT-TRON", "BTC", "ETH"]);
    setPayoutCoin("USDT-TRON");
    setTerms("");
    setPreview(null);
    setCreated(null);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // Live fee preview (debounced) — includes the accepted coins so the network
  // fee estimate reflects the cheapest coin the buyer can actually pay with.
  useEffect(() => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setPreview(null);
      return;
    }
    const handle = setTimeout(() => {
      escrowApi
        .feePreview({
          amount: amt,
          currency,
          fee_payer: feePayer,
          accepted_coins: acceptedCoins.length ? acceptedCoins.join(",") : undefined,
          payout_coin: payoutCoin,
        })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 350);
    return () => clearTimeout(handle);
  }, [amount, currency, feePayer, acceptedCoins, payoutCoin]);

  const emailValid = useMemo(() => /.+@.+\..+/.test(counterpartyEmail.trim()), [counterpartyEmail]);
  const canSubmit = title.trim().length >= 2 && Number(amount) > 0 && emailValid && !!companyId && !submitting;

  const fireConfetti = useCallback(() => {
    try {
      const rect = qrWrapRef.current?.getBoundingClientRect();
      const origin = rect
        ? { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight }
        : { x: 0.5, y: 0.35 };
      confetti({
        disableForReducedMotion: true,
        particleCount: 90,
        spread: 70,
        startVelocity: 38,
        origin,
        colors: ["#4338CA", "#6366F1", "#818CF8", "#12B76A"],
        scalar: 0.9,
      });
    } catch {
      /* confetti is best-effort */
    }
  }, []);

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
        fee_payer: feePayer,
        auto_release_days: Number(autoReleaseDays) || 3,
        send_invite: true,
      });
      setCreated(deal);
      setTimeout(fireConfetti, 120);
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

  const toggleCoin = (c: string) =>
    setAcceptedCoins((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

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
      {/* Branded header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, px: 3, pt: 2.5, pb: 1.5, pr: 6 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 2, display: "grid", placeItems: "center", backgroundColor: brandAlpha(isDark ? 0.16 : 0.09) }}>
          <Logo width={22} height={22} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1.15 }}>
            {created ? "Escrow deal created" : "New escrow deal"}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            {created ? "Share the secure link with your counterparty" : "DynoPay holds the funds until the deal is done"}
          </Typography>
        </Box>
        <IconButton onClick={onClose} disabled={submitting} data-testid="escrow-create-close" sx={{ position: "absolute", right: 12, top: 14 }}>
          <CloseRounded />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 1 }}>
        {created ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
              <CheckCircleRounded sx={{ color: "#12B76A" }} />
              <Typography sx={{ fontSize: 14.5 }}>
                Share this secure link with <b>{created.counterparty_email}</b>. They verify their email with a one-time
                code, then accept and act on the deal — no account needed.
              </Typography>
            </Box>

            {/* Shareable QR */}
            <Box sx={{ ...cardSx, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <Box
                ref={qrWrapRef}
                data-testid="escrow-created-qr"
                sx={{ p: 1.5, borderRadius: 2, backgroundColor: "#fff", border: `1px solid ${theme.palette.divider}` }}
              >
                <QRCodeSVG value={created.invite_url} size={148} fgColor="#4338CA" bgColor="#ffffff" level="M" includeMargin={false} />
              </Box>
              <Typography sx={{ fontSize: 12, color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}>
                <Icon icon="mdi:cellphone-nfc" width={14} /> Scan to open the invitation
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
              <Button onClick={reset} data-testid="escrow-create-another" sx={{ textTransform: "none" }}>
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

            {/* Role selection — cards */}
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.8 }}>Your role in this deal</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                <SelectCard
                  selected={creatorRole === "seller"}
                  onClick={() => setCreatorRole("seller")}
                  testId="escrow-role-seller"
                  icon="mdi:storefront-outline"
                  title="I'm the seller"
                  subtitle="I deliver & receive funds"
                />
                <SelectCard
                  selected={creatorRole === "buyer"}
                  onClick={() => setCreatorRole("buyer")}
                  testId="escrow-role-buyer"
                  icon="mdi:cart-outline"
                  title="I'm the buyer"
                  subtitle="I pay into escrow"
                />
              </Stack>
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

            {/* Escrow fee — platform-set (admin-controlled), shown read-only */}
            <Box
              sx={{ p: 1.4, borderRadius: 2, backgroundColor: theme.palette.action.hover, border: `1px solid ${theme.palette.divider}` }}
              data-testid="escrow-create-fee-info"
            >
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                Escrow fee: {preview?.feePercent ?? 5}%{" "}
                <Typography component="span" sx={{ fontSize: 12.5, color: "text.secondary", fontWeight: 500 }}>
                  (min ${Number(preview?.feeMinUsd ?? 1).toFixed(0)}) · set by DynoPay
                </Typography>
              </Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.2 }}>
                Choose below who covers this fee. Network &amp; exchange costs are added on top.
              </Typography>
            </Box>

            {/* Auto-release — merchant-chosen preset */}
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.8 }}>Auto-release window</Typography>
              <TextField
                select
                SelectProps={{ native: true }}
                value={autoReleaseDays}
                onChange={(e) => setAutoReleaseDays(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ "data-testid": "escrow-create-autorelease-select" }}
                helperText="If the buyer doesn't confirm, the held funds automatically release to the seller this long after delivery."
              >
                {[3, 5, 7, 14].map((d) => (
                  <option key={d} value={String(d)}>
                    {d} days after delivery
                  </option>
                ))}
              </TextField>
            </Box>

            {/* Fee payer — segmented cards */}
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.8 }}>Who pays the escrow cost?</Typography>
              <Stack direction="row" spacing={1.2}>
                <SegChip selected={feePayer === "buyer"} onClick={() => setFeePayer("buyer")} testId="escrow-feepayer-buyer" label="Buyer" />
                <SegChip selected={feePayer === "seller"} onClick={() => setFeePayer("seller")} testId="escrow-feepayer-seller" label="Seller" />
                <SegChip selected={feePayer === "split"} onClick={() => setFeePayer("split")} testId="escrow-feepayer-split" label="Split 50/50" />
              </Stack>
            </Box>

            {/* Accepted coins — icon chips */}
            <Box data-testid="escrow-create-coins-select">
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.8 }}>Coins the buyer can pay with</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {FUNDING_COINS.map((c) => {
                  const on = acceptedCoins.includes(c);
                  const info = coinInfo(c);
                  return (
                    <Box
                      key={c}
                      role="button"
                      onClick={() => toggleCoin(c)}
                      data-testid={`escrow-coin-${c}`}
                      data-selected={on ? "true" : "false"}
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.6,
                        px: 1.1,
                        py: 0.6,
                        borderRadius: 999,
                        cursor: "pointer",
                        userSelect: "none",
                        fontSize: 12.5,
                        fontWeight: 600,
                        border: `1.5px solid ${on ? BRAND_ACCENT : theme.palette.divider}`,
                        color: on ? brandFg(isDark) : theme.palette.text.secondary,
                        backgroundColor: on ? brandAlpha(isDark ? 0.14 : 0.07) : "transparent",
                        transition: "border-color .15s, background-color .15s",
                        "&:hover": { borderColor: BRAND_ACCENT },
                      }}
                    >
                      <CoinIcon code={c} size={16} />
                      {info.symbol}
                      {info.networkLabel && info.symbol !== info.networkLabel ? (
                        <Typography component="span" sx={{ fontSize: 10.5, color: "text.secondary", fontWeight: 500 }}>
                          {c.includes("-") ? c.split("-")[1] : ""}
                        </Typography>
                      ) : null}
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Payout network — sets the withdrawal-fee estimate in the quote */}
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.8 }}>Payout network (for the estimate)</Typography>
              <TextField
                select
                SelectProps={{ native: true }}
                value={payoutCoin}
                onChange={(e) => setPayoutCoin(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ "data-testid": "escrow-create-payout-coin" }}
                helperText="The seller chooses the final stablecoin network at cash-out — this only sets the withdrawal-fee estimate in the quote below."
              >
                {PAYOUT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </TextField>
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

            {/* Live itemised quote */}
            <Box sx={{ ...cardSx, backgroundColor: brandAlpha(isDark ? 0.08 : 0.04) }}>
              {preview ? (
                <FeeBreakdownCard
                  breakdown={preview}
                  currency={currency}
                  buyerPaysTestId="escrow-preview-buyerpays"
                  sellerReceivesTestId="escrow-preview-sellerreceives"
                  totalTestId="escrow-preview-total"
                />
              ) : (
                <Box data-testid="escrow-fee-preview">
                  <Typography sx={{ fontSize: 12.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3, color: brandFg(isDark), mb: 0.5 }}>
                    Cost breakdown
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Enter an amount to see who pays what.</Typography>
                </Box>
              )}
            </Box>

            <Button
              variant="contained"
              size="large"
              disabled={!canSubmit}
              onClick={handleSubmit}
              data-testid="escrow-create-submit"
              sx={{ backgroundColor: BRAND_ACCENT, textTransform: "none", fontWeight: 700, py: 1.2, "&:hover": { backgroundColor: "#3730A3" } }}
            >
              {submitting ? "Creating…" : "Create & send invite"}
            </Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SelectCard({
  selected,
  onClick,
  testId,
  icon,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  testId: string;
  icon: string;
  title: string;
  subtitle: string;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Box
      role="button"
      onClick={onClick}
      data-testid={testId}
      data-selected={selected ? "true" : "false"}
      sx={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: 1,
        p: 1.4,
        borderRadius: 2,
        cursor: "pointer",
        border: `1.5px solid ${selected ? BRAND_ACCENT : theme.palette.divider}`,
        backgroundColor: selected ? brandAlpha(isDark ? 0.14 : 0.06) : "transparent",
        transition: "border-color .15s, background-color .15s",
        "&:hover": { borderColor: BRAND_ACCENT },
      }}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: 1.5,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          backgroundColor: selected ? BRAND_ACCENT : theme.palette.action.hover,
          color: selected ? "#fff" : theme.palette.text.secondary,
        }}
      >
        <Icon icon={icon} width={19} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>{title}</Typography>
        <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{subtitle}</Typography>
      </Box>
    </Box>
  );
}

function SegChip({ selected, onClick, testId, label }: { selected: boolean; onClick: () => void; testId: string; label: string }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Box
      role="button"
      onClick={onClick}
      data-testid={testId}
      data-selected={selected ? "true" : "false"}
      sx={{
        flex: 1,
        textAlign: "center",
        py: 0.9,
        borderRadius: 1.5,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 700,
        border: `1.5px solid ${selected ? BRAND_ACCENT : theme.palette.divider}`,
        color: selected ? brandFg(isDark) : theme.palette.text.secondary,
        backgroundColor: selected ? brandAlpha(isDark ? 0.14 : 0.07) : "transparent",
        transition: "border-color .15s, background-color .15s",
        "&:hover": { borderColor: BRAND_ACCENT },
      }}
    >
      {label}
    </Box>
  );
}
