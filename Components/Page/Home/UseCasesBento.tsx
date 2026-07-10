import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { ContentCopy } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import USDT from "@/assets/Icons/coins/USDT";
import BTC from "@/assets/Icons/coins/BTC";
import ETH from "@/assets/Icons/coins/ETH";
import SwissSectionHead from "./SwissSectionHead";
import { FONT_BODY, FONT_HERO, FONT_TECH, SwissTokens, useSwiss } from "./swiss";

/**
 * UseCasesBento — product-forward bento grid (replaces the stock-photo cards).
 * Every card contains a mini UI mockup built from MUI boxes: checkout,
 * code snippet, payment link, settlement table, campaign progress.
 */

const Tag: React.FC<{ label: string; s: SwissTokens }> = ({ label, s }) => (
  <Typography
    component="span"
    sx={{
      fontFamily: FONT_TECH,
      fontSize: 10.5,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: s.accentText,
      border: `1px solid ${s.dark ? "rgba(204,255,0,0.3)" : "rgba(90,107,0,0.3)"}`,
      borderRadius: "6px",
      px: 1,
      py: 0.4,
      width: "fit-content",
    }}
  >
    {label}
  </Typography>
);

const BentoCard: React.FC<{
  s: SwissTokens;
  tag: string;
  title: string;
  description: string;
  span: { xs: string; md: string };
  testId: string;
  children: React.ReactNode;
}> = ({ s, tag, title, description, span, testId, children }) => (
  <Box
    data-testid={testId}
    sx={{
      gridColumn: { xs: span.xs, md: span.md },
      display: "flex",
      flexDirection: "column",
      gap: 1.5,
      p: { xs: 2.5, md: 3.25 },
      borderRadius: "16px",
      border: `1px solid ${s.line}`,
      backgroundColor: s.surface,
      transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease, border-color 0.25s ease",
      "&:hover": {
        transform: "translate(-3px, -3px)",
        borderColor: s.dark ? "rgba(204,255,0,0.4)" : "rgba(10,10,10,0.3)",
        boxShadow: `6px 6px 0 ${s.accent}`,
      },
    }}
  >
    <Tag label={tag} s={s} />
    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 500, fontSize: { xs: 17, md: 19 }, letterSpacing: "-0.01em", color: s.txt, lineHeight: 1.3 }}>
      {title}
    </Typography>
    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 1.6, color: s.sub, maxWidth: 460 }}>
      {description}
    </Typography>
    <Box aria-hidden sx={{ mt: "auto", pt: 1.5 }}>{children}</Box>
  </Box>
);

/* ── Mockups ─────────────────────────────────────────────────────────── */

const MockCheckout: React.FC<{ s: SwissTokens }> = ({ s }) => {
  const inner = s.dark ? "#0B0B0D" : "#F6F7F4";
  return (
    <Box sx={{ borderRadius: "12px", border: `1px solid ${s.line}`, backgroundColor: inner, p: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1.5 }}>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.12em", color: s.faint }}>ORDER #4821 · TOTAL</Typography>
        <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: 20, color: s.txt }}>$86.00</Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
        {[
          { label: "USDT", Icon: USDT, selected: true },
          { label: "BTC", Icon: BTC, selected: false },
          { label: "ETH", Icon: ETH, selected: false },
        ].map(({ label, Icon, selected }) => (
          <Box
            key={label}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.25,
              py: 0.6,
              borderRadius: "8px",
              border: selected ? `1.5px solid ${s.accentText}` : `1px solid ${s.line}`,
              backgroundColor: selected ? s.accentSoft : "transparent",
            }}
          >
            <Icon width={16} height={16} />
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, fontWeight: 500, color: s.txt }}>{label}</Typography>
          </Box>
        ))}
      </Box>
      <Box
        className="mock-pay-btn"
        sx={{
          py: 1.1,
          borderRadius: "8px",
          textAlign: "center",
          backgroundColor: s.accent,
          color: "#0A0A0A",
          fontFamily: FONT_BODY,
          fontWeight: 600,
          fontSize: 13.5,
        }}
      >
        Pay 86.00 USDT →
      </Box>
    </Box>
  );
};

const MockCode: React.FC<{ s: SwissTokens }> = ({ s }) => (
  <Box sx={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "#0A0A0C", p: 2, overflow: "hidden" }}>
    <Typography component="pre" sx={{ m: 0, fontFamily: FONT_TECH, fontSize: 11.5, lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      <Box component="span" sx={{ color: "#7CB1FF" }}>const</Box>
      <Box component="span" sx={{ color: "#E4E4E7" }}>{" sub = "}</Box>
      <Box component="span" sx={{ color: "#7CB1FF" }}>await</Box>
      <Box component="span" sx={{ color: "#E4E4E7" }}>{" dynopay"}</Box>
      <Box component="span" sx={{ color: "rgba(255,255,255,0.5)" }}>{".payments."}</Box>
      <Box component="span" sx={{ color: "#CCFF00" }}>create</Box>
      <Box component="span" sx={{ color: "#E4E4E7" }}>{"({\n"}</Box>
      <Box component="span" sx={{ color: "rgba(255,255,255,0.5)" }}>{"  amount: "}</Box>
      <Box component="span" sx={{ color: "#CCFF00" }}>29</Box>
      <Box component="span" sx={{ color: "rgba(255,255,255,0.5)" }}>{", currency: "}</Box>
      <Box component="span" sx={{ color: "#F0ABFC" }}>&quot;USDT&quot;</Box>
      <Box component="span" sx={{ color: "rgba(255,255,255,0.5)" }}>{",\n  interval: "}</Box>
      <Box component="span" sx={{ color: "#F0ABFC" }}>&quot;month&quot;</Box>
      <Box component="span" sx={{ color: "#E4E4E7" }}>{"\n});"}</Box>
    </Typography>
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1.5, pt: 1.25, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#CCFF00" }} />
      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, color: "rgba(255,255,255,0.5)" }}>webhook payment.completed · 200 OK</Typography>
    </Box>
  </Box>
);

const MockPayLink: React.FC<{ s: SwissTokens }> = ({ s }) => {
  const inner = s.dark ? "#0B0B0D" : "#F6F7F4";
  return (
    <Box sx={{ borderRadius: "12px", border: `1px solid ${s.line}`, backgroundColor: inner, p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 1.5, py: 1, borderRadius: "8px", border: `1px dashed ${s.lineStrong}`, mb: 1.5 }}>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: s.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          dynopay.me/ava-designs
        </Typography>
        <ContentCopy sx={{ fontSize: 14, color: s.faint, flexShrink: 0 }} />
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 500, color: s.txt }}>UI design template</Typography>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.faint }}>one-time payment</Typography>
        </Box>
        <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: 17, color: s.txt }}>$12.00</Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1.5 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: s.accentText }} />
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.08em", color: s.sub }}>LINK ACTIVE · 0 CODE REQUIRED</Typography>
      </Box>
    </Box>
  );
};

const MockTable: React.FC<{ s: SwissTokens }> = ({ s }) => {
  const rows = [
    { seller: "atlas-digital.io", amount: "+420.00 USDT", chain: "TRC-20" },
    { seller: "orbit.store", amount: "+0.0041 BTC", chain: "Bitcoin" },
    { seller: "nordic-supply.co", amount: "+118.50 USDC", chain: "Polygon" },
  ];
  const inner = s.dark ? "#0B0B0D" : "#F6F7F4";
  return (
    <Box sx={{ borderRadius: "12px", border: `1px solid ${s.line}`, backgroundColor: inner, overflow: "hidden" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 0.8fr 0.7fr", px: 2, py: 1, borderBottom: `1px solid ${s.line}` }}>
        {["SELLER", "AMOUNT", "CHAIN", "STATUS"].map((h) => (
          <Typography key={h} sx={{ fontFamily: FONT_TECH, fontSize: 9.5, letterSpacing: "0.14em", color: s.faint }}>{h}</Typography>
        ))}
      </Box>
      {rows.map((r) => (
        <Box key={r.seller} sx={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 0.8fr 0.7fr", alignItems: "center", px: 2, py: 1.1, "& + &": { borderTop: `1px solid ${s.line}` } }}>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: s.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", pr: 1 }}>{r.seller}</Typography>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, fontWeight: 500, color: s.txt }}>{r.amount}</Typography>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, color: s.sub }}>{r.chain}</Typography>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, color: s.accentText }}>Settled ✓</Typography>
        </Box>
      ))}
    </Box>
  );
};

const MockCampaign: React.FC<{ s: SwissTokens; animate: boolean }> = ({ s, animate }) => {
  const inner = s.dark ? "#0B0B0D" : "#F6F7F4";
  return (
    <Box sx={{ borderRadius: "12px", border: `1px solid ${s.line}`, backgroundColor: inner, p: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 1, mb: 1.25 }}>
        <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: s.txt }}>Clean Water Fund</Typography>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: s.sub }}>
          <Box component="span" sx={{ color: s.accentText, fontWeight: 500 }}>3,420</Box> / 5,000 USDT · 214 supporters
        </Typography>
      </Box>
      <Box sx={{ height: 10, borderRadius: "999px", backgroundColor: s.dark ? "rgba(255,255,255,0.07)" : "rgba(10,10,10,0.07)", overflow: "hidden", mb: 1.5 }}>
        <Box sx={{ height: "100%", width: animate ? "68.4%" : "0%", borderRadius: "999px", backgroundColor: s.accent, transition: "width 1.2s cubic-bezier(0.16,1,0.3,1) 0.2s" }} />
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {["10", "25", "50", "Custom"].map((a, i) => (
          <Box key={a} sx={{ px: 1.5, py: 0.5, borderRadius: "8px", border: i === 1 ? `1.5px solid ${s.accentText}` : `1px solid ${s.line}`, backgroundColor: i === 1 ? s.accentSoft : "transparent" }}>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: s.txt }}>{i < 3 ? `$${a}` : a}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/* ── Section ─────────────────────────────────────────────────────────── */

const UseCasesBento: React.FC = () => {
  const s = useSwiss();
  const { t } = useTranslation("landing");
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Box component="section" id="use-cases" ref={ref} data-testid="use-cases-bento" sx={{ py: { xs: 9, md: 15 }, px: { xs: 3, md: 6 }, maxWidth: 1400, mx: "auto" }}>
      <SwissSectionHead num="03" eyebrow={t("useCases")} title={t("useCaseTitle")} highlight={t("useCaseHighlight")} sub={t("useCaseSubtitle")} />

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: { xs: 2, md: 2.5 } }}>
        <BentoCard s={s} span={{ xs: "span 12", md: "span 7" }} testId="usecase-card-stores" tag={t("useCase1Tag")} title={t("useCase1Title")} description={t("useCase1Description")}>
          <MockCheckout s={s} />
        </BentoCard>

        <BentoCard s={s} span={{ xs: "span 12", md: "span 5" }} testId="usecase-card-saas" tag={t("useCase3Tag")} title={t("useCase3Title")} description={t("useCase3Description")}>
          <MockCode s={s} />
        </BentoCard>

        <BentoCard s={s} span={{ xs: "span 12", md: "span 5" }} testId="usecase-card-creators" tag={t("useCase2Tag")} title={t("useCase2Title")} description={t("useCase2Description")}>
          <MockPayLink s={s} />
        </BentoCard>

        <BentoCard s={s} span={{ xs: "span 12", md: "span 7" }} testId="usecase-card-marketplaces" tag={t("useCase4Tag")} title={t("useCase4Title")} description={t("useCase4Description")}>
          <MockTable s={s} />
        </BentoCard>

        <BentoCard s={s} span={{ xs: "span 12", md: "span 12" }} testId="usecase-card-donations" tag={t("useCase5Tag")} title={t("useCase5Title")} description={t("useCase5Description")}>
          <MockCampaign s={s} animate={visible} />
        </BentoCard>
      </Box>
    </Box>
  );
};

export default memo(UseCasesBento);
