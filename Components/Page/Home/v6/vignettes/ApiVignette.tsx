import React, { memo } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Label, VigFrame } from "./primitives";

const mono = { fontFamily: "var(--font-tech)", fontSize: 12, lineHeight: 1.7, color: "#D4D4D8", whiteSpace: "pre" as const, m: 0, overflow: "hidden" };
const K = ({ c }: { c: string }) => <Box component="span" sx={{ color: "#FFD100" }}>{c}</Box>;
const S = ({ c }: { c: string }) => <Box component="span" sx={{ color: "#6EE7B7" }}>{c}</Box>;
const N = ({ c }: { c: string }) => <Box component="span" sx={{ color: "#FCD34D" }}>{c}</Box>;

const Term: React.FC<React.PropsWithChildren<{ title: string; sx?: object }>> = ({ title, children, sx }) => (
  <Box sx={{ position: "absolute", borderRadius: "14px", background: "#0B0B0F", border: "1px solid rgba(255,255,255,0.08)", p: 1.6, boxShadow: "0 30px 60px -30px rgba(0,0,0,0.8)", ...sx }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
      <Box sx={{ display: "flex", gap: 0.5 }}>{["#FF5F56", "#FFBD2E", "#27C93F"].map((c) => <Box key={c} sx={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}</Box>
      <Label sx={{ color: "rgba(255,255,255,0.5)" }}>{title}</Label>
    </Box>
    {children}
  </Box>
);

/** API — one request creates a payment; the signed webhook reports it settled. */
const ApiVignette: React.FC = () => {
  const { t } = useTranslation("landing");
  return (
    <VigFrame height={300} testId="vignette-api">
      <Term title={t("v6.vig.request")} sx={{ left: 22, top: 22, width: "52%" }}>
        <Box component="pre" sx={mono}>
          <K c="POST" /> /api/v1/payments{"\n"}
          {"{"}{"\n"}
          {"  "}<S c='"amount"' />: <N c="49.00" />,{"\n"}
          {"  "}<S c='"currency"' />: <S c='"USD"' />,{"\n"}
          {"  "}<S c='"settle_in"' />: <S c='"USDC"' />{"\n"}
          {"}"}
        </Box>
      </Term>
      <Term title={t("v6.vig.webhook")} sx={{ right: 22, bottom: 22, width: "58%", transition: "transform 600ms cubic-bezier(0.16,1,0.3,1)", ".bento:hover &": { transform: "translateY(-8px)" } }}>
        <Box component="pre" sx={mono}>
          {"{"}{"\n"}
          {"  "}<S c='"status"' />: <S c='"settled"' />,{"\n"}
          {"  "}<S c='"paid"' />: <S c='"0.0182 BTC"' />,{"\n"}
          {"  "}<S c='"settled_as"' />: <S c='"49.00 USDC"' />,{"\n"}
          {"  "}<S c='"tx"' />: <S c='"0x9f3a…c21e"' />{"\n"}
          {"}"}
        </Box>
      </Term>
    </VigFrame>
  );
};

export default memo(ApiVignette);
