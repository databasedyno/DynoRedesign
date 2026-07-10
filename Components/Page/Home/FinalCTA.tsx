import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import { ArrowForward } from "@mui/icons-material";
import { useRouter } from "next/router";
import { FONT_BODY, FONT_HERO, FONT_TECH, OBSIDIAN } from "./swiss";

/**
 * FinalCTA — deep-obsidian full-width band regardless of theme mode.
 * "The old rails are slow. Dynopay is instant."
 */
const FinalCTA: React.FC = () => {
  const { t } = useTranslation("landing");
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const goRegister = useCallback(() => router.push("/auth/register?ref=final_cta"), [router]);
  const goDocs = useCallback(() => router.push("/documentation"), [router]);

  return (
    <Box
      component="section"
      ref={sectionRef}
      data-testid="final-cta-section"
      sx={{
        position: "relative",
        overflow: "hidden",
        backgroundColor: OBSIDIAN,
        borderTop: "1px solid rgba(255,255,255,0.08)",
        py: { xs: 11, md: 18 },
        px: { xs: 3, md: 6 },
        textAlign: "center",
      }}
    >
      {/* Grid backdrop */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          maskImage: "radial-gradient(ellipse 80% 90% at 50% 50%, black 20%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 90% at 50% 50%, black 20%, transparent 80%)",
        }}
      />

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          maxWidth: 980,
          mx: "auto",
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(28px)",
          transition: "opacity 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <Typography component="h2" sx={{ m: 0 }}>
          <Box component="span" sx={{ display: "block", fontFamily: FONT_HERO, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.12, color: "#F5F5F5", fontSize: { xs: 28, sm: 40, md: 52 } }}>
            {t("finalCtaSwissTitle1")}
          </Box>
          <Box component="span" sx={{ display: "block", fontFamily: FONT_HERO, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.12, color: "#CCFF00", fontSize: { xs: 28, sm: 40, md: 52 } }}>
            {t("finalCtaSwissTitle2")}
          </Box>
        </Typography>

        <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 15, md: 17 }, color: "rgba(255,255,255,0.6)", maxWidth: 520, mx: "auto", mt: 3, mb: 5, lineHeight: 1.6 }}>
          {t("finalCtaSubtitle")}
        </Typography>

        <Box sx={{ display: "flex", justifyContent: "center", gap: 2, flexWrap: "wrap", mb: 4 }}>
          <Box
            component="button"
            type="button"
            data-testid="final-cta-register"
            onClick={goRegister}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              px: 3.5,
              py: 1.7,
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              backgroundColor: "#CCFF00",
              color: "#0A0A0A",
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 15.5,
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              "&:hover": { transform: "translate(-2px, -2px)", boxShadow: "4px 4px 0 rgba(204,255,0,0.35)" },
            }}
          >
            {t("startAcceptingCrypto")} <ArrowForward sx={{ fontSize: 17 }} />
          </Box>
          <Box
            component="button"
            type="button"
            data-testid="final-cta-docs-btn"
            onClick={goDocs}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              px: 3.5,
              py: 1.7,
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.25)",
              cursor: "pointer",
              backgroundColor: "transparent",
              color: "#F5F5F5",
              fontFamily: FONT_BODY,
              fontWeight: 500,
              fontSize: 15.5,
              transition: "border-color 0.2s ease, background-color 0.2s ease",
              "&:hover": { borderColor: "rgba(255,255,255,0.55)", backgroundColor: "rgba(255,255,255,0.05)" },
            }}
          >
            {t("finalCtaDocs")}
          </Box>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 2.5, flexWrap: "wrap" }}>
          <Typography
            component="button"
            type="button"
            data-testid="final-cta-chat"
            onClick={() => window.dispatchEvent(new CustomEvent("dynopay:open-support-chat"))}
            sx={{
              fontFamily: FONT_TECH,
              fontSize: 12.5,
              color: "rgba(255,255,255,0.5)",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              transition: "color 0.2s ease",
              "&:hover": { color: "#CCFF00" },
            }}
          >
            {t("finalCtaChat")}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(FinalCTA);
