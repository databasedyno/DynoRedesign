import PopupModal from "@/Components/UI/PopupModal";
import useIsMobile from "@/hooks/useIsMobile";
import { Box, IconButton, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import {
  CloseIconButton,
  LabelText,
  PaymentDetailsContainer,
  PaymentDetailsTitle,
  Row,
  ValueText,
} from "./styled";

import CloseIcon from "@/assets/Icons/close-icon.svg";
import HourglassIcon from "@/assets/Icons/hourglass-icon.svg";
import NoteIcon from "@/assets/Icons/note-icon.svg";
import PaymentIcon from "@/assets/Icons/payment-icon.svg";
import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import TransactionIcon from "@/assets/Icons/transaction-icon.svg";
import PanelCard from "@/Components/UI/PanelCard";
import Toast from "@/Components/UI/Toast";
import CustomButton from "@/Components/UI/Buttons";
import CopyInline from "@/Components/UX/CopyInline";
import EmbedSnippet from "@/Components/Page/Payment-link/EmbedSnippet";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon, MONO } from "@/styles/uiKit";
import { copyToClipboard } from "@/helpers/copyToClipboard";
import { extractPayRef } from "@/helpers/payLinkUrl";
import { downloadQrPng } from "@/helpers/downloadQrPng";
import { getCurrencySymbolFromFormat, formatWithSeparators } from "@/utils/currencyFormat";
import {
  PaymentDetailRowProps,
  PaymentLinkSuccessModalProps,
} from "@/utils/types/paymentLink";

const PaymentDetailRow: React.FC<PaymentDetailRowProps> = ({ icon, alt, label, value }) => {
  const isMobile = useIsMobile("md");
  return (
    <Row>
      <Image
        src={icon}
        alt={alt}
        width={isMobile ? 12 : 16}
        height={isMobile ? 12 : 16}
        draggable={false}
        style={{ filter: "brightness(0) saturate(100%) invert(40%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%)" }}
      />
      <LabelText>{label}:</LabelText>
      <ValueText>{value}</ValueText>
    </Row>
  );
};

/** Success state after creating a link: share tools (copy / share / open / QR / embed) + details (plan 2.3). */
const PaymentLinkSuccessModal: React.FC<PaymentLinkSuccessModalProps> = ({
  open,
  onClose,
  onCreateAnother,
  paymentLink,
  paymentSettings,
  directPayAddress,
  directPayQrCode,
  linkKind,
}) => {
  const isMobile = useIsMobile("md");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("createPaymentLinkScreen");
  const tPaymentLink = useCallback(
    (key: string, options?: Record<string, unknown>): string => {
      const result = t(key, { ns: "createPaymentLinkScreen", ...(options || {}) });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );
  const isDonation = linkKind === "donation";
  const tCommon = useCallback((key: string) => t(key, { ns: "common" }), [t]);
  const [openToast, setOpenToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [directPayOpen, setDirectPayOpen] = useState(false);
  const linkQrRef = useRef<HTMLDivElement>(null);

  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const surface = isDark ? "rgba(255,255,255,0.03)" : "rgba(10,10,15,0.02)";
  const iconBtnSx = { border: `1px solid ${border}`, borderRadius: "12px", minWidth: 44, minHeight: 44, color: ink, "&:hover": { backgroundColor: theme.palette.action.hover } };

  const currency = paymentSettings.currency || "USD";
  const amountNum = parseFloat(paymentSettings.value);
  const amountLabel = Number.isFinite(amountNum) && amountNum > 0
    ? `${getCurrencySymbolFromFormat(currency)}${formatWithSeparators(amountNum, currency)}`
    : null;

  // Only the pool address from the backend (directPayAddress) — never the merchant wallet.
  const singleCryptoWallet = useMemo(() => {
    const accepted = paymentSettings.acceptedCryptoCurrency;
    if (!accepted || accepted.length !== 1 || !directPayAddress) return null;
    return { cryptoType: accepted[0], address: directPayAddress };
  }, [paymentSettings.acceptedCryptoCurrency, directPayAddress]);

  const getExpireText = () => {
    const e = paymentSettings.expire;
    if (e === "24h") return tPaymentLink("expire24h");
    if (e === "7d") return tPaymentLink("expire7d");
    if (e === "30d") return tPaymentLink("expire30d");
    return tPaymentLink("noExpiration");
  };

  const showToast = (message: string, severity: "success" | "error" = "success") => {
    setOpenToast(false);
    setToastMessage(message);
    setToastSeverity(severity);
    setTimeout(() => setOpenToast(true), 0);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setOpenToast(false), 2000);
  };

  const markCopied = () => {
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2200);
  };

  const handleCopyPaymentLink = async () => {
    if (!paymentLink) return showToast(String(tCommon("copyFailed")), "error");
    const ok = await copyToClipboard(paymentLink);
    if (ok) markCopied();
    else showToast(String(tCommon("copyFailed")), "error");
  };

  const handleDownloadLinkQr = () => {
    if (!paymentLink) return;
    const canvas = linkQrRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    const code = extractPayRef(paymentLink);
    downloadQrPng(canvas, { caption: paymentLink.replace(/^https?:\/\//, ""), filename: `dynopay-${code || "payment-qr"}.png` });
  };

  const handleSharePaymentLink = async () => {
    if (!paymentLink) return showToast(String(tCommon("copyFailed")), "error");
    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({ title: tPaymentLink("paymentLink"), text: paymentSettings.description || undefined, url: paymentLink });
        return;
      } catch {
        /* cancelled → copy instead */
      }
    }
    await handleCopyPaymentLink();
  };

  return (
    <>
      <PopupModal
        open={open}
        handleClose={onClose}
        showHeader={false}
        transparent
        hasFooter={false}
        sx={{
          "& .MuiDialog-paper": {
            width: "100%",
            maxWidth: "560px",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            p: isMobile ? 1 : 2,
          },
        }}
      >
        <PanelCard
          title={tPaymentLink(isDonation ? "donationSuccessfullyCreated" : "paymentLinkSuccessfullyCreated")}
          subTitle={tPaymentLink(isDonation ? "shareDonationToStartCollecting" : "shareLinkToReceivePayment")}
          showHeaderBorder={false}
          bodyPadding={isMobile ? theme.spacing(1.5, 2, 2, 2) : theme.spacing(2, 3.5, 3.5, 3.5)}
          headerPadding={isMobile ? theme.spacing(2, 2, 0, 2) : theme.spacing(3.5, 3.5, 0, 3.5)}
          headerActionLayout="inline"
          headerAction={
            <CloseIconButton onClick={onClose} data-testid="paylink-success-close">
              <Image src={CloseIcon.src} alt="close icon" width={16} height={16} draggable={false} />
            </CloseIconButton>
          }
        >
          <Box data-testid="paylink-success" sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {(amountLabel || paymentSettings.description) && (
              <Box data-testid="paylink-success-summary" sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: "12px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light, backgroundColor: isDark ? CB_TOKENS.semantic.positive.glowDark : CB_TOKENS.semantic.positive.glowLight }}>
                  <Icon name="check" size={20} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  {amountLabel && !isDonation && (
                    <Box data-testid="paylink-success-amount" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: ink, lineHeight: 1.15 }}>
                      {amountLabel} <Box component="span" sx={{ fontSize: 13, fontWeight: 600, color: muted }}>{currency}</Box>
                    </Box>
                  )}
                  {paymentSettings.description && (
                    <Typography noWrap sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: muted }}>
                      {paymentSettings.description}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}

            {/* Share tools — same layout as the Payment-links detail panel. */}
            <Box data-testid="paylink-qr-block">
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "132px minmax(0, 1fr)" }, gap: 2, alignItems: "start" }}>
                <Box sx={{ display: "flex", justifyContent: { xs: "center", sm: "flex-start" } }}>
                  <Box ref={linkQrRef} data-testid="paylink-success-qr" sx={{ p: 1, borderRadius: "14px", backgroundColor: "#FFFFFF", border: `1px solid ${border}`, lineHeight: 0 }}>
                    <QRCodeCanvas value={paymentLink || ""} size={112} level="M" />
                  </Box>
                </Box>
                <Box sx={{ minWidth: 0, display: "grid", gap: 1.25 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, overflow: "hidden", border: `1px solid ${border}`, borderRadius: "12px", backgroundColor: surface, pl: 1.5, pr: 0.5, py: 0.5 }}>
                    <Box data-testid="paylink-success-url" sx={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 12.5, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {paymentLink}
                    </Box>
                    <CopyInline
                      value={paymentLink}
                      size={16}
                      testId="paylink-success-copy"
                      copyLabel={tPaymentLink("successCopyLink", { defaultValue: "Copy link" })}
                      sx={{ minWidth: 38, minHeight: 38 }}
                      onCopied={(ok) => (ok ? markCopied() : showToast(String(tCommon("copyFailed")), "error"))}
                    />
                  </Box>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", minWidth: 0 }}>
                    <Box sx={{ flex: "1 1 120px", minWidth: 0, "& button": { width: "100%", minHeight: 44 } }}>
                      <CustomButton
                        label={linkCopied ? tPaymentLink("successCopied", { defaultValue: "Copied ✓" }) : tPaymentLink("successCopyLink", { defaultValue: "Copy link" })}
                        variant="primary"
                        onClick={handleCopyPaymentLink}
                        data-testid="paylink-success-copy-btn"
                      />
                    </Box>
                    <IconButton onClick={handleSharePaymentLink} data-testid="paylink-success-share" aria-label={tPaymentLink("successShare", { defaultValue: "Share" })} sx={iconBtnSx}>
                      <Icon name="share-2" size={17} />
                    </IconButton>
                    <IconButton onClick={() => window.open(paymentLink, "_blank", "noopener")} data-testid="paylink-success-open" aria-label={tPaymentLink("successOpenLink", { defaultValue: "Open link" })} sx={iconBtnSx}>
                      <Icon name="external-link" size={17} />
                    </IconButton>
                    <IconButton onClick={handleDownloadLinkQr} data-testid="paylink-qr-download" aria-label={tPaymentLink("downloadQr", { defaultValue: "Download QR" })} sx={iconBtnSx}>
                      <Icon name="download" size={17} />
                    </IconButton>
                  </Box>
                  {linkCopied && (
                    <Typography data-testid="paylink-copied-note" sx={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light }}>
                      {t("linkCopiedOpensCheckout", { defaultValue: "Link copied — opens your checkout" })}
                    </Typography>
                  )}
                </Box>
              </Box>
              <Box sx={{ mt: 1.5 }}>
                <EmbedSnippet url={paymentLink} />
              </Box>
            </Box>

            {/* Direct Pay QR — only when a single cryptocurrency is selected. E6: kept
                behind an explicit toggle — buyers who pay the static address skip the
                hosted checkout's amount / network checks, so it is an advanced path. */}
            {singleCryptoWallet && (
              <Box data-testid="paylink-success-direct-pay" sx={{ borderRadius: "14px", border: `1px solid ${border}`, overflow: "hidden" }}>
                <Box
                  component="button"
                  type="button"
                  data-testid="paylink-success-direct-pay-toggle"
                  aria-expanded={directPayOpen}
                  onClick={() => setDirectPayOpen((v) => !v)}
                  sx={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: isMobile ? 2 : 2.5, py: 1.5, border: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: ink, textAlign: "left", "&:hover": { backgroundColor: theme.palette.action.hover } }}
                >
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                    <Icon name="lucide:qr-code" size={16} />
                    {t("common:directPayAdvanced", { defaultValue: "Direct Pay address (advanced)" })} · {singleCryptoWallet.cryptoType}
                  </Box>
                  <Icon name={directPayOpen ? "chevron-up" : "chevron-down"} size={16} />
                </Box>
                {directPayOpen && (
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, px: isMobile ? 2 : 2.5, pb: isMobile ? 2 : 2.5 }}>
                    <Box role="note" data-testid="paylink-success-direct-pay-warning" sx={{ width: "100%", display: "flex", gap: 1, alignItems: "flex-start", p: 1.25, borderRadius: "10px", border: `1px solid ${theme.palette.warning.main}`, backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.08)" }}>
                      <Icon name="triangle-alert" size={16} color={theme.palette.warning.main} style={{ marginTop: 1 }} />
                      <Typography sx={{ fontSize: 12.5, lineHeight: 1.5, color: ink }}>
                        {t("common:directPayWarning", { defaultValue: "Anyone paying this address directly skips the amount and network checks of the hosted checkout. Share the payment link instead unless your customer knows exactly what to send." })}
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.5, borderRadius: "10px", backgroundColor: "#FFFFFF", display: "inline-flex", border: `1px solid ${border}` }}>
                      {directPayQrCode ? (
                        // eslint-disable-next-line @next/next/no-img-element -- backend-generated QR (remote/data URL)
                        <img src={directPayQrCode} alt="Direct Pay QR Code" style={{ width: isMobile ? 140 : 160, height: isMobile ? 140 : 160 }} />
                      ) : (
                        <QRCodeSVG value={singleCryptoWallet.address} size={isMobile ? 140 : 160} level="M" includeMargin={false} />
                      )}
                    </Box>
                    <Typography sx={{ fontSize: 11, color: muted, textAlign: "center", lineHeight: 1.4 }}>
                      {t("common:scanQrPayWallet")}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center", width: "100%" }}>
                      <Box sx={{ flex: 1, overflow: "hidden", borderRadius: "10px", border: `1px solid ${border}`, px: 1.5, py: 1, backgroundColor: surface }}>
                        <Typography sx={{ fontSize: isMobile ? 10 : 12, fontFamily: MONO, color: ink, wordBreak: "break-all", lineHeight: 1.4 }}>
                          {singleCryptoWallet.address}
                        </Typography>
                      </Box>
                      <CopyInline
                        variant="boxed"
                        value={singleCryptoWallet.address}
                        size={16}
                        testId="paylink-success-copy-address"
                        onCopied={(ok) => { if (!ok) showToast(String(tCommon("copyFailed")), "error"); }}
                      />
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            <PaymentDetailsContainer>
              <PaymentDetailsTitle>{tPaymentLink("paymentDetails")}</PaymentDetailsTitle>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {!isDonation && (
                  <PaymentDetailRow icon={RoundedStackIcon.src} alt="value" label={tPaymentLink("value").replace(" ($)", "")} value={amountLabel ? `${amountLabel} ${currency}` : "—"} />
                )}
                <PaymentDetailRow icon={HourglassIcon.src} alt="expire" label={tPaymentLink("expiresOn")} value={getExpireText()} />
                <PaymentDetailRow icon={PaymentIcon.src} alt="blockchain fees" label={tPaymentLink("blockchainFees")} value={paymentSettings.blockchainFees === "customer" ? tPaymentLink("paidByCustomer") : tPaymentLink("paidByClient")} />
                {paymentSettings.description && (
                  <PaymentDetailRow icon={NoteIcon.src} alt="description" label={tPaymentLink("description")} value={paymentSettings.description} />
                )}
                <PaymentDetailRow icon={TransactionIcon.src} alt="Link Id" label={tPaymentLink("linkId")} value={paymentSettings.linkId || tPaymentLink("nA")} />
              </Box>
            </PaymentDetailsContainer>

            <Box sx={{ display: "flex", gap: 1.25, flexDirection: { xs: "column", sm: "row" } }}>
              {onCreateAnother && (
                <Box sx={{ flex: 1, "& button": { width: "100%", minHeight: 44 } }}>
                  <CustomButton label={tPaymentLink("successCreateAnother", { defaultValue: "Create another" })} variant="secondary" onClick={onCreateAnother} data-testid="paylink-success-create-another" />
                </Box>
              )}
              <Box sx={{ flex: 1, "& button": { width: "100%", minHeight: 44 } }}>
                <CustomButton label={tPaymentLink("successViewLinks", { defaultValue: "View all links" })} variant={onCreateAnother ? "primary" : "secondary"} onClick={onClose} data-testid="paylink-success-view-links" />
              </Box>
            </Box>
          </Box>
        </PanelCard>
      </PopupModal>
      <Toast open={openToast} message={toastMessage} severity={toastSeverity} />
    </>
  );
};

export default PaymentLinkSuccessModal;
