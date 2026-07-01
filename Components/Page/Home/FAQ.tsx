import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Box, Collapse, Typography, useTheme } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";
import HomeSectionTitle from "@/Components/UI/SectionTitle";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

const faqs = [
  {
    question: "What cryptocurrencies does DynoPay support?",
    answer:
      "DynoPay supports 15+ cryptocurrencies including Bitcoin (BTC), Ethereum (ETH), Solana (SOL), XRP, Litecoin (LTC), Dogecoin (DOGE), TRON (TRX), and stablecoins like USDT and USDC across multiple chains (ERC-20, TRC-20, Polygon). We're constantly adding new tokens and chains.",
  },
  {
    question: "How does auto-conversion to stablecoins work?",
    answer:
      "Auto-conversion is optional — you decide. If you switch it on for a wallet, then when a customer pays in a volatile cryptocurrency like BTC or ETH, DynoPay converts it to USDT or USDC within seconds, protecting that payment from market swings. Prefer to keep the original coin? Just leave auto-conversion off and you'll receive exactly what the customer sent.",
  },
  {
    question: "What are the fees?",
    answer:
      "DynoPay charges a flat 1.5% transaction fee — significantly lower than traditional processors like PayPal (2.9% + $0.30) or Stripe (2.9% + $0.30). Plus, your first $500 in volume is completely fee-free so you can try us risk-free.",
  },
  {
    question: "How long does settlement take?",
    answer:
      "Settlement happens in near real-time. Once a blockchain payment is confirmed (typically 1-3 minutes depending on the network), your settlement is processed automatically — in the original crypto, or in stablecoins if you've enabled auto-conversion. Most merchants see funds in their wallet within 5 minutes.",
  },
  {
    question: "Do I need technical knowledge to get started?",
    answer:
      "Not at all. You can create payment links with zero coding in under 30 seconds — just set the amount, share the link, and start receiving payments. For developers who want deeper integration, we also offer a full REST API with comprehensive documentation.",
  },
  {
    question: "Is KYC verification required?",
    answer:
      "You can start accepting payments immediately with no KYC required. Identity verification is only needed once your total processed volume exceeds $10,000, and we provide a 90-day grace period to complete it. The process is quick and handled via our secure partner Veriff.",
  },
];

const FAQItem: React.FC<{
  item: (typeof faqs)[0];
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
        border: `1px solid ${
          isOpen
            ? isDark
              ? "rgba(106,123,255,0.3)"
              : "rgba(0,4,255,0.15)"
            : isDark
            ? "#2A2D42"
            : "#E7E8EF"
        }`,
        bgcolor: isOpen
          ? isDark
            ? "rgba(106,123,255,0.04)"
            : "rgba(0,4,255,0.02)"
          : isDark
          ? "#141625"
          : "#FFFFFF",
        overflow: "hidden",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: isVisible ? "translateY(0)" : "translateY(20px)",
        opacity: isVisible ? 1 : 0,
        transitionDelay: `${idx * 80}ms`,
        "&:hover": {
          borderColor: isDark ? "rgba(106,123,255,0.25)" : "rgba(0,4,255,0.12)",
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
            fontFamily: "OutfitMedium",
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
              fontFamily: "OutfitRegular",
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
        badgeText="FAQ"
        title="Frequently asked questions"
        highlightText="questions"
        subtitle="Everything you need to know about accepting crypto payments with DynoPay."
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
