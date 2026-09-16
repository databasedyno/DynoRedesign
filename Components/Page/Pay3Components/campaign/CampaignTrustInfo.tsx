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
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace';

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
  fontWeight: 600,
  fontSize: 11,
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
    <Box mt={1.5} data-testid="donation-accepted-coins">
      <Typography
        component="span"
        sx={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.02em",
          color: theme.palette.text.secondary,
          mb: 0.75,
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
              px: 0.9,
              py: 0.4,
              borderRadius: "999px",
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
            }}
          >
            <Icon icon={c.icon} width={15} height={15} color={c.color} />
            <Typography sx={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: theme.palette.text.secondary }}>
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
}
const FaqItem: React.FC<FaqItemProps> = ({ q, a, testid }) => {
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
          py: 1.5,
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: theme.palette.text.primary }}>{q}</Typography>
        <Icon
          icon="mdi:chevron-down"
          width={20}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms ease", color: theme.palette.text.secondary, flexShrink: 0 }}
        />
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
}

export const CampaignTrustInfo: React.FC<CampaignTrustInfoProps> = ({ merchantName, minAmountLabel }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  const organizer = merchantName && merchantName.trim() ? merchantName.trim() : t("donation.theOrganizer", { defaultValue: "the organizer" });

  const cardSx = {
    p: { xs: 1.75, sm: 2.25 },
    borderRadius: "16px",
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
  };

  return (
    <Box mt={3.5} data-testid="donation-trust-info" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Fund-handling statement */}
      <Box sx={cardSx} data-testid="donation-fund-handling">
        <Box display="flex" alignItems="center" gap={0.75} mb={0.75}>
          <Icon icon="mdi:shield-check-outline" width={17} color={theme.palette.success.main} />
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: theme.palette.text.primary }}>
            {t("donation.fundHandlingTitle", { defaultValue: "Where your gift goes" })}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 13.5, lineHeight: 1.65, color: theme.palette.text.secondary }}>
          {t("donation.fundHandlingBody", {
            defaultValue: `Your gift goes directly to ${organizer}. Depending on their settings it's received as crypto or automatically converted to a stablecoin. DynoPay only processes the payment — it never holds or invests your donation.`,
            organizer,
          })}
        </Typography>
      </Box>

      {/* Tax / not-financial-advice / refund note */}
      <Box sx={cardSx} data-testid="donation-tax-note">
        <Box display="flex" alignItems="center" gap={0.75} mb={0.75}>
          <Icon icon="mdi:information-outline" width={17} color={theme.palette.text.secondary} />
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: theme.palette.text.primary }}>
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

      {/* FAQ */}
      <Box sx={cardSx} data-testid="donation-faq">
        <Typography component="span" sx={overlineSx(theme)}>
          {t("donation.faqTitle", { defaultValue: "Frequently asked" })}
        </Typography>
        <Box>
          <FaqItem
            testid="donation-faq-minimum"
            q={t("donation.faqMinimumQ", { defaultValue: "Is there a minimum donation?" })}
            a={t("donation.faqMinimumA", {
              defaultValue: `Yes — the minimum for this campaign is ${minAmountLabel}. You can give any amount at or above that.`,
              amount: minAmountLabel,
            })}
          />
          <FaqItem
            testid="donation-faq-confirm"
            q={t("donation.faqConfirmQ", { defaultValue: "How long does confirmation take?" })}
            a={t("donation.faqConfirmA", {
              defaultValue:
                "Most payments confirm within a few minutes once the network processes your transaction. Faster chains and stablecoins are usually quickest; Bitcoin can take a little longer.",
            })}
          />
          <FaqItem
            testid="donation-faq-anon"
            q={t("donation.faqAnonQ", { defaultValue: "Can I give anonymously?" })}
            a={t("donation.faqAnonA", {
              defaultValue:
                "Yes. Tick “Donate anonymously” and your name won't be shown on the public supporters list. If you leave an email we'll still send you a private receipt.",
            })}
          />
          <FaqItem
            testid="donation-faq-refund"
            q={t("donation.faqRefundQ", { defaultValue: "Can I get a refund?" })}
            a={t("donation.faqRefundA", {
              defaultValue: `Crypto payments are final, so refunds aren't automatic. If something went wrong, contact ${organizer} directly and they can arrange one.`,
              organizer,
            })}
          />
          <FaqItem
            testid="donation-faq-contact"
            q={t("donation.faqContactQ", { defaultValue: "Who do I contact for help?" })}
            a={t("donation.faqContactA", {
              defaultValue: `Reach out to ${organizer} for anything about this campaign. For payment issues you can also contact DynoPay support from your receipt.`,
              organizer,
            })}
          />
        </Box>
      </Box>

      <Typography sx={{ fontSize: 11, color: theme.palette.text.disabled, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
        <Icon icon="mdi:lock-outline" width={12} />
        {t("donation.securedByFooter", { defaultValue: "Payments secured & processed by DynoPay" })}
      </Typography>
    </Box>
  );
};

export default CampaignTrustInfo;
