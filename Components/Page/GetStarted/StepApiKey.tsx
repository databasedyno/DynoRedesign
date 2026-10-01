import React, { useState } from "react";
import { Box, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import CreateApiModel from "@/Components/UI/ApiKeysModel/CreateApiModel";
import { ApiAction } from "@/Redux/Actions";
import { API_FETCH } from "@/Redux/Actions/ApiAction";
import { trackOnboarding } from "@/utils/trackOnboarding";
import { StepFooter, StepHeader } from "./StepChrome";
import type { SetupProgress } from "./useSetupProgress";

interface Props {
  progress: SetupProgress;
  onBack: () => void;
  onNext: () => void;
}

/**
 * Developer track — Step 4: get an API key. Opens the SAME create-key modal as
 * Developers → API keys (sandbox key first, plaintext revealed once), so a
 * developer never has to leave the guided setup to grab a key (2026-10-01).
 */
const StepApiKey: React.FC<Props> = ({ progress, onBack, onNext }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslation("dashboardLayout");
  const { hasApiKey, hasTestKey, companyId } = progress;
  const [createOpen, setCreateOpen] = useState(false);

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

  const handleCreateClose = () => {
    setCreateOpen(false);
    // Re-read the key list so the step flips to "done" even if the insert row is partial.
    dispatch(ApiAction(API_FETCH, companyId ? { company_id: companyId } : undefined));
  };

  const perks = [
    {
      icon: "key-round",
      title: t("gs.apiKeyPerkSandboxTitle", { defaultValue: "Sandbox key first" }),
      body: t("gs.apiKeyPerkSandboxBody", {
        defaultValue: "It starts with dpk_test_. Payments made with it are simulated — no real crypto ever moves.",
      }),
    },
    {
      icon: "zap",
      title: t("gs.apiKeyPerkWebhooksTitle", { defaultValue: "Signed webhooks" }),
      body: t("gs.apiKeyPerkWebhooksBody", {
        defaultValue: "Receive payment.pending, payment.confirmed and payment.settled events you can verify with your signing secret.",
      }),
    },
    {
      icon: "book-open",
      title: t("gs.apiKeyPerkDocsTitle", { defaultValue: "Docs & samples" }),
      body: t("gs.apiKeyPerkDocsBody", { defaultValue: "REST endpoints, webhook verification and copy-paste code in the API docs." }),
    },
  ];

  return (
    <Box data-testid="gs-step-apikey">
      <StepHeader
        eyebrow={t("gs.stepOf", { n: 4, total: 5, defaultValue: "Step {{n}} of {{total}}" })}
        title={
          hasApiKey
            ? t("gs.apiKeyDoneTitle", { defaultValue: "Your API key is ready" })
            : t("gs.apiKeyTitle", { defaultValue: "Get your API key" })
        }
        subtitle={t("gs.apiKeySubtitle", {
          defaultValue:
            "Start with a sandbox key to build and test your integration without moving real money. Create a live key when you're ready to accept real payments.",
        })}
      />

      {hasApiKey ? (
        <Box
          data-testid="gs-apikey-done"
          sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2, borderRadius: "14px", border: `1px solid ${border}` }}
        >
          <Box sx={{ color: positive, display: "flex" }}>
            <Icon name="circle-check" size={22} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink }}>
              {hasTestKey
                ? t("gs.apiKeyDoneSandbox", { defaultValue: "Sandbox key created" })
                : t("gs.apiKeyDoneLive", { defaultValue: "Live key created" })}
            </Box>
            <Box sx={{ mt: 0.25, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: muted }}>
              {t("gs.apiKeyDoneBody", {
                defaultValue: "Manage, rotate or add a live key anytime in Developers → API keys. Next: run a test payment end-to-end.",
              })}
            </Box>
          </Box>
        </Box>
      ) : (
        <Box data-testid="gs-apikey-perks" sx={{ display: "grid", gap: 1.25 }}>
          {perks.map((p) => (
            <Box
              key={p.icon}
              sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", p: 1.75, borderRadius: "14px", border: `1px solid ${border}` }}
            >
              <Box sx={{ color: indigo, display: "flex", mt: "2px" }}>
                <Icon name={p.icon} size={18} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink }}>{p.title}</Box>
                <Box sx={{ mt: 0.25, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: muted }}>{p.body}</Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <StepFooter
        onBack={onBack}
        primaryLabel={
          hasApiKey
            ? t("gs.continue", { defaultValue: "Continue" })
            : t("gs.apiKeyCreate", { defaultValue: "Create sandbox key" })
        }
        onPrimary={() => {
          if (hasApiKey) {
            trackOnboarding({ event_type: "step_completed", step_key: "link", metadata: { surface: "wizard", track: "developers" } });
            onNext();
          } else {
            setCreateOpen(true);
          }
        }}
        primaryTestId={hasApiKey ? "gs-apikey-continue" : "gs-apikey-create"}
        secondaryLabel={
          hasApiKey
            ? t("gs.apiKeyManage", { defaultValue: "Manage keys" })
            : t("gs.apiKeyDocs", { defaultValue: "Read the API docs" })
        }
        onSecondary={() => router.push(hasApiKey ? "/developer-keys" : "/documentation")}
        secondaryTestId="gs-apikey-secondary"
      />

      {/* Kept mounted so its one-time "copy your key" success dialog survives onClose. */}
      <CreateApiModel open={createOpen} onClose={handleCreateClose} />
    </Box>
  );
};

export default StepApiKey;
