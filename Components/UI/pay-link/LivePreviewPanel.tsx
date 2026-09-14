/**
 * LivePreviewPanel — phone-framed mock of the hosted checkout, driven live by
 * the create-pay-link form state (plan 2.3). Non-interactive.
 */
import React from "react";
import { Box, LinearProgress, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import CoinChips from "@/Components/UI/CoinChips";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon, MONO } from "@/styles/uiKit";
import { getCurrencySymbolFromFormat, formatWithSeparators } from "@/utils/currencyFormat";
import type { DonationSettingsState } from "./DonationSettingsSection";
import type { LinkKind } from "./LinkTypeSelector";

interface LivePreviewPanelProps {
  linkKind: LinkKind;
  amount: string;
  currency: string;
  clientName?: string;
  description?: string;
  donation: DonationSettingsState;
  purpose?: string;
  acceptedCount: number;
  companyName?: string | null;
  logoUrl?: string | null;
  coins?: string[];
  expire?: string;
  feePayer?: string;
  /** Hide the eyebrow + hint (parent renders its own toggle header). */
  compact?: boolean;
}

const EXPIRE_KEY: Record<string, string> = { "24h": "expire24h", "7d": "expire7d", "30d": "expire30d" };

const LivePreviewPanel = ({
  linkKind,
  amount,
  currency,
  clientName,
  description,
  donation,
  purpose,
  acceptedCount,
  companyName,
  logoUrl,
  coins = [],
  expire,
  feePayer,
  compact = false,
}: LivePreviewPanelProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("createPaymentLinkScreen");
  const green = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

  const symbol = getCurrencySymbolFromFormat(currency || "USD");
  const fmt = (n: number) => `${symbol}${formatWithSeparators(n, currency || "USD")}`;
  const amountNum = parseFloat(amount);
  const hasAmount = Number.isFinite(amountNum) && amountNum > 0;
  const goalNum = parseFloat(donation.goalAmount);
  const hasGoal = Number.isFinite(goalNum) && goalNum > 0;
  const isDonation = linkKind === "donation";

  const brand = (companyName || "").trim() || t("previewYourBrand", { defaultValue: "Your brand" });
  const expireKey = expire ? EXPIRE_KEY[expire] : undefined;
  const expiryLine = expireKey
    ? t("previewExpiresIn", { when: t(expireKey), defaultValue: "Link expires in {{when}}" })
    : t("previewNoExpiry", { defaultValue: "Link never expires" });
  const feeLine =
    feePayer === "customer"
      ? t("previewCustomerPaysFee", { defaultValue: "Customer covers the network fee" })
      : t("previewYouPayFee", { defaultValue: "You cover the network fee" });

  const eyebrowSx = { fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: muted };
  const ctaSx = { mt: 2.25, height: 44, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: "#FFFFFF", backgroundColor: indigo };

  const brandRow = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      {logoUrl ? (
        <Box component="img" src={logoUrl} alt="" sx={{ width: 36, height: 36, borderRadius: "10px", objectFit: "cover", border: `1px solid ${border}`, flexShrink: 0 }} />
      ) : (
        <Box sx={{ width: 36, height: 36, borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 15, color: "#FFFFFF", backgroundColor: indigo }}>
          {brand.charAt(0).toUpperCase()}
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Box data-testid="preview-brand" sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isDonation ? brand : t("previewPayTo", { brand, defaultValue: "Pay {{brand}}" })}
        </Box>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontFamily: "var(--font-sans)", fontSize: 11, color: muted }}>
          <Icon name="lock" size={11} />
          {t("previewSecured", { defaultValue: "Secured by Dynopay" })}
        </Box>
      </Box>
    </Box>
  );

  const standardBody = (
    <>
      {brandRow}
      {clientName ? (
        <Box sx={{ mt: 2, fontFamily: "var(--font-sans)", fontSize: 12, color: muted }}>
          {t("previewGreeting", { name: clientName, defaultValue: "Hi {{name}}, complete your payment" })}
        </Box>
      ) : null}
      <Box data-testid="preview-description" sx={{ mt: clientName ? 0.75 : 2.5, fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, wordBreak: "break-word", color: description?.trim() ? ink : muted, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {description?.trim() || t("previewDescPlaceholder", { defaultValue: "What is this payment for?" })}
      </Box>
      <Box data-testid="preview-standard-total" sx={{ mt: 0.5, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: hasAmount ? ink : muted, lineHeight: 1.15 }}>
        {hasAmount ? fmt(amountNum) : `${symbol}0.00`}
        {" "}
        <Box component="span" sx={{ fontSize: 13, fontWeight: 600, ml: 0.5, color: muted }}>{currency}</Box>
      </Box>
      <Box sx={{ mt: 2.25, ...eyebrowSx }}>{t("previewPayWith", { defaultValue: "Pay with" })}</Box>
      <Box data-testid="preview-coins" sx={{ mt: 0.75, minHeight: 26 }}>
        {coins.length ? (
          <CoinChips value={coins} max={4} />
        ) : (
          <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: muted }}>
            {t("previewNoCoins", { defaultValue: "Pick at least one coin below" })}
          </Box>
        )}
      </Box>
      <Box sx={ctaSx}>
        <Icon name="zap" size={15} />
        {t("previewPayButton", { defaultValue: "Pay with crypto" })}
      </Box>
      <Box data-testid="preview-footnote" sx={{ mt: 1.5, display: "grid", gap: 0.5, fontFamily: "var(--font-sans)", fontSize: 11, color: muted }}>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}><Icon name="clock" size={11} />{expiryLine}</Box>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}><Icon name="fuel" size={11} />{feeLine}</Box>
      </Box>
    </>
  );

  const donationBody = (
    <>
      {brandRow}
      <Typography data-testid="preview-donation-title" sx={{ mt: 2.5, fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: donation.title ? ink : muted }}>
        {donation.title || t("previewUntitledCampaign", { defaultValue: "Your campaign title" })}
      </Typography>
      {purpose ? (
        <Typography sx={{ mt: 0.5, fontFamily: "var(--font-sans)", fontSize: 12, color: muted, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {purpose}
        </Typography>
      ) : null}
      {donation.showProgress && (
        <Box sx={{ mt: 1.75 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <Box sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 14, fontWeight: 700, color: ink }}>
              {fmt(0)}{" "}
              <Box component="span" sx={{ fontFamily: "var(--font-sans)", fontSize: 11.5, fontWeight: 500, color: muted }}>
                {hasGoal ? t("previewRaisedOfGoal", { goal: fmt(goalNum), defaultValue: "raised of {{goal}} goal" }) : t("previewRaised", { defaultValue: "raised" })}
              </Box>
            </Box>
            {hasGoal && <Box sx={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: green }}>0%</Box>}
          </Box>
          {hasGoal && (
            <LinearProgress variant="determinate" value={0} sx={{ mt: 0.75, height: 6, borderRadius: 999, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", "& .MuiLinearProgress-bar": { backgroundColor: green } }} />
          )}
          {donation.showSupporters && (
            <Box sx={{ mt: 0.5, display: "inline-flex", alignItems: "center", gap: 0.5, fontFamily: "var(--font-sans)", fontSize: 11, color: muted }}>
              <Icon name="heart" size={11} />
              {t("previewSupporters", { defaultValue: "0 supporters" })}
            </Box>
          )}
        </Box>
      )}
      {donation.presets.length > 0 && (
        <Box sx={{ mt: 1.75, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75 }}>
          {donation.presets.slice(0, 6).map((p) => (
            <Box key={p} sx={{ textAlign: "center", py: 0.9, borderRadius: "10px", border: `1px solid ${border}`, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 12.5, fontWeight: 600, color: ink }}>
              {fmt(p)}
            </Box>
          ))}
        </Box>
      )}
      {donation.allowCustom && (
        <Box sx={{ mt: donation.presets.length ? 0.75 : 1.75, borderRadius: "10px", border: `1px solid ${border}`, px: 1.5, py: 0.9, fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted }}>
          {symbol} {t("previewOtherAmount", { defaultValue: "Other amount" })}
        </Box>
      )}
      <Box sx={ctaSx}>
        <Icon name="heart" size={15} />
        {t("previewDonateBtn", { defaultValue: "Donate" })}
      </Box>
      <Box sx={{ mt: 1.5, display: "grid", gap: 0.5, fontFamily: "var(--font-sans)", fontSize: 11, color: muted }}>
        {donation.autoCloseAtGoal && hasGoal && (
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}><Icon name="flag" size={11} />{t("previewAutoClose", { defaultValue: "Closes automatically at goal" })}</Box>
        )}
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
          <Icon name="shield-check" size={11} />
          {acceptedCount > 0
            ? t("previewCoins", { count: acceptedCount, defaultValue: "{{count}} cryptocurrencies accepted" })
            : t("previewSecure", { defaultValue: "Secure payment by Dynopay" })}
        </Box>
      </Box>
    </>
  );

  return (
    <Box data-testid="live-preview-panel" sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
      {!compact && (
        <Box sx={{ alignSelf: "stretch" }}>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, ...eyebrowSx, letterSpacing: "0.08em" }}>
            <Box sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: green, boxShadow: `0 0 0 3px ${isDark ? "rgba(63,217,138,0.18)" : "rgba(5,147,106,0.14)"}` }} />
            {t("livePreview", { defaultValue: "Live preview" })}
          </Box>
          <Typography sx={{ mt: 0.5, fontFamily: "var(--font-sans)", fontSize: 12, color: muted }}>
            {isDonation
              ? t("livePreviewDonationHint", { defaultValue: "What donors will see when they open your link." })
              : t("livePreviewStandardHint", { defaultValue: "What your customer will see when they open your link." })}
          </Typography>
        </Box>
      )}

      {/* Phone frame — same bezel as the first-run wizard's CheckoutPreview. */}
      <Box aria-hidden sx={{ pointerEvents: "none", width: "100%", maxWidth: 320, borderRadius: "30px", p: "10px", backgroundColor: isDark ? "#0E0F15" : "#121319", boxShadow: isDark ? "0 30px 60px -30px rgba(0,0,0,0.9)" : "0 30px 60px -30px rgba(10,10,15,0.45)" }}>
        <Box sx={{ borderRadius: "22px", overflow: "hidden", backgroundColor: isDark ? "#16171F" : "#FFFFFF", border: `1px solid ${border}` }}>
          <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
            <Box sx={{ width: 64, height: 5, borderRadius: 999, backgroundColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(10,10,15,0.12)" }} />
          </Box>
          {isDonation && donation.campaignImage && (
            <Box component="img" src={donation.campaignImage} alt="" sx={{ mt: 1.5, width: "100%", height: 110, objectFit: "cover", display: "block" }} />
          )}
          <Box sx={{ px: 2.25, pt: 2.5, pb: 2.25 }}>{isDonation ? donationBody : standardBody}</Box>
        </Box>
      </Box>
    </Box>
  );
};

export default LivePreviewPanel;
