/**
 * SafeDeal display standards — one place for relative/absolute dates, live
 * countdowns, the status glossary and the "who acts next" derivation used by
 * the banner, the deal list pills and the status tooltips.
 */
import { useEffect, useState } from "react";
import type { SdDeal } from "@/api/safedeal";

export const TABULAR = { fontVariantNumeric: "tabular-nums" } as const;

/** Re-renders on an interval so countdowns tick. */
export function useNow(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function absTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "in 2d 4h" / "3h ago" / "in 12m" under 7 days; absolute date beyond that. */
export function relTime(iso?: string | null, now = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = t - now;
  const abs = Math.abs(diff);
  const future = diff > 0;
  if (abs > 7 * 86400000) return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: new Date(iso).getFullYear() !== new Date(now).getFullYear() ? "numeric" : undefined });
  const m = Math.floor(abs / 60000);
  const h = Math.floor(abs / 3600000);
  const d = Math.floor(abs / 86400000);
  let s: string;
  if (abs < 60000) s = "under a minute";
  else if (h < 1) s = `${m}m`;
  else if (d < 1) s = `${h}h${m % 60 ? ` ${m % 60}m` : ""}`;
  else s = `${d}d${h % 24 ? ` ${h % 24}h` : ""}`;
  return future ? `in ${s}` : `${s} ago`;
}

export const WITHDRAWAL_STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  pending_approval: "Under review",
  sent: "Sent",
  rejected: "Returned",
  failed: "Failed",
};
export const withdrawalStatusLabel = (s: string) => WITHDRAWAL_STATUS_LABEL[s] || s.replace(/_/g, " ");

type Role = "buyer" | "seller";
type Party = "you" | "them" | "nobody";

export interface NextStep {
  who: Party;
  /** Short imperative/state line, already role-aware ("Deliver the work"). */
  text: string;
  /** ISO deadline the text refers to, if any. */
  deadline?: string | null;
  /** How to phrase the deadline: "Auto-releases", "Respond by"… */
  deadlineLabel?: string;
  tone: "action" | "waiting" | "attention" | "done" | "neutral";
}

/** Glossary shown on hover of any status chip. */
export const STATUS_GLOSSARY: Record<string, { meaning: string; next: (role: Role, isCreator: boolean) => string }> = {
  draft: { meaning: "The deal is being set up. No invite has been sent.", next: () => "The creator sends the invite." },
  invited: { meaning: "The other party has been emailed an invite and hasn't answered yet.", next: (r, c) => (c ? "They accept or decline." : "You accept or decline.") },
  declined: { meaning: "The invite was turned down. Nothing was paid.", next: () => "Nothing — start a new deal if you want to try again." },
  awaiting_payment: { meaning: "Both sides agreed. The buyer now pays into escrow.", next: (r) => (r === "buyer" ? "You fund the escrow." : "The buyer funds the escrow.") },
  funded: { meaning: "The buyer's money is held by Dynopay in USDT. It can't be taken back without agreement.", next: (r) => (r === "seller" ? "You deliver and mark the deal delivered." : "The seller delivers.") },
  delivered: { meaning: "The seller says it's delivered. The buyer's inspection period is running.", next: (r) => (r === "buyer" ? "You release the funds, or raise an issue before the timer ends." : "The buyer confirms — or the timer releases automatically.") },
  disputed: { meaning: "The deal is paused. The parties negotiate first; Dynopay decides only if they can't agree.", next: () => "Whoever received the latest proposal responds." },
  completed: { meaning: "Funds were released to the seller's SafeDeal wallet.", next: () => "Nothing — the seller can withdraw any time." },
  refunded: { meaning: "Funds went back to the buyer's SafeDeal wallet (minus fees and costs).", next: () => "Nothing — the buyer can withdraw any time." },
  split: { meaning: "The held amount was divided between buyer and seller as agreed or decided.", next: () => "Nothing — both can withdraw their share." },
  cancelled: { meaning: "Cancelled before any money moved.", next: () => "Nothing." },
  expired: { meaning: "The invite or payment window ran out.", next: () => "Nothing — start a new deal." },
};

/** Who acts next + the relevant deadline, derived from the deal state and my role. */
export function nextStep(d: SdDeal): NextStep {
  const me = (d.my_role || "buyer") as Role;
  const isBuyer = me === "buyer";
  const other = isBuyer ? "seller" : "buyer";
  const prop = d.dispute_proposal;
  switch (d.status) {
    case "invited":
      return d.is_creator
        ? { who: "them", text: `Waiting for the ${other} to accept the invite`, deadline: d.invited_at || d.created_at, deadlineLabel: "Invited", tone: "waiting" }
        : { who: "you", text: "Accept or decline this invite", tone: "action" };
    case "awaiting_payment":
      return isBuyer
        ? { who: "you", text: "Fund the escrow to get things moving", deadline: d.accepted_at, deadlineLabel: "Accepted", tone: "action" }
        : { who: "them", text: "Waiting for the buyer to fund the escrow", deadline: d.accepted_at, deadlineLabel: "Accepted", tone: "waiting" };
    case "funded":
      return isBuyer
        ? { who: "them", text: "Waiting for the seller to deliver", deadline: d.funded_at, deadlineLabel: "Funded", tone: "waiting" }
        : { who: "you", text: "Deliver the work, then mark it delivered", deadline: d.funded_at, deadlineLabel: "Funded", tone: "action" };
    case "delivered":
      return isBuyer
        ? { who: "you", text: "Inspect the delivery — release, or raise an issue", deadline: d.auto_release_at, deadlineLabel: "Auto-releases", tone: "action" }
        : { who: "them", text: "Waiting for the buyer to confirm", deadline: d.auto_release_at, deadlineLabel: "Auto-releases", tone: "waiting" };
    case "disputed": {
      if (d.dispute_stage === "escalated") return { who: "nobody", text: "With the SafeDeal team for a decision", tone: "attention" };
      const kind = prop?.kind === "cancellation" ? "cancellation request" : "proposal";
      if (prop && d.dispute_proposal_by && d.dispute_proposal_by !== me)
        return { who: "you", text: `Respond to the ${other}'s ${kind}`, deadline: d.dispute_auto_escalate_at, deadlineLabel: "Escalates automatically", tone: "action" };
      return { who: "them", text: `Waiting for the ${other} to respond to your ${kind}`, deadline: d.dispute_auto_escalate_at, deadlineLabel: "Escalates automatically", tone: "waiting" };
    }
    case "completed":
      return { who: "nobody", text: isBuyer ? "Complete — the seller has been paid" : "Complete — funds are in your wallet", tone: "done" };
    case "refunded":
      return { who: "nobody", text: isBuyer ? "Refunded — funds are in your wallet" : "Refunded to the buyer", tone: "done" };
    case "split":
      return { who: "nobody", text: "Settled — each side's share is in their wallet", tone: "done" };
    default:
      return { who: "nobody", text: `This deal is ${d.status}`, tone: "neutral" };
  }
}

/** Compact deadline/time-pressure line for list rows; null when nothing to show. */
export function deadlinePill(d: SdDeal, now = Date.now()): { text: string; urgent: boolean; iso: string } | null {
  const s = nextStep(d);
  if (!s.deadline) return null;
  const t = new Date(s.deadline).getTime();
  const future = t > now;
  const rel = relTime(s.deadline, now);
  if (s.deadlineLabel === "Auto-releases") return { text: future ? `Auto-releases ${rel}` : "Auto-release due", urgent: t - now < 86400000, iso: s.deadline };
  if (s.deadlineLabel === "Escalates automatically") return { text: future ? `Respond within ${rel.replace(/^in /, "")}` : "Escalating to the SafeDeal team", urgent: t - now < 86400000, iso: s.deadline };
  if (s.deadlineLabel === "Invited") return { text: `Invited ${rel}`, urgent: now - t > 3 * 86400000, iso: s.deadline };
  if (s.deadlineLabel === "Accepted") return { text: `Accepted ${rel} · unfunded`, urgent: now - t > 2 * 86400000, iso: s.deadline };
  if (s.deadlineLabel === "Funded") return { text: `Funded ${rel}`, urgent: false, iso: s.deadline };
  return null;
}
