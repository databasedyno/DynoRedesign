import CustomButton from "@/Components/UI/Buttons";
import useIsMobile from "@/hooks/useIsMobile";
import {
  ArrowOutward,
  PlayCircleFilledRounded,
  RocketLaunchRounded,
} from "@mui/icons-material";
import { Box, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";

/**
 * EmptyStatePanel — shown INSTEAD of HeroMetrics when the merchant has
 * completed setup (has a company + at least one wallet) but hasn't seen
 * a single confirmed payment yet. Turns the top-of-dashboard into a
 * guide toward the first AHA moment ("first payment received") instead
 * of a wall of zeroes.
 */

export interface EmptyStatePanelProps {
  hasCompany?: boolean;
  hasWallet?: boolean;
  onCreateLink?: () => void;
}

const EmptyStatePanel: React.FC<EmptyStatePanelProps> = ({
  hasCompany = false,
  hasWallet = false,
  onCreateLink,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const router = useRouter();

  const ready = hasCompany && hasWallet;

  return (
    <Box
      data-testid="dashboard-empty-state"
      sx={{
        mx: { xs: 2, md: 0 },
        mb: { xs: 2, md: 2.5 },
        p: isMobile ? 3 : 4,
        borderRadius: "20px",
        border: `1px solid ${theme.palette.primary.main}33`,
        background: `linear-gradient(135deg, ${theme.palette.primary.main}0f 0%, ${theme.palette.primary.main}03 100%)`,
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: isMobile ? 2.5 : 4,
        alignItems: { xs: "flex-start", md: "center" },
      }}
    >
      <Box
        sx={{
          width: isMobile ? 56 : 72,
          height: isMobile ? 56 : 72,
          borderRadius: isMobile ? "18px" : "22px",
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark || theme.palette.primary.main} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          boxShadow: `0 12px 32px ${theme.palette.primary.main}40`,
          flexShrink: 0,
        }}
      >
        <RocketLaunchRounded sx={{ fontSize: isMobile ? 28 : 36 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: "UrbanistBold",
            fontWeight: 700,
            fontSize: isMobile ? "20px" : "26px",
            color: theme.palette.text.primary,
            lineHeight: 1.2,
            mb: 1,
          }}
        >
          {ready ? "Waiting for your first payment" : "You're almost there"}
        </Typography>
        <Typography
          sx={{
            fontFamily: "UrbanistMedium",
            fontSize: isMobile ? "13.5px" : "15px",
            color: theme.palette.text.secondary,
            lineHeight: 1.55,
            mb: 2,
          }}
        >
          {ready
            ? "Create your first payment link, share it with a customer, and your dashboard will light up the moment their crypto lands on-chain."
            : "Finish setting up your account to start accepting crypto payments. It takes less than 2 minutes."}
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          {ready ? (
            <>
              <CustomButton
                data-testid="empty-state-create-link"
                label="Create payment link"
                variant="primary"
                size={isMobile ? "small" : "medium"}
                endIcon={<ArrowOutward sx={{ fontSize: 16 }} />}
                onClick={onCreateLink || (() => router.push("/create-pay-link"))}
              />
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  color: theme.palette.text.secondary,
                  fontSize: "13px",
                  fontFamily: "UrbanistMedium",
                  cursor: "pointer",
                  "&:hover": { color: theme.palette.primary.main },
                }}
                onClick={() => router.push("/help/getting-started")}
                data-testid="empty-state-watch-demo"
              >
                <PlayCircleFilledRounded sx={{ fontSize: 20 }} />
                Watch 60-second demo
              </Box>
            </>
          ) : (
            <CustomButton
              data-testid="empty-state-finish-setup"
              label={hasCompany ? "Add a wallet" : "Create your company"}
              variant="primary"
              size={isMobile ? "small" : "medium"}
              endIcon={<ArrowOutward sx={{ fontSize: 16 }} />}
              onClick={() =>
                router.push(hasCompany ? "/wallet" : "/company")
              }
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default EmptyStatePanel;
