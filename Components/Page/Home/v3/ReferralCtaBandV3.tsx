import React, { memo } from "react";
import { Box, Typography, Button } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Diversity3RoundedIcon from "@mui/icons-material/Diversity3Rounded";
import { FONT_BODY, FONT_TECH, useAurora } from "./theme.v3";
import { HeadlineL } from "./styled.v3";

/* Landing CTA band pointing to the public /referral-program page.
 * Copy reuses the "referrals" namespace public.band* keys (localized ×6). */
const ReferralCtaBandV3: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("referrals");

  return (
    <Box component="section" sx={{ background: s.bg, py: { xs: 8, md: 12 } }} data-testid="referral-cta-band">
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: { xs: "24px", md: "28px" },
            border: `1px solid ${s.line}`,
            background: s.surface,
            px: { xs: 3.5, md: 7 },
            py: { xs: 6, md: 8 },
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "space-between",
            gap: { xs: 4, md: 6 },
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: "-60%",
              left: "-8%",
              width: 460,
              height: 460,
              borderRadius: "50%",
              background: s.aurora,
              filter: "blur(150px)",
              opacity: s.dark ? 0.16 : 0.1,
              pointerEvents: "none",
            }}
          />
          <Box sx={{ position: "relative", zIndex: 1, maxWidth: 640 }}>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Diversity3RoundedIcon sx={{ fontSize: 20, color: s.indigo }} />
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: s.indigo, fontWeight: 500 }}>
                {t("public.bandEyebrow")}
              </Typography>
            </Box>
            <HeadlineL sx={{ color: s.ink, mb: 2, fontSize: { xs: 28, md: 40 } }}>
              {t("public.bandTitle")}
            </HeadlineL>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 15, md: 17 }, color: s.ink2, lineHeight: 1.6 }}>
              {t("public.bandBody")}
            </Typography>
          </Box>
          <Box sx={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
            <Button
              data-testid="referral-cta-band-link"
              onClick={() => router.push("/referral-program")}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
              sx={{
                borderRadius: "999px",
                px: 4,
                py: 1.6,
                fontFamily: FONT_BODY,
                fontSize: 16,
                fontWeight: 600,
                textTransform: "none",
                color: "#FFFFFF",
                background: s.indigo,
                boxShadow: "0 12px 32px -12px rgba(79, 70, 229,0.6)",
                "&:hover": { background: "#4338CA" },
              }}
            >
              {t("public.bandCta")}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(ReferralCtaBandV3);
