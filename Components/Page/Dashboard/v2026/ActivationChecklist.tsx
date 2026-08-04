import React, { useMemo } from "react";
import { Box, useTheme } from "@mui/material";
import {
  CheckRounded,
  RadioButtonUncheckedRounded,
  ArrowOutwardRounded,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { SurfaceCard, Eyebrow, PrimaryCTA, CB_TOKENS } from "../coinbase/styled";

interface Props {
  hasCompany: boolean;
  hasWallet: boolean;
  onCreateLink: () => void;
}

/**
 * ActivationChecklist — the first-run hero shown when a merchant has set up
 * their business + wallet but has not yet received a payment. Turns the top
 * of the dashboard into a single clear guide (business → wallet → first link
 * → first payment) with a progress bar and one primary action.
 */
const ActivationChecklist: React.FC<Props> = ({ hasCompany, hasWallet, onCreateLink }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const router = useRouter();

  const steps = useMemo(
    () => [
      {
        id: "profile",
        label: t("stepProfile", { defaultValue: "Set up your business profile" }),
        done: hasCompany,
      },
      {
        id: "wallet",
        label: t("stepWallet", { defaultValue: "Add a crypto wallet" }),
        done: hasWallet,
      },
      {
        id: "link",
        label: t("stepLink", { defaultValue: "Create your first payment link" }),
        done: false,
      },
      {
        id: "payment",
        label: t("stepPayment", { defaultValue: "Receive your first payment" }),
        done: false,
      },
    ],
    [hasCompany, hasWallet, t],
  );

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <SurfaceCard data-testid="dash2026-activation" sx={{ p: { xs: 2.5, md: 3.5 } }}>
      <Eyebrow>{t("gettingStarted", { defaultValue: "Getting started" })}</Eyebrow>
      <Box
        sx={{
          mt: 1,
          fontFamily: "var(--font-unbounded, 'Unbounded', 'Inter', system-ui)",
          fontSize: { xs: 24, md: 30 },
          fontWeight: 500,
          letterSpacing: -0.6,
          color: isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight,
        }}
      >
        {t("activationTitle", { defaultValue: "You're ready to accept crypto" })}
      </Box>
      <Box
        sx={{
          mt: 1,
          maxWidth: 520,
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          lineHeight: 1.5,
          color: isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight,
        }}
      >
        {t("activationSubtitle", {
          defaultValue:
            "Create your first payment link and share it with a customer to receive your first crypto payment.",
        })}
      </Box>

      {/* Progress */}
      <Box sx={{ mt: 3, mb: 2.5 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Box
            sx={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 600,
              color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
            }}
          >
            {t("setupProgress", { defaultValue: "Setup progress" })}
          </Box>
          <Box
            sx={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 700,
              color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
            }}
          >
            {doneCount}/{steps.length}
          </Box>
        </Box>
        <Box
          sx={{
            height: 8,
            borderRadius: 999,
            backgroundColor: isDark
              ? "rgba(255,255,255,0.06)"
              : "rgba(10,10,15,0.05)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: 999,
              background: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
              transition: "width 500ms ease",
            }}
          />
        </Box>
      </Box>

      {/* Steps */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: 3 }}>
        {steps.map((s) => (
          <Box
            key={s.id}
            data-testid={`dash2026-step-${s.id}`}
            sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
          >
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: s.done
                  ? "#FFFFFF"
                  : isDark
                    ? CB_TOKENS.ink.mutedDark
                    : CB_TOKENS.ink.mutedLight,
                backgroundColor: s.done
                  ? "#05B169"
                  : isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(10,10,15,0.05)",
              }}
            >
              {s.done ? (
                <CheckRounded sx={{ fontSize: 16 }} />
              ) : (
                <RadioButtonUncheckedRounded sx={{ fontSize: 16 }} />
              )}
            </Box>
            <Box
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: s.done ? 500 : 600,
                textDecoration: s.done ? "line-through" : "none",
                color: s.done
                  ? isDark
                    ? CB_TOKENS.ink.mutedDark
                    : CB_TOKENS.ink.mutedLight
                  : isDark
                    ? CB_TOKENS.ink.primaryDark
                    : CB_TOKENS.ink.primaryLight,
              }}
            >
              {s.label}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ minWidth: 240, flex: "0 0 auto" }}>
          <PrimaryCTA
            onClick={onCreateLink}
            data-testid="dash2026-activation-cta"
            endIcon={<ArrowOutwardRounded sx={{ fontSize: 18 }} />}
          >
            {t("createPaymentLink", { defaultValue: "Create payment link" })}
          </PrimaryCTA>
        </Box>
        <Box
          role="button"
          tabIndex={0}
          onClick={() => router.push("/documentation")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") router.push("/documentation");
          }}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            px: 2,
            height: 52,
            borderRadius: 999,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 600,
            color: isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight,
            border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
            "&:hover": {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.04)"
                : "rgba(10,10,15,0.03)",
            },
          }}
        >
          {t("viewDocs", { defaultValue: "Read the docs" })}
        </Box>
      </Box>
    </SurfaceCard>
  );
};

export default ActivationChecklist;
