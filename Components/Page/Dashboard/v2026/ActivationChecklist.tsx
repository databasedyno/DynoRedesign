import React, { useMemo } from "react";
import { Box, useTheme } from "@mui/material";
import { Icon } from "@/styles/uiKit";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import useStorefrontProfile from "@/hooks/useStorefrontProfile";
import { SurfaceCard, Eyebrow, PrimaryCTA, CB_TOKENS } from "../coinbase/styled";

interface Props {
  /** 'individual' creator vs a registered business — drives the first step's copy. */
  accountType: "individual" | "business";
  /** Account has the details invoices + tax need (name + country). */
  profileComplete: boolean;
  hasWallet: boolean;
  onCreateLink: () => void;
}

/**
 * ActivationChecklist — the first-run hero shown before a merchant's first
 * payment. Every user is auto-provisioned an Account at signup, so step 1 is
 * about COMPLETING that account (country is what invoices + VAT reporting need)
 * rather than "creating a company" — and each unfinished step is tappable so
 * the guide actually takes you where the work happens.
 */
const ActivationChecklist: React.FC<Props> = ({
  accountType,
  profileComplete,
  hasWallet,
  onCreateLink,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const router = useRouter();
  const isIndividual = accountType === "individual";
  // Storefront-per-company: a claimed handle means the merchant's public page
  // (tips + products + payment links) is live. Drives the storefront step below.
  const { profile: storefront } = useStorefrontProfile();
  const hasHandle = Boolean(storefront?.handle);

  const steps = useMemo(
    () => [
      {
        id: "profile",
        label: isIndividual
          ? t("stepAccountIndividual", {
              defaultValue: "Add your country so invoices and tax are right",
            })
          : t("stepProfile", { defaultValue: "Complete your business profile" }),
        done: profileComplete,
        href: "/settings?section=company",
      },
      {
        id: "wallet",
        label: t("stepWallet", { defaultValue: "Add a crypto wallet" }),
        done: hasWallet,
        href: "/wallet",
      },
      {
        id: "handle",
        label: hasHandle
          ? t("stepHandleDone", {
              defaultValue: "Open your storefront and share your page",
            })
          : t("stepHandle", {
              defaultValue: "Claim your handle and open your page",
            }),
        done: hasHandle,
        href: "/storefront",
      },
      {
        id: "link",
        label: t("stepLink", { defaultValue: "Create your first payment link" }),
        done: false,
        href: "/create-pay-link",
      },
      {
        id: "payment",
        label: t("stepPayment", { defaultValue: "Receive your first payment" }),
        done: false,
        href: null as string | null,
      },
    ],
    [isIndividual, profileComplete, hasWallet, hasHandle, t],
  );

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <SurfaceCard data-testid="dash2026-activation" sx={{ p: { xs: 2.5, md: 3.5 } }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Eyebrow>{t("gettingStarted", { defaultValue: "Getting started" })}</Eyebrow>
        <Box
          data-testid="dash2026-account-type"
          sx={{
            px: 1.25,
            py: 0.375,
            borderRadius: 999,
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            color: isIndividual
              ? isDark
                ? CB_TOKENS.ink.mutedDark
                : CB_TOKENS.ink.mutedLight
              : isDark
                ? CB_TOKENS.indigo.dark
                : CB_TOKENS.indigo.light,
            border: `1px solid ${
              isIndividual
                ? isDark
                  ? CB_TOKENS.border.dark
                  : CB_TOKENS.border.light
                : isDark
                  ? CB_TOKENS.indigo.dark
                  : CB_TOKENS.indigo.light
            }`,
          }}
        >
          {isIndividual
            ? t("accountTypeIndividual", { defaultValue: "Individual" })
            : t("accountTypeBusiness", { defaultValue: "Business" })}
        </Box>
      </Box>
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

      {/* Steps — an unfinished step with a destination is tappable */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: 3 }}>
        {steps.map((s) => {
          const actionable = !s.done && !!s.href;
          const go = () => {
            if (actionable && s.href) router.push(s.href);
          };
          return (
            <Box
              key={s.id}
              data-testid={`dash2026-step-${s.id}`}
              role={actionable ? "button" : undefined}
              tabIndex={actionable ? 0 : undefined}
              onClick={go}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (actionable && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  go();
                }
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                borderRadius: "10px",
                mx: -0.75,
                px: 0.75,
                py: 0.5,
                outline: "none",
                cursor: actionable ? "pointer" : "default",
                transition: "background-color 140ms ease",
                ...(actionable && {
                  "&:hover, &:focus-visible": {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(10,10,15,0.03)",
                  },
                }),
              }}
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
                  <Icon name="check" size={16} />
                ) : (
                  <Icon name="circle" size={16} />
                )}
              </Box>
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
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
              {actionable && (
                <Box
                  sx={{
                    display: "flex",
                    flexShrink: 0,
                    color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
                  }}
                >
                  <Icon name="chevron-right" size={16} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ minWidth: 240, flex: "0 0 auto" }}>
          <PrimaryCTA
            onClick={onCreateLink}
            data-testid="dash2026-activation-cta"
            endIcon={<Icon name="arrow-up-right" size={18} />}
          >
            {t("createPaymentLink", { defaultValue: "Create payment link" })}
          </PrimaryCTA>
        </Box>
        <Box
          role="button"
          tabIndex={0}
          data-testid={
            isIndividual ? "dash2026-activation-upgrade" : "dash2026-activation-docs"
          }
          onClick={() =>
            router.push(isIndividual ? "/settings?section=company" : "/documentation")
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ")
              router.push(
                isIndividual ? "/settings?section=company" : "/documentation",
              );
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
          {isIndividual
            ? t("upgradeToBusiness", { defaultValue: "Add business details" })
            : t("viewDocs", { defaultValue: "Read the docs" })}
        </Box>
      </Box>
    </SurfaceCard>
  );
};

export default ActivationChecklist;
