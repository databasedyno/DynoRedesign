import React, { useState } from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import CoinChips from "@/Components/UI/CoinChips";
import WalletManagerModal from "@/Components/UI/WalletManagerModal";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { useWalletStore } from "@/contexts/WalletDataContext";
import { maskAddress } from "@/helpers/maskAddress";
import { trackOnboarding } from "@/utils/trackOnboarding";
import { StepFooter, StepHeader } from "./StepChrome";
import WalletHelp from "./WalletHelp";
import type { SetupProgress } from "./useSetupProgress";

interface Props {
  progress: SetupProgress;
  onBack: () => void;
  onNext: () => void;
}

/** Step 2 — Where payouts go: plain-language explanation + the OTP-secured wallet manager. */
const StepPayouts: React.FC<Props> = ({ progress, onBack, onNext }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const walletState = useWalletStore();
  const { companyId, configuredWallets, hasWallet } = progress;
  const [open, setOpen] = useState(false);

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;

  const points = [
    { icon: "key-round", title: t("gs.payoutsPoint1Title", { defaultValue: "Your keys, your coins" }), body: t("gs.payoutsPoint1", { defaultValue: "Each payment settles straight to the address you add here. Dynopay never holds your funds." }) },
    { icon: "coins", title: t("gs.payoutsPoint2Title", { defaultValue: "One address per coin" }), body: t("gs.payoutsPoint2", { defaultValue: "Add the coins you want to accept now — you can add more later." }) },
    { icon: "shield-check", title: t("gs.payoutsPoint3Title", { defaultValue: "Protected by a one-time code" }), body: t("gs.payoutsPoint3", { defaultValue: "Payout address changes always ask for a code sent to your email." }) },
  ];

  const openManager = () => {
    trackOnboarding({ event_type: "step_clicked", step_key: "wallet", metadata: { surface: "wizard" } });
    setOpen(true);
  };
  const handleSaved = () => {
    trackOnboarding({ event_type: "step_completed", step_key: "wallet", metadata: { surface: "wizard" } });
    walletState.refetchWallets();
    setOpen(false);
  };

  return (
    <Box data-testid="gs-step-payouts">
      <StepHeader
        eyebrow={t("gs.stepOf", { n: 3, total: 5, defaultValue: "Step {{n}} of {{total}}" })}
        title={t("gs.payoutsTitle", { defaultValue: "Where should your money go?" })}
        subtitle={t("gs.payoutsSubtitle", {
          defaultValue: "Payments are forwarded straight to a wallet you control. Add at least one address so your links can go live.",
        })}
      />

      {/* Phones: the wallet action comes first and the "why" points read as a compact list beneath it. */}
      <Box sx={{ display: "flex", flexDirection: "column" }}>
      <Box sx={{ order: { xs: 3, md: 1 }, mt: { xs: 3, md: 0 }, display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 1, md: 1.5 } }}>
        {points.map((p) => (
          <Box key={p.icon} sx={{ display: "flex", flexDirection: { xs: "row", md: "column" }, alignItems: { xs: "flex-start", md: "stretch" }, gap: { xs: 1.5, md: 0 }, p: { xs: 1.5, md: 2 }, borderRadius: "14px", border: `1px solid ${border}`, backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(10,10,15,0.015)" }}>
            <Box sx={{ width: 34, height: 34, flexShrink: 0, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: indigo, backgroundColor: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow }}>
              <Icon name={p.icon} size={18} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ mt: { xs: 0, md: 1.25 }, fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink }}>{p.title}</Box>
              <Box sx={{ mt: 0.5, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: muted }}>{p.body}</Box>
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ order: { xs: 1, md: 2 }, mt: { xs: 0, md: 3 } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 1.25 }}>
          <Box data-testid="gs-wallets-count" data-count={configuredWallets.length} sx={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: ink }}>
            {t("gs.walletsConfigured", { count: configuredWallets.length, defaultValue: "Configured payout addresses ({{count}})" })}
          </Box>
          {hasWallet && (
            <Box component="button" type="button" data-testid="gs-add-another-wallet" onClick={openManager} sx={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: indigo, p: 0.5, borderRadius: 6, "&:focus-visible": { outline: `2px solid ${indigo}` } }}>
              + {t("gs.addAnotherWallet", { defaultValue: "Add another payout address" })}
            </Box>
          )}
        </Box>

        {hasWallet ? (
          <Box data-testid="gs-wallet-list" sx={{ display: "grid", gap: 0.75 }}>
            {configuredWallets.slice(0, 6).map((w: any) => (
              <Box key={w.wallet_id ?? w.wallet_type} data-testid={`gs-wallet-${w.wallet_type}`} sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1.125, borderRadius: "12px", border: `1px solid ${border}` }}>
                <Box sx={{ color: positive, display: "flex" }}><Icon name="check-circle-2" size={18} /></Box>
                <CoinChips value={String(w.wallet_type || "")} max={1} />
                <Box sx={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 12.5, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {maskAddress(w.wallet_address)}
                </Box>
              </Box>
            ))}
            {configuredWallets.length > 6 && (
              <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted, px: 0.5 }}>
                +{configuredWallets.length - 6}
              </Box>
            )}
          </Box>
        ) : (
          <Box data-testid="gs-no-wallets" sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, gap: 1.5, p: 2, borderRadius: "14px", border: `1px dashed ${border}` }}>
            <Box sx={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 13.5, lineHeight: 1.5, color: muted }}>
              {t("gs.noWalletsYet", { defaultValue: "No payout address yet — paste the address of a wallet you control. We'll confirm it with a code sent to your email." })}
            </Box>
          </Box>
        )}
        {!hasWallet && <WalletHelp />}
      </Box>

      <Box sx={{ order: { xs: 2, md: 3 } }}>
        <StepFooter
          onBack={onBack}
          primaryLabel={hasWallet ? t("gs.continue", { defaultValue: "Continue" }) : t("gs.addWallet", { defaultValue: "Add payout address" })}
          onPrimary={hasWallet ? onNext : openManager}
          primaryTestId={hasWallet ? "gs-payouts-continue" : "gs-add-wallet"}
        />
      </Box>
      </Box>

      <WalletManagerModal open={open} companyId={companyId ?? null} onClose={() => setOpen(false)} onSaved={handleSaved} />
    </Box>
  );
};

export default StepPayouts;
