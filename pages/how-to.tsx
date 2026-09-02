import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Box, Typography, Button, useMediaQuery, useTheme } from "@mui/material";
import { styled } from "@mui/material/styles";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import { FONT_BODY, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import { Eyebrow, HeadlineXL, Body } from "@/Components/Page/Home/v3/styled.v3";
import FinalCTAAurora from "@/Components/Page/Home/v3/FinalCTAAurora";

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

const PageWrapper = styled(Box)(({ theme }) => ({
  width: "100%",
  paddingTop: 65,
  [theme.breakpoints.down("md")]: { paddingTop: 76 },
}));

const Shell = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 1200,
  margin: "0 auto",
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
}));

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

      <PageWrapper data-testid="how-to-page">
        {/* Hero */}
        <Shell sx={{ pt: { xs: 6, md: 10 }, pb: { xs: 4, md: 6 }, textAlign: "center" }}>
          <Eyebrow sx={{ mb: 2 }}>How it works</Eyebrow>
          <HeadlineXL component="h1" sx={{ mb: 2.5, maxWidth: 900, mx: "auto" }}>
            Get paid in crypto,
            <br />
            in about two minutes
          </HeadlineXL>
          <Body sx={{ maxWidth: 620, mx: "auto", fontSize: { xs: 16, md: 18 } }}>
            No code and no crypto experience needed. Watch the four steps from creating your
            first link to money landing in your wallet.
          </Body>
        </Shell>

        {/* The "video" — player + chapter rail */}
        <Shell sx={{ pb: { xs: 8, md: 12 } }}>
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
                borderRadius: 4,
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
                      display: "flex",
                      gap: 1.75,
                      p: 2,
                      borderRadius: 3,
                      cursor: "pointer",
                      border: `1px solid ${isActive ? s.indigo : s.line}`,
                      background: isActive ? (s.dark ? "rgba(129,140,248,0.08)" : "rgba(79,70,229,0.05)") : "transparent",
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
          <Box sx={{ mt: { xs: 5, md: 7 }, display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
            <Button
              data-testid="how-to-cta-primary"
              onClick={() => router.push("/auth/register")}
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                px: 3.5,
                py: 1.4,
                borderRadius: 999,
                fontWeight: 700,
                textTransform: "none",
                fontSize: 16,
                color: "#fff",
                background: s.aurora,
                "&:hover": { background: s.aurora, filter: "brightness(1.05)" },
              }}
            >
              Create your first link
            </Button>
            <Button
              data-testid="how-to-cta-secondary"
              onClick={() => router.push("/documentation")}
              sx={{
                px: 3.5,
                py: 1.4,
                borderRadius: 999,
                fontWeight: 700,
                textTransform: "none",
                fontSize: 16,
                color: s.ink,
                border: `1px solid ${s.lineStrong}`,
                "&:hover": { borderColor: s.indigo, background: "transparent" },
              }}
            >
              Read the docs
            </Button>
          </Box>
        </Shell>

        <FinalCTAAurora />
      </PageWrapper>
    </>
  );
};

// ─── Individual scenes ───────────────────────────────────────────────────────
type Tokens = ReturnType<typeof useAurora>;

const Card = ({ s, children, sx }: { s: Tokens; children: React.ReactNode; sx?: object }) => (
  <Box
    sx={{
      borderRadius: 3,
      border: `1px solid ${s.line}`,
      background: s.surface,
      p: 2.5,
      boxShadow: s.dark ? "none" : "0 10px 30px -20px rgba(10,10,10,0.4)",
      ...sx,
    }}
  >
    {children}
  </Box>
);

const FieldRow = ({ s, label, value }: { s: Tokens; label: string; value: string }) => (
  <Box sx={{ mb: 1.75 }}>
    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.12em", color: s.ink3, mb: 0.5 }}>
      {label}
    </Typography>
    <Box
      sx={{
        height: 40,
        borderRadius: 1.5,
        border: `1px solid ${s.line}`,
        background: s.bgAlt,
        display: "flex",
        alignItems: "center",
        px: 1.5,
        fontFamily: FONT_BODY,
        fontSize: 15,
        fontWeight: 600,
        color: s.ink,
      }}
    >
      {value}
    </Box>
  </Box>
);

const Scene = ({ id, s, reduce }: { id: string; s: Tokens; reduce: boolean }) => {
  const rise = (delay: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.4 } };

  if (id === "create") {
    return (
      <Box sx={{ maxWidth: 380, mx: "auto" }}>
        <Card s={s}>
          <FieldRow s={s} label="AMOUNT" value="$49.00 USD" />
          <FieldRow s={s} label="DESCRIPTION" value="Logo design — final files" />
          <motion.div {...rise(0.5)}>
            <Box
              sx={{
                mt: 1,
                height: 44,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontFamily: FONT_BODY,
                background: s.aurora,
              }}
            >
              Create payment link
            </Box>
          </motion.div>
        </Card>
        <motion.div {...rise(0.9)}>
          <Box
            sx={{
              mt: 2,
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 1.25,
              borderRadius: 999,
              border: `1px dashed ${s.indigo}`,
              fontFamily: FONT_TECH,
              fontSize: 13,
              color: s.ink,
              justifyContent: "center",
            }}
          >
            <LinkRoundedIcon fontSize="small" sx={{ color: s.indigo }} />
            dynopay.com/pay/aX9kQ2
          </Box>
        </motion.div>
      </Box>
    );
  }

  if (id === "share") {
    const shares = [
      { label: "WhatsApp", c: "#25D366" },
      { label: "Telegram", c: "#2AABEE" },
      { label: "X", c: s.ink },
      { label: "Copy link", c: s.indigo },
    ];
    return (
      <Box sx={{ maxWidth: 400, mx: "auto" }}>
        <Card s={s} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
          <LinkRoundedIcon fontSize="small" sx={{ color: s.indigo }} />
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 13, color: s.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            dynopay.com/pay/aX9kQ2
          </Typography>
        </Card>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
          {shares.map((sh, i) => (
            <motion.div key={sh.label} {...rise(0.2 + i * 0.15)}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 2,
                  py: 1.5,
                  borderRadius: 2,
                  border: `1px solid ${s.line}`,
                  background: s.surface,
                }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", background: sh.c }} />
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: s.ink }}>
                  {sh.label}
                </Typography>
              </Box>
            </motion.div>
          ))}
        </Box>
      </Box>
    );
  }

  if (id === "pay") {
    const coins = [
      { t: "BTC", c: "#F7931A" },
      { t: "ETH", c: "#627EEA" },
      { t: "USDT", c: "#26A17B" },
    ];
    return (
      <Box sx={{ maxWidth: 380, mx: "auto" }}>
        <Card s={s}>
          <Typography sx={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, color: s.ink, mb: 0.25 }}>
            Pay $49.00
          </Typography>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: s.ink3, mb: 2 }}>
            Choose how you&apos;d like to pay
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            {coins.map((c, i) => (
              <motion.div key={c.t} {...rise(0.2 + i * 0.12)} style={{ flex: 1 }}>
                <Box
                  sx={{
                    py: 1,
                    borderRadius: 1.5,
                    textAlign: "center",
                    border: `1px solid ${i === 1 ? s.indigo : s.line}`,
                    background: i === 1 ? (s.dark ? "rgba(129,140,248,0.1)" : "rgba(79,70,229,0.06)") : "transparent",
                  }}
                >
                  <Box sx={{ width: 16, height: 16, borderRadius: "50%", background: c.c, mx: "auto", mb: 0.5 }} />
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink }}>{c.t}</Typography>
                </Box>
              </motion.div>
            ))}
          </Box>
          <motion.div {...rise(0.8)}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                py: 1.25,
                borderRadius: 999,
                background: s.dark ? "rgba(40,200,100,0.12)" : "rgba(34,197,94,0.1)",
                color: "#22c55e",
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              <CheckRoundedIcon fontSize="small" />
              Payment confirmed on-chain
            </Box>
          </motion.div>
        </Card>
      </Box>
    );
  }

  // settle
  return (
    <Box sx={{ maxWidth: 380, mx: "auto" }}>
      <Card s={s}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
          <AccountBalanceWalletRoundedIcon fontSize="small" sx={{ color: s.indigo }} />
          <Typography sx={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, color: s.ink }}>
            Your wallet
          </Typography>
        </Box>
        <motion.div {...rise(0.3)}>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 34, fontWeight: 600, color: s.ink, letterSpacing: "-0.02em" }}>
            + $49.00
          </Typography>
        </motion.div>
        <motion.div {...rise(0.7)}>
          <Box
            sx={{
              mt: 1.5,
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.5,
              py: 0.75,
              borderRadius: 999,
              background: s.dark ? "rgba(40,200,100,0.12)" : "rgba(34,197,94,0.1)",
              color: "#22c55e",
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 12.5,
            }}
          >
            <CheckRoundedIcon sx={{ fontSize: 15 }} />
            Settled to a wallet you control
          </Box>
        </motion.div>
        <motion.div {...rise(1)}>
          <Typography sx={{ mt: 2, fontFamily: FONT_BODY, fontSize: 12.5, color: s.ink3, lineHeight: 1.5 }}>
            Keep the original coin, or auto-convert to USDC / USDT — set it once and forget it.
          </Typography>
        </motion.div>
      </Card>
    </Box>
  );
};

export default HowToPage;
