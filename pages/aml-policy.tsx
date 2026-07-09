import useIsMobile from "@/hooks/useIsMobile";
import { Box, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

const SECTION_IDS = Array.from({ length: 9 }, (_, i) => `section${i + 1}`);

const AMLPolicy = () => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("amlPolicy");

  return (
    <Box
      sx={{
        width: isMobile ? "100%" : 768,
        px: isMobile ? "15px" : 0,
        mx: "auto",
        mb: isMobile ? "52px" : "93px",
        pt: isMobile ? "100px" : "128px",
      }}
    >

      {/* SECTION TITLE */}
      <Typography
        component="h1"
        sx={{
          fontSize: isMobile ? "45px" : "60px",
          color: "text.primary",
          fontWeight: isMobile ? 600 : 500,
          textAlign: "center",
          fontFamily: "var(--font-sans)",
          lineHeight: "60px",
          letterSpacing: 0,
          mb: "15px",
        }}
      >
        {t("amlPolicyTitle")}
      </Typography>

      {/* SECTION CONTENT */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "30px",
          lineHeight: 1.5,
        }}
      >

        <Typography
          sx={{
            fontSize: "18px",
            color: "text.secondary",
            fontWeight: 400,
            fontFamily: "var(--font-sans)",
            lineHeight: "28px",
            letterSpacing: 0,
          }}
        >
          {t("intro")}
        </Typography>

        {SECTION_IDS.map((sectionId) => {
          const desc = t(`${sectionId}Desc`);
          const footer = t(`${sectionId}Footer`);
          const bullets = t(`${sectionId}Bullets`, { returnObjects: true }) as string[];

          return (
            <Box key={sectionId} sx={{ display: "flex", flexDirection: "column", gap: "30px" }}>
              {/* ITEM TITLE */}
              <Typography
                sx={{
                  fontSize: "18px",
                  color: "text.secondary",
                  fontWeight: 600,
                  fontFamily: "var(--font-sans)",
                  lineHeight: "28px",
                  letterSpacing: 0,
                }}
              >
                {t(`${sectionId}Title`)}
              </Typography>

              {/* ITEM DESCRIPTION */}
              {desc && (
                <Typography
                  sx={{
                    fontSize: "18px",
                    color: "text.secondary",
                    fontWeight: 400,
                    fontFamily: "var(--font-sans)",
                    lineHeight: "28px",
                    letterSpacing: 0,
                    whiteSpace: "pre-line",
                  }}
                >
                  {desc}
                </Typography>
              )}

              {/* ITEM BULLET POINTS */}
              {Array.isArray(bullets) && bullets.length > 0 && (
                <Box component="ul" sx={{ pl: "26px", my: "5px" }}>
                  {bullets.map((point, pointIndex) => (
                    <Box
                      component="li"
                      key={pointIndex}
                      sx={{
                        listStyle: "disc",
                        fontSize: "18px",
                        color: "text.secondary",
                        fontWeight: 400,
                        fontFamily: "var(--font-sans)",
                        lineHeight: "28px",
                        letterSpacing: 0,
                      }}
                    >
                      {point}
                    </Box>
                  ))}
                </Box>
              )}

              {/* ITEM FOOTER */}
              {footer && (
                <Typography
                  sx={{
                    fontSize: "18px",
                    color: "text.secondary",
                    fontWeight: 400,
                    fontFamily: "var(--font-sans)",
                    lineHeight: "28px",
                    letterSpacing: 0,
                  }}
                >
                  {footer}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default AMLPolicy;
