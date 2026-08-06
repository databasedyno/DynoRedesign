import { pageProps } from "@/utils/types";
import {Box, CircularProgress, Typography, Button, useTheme} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import useIsMobile from "@/hooks/useIsMobile";
import { theme } from "@/styles/theme";
import { SearchIconButton, TextDecoration } from "@/Components/Page/HelpAndSupport/styled";
import SearchIcon from "@/assets/Icons/search-icon.svg";
import BackArrow from "@/assets/Icons/BackArrow.svg";
import Image from "next/image";
import axiosBaseApi from "@/axiosConfig";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { BRAND_ACCENT } from "@/constants/theme";

interface KBArticleDetail {
  article_id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  category_name?: string;
  reading_time_minutes?: number;
  helpful_count?: number;
  not_helpful_count?: number;
  view_count?: number;
  created_at?: string;
  updated_at?: string;
}

const HelpDetail = ({
  setPageName,
  setPageDescription,
}: pageProps) => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("helpAndSupport");
  const router = useRouter();
  const { slug } = router.query;
  const [article, setArticle] = useState<KBArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(t("helpAndSupportTitle"));
      setPageDescription(t("helpAndSupportDescription"));
    }
  }, [setPageName, setPageDescription, t]);

  useEffect(() => {
    if (!router.isReady || !slug) return;

    const fetchArticle = async () => {
      try {
        setLoading(true);
        const res = await axiosBaseApi.get(`/kb/articles/${slug}`);
        const data = res?.data?.data;
        if (data?.article) {
          setArticle(data.article);
        } else {
          // Article not found
          setArticle(null);
        }
      } catch {
        setArticle(null);
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [router.isReady, slug]);

  const handleFeedback = async (isHelpful: boolean) => {
    if (!article?.article_id || feedbackSubmitted) return;
    try {
      await axiosBaseApi.post(`/kb/articles/${article.article_id}/feedback`, {
        is_helpful: isHelpful,
      });
      setFeedbackSubmitted(true);
    } catch {
      // Silently fail
    }
  };

  if (loading) {
    return (
      <Box sx={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!article) {
    return (
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, minHeight: 300 }}>
        <Typography sx={{ fontSize: "18px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
          {t('articleNotFound')}
        </Typography>
        <Button
          onClick={() => router.push("/help-support")}
          sx={{ color: BRAND_ACCENT, textTransform: "none", fontFamily: "var(--font-sans)" }}
        >
          {t('backToHelpSupport')}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        {/* Search bar */}
        <Box sx={{ position: "sticky", top: 0, left: 0, pb: "20px", backgroundColor: theme.palette.secondary.main, zIndex: 1 }}>
          <Box sx={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Box
              sx={{
                "& input:focus": {
                  borderColor: BRAND_ACCENT,
                },
              }}>
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                style={{
                  width: isMobile ? "300px" : "639px",
                  fontSize: isMobile ? "10px" : "13px",
                  fontFamily: "var(--font-sans)",
                  lineHeight: "100%",
                  letterSpacing: 0,
                  fontWeight: 500,
                  padding: "12px 13.5px",
                  border: `1px solid ${theme.palette.border.main}`,
                  backgroundColor: theme.palette.background.paper,
                  borderRadius: "6px",
                  outline: "none",
                  transition: "0.2s",
                }}
              />
            </Box>
            <SearchIconButton>
              <Image src={SearchIcon} alt="search" width={20} height={20} />
            </SearchIconButton>
          </Box>
        </Box>

        {/* Back button + Article */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Back button */}
          <Box
            sx={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
            onClick={() => router.push("/help-support")}
          >
            <Image src={BackArrow} alt="Back" width={16} height={16} />
            <Typography sx={{ fontSize: "14px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
              {t('backToHelpSupport')}
            </Typography>
          </Box>

          {/* Article Title */}
          <TextDecoration style={{ fontSize: isMobile ? "20px" : "28px", color: theme.palette.text.primary, lineHeight: 1.3 }}>
            {article.title}
          </TextDecoration>

          {/* Reading time & category */}
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            {article.category_name && (
              <Typography sx={{
                fontSize: "12px",
                fontFamily: "var(--font-sans)",
                color: BRAND_ACCENT,
                backgroundColor: "rgba(0, 4, 255, 0.08)",
                px: 1.5,
                py: 0.5,
                borderRadius: "4px",
              }}>
                {article.category_name}
              </Typography>
            )}
            {article.reading_time_minutes && (
              <Typography sx={{ fontSize: "13px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                {article.reading_time_minutes} min read
              </Typography>
            )}
          </Box>

          {/* Article Content */}
          <Box
            sx={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.border.main}`,
              borderRadius: "14px",
              padding: isMobile ? "16px" : "32px",
              "& h1, & h2, & h3": {
                fontFamily: "var(--font-sans)",
                color: theme.palette.text.primary,
                marginTop: "24px",
                marginBottom: "12px",
              },
              "& h2": { fontSize: isMobile ? "18px" : "22px" },
              "& h3": { fontSize: isMobile ? "16px" : "18px" },
              "& p": {
                fontFamily: "var(--font-sans)",
                fontSize: isMobile ? "13px" : "15px",
                color: theme.palette.text.secondary,
                lineHeight: 1.7,
                marginBottom: "12px",
              },
              "& ul, & ol": {
                paddingLeft: "24px",
                marginBottom: "12px",
              },
              "& li": {
                fontFamily: "var(--font-sans)",
                fontSize: isMobile ? "13px" : "15px",
                color: theme.palette.text.secondary,
                lineHeight: 1.7,
                marginBottom: "6px",
              },
              "& code": {
                backgroundColor: "#f5f5f5",
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "13px",
              },
              "& pre": {
                backgroundColor: "#f5f5f5",
                padding: "16px",
                borderRadius: "8px",
                overflow: "auto",
              },
              "& a": {
                color: BRAND_ACCENT,
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              },
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
          />

          {/* Feedback Section */}
          <Box
            sx={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.border.main}`,
              borderRadius: "14px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            {feedbackSubmitted ? (
              <Typography sx={{ fontSize: "15px", fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>
                {t('feedbackThanks')}
              </Typography>
            ) : (
              <>
                <Typography sx={{ fontSize: "15px", fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>
                  {t('wasArticleHelpful')}
                </Typography>
                <Box sx={{ display: "flex", gap: 2 }}>
                  <Button
                    onClick={() => handleFeedback(true)}
                    startIcon={<ThumbUpIcon />}
                    sx={{
                      border: `1px solid ${theme.palette.border.main}`,
                      borderRadius: "8px",
                      color: theme.palette.text.primary,
                      textTransform: "none",
                      fontFamily: "var(--font-sans)",
                      px: 3,
                      "&:hover": { backgroundColor: "rgba(0, 200, 83, 0.08)", borderColor: "#00C853" },
                    }}
                  >
                    Yes
                  </Button>
                  <Button
                    onClick={() => handleFeedback(false)}
                    startIcon={<ThumbDownIcon />}
                    sx={{
                      border: `1px solid ${theme.palette.border.main}`,
                      borderRadius: "8px",
                      color: theme.palette.text.primary,
                      textTransform: "none",
                      fontFamily: "var(--font-sans)",
                      px: 3,
                      "&:hover": { backgroundColor: "rgba(255, 0, 0, 0.08)", borderColor: "#FF0000" },
                    }}
                  >
                    No
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default HelpDetail;
