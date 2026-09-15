import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Chip, Divider, FormControl, MenuItem, Select, Skeleton, Stack, Switch, Tooltip, Typography, useTheme } from "@mui/material";
import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
import { brandFg, brandAlpha, SUCCESS_GREEN } from "@/constants/theme";
import { CardSx, STABLECOIN_LABELS, maskAddr } from "./payoutsHelpers";
import { AutoConvertSettings } from "./useAutoConvertSettings";

interface Props {
  ac: AutoConvertSettings;
  cardSx: CardSx;
  /** The toggle lives in the money tile above; hide the duplicate here. */
  hideToggle?: boolean;
}

/** Settlement & auto-convert: toggle, settle-to coin picker, configured stablecoin wallets. */
const SettlementCard: React.FC<Props> = ({ ac, cardSx, hideToggle }) => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const accent = brandFg(theme.palette.mode === "dark");
  const { settlement, settlementLoading, settlementOptions, enabled, selectedWallet, hasStablecoinWallet, settlementTarget, handleToggle, handleCoinChange, toggleDisabled } = ac;

  return (
    <Box sx={cardSx} data-testid="payouts-settlement-card">
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1.25}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: brandAlpha(0.12), color: accent }}>
            <AutorenewRounded fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>
              {t("payouts.settlementAutoConvert", { defaultValue: "Settlement & auto-convert" })}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {settlementLoading
                ? t("payouts.loading", { defaultValue: "Loading\u2026" })
                : enabled
                  ? t("payouts.incomingConverts", { defaultValue: "Incoming crypto auto\u2011converts to {{target}}", target: settlementTarget })
                  : t("payouts.autoConvertOffDesc", { defaultValue: "Auto\u2011convert is off \u2014 payments settle in the coin received" })}
            </Typography>
          </Box>
        </Stack>
        {!hideToggle && (
        <Tooltip
          title={!hasStablecoinWallet && !enabled ? t("payouts.addWalletFirst", { defaultValue: "Add a stablecoin settlement wallet first" }) : ""}
          arrow
          placement="top"
        >
          <span>
            <Switch
              checked={enabled}
              onChange={handleToggle}
              disabled={toggleDisabled}
              data-testid="payouts-autoconvert-toggle"
              sx={{
                "& .MuiSwitch-switchBase.Mui-checked": { color: SUCCESS_GREEN },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: SUCCESS_GREEN },
              }}
            />
          </span>
        </Tooltip>
        )}
      </Stack>

      {hasStablecoinWallet && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
            {t("payouts.settleTo", { defaultValue: "Settle to" })}
          </Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={selectedWallet}
              onChange={(e) => handleCoinChange(e.target.value as string)}
              displayEmpty
              data-testid="payouts-settlement-coin-select"
              sx={{ borderRadius: 2, fontWeight: 600 }}
            >
              <MenuItem value="" disabled>
                {t("payouts.selectSettlementCoin", { defaultValue: "Select settlement coin" })}
              </MenuItem>
              {settlementOptions.map((opt) => {
                const val = opt.wallet_type || `${opt.currency}-${opt.chain}`;
                return (
                  <MenuItem key={val} value={val}>
                    {STABLECOIN_LABELS[opt.wallet_type || ""] || `${opt.currency} on ${opt.chain}`}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Stack>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        {t("payouts.settlementWallets", { defaultValue: "Settlement wallets" })}
      </Typography>
      {settlementLoading ? (
        <Skeleton height={48} />
      ) : settlementOptions.length === 0 ? (
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          {t("payouts.noSettlementWallet", { defaultValue: "No stablecoin settlement wallet configured yet. Add one in Settings to auto-convert payouts." })}
        </Typography>
      ) : (
        <Stack divider={<Divider flexItem />} spacing={0}>
          {settlementOptions.map((o, i) => {
            const isActive = enabled && settlement?.settlement_currency === o.currency && settlement?.settlement_chain === o.chain;
            return (
              <Stack key={o.wallet_type || i} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                <Stack direction="row" alignItems="center" gap={1.25}>
                  <Box sx={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: theme.palette.action.hover, fontSize: 11, fontWeight: 700 }}>
                    {(o.currency || "?").slice(0, 3)}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                      {o.currency || o.wallet_type}{" "}
                      <Typography component="span" variant="caption" sx={{ color: theme.palette.text.secondary }}>
                        {t("payouts.onChain", { defaultValue: "on" })} {o.chain}
                      </Typography>
                    </Typography>
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontFamily: "monospace" }}>
                      {maskAddr(o.wallet_address)}
                    </Typography>
                  </Box>
                </Stack>
                {isActive && (
                  <Chip size="small" label={t("payouts.active", { defaultValue: "Active" })} sx={{ color: SUCCESS_GREEN, bgcolor: `${SUCCESS_GREEN}1A`, fontWeight: 700 }} />
                )}
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

export default SettlementCard;
