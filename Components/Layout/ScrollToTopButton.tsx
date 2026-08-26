import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { Box, IconButton, useTheme } from "@mui/material";
import { memo, useCallback, useEffect, useState } from "react";

import useIsMobile from "@/hooks/useIsMobile";

const SCROLL_THRESHOLD = 300;

const ScrollToTopButton = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");

  const [isVisible, setIsVisible] = useState(false);

  const handleScroll = useCallback(() => {
    const shouldShow = window.scrollY > SCROLL_THRESHOLD;
    setIsVisible((prev) => (prev !== shouldShow ? shouldShow : prev));
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  if (!isVisible) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        // Sit ABOVE the support-chat FAB (bottom-right, ~56px) instead of on
        // top of it — otherwise this button swallows clicks meant for the chat
        // FAB once the page is scrolled. On mobile also clear the language bar.
        bottom: isMobile ? "calc(var(--dp-lang-bar, 0px) + 88px)" : 96,
        right: isMobile ? 16 : 24,
        zIndex: (theme) => theme.zIndex.tooltip + 1,
        transition: "opacity 0.3s ease, transform 0.3s ease",
      }}
    >
      <IconButton
        onClick={scrollToTop}
        aria-label="Scroll to top"
        sx={{
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.common.white,
          width: 40,
          height: 40,
          borderRadius: "12px",
          transition: "all 0.3s ease-in-out",
          "&:hover": {
            backgroundColor: theme.palette.primary.light,
            transform: "translateY(-4px)",
          },
        }}
      >
        <KeyboardArrowUpIcon sx={{ fontSize: isMobile ? 24 : 28 }} />
      </IconButton>
    </Box>
  );
};

export default memo(ScrollToTopButton);
