import useIsMobile from "@/hooks/useIsMobile";
import { Box, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

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

      {/* PRIVACY POLICY HEADING */}
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
        {t("privacyPolicyTitle")}
      </Typography>

      {/* PRIVACY POLICY DESCRIPTION */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "28px",
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

        {/* PRIVACY POLICY SECTIONS */}
        {SECTION_IDS.map((sectionId) => {
          const info = t(`${sectionId}Info`, { returnObjects: true }) as { title: string; details: string }[];
          const items = t(`${sectionId}Items`, { returnObjects: true }) as string[];

          return (
            <Box key={sectionId}>
              {/* SECTION HEADING */}
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
              {/* SECTION DESCRIPTION */}
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
                {t(`${sectionId}Desc`)}
              </Typography>

              {/* SECTION INFO */}
              <Box sx={{ my: Array.isArray(info) && info.length > 0 ? "28px" : 0 }}>
                {Array.isArray(info) &&
                  info.length > 0 &&
                  info.map((infoItem, infoIndex) => (
                    <React.Fragment key={infoIndex}>
                      {/* INFO HEADING */}
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
                        {infoItem.title}
                      </Typography>

                      {/* INFO DESCRIPTION */}
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
                        {infoItem.details}
                      </Typography>
                    </React.Fragment>
                  ))}
              </Box>
              {/* SECTION ITEMS */}
              {Array.isArray(items) && items.length > 0 && (
                <Box component="ul" sx={{ pl: "26px" }}>
                  {items.map((item, itemIndex) => (
                    <Box
                      component="li"
                      key={itemIndex}
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
                      {item}
                    </Box>
                  ))}
                </Box>
              )}
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
                {t(`${sectionId}Footer`)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default PrivacyPolicy;
