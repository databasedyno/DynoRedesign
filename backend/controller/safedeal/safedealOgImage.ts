/**
 * SafeDeal social share card — rendered PNG for chat/social unfurls
 * (WhatsApp, Telegram, Slack, iMessage, X). A shared deal link shows the deal
 * title, amount and escrow state instead of a generic logo card.
 *
 *   GET /api/safedeal/og-image?d=<deal_token>   → deal card (public, read-only, no emails)
 *   GET /api/safedeal/og-image?demo=1           → sample card
 *
 * Any failure 302-redirects to the static SafeDeal card so crawlers always get a valid image.
 */
import express from "express";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import type { OverlayOptions } from "sharp";
import { escrowDealModel } from "../../models";
import { apiLogger } from "../../utils/loggers";

const W = 1200;
const H = 630;
const FALLBACK_OG = "/safedeal/og-image.png";
const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";
// SafeDeal brand (mirrors Components/SafeDeal/sdTheme.ts)
const GOLD = "#FFC61A";
const INK = "#0A0A0B";
const INK_RAISED = "#16151A";
const CREAM = "#FAFAF7";
const CREAM_SOFT = "rgba(250,250,247,0.72)";
const GREEN = "#22C55E";
const RED = "#F87171";
const SHIELD_CANDIDATES = [
  path.resolve(__dirname, "../../../public/safedeal/favicon-512.png"),
  path.resolve("/app/public/safedeal/favicon-512.png"),
];

export interface SafeDealShareCopy {
  eyebrow: string;
  state: string;
  stateTone: "gold" | "green" | "red" | "neutral";
  title: string;
  description: string;
  footer: string;
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function fmtDealMoney(n: number, ccy: string): string {
  const v = Number(n) || 0;
  const sym = ccy === "USD" ? "$" : ccy === "EUR" ? "€" : ccy === "GBP" ? "£" : "";
  const num = v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return sym ? `${sym}${num} ${ccy}` : `${num} ${ccy}`;
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (cand.length <= maxChars) cur = cand;
    else {
      if (cur) lines.push(cur);
      cur = w.length > maxChars ? w.slice(0, maxChars - 1) + "…" : w;
      if (lines.length === maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length > maxLines) lines.length = maxLines;
  if (words.join(" ").length > lines.join(" ").length && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/[\s.…]+$/, "") + "…";
  }
  return lines.length ? lines : ["Escrow deal"];
}

/** One source of truth for the share copy (OG title/description on the page AND the card text). */
export function shareCopyFor(deal: {
  title: string;
  amount: number;
  currency: string;
  status: string;
  creator_role?: string | null;
  invite_kind?: string | null;
  open_seat?: boolean;
}): SafeDealShareCopy {
  const money = fmtDealMoney(deal.amount, deal.currency);
  const title = String(deal.title || "Escrow deal").trim();
  const seller = deal.creator_role === "seller";
  const footer = "Funds are held in USDT escrow until delivery is confirmed · safedeal.sh";
  switch (String(deal.status || "").toLowerCase()) {
    case "invited":
      return {
        eyebrow: "ESCROW INVITATION",
        state: "Awaiting acceptance",
        stateTone: "gold",
        title: `${title} — ${money} escrow deal`,
        description: seller
          ? `You've been invited to buy "${title}" for ${money} through SafeDeal escrow. Your payment is held securely and released to the seller only when you confirm delivery. Sign in with an email code to accept.`
          : `You've been invited to sell "${title}" for ${money} through SafeDeal escrow. The buyer funds escrow first — you get paid the moment delivery is confirmed. Sign in with an email code to accept.`,
        footer,
      };
    case "awaiting_payment":
      return {
        eyebrow: "ESCROW DEAL",
        state: "Awaiting funding",
        stateTone: "gold",
        title: `${title} — ${money}, awaiting funding`,
        description: `Both sides have agreed. Once the buyer funds ${money} into SafeDeal escrow, the seller can start — the money stays held until delivery is confirmed.`,
        footer,
      };
    case "funded":
      return {
        eyebrow: "ESCROW DEAL",
        state: "Held in escrow",
        stateTone: "green",
        title: `${title} — ${money} held in escrow`,
        description: `${money} is held securely in SafeDeal escrow for "${title}". It's released to the seller only when the buyer confirms delivery.`,
        footer,
      };
    case "delivered":
      return {
        eyebrow: "ESCROW DEAL",
        state: "Delivered · awaiting confirmation",
        stateTone: "gold",
        title: `${title} — delivered, ${money} in escrow`,
        description: `The seller has marked "${title}" as delivered. ${money} stays in SafeDeal escrow until the buyer confirms and releases it.`,
        footer,
      };
    case "released":
    case "completed":
      return {
        eyebrow: "ESCROW DEAL",
        state: "Completed · paid out",
        stateTone: "green",
        title: `${title} — ${money} completed`,
        description: `Deal complete. ${money} was released from SafeDeal escrow to the seller after the buyer confirmed delivery of "${title}".`,
        footer,
      };
    case "refunded":
      return {
        eyebrow: "ESCROW DEAL",
        state: "Refunded",
        stateTone: "neutral",
        title: `${title} — ${money} refunded`,
        description: `This deal ended with a refund. ${money} was returned to the buyer from SafeDeal escrow.`,
        footer,
      };
    case "disputed":
      return {
        eyebrow: "ESCROW DEAL",
        state: "In review",
        stateTone: "red",
        title: `${title} — ${money} in review`,
        description: `A dispute was raised on "${title}". ${money} stays locked in SafeDeal escrow while the case is reviewed.`,
        footer,
      };
    case "cancelled":
    case "expired":
      return {
        eyebrow: "ESCROW DEAL",
        state: "Closed",
        stateTone: "neutral",
        title: `${title} — ${money} (closed)`,
        description: `This SafeDeal escrow deal is closed. Start a new deal in under a minute — payment held in USDT escrow until delivery is confirmed.`,
        footer,
      };
    default:
      return {
        eyebrow: "ESCROW DEAL",
        state: "Escrow deal",
        stateTone: "gold",
        title: `${title} — ${money}`,
        description: `"${title}" for ${money} through SafeDeal escrow. Payment is held securely and released only when delivery is confirmed.`,
        footer,
      };
  }
}

let shieldPromise: Promise<Buffer | null> | null = null;
function loadShield(size: number): Promise<Buffer | null> {
  if (!shieldPromise) {
    shieldPromise = (async () => {
      const src = SHIELD_CANDIDATES.find((p) => fs.existsSync(p));
      if (!src) return null;
      try {
        return await sharp(src).resize(size, size).png().toBuffer();
      } catch {
        return null;
      }
    })();
  }
  return shieldPromise;
}

function baseSvg(): string {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${INK_RAISED}"/>
        <stop offset="100%" stop-color="${INK}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0%" cy="0%" r="70%">
        <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.55"/>
        <stop offset="40%" stop-color="${GOLD}" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
      </radialGradient>
      <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M60 0H0V60" fill="none" stroke="#FFFFFF" stroke-opacity="0.035" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect width="${W}" height="${H}" fill="url(#grid)"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${GOLD}"/>
  </svg>`;
}

function toneColors(tone: SafeDealShareCopy["stateTone"]): { fill: string; text: string } {
  if (tone === "green") return { fill: GREEN, text: INK };
  if (tone === "red") return { fill: RED, text: INK };
  if (tone === "neutral") return { fill: "rgba(250,250,247,0.18)", text: CREAM };
  return { fill: GOLD, text: INK };
}

function overlaySvg(copy: SafeDealShareCopy, money: string, shieldSize: number): Buffer {
  const lines = wrap(copy.title.split(" — ")[0] || copy.title, 30, 2);
  const LINE_H = 66;
  const titleY = 330 - (lines.length - 1) * LINE_H;
  const tspans = lines.map((ln, i) => `<tspan x="64" y="${titleY + i * LINE_H}">${esc(ln)}</tspan>`).join("");
  const pill = toneColors(copy.stateTone);
  const pillW = Math.min(560, copy.state.length * 15 + 56);
  const pillY = 470;
  return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <text x="${64 + shieldSize + 18}" y="${58 + shieldSize * 0.68}" font-family="${FONT}" font-size="40" font-weight="800" letter-spacing="-1" fill="${CREAM}">Safe<tspan fill="${GOLD}">Deal</tspan></text>
    <text x="64" y="${titleY - 56}" font-family="${FONT}" font-size="22" font-weight="700" letter-spacing="5" fill="${GOLD}">${esc(copy.eyebrow)}</text>
    <text font-family="${FONT}" font-size="58" font-weight="800" fill="${CREAM}">${tspans}</text>
    <text x="64" y="${pillY - 30}" font-family="${FONT}" font-size="54" font-weight="800" fill="${CREAM}">${esc(money)}</text>
    <rect x="64" y="${pillY}" width="${pillW}" height="46" rx="23" fill="${pill.fill}"/>
    <text x="${64 + pillW / 2}" y="${pillY + 31}" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="800" fill="${pill.text}">${esc(copy.state)}</text>
    <text x="64" y="578" font-family="${FONT}" font-size="22" font-weight="500" fill="${CREAM_SOFT}">${esc(copy.footer)}</text>
  </svg>`);
}

async function renderCard(copy: SafeDealShareCopy, money: string): Promise<Buffer> {
  const SHIELD = 64;
  const base = await sharp(Buffer.from(baseSvg())).png().toBuffer();
  const layers: OverlayOptions[] = [];
  const shield = await loadShield(SHIELD);
  if (shield) layers.push({ input: shield, top: 58, left: 64 });
  layers.push({ input: overlaySvg(copy, money, shield ? SHIELD : 0), top: 0, left: 0 });
  return sharp(base).composite(layers).png().toBuffer();
}

function demoDeal() {
  return { title: "Logo & brand kit for Riverside Coffee", amount: 450, currency: "USD", status: "funded", creator_role: "seller", invite_kind: "email" };
}

export const getSafeDealOgImage = async (req: express.Request, res: express.Response) => {
  try {
    const token = String(req.query.d || "").trim();
    const isDemo = String(req.query.demo || "") === "1";
    let deal: ReturnType<typeof demoDeal> | null = null;
    if (isDemo) deal = demoDeal();
    else if (token && /^[a-f0-9]{16,96}$/i.test(token)) {
      const row: any = await escrowDealModel.findOne({
        where: { deal_token: token, source: "safedeal" },
        attributes: ["title", "amount", "currency", "status", "creator_role", "invite_kind"],
      });
      if (row) deal = { title: row.title, amount: Number(row.amount), currency: row.currency, status: row.status, creator_role: row.creator_role, invite_kind: row.invite_kind };
    }
    if (!deal) return res.redirect(302, FALLBACK_OG);
    const copy = shareCopyFor(deal);
    const png = await renderCard(copy, fmtDealMoney(deal.amount, deal.currency));
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
    return res.status(200).end(png);
  } catch (e) {
    apiLogger.error("[getSafeDealOgImage] error:", e);
    return res.redirect(302, FALLBACK_OG);
  }
};

export default getSafeDealOgImage;
