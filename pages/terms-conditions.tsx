import useIsMobile from "@/hooks/useIsMobile";
import { Box } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Body,
  HeadlineS,
  HeadlineXL,
} from "@/Components/Page/Home/v3/styled.v3";

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
        mb: isMobile ? "52px" : "93px",
        pt: isMobile ? "100px" : "128px",
      }}
    >
      {/* PAGE TITLE — v3 HeadlineXL */}
      <HeadlineXL component="h1" sx={{ textAlign: "center", mb: 3 }}>
        {t("termsConditionsTitle")}
      </HeadlineXL>

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
            <Box key={sectionId} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {/* SECTION HEADING — v3 HeadlineS */}
              <HeadlineS component="h2">{t(`${sectionId}Title`)}</HeadlineS>

              {desc1 && <Body>{desc1}</Body>}
              {desc2 && <Body>{desc2}</Body>}

              {Array.isArray(bullets) && bullets.length > 0 && (
                <Box component="ul" sx={{ pl: "26px", my: 0 }}>
                  {bullets.map((point, pointIndex) => (
                    <Body
                      component="li"
                      key={pointIndex}
                      sx={{ listStyle: "disc", display: "list-item" }}
                    >
                      {point}
                    </Body>
                  ))}
                </Box>
              )}

              {footer && <Body>{footer}</Body>}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default TermsConditions;
