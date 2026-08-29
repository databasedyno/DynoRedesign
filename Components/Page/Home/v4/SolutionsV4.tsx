import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import CloudRoundedIcon from "@mui/icons-material/CloudRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import SportsEsportsRoundedIcon from "@mui/icons-material/SportsEsportsRounded";
import { BG0, BLUE_BRIGHT, FONT_BODY, FONT_DISPLAY, GREEN, INK0, INK2, ORANGE, PURPLE } from "./theme.v4";
import { CardV4, DisplayL, EyebrowV4, LeadV4, ShellV4 } from "./styled.v4";

const ITEMS = [
  { k: "i1", icon: ShoppingCartRoundedIcon, accent: BLUE_BRIGHT },
  { k: "i2", icon: CloudRoundedIcon, accent: PURPLE },
  { k: "i3", icon: DownloadRoundedIcon, accent: GREEN },
  { k: "i4", icon: WorkRoundedIcon, accent: ORANGE },
  { k: "i5", icon: PublicRoundedIcon, accent: BLUE_BRIGHT },
  { k: "i6", icon: SportsEsportsRoundedIcon, accent: PURPLE },
] as const;

const SolutionsV4: React.FC = () => {
  const { t } = useTranslation("landing");
  return (
    <Box component="section" sx={{ background: BG0 }}>
      <ShellV4 sx={{ py: { xs: 10, md: 15 } }}>
        <Box sx={{
          display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" },
          gap: { xs: 3, md: 10 }, alignItems: "end", mb: { xs: 6, md: 8 },
        }}>
          <Box>
            <EyebrowV4 sx={{ mb: 2.5 }}>{t("v4.solutions.eyebrow")}</EyebrowV4>
            <DisplayL component="h2">
              {t("v4.solutions.title")}{" "}
              <Box component="span" sx={{ color: BLUE_BRIGHT }}>{t("v4.solutions.titleAccent")}</Box>
            </DisplayL>
          </Box>
          <LeadV4 sx={{ maxWidth: 380 }}>{t("v4.solutions.sub")}</LeadV4>
        </Box>

        <Box data-testid="solutions-grid" sx={{
          display: "grid", gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
        }}>
          {ITEMS.map((item, i) => {
            const IconCmp = item.icon;
            return (
              <CardV4 key={item.k} data-testid={`solution-card-${i + 1}`} sx={{ p: 3.25 }}>
                <IconCmp sx={{ fontSize: 24, color: item.accent, mb: 2 }} />
                <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: INK0, mb: 0.75 }}>
                  {t(`v4.solutions.${item.k}t`)}
                </Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.6, color: INK2 }}>
                  {t(`v4.solutions.${item.k}d`)}
                </Typography>
              </CardV4>
            );
          })}
        </Box>
      </ShellV4>
    </Box>
  );
};

export default memo(SolutionsV4);
