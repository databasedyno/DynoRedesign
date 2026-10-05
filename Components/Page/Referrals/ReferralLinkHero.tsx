import React, { useState } from "react";
import { Box, Collapse, Skeleton, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import ReferralHowItWorks from "./ReferralHowItWorks";

type Channel = "whatsapp" | "telegram" | "x";

interface Props {
  code?: string;
  link?: string;
  loading: boolean;
  /** Show the collapsible "How it works" (once there are referrals; the zero state explains it otherwise). */
  showHowToggle: boolean;
  onCopy: (text: string, label: "Referral code" | "Referral link") => void;
  onShare: () => void;
  onShareTo: (channel: Channel) => void;
}

const CHANNELS: Array<{ key: Channel; icon: string; label: string }> = [
  { key: "whatsapp", icon: "ri:whatsapp-fill", label: "WhatsApp" },
  { key: "telegram", icon: "ri:telegram-fill", label: "Telegram" },
  { key: "x", icon: "ri:twitter-x-fill", label: "X" },
];

/** "Your link" hero — the one place to copy / share, with the reward split in one line. */
const ReferralLinkHero: React.FC<Props> = ({ code, link, loading, showHowToggle, onCopy, onShare, onShareTo }) => {
  const theme = useTheme();
  const { t } = useTranslation("referrals");
  const [howOpen, setHowOpen] = useState(false);
  const border = theme.palette.border.main;
  const btn = { font: "inherit", display: "inline-flex", alignItems: "center", gap: 1, height: 40, px: 2, borderRadius: "10px", cursor: "pointer", whiteSpace: "nowrap", fontSize: 14, fontWeight: 600, transition: "background-color 150ms ease, opacity 150ms ease" } as const;

  return (
    <Box data-testid="referral-code-card" sx={{ mb: 2.5, p: { xs: 2, md: 3 }, borderRadius: "14px", border: `1px solid ${border}`, bgcolor: theme.palette.background.paper, display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
          {t("hero.eyebrow", { defaultValue: "Your referral link" })}
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: { xs: 14, md: 15 }, color: theme.palette.text.primary }} data-testid="referral-hero-value">
          {t("hero.valueLine", { defaultValue: "You get 25% of their fees for 12 months · they get 50% off fees for 30 days" })}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 280px", minWidth: 0, height: 40, display: "flex", alignItems: "center", px: 1.5, borderRadius: "10px", border: `1px solid ${border}`, bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#FAFAFB" }}>
          {loading ? (
            <Skeleton width="70%" />
          ) : (
            <Box component="code" data-testid="referral-link-value" sx={{ fontFamily: MONO, fontSize: 13, color: theme.palette.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {(link || "—").replace(/^https?:\/\//, "")}
            </Box>
          )}
        </Box>
        <Box component="button" type="button" data-testid="copy-referral-link-btn" disabled={!link} onClick={() => link && onCopy(link, "Referral link")} sx={{ ...btn, border: `1px solid ${border}`, bgcolor: theme.palette.background.paper, color: theme.palette.text.primary, "&:hover": { bgcolor: theme.palette.action.hover } }}>
          <Icon name="copy" size={16} />
          {t("copyLink")}
        </Box>
        <Box component="button" type="button" data-testid="share-referral-btn" disabled={!link} aria-label={t("shareLink")} onClick={onShare} sx={{ ...btn, border: 0, bgcolor: theme.palette.primary.main, color: (theme.palette.primary as { contrastText?: string }).contrastText || "#111", "&:hover": { opacity: 0.9 } }}>
          <Icon name="share-2" size={16} />
          {t("shareLink")}
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, md: 3 }, flexWrap: "wrap", fontSize: 13, color: theme.palette.text.secondary }}>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          {t("hero.code", { defaultValue: "Code" })}
          <Box component="span" data-testid="referral-code-value" sx={{ fontFamily: MONO, fontWeight: 700, color: theme.palette.text.primary, letterSpacing: "0.5px" }}>
            {loading ? "…" : code || "—"}
          </Box>
          <Box component="button" type="button" data-testid="copy-referral-code-btn" aria-label={t("copyCode", { defaultValue: "Copy referral code" })} onClick={() => code && onCopy(code, "Referral code")} sx={{ all: "unset", cursor: "pointer", display: "inline-flex", p: 0.5, borderRadius: "6px", "&:hover": { bgcolor: theme.palette.action.hover }, "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}` } }}>
            <Icon name="copy" size={14} />
          </Box>
        </Box>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          {t("hero.shareOn", { defaultValue: "Share on" })}
          {CHANNELS.map((c) => (
            <Box key={c.key} component="button" type="button" data-testid={`share-${c.key}-btn`} aria-label={`Share on ${c.label}`} disabled={!link} onClick={() => onShareTo(c.key)} sx={{ all: "unset", cursor: "pointer", width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", border: `1px solid ${border}`, color: theme.palette.text.primary, transition: "background-color 150ms ease", "&:hover": { bgcolor: theme.palette.action.hover }, "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}` } }}>
              <Icon name={c.icon} size={16} />
            </Box>
          ))}
        </Box>
        {showHowToggle && (
          <Box component="button" type="button" data-testid="referral-how-it-works-toggle" aria-expanded={howOpen} onClick={() => setHowOpen((v) => !v)} sx={{ all: "unset", cursor: "pointer", ml: { md: "auto" }, display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 600, color: theme.palette.text.primary, "&:hover": { textDecoration: "underline" } }}>
            {t("howItWorks")}
            <Icon name={howOpen ? "chevron-up" : "chevron-down"} size={14} />
          </Box>
        )}
      </Box>

      {showHowToggle && (
        <Collapse in={howOpen} timeout={200} unmountOnExit>
          <ReferralHowItWorks />
        </Collapse>
      )}
    </Box>
  );
};

export default ReferralLinkHero;
