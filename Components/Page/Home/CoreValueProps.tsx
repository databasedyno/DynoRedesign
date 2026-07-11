import React, { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import {
  CurrencyExchange,
  InsertLink,
  ReceiptLong,
  AspectRatio,
  SmartButton,
  Widgets,
} from "@mui/icons-material";
import SwissSectionHead from "./SwissSectionHead";
import { FONT_BODY, FONT_HERO, FONT_TECH, useSwiss } from "./swiss";

interface ValueProp {
  icon: React.ReactNode;
  titleKey: string;
  descriptionKey: string;
  stat: string;
  statLabel: string;
  testId: string;
}

const valueProps: ValueProp[] = [
  {
    icon: <CurrencyExchange sx={{ fontSize: 22 }} />,
    titleKey: "coreValue1Title",
    descriptionKey: "coreValue1Description",
    stat: "<5s",
    statLabel: "conversion time",
    testId: "value-prop-settlement",
  },
  {
    icon: <InsertLink sx={{ fontSize: 22 }} />,
    titleKey: "coreValue2Title",
    descriptionKey: "coreValue2Description",
    stat: "30s",
    statLabel: "to create a link",
    testId: "value-prop-links",
  },
  {
    icon: <ReceiptLong sx={{ fontSize: 22 }} />,
    titleKey: "coreValue3Title",
    descriptionKey: "coreValue3Description",
    stat: "100%",
    statLabel: "automated",
    testId: "value-prop-tax",
  },
  {
    icon: <AspectRatio sx={{ fontSize: 22 }} />,
    titleKey: "coreValue4Title",
    descriptionKey: "coreValue4Description",
    stat: "iframe",
    statLabel: "or modal",
    testId: "value-prop-embedded-checkout",
  },
  {
    icon: <SmartButton sx={{ fontSize: 22 }} />,
    titleKey: "coreValue5Title",
    descriptionKey: "coreValue5Description",
    stat: "1",
    statLabel: "HTML tag · no-code",
    testId: "value-prop-buy-buttons",
  },
  {
    icon: <Widgets sx={{ fontSize: 22 }} />,
    titleKey: "coreValue6Title",
    descriptionKey: "coreValue6Description",
    stat: "5",
    statLabel: "languages · dark/light",
    testId: "value-prop-elements",
  },
];

const CoreValueProps: React.FC = () => {
  const { t } = useTranslation("landing");
  const s = useSwiss();
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
    <Box component="section" ref={sectionRef} id="features" data-testid="core-value-props" sx={{ py: { xs: 9, md: 15 }, px: { xs: 3, md: 6 }, maxWidth: 1400, mx: "auto" }}>
      <SwissSectionHead num="02" eyebrow={t("coreValueBadge")} title={t("coreValueTitle")} highlight={t("coreValueHighlight")} sub={t("coreValueSubtitle")} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 2, md: 2.5 } }}>
        {valueProps.map((prop, idx) => (
          <Box
            key={prop.titleKey}
            data-testid={prop.testId}
            sx={{
              position: "relative",
              borderRadius: "16px",
              backgroundColor: s.surface,
              border: `1px solid ${s.line}`,
              p: { xs: 3, md: 4 },
              overflow: "hidden",
              transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease, border-color 0.25s ease",
              transform: isVisible ? "translateY(0)" : "translateY(30px)",
              opacity: isVisible ? 1 : 0,
              transitionDelay: `${idx * 130}ms`,
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                height: "2px",
                width: 0,
                backgroundColor: s.accent,
                transition: "width 0.45s cubic-bezier(0.16,1,0.3,1)",
              },
              "&:hover": {
                borderColor: s.dark ? "rgba(204,255,0,0.35)" : "rgba(10,10,10,0.25)",
                transform: "translateY(-4px)",
              },
              "&:hover::before": { width: "100%" },
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "10px",
                border: `1px solid ${s.lineStrong}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: s.accentText,
                mb: 3,
              }}
            >
              {prop.icon}
            </Box>

            <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 500, fontSize: { xs: 17, md: 19 }, color: s.txt, lineHeight: 1.35, mb: 1.5 }}>
              {t(prop.titleKey)}
            </Typography>

            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: s.sub, lineHeight: 1.65, mb: 3 }}>
              {t(prop.descriptionKey)}
            </Typography>

            <Box sx={{ display: "inline-flex", alignItems: "baseline", gap: 1, px: 1.5, py: 0.75, borderRadius: "8px", border: `1px solid ${s.line}` }}>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 14, fontWeight: 500, color: s.accentText }}>
                {prop.stat}
              </Typography>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: s.faint }}>
                {prop.statLabel}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default memo(CoreValueProps);
