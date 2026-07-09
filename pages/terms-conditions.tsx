import useIsMobile from "@/hooks/useIsMobile";
import { Box, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

const SECTION_IDS = Array.from({ length: 18 }, (_, i) => `section${i + 1}`);

const TermsConditions = () => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("termsConditions");

  return (
    <Box
      sx={{
        width: isMobile ? "100%" : 768,
        px: isMobile ? "15px" : 0,
        mx: "auto",
        fontFamily: "var(--font-sans)",
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
          mb: "15px",
          lineHeight: "60px",
          letterSpacing: 0,
        }}
      >
        {t("termsConditionsTitle")}
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
        {SECTION_IDS.map((sectionId) => {
          const desc1 = t(`${sectionId}Desc1`);
          const desc2 = t(`${sectionId}Desc2`);
          const footer = t(`${sectionId}Footer`);
          const bullets = t(`${sectionId}Bullets`, { returnObjects: true }) as string[];

          return (
            <Box key={sectionId}>
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

              {/* ITEM DESCRIPTION 1 */}
              {desc1 && (
                <Typography
                  sx={{
                    fontSize: "18px",
                    color: "text.secondary",
                    fontFamily: "var(--font-sans)",
                    lineHeight: "28px",
                    letterSpacing: 0,
                  }}
                >
                  {desc1}
                </Typography>
              )}

              {/* ITEM DESCRIPTION 2 */}
              {desc2 && (
                <Typography
                  sx={{
                    fontSize: "18px",
                    color: "text.secondary",
                    fontFamily: "var(--font-sans)",
                    lineHeight: "28px",
                    letterSpacing: 0,
                  }}
                >
                  {desc2}
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

export default TermsConditions;