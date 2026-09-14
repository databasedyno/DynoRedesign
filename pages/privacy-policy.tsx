import useIsMobile from "@/hooks/useIsMobile";
import { Box } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Body,
  HeadlineS,
  HeadlineXL,
} from "@/Components/Page/Home/v3/styled.v3";

const SECTION_IDS = Array.from({ length: 10 }, (_, i) => `section${i + 1}`);

const PrivacyPolicy = () => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("privacyPolicy");

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
        {t("privacyPolicyTitle")}
      </HeadlineXL>

      {/* SECTION CONTENT */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "28px",
          lineHeight: 1.5,
        }}
      >
        <Body>{t("intro")}</Body>

        {SECTION_IDS.map((sectionId) => {
          const info = t(`${sectionId}Info`, { returnObjects: true }) as { title: string; details: string }[];
          const items = t(`${sectionId}Items`, { returnObjects: true }) as string[];

          return (
            <Box key={sectionId} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {/* SECTION HEADING — v3 HeadlineS */}
              <HeadlineS component="h2">{t(`${sectionId}Title`)}</HeadlineS>

              <Body>{t(`${sectionId}Desc`)}</Body>

              {Array.isArray(info) && info.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, my: 1 }}>
                  {info.map((infoItem, infoIndex) => (
                    <React.Fragment key={infoIndex}>
                      <Body sx={{ fontWeight: 600 }}>{infoItem.title}</Body>
                      <Body>{infoItem.details}</Body>
                    </React.Fragment>
                  ))}
                </Box>
              )}

              {Array.isArray(items) && items.length > 0 && (
                <Box component="ul" sx={{ pl: "26px", my: 0 }}>
                  {items.map((item, itemIndex) => (
                    <Body
                      component="li"
                      key={itemIndex}
                      sx={{ listStyle: "disc", display: "list-item" }}
                    >
                      {item}
                    </Body>
                  ))}
                </Box>
              )}

              <Body>{t(`${sectionId}Footer`)}</Body>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default PrivacyPolicy;
