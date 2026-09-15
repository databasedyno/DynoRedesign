import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, MenuItem, TextField } from "@mui/material";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import { cardSx } from "@/Components/Page/Home/v5/shared";

export interface WorkedTier { name: string; pct: number; accent: string; accentSoft: string }
export interface WorkedCurrency { code: string; label: string; netFee: number }

interface Props {
  tiers: WorkedTier[];
  currentTierName: string;
  currencies: WorkedCurrency[];
  feeFor: (c: WorkedCurrency) => number;
  live: boolean;
}

const SALE = 100;
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fee = (n: number) => (n > 0 && n < 0.01 ? "< $0.01" : money(n));

/** "$100 sale → you receive $X" — tier % + live network fee for the chosen payout coin. */
const FeesWorkedExample = ({ tiers, currentTierName, currencies, feeFor, live }: Props) => {
  const { t } = useTranslation("fees");
  const s = useAurora();
  const [tierName, setTierName] = useState(currentTierName);
  const [code, setCode] = useState(currencies[0].code);
  const tier = tiers.find((x) => x.name === tierName) || tiers[0];
  const cur = currencies.find((c) => c.code === code) || currencies[0];
  const platform = (SALE * tier.pct) / 100;
  const network = feeFor(cur);
  const receive = Math.max(0, SALE - platform - network);

  const row = (label: string, value: string, testId: string, strong = false) => (
    <Box data-testid={testId} sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, py: 1.1, borderBottom: strong ? "none" : `1px dashed ${s.line}` }}>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: strong ? 16 : 14.5, color: strong ? s.ink : s.ink3, fontWeight: strong ? 700 : 400 }}>{label}</Typography>
      <Typography sx={{ fontFamily: FONT_TECH, fontSize: strong ? 26 : 15, fontWeight: 700, color: strong ? tier.accent : s.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</Typography>
    </Box>
  );

  return (
    <Box data-testid="fees-worked-example" sx={{ ...cardSx(s, { hover: false, radius: 24 }), border: `1px solid ${s.lineStrong}`, p: { xs: 3, md: 4 }, maxWidth: 860, mx: "auto" }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2.5 }}>
        <Box>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, letterSpacing: "0.22em", textTransform: "uppercase", color: tier.accent, fontWeight: 600 }}>
            {t("worked.eyebrow", { defaultValue: "Worked example" })}
          </Typography>
          <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 24, md: 30 }, letterSpacing: "-0.02em", color: s.ink, mt: 0.5 }} data-testid="fees-worked-headline">
            {t("worked.headline", { sale: money(SALE), receive: money(receive), defaultValue: "{{sale}} sale → you receive {{receive}}" })}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }} data-testid="fees-worked-tiers">
          {tiers.map((tr) => {
            const on = tr.name === tier.name;
            return (
              <Box
                key={tr.name}
                component="button"
                type="button"
                onClick={() => setTierName(tr.name)}
                data-testid={`fees-worked-tier-${tr.name.toLowerCase()}`}
                aria-pressed={on}
                sx={{ cursor: "pointer", border: `1px solid ${on ? tr.accent : s.line}`, background: on ? tr.accent : "transparent", color: on ? "#fff" : s.ink3, borderRadius: "999px", px: 1.5, py: 0.55, fontFamily: FONT_TECH, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", transition: "background-color .15s, color .15s, border-color .15s" }}
              >
                {tr.name} · {tr.pct}%
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 260px" }, gap: { xs: 2, md: 4 }, alignItems: "start" }}>
        <Box>
          {row(t("worked.sale", { defaultValue: "Customer pays" }), money(SALE), "fees-worked-sale")}
          {row(t("worked.platform", { tier: tier.name, pct: tier.pct, defaultValue: "Dynopay fee ({{tier}} · {{pct}}%)" }), `− ${money(platform)}`, "fees-worked-platform")}
          {row(t("worked.network", { coin: cur.label, defaultValue: "Network fee · {{coin}}" }), `− ${fee(network)}`, "fees-worked-network")}
          {row(t("worked.receive", { defaultValue: "You receive" }), money(receive), "fees-worked-receive", true)}
        </Box>
        <Box>
          <TextField
            select
            fullWidth
            size="small"
            label={t("worked.payoutCoin", { defaultValue: "Paid out in" })}
            value={cur.code}
            onChange={(e) => setCode(e.target.value)}
            inputProps={{ "data-testid": "fees-worked-coin" }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          >
            {currencies.map((c) => (
              <MenuItem key={c.code} value={c.code}>{c.label} — {fee(feeFor(c))}</MenuItem>
            ))}
          </TextField>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: s.ink3, mt: 1.5, lineHeight: 1.5 }} data-testid="fees-worked-footnote">
            {live
              ? t("worked.footnoteLive", { defaultValue: "Network fee is live from the chain. Your exact fee is shown on every invoice — no hidden extras." })
              : t("worked.footnoteTypical", { defaultValue: "Network fee shown is typical for this chain. Your exact fee is shown on every invoice — no hidden extras." })}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default FeesWorkedExample;
