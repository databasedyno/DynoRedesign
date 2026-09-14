import React, { useEffect, useRef, useState } from "react";
import { Box, IconButton, useTheme } from "@mui/material";
import { QRCodeCanvas } from "qrcode.react";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import CopyInline from "@/Components/UX/CopyInline";
import CustomButton from "@/Components/UI/Buttons";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { copyToClipboard } from "@/helpers/copyToClipboard";
import { downloadQrPng } from "@/helpers/downloadQrPng";
import { extractPayRef } from "@/helpers/payLinkUrl";
import { formatPreviewAmount } from "./CheckoutPreview";
import { StepFooter, StepHeader } from "./StepChrome";
import type { CreatedLink } from "./StepFirstLink";
import { markLinkShared } from "./useSetupProgress";

interface Props {
  link: CreatedLink;
  companyId?: number | null;
  justCreated: boolean;
  onBack: () => void;
  onDone: () => void;
  onCreateAnother: () => void;
}

/** Step 4 — Share it: copy / QR / share / open, what happens next, then off to the dashboard. */
const StepShare: React.FC<Props> = ({ link, companyId, justCreated, onBack, onDone, onCreateAnother }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const dispatch = useDispatch();
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!justCreated) return;
    void import("@/helpers/fireConfetti").then((m) => m.fireConfetti()).catch(() => {});
  }, [justCreated]);

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;
  const surface = isDark ? "rgba(255,255,255,0.03)" : "rgba(10,10,15,0.02)";

  const flashCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };
  const toastFail = () =>
    dispatch({
      type: "TOAST_SHOW",
      payload: { message: t("gs.copyFailed", { defaultValue: "Copy failed — select and copy manually." }), severity: "error" },
    });

  // A4: the first copy / share / QR / open counts as "shared" for the setup ring.
  const shared = () => markLinkShared(companyId);
  const handleCopy = async () => {
    const ok = await copyToClipboard(link.url);
    if (ok) {
      flashCopied();
      shared();
    } else toastFail();
  };
  const handleShare = async () => {
    const text = [link.description, formatPreviewAmount(link.amount, link.currency)].filter(Boolean).join(" — ");
    if (typeof navigator !== "undefined" && typeof (navigator as any).share === "function") {
      try {
        await (navigator as any).share({ title: text, text, url: link.url });
        shared();
        return;
      } catch {
        /* cancelled — fall back to copy */
      }
    }
    handleCopy();
  };
  const handleOpen = () => {
    window.open(link.url, "_blank", "noopener");
    shared();
  };
  const handleDownloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    downloadQrPng(canvas, { caption: link.url.replace(/^https?:\/\//, ""), filename: `dynopay-${extractPayRef(link.url) || "payment-qr"}.png` });
    shared();
  };

  const iconBtnSx = { border: `1px solid ${border}`, borderRadius: "12px", minWidth: 46, minHeight: 46, flexShrink: 0, color: ink };
  const nextSteps = [
    t("gs.next1", { defaultValue: "Your customer opens the link and pays in the coin they choose." }),
    t("gs.next2", { defaultValue: "The funds are forwarded straight to your payout wallet." }),
    t("gs.next3", { defaultValue: "You get notified and your dashboard fills in." }),
  ];

  return (
    <Box data-testid="gs-step-share">
      <StepHeader
        eyebrow={t("gs.stepOf", { n: 4, total: 4, defaultValue: "Step {{n}} of {{total}}" })}
        title={t("gs.shareTitle", { defaultValue: "Your link is live" })}
        subtitle={t("gs.shareSubtitle", { defaultValue: "Send it to a customer — the payment lands in your wallet and shows up on your dashboard." })}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "220px minmax(0, 1fr)" }, gap: { xs: 2.5, md: 4 }, alignItems: "start" }}>
        <Box sx={{ display: "flex", justifyContent: { xs: "center", md: "flex-start" } }}>
          <Box ref={qrRef} data-testid="gs-qr" sx={{ p: 1.5, borderRadius: "16px", backgroundColor: "#FFFFFF", border: `1px solid ${border}` }}>
            <QRCodeCanvas value={link.url} size={188} />
          </Box>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: positive, fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700 }}>
            <Icon name="check-circle-2" size={18} />
            {t("gs.linkReady", { defaultValue: "Ready to share" })}
          </Box>
          <Box data-testid="gs-share-summary" sx={{ mt: 0.75, fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, color: ink, letterSpacing: "-0.01em" }}>
            {formatPreviewAmount(link.amount, link.currency) || ""}
            {link.description && (
              <Box component="span" sx={{ color: muted, fontWeight: 500 }}> · {link.description}</Box>
            )}
          </Box>

          <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1, border: `1px solid ${border}`, borderRadius: "12px", backgroundColor: surface, px: 1.5, py: 1 }}>
            <Box data-testid="gs-share-url" sx={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 13, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {link.url}
            </Box>
            <CopyInline value={link.url} size={17} testId="gs-share-copy-inline" copyLabel={t("gs.copyLink", { defaultValue: "Copy link" })} sx={{ minWidth: 40, minHeight: 40 }} onCopied={(ok) => (ok ? (flashCopied(), shared()) : toastFail())} />
          </Box>

          <Box sx={{ mt: 1.5, display: "flex", gap: 1.25, flexWrap: "wrap" }}>
            <Box sx={{ flex: "1 1 120px", minWidth: 0, "& button": { width: "100%", minHeight: 46 } }}>
              <CustomButton label={copied ? t("gs.copied", { defaultValue: "Copied ✓" }) : t("gs.copyLink", { defaultValue: "Copy link" })} variant="primary" onClick={handleCopy} data-testid="gs-share-copy" data-copied={copied ? "true" : "false"} />
            </Box>
            <IconButton onClick={handleShare} data-testid="gs-share-native" aria-label={t("gs.share", { defaultValue: "Share" })} sx={iconBtnSx}>
              <Icon name="share-2" size={18} />
            </IconButton>
            <IconButton onClick={handleOpen} data-testid="gs-share-open" aria-label={t("gs.openLink", { defaultValue: "Open link" })} sx={iconBtnSx}>
              <Icon name="external-link" size={18} />
            </IconButton>
            <IconButton onClick={handleDownloadQr} data-testid="gs-share-download-qr" aria-label={t("gs.downloadQr", { defaultValue: "Download QR" })} sx={iconBtnSx}>
              <Icon name="download" size={18} />
            </IconButton>
          </Box>

          <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${border}` }}>
            <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: muted }}>
              {t("gs.nextTitle", { defaultValue: "What happens next" })}
            </Box>
            <Box component="ol" sx={{ m: 0, mt: 1.25, p: 0, listStyle: "none", display: "grid", gap: 1 }}>
              {nextSteps.map((s, i) => (
                <Box component="li" key={i} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
                  <Box sx={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: ink, backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(10,10,15,0.06)" }}>
                    {i + 1}
                  </Box>
                  <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, lineHeight: 1.5, color: isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight }}>{s}</Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      <StepFooter
        onBack={onBack}
        primaryLabel={t("gs.goDashboard", { defaultValue: "Go to dashboard" })}
        onPrimary={onDone}
        primaryTestId="gs-share-done"
        secondaryLabel={t("gs.createAnother", { defaultValue: "Create another link" })}
        onSecondary={onCreateAnother}
        secondaryTestId="gs-share-create-another"
      />
    </Box>
  );
};

export default StepShare;
