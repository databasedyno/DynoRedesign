import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import SmartButtonRoundedIcon from "@mui/icons-material/SmartButtonRounded";
import WidgetsRoundedIcon from "@mui/icons-material/WidgetsRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import VolunteerActivismRoundedIcon from "@mui/icons-material/VolunteerActivismRounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import { BG0, BLUE_BRIGHT, FONT_BODY, FONT_DISPLAY, INK0, INK2 } from "./theme.v4";
import { CardV4, DisplayL, EyebrowV4, LeadV4, ShellV4 } from "./styled.v4";

const ITEMS = [
  { k: "i1", icon: LinkRoundedIcon },
  { k: "i2", icon: StorefrontRoundedIcon },
  { k: "i3", icon: TerminalRoundedIcon },
  { k: "i4", icon: SmartButtonRoundedIcon },
  { k: "i5", icon: WidgetsRoundedIcon },
  { k: "i6", icon: ShoppingBagRoundedIcon },
  { k: "i7", icon: ReceiptLongRoundedIcon },
  { k: "i8", icon: VolunteerActivismRoundedIcon },
  { k: "i9", icon: QrCodeScannerRoundedIcon },
] as const;

const SurfacesGridV4: React.FC = () => {
  const { t } = useTranslation("landing");
  return (
    <Box component="section" sx={{ background: BG0 }}>
      <ShellV4 sx={{ py: { xs: 10, md: 15 } }}>
        <Box sx={{
          display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" },
          gap: { xs: 3, md: 10 }, alignItems: "end", mb: { xs: 6, md: 8 },
        }}>
          <Box>
            <EyebrowV4 sx={{ mb: 2.5 }}>{t("v4.surfaces.eyebrow")}</EyebrowV4>
            <DisplayL component="h2">
              {t("v4.surfaces.title")}{" "}
              <Box component="span" sx={{ color: BLUE_BRIGHT }}>{t("v4.surfaces.titleAccent")}</Box>
            </DisplayL>
          </Box>
          <LeadV4 sx={{ maxWidth: 380 }}>{t("v4.surfaces.sub")}</LeadV4>
        </Box>

        <Box data-testid="surfaces-grid" sx={{
          display: "grid", gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
        }}>
          {ITEMS.map((item, i) => {
            const IconCmp = item.icon;
            return (
              <CardV4 key={item.k} data-testid={`surface-card-${i + 1}`} sx={{ p: 3, display: "flex", gap: 2, alignItems: "flex-start" }}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: "10px", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,82,255,0.1)", border: "1px solid rgba(0,82,255,0.28)",
                }}>
                  <IconCmp sx={{ fontSize: 20, color: BLUE_BRIGHT }} />
                </Box>
                <Box>
                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16.5, color: INK0, mb: 0.5 }}>
                    {t(`v4.surfaces.${item.k}t`)}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 1.55, color: INK2 }}>
                    {t(`v4.surfaces.${item.k}d`)}
                  </Typography>
                </Box>
              </CardV4>
            );
          })}
        </Box>
      </ShellV4>
    </Box>
  );
};

export default memo(SurfacesGridV4);
