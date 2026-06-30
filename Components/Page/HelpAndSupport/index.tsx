import useIsMobile from "@/hooks/useIsMobile";
import { Box, Button, CircularProgress, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import MessageIcon from "@/assets/Icons/MessageIcon.svg";
import Image from "next/image";
import {
    FooterCard,
    FooterIconButton,
    SearchIconButton,
    TextDecoration,
} from "./styled";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import { theme as staticTheme } from "@/styles/theme";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import HelpAndSupportData from "@/hooks/useHelpAndSupportData";
import SearchIcon from "@/assets/Icons/search-icon.svg";
import axiosBaseApi from "@/axiosConfig";

interface KBArticle {
    article_id: number;
    title: string;
    slug: string;
    excerpt?: string;
    description?: string;
    category_name?: string;
    reading_time_minutes?: number;
}

const HelpAndSupport = () => {
    const theme = useTheme();
    const isMobile = useIsMobile("md");
    const { t } = useTranslation("helpAndSupport");
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [articles, setArticles] = useState<KBArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);

    // Fetch articles from KB API, fallback to hardcoded data
    useEffect(() => {
        const fetchArticles = async () => {
            try {
                setLoading(true);
                const res = await axiosBaseApi.get("/kb/articles?limit=20");
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
                const res = await axiosBaseApi.get("/kb/articles?limit=20");
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
            const res = await axiosBaseApi.get(`/kb/search?q=${encodeURIComponent(searchTerm)}&limit=20`);
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

    const footerData = [
        {
            contectType: t("emailUs"),
            contectDetail: "support@dynopay.com",
            buttonContent: "",
            icon: MessageIcon,
            responseTime: t("emaiResponseTime"),
        },
    ];

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
                overflow: "auto"
            }}
        >
            <Box sx={{ position: "sticky", top: 0, left: 0, pb: "20px", backgroundColor: theme.palette.secondary.main, zIndex: 1 }}>
                <Box sx={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <Box
                        sx={{
                            "& input:focus": {
                                borderColor: "#0004FF",
                            },
                        }}>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t("searchPlaceholder")}
                            style={{
                                height: isMobile ? "32px" : "40px",
                                width: isMobile ? "300px" : "639px",
                                fontSize: isMobile ? "10px" : "13px",
                                fontFamily: "UrbanistMedium",
                                lineHeight: "100%",
                                letterSpacing: 0,
                                fontWeight: 500,
                                padding: "12px 13.5px",
                                border: `1px solid ${theme.palette.border.main}`,
                                backgroundColor: theme.palette.background.paper,
                                color: theme.palette.text.primary,
                                borderRadius: "6px",
                                outline: "none",
                                transition: "0.2s",
                            }}
                        />
                    </Box>
                    <SearchIconButton onClick={handleSearch}>
                        <Image src={SearchIcon} alt="search" width={20} height={20} className="themed-icon-primary" />
                    </SearchIconButton>
                </Box>
            </Box>

            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px", }}>
                {loading || searching ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                        <CircularProgress size={32} />
                    </Box>
                ) : (
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            width: "100%",
                            gap: "24px",
                            justifyContent: "flex-start",
                        }}
                    >
                        {articles.length === 0 ? (
                            <TextDecoration style={{ fontSize: "15px", color: theme.palette.text.secondary }}>
                                {t("noResults") || "No articles found. Try a different search term."}
                            </TextDecoration>
                        ) : (
                            articles.map((item, index) => (
                                <Box
                                    key={item.article_id || index}
                                    sx={{
                                        width: isMobile ? "330px" : "355px",
                                        height: isMobile ? "160px" : "202px",
                                        backgroundColor: theme.palette.background.paper,
                                    border: `1px solid ${theme.palette.divider}`,
                                        borderRadius: "14px",
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "space-between",
                                        padding: "20px",
                                        cursor: "pointer",
                                        transition: "box-shadow 0.2s",
                                        "&:hover": {
                                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                        },
                                    }}
                                    onClick={() => router.push(`/help-support/${item.slug}`)}
                                >
                                    <TextDecoration style={{ fontSize: isMobile ? "15px" : "20px", color: theme.palette.text.primary }}>
                                        {item.title}
                                    </TextDecoration>
                                    <TextDecoration style={{ fontSize: isMobile ? "13px" : "15px", color: theme.palette.text.secondary }}>
                                        {item.excerpt || item.description}
                                    </TextDecoration>

                                    <SearchIconButton
                                        style={{
                                            marginLeft: "auto",
                                            borderColor: theme.palette.text.secondary,
                                        }}
                                        onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            router.push(`/help-support/${item.slug}`);
                                        }}
                                    >
                                        <ArrowOutwardIcon
                                            sx={{ color: theme.palette.text.secondary, fontSize: 18.5 }}
                                        />
                                    </SearchIconButton>
                                </Box>
                            ))
                        )}
                    </Box>
                )}

                <TextDecoration sx={{ fontSize: "24px", color: theme.palette.text.primary }}>{t("needHelp")}</TextDecoration>

                <Box
                    sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        p: "20px",
                        display: "flex",
                        flexDirection: isMobile ? "column" : "row",
                        gap: isMobile ? "40px" : "",
                        backgroundColor: theme.palette.background.paper,
                        borderRadius: "14px",
                    }}
                >
                    {footerData.map((item) => (
                        <FooterCard key={item.contectType}>
                            <Box>
                                <FooterIconButton
                                    style={{
                                        height: "58px",
                                        width: "58px",
                                        marginLeft: "auto",
                                        borderColor: "#D7D7D7",
                                    }}
                                >
                                    <Image src={item.icon} alt="search" width={24} height={24} className="themed-icon-primary" />
                                </FooterIconButton>
                            </Box>
                            <TextDecoration style={{ fontSize: isMobile ? "10px" :"13px" }}>
                                {item.contectType}
                            </TextDecoration>
                            {item.buttonContent ? (
                                <Button
                                    sx={{
                                        border: "1px solid #0004FF",
                                        borderRadius: "6px",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        gap: "6px",
                                        padding: isMobile ? "8px 16px" : "10px 25px",
                                        color: "#0004FF",
                                    }}
                                >
                                    <TextDecoration style={{ fontSize: isMobile ? "10px" :"13px" }}>
                                        {item.buttonContent}
                                    </TextDecoration>
                                    <ArrowOutwardIcon sx={{ color: "#0004FF", fontSize: 15 }} />
                                </Button>
                            ) : (
                                <TextDecoration style={{ fontSize: isMobile ? "14px" :"18px", color: theme.palette.text.primary }}>
                                    <a
                                        href={`mailto:${item.contectDetail}`}
                                        style={{
                                            color: theme.palette.primary.main,
                                            textDecoration: "none",
                                        }}
                                    >
                                        {item.contectDetail}
                                    </a>
                                </TextDecoration>
                            )}
                            <TextDecoration style={{ fontSize: isMobile ? "10px" :"12px" }}>
                                {item.responseTime}
                            </TextDecoration>
                        </FooterCard>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default HelpAndSupport;
