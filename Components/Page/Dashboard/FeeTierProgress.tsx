import { formatNumberWithComma, getCurrencySymbol } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { FeeTierProgressProps } from "@/utils/types/dashboard";
import { Box, Typography, useTheme } from "@mui/material";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const FeeTierProgress: React.FC<FeeTierProgressProps> = ({
  monthlyLimit = 50000,
  usedAmount = 0,
  compact = false,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const namespaces = ["dashboardLayout", "common"];
  const { t } = useTranslation(namespaces);
  const tDashboard = useCallback(
    (key: string) => t(key, { ns: "dashboardLayout" }),
    [t],
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    setIsDragging(true);
    startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !scrollContainerRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 2;
    scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
  }, []);

  const handleMouseUp = useCallback((e?: React.MouseEvent<HTMLDivElement>) => {
    if (e) {
      e.stopPropagation();
    }
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(
    (e?: React.MouseEvent<HTMLDivElement>) => {
      if (e) {
        e.stopPropagation();
      }
      isDraggingRef.current = false;
      setIsDragging(false);
    },
    [],
  );

  const daysInMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }, []);

  const percentage = useMemo(() => {
    if (monthlyLimit <= 0) return 0;
    return Number(((usedAmount / monthlyLimit) * 100).toFixed(1));
  }, [usedAmount, monthlyLimit]);

  const filledBars = useMemo(() => {
    return Math.round((percentage / 100) * daysInMonth);
  }, [percentage, daysInMonth]);

  const remainingAmount = useMemo(() => {
    return Math.max(0, monthlyLimit - usedAmount);
  }, [monthlyLimit, usedAmount]);

  const formattedRemaining = formatNumberWithComma(remainingAmount);

  return (
    <Box>
      <Box
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        sx={{
          width: "fit-content",
          display: "flex",
          justifyContent: "space-between",
          gap: isMobile ? "3.78px" : "6.19px",
          mb: isMobile ? "8px" : "14px",
          maxWidth: "100%",
          overflowX: "auto",
          overflowY: "hidden",
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none",
          willChange: isDragging ? "scroll-position" : "auto",
          "& *": {
            userSelect: "none",
            WebkitUserDrag: "none",
          },
          "&::-webkit-scrollbar": {
            height: 0,
          },
          "&::-webkit-scrollbar-track": {
            display: "none",
            borderRadius: "3px",
          },
          "&::-webkit-scrollbar-thumb": {
            display: "none",
            "&:hover": {
              display: "none",
            },
          },
          scrollbarWidth: "none",
        }}
      >
        {/* Filled bars */}
        {Array.from({ length: filledBars }).map((_, i) => (
          <Box
            key={`filled-${i}`}
            sx={{
              width: { xs: "8px", md: "10px" },
              maxWidth: { xs: "8px", md: "10px" },
              minWidth: { xs: "8px", md: "10px" },
              flex: { xs: "0 0 8px", md: 1 },
              height: compact ? "120px" : "205px",
              maxHeight: { xs: compact ? "50px" : "85px", md: compact ? "120px" : "205px" },
              minHeight: { xs: compact ? "50px" : "85px", md: compact ? "120px" : "205px" },
              background: theme.palette.primary.main,
              borderRadius: "20px",
              flexShrink: 0,
              transition: "min-height 200ms ease, max-height 200ms ease",
            }}
          />
        ))}
        {/* Remaining bars */}
        {Array.from({ length: daysInMonth - filledBars }).map((_, i) => (
          <Box
            key={`remaining-${i}`}
            sx={{
              width: { xs: "8px", md: "10px" },
              maxWidth: { xs: "8px", md: "10px" },
              minWidth: { xs: "8px", md: "10px" },
              flex: { xs: "0 0 8px", md: 1 },
              height: compact ? "120px" : "205px",
              maxHeight: { xs: compact ? "50px" : "85px", md: compact ? "120px" : "205px" },
              minHeight: { xs: compact ? "50px" : "85px", md: compact ? "120px" : "205px" },
              background: theme.palette.primary.light,
              borderRadius: "20px",
              flexShrink: 0,
              transition: "min-height 200ms ease, max-height 200ms ease",
            }}
          />
        ))}
      </Box>

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography
          sx={{
            fontSize: isMobile ? "10px" : "13px",
            fontWeight: 500,
            color: theme.palette.primary.main,
            fontFamily: "var(--font-sans)",
            lineHeight: isMobile ? "12px" : "16px",
            letterSpacing: 0,
          }}
        >
          {percentage.toFixed(1)}% {tDashboard("complete")}
        </Typography>
        <Typography
          sx={{
            fontSize: isMobile ? "10px" : "13px",
            fontWeight: 500,
            color: theme.palette.text.secondary,
            fontFamily: "var(--font-sans)",
            lineHeight: isMobile ? "12px" : "16px",
            letterSpacing: 0,
          }}
        >
          {getCurrencySymbol("USD", formattedRemaining)}{" "}
          {tDashboard("toNextTier")}
        </Typography>
      </Box>
    </Box>
  );
};

export default FeeTierProgress;
