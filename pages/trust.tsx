import React, { memo } from "react";
import Head from "next/head";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import MonitorHeartRoundedIcon from "@mui/icons-material/MonitorHeartRounded";
import BugReportRoundedIcon from "@mui/icons-material/BugReportRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import { AuroraInk } from "@/Components/Page/Home/v3/styled.v3";
import PublicPageHero from "@/Components/Page/Home/v5/PublicPageHero";
import PublicFinalCta from "@/Components/Page/Home/v5/PublicFinalCta";
import { Section, SectionHead, PrimaryBtn, SecondaryBtn, cardSx } from "@/Components/Page/Home/v5/shared";
import { Stagger, StaggerItem } from "@/Components/Page/Home/motion/Stagger";

/**
 * /trust — the Dynopay Trust Centre (Phase 3). Pulls the four homepage security
 * pillars into a full, verifiable page: non-custodial settlement, KYC/AML,
 * hardened key infrastructure, uptime + the policies and status that back them.
 * Uses the shared public shell so it inherits the operations-console look.
 */
const PILLARS = [
  { Icon: ShieldRoundedIcon, title: "Non-custodial by design", body: "Settled funds move straight to the wallet you control. Dynopay never pools or holds your balance in between." },
  { Icon: VerifiedUserRoundedIcon, title: "KYC & AML", body: "Identity and anti-money-laundering checks run on merchants above regulatory thresholds, with ongoing sanctions screening." },
  { Icon: KeyRoundedIcon, title: "Hardened key infrastructure", body: "Wallet keys are encrypted and isolated. Signing happens in a protected environment — never in your browser." },
  { Icon: LockRoundedIcon, title: "Encryption everywhere", body: "TLS in transit and encryption at rest for sensitive data, with least-privilege access to production systems." },
  { Icon: MonitorHeartRoundedIcon, title: "Verifiable uptime", body: "A public status page and continuous monitoring let you confirm that payments and settlement are healthy — any time." },
  { Icon: BugReportRoundedIcon, title: "Responsible disclosure", body: "Found something? Report it privately and we’ll triage fast. Good-faith research is always welcome." },
];

const MONEY_STEPS = [
  { n: "01", title: "Customer pays", body: "The buyer pays in crypto on a hosted checkout, link or invoice. The exact amount is locked to a live rate." },
  { n: "02", title: "Network confirms", body: "The transaction is confirmed on-chain. You and the customer both see each confirmation in real time." },
  { n: "03", title: "You settle", body: "Funds settle to the wallet or currency you chose — directly, without Dynopay holding a balance for you." },
];

const RESOURCES = [
  { title: "Live system status", body: "Real-time uptime and incident history.", href: "/system-status", external: false },
  { title: "AML policy", body: "Our anti-money-laundering commitments.", href: "/aml-policy", external: false },
  { title: "Privacy policy", body: "What we collect and how we protect it.", href: "/privacy-policy", external: false },
  { title: "Terms & conditions", body: "The agreement that governs your account.", href: "/terms-conditions", external: false },
];

const openSupportChat = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("dynopay:open-support-chat"));
};

const TrustCentre: React.FC = () => {
  const s = useAurora();
  const router = useRouter();

  return (
    <Box sx={{ width: "100%" }}>
      <Head>
        <title>Trust Centre — security, compliance & transparency | Dynopay</title>
        <meta name="description" content="How Dynopay keeps crypto payments safe: non-custodial settlement, KYC/AML, hardened key infrastructure, encryption, verifiable uptime and the policies that back them." />
        <link rel="canonical" href="https://dynopay.com/trust" />
      </Head>

      <PublicPageHero
        testId="trust-hero"
        eyebrow="Trust centre"
        title={
          <>
            Built to be <AuroraInk>trusted with money</AuroraInk>
          </>
        }
        body="Dynopay moves funds on rails you can verify — not held on a balance you can’t see. Here’s exactly how we handle security, compliance and transparency."
        actions={
          <>
            <PrimaryBtn data-testid="trust-hero-status" href="/system-status" endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
              View live status
            </PrimaryBtn>
            <SecondaryBtn onDark={s.dark} data-testid="trust-hero-docs" href="/documentation">
              Read the docs
            </SecondaryBtn>
          </>
        }
        note="Non-custodial · KYC/AML · encrypted key infrastructure · public uptime"
      />

      {/* Pillars */}
      <Section testId="trust-pillars">
        <SectionHead eyebrow="The essentials" headline="Six commitments behind every payment" body="These aren’t slogans — each one maps to how the platform actually works." maxWidth={720} testId="trust-pillars-head" />
        <Stagger step={0.07} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: { xs: 2.5, md: 3 } }}>
          {PILLARS.map(({ Icon, title, body }, i) => (
            <StaggerItem key={title} i={i} y={16}>
              <Box data-testid={`trust-pillar-${i}`} sx={{ ...cardSx(s, { hover: false }), display: "flex", flexDirection: "column", p: { xs: 3, md: 3.5 }, height: "100%" }}>
                <Box sx={{ width: 46, height: 46, borderRadius: "12px", display: "grid", placeItems: "center", background: s.accentSoft, color: s.accent, mb: 2.5 }}>
                  <Icon sx={{ fontSize: 23 }} />
                </Box>
                <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 18, md: 19.5 }, letterSpacing: "-0.01em", color: s.ink, mb: 1.25 }}>{title}</Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6, color: s.ink2 }}>{body}</Typography>
              </Box>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* How your money moves */}
      <Section alt testId="trust-flow">
        <SectionHead eyebrow="Non-custodial settlement" headline="How your money moves" body="Three steps, no middle balance. You stay in control the whole way through." maxWidth={680} testId="trust-flow-head" />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, border: `1px solid ${s.line}`, borderRadius: "16px", overflow: "hidden", background: s.bg }}>
          {MONEY_STEPS.map((step, i) => (
            <Box key={step.n} sx={{ p: { xs: 3, md: 4 }, borderTop: { xs: i > 0 ? `1px solid ${s.line}` : "none", md: "none" }, borderLeft: { xs: "none", md: i > 0 ? `1px solid ${s.line}` : "none" } }}>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: s.accent }}>{step.n}</Typography>
              <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 18, md: 20 }, letterSpacing: "-0.01em", color: s.ink, mt: 2, mb: 1.25 }}>{step.title}</Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.6, color: s.ink2 }}>{step.body}</Typography>
            </Box>
          ))}
        </Box>
      </Section>

      {/* Policies & resources */}
      <Section testId="trust-resources">
        <SectionHead eyebrow="Go deeper" headline="Policies & live transparency" body="The documents and real-time signals that back everything above." maxWidth={680} testId="trust-resources-head" />
        <Stagger step={0.06} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: { xs: 2, md: 2.5 } }}>
          {RESOURCES.map((r, i) => (
            <StaggerItem key={r.title} i={i} y={14}>
              <Box component="a" href={r.href} data-testid={`trust-resource-${i}`} sx={{ ...cardSx(s), display: "flex", flexDirection: "column", p: { xs: 2.75, md: 3 }, height: "100%", textDecoration: "none" }}>
                <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: 16.5, letterSpacing: "-0.01em", color: s.ink, mb: 0.75 }}>{r.title}</Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.55, color: s.ink2, flexGrow: 1 }}>{r.body}</Typography>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 2, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: s.accent }}>
                  Open <OpenInNewRoundedIcon sx={{ fontSize: 15 }} />
                </Box>
              </Box>
            </StaggerItem>
          ))}
          <StaggerItem i={RESOURCES.length} y={14}>
            <Box data-testid="trust-resource-disclosure" sx={{ ...cardSx(s, { hover: false }), display: "flex", flexDirection: "column", p: { xs: 2.75, md: 3 }, height: "100%" }}>
              <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: 16.5, letterSpacing: "-0.01em", color: s.ink, mb: 0.75 }}>Report a vulnerability</Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.55, color: s.ink2, flexGrow: 1 }}>Disclose a security issue privately — we triage fast and credit good-faith research.</Typography>
              <Box onClick={openSupportChat} sx={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, mt: 2, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: s.accent }}>
                Contact security <ArrowForwardIcon sx={{ fontSize: 15 }} />
              </Box>
            </Box>
          </StaggerItem>
        </Stagger>
      </Section>

      <PublicFinalCta attributionRef="trust" />
    </Box>
  );
};

export default memo(TrustCentre);
