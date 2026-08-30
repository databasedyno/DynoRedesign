import React, { memo, useEffect, useMemo, useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import copyToClipboard from "@/helpers/copyToClipboard";
import { useApiSWR } from "@/hooks/useApiSWR";
import { API_ENDPOINTS } from "@/api/endpoints";
import { FONT_BODY, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import { Eyebrow } from "@/Components/Page/Home/v3/styled.v3";

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: "ri:whatsapp-fill", bg: "#25D366" },
  { key: "telegram", label: "Telegram", icon: "ri:telegram-fill", bg: "#229ED9" },
  { key: "x", label: "X", icon: "ri:twitter-x-fill", bg: "#0F0F0F" },
] as const;

/**
 * Public "share the program" band for /referral-program. Visitors share the
 * program page itself; a logged-in user (token present) shares THEIR referral
 * link instead (fetched lazily from /referral/my-code).
 */
const ShareProgramV3 = () => {
  const { t } = useTranslation("referrals");
  const s = useAurora();
  const [loggedIn, setLoggedIn] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLoggedIn(!!localStorage.getItem("token"));
    setOrigin(window.location.origin);
  }, []);

  const { data } = useApiSWR<{ referral_link?: string }>(API_ENDPOINTS.referral.myCode, {
    enabled: loggedIn,
    unwrap: true,
  });

  const programUrl = origin ? `${origin}/referral-program` : "/referral-program";
  const link = data?.referral_link || programUrl;
  const msg = t("public.shareMsg");

  const urls = useMemo(
    () => ({
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${msg} ${link}`)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(msg)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(link)}`,
    }),
    [msg, link]
  );

  const handleCopy = async () => {
    await copyToClipboard(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Box data-testid="referral-share-program" sx={{ py: { xs: 9, md: 12 } }}>
      <Box sx={{ maxWidth: 720, mx: "auto", px: 3, textAlign: "center" }}>
        <Eyebrow tone="indigo" sx={{ mb: 2, justifyContent: "center" }}>
          {t("public.shareEyebrow")}
        </Eyebrow>
        <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 24, md: 30 }, fontWeight: 700, color: s.ink, mb: 1.5 }}>
          {t("public.shareTitle")}
        </Typography>
        <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 15, md: 16 }, color: s.ink3, mb: 4, maxWidth: 560, mx: "auto" }}>
          {t("public.shareBody")}
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 1.5 }}>
          {CHANNELS.map((c) => (
            <Button
              key={c.key}
              data-testid={`referral-share-${c.key}`}
              component="a"
              href={urls[c.key]}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<Icon name={c.icon} size={20} color="#FFFFFF" />}
              sx={{
                borderRadius: "999px",
                px: 3,
                py: 1.3,
                textTransform: "none",
                fontFamily: FONT_BODY,
                fontSize: 15,
                fontWeight: 600,
                color: "#FFFFFF",
                background: c.bg,
                "&:hover": { background: c.bg, filter: "brightness(0.94)" },
              }}
            >
              {c.label}
            </Button>
          ))}
          <Button
            data-testid="referral-share-copy"
            onClick={handleCopy}
            startIcon={<Icon name={copied ? "check" : "copy"} size={18} color={s.ink} />}
            sx={{
              borderRadius: "999px",
              px: 3,
              py: 1.3,
              textTransform: "none",
              fontFamily: FONT_BODY,
              fontSize: 15,
              fontWeight: 600,
              color: s.ink,
              border: `1px solid ${s.lineStrong}`,
              "&:hover": { background: s.bgAlt },
            }}
          >
            {copied ? t("public.shareCopied") : t("public.shareCopy")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(ShareProgramV3);
