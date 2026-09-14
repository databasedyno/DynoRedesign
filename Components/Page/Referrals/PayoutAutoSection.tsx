import React from "react";
import { Box, CircularProgress, TextField, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { brandFg } from "@/constants/theme";
import { toFixedStr } from "@/utils/money";
import { OtpField, PayoutOverview, PillBtn, otpGatedSx } from "./payoutShared";

interface Props {
  data: PayoutOverview;
  min: number;
  busy: string | null;
  pillBtn: PillBtn;
  showSetup: boolean;
  openSetup: () => void;
  autoMin: string;
  setAutoMin: (v: string) => void;
  otpSent: boolean;
  otp: string;
  setOtp: (v: string) => void;
  onSendOtp: () => void;
  onEnable: () => void;
  onDisable: () => void;
  onCancel: () => void;
}

/** Auto cash-out block: on-state, CTA, or the threshold + OTP setup form. */
export const PayoutAutoSection: React.FC<Props> = ({ data, min, busy, pillBtn, showSetup, openSetup, autoMin, setAutoMin, otpSent, otp, setOtp, onSendOtp, onEnable, onDisable, onCancel }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { t } = useTranslation("referrals");
  const titleSx = { fontSize: "13px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary } as const;
  const descSx = { fontSize: "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary } as const;

  return (
    <Box sx={{ mt: 2, pt: 1.75, borderTop: `1px dashed ${theme.palette.border.main}` }}>
      {data.auto ? (
        <Box data-testid="payout-auto-on" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Icon name="zap" size={16} color={brandFg(dark)} />
            <Box>
              <Typography sx={titleSx}>{t("payoutAutoOnTitle", { defaultValue: "Auto cash-out is on" })}</Typography>
              <Typography sx={descSx}>
                {t("payoutAutoOnDesc", { defaultValue: "Sends automatically once you reach ${{min}}", min: toFixedStr(data.auto_min_usd ?? min, 0) })}
              </Typography>
            </Box>
          </Box>
          <Box component="button" type="button" data-testid="payout-auto-off-btn" onClick={onDisable} sx={pillBtn("ghost")}>
            {busy === "disable-auto" ? <CircularProgress size={16} /> : null}
            {t("payoutAutoTurnOff", { defaultValue: "Turn off auto" })}
          </Box>
        </Box>
      ) : !showSetup ? (
        <Box component="button" type="button" data-testid="payout-auto-setup-btn" onClick={openSetup} sx={{ display: "inline-flex", alignItems: "center", gap: 1, cursor: "pointer", color: theme.palette.text.secondary, "&:hover": { color: theme.palette.text.primary } }}>
          <Icon name="zap" size={16} />
          <Typography sx={{ fontSize: "13px", fontFamily: "var(--font-sans)", fontWeight: 600 }}>
            {t("payoutAutoEnableCta", { defaultValue: "Turn on auto cash-out" })}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ p: 1.5, borderRadius: "10px", border: `1px solid ${theme.palette.border.main}` }}>
          <Typography sx={titleSx}>{t("payoutAutoSetupTitle", { defaultValue: "Auto cash-out" })}</Typography>
          <Typography sx={{ ...descSx, mb: 1.25 }}>
            {t("payoutAutoSetupDesc", { defaultValue: "We'll send your rewards automatically once they reach this amount." })}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <TextField
              value={autoMin}
              onChange={(e) => setAutoMin(e.target.value.replace(/[^\d.]/g, ""))}
              size="small"
              disabled={otpSent}
              inputProps={{ "data-testid": "payout-auto-min-input", inputMode: "decimal", style: { fontFamily: MONO, width: 80 } }}
              InputProps={{ startAdornment: <span style={{ color: theme.palette.text.secondary, marginRight: 4 }}>$</span> }}
            />
            {!otpSent && (
              <Box component="button" type="button" data-testid="payout-auto-send-otp-btn" onClick={onSendOtp} sx={pillBtn("primary")}>
                {busy === "auto-otp" ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null}
                {t("payoutSendCode", { defaultValue: "Send code" })}
              </Box>
            )}
            <Box component="button" type="button" data-testid="payout-auto-cancel-btn" onClick={onCancel} sx={pillBtn("ghost")}>
              {t("payoutCancel", { defaultValue: "Cancel" })}
            </Box>
          </Box>
          {otpSent && (
            <Box sx={{ mt: 1.25, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <OtpField value={otp} onChange={setOtp} testId="payout-auto-otp-input" />
              <Box component="button" type="button" data-testid="payout-auto-enable-btn" onClick={() => otp.length === 6 && onEnable()} sx={otpGatedSx(pillBtn, otp, busy)}>
                {busy === "enable-auto" ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null}
                {t("payoutAutoEnableConfirm", { defaultValue: "Turn on" })}
              </Box>
            </Box>
          )}
          <Typography sx={{ mt: 1, fontSize: "11px", fontFamily: "var(--font-sans)", color: theme.palette.text.disabled }}>
            {t("payoutAutoMinHint", { defaultValue: "Minimum ${{min}}. Higher amounts batch payouts and save on network fees.", min: toFixedStr(min, 0) })}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default PayoutAutoSection;
