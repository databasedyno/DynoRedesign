import React from "react";
import useProfile from "@/hooks/useProfile";
import GrowPanel, { GrowPanelProps } from "../GrowPanel";
import CreatorPageCard from "../CreatorPageCard";

/**
 * GrowSlot — a single "rotating" growth slot for the dashboard's right rail.
 *
 * The old layout stacked BOTH the GrowPanel (fee-free / referral / premium
 * offers) AND the CreatorPageCard, adding two tall cards to an already busy
 * column. This surfaces exactly ONE at a time, by priority, keeping the rail
 * calm without losing either surface:
 *   1. Fee-free credit active → the time-sensitive money offer wins.
 *   2. No creator handle yet / reserved-but-unpublished → nudge that setup.
 *   3. Otherwise (page published) → evergreen grow offers (referral/premium);
 *      full creator-page analytics still live on /creator.
 */
const GrowSlot: React.FC<GrowPanelProps> = (props) => {
  const profile = useProfile().profile;
  const hasHandle = Boolean(profile?.handle);
  const published = Boolean(profile?.creator_page_enabled);

  if (props.hasFeeFreeCredit) return <GrowPanel {...props} />;
  if (!hasHandle || !published) return <CreatorPageCard />;
  return <GrowPanel {...props} />;
};

export default GrowSlot;
