import React, { memo, useState } from "react";
import { Box, Collapse, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { BG0, BG1, FONT_BODY, FONT_DISPLAY, INK0, INK2, LINE, LINE2 } from "./theme.v4";
import { DisplayL, EyebrowV4, ShellV4 } from "./styled.v4";

const QS = ["q1", "q2", "q3", "q4", "q5"] as const;

const FAQV4: React.FC = () => {
  const { t } = useTranslation("landing");
  const [open, setOpen] = useState<number>(0);

  return (
    <Box component="section" sx={{ background: BG0 }}>
      <ShellV4 sx={{
        py: { xs: 10, md: 15 },
        display: "grid", gridTemplateColumns: { xs: "1fr", md: "0.9fr 1.4fr" }, gap: { xs: 5, md: 10 },
      }}>
        <Box>
          <EyebrowV4 sx={{ mb: 2.5 }}>{t("v4.faq.eyebrow")}</EyebrowV4>
          <DisplayL component="h2" sx={{ maxWidth: 360 }}>{t("v4.faq.title")}</DisplayL>
        </Box>

        <Box>
          {QS.map((q, i) => {
            const expanded = open === i;
            return (
              <Box key={q} data-testid={`faq-item-${i + 1}`} sx={{
                borderTop: `1px solid ${LINE}`,
                ...(i === QS.length - 1 && { borderBottom: `1px solid ${LINE}` }),
                background: expanded ? BG1 : "transparent",
                transition: "background-color .25s ease",
              }}>
                <Box
                  data-testid={`faq-toggle-${i + 1}`}
                  onClick={() => setOpen(expanded ? -1 : i)}
                  sx={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 3,
                    px: { xs: 1.5, md: 2.5 }, py: 2.75, cursor: "pointer",
                    "&:hover .faq-q": { color: "#fff" },
                  }}
                >
                  <Typography className="faq-q" sx={{
                    fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: { xs: 16, md: 18 },
                    color: expanded ? INK0 : "rgba(255,255,255,0.82)", transition: "color .2s ease",
                  }}>
                    {t(`v4.faq.${q}`)}
                  </Typography>
                  <AddRoundedIcon sx={{
                    fontSize: 20, color: INK2, flexShrink: 0,
                    transform: expanded ? "rotate(45deg)" : "none", transition: "transform .25s ease",
                  }} />
                </Box>
                <Collapse in={expanded} timeout={260}>
                  <Typography sx={{
                    px: { xs: 1.5, md: 2.5 }, pb: 3, maxWidth: 640,
                    fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.7, color: INK2,
                  }}>
                    {t(`v4.faq.a${i + 1}`)}
                  </Typography>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      </ShellV4>
    </Box>
  );
};

export default memo(FAQV4);
