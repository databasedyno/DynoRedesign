import { brandFg } from "@/constants/theme";
import useIsMobile from "@/hooks/useIsMobile";
import { Box, Button, CircularProgress, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import MessageIcon from "@/assets/Icons/MessageIcon.svg";
import Image from "next/image";
import {
    FooterIconButton,
    SearchIconButton,
    TextDecoration,
} from "./styled";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import HelpAndSupportData from "@/hooks/useHelpAndSupportData";
import SearchIcon from "@/assets/Icons/search-icon.svg";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";

interface KBArticle {
    article_id: number;
    title: string;
    slug: string;
    excerpt?: string;
    description?: string;
    category_name?: string;
    reading_time_minutes?: number;
}

const openSupportChat = () => {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dynopay:open-support-chat"));
    }
};

const HelpAndSupport = () => {
    const theme = useTheme();
    const isMobile = useIsMobile("md");
    const { t } = useTranslation("helpAndSupport");
    const [searchTerm, setSearchTerm] = useState("");
    const [articles, setArticles] = useState<KBArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);

    // Fetch articles from KB API, fallback to hardcoded data
    useEffect(() => {
        const fetchArticles = async () => {
            try {
                setLoading(true);
                const res = await axiosBaseApi.get(API_ENDPOINTS.kb.articles);
                const data = res?.data?.data;
                if (data?.articles && data.articles.length > 0) {
                    setArticles(data.articles.map((a: any) => ({
                        article_id: a.article_id,
                        title: a.title,
                        slug: a.slug,
                        excerpt: a.excerpt || a.description || "",
                        description: a.excerpt || a.description || "",
                        category_name: a.category_name || "",
                        reading_time_minutes: a.reading_time_minutes || 0,
                    })));
                } else {
                    // Fallback to hardcoded data
                    setArticles(HelpAndSupportData.map((item, i) => ({
                        article_id: i,
                        title: item.title,
                        slug: item.slug,
                        description: item.description,
                        excerpt: item.description,
                    })));
                }
            } catch {
                // Fallback to hardcoded data on error
                setArticles(HelpAndSupportData.map((item, i) => ({
                    article_id: i,
                    title: item.title,
                    slug: item.slug,
                    description: item.description,
                    excerpt: item.description,
                })));
            } finally {
                setLoading(false);
            }
        };
        fetchArticles();
    }, []);

    const handleSearch = useCallback(async () => {
        if (!searchTerm.trim()) {
            // Reset to all articles
            try {
                const res = await axiosBaseApi.get(API_ENDPOINTS.kb.articles);
                const data = res?.data?.data;
                if (data?.articles && data.articles.length > 0) {
                    setArticles(data.articles.map((a: any) => ({
                        article_id: a.article_id,
                        title: a.title,
                        slug: a.slug,
                        excerpt: a.excerpt || a.description || "",
                        description: a.excerpt || a.description || "",
                    })));
                } else {
                    // Fallback to hardcoded data when API returns empty
                    setArticles(HelpAndSupportData.map((item, i) => ({
                        article_id: i,
                        title: item.title,
                        slug: item.slug,
                        description: item.description,
                        excerpt: item.description,
                    })));
                }
            } catch {
                setArticles(HelpAndSupportData.map((item, i) => ({
                    article_id: i,
                    title: item.title,
                    slug: item.slug,
                    description: item.description,
                    excerpt: item.description,
                })));
            }
            return;
        }

        try {
            setSearching(true);
            const res = await axiosBaseApi.get(API_ENDPOINTS.kb.search(encodeURIComponent(searchTerm)));
            const data = res?.data?.data;
            if (data?.articles && data.articles.length > 0) {
                setArticles(data.articles.map((a: any) => ({
                    article_id: a.article_id,
                    title: a.title,
                    slug: a.slug,
                    excerpt: a.excerpt || a.description || "",
                    description: a.excerpt || a.description || "",
                })));
            } else {
                // Fallback to client-side filter when search API returns empty
                const filtered = HelpAndSupportData.filter(item =>
                    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.description.toLowerCase().includes(searchTerm.toLowerCase())
                );
                setArticles(filtered.map((item, i) => ({
                    article_id: i,
                    title: item.title,
                    slug: item.slug,
                    description: item.description,
                    excerpt: item.description,
                })));
            }
        } catch {
            // Fallback to client-side filter
            const filtered = HelpAndSupportData.filter(item =>
                item.title.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setArticles(filtered.map((item, i) => ({
                article_id: i,
                title: item.title,
                slug: item.slug,
                description: item.description,
                excerpt: item.description,
            })));
        } finally {
            setSearching(false);
        }
    }, [searchTerm]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                handleSearch();
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [handleSearch]);

    useEffect(() => {
        if (searchTerm === "") {
            handleSearch();
        }
    }, [searchTerm]);

    return (
        <Box
            sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "auto",
                width: "100%",
            }}
        >
            {/* ================= SEARCH ================= */}
            <Box
                sx={{
                    position: "sticky",
                    top: 0,
                    left: 0,
                    pb: "20px",
                    backgroundColor: theme.palette.secondary.main,
                    zIndex: 1,
                }}
            >
                <Box sx={{ display: "flex", gap: "8px", alignItems: "center", width: "100%", maxWidth: 640 }}>
                    <Box
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            "& input:focus": {
                                borderColor: theme.palette.primary.main,
                            },
                        }}
                    >
                        <input
                            type="text"
                            value={searchTerm}
                            data-testid="help-search-input"
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t("searchPlaceholder")}
                            style={{
                                height: isMobile ? "40px" : "44px",
                                width: "100%",
                                fontSize: isMobile ? "13px" : "14px",
                                fontFamily: "var(--font-sans)",
                                lineHeight: "100%",
                                letterSpacing: 0,
                                fontWeight: 500,
                                padding: "12px 14px",
                                border: `1px solid ${theme.palette.border?.main || theme.palette.divider}`,
                                backgroundColor: theme.palette.background.paper,
                                color: theme.palette.text.primary,
                                borderRadius: "10px",
                                outline: "none",
                                transition: "border-color 0.2s ease",
                                boxSizing: "border-box",
                            }}
                        />
                    </Box>
                    <SearchIconButton
                        onClick={handleSearch}
                        data-testid="help-search-button"
                        sx={{ borderRadius: "10px", height: isMobile ? 40 : 44, width: isMobile ? 40 : 44 }}
                    >
                        <Image src={SearchIcon} alt="search" width={20} height={20} className="themed-icon-primary" />
                    </SearchIconButton>
                </Box>
            </Box>

            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: "28px" }}>
                {/* ================= ARTICLES ================= */}
                {loading || searching ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                        <CircularProgress size={32} sx={{ color: brandFg(theme.palette.mode === "dark") }} />
                    </Box>
                ) : (
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                sm: "repeat(2, 1fr)",
                                lg: "repeat(3, 1fr)",
                            },
                            gap: "20px",
                            width: "100%",
                        }}
                        data-testid="help-articles-grid"
                    >
                        {articles.length === 0 ? (
                            <TextDecoration style={{ fontSize: "15px", color: theme.palette.text.secondary }}>
                                {t("noResults")}
                            </TextDecoration>
                        ) : (
                            articles.map((item, index) => (
                                <Link
                                    key={item.article_id || index}
                                    href={`/help-support/${item.slug}`}
                                    data-testid={`help-article-card-${index}`}
                                    style={{ textDecoration: "none", display: "block" }}
                                >
                                    <Box
                                        sx={{
                                            minHeight: 168,
                                            backgroundColor: theme.palette.background.paper,
                                            border: `1px solid ${theme.palette.divider}`,
                                            borderRadius: "16px",
                                            display: "flex",
                                            flexDirection: "column",
                                            justifyContent: "space-between",
                                            gap: "14px",
                                            padding: "22px",
                                            cursor: "pointer",
                                            transition: "border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
                                            "&:hover": {
                                                borderColor: theme.palette.primary.main,
                                                transform: "translateY(-2px)",
                                                boxShadow: `0 8px 24px ${theme.palette.mode === "dark" ? "rgba(0,0,0,0.4)" : "rgba(17,18,20,0.08)"}`,
                                            },
                                        }}
                                    >
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                            <TextDecoration style={{ fontSize: "17px", fontWeight: 600, color: theme.palette.text.primary, lineHeight: 1.3 }}>
                                                {item.title}
                                            </TextDecoration>
                                            <TextDecoration
                                                sx={{
                                                    fontSize: "14px",
                                                    color: theme.palette.text.secondary,
                                                    lineHeight: 1.5,
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: "vertical",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                {item.excerpt || item.description}
                                            </TextDecoration>
                                        </Box>

                                        <Box
                                            aria-hidden
                                            sx={{
                                                marginLeft: "auto",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                border: `1px solid ${theme.palette.divider}`,
                                                borderRadius: "8px",
                                                width: 36,
                                                height: 36,
                                            }}
                                        >
                                            <ArrowOutwardIcon
                                                sx={{ color: theme.palette.text.secondary, fontSize: 18 }}
                                            />
                                        </Box>
                                    </Box>
                                </Link>
                            ))
                        )}
                    </Box>
                )}

                {/* ================= NEED HELP ================= */}
                <TextDecoration sx={{ fontSize: "22px", fontWeight: 700, color: theme.palette.text.primary }}>
                    {t("needHelp")}
                </TextDecoration>

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                        gap: "20px",
                        width: "100%",
                        maxWidth: 720,
                    }}
                >
                    {/* Chat with us — opens the AI support widget (primary CTA) */}
                    <Box
                        data-testid="help-chat-cta"
                        onClick={openSupportChat}
                        sx={{
                            border: `1px solid ${theme.palette.primary.main}`,
                            p: "24px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "12px",
                            textAlign: "center",
                            backgroundColor: theme.palette.mode === "dark"
                                ? "rgba(99,102,241,0.08)"
                                : "rgba(99,102,241,0.04)",
                            borderRadius: "16px",
                            cursor: "pointer",
                            transition: "transform 0.18s ease, box-shadow 0.18s ease",
                            "&:hover": {
                                transform: "translateY(-2px)",
                                boxShadow: `0 8px 24px ${theme.palette.mode === "dark" ? "rgba(0,0,0,0.4)" : "rgba(79,70,229,0.16)"}`,
                            },
                        }}
                    >
                        <FooterIconButton
                            sx={{
                                height: 58,
                                width: 58,
                                borderColor: theme.palette.primary.main,
                                backgroundColor: theme.palette.primary.main,
                                pointerEvents: "none",
                            }}
                        >
                            <ChatBubbleOutlineRoundedIcon sx={{ color: "#fff", fontSize: 24 }} />
                        </FooterIconButton>
                        <TextDecoration sx={{ fontSize: "15px", fontWeight: 600, color: theme.palette.text.primary }}>
                            {t("chatUs")}
                        </TextDecoration>
                        <Button
                            variant="contained"
                            data-testid="help-open-chat-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                openSupportChat();
                            }}
                            sx={{
                                textTransform: "none",
                                borderRadius: "10px",
                                px: 3,
                                py: 1,
                                boxShadow: "none",
                                fontFamily: "var(--font-sans)",
                                fontWeight: 600,
                                fontSize: "13px",
                                backgroundColor: theme.palette.primary.main,
                                "&:hover": { backgroundColor: theme.palette.primary.dark || theme.palette.primary.main, boxShadow: "none" },
                            }}
                            endIcon={<ArrowOutwardIcon sx={{ fontSize: 15 }} />}
                        >
                            {t("openChat")}
                        </Button>
                        <TextDecoration sx={{ fontSize: "12px", color: theme.palette.text.secondary }}>
                            {t("chatResponseTime")}
                        </TextDecoration>
                    </Box>

                    {/* Email us */}
                    <Box
                        data-testid="help-email-card"
                        sx={{
                            border: `1px solid ${theme.palette.divider}`,
                            p: "24px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "12px",
                            textAlign: "center",
                            backgroundColor: theme.palette.background.paper,
                            borderRadius: "16px",
                        }}
                    >
                        <FooterIconButton
                            sx={{ height: 58, width: 58, borderColor: theme.palette.divider }}
                        >
                            <Image src={MessageIcon} alt="email" width={24} height={24} className="themed-icon-primary" />
                        </FooterIconButton>
                        <TextDecoration sx={{ fontSize: "15px", fontWeight: 600, color: theme.palette.text.primary }}>
                            {t("emailUs")}
                        </TextDecoration>
                        <TextDecoration sx={{ fontSize: "15px", color: theme.palette.text.primary }}>
                            <a
                                href="mailto:support@dynopay.com"
                                data-testid="help-email-link"
                                style={{ color: brandFg(theme.palette.mode === "dark"), textDecoration: "none", fontWeight: 600 }}
                            >
                                support@dynopay.com
                            </a>
                        </TextDecoration>
                        <TextDecoration sx={{ fontSize: "12px", color: theme.palette.text.secondary }}>
                            {t("emaiResponseTime")}
                        </TextDecoration>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default HelpAndSupport;
