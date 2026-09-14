import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Box, Typography, Button, useMediaQuery, useTheme } from "@mui/material";
import { styled } from "@mui/material/styles";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Scene } from "@/Components/Page/HowTo/HowToScene";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import { FONT_BODY, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import PublicPageHero from "@/Components/Page/Home/v5/PublicPageHero";
import PublicFinalCta from "@/Components/Page/Home/v5/PublicFinalCta";
import { Section, PrimaryBtn, SecondaryBtn, cardSx } from "@/Components/Page/Home/v5/shared";

/* Public "how it works" walkthrough (/how-to). A self-playing, chaptered
 * product tour that the activation-drip emails link to as their how-to video.
 * Aurora design system; English copy (page localization is a later follow-up). */

const CHAPTER_MS = 4600;
const SITE_URL = "https://dynopay.com";
const HOW_TO_DESC =
  "A quick walkthrough: create a payment link, share it, get paid in Bitcoin, Ethereum or stablecoins, and settle to your own wallet. See how Dynopay works.";

const CHAPTERS = [
  {
    id: "create",
    Icon: LinkRoundedIcon,
    tag: "STEP 1",
    title: "Create a payment link",
    desc: "Name a price, add a short description, hit create. No code, no contract — you get a shareable link in seconds.",
  },
  {
    id: "share",
    Icon: ShareRoundedIcon,
    tag: "STEP 2",
    title: "Share it anywhere",
    desc: "Drop the link into a chat, an invoice, your bio or a checkout button. One link works everywhere your customers are.",
  },
  {
    id: "pay",
    Icon: BoltRoundedIcon,
    tag: "STEP 3",
    title: "Your customer pays in crypto",
    desc: "They pick Bitcoin, Ethereum or a stablecoin and pay. You watch it confirm on-chain in real time — no chargebacks, ever.",
  },
  {
    id: "settle",
    Icon: AccountBalanceWalletRoundedIcon,
    tag: "STEP 4",
    title: "Funds land in your wallet",
    desc: "Payments settle straight to a wallet you control — keep the original coin, or auto-convert to USDC or USDT. Your choice.",
  },
] as const;

const PageWrapper = styled(Box)({ width: "100%" });

// ─── Device / browser frame that houses the animated scene ───────────────────
const HowToPage = () => {
  const s = useAurora();
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const reduce = useReducedMotion();

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(!reduce);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Progress engine — drives the per-chapter bar + auto-advance. Pausable.
  useEffect(() => {
    if (!playing || reduce) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        const next = p + (dt / CHAPTER_MS) * 100;
        if (next >= 100) {
          setStep((cur) => (cur + 1) % CHAPTERS.length);
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, reduce, step]);

  const goToChapter = (i: number) => {
    setStep(i);
    setProgress(0);
  };

  const active = CHAPTERS[step];

  return (
    <>
      <Head>
        <title>How Dynopay works — accept crypto in about 2 minutes</title>
        <meta name="description" content={HOW_TO_DESC} />
        <link key="canonical" rel="canonical" href={`${SITE_URL}/how-to`} />
        <meta key="og:title" property="og:title" content="How Dynopay works — accept crypto in about 2 minutes" />
        <meta key="og:description" property="og:description" content={HOW_TO_DESC} />
        <meta key="twitter:title" name="twitter:title" content="How Dynopay works — accept crypto in about 2 minutes" />
        <meta key="twitter:description" name="twitter:description" content={HOW_TO_DESC} />
      </Head>

      <PageWrapper sx={{ background: s.bg }} data-testid="how-to-page">
        {/* Hero */}
        <PublicPageHero
          testId="how-to-hero"
          compact
          eyebrow="How it works"
          title={
            <>
              Get paid in crypto,
              <br />
              in about two minutes
            </>
          }
          body="No code and no crypto experience needed. Watch the four steps from creating your first link to money landing in your wallet."
        />

        {/* The "video" — player + chapter rail */}
        <Section testId="how-to-walkthrough" sx={{ pt: { xs: 2, md: 3 } }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.35fr 0.9fr" },
              gap: { xs: 3, md: 4 },
              alignItems: "stretch",
            }}
          >
            {/* Player */}
            <Box
              data-testid="how-to-video"
              sx={{
                position: "relative",
                borderRadius: "24px",
                overflow: "hidden",
                border: `1px solid ${s.lineStrong}`,
                background: s.dark
                  ? "linear-gradient(160deg,#17171F 0%,#101015 100%)"
                  : "linear-gradient(160deg,#FFFFFF 0%,#F3EFEA 100%)",
                boxShadow: s.dark
                  ? "0 30px 80px -40px rgba(0,0,0,0.8)"
                  : "0 30px 80px -40px rgba(79,70,229,0.35)",
                minHeight: { xs: 380, md: 460 },
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Browser chrome */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2,
                  py: 1.5,
                  borderBottom: `1px solid ${s.line}`,
                }}
              >
                {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                  <Box key={c} sx={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
                ))}
                <Box
                  sx={{
                    ml: 1.5,
                    flex: 1,
                    maxWidth: 260,
                    height: 24,
                    borderRadius: 999,
                    background: s.bgAlt,
                    display: "flex",
                    alignItems: "center",
                    px: 1.5,
                    fontFamily: FONT_TECH,
                    fontSize: 11,
                    color: s.ink3,
                  }}
                >
                  dynopay.com
                </Box>
              </Box>

              {/* Scene stage */}
              <Box sx={{ position: "relative", flex: 1, p: { xs: 2.5, md: 4 } }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active.id}
                    initial={reduce ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -14 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    style={{ height: "100%" }}
                  >
                    <Scene id={active.id} s={s} reduce={!!reduce} />
                  </motion.div>
                </AnimatePresence>
              </Box>

              {/* Controls */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  px: { xs: 2, md: 3 },
                  py: 2,
                  borderTop: `1px solid ${s.line}`,
                }}
              >
                <Button
                  data-testid="how-to-play-toggle"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? "Pause" : "Play"}
                  sx={{
                    minWidth: 0,
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    p: 0,
                    color: "#fff",
                    background: s.aurora,
                    "&:hover": { background: s.aurora, filter: "brightness(1.05)" },
                  }}
                >
                  {playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
                </Button>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", gap: 0.75 }}>
                    {CHAPTERS.map((c, i) => (
                      <Box
                        key={c.id}
                        onClick={() => goToChapter(i)}
                        sx={{
                          flex: 1,
                          height: 5,
                          borderRadius: 999,
                          background: s.line,
                          overflow: "hidden",
                          cursor: "pointer",
                        }}
                      >
                        <Box
                          sx={{
                            height: "100%",
                            borderRadius: 999,
                            background: s.aurora,
                            width: i < step ? "100%" : i === step ? `${progress}%` : "0%",
                            transition: i === step ? "none" : "width 0.3s ease",
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                  <Typography sx={{ mt: 1, fontFamily: FONT_TECH, fontSize: 11, color: s.ink3, letterSpacing: "0.08em" }}>
                    {active.tag} · {step + 1} / {CHAPTERS.length}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Chapter rail */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {CHAPTERS.map((c, i) => {
                const isActive = i === step;
                return (
                  <Box
                    key={c.id}
                    data-testid={`how-to-chapter-${i}`}
                    onClick={() => goToChapter(i)}
                    role="button"
                    sx={{
                      ...cardSx(s, { hover: false }),
                      display: "flex",
                      gap: 1.75,
                      p: 2,
                      cursor: "pointer",
                      border: `1px solid ${isActive ? s.indigo : s.line}`,
                      background: isActive ? (s.dark ? "rgba(129,140,248,0.08)" : "rgba(79,70,229,0.05)") : s.surface,
                      transition: "border-color 0.25s ease, background 0.25s ease",
                      "&:hover": { borderColor: s.lineStrong },
                    }}
                  >
                    <Box
                      sx={{
                        flexShrink: 0,
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        display: "grid",
                        placeItems: "center",
                        color: isActive ? "#fff" : s.ink2,
                        background: isActive ? s.aurora : s.bgAlt,
                      }}
                    >
                      <c.Icon fontSize="small" />
                    </Box>
                    <Box>
                      <Typography sx={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, color: s.ink, mb: 0.25 }}>
                        {c.title}
                      </Typography>
                      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 1.5, color: s.ink3 }}>
                        {c.desc}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* CTAs */}
          <Box sx={{ mt: { xs: 5, md: 7 }, display: "flex", flexWrap: "wrap", gap: 1.5, justifyContent: "center" }}>
            <PrimaryBtn data-testid="how-to-cta-primary" onClick={() => router.push("/auth/register?ref=how_to")} endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />}>
              Create your first link
            </PrimaryBtn>
            <SecondaryBtn data-testid="how-to-cta-secondary" onClick={() => router.push("/documentation")}>
              Read the docs
            </SecondaryBtn>
          </Box>
        </Section>

        <PublicFinalCta attributionRef="how_to_final" />
      </PageWrapper>
    </>
  );
};


export default HowToPage;
