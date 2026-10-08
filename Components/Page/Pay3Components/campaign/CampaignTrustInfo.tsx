/**
 * CampaignTrustInfo — donor-facing trust & compliance blocks for the donation /
 * crowdfunding page (Part A Tier 1 of the standards review).
 *
 * Exports:
 *  - AcceptedCoinsStrip: a compact "coins we accept" row shown up-front so a
 *    donor sees BTC/ETH/stablecoins before reaching the pay step (reduces
 *    hesitation — matches The Giving Block / Coinbase Commerce).
 *  - CampaignTrustInfo: a fund-handling statement, a short tax / not-financial-
 *    advice / refund note, and a small FAQ — the standard trust cues a giving
 *    page carries. Copy-and-layout only; no payment logic.
 *
 * All copy uses t(key, { defaultValue }) so it renders in English today and can
 * be translated later without a code change. Dark-mode-first, mobile-friendly.
 */
import React, { useState } from "react";
import { Box, Typography, Collapse, useTheme, type Theme } from "@mui/material";
import { alpha, darken } from "@mui/material/styles";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { BRAND_ACCENT } from "@/constants/theme";
import { readableOn } from "@/constants/creatorTheme";

const MONO = 'var(--font-tech), ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace';

/** The 12 assets the checkout accepts (mirrors checkout/checkoutConstants). */
const ACCEPTED_COINS: Array<{ icon: string; label: string; color?: string }> = [
  { icon: "cryptocurrency-color:btc", label: "BTC" },
  { icon: "cryptocurrency-color:eth", label: "ETH" },
  { icon: "cryptocurrency-color:usdt", label: "USDT" },
  { icon: "cryptocurrency-color:usdc", label: "USDC" },
  { icon: "cryptocurrency-color:sol", label: "SOL" },
  { icon: "cryptocurrency-color:trx", label: "TRX" },
  { icon: "cryptocurrency-color:xrp", label: "XRP" },
  { icon: "cryptocurrency-color:ltc", label: "LTC" },
  { icon: "cryptocurrency-color:doge", label: "DOGE" },
  { icon: "cryptocurrency-color:bch", label: "BCH" },
  { icon: "cryptocurrency-color:matic", label: "POL" },
  { icon: "mdi:currency-usd", label: "RLUSD", color: "#22c55e" },
];

const overlineSx = (theme: Theme) => ({
  fontFamily: MONO,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: theme.palette.text.secondary,
  mb: 1.25,
  display: "block",
});

export const AcceptedCoinsStrip: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  return (
    <Box mt={2} pt={2} data-testid="donation-accepted-coins" sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
      <Typography
        component="span"
        sx={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.02em",
          color: theme.palette.text.secondary,
          mb: 1,
        }}
      >
        {t("donation.acceptedCoins", { defaultValue: "Pay with your favourite crypto — 12 coins accepted" })}
      </Typography>
      <Box display="flex" flexWrap="wrap" gap={0.75}>
        {ACCEPTED_COINS.map((c) => (
          <Box
            key={c.label}
            data-testid={`donation-coin-${c.label}`}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              px: 1,
              minHeight: 28,
              borderRadius: "999px",
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
            }}
          >
            <Icon icon={c.icon} width={15} height={15} color={c.color} />
            <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: theme.palette.text.secondary }}>
              {c.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

interface FaqItemProps {
  q: string;
  a: string;
  testid: string;
  accent: string;
}
const FaqItem: React.FC<FaqItemProps> = ({ q, a, testid, accent }) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Box
      sx={{
        borderBottom: `1px solid ${theme.palette.divider}`,
        "&:last-of-type": { borderBottom: "none" },
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={open}
        data-testid={`${testid}-toggle`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          cursor: "pointer",
          userSelect: "none",
          minHeight: 52,
          py: 1.25,
          transition: "color 140ms ease",
          "&:hover": { color: accent },
          "&:focus-visible": { outline: `2px solid ${accent}`, outlineOffset: 2, borderRadius: "8px" },
        }}
      >
        <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: theme.palette.text.primary }}>{q}</Typography>
        <Box
          sx={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: open ? alpha(accent, 0.16) : (theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(18,18,20,0.04)"),
            color: theme.palette.text.secondary,
            transition: "background-color 160ms ease",
          }}
        >
          <Icon
            icon="mdi:chevron-down"
            width={18}
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }}
          />
        </Box>
      </Box>
      <Collapse in={open} timeout={180} unmountOnExit>
        <Typography
          data-testid={`${testid}-body`}
          sx={{ fontSize: 13.5, lineHeight: 1.65, color: theme.palette.text.secondary, pb: 1.75, pr: 3 }}
        >
          {a}
        </Typography>
      </Collapse>
    </Box>
  );
};

interface CampaignTrustInfoProps {
  merchantName?: string | null;
  minAmountLabel: string;
  accent?: string;
}

export const CampaignTrustInfo: React.FC<CampaignTrustInfoProps> = ({ merchantName, minAmountLabel, accent: accentProp }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  const accent = accentProp || BRAND_ACCENT;
  const accentText = isDark ? accent : (readableOn(accent) === "#FFFFFF" ? accent : darken(accent, 0.38));
  const organizer = merchantName && merchantName.trim() ? merchantName.trim() : t("donation.theOrganizer", { defaultValue: "the organizer" });

  const cardSx = {
    position: "relative" as const,
    overflow: "hidden",
    p: { xs: 2.25, sm: 3 },
    borderRadius: "24px",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(18,18,20,0.06)"}`,
    background: isDark
      ? "linear-gradient(180deg, rgba(24,24,31,0.86) 0%, rgba(18,18,22,0.82) 100%)"
      : "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.84) 100%)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: isDark
      ? "0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)"
      : `0 20px 50px ${alpha(accent, 0.10)}, inset 0 1px 0 rgba(255,255,255,0.9)`,
  };
  const iconTile = (icon: string, color: string) => (
    <Box sx={{ width: 36, height: 36, borderRadius: "12px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(color, isDark ? 0.16 : 0.12), color }}>
      <Icon icon={icon} width={19} />
    </Box>
  );

  return (
    <Box data-testid="donation-trust-info" sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 3 } }}>
      <Box sx={{ display: "grid", gap: { xs: 2, md: 3 }, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {/* Fund-handling statement */}
        <Box sx={cardSx} data-testid="donation-fund-handling">
          <Box display="flex" alignItems="center" gap={1.25} mb={1.25}>
            {iconTile("mdi:shield-check-outline", theme.palette.success.main)}
            <Typography sx={{ fontFamily: "var(--font-hero), var(--font-sans)", fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em", color: theme.palette.text.primary }}>
              {t("donation.fundHandlingTitle", { defaultValue: "Where your gift goes" })}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 13.5, lineHeight: 1.65, color: theme.palette.text.secondary }} data-testid="donation-fund-handling-body">
            {t("donation.fundHandlingBody", {
              defaultValue: `Your gift goes directly to ${organizer}. Depending on their settings it's received as crypto or automatically converted to a stablecoin. Dynopay only processes the payment — it never holds or invests your donation.`,
              organizer,
            })}
          </Typography>
        </Box>

        {/* Tax / not-financial-advice / refund note */}
        <Box sx={cardSx} data-testid="donation-tax-note">
          <Box display="flex" alignItems="center" gap={1.25} mb={1.25}>
            {iconTile("mdi:information-outline", accentText)}
            <Typography sx={{ fontFamily: "var(--font-hero), var(--font-sans)", fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em", color: theme.palette.text.primary }}>
              {t("donation.taxNoteTitle", { defaultValue: "Good to know" })}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 13.5, lineHeight: 1.65, color: theme.palette.text.secondary }}>
            {t("donation.taxNoteBody", {
              defaultValue:
                "In many places crypto is treated as property, so keep your own records for larger gifts and check the tax rules where you live — this isn't financial or tax advice. Crypto payments are final and generally can't be reversed, so please double-check the amount before you send. For a refund, contact the organizer directly.",
            })}
          </Typography>
        </Box>
      </Box>

      {/* FAQ */}
      <Box sx={cardSx} data-testid="donation-faq">
        <Typography component="span" sx={overlineSx(theme)}>
          {t("donation.faqTitle", { defaultValue: "Frequently asked" })}
        </Typography>
        <Box>
          <FaqItem
            accent={accent}
            testid="donation-faq-minimum"
            q={t("donation.faqMinimumQ", { defaultValue: "Is there a minimum donation?" })}
            a={t("donation.faqMinimumA", {
              defaultValue: `Yes — the minimum for this campaign is ${minAmountLabel}. You can give any amount at or above that.`,
              amount: minAmountLabel,
            })}
          />
          <FaqItem
            accent={accent}
            testid="donation-faq-confirm"
            q={t("donation.faqConfirmQ", { defaultValue: "How long does confirmation take?" })}
            a={t("donation.faqConfirmA", {
              defaultValue:
                "Most payments confirm within a few minutes once the network processes your transaction. Faster chains and stablecoins are usually quickest; Bitcoin can take a little longer.",
            })}
          />
          <FaqItem
            accent={accent}
            testid="donation-faq-anon"
            q={t("donation.faqAnonQ", { defaultValue: "Can I give anonymously?" })}
            a={t("donation.faqAnonA", {
              defaultValue:
                "Yes. Tick “Donate anonymously” and your name won't be shown on the public supporters list. If you leave an email we'll still send you a private receipt.",
            })}
          />
          <FaqItem
            accent={accent}
            testid="donation-faq-refund"
            q={t("donation.faqRefundQ", { defaultValue: "Can I get a refund?" })}
            a={t("donation.faqRefundA", {
              defaultValue: `Crypto payments are final, so refunds aren't automatic. If something went wrong, contact ${organizer} directly and they can arrange one.`,
              organizer,
            })}
          />
          <FaqItem
            accent={accent}
            testid="donation-faq-contact"
            q={t("donation.faqContactQ", { defaultValue: "Who do I contact for help?" })}
            a={t("donation.faqContactA", {
              defaultValue: `Reach out to ${organizer} for anything about this campaign. For payment issues you can also contact Dynopay support from your receipt.`,
              organizer,
            })}
          />
        </Box>
      </Box>

      <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
        <Icon icon="mdi:lock-outline" width={12} />
        {t("donation.securedByFooter", { defaultValue: "Payments secured & processed by Dynopay" })}
      </Typography>
    </Box>
  );
};

export default CampaignTrustInfo;
