import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import EnhancedEncryptionRoundedIcon from "@mui/icons-material/EnhancedEncryptionRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import DoNotDisturbOnRoundedIcon from "@mui/icons-material/DoNotDisturbOnRounded";
import {
  BLACK, BLUE_BRIGHT, FONT_BODY, FONT_DISPLAY, FONT_MONO, GREEN, INK0, INK2, INK3, LINE, LINE2,
} from "./theme.v4";
import { DisplayL, EyebrowV4, LeadV4, ShellV4 } from "./styled.v4";

const ITEMS = [
  { k: "i1", icon: AccountBalanceRoundedIcon },
  { k: "i2", icon: EnhancedEncryptionRoundedIcon },
  { k: "i3", icon: GavelRoundedIcon },
  { k: "i4", icon: DoNotDisturbOnRoundedIcon },
] as const;

const CHIPS = ["Non-custodial", "AES-256 / KMS", "GDPR", "AML", "0 chargebacks"] as const;

const TrustBandV4: React.FC = () => {
  const { t } = useTranslation("landing");
  return (
    <Box component="section" data-testid="trust-band" sx={{
      position: "relative", background: BLACK, overflow: "hidden",
      borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`,
    }}>
      <Box aria-hidden sx={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.4,
        backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`,
        backgroundSize: "88px 88px",
        maskImage: "radial-gradient(ellipse 80% 90% at 50% 50%, black 20%, transparent 90%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 90% at 50% 50%, black 20%, transparent 90%)",
      }} />
      <ShellV4 sx={{ py: { xs: 10, md: 15 } }}>
        <EyebrowV4 sx={{ mb: 2.5 }}>{t("v4.trust.eyebrow")}</EyebrowV4>
        <Box sx={{
          display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.3fr 1fr" },
          gap: { xs: 3, md: 10 }, alignItems: "end", mb: { xs: 6, md: 9 },
        }}>
          <DisplayL component="h2">
            {t("v4.trust.title")}{" "}
            <Box component="span" sx={{ color: BLUE_BRIGHT }}>{t("v4.trust.titleAccent")}</Box>
          </DisplayL>
          <LeadV4 sx={{ maxWidth: 400 }}>{t("v4.trust.sub")}</LeadV4>
        </Box>

        <Box sx={{
          display: "grid", gap: 0, border: `1px solid ${LINE}`, borderRadius: "18px", overflow: "hidden",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          background: "rgba(255,255,255,0.015)", backdropFilter: "blur(12px)",
        }}>
          {ITEMS.map((item, i) => {
            const IconCmp = item.icon;
            return (
              <Box key={item.k} data-testid={`trust-card-${i + 1}`} sx={{
                p: { xs: 3, md: 3.5 },
                borderLeft: { md: i > 0 ? `1px solid ${LINE}` : "none" },
                borderTop: { xs: i > 0 ? `1px solid ${LINE}` : "none", sm: i > 1 ? `1px solid ${LINE}` : "none", md: "none" },
                borderRight: { sm: i % 2 === 0 ? `1px solid ${LINE}` : "none", md: "none" },
                transition: "background-color .25s ease",
                "&:hover": { background: "rgba(255,255,255,0.03)" },
              }}>
                <IconCmp sx={{ fontSize: 24, color: GREEN, mb: 2 }} />
                <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16.5, color: INK0, mb: 1 }}>
                  {t(`v4.trust.${item.k}t`)}
                </Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 1.6, color: INK2 }}>
                  {t(`v4.trust.${item.k}d`)}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, mt: 4 }}>
          {CHIPS.map((c) => (
            <Typography key={c} sx={{
              fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
              color: INK3, border: `1px solid ${LINE2}`, borderRadius: 999, px: 1.75, py: 0.6,
            }}>
              {c}
            </Typography>
          ))}
        </Box>
      </ShellV4>
    </Box>
  );
};

export default memo(TrustBandV4);
