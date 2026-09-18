import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import {
  VerifiedUserRounded,
  CheckCircleRounded,
  MarkEmailReadRounded,
  ShieldRounded,
} from "@mui/icons-material";
import confetti from "canvas-confetti";
import Logo from "@/assets/Icons/Logo";
import { escrowPublicApi, EscrowDeal } from "@/api/escrow";
import { BRAND_ACCENT, brandAlpha, brandFg } from "@/constants/theme";
import StatusChip from "@/Components/Page/Escrow/StatusChip";
import EscrowProgress from "@/Components/Page/Escrow/EscrowProgress";
import FeeBreakdownCard from "@/Components/Page/Escrow/FeeBreakdownCard";
import { CoinIcon } from "@/Components/Page/Escrow/CoinIcon";
import { stable, shortDate, titleize, legTone, FUNDING_COINS, PAYOUT_OPTIONS } from "@/Components/Page/Escrow/escrowUtils";

type ActiveAction = null | "decline" | "fund" | "deliver" | "release" | "dispute" | "address";

const celebrate = () => {
  try {
    confetti({
      disableForReducedMotion: true,
      particleCount: 90,
      spread: 72,
      startVelocity: 40,
      origin: { x: 0.5, y: 0.35 },
      colors: ["#4338CA", "#6366F1", "#818CF8", "#12B76A"],
      scalar: 0.9,
    });
  } catch {
    /* best-effort */
  }
};

export default function EscrowInvite({ token }: { token: string }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [deal, setDeal] = useState<EscrowDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  const [active, setActive] = useState<ActiveAction>(null);
  const [coin, setCoin] = useState("USDT-TRON");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [reason, setReason] = useState("");
  const [addr, setAddr] = useState("");
  const [payoutCoin, setPayoutCoin] = useState("USDT-TRON");

  const flash = (text: string, kind: "ok" | "err" = "ok") => {
    setMsg({ text, kind });
    if (kind === "ok") setTimeout(() => setMsg(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await escrowPublicApi.get(token);
      setDeal(d);
      setEmail((prev) => prev || d.counterparty_email || "");
    } catch (e: any) {
      setError(e?.response?.data?.message || "This escrow invitation could not be found.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  // Restore a still-valid escrow session for this token (survives refresh).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`escrow_sess_${token}`);
      if (saved) setSessionToken(saved);
    } catch {
      /* sessionStorage unavailable */
    }
  }, [token]);

  const myRole = deal?.counterparty_role;
  const isBuyer = myRole === "buyer";
  const isSeller = myRole === "seller";
  const status = deal?.status;

  const sendOtp = async () => {
    if (!/.+@.+\..+/.test(email.trim())) return flash("Enter a valid email address.", "err");
    setBusy(true);
    try {
      const r = await escrowPublicApi.sendOtp(token, email.trim());
      setOtpSent(true);
      if (r.preview_otp) {
        setPreviewOtp(r.preview_otp);
        setOtp(r.preview_otp);
      }
      flash("We sent a 6-digit code to your email.");
    } catch (e: any) {
      flash(e?.response?.data?.message || "Could not send the code.", "err");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setBusy(true);
    try {
      const r = await escrowPublicApi.verifyOtp(token, email.trim(), otp.trim());
      setSessionToken(r.escrow_session);
      try {
        sessionStorage.setItem(`escrow_sess_${token}`, r.escrow_session);
      } catch {
        /* ignore */
      }
      flash("Email verified — you can now act on this deal.");
      load();
    } catch (e: any) {
      flash(e?.response?.data?.message || "Invalid or expired code.", "err");
    } finally {
      setBusy(false);
    }
  };

  const doRespond = async (action: "accept" | "decline") => {
    if (!sessionToken) return;
    setBusy(true);
    try {
      const d = await escrowPublicApi.respond(token, sessionToken, action, reason.trim() || undefined);
      setDeal(d);
      setActive(null);
      setReason("");
      flash(action === "accept" ? "Invitation accepted." : "Invitation declined.");
      if (action === "accept") setTimeout(celebrate, 100);
    } catch (e: any) {
      flash(e?.response?.data?.message || "Could not submit your response.", "err");
    } finally {
      setBusy(false);
    }
  };

  const doAction = async (body: Parameters<typeof escrowPublicApi.action>[2], okMsg: string, party?: boolean) => {
    if (!sessionToken) return;
    setBusy(true);
    try {
      const d = await escrowPublicApi.action(token, sessionToken, body);
      setDeal(d);
      setActive(null);
      setDeliveryNote("");
      setReason("");
      setAddr("");
      flash(okMsg);
      if (party) setTimeout(celebrate, 100);
    } catch (e: any) {
      flash(e?.response?.data?.message || "That action could not be completed.", "err");
    } finally {
      setBusy(false);
    }
  };

  const verified = !!sessionToken;

  // available actions after verification
  const canAccept = verified && status === "invited";
  const canFund = verified && isBuyer && status === "awaiting_payment";
  const canDeliver = verified && isSeller && status === "funded";
  const canRelease = verified && isBuyer && ["funded", "delivered"].includes(status || "");
  const canDispute = verified && ["funded", "delivered"].includes(status || "");
  const sellerNeedsAddress =
    verified && isSeller && !deal?.seller_address_on_file &&
    (deal?.seller_payout_state === "pending" || ["funded", "delivered"].includes(status || ""));
  const buyerNeedsRefund =
    verified && isBuyer && !deal?.buyer_address_on_file && deal?.buyer_payout_state === "pending";

  const b = deal?.breakdown;

  const pageBg = isDark ? "#0B0B0F" : "#F5F6FA";
  const cardSx = {
    p: { xs: 2.2, sm: 3 },
    borderRadius: 3,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  } as const;

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: pageBg, py: { xs: 3, sm: 6 }, px: 2 }}>
      {/* brand bar */}
      <Box sx={{ maxWidth: 620, mx: "auto", mb: 2.5, display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", backgroundColor: brandAlpha(isDark ? 0.16 : 0.1) }}>
          <Logo width={24} height={24} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 18 }}>DynoPay</Typography>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: brandFg(isDark) }}>
          <ShieldRounded sx={{ fontSize: 16 }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Secure escrow</Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 620, mx: "auto" }}>
        {loading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 10 }}>
            <CircularProgress size={30} sx={{ color: BRAND_ACCENT }} />
          </Box>
        ) : error || !deal ? (
          <Box sx={{ ...cardSx, textAlign: "center", py: 6 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 1 }}>Invitation unavailable</Typography>
            <Typography sx={{ color: "text.secondary" }}>{error}</Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {/* Deal summary */}
            <Box sx={cardSx} data-testid="escrow-invite-summary">
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 20, flex: 1, minWidth: 0 }}>{deal.title}</Typography>
                <StatusChip deal={deal} testId="escrow-invite-status" />
              </Box>
              <Typography sx={{ fontSize: 13.5, color: "text.secondary", mb: 2 }}>
                <b>{deal.created_by || deal.brand}</b> invited you as the <b>{titleize(myRole)}</b>.
              </Typography>

              {/* Progress tracker */}
              <Box sx={{ mb: 2 }}>
                <EscrowProgress deal={deal} testId="escrow-invite-progress" />
              </Box>

              {deal.description && (
                <Typography sx={{ fontSize: 14, mb: 2, whiteSpace: "pre-wrap" }}>{deal.description}</Typography>
              )}

              <Box sx={{ p: 1.8, borderRadius: 2, backgroundColor: brandAlpha(isDark ? 0.1 : 0.05) }}>
                {b ? (
                  <FeeBreakdownCard breakdown={b} currency={deal.currency} totalTestId="escrow-invite-total" />
                ) : null}
              </Box>

              {deal.terms && (
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.secondary" }}>Terms</Typography>
                  <Typography sx={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{deal.terms}</Typography>
                </Box>
              )}

              {/* settlement legs (read) */}
              {(deal.seller_payout_state !== "na" || deal.buyer_payout_state !== "na") && (
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.secondary", mb: 1 }}>Settlement</Typography>
                  <Stack spacing={1}>
                    {deal.seller_payout_state && deal.seller_payout_state !== "na" && (
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, minWidth: 0 }}>
                          <CoinIcon code={deal.seller_payout_coin || deal.custody_stablecoin} size={16} />
                          <Typography sx={{ fontSize: 13 }}>Seller payout · {stable(deal.seller_entitlement_stable, deal.seller_payout_coin || deal.custody_stablecoin)}</Typography>
                        </Box>
                        <StatusChip tone={legTone(deal.seller_payout_state)} label={titleize(deal.seller_payout_state)} size="sm" />
                      </Box>
                    )}
                    {deal.buyer_payout_state && deal.buyer_payout_state !== "na" && (
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, minWidth: 0 }}>
                          <CoinIcon code={deal.buyer_refund_coin || deal.custody_stablecoin} size={16} />
                          <Typography sx={{ fontSize: 13 }}>Buyer refund · {stable(deal.buyer_entitlement_stable, deal.buyer_refund_coin || deal.custody_stablecoin)}</Typography>
                        </Box>
                        <StatusChip tone={legTone(deal.buyer_payout_state)} label={titleize(deal.buyer_payout_state)} size="sm" />
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}
            </Box>

            {/* Verify OR act */}
            {!verified ? (
              <Box sx={cardSx} data-testid="escrow-invite-verify">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <VerifiedUserRounded sx={{ color: BRAND_ACCENT }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Verify it&apos;s you</Typography>
                </Box>
                <Typography sx={{ fontSize: 13.5, color: "text.secondary", mb: 2 }}>
                  Confirm the email this invitation was sent to. We&apos;ll email you a one-time code — no account needed.
                </Typography>

                <Stack spacing={1.5}>
                  <TextField
                    label="Your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    size="small"
                    fullWidth
                    disabled={otpSent}
                    inputProps={{ "data-testid": "escrow-invite-email" }}
                  />
                  {!otpSent ? (
                    <Button
                      variant="contained"
                      onClick={sendOtp}
                      disabled={busy}
                      data-testid="escrow-invite-send-otp"
                      sx={{ backgroundColor: BRAND_ACCENT, textTransform: "none", fontWeight: 700 }}
                    >
                      {busy ? "Sending…" : "Send code"}
                    </Button>
                  ) : (
                    <>
                      {previewOtp && (
                        <Box sx={{ p: 1, borderRadius: 1.5, backgroundColor: brandAlpha(0.08), display: "flex", alignItems: "center", gap: 1 }}>
                          <MarkEmailReadRounded sx={{ fontSize: 18, color: BRAND_ACCENT }} />
                          <Typography sx={{ fontSize: 12.5 }}>
                            Preview mode: your code is <b data-testid="escrow-invite-preview-otp">{previewOtp}</b> (email is off in preview).
                          </Typography>
                        </Box>
                      )}
                      <TextField
                        label="6-digit code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                        size="small"
                        fullWidth
                        inputProps={{ inputMode: "numeric", "data-testid": "escrow-invite-otp" }}
                      />
                      <Stack direction="row" spacing={1}>
                        <Button onClick={sendOtp} disabled={busy} sx={{ textTransform: "none" }} data-testid="escrow-invite-resend">
                          Resend
                        </Button>
                        <Box sx={{ flex: 1 }} />
                        <Button
                          variant="contained"
                          onClick={verifyOtp}
                          disabled={busy || otp.length !== 6}
                          data-testid="escrow-invite-verify-otp"
                          sx={{ backgroundColor: BRAND_ACCENT, textTransform: "none", fontWeight: 700 }}
                        >
                          {busy ? "Verifying…" : "Verify"}
                        </Button>
                      </Stack>
                    </>
                  )}
                  {deal.has_account && (
                    <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>
                      This email has a DynoPay account —{" "}
                      <a href={`/auth/login?next=${encodeURIComponent(`/escrow/invite/${token}`)}`} style={{ color: BRAND_ACCENT, fontWeight: 600 }}>
                        sign in
                      </a>{" "}
                      if you prefer (optional).
                    </Typography>
                  )}
                </Stack>
              </Box>
            ) : (
              <Box sx={cardSx} data-testid="escrow-invite-actions">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <CheckCircleRounded sx={{ color: "#12B76A" }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 16 }}>You&apos;re verified</Typography>
                </Box>
                <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
                  Acting as the <b>{titleize(myRole)}</b> for this deal.
                </Typography>

                {/* Accept / decline */}
                {canAccept && active !== "decline" && (
                  <Stack direction="row" spacing={1.5} sx={{ mb: 1 }}>
                    <Button
                      variant="contained"
                      onClick={() => doRespond("accept")}
                      disabled={busy}
                      data-testid="escrow-invite-accept"
                      sx={{ backgroundColor: BRAND_ACCENT, textTransform: "none", fontWeight: 700, flex: 1 }}
                    >
                      Accept invitation
                    </Button>
                    <Button onClick={() => setActive("decline")} disabled={busy} sx={{ textTransform: "none", color: "#DC2626" }} data-testid="escrow-invite-decline-open">
                      Decline
                    </Button>
                  </Stack>
                )}
                {active === "decline" && (
                  <InlineForm
                    title="Decline this invitation?"
                    onCancel={() => setActive(null)}
                    onConfirm={() => doRespond("decline")}
                    confirmLabel="Decline"
                    confirmColor="#DC2626"
                    busy={busy}
                    testId="escrow-invite-decline"
                  >
                    <TextField label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} size="small" fullWidth inputProps={{ "data-testid": "escrow-invite-decline-reason" }} />
                  </InlineForm>
                )}

                {/* Fund */}
                {canFund && active !== "fund" && (
                  <ActionRow label={`Fund the escrow (${b ? new Intl.NumberFormat("en-US", { style: "currency", currency: deal.currency }).format(b.buyerPays) : ""})`} onClick={() => setActive("fund")} testId="escrow-invite-fund-open" />
                )}
                {active === "fund" && (
                  <InlineForm
                    title="Fund the escrow"
                    hint="In preview this is simulated and converted to a stablecoin held in custody — no real crypto moves."
                    onCancel={() => setActive(null)}
                    onConfirm={() => doAction({ action: "fund", coin }, "Escrow funded (simulated).", true)}
                    confirmLabel="Fund now"
                    busy={busy}
                    testId="escrow-invite-fund"
                  >
                    <Select fullWidth size="small" value={coin} onChange={(e) => setCoin(e.target.value)} data-testid="escrow-invite-fund-coin" renderValue={(v) => <CoinMenuLabel code={String(v)} prefix="Pay with " />}>
                      {FUNDING_COINS.map((c) => (
                        <MenuItem key={c} value={c}><CoinMenuLabel code={c} /></MenuItem>
                      ))}
                    </Select>
                  </InlineForm>
                )}

                {/* Deliver */}
                {canDeliver && active !== "deliver" && (
                  <ActionRow label="Mark as delivered" onClick={() => setActive("deliver")} testId="escrow-invite-deliver-open" />
                )}
                {active === "deliver" && (
                  <InlineForm
                    title="Mark as delivered"
                    onCancel={() => setActive(null)}
                    onConfirm={() => doAction({ action: "deliver", delivery_note: deliveryNote.trim() || undefined }, "Marked as delivered.")}
                    confirmLabel="Mark delivered"
                    busy={busy}
                    testId="escrow-invite-deliver"
                  >
                    <TextField label="Delivery note (optional)" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} size="small" fullWidth multiline minRows={2} inputProps={{ "data-testid": "escrow-invite-deliver-note" }} />
                  </InlineForm>
                )}

                {/* Release */}
                {canRelease && active !== "release" && (
                  <ActionRow label="Release funds to seller" onClick={() => setActive("release")} testId="escrow-invite-release-open" primary />
                )}
                {active === "release" && (
                  <InlineForm
                    title="Release funds to the seller?"
                    hint="This confirms the deal is complete and authorizes the seller payout."
                    onCancel={() => setActive(null)}
                    onConfirm={() => doAction({ action: "release" }, "Release authorized.", true)}
                    confirmLabel="Release"
                    confirmColor="#12B76A"
                    busy={busy}
                    testId="escrow-invite-release"
                  />
                )}

                {/* Add address (seller payout / buyer refund) */}
                {(sellerNeedsAddress || buyerNeedsRefund) && active !== "address" && (
                  <ActionRow
                    label={sellerNeedsAddress ? "Add your payout address" : "Add your refund address"}
                    onClick={() => setActive("address")}
                    testId="escrow-invite-address-open"
                    primary
                  />
                )}
                {active === "address" && (
                  <InlineForm
                    title={sellerNeedsAddress ? "Where should we send your funds?" : "Where should your refund go?"}
                    hint="Pick a network and paste a stablecoin address you control. This is required — account wallets aren't used here."
                    onCancel={() => setActive(null)}
                    onConfirm={() =>
                      doAction(
                        sellerNeedsAddress
                          ? { action: "payout-info", payout_address: addr.trim(), payout_coin: payoutCoin }
                          : { action: "payout-info", refund_address: addr.trim(), refund_coin: payoutCoin },
                        "Address saved.",
                        true
                      )
                    }
                    confirmLabel="Save address"
                    confirmDisabled={addr.trim().length < 6}
                    busy={busy}
                    testId="escrow-invite-address"
                  >
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", mb: 0.6 }}>Payout network</Typography>
                    <Select fullWidth size="small" value={payoutCoin} onChange={(e) => setPayoutCoin(e.target.value)} sx={{ mb: 1.5 }} data-testid="escrow-invite-address-coin" renderValue={(v) => <CoinMenuLabel code={String(v)} network />}>
                      {PAYOUT_OPTIONS.map((o) => (
                        <MenuItem key={o.key} value={o.key}><CoinMenuLabel code={o.key} network /></MenuItem>
                      ))}
                    </Select>
                    <TextField label={`${payoutCoin} address`} value={addr} onChange={(e) => setAddr(e.target.value)} size="small" fullWidth inputProps={{ "data-testid": "escrow-invite-address-input" }} />
                  </InlineForm>
                )}

                {/* Dispute */}
                {canDispute && active !== "dispute" && (
                  <Button onClick={() => setActive("dispute")} sx={{ textTransform: "none", color: "#B45309", mt: 1 }} data-testid="escrow-invite-dispute-open">
                    Something wrong? Open a dispute
                  </Button>
                )}
                {active === "dispute" && (
                  <InlineForm
                    title="Open a dispute"
                    hint="Funds stay safely in custody while a DynoPay admin reviews."
                    onCancel={() => setActive(null)}
                    onConfirm={() => doAction({ action: "dispute", reason: reason.trim() }, "Dispute opened.")}
                    confirmLabel="Open dispute"
                    confirmColor="#F59E0B"
                    confirmDisabled={reason.trim().length < 3}
                    busy={busy}
                    testId="escrow-invite-dispute"
                  >
                    <TextField label="What went wrong?" value={reason} onChange={(e) => setReason(e.target.value)} size="small" fullWidth multiline minRows={3} inputProps={{ "data-testid": "escrow-invite-dispute-reason" }} />
                  </InlineForm>
                )}

                {!canAccept && !canFund && !canDeliver && !canRelease && !canDispute && !sellerNeedsAddress && !buyerNeedsRefund && (
                  <Typography sx={{ fontSize: 13.5, color: "text.secondary" }} data-testid="escrow-invite-no-actions">
                    {status === "disputed"
                      ? "This deal is under dispute. A DynoPay admin will review and resolve it."
                      : "Nothing to do right now — you're all set. Check back for updates."}
                  </Typography>
                )}
              </Box>
            )}

            {msg && (
              <Box
                data-testid="escrow-invite-flash"
                sx={{
                  p: 1.4,
                  borderRadius: 2,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: msg.kind === "ok" ? "#05603A" : "#912018",
                  backgroundColor: msg.kind === "ok" ? "#ECFDF3" : "#FEF3F2",
                  border: `1px solid ${msg.kind === "ok" ? "#A6F4C5" : "#FECDCA"}`,
                }}
              >
                {msg.text}
              </Box>
            )}

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, mt: 1 }}>
              <ShieldRounded sx={{ fontSize: 13, color: "text.secondary" }} />
              <Typography sx={{ textAlign: "center", fontSize: 11.5, color: "text.secondary" }}>
                Protected by DynoPay escrow · funds held until the deal completes or a dispute is resolved
                {deal.simulated ? " · preview (simulated, no real crypto)" : ""}. Invited {shortDate(deal.invited_at)}.
              </Typography>
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function CoinMenuLabel({ code, prefix, network }: { code: string; prefix?: string; network?: boolean }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.8 }}>
      <CoinIcon code={code} size={18} />
      <span>
        {prefix}
        {network ? PAYOUT_OPTIONS.find((o) => o.key === code)?.label || code : code}
      </span>
    </Box>
  );
}

function ActionRow({ label, onClick, testId, primary }: { label: string; onClick: () => void; testId?: string; primary?: boolean }) {
  return (
    <Button
      fullWidth
      variant={primary ? "contained" : "outlined"}
      onClick={onClick}
      data-testid={testId}
      sx={{
        justifyContent: "flex-start",
        textTransform: "none",
        fontWeight: 600,
        mb: 1,
        ...(primary
          ? { backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#3730A3" } }
          : { color: BRAND_ACCENT, borderColor: BRAND_ACCENT }),
      }}
    >
      {label}
    </Button>
  );
}

function InlineForm({
  title,
  hint,
  children,
  onCancel,
  onConfirm,
  confirmLabel,
  confirmColor = BRAND_ACCENT,
  confirmDisabled,
  busy,
  testId,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmColor?: string;
  confirmDisabled?: boolean;
  busy?: boolean;
  testId?: string;
}) {
  return (
    <Box sx={{ p: 1.8, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}`, mb: 1 }} data-testid={testId}>
      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: hint ? 0.5 : 1.2 }}>{title}</Typography>
      {hint && <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 1.2 }}>{hint}</Typography>}
      {children}
      <Stack direction="row" spacing={1} sx={{ mt: 1.5, justifyContent: "flex-end" }}>
        <Button onClick={onCancel} disabled={busy} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={busy || confirmDisabled}
          data-testid={testId ? `${testId}-confirm` : undefined}
          sx={{ backgroundColor: confirmColor, textTransform: "none", fontWeight: 700, "&:hover": { backgroundColor: confirmColor, filter: "brightness(0.95)" } }}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </Stack>
    </Box>
  );
}
