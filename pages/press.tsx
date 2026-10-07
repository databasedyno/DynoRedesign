import React, { useCallback } from "react";
import Head from "next/head";
import { Box, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import useToast from "@/hooks/useToast";
import {
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  GradientText,
  PANEL,
  Reveal,
  SectionV8,
  SectionHeadV8,
  useConsole,
} from "@/Components/Page/Home/v8/kit";
import PageHeroV8 from "@/Components/Page/Home/v8/PageHeroV8";
import CtaBandV8 from "@/Components/Page/Home/v8/CtaBandV8";

/* /press — Dynopay brand & press kit, rebuilt on the v8 marketing system (2026-10).
   Serves the new "Settle-D" logo system (lockups, mark, colours, do/don't),
   a downloadable kit, plus press boilerplate + company facts for media. */

const KIT = "/press/dynopay-brand-kit.zip";
const GOLD = "#FFD100";

const openSupportChat = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("dynopay:open-support-chat"));
};

type Lockup = { name: string; file: string; bg: "dark" | "light" | "tile"; wide?: boolean };

const PRIMARY: Lockup[] = [
  { name: "Horizontal · on dark", file: "/press/dynopay-logo-white.svg", bg: "dark", wide: true },
  { name: "Horizontal · on light", file: "/press/dynopay-logo-black.svg", bg: "light", wide: true },
  { name: "Stacked · on dark", file: "/press/dynopay-logo-stacked-white.svg", bg: "dark" },
  { name: "Stacked · on light", file: "/press/dynopay-logo-stacked-black.svg", bg: "light" },
];
const MARKS: Lockup[] = [
  { name: "Mark · gold", file: "/press/dynopay-mark-on-dark.svg", bg: "dark" },
  { name: "Mark · espresso", file: "/press/dynopay-mark-on-light.svg", bg: "light" },
  { name: "App / favicon tile", file: "/press/dynopay-mark-tile.svg", bg: "tile" },
];
const SECONDARY: Lockup[] = [
  { name: "Wordmark · on dark", file: "/press/dynopay-wordmark-white.svg", bg: "dark", wide: true },
  { name: "Wordmark · on light", file: "/press/dynopay-wordmark-black.svg", bg: "light", wide: true },
  { name: "Mono · white", file: "/press/dynopay-logo-mono-light.svg", bg: "dark", wide: true },
  { name: "Mono · black", file: "/press/dynopay-logo-mono-dark.svg", bg: "light", wide: true },
];

const COLORS = [
  { name: "Dynopay Gold", hex: "#FFD100", note: "Single accent. Never as text on white." },
  { name: "Espresso", hex: "#121214", note: "Dark base; mark & wordmark on light." },
  { name: "Cream", hex: "#F5F7FA", note: "Wordmark on dark grounds." },
  { name: "Ink", hex: "#1A1A19", note: "Body text on light." },
];

const DOS = [
  "Put the gold mark on dark; espresso on light.",
  "Use the mark alone for favicons, avatars and tight corners.",
  "Keep the arrow pointing right — the direction of settlement.",
  "Give it clear space of at least the D's stem on all sides.",
];
const DONTS = [
  "No gradients, 3D, bevels, shadows or glows on the mark.",
  "Don't recolour it, add a second accent, or bring back the old aqua.",
  "Don't stretch, rotate, outline or rebuild the wordmark.",
  "Don't place the gold lockup on a busy or low-contrast photo.",
];

const FACTS = [
  { k: "Founded", v: "2024" },
  { k: "Model", v: "Non-custodial gateway" },
  { k: "Networks", v: "9 chains · 15 assets" },
  { k: "Pricing", v: "From 0.5%, no setup fee" },
  { k: "Settlement", v: "Direct to your wallet" },
  { k: "Chargebacks", v: "None — settled on-chain" },
];

const BOILERPLATE =
  "Dynopay is a non-custodial crypto payment gateway. Merchants, creators and fundraisers accept Bitcoin, Ethereum, stablecoins and more across 9 blockchains — with funds settling straight to a wallet they control. No custody, no chargebacks, fees from 0.5%.";

const tileBg = (bg: Lockup["bg"]) => (bg === "dark" ? PANEL.bg : bg === "tile" ? "#2A2A30" : "#FFFFFF");

const LockupCard: React.FC<{ item: Lockup }> = ({ item }) => {
  const s = useConsole();
  const base = item.file.split("/").pop() || "";
  return (
    <Box
      data-testid={`press-lockup-${base.replace(".svg", "")}`}
      sx={{ borderRadius: "18px", border: `1px solid ${s.line}`, overflow: "hidden", background: s.canvas, gridColumn: item.wide ? { xs: "auto", sm: "span 2" } : "auto" }}
    >
      <Box sx={{ background: tileBg(item.bg), display: "flex", alignItems: "center", justifyContent: "center", p: { xs: 4, md: 5 }, minHeight: 150 }}>
        <Box component="img" src={item.file} alt={item.name} sx={{ maxWidth: item.bg === "tile" ? 88 : "70%", maxHeight: 96, width: "auto", height: "auto" }} />
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.25, py: 1.6, borderTop: `1px solid ${s.line}` }}>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.04em", color: s.ink2 }}>{item.name}</Typography>
        <Box component="a" href={item.file} download data-testid={`press-download-${base}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, color: s.accent, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
          SVG <DownloadRoundedIcon sx={{ fontSize: 15 }} />
        </Box>
      </Box>
    </Box>
  );
};

const PressPage: React.FC = () => {
  const s = useConsole();

  const { showToast } = useToast();

  const copy = useCallback((text: string, label: string) => {
    try {
      navigator.clipboard?.writeText(text);
      showToast({ message: label, severity: "success" });
    } catch {
      showToast({ message: "Couldn't copy", severity: "error" });
    }
  }, [showToast]);

  const grid = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: { xs: 2, md: 2.5 } } as const;
  const labelSx = { fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: s.ink3, mb: 2 };

  return (
    <>
      <Head>
        <title>Brand & press kit · Dynopay</title>
        <meta name="description" content="Download the Dynopay logo kit — lockups, the mark, colours and usage guidelines for partners and press. Vector SVGs, favicon, app icon and share image." />
      </Head>

      <Box component="main" data-testid="press-page">
        <PageHeroV8
          testId="press-hero"
          eyebrow="Brand & press"
          title={<>The Dynopay <GradientText>brand kit</GradientText></>}
          body="Everything you need to represent Dynopay accurately — the mark, the lockups, our colours and a few simple rules. Vectors scale from a 16px favicon to a billboard."
          note="SVG (vector) · gold-on-dark, dark-on-light & monochrome · favicon, app icon & share image"
          actions={
            <>
              <Box component="a" href={KIT} download data-testid="press-download-kit" sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 3.5, py: 1.5, borderRadius: "999px", background: GOLD, color: "#121214", textDecoration: "none", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 16, transition: "filter 160ms ease, transform 160ms ease", "&:hover": { filter: "brightness(1.05)", transform: "translateY(-1px)" } }}>
                Download kit <DownloadRoundedIcon sx={{ fontSize: 18 }} />
              </Box>
              <Box component="a" href="#guidelines" data-testid="press-guidelines-link" sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 3.5, py: 1.5, borderRadius: "999px", border: `1px solid ${s.line}`, color: s.ink, textDecoration: "none", fontFamily: FONT_BODY, fontWeight: 600, fontSize: 16, transition: "border-color 160ms ease", "&:hover": { borderColor: s.ink3 } }}>
                Usage guidelines
              </Box>
            </>
          }
        />

        {/* Lockups */}
        <SectionV8 testId="press-lockups">
          <SectionHeadV8 eyebrow="Logos & lockups" title="Pick the lockup that fits the space" lead="Use the horizontal lockup by default. Drop to the mark alone in small or square contexts, and the wordmark where the mark already appears nearby." />
          <Reveal sx={{ mb: 4 }}>
            <Typography sx={labelSx}>Primary</Typography>
            <Box sx={grid}>{PRIMARY.map((l) => <LockupCard key={l.file} item={l} />)}</Box>
          </Reveal>
          <Reveal sx={{ mb: 4 }} delay={0.05}>
            <Typography sx={labelSx}>Mark</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: { xs: 2, md: 2.5 } }}>{MARKS.map((l) => <LockupCard key={l.file} item={l} />)}</Box>
          </Reveal>
          <Reveal delay={0.1}>
            <Typography sx={labelSx}>Wordmark & monochrome</Typography>
            <Box sx={grid}>{SECONDARY.map((l) => <LockupCard key={l.file} item={l} />)}</Box>
          </Reveal>
        </SectionV8>

        {/* Colours */}
        <SectionV8 dark glow testId="press-colors">
          <SectionHeadV8 dark eyebrow="Colour" title="One gold accent on a dark base" lead="Gold is held back as the single accent — used for the mark and primary actions only. Tap a swatch to copy its hex." />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: { xs: 2, md: 2.5 } }}>
            {COLORS.map((c) => (
              <Box key={c.hex} role="button" tabIndex={0} onClick={() => copy(c.hex, `Copied ${c.hex}`)} onKeyDown={(e) => { if (e.key === "Enter") copy(c.hex, `Copied ${c.hex}`); }} data-testid={`press-color-${c.hex.replace("#", "")}`} sx={{ cursor: "pointer", borderRadius: "16px", overflow: "hidden", border: `1px solid ${PANEL.line}`, background: PANEL.surface, transition: "border-color 160ms ease", "&:hover": { borderColor: PANEL.lineStrong } }}>
                <Box sx={{ height: 92, background: c.hex, borderBottom: `1px solid ${PANEL.line}` }} />
                <Box sx={{ p: 2 }}>
                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14.5, color: PANEL.ink }}>{c.name}</Typography>
                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, color: PANEL.gold, mt: 0.5 }}>{c.hex}</Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12, lineHeight: 1.45, color: PANEL.ink2, mt: 1 }}>{c.note}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </SectionV8>

        {/* Guidelines */}
        <SectionV8 id="guidelines" testId="press-guidelines">
          <SectionHeadV8 eyebrow="Usage" title="A few simple rules" lead="Keep the mark confident and consistent. When in doubt, give it room and keep it one colour." />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: { xs: 2, md: 2.5 }, mb: { xs: 3, md: 4 } }}>
            {[
              { k: "Clear space", v: "Keep a margin of at least the width of the D's stem on every side." },
              { k: "Minimum size", v: "Mark no smaller than 16px; the full lockup no smaller than 96px wide." },
            ].map((g) => (
              <Box key={g.k} sx={{ borderRadius: "16px", border: `1px solid ${s.line}`, p: { xs: 3, md: 3.5 }, background: s.canvas }}>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: s.accent, mb: 1 }}>{g.k}</Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6, color: s.ink2 }}>{g.v}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 2, md: 2.5 } }}>
            <Box data-testid="press-dos" sx={{ borderRadius: "16px", border: `1px solid ${s.line}`, p: { xs: 3, md: 3.5 }, background: s.canvas }}>
              <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: s.ink, mb: 2 }}>Do</Typography>
              {DOS.map((d) => (
                <Box key={d} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", mb: 1.5 }}>
                  <CheckRoundedIcon sx={{ fontSize: 18, color: "#2E9E6B", mt: "1px", flexShrink: 0 }} />
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.55, color: s.ink2 }}>{d}</Typography>
                </Box>
              ))}
            </Box>
            <Box data-testid="press-donts" sx={{ borderRadius: "16px", border: `1px solid ${s.line}`, p: { xs: 3, md: 3.5 }, background: s.canvas }}>
              <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: s.ink, mb: 2 }}>Don&apos;t</Typography>
              {DONTS.map((d) => (
                <Box key={d} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", mb: 1.5 }}>
                  <CloseRoundedIcon sx={{ fontSize: 18, color: "#D1584F", mt: "1px", flexShrink: 0 }} />
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.55, color: s.ink2 }}>{d}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </SectionV8>

        {/* Facts + boilerplate for media */}
        <SectionV8 testId="press-facts" sx={{ background: s.dark ? PANEL.bg2 : "#F2F3F1" }}>
          <SectionHeadV8 eyebrow="For media" title="Company facts & boilerplate" lead="Quick, accurate reference for articles and listings. Everything here is current." />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" }, gap: { xs: 3, md: 4 } }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr" }, gap: { xs: 1.5, md: 2 } }}>
              {FACTS.map((f) => (
                <Box key={f.k} sx={{ borderRadius: "14px", border: `1px solid ${s.line}`, p: 2.25, background: s.canvas }}>
                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: s.ink3 }}>{f.k}</Typography>
                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15.5, color: s.ink, mt: 0.6, letterSpacing: "-0.01em" }}>{f.v}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ borderRadius: "16px", border: `1px solid ${s.line}`, p: { xs: 3, md: 3.5 }, background: s.canvas, display: "flex", flexDirection: "column" }}>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: s.accent, mb: 1.5 }}>Boilerplate</Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.7, color: s.ink2, flexGrow: 1 }}>{BOILERPLATE}</Typography>
              <Box sx={{ display: "flex", gap: 1.5, mt: 3, flexWrap: "wrap" }}>
                <Box component="button" onClick={() => copy(BOILERPLATE, "Boilerplate copied")} data-testid="press-copy-boilerplate" sx={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.8, px: 2.25, py: 1, borderRadius: "999px", border: "none", background: s.accent, color: s.dark ? "#121214" : "#fff", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5 }}>
                  <ContentCopyRoundedIcon sx={{ fontSize: 15 }} /> Copy boilerplate
                </Box>
                <Box component="button" onClick={openSupportChat} data-testid="press-contact" sx={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.8, px: 2.25, py: 1, borderRadius: "999px", border: `1px solid ${s.line}`, background: "transparent", color: s.ink, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13.5 }}>
                  Contact press
                </Box>
              </Box>
            </Box>
          </Box>
        </SectionV8>

        <CtaBandV8
          testId="press-cta"
          badge="Media & partners"
          title="Building or writing about"
          highlight="Dynopay?"
          body="Grab the kit above, or reach out and we'll help with anything you need — assets, facts or a quote."
          primaryLabel="Start free"
          primaryRef="press-cta"
          secondaryLabel="Read the docs"
          secondaryHref="/documentation"
        />
      </Box>
    </>
  );
};

export default PressPage;
