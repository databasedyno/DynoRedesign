import React, { memo } from "react";
import { Box, Typography, Button } from "@mui/material";
import { useRouter } from "next/router";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CardGiftcardRoundedIcon from "@mui/icons-material/CardGiftcardRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { HeadlineXL } from "./styled.v3";

const FinalCTAAurora: React.FC = () => {
  const s = useAurora();
  const router = useRouter();

  return (
    <Box component="section" sx={{ background: s.bg, pt: { xs: 4, md: 6 }, pb: { xs: 16, md: 26 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: { xs: "24px", md: "32px" },
            background: "#0A0A0A",
            px: { xs: 3, md: 8 },
            py: { xs: 9, md: 14 },
            textAlign: "center",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          {/* Single coral bloom (was two rainbow blobs) */}
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: "-40%",
              left: "-10%",
              width: 620,
              height: 620,
              borderRadius: "50%",
              background: "#4F46E5",
              filter: "blur(140px)",
              opacity: 0.16,
              pointerEvents: "none",
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              bottom: "-40%",
              right: "-10%",
              width: 520,
              height: 520,
              borderRadius: "50%",
              background: "#4F46E5",
              filter: "blur(140px)",
              opacity: 0.10,
              pointerEvents: "none",
            }}
          />
          {/* subtle grid */}
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
              maskImage: "radial-gradient(ellipse 80% 90% at 50% 50%, black 20%, transparent 85%)",
              WebkitMaskImage: "radial-gradient(ellipse 80% 90% at 50% 50%, black 20%, transparent 85%)",
              pointerEvents: "none",
            }}
          />

          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)", mb: 3, fontWeight: 500 }}>
              [ Ready when you are ]
            </Typography>
            <HeadlineXL sx={{ color: "#F5F5F5", fontSize: { xs: 40, sm: 56, md: 76 }, mb: 3 }}>
              Get paid in
              <br />
              <Box component="span" sx={{ color: "#4F46E5" }}>
                crypto today.
              </Box>
            </HeadlineXL>
            <Typography sx={{ fontFamily: FONT_BODY, color: "rgba(255,255,255,0.68)", fontSize: { xs: 16, md: 18 }, maxWidth: 520, mx: "auto", mb: 3.5, lineHeight: 1.55 }}>
              Free to start. No card. Live in under 10 minutes. Bring your
              wallet, keep your money.
            </Typography>
            {/* Reward hook — bookends the same $500 fee-free offer shown in the hero */}
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                mb: 4.5,
                px: 2,
                py: 1,
                borderRadius: "999px",
                background: "rgba(79, 70, 229,0.16)",
                border: "1px solid rgba(79, 70, 229,0.4)",
              }}
            >
              <CardGiftcardRoundedIcon sx={{ fontSize: 18, color: "#6366F1" }} />
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: "#C7D2FE" }}>
                New accounts: your first <b>$500</b> in volume is fee-free
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 2 }}>
              <Button
                onClick={() => router.push("/auth/register")}
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
                  background: "#4F46E5",
                  boxShadow: "0 12px 32px -12px rgba(79, 70, 229,0.6)",
                  "&:hover": { background: "#4338CA" },
                }}
              >
                Get started free
              </Button>
              <Button
                href="/documentation"
                sx={{
                  borderRadius: "999px",
                  px: 3.5,
                  py: 1.55,
                  fontFamily: FONT_BODY,
                  fontSize: 15.5,
                  fontWeight: 500,
                  textTransform: "none",
                  color: "#F5F5F5",
                  border: "1px solid rgba(255,255,255,0.24)",
                  "&:hover": { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.45)" },
                }}
              >
                Read the docs
              </Button>
            </Box>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", mt: 4 }}>
              Non-custodial · 15+ chains · SOC2 track · GDPR / AML
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(FinalCTAAurora);
