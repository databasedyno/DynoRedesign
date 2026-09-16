import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { CRYPTO_INFO, NETWORK_ETA } from "@/Components/Page/Pay3Components/checkout/checkoutConstants";
import { FONT_BODY, FONT_TECH, useAurora } from "../v3/theme.v3";
import { Stagger, StaggerItem } from "../motion/Stagger";

/** One chip per network, text straight from the checkout's NETWORK_ETA so the two never disagree. */
const ETA_ORDER = ["SOL", "XRP", "USDT-TRC20", "POLYGON", "ETH", "LTC", "DOGE", "BCH", "BTC"] as const;

export const NetworkEtaRow: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  return (
    <Box data-testid="network-eta-row">
      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: s.ink3, mb: 1.5 }}>{t("v5.how.etaLabel")}</Typography>
      <Stagger step={0.04} sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {ETA_ORDER.map((code, i) => {
          const info = CRYPTO_INFO[code];
          return (
            <StaggerItem key={code} i={i} y={10}>
              <Box data-testid={`eta-${info.network}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.9, px: 1.4, py: 0.7, borderRadius: "999px", border: `1px solid ${s.line}`, background: s.surface, transition: "border-color 200ms ease, transform 200ms cubic-bezier(0.2,0.8,0.2,1)", "&:hover": { borderColor: s.lineStrong, transform: "translateY(-2px)" } }}>
                <Icon icon={info.icon} width={16} height={16} />
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: s.ink }}>{info.networkLabel}</Typography>
                <Typography className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 12, color: s.ink3 }}>{t(`v5.eta.${info.network}`, { defaultValue: NETWORK_ETA[info.network] })}</Typography>
              </Box>
            </StaggerItem>
          );
        })}
      </Stagger>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, color: s.ink3, mt: 1.5 }}>{t("v5.how.etaNote")}</Typography>
    </Box>
  );
};

export default memo(NetworkEtaRow);
