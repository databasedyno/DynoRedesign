import useIsMobile from "@/hooks/useIsMobile";
import { Box } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Body,
  HeadlineS,
  HeadlineXL,
} from "@/Components/Page/Home/v3/styled.v3";

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
      {/* PAGE TITLE — v3 HeadlineXL */}
      <HeadlineXL component="h1" sx={{ textAlign: "center", mb: 3 }}>
        {t("amlPolicyTitle")}
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
        <Body>{t("intro")}</Body>

        {SECTION_IDS.map((sectionId) => {
          const desc = t(`${sectionId}Desc`);
          const footer = t(`${sectionId}Footer`);
          const bullets = t(`${sectionId}Bullets`, { returnObjects: true }) as string[];

          return (
            <Box key={sectionId} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {/* SECTION HEADING — v3 HeadlineS */}
              <HeadlineS component="h2">{t(`${sectionId}Title`)}</HeadlineS>

              {desc && <Body sx={{ whiteSpace: "pre-line" }}>{desc}</Body>}

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

export default AMLPolicy;
