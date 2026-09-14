import React, { useState } from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import CustomButton from "@/Components/UI/Buttons";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon } from "@/styles/uiKit";
import axiosBaseApi from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import type { SessionEntry } from "./useWalletSecurity";

interface Props {
  sessions?: SessionEntry[];
  loading: boolean;
  onChanged: () => void;
}

/** Signed-in devices + the one-click "sign out everywhere else" (plan 3.4). */
const DevicesCard: React.FC<Props> = ({ sessions = [], loading, onChanged }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslation("walletScreen");
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const [busy, setBusy] = useState(false);

  const others = sessions.filter((s) => !s.is_current).length;
  const current = sessions.find((s) => s.is_current);

  const signOutEverywhere = async () => {
    setBusy(true);
    try {
      const res = await axiosBaseApi.delete("user/sessions", { data: { current_session_id: current?.session_id } });
      const n = Number(res?.data?.data?.revoked_count ?? 0);
      dispatch({ type: TOAST_SHOW, payload: { severity: "success", message: n > 0 ? t("security.signedOutCount", { count: n, defaultValue: "Signed out on {{count}} other device(s) — you're still signed in here." }) : t("security.noOtherDevices", { defaultValue: "No other devices to sign out." }) } });
      onChanged();
    } catch {
      dispatch({ type: TOAST_SHOW, payload: { severity: "error", message: t("security.signOutFailed", { defaultValue: "Couldn't sign out other devices. Please try again." }) } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelCard title={t("security.devicesTitle", { defaultValue: "Signed-in devices" })} showHeaderBorder={false}>
      <Box data-testid="wallet-security-devices" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "12px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: theme.palette.text.secondary, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.04)" }}>
            <Icon name="monitor-smartphone" size={20} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            {loading ? (
              <Skeleton width={160} height={24} />
            ) : (
              <Typography data-testid="wallet-security-device-count" sx={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700, color: theme.palette.text.primary }}>
                {t("security.devicesCount", { count: sessions.length, defaultValue: "{{count}} device(s) signed in" })}
              </Typography>
            )}
            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted }}>
              {t("security.devicesHint", { defaultValue: "If you see a device you don't recognise, sign out everywhere else and change your password." })}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <CustomButton
            label={t("security.signOutEverywhere", { defaultValue: "Sign out everywhere else" })}
            variant="outlined"
            size="small"
            loading={busy}
            disabled={loading || others === 0}
            onClick={signOutEverywhere}
            data-testid="wallet-security-signout-all"
          />
          <CustomButton label={t("security.manageDevices", { defaultValue: "Manage devices" })} variant="secondary" size="small" onClick={() => router.push("/settings?section=profile")} data-testid="wallet-security-manage-devices" />
        </Box>
      </Box>
    </PanelCard>
  );
};

export default DevicesCard;
