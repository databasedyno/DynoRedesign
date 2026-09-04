import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useInView, useReducedMotion } from "framer-motion";
import { Reveal } from "./Reveal";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import BusinessCenterRoundedIcon from "@mui/icons-material/BusinessCenterRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { FONT_BODY, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * BrandSpotlightV3 — dedicated "headline feature" moment for the multi-brand
 * capability (2026-09). Pairs value copy with a faithful, theme-aware recreation
 * of the in-dashboard brand switcher (Components/UI/CompanySelector). Rendered on
 * ALL breakpoints (never wrapped in the landing's hideOnPhone) so the feature is
 * visible on desktop, tablet and mobile. The switcher panel is an illustrative
 * product mock — its demo brand names are intentionally static (like a screenshot).
 */
const BrandSpotlightV3: React.FC = () => {
  const s = useAurora();
  const theme = useTheme();
  const { t } = useTranslation("landing");
  const router = useRouter();
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;
  const verified = s.dark ? "#4ADE80" : "#16A34A";

  // Live "hop": the active-brand highlight cycles through the brands while the
  // mock is on-screen, so the switcher feels alive as visitors scroll. Paused
  // off-screen and fully disabled under prefers-reduced-motion.
  const mockRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(mockRef, { margin: "-15% 0px" });
  const reduceMotion = useReducedMotion();
  const [activeBrand, setActiveBrand] = useState(0);

  const bullets = [
    t("v3.brandSpotlight.b1", { defaultValue: "One login for every brand — no juggling separate accounts." }),
    t("v3.brandSpotlight.b2", { defaultValue: "Each brand keeps its own checkout, wallets and settlement currency." }),
    t("v3.brandSpotlight.b3", { defaultValue: "Switch between brands in one click, on any device." }),
  ];

  const brands = [
    { name: "Aurora Coffee", email: "hello@auroracoffee.com", type: "Business", verified: true, active: true },
    { name: "Nomad Studio", email: "pay@nomadstudio.io", type: "Business", verified: false, active: false },
    { name: "Side Projects", email: "me@side.dev", type: "Individual", verified: false, active: false },
  ];

  useEffect(() => {
    if (!inView || reduceMotion) return;
    const id = setInterval(() => {
      setActiveBrand((i) => (i + 1) % brands.length);
    }, 1900);
    return () => clearInterval(id);
  }, [inView, reduceMotion, brands.length]);

  return (
    <Box component="section" data-testid="brand-spotlight" sx={{ background: s.bg, py: { xs: 8, md: 12 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: { xs: 6, md: 9 },
            alignItems: "center",
          }}
        >
          {/* LEFT — value copy */}
          <Reveal>
            <Eyebrow sx={{ mb: 2 }}>
              {t("v3.brandSpotlight.eyebrow", { defaultValue: "Multi-brand" })}
            </Eyebrow>
            <HeadlineL component="h2" sx={{ color: s.ink, mb: 2.5 }}>
              {t("v3.why.c7t")}
            </HeadlineL>
            <Typography
              sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: 16.5, lineHeight: 1.62, mb: 3.5, maxWidth: 520 }}
            >
              {t("v3.why.c7d")}
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75, mb: 4.5 }}>
              {bullets.map((b, i) => (
                <Box key={i} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: "8px",
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                      mt: "1px",
                      background: s.dark ? "rgba(129,140,248,0.16)" : "rgba(79,70,229,0.10)",
                    }}
                  >
                    <CheckRoundedIcon sx={{ fontSize: 16, color: accent }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONT_BODY, color: s.ink, fontSize: 15.5, lineHeight: 1.5 }}>
                    {b}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box
              component="button"
              type="button"
              data-testid="brand-spotlight-cta"
              onClick={() => router.push("/auth/register?ref=brand_spotlight")}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 3.25,
                py: 1.4,
                border: "none",
                borderRadius: "999px",
                cursor: "pointer",
                background: accent,
                color: "#FFFFFF",
                fontFamily: FONT_BODY,
                fontWeight: 600,
                fontSize: 15,
                boxShadow: `0 10px 26px ${accent}33`,
                transition: "transform .22s ease, box-shadow .22s ease, background-color .22s ease",
                "&:hover": { transform: "translateY(-2px)", boxShadow: `0 16px 34px ${accent}55` },
                "& .arw": { transition: "transform .22s ease" },
                "&:hover .arw": { transform: "translateX(3px)" },
              }}
            >
              {t("v3.brandSpotlight.cta", { defaultValue: "Start your first brand" })}
              <ArrowForwardRoundedIcon className="arw" sx={{ fontSize: 18 }} />
            </Box>
          </Reveal>

          {/* RIGHT — brand switcher mock */}
          <Reveal
            delay={0.1}
            style={{ position: "relative" }}
          >
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                inset: -24,
                background: s.auroraSoft,
                filter: "blur(48px)",
                borderRadius: "40px",
                zIndex: 0,
                opacity: s.dark ? 0.55 : 0.9,
              }}
            />
            <Box
              ref={mockRef}
              data-testid="brand-switcher-mock"
              role="img"
              aria-label="DynoPay brand switcher showing multiple brands under one account"
              sx={{
                position: "relative",
                zIndex: 1,
                width: "100%",
                maxWidth: 400,
                mx: { xs: "auto", md: 0 },
                p: 1.25,
                borderRadius: "16px",
                background: s.surface,
                border: `1px solid ${s.line}`,
                boxShadow: s.dark
                  ? "0 24px 60px rgba(0,0,0,0.5)"
                  : "0 24px 60px rgba(10,10,10,0.12)",
              }}
            >
              {/* header */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 1,
                  py: 0.75,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                  <BusinessCenterRoundedIcon sx={{ fontSize: 20, color: accent }} />
                  <Typography sx={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, color: accent }}>
                    Aurora Group
                  </Typography>
                </Box>
                <ExpandLessRoundedIcon sx={{ fontSize: 20, color: s.ink3 }} />
              </Box>

              <Typography
                sx={{
                  px: 1,
                  mt: 1,
                  mb: 0.75,
                  fontFamily: FONT_BODY,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: s.ink3,
                }}
              >
                Your brands
              </Typography>

              {/* brand rows */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {brands.map((b, idx) => {
                  const isIndividual = b.type === "Individual";
                  const isActive = idx === activeBrand;
                  return (
                    <Box
                      key={b.name}
                      data-testid={`brand-row-${idx}`}
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 1,
                        p: 1,
                        borderRadius: "10px",
                        border: `1px solid ${isActive ? `${accent}55` : "transparent"}`,
                        background: isActive
                          ? s.dark
                            ? "rgba(129,140,248,0.14)"
                            : "rgba(79,70,229,0.07)"
                          : "transparent",
                        transition: "background-color .55s ease, border-color .55s ease",
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                          <StorefrontRoundedIcon sx={{ fontSize: 18, color: s.ink2 }} />
                          <Typography
                            sx={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, color: s.ink }}
                          >
                            {b.name}
                          </Typography>
                          {b.verified && (
                            <VerifiedRoundedIcon sx={{ fontSize: 15, color: verified }} />
                          )}
                          <Box
                            sx={{
                              px: 0.75,
                              py: "1px",
                              borderRadius: "999px",
                              fontFamily: FONT_BODY,
                              fontSize: 9.5,
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              whiteSpace: "nowrap",
                              color: isIndividual ? s.ink3 : accent,
                              border: `1px solid ${isIndividual ? s.line : `${accent}88`}`,
                            }}
                          >
                            {b.type}
                          </Box>
                        </Box>
                        <Typography
                          sx={{ mt: 0.25, fontFamily: FONT_BODY, fontSize: 11.5, color: s.ink3 }}
                        >
                          {b.email}
                        </Typography>
                      </Box>
                      <CheckRoundedIcon
                        aria-hidden
                        sx={{
                          fontSize: 18,
                          color: accent,
                          flexShrink: 0,
                          mt: 0.25,
                          opacity: isActive ? 1 : 0,
                          transform: isActive ? "scale(1)" : "scale(0.6)",
                          transition: "opacity .45s ease, transform .45s ease",
                        }}
                      />
                    </Box>
                  );
                })}
              </Box>

              <Box sx={{ height: "1px", background: s.line, my: 1, mx: 0.5 }} />

              {/* add brand */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.75,
                  py: 1,
                  borderRadius: "10px",
                  border: `1px dashed ${s.lineStrong}`,
                  color: accent,
                  fontFamily: FONT_BODY,
                  fontWeight: 600,
                  fontSize: 13.5,
                }}
              >
                <AddRoundedIcon sx={{ fontSize: 18 }} />
                Add brand
              </Box>
            </Box>
          </Reveal>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(BrandSpotlightV3);
