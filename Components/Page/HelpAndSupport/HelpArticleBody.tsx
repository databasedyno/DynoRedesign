import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import useIsMobile from "@/hooks/useIsMobile";
import { theme } from "@/styles/theme";
import { TextDecoration } from "./styled";

interface ArticleSection {
  heading: string;
  body?: string;
  bullets?: string[];
}

/**
 * Renders a data-driven help article from the `helpAndSupport` i18n namespace
 * (`articles.<slug>`). Fully server-renderable so crawlers get the real text,
 * and it localises automatically under ?lang=xx once server-side locales ship.
 */
export const HelpArticleBody = ({ slug, title }: { slug: string; title: string }) => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("helpAndSupport");

  const intro = t(`articles.${slug}.intro`, { defaultValue: "" });
  const sections = t(`articles.${slug}.sections`, { returnObjects: true, defaultValue: [] }) as
    | ArticleSection[]
    | string;
  const list: ArticleSection[] = Array.isArray(sections) ? sections : [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", maxWidth: "760px" }}>
      <TextDecoration {...({ component: "h1" } as { component: string })} style={{ fontSize: isMobile ? "22px" : "30px", color: theme.palette.text.primary, lineHeight: 1.25, margin: 0 }}>
        {title}
      </TextDecoration>

      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.border.main}`,
          borderRadius: "14px",
          padding: isMobile ? "16px" : "32px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {intro && (
          <Typography component="p" sx={{ fontFamily: "var(--font-sans)", fontSize: isMobile ? "14px" : "16px", color: theme.palette.text.primary, lineHeight: 1.7 }}>
            {intro}
          </Typography>
        )}

        {list.map((section, i) => (
          <Box key={i} sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Typography component="h2" sx={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: isMobile ? "16px" : "20px", color: theme.palette.text.primary }}>
              {section.heading}
            </Typography>
            {section.body && (
              <Typography component="p" sx={{ fontFamily: "var(--font-sans)", fontSize: isMobile ? "13px" : "15px", color: theme.palette.text.secondary, lineHeight: 1.7 }}>
                {section.body}
              </Typography>
            )}
            {Array.isArray(section.bullets) && section.bullets.length > 0 && (
              <Box component="ul" sx={{ pl: "22px", m: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                {section.bullets.map((point, j) => (
                  <Typography key={j} component="li" sx={{ fontFamily: "var(--font-sans)", fontSize: isMobile ? "13px" : "15px", color: theme.palette.text.secondary, lineHeight: 1.7 }}>
                    {point}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default HelpArticleBody;
