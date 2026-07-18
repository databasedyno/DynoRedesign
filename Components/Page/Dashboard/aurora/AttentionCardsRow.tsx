// AttentionCardsRow — the "what needs my attention?" strip.
// Horizontal 2-5 cards of actionable tasks: KYC / API keys / low gas / handle.
// Each dismissible on completion — no zombie "Congrats" empty state.
import {
  ArrowForwardRounded,
  KeyRounded,
  LocalGasStationRounded,
  PublicRounded,
  ReceiptLongRounded,
  WalletRounded,
} from "@mui/icons-material";
import { Box, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React, { memo, useMemo } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { rootReducer } from "@/utils/types";
import {
  Body,
  CardTitle,
  CoralChip,
  Eyebrow,
  MonoLabel,
  SurfaceCard,
} from "./styled";

interface Task {
  id: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
}

const AttentionCardsRow: React.FC = () => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");

  const companyState = useSelector((s: rootReducer) => s.companyReducer);
  const walletState = useSelector((s: rootReducer) => s.walletReducer);
  const userState = useSelector((s: any) => s.userReducer);
  const profile = userState?.profile;

  const hasCompany = (companyState.companyList?.length ?? 0) > 0;
  const hasWallet = (walletState.walletList?.length ?? 0) > 0;
  const hasHandle = Boolean(profile?.handle);
  // We don't have direct visibility into API keys from Redux — expose a
  // generic "add key" task only when the merchant has completed the basic
  // setup (wallet + company). Non-blocking.
  const missingApiKey = hasCompany && hasWallet && !profile?.has_api_key;

  const tasks = useMemo<Task[]>(() => {
    const rows: Task[] = [];

    if (!hasCompany) {
      rows.push({
        id: "add-company",
        icon: <ReceiptLongRounded sx={{ fontSize: 20 }} />,
        eyebrow: t("setup") || "Setup",
        title: t("addCompany") || "Add your business details",
        desc:
          t("addCompanyDesc") ||
          "Add your company name & country so we can label payouts.",
        cta: t("finishSetup") || "Finish setup",
        href: "/settings?section=company",
      });
    }

    if (!hasWallet) {
      rows.push({
        id: "add-wallet",
        icon: <WalletRounded sx={{ fontSize: 20 }} />,
        eyebrow: t("setup") || "Setup",
        title: t("addWallet") || "Add a settlement wallet",
        desc:
          t("addWalletDesc") ||
          "Choose a chain and paste an address to receive settlements.",
        cta: t("addWallet") || "Add wallet",
        href: "/wallet",
      });
    }

    if (missingApiKey) {
      rows.push({
        id: "api-key",
        icon: <KeyRounded sx={{ fontSize: 20 }} />,
        eyebrow: t("developers") || "Developers",
        title: t("createApiKey") || "Create an API key",
        desc:
          t("createApiKeyDesc") ||
          "Programmatic access to charges, invoices and webhooks.",
        cta: t("generateKey") || "Generate",
        href: "/developer-keys",
      });
    }

    if (hasCompany && hasWallet && !hasHandle) {
      rows.push({
        id: "claim-handle",
        icon: <PublicRounded sx={{ fontSize: 20 }} />,
        eyebrow: t("creatorPage") || "Creator page",
        title: t("claimHandle") || "Claim your @handle",
        desc:
          t("claimHandleDesc") ||
          "dynopay.me/@you — one link to accept tips, sales & fundraising.",
        cta: t("claimNow") || "Claim",
        href: "/profile?claim=1",
      });
    }

    // Always shows if user has zero settled payments — nudge to create link.
    if (hasCompany && hasWallet) {
      rows.push({
        id: "gas-check",
        icon: <LocalGasStationRounded sx={{ fontSize: 20 }} />,
        eyebrow: t("tip") || "Tip",
        title: t("createFirstLink") || "Create your first payment link",
        desc:
          t("createFirstLinkDesc") ||
          "Send a link to a customer — they can pay in any coin.",
        cta: t("createLink") || "Create link",
        href: "/create-pay-link",
      });
    }

    return rows.slice(0, 4);
  }, [hasCompany, hasWallet, missingApiKey, hasHandle, t]);

  // Hide the whole strip when nothing to show — avoids empty containers.
  if (tasks.length === 0) return null;

  return (
    <SurfaceCard
      data-testid="aurora-attention-row"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Eyebrow>
          {t("needsAttention") || "Needs your attention"} · {tasks.length}
        </Eyebrow>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: `repeat(${Math.min(tasks.length, 4)}, 1fr)`,
          },
          gap: 1.5,
        }}
      >
        {tasks.map((task) => (
          <Box
            key={task.id}
            data-testid={`attention-card-${task.id}`}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              padding: 2,
              borderRadius: 14,
              border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)"}`,
              background: dark ? "rgba(255,255,255,0.02)" : "rgba(250,250,247,0.7)",
              transition: "border-color 200ms ease, transform 200ms ease",
              "&:hover": {
                borderColor: "#FF5B49",
                transform: "translateY(-1px)",
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: dark ? "rgba(255,91,73,0.14)" : "rgba(255,91,73,0.10)",
                  color: "#FF5B49",
                }}
              >
                {task.icon}
              </Box>
              <MonoLabel sx={{ fontSize: 10 }}>{task.eyebrow}</MonoLabel>
            </Box>
            <CardTitle sx={{ fontSize: 16, mt: 0.5 }}>{task.title}</CardTitle>
            <Body sx={{ fontSize: 13, flex: 1 }}>{task.desc}</Body>
            <CoralChip
              onClick={() => router.push(task.href)}
              role="button"
              tabIndex={0}
              sx={{ alignSelf: "flex-start", mt: 0.5 }}
            >
              {task.cta}
              <ArrowForwardRounded sx={{ fontSize: 14 }} />
            </CoralChip>
          </Box>
        ))}
      </Box>
    </SurfaceCard>
  );
};

export default memo(AttentionCardsRow);
