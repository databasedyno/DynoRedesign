import React, { memo, useCallback, useState } from "react";
import { Box, Collapse, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import SwissSectionHead from "./SwissSectionHead";
import { FONT_BODY, FONT_TECH, useSwiss } from "./swiss";

const FAQ_KEYS: { qKey: string; aKey: string }[] = [
  { qKey: "faq1Q", aKey: "faq1A" },
  { qKey: "faq2Q", aKey: "faq2A" },
  { qKey: "faq3Q", aKey: "faq3A" },
  { qKey: "faq4Q", aKey: "faq4A" },
  { qKey: "faq5Q", aKey: "faq5A" },
  { qKey: "faq6Q", aKey: "faq6A" },
  { qKey: "faq7Q", aKey: "faq7A" },
];

const FAQ: React.FC = () => {
  const { t } = useTranslation("landing");
  const s = useSwiss();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleToggle = useCallback((idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  }, []);

  return (
    <Box component="section" id="faq" data-testid="faq-section" sx={{ py: { xs: 9, md: 15 }, px: { xs: 3, md: 4 }, maxWidth: 860, mx: "auto" }}>
      <SwissSectionHead num="05" eyebrow={t("faqBadge")} title={t("faqTitle")} highlight={t("faqHighlight")} sub={t("faqSubtitle")} />

      <Box sx={{ borderTop: `1px solid ${s.lineStrong}` }}>
        {FAQ_KEYS.map((k, idx) => {
          const isOpen = openIndex === idx;
          return (
            <Box key={k.qKey} data-testid={`faq-item-${idx}`} sx={{ borderBottom: `1px solid ${s.line}` }}>
              <Box
                onClick={() => handleToggle(idx)}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleToggle(idx); } }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 3,
                  py: 3,
                  cursor: "pointer",
                  userSelect: "none",
                  "&:hover .faq-q": { color: s.accentText },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 2, minWidth: 0 }}>
                  <Typography component="span" sx={{ fontFamily: FONT_TECH, fontSize: 12, color: s.faint, flexShrink: 0 }}>
                    {String(idx + 1).padStart(2, "0")}
                  </Typography>
                  <Typography className="faq-q" sx={{ fontFamily: FONT_BODY, fontSize: { xs: 15, md: 16.5 }, fontWeight: 500, color: s.txt, lineHeight: 1.45, transition: "color 0.2s ease" }}>
                    {t(k.qKey)}
                  </Typography>
                </Box>
                <Typography
                  component="span"
                  aria-hidden
                  sx={{
                    fontFamily: FONT_TECH,
                    fontSize: 22,
                    fontWeight: 400,
                    lineHeight: 1,
                    color: isOpen ? s.accentText : s.faint,
                    transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1), color 0.2s ease",
                    transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                    flexShrink: 0,
                  }}
                >
                  +
                </Typography>
              </Box>
              <Collapse in={isOpen}>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.sub, lineHeight: 1.75, pb: 3, pl: { xs: 0, md: 4.5 }, pr: { xs: 2, md: 6 }, maxWidth: 720 }}>
                  {t(k.aKey)}
                </Typography>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default memo(FAQ);
