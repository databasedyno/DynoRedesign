import React from "react";
import { Box, Typography } from "@mui/material";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import { AMOUNT_COIN, AMOUNT_USD, GREEN, M, labelSx, miniBtnSx, monoSx, screenSx } from "./shared";

const Shell: React.FC<React.PropsWithChildren<{ testId: string }>> = ({ testId, children }) => (
  <Box
    aria-hidden
    data-testid={testId}
    className="way-vignette"
    sx={{
      ...screenSx,
      height: 116,
      p: 1.75,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 1.25,
      mb: 2.5,
      background: "linear-gradient(180deg, #16171B 0%, #0F1013 100%)",
      transition: "border-color 260ms ease, box-shadow 260ms ease, transform 260ms cubic-bezier(0.16,1,0.3,1)",
      "& .mock-cta": { transition: "box-shadow 260ms ease, filter 260ms ease" },
      "@media (prefers-reduced-motion: reduce)": { transition: "none", "& .mock-cta": { transition: "none" } },
    }}
  >
    {children}
  </Box>
);

/** No code — a live payment link ready to share. */
export const LinkVignette: React.FC = () => (
  <Shell testId="vignette-nocode">
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.25, py: 0.8, borderRadius: "8px", border: `1px solid ${M.lineStrong}`, background: M.bg }}>
      <LinkRoundedIcon sx={{ fontSize: 15, color: M.yellow, flexShrink: 0 }} />
      <Typography sx={{ ...monoSx, fontSize: 11.5, color: M.ink, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>dynopay.com/pay/northwind</Typography>
      <Box className="mock-cta" sx={{ ...miniBtnSx, px: 1.1, py: 0.4, fontSize: 11 }}>Copy</Box>
    </Box>
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, boxShadow: `0 0 8px ${GREEN}` }} />
      <Typography sx={{ ...labelSx, color: M.ink2 }}>Link live · 3 payments today</Typography>
    </Box>
  </Shell>
);

/** Hosted checkout — amount + pay button. */
export const CheckoutVignette: React.FC = () => (
  <Shell testId="vignette-checkout">
    <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 1 }}>
      <Box>
        <Typography sx={labelSx}>Total you pay</Typography>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
          <Typography sx={{ ...monoSx, fontSize: 22, fontWeight: 600, color: M.ink, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{AMOUNT_USD}</Typography>
          <Typography sx={{ ...monoSx, fontSize: 10.5, color: M.ink2 }}>USD</Typography>
        </Box>
      </Box>
      <Box sx={{ display: "flex", gap: 0.5 }}>
        {["USDT", "BTC", "ETH"].map((c, i) => (
          <Box key={c} sx={{ ...monoSx, fontSize: 9.5, px: 0.8, py: 0.3, borderRadius: "6px", border: `1px solid ${i === 0 ? M.yellow : M.lineStrong}`, color: i === 0 ? M.yellow : M.ink3 }}>{c}</Box>
        ))}
      </Box>
    </Box>
    <Box className="mock-cta" sx={{ ...miniBtnSx, width: "100%" }}>Pay {AMOUNT_COIN}</Box>
  </Shell>
);

/** Developer API — one request, one webhook. */
export const ApiVignette: React.FC = () => (
  <Shell testId="vignette-api">
    <Box sx={{ ...monoSx, fontSize: 11.5, lineHeight: 1.75, color: M.ink2, whiteSpace: "nowrap", overflow: "hidden" }}>
      <Box>
        <Box component="span" className="mock-cta" sx={{ color: M.yellow, fontWeight: 600, borderRadius: "4px" }}>POST</Box> <Box component="span" sx={{ color: M.ink }}>/v1/payments</Box>
      </Box>
      <Box>{"{ "}<Box component="span" sx={{ color: M.ink }}>amount</Box>: 148.00, <Box component="span" sx={{ color: M.ink }}>currency</Box>: &quot;USD&quot;{" }"}</Box>
      <Box sx={{ color: M.ink3 }}>
        → 201 · <Box component="span" sx={{ color: GREEN }}>webhook</Box> payment.paid
      </Box>
    </Box>
  </Shell>
);
