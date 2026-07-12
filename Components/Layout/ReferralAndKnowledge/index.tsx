import CopyIcon from "@/assets/Icons/copy-icon.svg";
import Help_Support from "@/assets/Icons/Help&Support.svg";
import BGOverlay from "@/assets/Images/bg-overlay.png";
import {
  CopyButton,
  HelpSupportBtn,
  KnowledgeBaseTitle,
  ReferralCard,
  ReferralCardContent,
  ReferralCardContentValue,
  ReferralCardContentValueContainer,
  ReferralCardTitle,
  SidebarFooter,
} from "@/Components/Layout/NewSidebar/styled";
import Toast from "@/Components/UI/Toast";
import { Box, Tooltip, useTheme } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";

// Inline SVG brand icons (WhatsApp / Telegram / X) so we do not add extra font/asset weight.
// Colored via `currentColor` — respects theme text color.
const WhatsAppIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.5 14.4c-.3-.15-1.8-.9-2.1-1s-.5-.15-.7.15-.8 1-.95 1.2-.35.2-.65.05a8.6 8.6 0 0 1-2.55-1.55 9.7 9.7 0 0 1-1.8-2.2c-.2-.35 0-.5.15-.65s.35-.4.5-.6.2-.35.3-.55.05-.4-.05-.55-.7-1.65-.95-2.25c-.25-.6-.5-.5-.7-.5h-.6a1.15 1.15 0 0 0-.85.4A3.5 3.5 0 0 0 5.55 8.7a6.05 6.05 0 0 0 1.3 3.25 13.9 13.9 0 0 0 5.4 4.7c.75.3 1.35.5 1.8.65a4.35 4.35 0 0 0 2 .1 3.25 3.25 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.15-.3-.25-.6-.4Zm-5.5 7.35a9.7 9.7 0 0 1-4.95-1.35l-.35-.2-3.65.95 1-3.55-.25-.35a9.7 9.7 0 1 1 17.85-5.4 9.7 9.7 0 0 1-9.65 9.9ZM20.5 3.4a11.75 11.75 0 0 0-18.5 14.15L0 24l6.65-1.75a11.75 11.75 0 0 0 5.35 1.35A11.75 11.75 0 0 0 23.75 11.9a11.6 11.6 0 0 0-3.25-8.5Z" />
  </svg>
);
const TelegramIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9.4 15.9 9 21c.6 0 .85-.25 1.15-.55l2.75-2.6 5.7 4.15c1.05.6 1.8.3 2.05-.95L23.85 3.5c.35-1.6-.55-2.25-1.55-1.85L1.15 9.9C-.4 10.5-.35 11.4.85 11.75l5.5 1.7L18.8 5.6c.6-.4 1.15-.2.7.25Z" />
  </svg>
);
const XIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117Z" />
  </svg>
);

const ShareIconButton = ({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) => {
  const theme = useTheme();
  return (
    <Tooltip title={title} placement="top" arrow>
      <button
        type="button"
        aria-label={title}
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          padding: 0,
          borderRadius: 8,
          border: `1px solid ${theme.palette.border.main}`,
          background: theme.palette.background.paper,
          color: theme.palette.primary.main,
          cursor: "pointer",
          transition: "all 0.15s ease",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            theme.palette.primary.light;
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            theme.palette.primary.main;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            theme.palette.background.paper;
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            theme.palette.border.main;
        }}
      >
        {children}
      </button>
    </Tooltip>
  );
};

const ReferralAndKnowledge = ({ isMobile }: { isMobile: boolean }) => {
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  const { t: tRef } = useTranslation("referrals");
  const tCommon = useCallback((key: string) => t(key, { ns: "common" }), [t]);
  const [openToast, setOpenToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [referralCode, setReferralCode] = useState("DYNO2024XYZ");
  const [referralLink, setReferralLink] = useState<string>("");

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;
    axiosBaseApi
      .get("/referral/my-code")
      .then((res) => {
        const code = res?.data?.data?.referral_code;
        const link = res?.data?.data?.referral_link;
        if (code) setReferralCode(code);
        if (link) setReferralLink(link);
      })
      .catch(() => {});
  }, []);

  const shareLink = useMemo(
    () =>
      referralLink ||
      `https://dynopay.com/signup?ref=${referralCode}`,
    [referralLink, referralCode]
  );

  const shareText = useMemo(
    () => `${tRef("shareMessage")}${shareLink}`,
    [tRef, shareLink]
  );

  const openInPopup = useCallback((url: string) => {
    if (typeof window === "undefined") return;
    // Popup opens the platform's native share sheet on mobile (via the deep-link)
    // and a share dialog on desktop.
    window.open(url, "_blank", "noopener,noreferrer,width=640,height=640");
  }, []);

  const handleShareWhatsApp = useCallback(() => {
    openInPopup(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
  }, [openInPopup, shareText]);

  const handleShareTelegram = useCallback(() => {
    openInPopup(
      `https://t.me/share/url?url=${encodeURIComponent(
        shareLink
      )}&text=${encodeURIComponent(tRef("shareMessage").trim())}`
    );
  }, [openInPopup, shareLink, tRef]);

  const handleShareX = useCallback(() => {
    openInPopup(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(
        shareLink
      )}&text=${encodeURIComponent(tRef("shareMessage").trim())}`
    );
  }, [openInPopup, shareLink, tRef]);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setOpenToast(false);

    setTimeout(() => {
      setOpenToast(true);
    }, 0);

    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    toastTimer.current = setTimeout(() => {
      setOpenToast(false);
    }, 2000);
  };

  return (
    <SidebarFooter>
      <ReferralCard>
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          {/* F22: The BG overlay is a light logo watermark PNG. On dark sidebar
              backgrounds it reads as a rendering glitch. We dim + screen-blend
              it into a subtle texture. The opacity is applied DIRECTLY to the
              <img> (not just the wrapper) so it holds regardless of how the
              element is inspected/measured. */}
          <Image
            src={BGOverlay}
            alt=""
            width={82}
            height={100}
            draggable={false}
            style={{
              opacity: isDark ? 0.18 : 0.55,
              mixBlendMode: isDark ? "screen" : "normal",
            }}
          />
        </Box>
        <ReferralCardContent>
          <ReferralCardTitle>{t("yourReferralCode")}</ReferralCardTitle>

          <ReferralCardContentValueContainer>
            <ReferralCardContentValue>{referralCode}</ReferralCardContentValue>
            <CopyButton onClick={handleCopy} aria-label={tRef("copyCode")}>
              <Image
                src={CopyIcon}
                alt="Copy Icon"
                width={isMobile ? 12 : 14}
                height={isMobile ? 12 : 14}
                draggable={false}
              />
            </CopyButton>
          </ReferralCardContentValueContainer>

          {/* One-tap native-language share row */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              justifyContent: "flex-start",
              mt: isMobile ? 0.5 : 0.75,
            }}
            data-testid="referral-share-row"
          >
            <ShareIconButton
              onClick={handleShareWhatsApp}
              title={tRef("shareOnWhatsApp")}
            >
              <WhatsAppIcon size={isMobile ? 13 : 15} />
            </ShareIconButton>
            <ShareIconButton
              onClick={handleShareTelegram}
              title={tRef("shareOnTelegram")}
            >
              <TelegramIcon size={isMobile ? 13 : 15} />
            </ShareIconButton>
            <ShareIconButton onClick={handleShareX} title={tRef("shareOnX")}>
              <XIcon size={isMobile ? 12 : 14} />
            </ShareIconButton>
          </Box>
        </ReferralCardContent>
      </ReferralCard>

      <HelpSupportBtn onClick={() => router.push("/help-support")}>
        <Image
          src={Help_Support}
          alt="File Icon"
          width={isMobile ? 14 : 18}
          height={isMobile ? 14 : 18}
          draggable={false}
        />
        <KnowledgeBaseTitle>{t("helpSupport")}</KnowledgeBaseTitle>
      </HelpSupportBtn>
      <Toast
        open={openToast}
        message={tCommon("copiedToClipboard")}
        severity="success"
      />
    </SidebarFooter>
  );
};

export default ReferralAndKnowledge;
