import React, { useCallback, useEffect, useState } from "react";
import { Box, Container, Skeleton, Stack, Typography } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import safedealApi, { SdRewards, sdError } from "@/api/safedeal";
import useToast from "@/hooks/useToast";
import { useRequireSdSession } from "../sdRouting";
import { SD_GOLD_DEEP, SD_TEXT_MUTED } from "../sdTheme";
import InviteHero from "./InviteHero";
import CreditCard from "./CreditCard";
import LevelCard from "./LevelCard";
import MilestonesCard from "./MilestonesCard";
import InvitesList from "./InvitesList";
import CreditHistory from "./CreditHistory";
import HowItWorks from "./HowItWorks";

const Reveal = ({ i, children }: { i: number; children: React.ReactNode }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.07, ease: "easeOut" }} style={{ minWidth: 0 }}>
      {children}
    </motion.div>
  );
};

/** /rewards — referral link & sharing, fee credit, loyalty level, milestones, invites, history. */
export default function RewardsPage() {
  const { ready } = useRequireSdSession();
  const { showToast } = useToast();
  const [r, setR] = useState<SdRewards | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => safedealApi.rewards().then(setR).catch((e) => setError(sdError(e))), []);
  useEffect(() => { if (ready) void load(); }, [ready, load]);

  const copy = useCallback((text: string, what: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => showToast({ message: `${what} copied — share it anywhere.`, severity: "success" }),
      () => showToast({ message: "Couldn't copy — select it and copy manually.", severity: "error" })
    );
  }, [showToast]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }} data-testid="sd-rewards-page">
      <Box sx={{ mb: { xs: 2.5, md: 3.5 } }}>
        <Typography sx={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: SD_GOLD_DEEP }}>Rewards</Typography>
        <Typography component="h1" sx={{ fontSize: { xs: 30, sm: 36, md: 44 }, fontWeight: 900, letterSpacing: -1.4, lineHeight: 1.05, mt: 0.6 }}>Invite friends. Pay less in fees.</Typography>
        <Typography sx={{ fontSize: { xs: 14, md: 15.5 }, color: SD_TEXT_MUTED, mt: 1, maxWidth: 620 }}>Earn fee credit for every friend who closes a deal, and unlock lower escrow rates the more you trade.</Typography>
      </Box>

      {error && <Typography color="error" data-testid="sd-rewards-error">{error}</Typography>}
      {!r && !error ? (
        <Stack spacing={2.5}><Skeleton variant="rounded" height={300} /><Skeleton variant="rounded" height={220} /></Stack>
      ) : r ? (
        <Stack spacing={2.5}>
          <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,1.55fr) minmax(0,1fr)" } }}>
            <Reveal i={0}><InviteHero r={r} onCopy={copy} /></Reveal>
            <Reveal i={1}><CreditCard credit={r.credit} /></Reveal>
          </Box>
          <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,1.55fr) minmax(0,1fr)" } }}>
            <Reveal i={2}><LevelCard level={r.level} minFeeUsd={r.rules.min_fee_usd} /></Reveal>
            <Reveal i={3}><MilestonesCard r={r} /></Reveal>
          </Box>
          <Reveal i={4}><HowItWorks rules={r.rules} /></Reveal>
          <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))" }, alignItems: "start" }}>
            <Reveal i={5}><InvitesList r={r} /></Reveal>
            <Reveal i={6}><CreditHistory history={r.history} /></Reveal>
          </Box>
        </Stack>
      ) : null}
    </Container>
  );
}
