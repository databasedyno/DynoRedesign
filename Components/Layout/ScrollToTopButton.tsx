import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { Box, IconButton, useTheme } from "@mui/material";
import { memo, useCallback, useEffect, useState } from "react";

import useIsMobile from "@/hooks/useIsMobile";
import { useTranslation } from "react-i18next";

const SCROLL_THRESHOLD = 300;

const ScrollToTopButton = () => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const isMobile = useIsMobile("md");

  const [isVisible, setIsVisible] = useState(false);
  // S4.2: on mobile, step aside while the support-chat panel is open so this
  // button never sits on the panel's send-button row.
  const [chatOpen, setChatOpen] = useState(false);

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

  // S4.2: track the support-chat panel open state (broadcast by SupportChatWidget).
  useEffect(() => {
    const read = () =>
      setChatOpen(
        typeof document !== "undefined" &&
          document.body.hasAttribute("data-dp-support-chat-open")
      );
    read();
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.open === "boolean") setChatOpen(detail.open);
      else read();
    };
    window.addEventListener("dynopay:support-chat-toggle", onToggle);
    return () => window.removeEventListener("dynopay:support-chat-toggle", onToggle);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  if (!isVisible || (isMobile && chatOpen)) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        // Sit ABOVE the support-chat FAB (bottom-right, ~56px) instead of on
        // top of it — otherwise this button swallows clicks meant for the chat
        // FAB once the page is scrolled. Clear the language bar on both mobile
        // and desktop so it stays above the lifted FAB when the bar is visible.
        bottom: isMobile
          ? "calc(var(--dp-lang-bar, 0px) + var(--dp-sticky-cta, 0px) + 88px)"
          : "calc(var(--dp-lang-bar, 0px) + 96px)",
        right: isMobile ? 16 : 24,
        zIndex: (theme) => theme.zIndex.tooltip + 1,
        transition: "opacity 0.3s ease, transform 0.3s ease",
      }}
    >
      <IconButton
        onClick={scrollToTop}
        aria-label={t("scrollToTop")}
        data-testid="scroll-to-top-button"
        sx={{
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.common.white,
          width: 40,
          height: 40,
          borderRadius: "12px",
          transition: "background-color 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)",
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
