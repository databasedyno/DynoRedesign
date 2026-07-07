import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";
import HomeSectionTitle from "@/Components/UI/SectionTitle";

const testimonials = [
  {
    quote:
      "DynoPay eliminated our crypto payment headaches. Auto-conversion to USDT means we never worry about price swings eating into our margins.",
    author: "Sarah Chen",
    role: "Head of Payments",
    company: "NovaMart",
    initials: "SC",
    gradient: "linear-gradient(135deg, #4F46E5 0%, #6A4DFF 100%)",
  },
  {
    quote:
      "Setting up took 15 minutes. No developer needed — just created payment links and started accepting Bitcoin the same day.",
    author: "Marcus Rivera",
    role: "Founder",
    company: "PixelForge Studio",
    initials: "MR",
    gradient: "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
  },
  {
    quote:
      "The built-in tax compliance saves us hours every month. Auto-generated invoices with VAT across jurisdictions — it's exactly what we needed.",
    author: "Elena Vogt",
    role: "CFO",
    company: "CloudLayer SaaS",
    initials: "EV",
    gradient: "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
  },
];

const Testimonials: React.FC = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const isDark = theme.palette.mode === "dark";
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
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        padding: isMobile ? "80px 16px" : "140px 32px",
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <HomeSectionTitle
        type="small"
        badgeText="What Merchants Say"
        title="Trusted by businesses worldwide"
        highlightText="worldwide"
        subtitle="Real feedback from merchants who accept crypto with DynoPay every day."
        sx={{ maxWidth: "100%" }}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap: isMobile ? 3 : 4,
          mt: isMobile ? 5 : 8,
        }}
      >
        {testimonials.map((t, idx) => (
          <Box
            key={t.author}
            sx={{
              position: "relative",
              borderRadius: "20px",
              bgcolor: isDark ? "#141625" : "#FFFFFF",
              border: `1px solid ${isDark ? "#2A2D42" : "#E7E8EF"}`,
              p: isMobile ? 3 : 4,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: isVisible ? "translateY(0)" : "translateY(30px)",
              opacity: isVisible ? 1 : 0,
              transitionDelay: `${idx * 120}ms`,
              "&:hover": {
                transform: "translateY(-4px)",
                borderColor: isDark ? "rgba(106,123,255,0.3)" : "rgba(0,4,255,0.15)",
                boxShadow: isDark
                  ? "0 16px 48px rgba(0,0,0,0.2)"
                  : "0 16px 48px rgba(0,0,0,0.06)",
              },
            }}
          >
            {/* Quote mark */}
            <Typography
              sx={{
                fontSize: "48px",
                lineHeight: 1,
                fontFamily: "serif",
                background: t.gradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mb: 1,
                userSelect: "none",
              }}
            >
              {"\u201C"}
            </Typography>

            {/* Quote */}
            <Typography
              sx={{
                fontSize: "15px",
                fontFamily: "OutfitRegular",
                color: theme.palette.text.secondary,
                lineHeight: 1.7,
                mb: 4,
                flex: 1,
              }}
            >
              {t.quote}
            </Typography>

            {/* Author */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "12px",
                  background: t.gradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: "14px",
                  fontFamily: "OutfitSemiBold",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {t.initials}
              </Box>
              <Box>
                <Typography
                  sx={{
                    fontSize: "14px",
                    fontFamily: "OutfitSemiBold",
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    lineHeight: 1.3,
                  }}
                >
                  {t.author}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "13px",
                    fontFamily: "OutfitRegular",
                    color: theme.palette.text.secondary,
                    lineHeight: 1.3,
                  }}
                >
                  {t.role}, {t.company}
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </section>
  );
};

export default memo(Testimonials);
