import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Box, Collapse, Typography, useTheme } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";
import HomeSectionTitle from "@/Components/UI/SectionTitle";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { useTranslation } from "react-i18next";

// Translation key pairs; resolved to text inside the component via t().
const FAQ_KEYS: { qKey: string; aKey: string }[] = [
  { qKey: "faq1Q", aKey: "faq1A" },
  { qKey: "faq2Q", aKey: "faq2A" },
  { qKey: "faq3Q", aKey: "faq3A" },
  { qKey: "faq4Q", aKey: "faq4A" },
  { qKey: "faq5Q", aKey: "faq5A" },
  { qKey: "faq6Q", aKey: "faq6A" },
];

interface FaqEntry {
  question: string;
  answer: string;
}

const FAQItem: React.FC<{
  item: FaqEntry;
  isOpen: boolean;
  onToggle: () => void;
  idx: number;
  isVisible: boolean;
}> = ({ item, isOpen, onToggle, idx, isVisible }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        borderRadius: "16px",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${
          isOpen
            ? isDark
              ? "rgba(204,255,0,0.35)"
              : "rgba(10,10,10,0.25)"
            : isDark
            ? "rgba(255,255,255,0.12)"
            : "rgba(10,10,10,0.10)"
        }`,
        bgcolor: isOpen
          ? isDark
            ? "rgba(204,255,0,0.06)"
            : "rgba(10,10,10,0.03)"
          : isDark
          ? "rgba(255,255,255,0.045)"
          : "rgba(255,255,255,0.72)",
        overflow: "hidden",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: isVisible ? "translateY(0)" : "translateY(20px)",
        opacity: isVisible ? 1 : 0,
        transitionDelay: `${idx * 80}ms`,
        "&:hover": {
          borderColor: isDark ? "rgba(204,255,0,0.28)" : "rgba(10,10,10,0.2)",
        },
      }}
    >
      <Box
        onClick={onToggle}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 3,
          cursor: "pointer",
          userSelect: "none",
          gap: 2,
        }}
      >
        <Typography
          sx={{
            fontSize: "16px",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            color: theme.palette.text.primary,
            lineHeight: 1.4,
          }}
        >
          {item.question}
        </Typography>
        <Box
          sx={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
            transition: "all 0.3s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          {isOpen ? (
            <RemoveIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
          ) : (
            <AddIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
          )}
        </Box>
      </Box>
      <Collapse in={isOpen}>
        <Box sx={{ px: 3, pb: 3, pt: 0 }}>
          <Typography
            sx={{
              fontSize: "14px",
              fontFamily: "var(--font-sans)",
              color: theme.palette.text.secondary,
              lineHeight: 1.7,
            }}
          >
            {item.answer}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
};

const FAQ: React.FC = () => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("landing");
  const faqs: FaqEntry[] = FAQ_KEYS.map((k) => ({
    question: t(k.qKey),
    answer: t(k.aKey),
  }));
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleToggle = useCallback(
    (idx: number) => {
      setOpenIndex((prev) => (prev === idx ? null : idx));
    },
    []
  );

  return (
    <section
      ref={sectionRef}
      style={{
        padding: isMobile ? "80px 16px" : "140px 32px",
        maxWidth: 800,
        margin: "0 auto",
      }}
    >
      <HomeSectionTitle
        type="small"
        badgeText={t("faqBadge")}
        title={t("faqTitle")}
        highlightText={t("faqHighlight")}
        subtitle={t("faqSubtitle")}
        sx={{ maxWidth: "100%" }}
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          mt: isMobile ? 5 : 7,
        }}
      >
        {faqs.map((faq, idx) => (
          <FAQItem
            key={faq.question}
            item={faq}
            isOpen={openIndex === idx}
            onToggle={() => handleToggle(idx)}
            idx={idx}
            isVisible={isVisible}
          />
        ))}
      </Box>
    </section>
  );
};

export default memo(FAQ);
