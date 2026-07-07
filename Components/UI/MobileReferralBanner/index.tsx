import React, { useEffect, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { ContentCopyRounded, ShareRounded, CardGiftcardRounded } from "@mui/icons-material";
import axiosBaseApi from "@/axiosConfig";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";

const MobileReferralBanner: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation("referrals");
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralLink, setReferralLink] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axiosBaseApi
      .get("/referral/my-code")
      .then((res: any) => {
        const data = res?.data?.data;
        if (data?.referral_code) setReferralCode(data.referral_code);
        if (data?.referral_link) setReferralLink(data.referral_link);
      })
      .catch(() => {});
  }, []);

  if (!referralCode) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareData = {
      title: "Join Dynopay",
      text: "Accept crypto payments with Dynopay. Use my referral code for 50% off fees!",
      url: referralLink || `https://dynopay.com/signup?ref=${referralCode}`,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  return (
    <Box
      sx={{
        mx: 2,
        mb: 2,
        p: 2,
        borderRadius: "12px",
        border: `1px solid ${theme.palette.border.main}`,
        bgcolor: theme.palette.background.paper,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CardGiftcardRounded sx={{ fontSize: 18, color: theme.palette.primary.main }} />
          <Typography
            sx={{
              fontSize: "13px",
              fontFamily: "UrbanistSemiBold",
              fontWeight: 600,
              color: theme.palette.text.secondary,
            }}
          >
            {t("yourReferralCode")}
          </Typography>
        </Box>
        <Typography
          onClick={() => router.push("/referrals")}
          sx={{
            fontSize: "12px",
            fontFamily: "UrbanistMedium",
            color: theme.palette.primary.main,
            cursor: "pointer",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          View Rewards →
        </Typography>
      </Box>

      {/* Code + Actions */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            flex: 1,
            px: 1.5,
            py: 1,
            borderRadius: "8px",
            border: `1px dashed ${theme.palette.border.main}`,
            bgcolor: theme.palette.secondary.main,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            sx={{
              fontSize: "16px",
              fontFamily: "UrbanistSemiBold",
              fontWeight: 700,
              color: theme.palette.primary.main,
              letterSpacing: "1.5px",
            }}
          >
            {referralCode}
          </Typography>
        </Box>
        <Box
          onClick={handleCopy}
          sx={{
            width: 38,
            height: 38,
            borderRadius: "8px",
            border: `1px solid ${theme.palette.primary.main}`,
            bgcolor: copied ? theme.palette.primary.main : theme.palette.background.paper,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.2s",
          }}
        >
          <ContentCopyRounded sx={{ fontSize: 16, color: copied ? "#fff" : theme.palette.primary.main }} />
        </Box>
        <Box
          onClick={handleShare}
          sx={{
            width: 38,
            height: 38,
            borderRadius: "8px",
            bgcolor: theme.palette.primary.main,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ShareRounded sx={{ fontSize: 16, color: "#fff" }} />
        </Box>
      </Box>
    </Box>
  );
};

export default MobileReferralBanner;
