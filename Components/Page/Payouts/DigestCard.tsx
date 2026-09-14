import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { Box, Button, Stack, Switch, Typography, useTheme } from "@mui/material";
import MailRounded from "@mui/icons-material/MailRounded";
import axiosBaseApi from "@/axiosConfig";
import useApiSWR from "@/hooks/useApiSWR";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { CardSx } from "./payoutsHelpers";

interface Props {
  cardSx: CardSx;
}

/** Weekly payout digest opt-in (notification preference payout_digest_weekly) + "Send preview". */
const DigestCard: React.FC<Props> = ({ cardSx }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation("common");

  const { data: notifPrefs, mutate: mutateNotifPrefs } = useApiSWR<any>("/notifications/preferences", {
    select: (raw) => raw?.data ?? raw,
  });
  const digestEnabled = notifPrefs?.payout_digest_weekly === true;
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const toast = (message: string, severity: "success" | "error") =>
    dispatch({ type: TOAST_SHOW, payload: { message, severity } });

  const toggleDigest = async (next: boolean) => {
    if (saving) return;
    setSaving(true);
    mutateNotifPrefs({ ...(notifPrefs || {}), payout_digest_weekly: next }, false);
    try {
      await axiosBaseApi.put("/notifications/preferences", { payout_digest_weekly: next });
      await mutateNotifPrefs();
      toast(
        next
          ? t("payouts.digestOn", { defaultValue: "Weekly payout digest turned on" })
          : t("payouts.digestOff", { defaultValue: "Weekly payout digest turned off" }),
        "success",
      );
    } catch {
      await mutateNotifPrefs();
      toast(t("payouts.digestUpdateFailed", { defaultValue: "Couldn't update the digest setting" }), "error");
    } finally {
      setSaving(false);
    }
  };

  const sendPreview = async () => {
    if (previewing) return;
    setPreviewing(true);
    try {
      await axiosBaseApi.post("/notifications/payout-digest/preview", {});
      toast(t("payouts.previewSent", { defaultValue: "Preview digest sent to your email" }), "success");
    } catch {
      toast(t("payouts.previewFailed", { defaultValue: "Couldn't send the preview" }), "error");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Box
      sx={{ ...cardSx, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}
      data-testid="payouts-digest-card"
    >
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: `${theme.palette.primary.main}1A`, color: theme.palette.primary.main, flexShrink: 0 }}>
          <MailRounded fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>{t("payouts.weeklyDigest", { defaultValue: "Weekly payout digest" })}</Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            {t("payouts.weeklyDigestDesc", { defaultValue: "Get a weekly email summarising settled payouts and anything still pending" })}
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" alignItems="center" gap={0.5}>
        {digestEnabled && (
          <Button
            size="small"
            variant="text"
            disabled={previewing}
            onClick={sendPreview}
            data-testid="payouts-digest-preview-btn"
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {previewing ? t("payouts.sending", { defaultValue: "Sending\u2026" }) : t("payouts.sendPreview", { defaultValue: "Send preview" })}
          </Button>
        )}
        <Switch
          checked={digestEnabled}
          onChange={(e) => toggleDigest(e.target.checked)}
          disabled={saving}
          data-testid="payouts-digest-toggle"
        />
      </Stack>
    </Box>
  );
};

export default DigestCard;
