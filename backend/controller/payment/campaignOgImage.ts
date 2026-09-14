/**
 * getCampaignOgImage — renders a rich social share card (PNG) for the three
 * public payment surfaces, so link previews on X / WhatsApp / Slack show the
 * real thing instead of a generic logo:
 *
 *   • Donation campaign  → cover photo + title + filled goal bar + "% funded"
 *   • Standard pay link  → brand gradient + "Pay {amount} to {merchant}"
 *   • Storefront / creator (?shop=<handle>) → brand gradient + logo badge +
 *     name + ✓ verified + tagline + "Shop with crypto"
 *
 * Public, read-only (donation/standard read the same Redis session key as
 * getPaymentMeta; shop resolves the handle like the public shop page), and
 * cached. On any failure it 302-redirects to the default OG image so crawlers
 * always get something valid.
 *
 * GET /api/pay/og-image?d=<session-key>    (donation OR standard link)
 * GET /api/pay/og-image?shop=<handle>      (storefront / creator card)
 * GET /api/pay/og-image?demo=1             (sample donation card, for the demo)
 */
import express from "express";
import sharp from "sharp";
import axios from "axios";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { getRedisItem } from "../../utils/redisInstance";
import { getDonationAggregates } from "./paymentLinkController";
import { resolvePublicCompanyName } from "../../helper/publicCompanyName";
import { companyModel } from "../../models";
import { resolveStorefrontByHandle } from "../storefrontScope";
import { isMerchantIdentityVerified } from "../../helper/merchantVerification";
import { apiLogger } from "../../utils/loggers";

const W = 1200;
const H = 630;
const FALLBACK_OG = "/og/dynopay-og.png";
const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";
const DEMO_COVER =
  "https://images.unsplash.com/photo-1591522810850-58128c5fb089?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwxfHxjaGFyaXR5JTIwZG9uYXRpb24lMjBhYnN0cmFjdHxlbnwwfHx8fDE3ODM3OTQyMDR8MA&ixlib=rb-4.1.0&q=85";

type CardKind = "donation" | "standard" | "shop";

interface CardData {
  kind: CardKind;
  title: string;
  subtitle: string | null;
  cover: string | null; // donation background photo
  logo: string | null; // shop avatar (composited as circle)
  accent: string | null; // brand accent for gradient tint
  currency: string;
  goal: number | null;
  raised: number;
  percent: number | null;
  hasGoal: boolean;
  verified: boolean;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtMoney(n: number, ccy: string): string {
  try {
    return `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${ccy}`;
  } catch {
    return `${Math.round(n)} ${ccy}`;
  }
}

function hexClamp(v?: string | null): string | null {
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null;
}

function oneLine(s: string, max: number): string {
  const clean = String(s || "").trim().replace(/\s+/g, " ");
  return clean.length > max ? clean.slice(0, max - 1).replace(/[\s.]+$/, "") + "…" : clean;
}

// Greedy word-wrap into at most `maxLines` lines of ~`maxChars`, ellipsizing overflow.
function wrapTitle(title: string, maxChars: number, maxLines: number): string[] {
  const words = String(title).trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  let overflow = false;
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (cand.length <= maxChars) {
      cur = cand;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) {
        overflow = true;
        break;
      }
    }
  }
  if (!overflow && cur && lines.length < maxLines) lines.push(cur);
  if (lines.length > maxLines) lines.length = maxLines;
  if (overflow && lines.length) {
    let last = lines[lines.length - 1];
    if (last.length > maxChars - 1) last = last.slice(0, maxChars - 1);
    lines[lines.length - 1] = last.replace(/[\s.]+$/, "") + "…";
  }
  return lines.length ? lines : ["Support this campaign"];
}

function gradientSvg(accent?: string | null): string {
  const a = hexClamp(accent) || "#7C3AED";
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#312E81"/>
        <stop offset="55%" stop-color="${a}"/>
        <stop offset="100%" stop-color="#0EA5E9"/>
      </linearGradient>
      <radialGradient id="hi" cx="18%" cy="12%" r="80%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.16"/>
        <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect width="${W}" height="${H}" fill="url(#hi)"/>
  </svg>`;
}

async function buildBase(card: CardData): Promise<Buffer> {
  if (card.kind === "donation" && card.cover) {
    try {
      const resp = await axios.get<ArrayBuffer>(card.cover, {
        responseType: "arraybuffer",
        timeout: 3500,
        maxContentLength: 8 * 1024 * 1024,
      });
      return await sharp(Buffer.from(resp.data))
        .resize(W, H, { fit: "cover", position: "attention" })
        .modulate({ brightness: 0.82 })
        .toBuffer();
    } catch {
      /* fall through to gradient */
    }
  }
  return await sharp(Buffer.from(gradientSvg(card.accent))).png().toBuffer();
}

async function circleAvatar(url: string, size: number): Promise<Buffer | null> {
  try {
    const resp = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout: 3000,
      maxContentLength: 5 * 1024 * 1024,
    });
    const img = await sharp(Buffer.from(resp.data)).resize(size, size, { fit: "cover" }).toBuffer();
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
    );
    return await sharp(img).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  } catch {
    return null;
  }
}

function donationSvg(d: CardData): string {
  const pct = d.hasGoal && d.percent != null ? Math.max(0, Math.min(100, d.percent)) : null;
  const barX = 64;
  const barW = W - 128;
  const barY = 486;
  const barH = 20;
  const fillW = pct != null ? Math.max(pct > 0 ? 20 : 0, Math.round((barW * pct) / 100)) : 0;
  const lines = wrapTitle(d.title, 30, 2);
  const LINE_H = 64;
  const firstY = 440 - (lines.length - 1) * LINE_H;
  const tspans = lines.map((ln, i) => `<tspan x="64" y="${firstY + i * LINE_H}">${esc(ln)}</tspan>`).join("");
  const eyebrow = d.hasGoal ? "CROWDFUNDING" : "TIPS";
  const raisedLabel = d.hasGoal
    ? `${fmtMoney(d.raised, d.currency)} raised of ${fmtMoney(d.goal as number, d.currency)}`
    : `${fmtMoney(d.raised, d.currency)} raised`;
  const pctLabel = pct != null ? `${pct}% funded` : "";
  return `
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0A0A14" stop-opacity="0.05"/>
      <stop offset="45%" stop-color="#0A0A14" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#08080F" stop-opacity="0.93"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#scrim)"/>
  <text x="64" y="88" font-family="${FONT}" font-size="30" font-weight="700" letter-spacing="3" fill="#FFFFFF">DYNOPAY</text>
  <text x="64" y="${firstY - 46}" font-family="${FONT}" font-size="22" font-weight="700" letter-spacing="5" fill="#C7D2FE">${eyebrow}</text>
  <text font-family="${FONT}" font-size="56" font-weight="800" fill="#FFFFFF">${tspans}</text>
  ${
    d.hasGoal
      ? `<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="10" fill="#FFFFFF" fill-opacity="0.22"/>
  <rect x="${barX}" y="${barY}" width="${fillW}" height="${barH}" rx="10" fill="#818CF8"/>`
      : ""
  }
  <text x="64" y="565" font-family="${FONT}" font-size="28" font-weight="800" fill="#FFFFFF">${esc(pctLabel)}</text>
  <text x="${W - 64}" y="565" text-anchor="end" font-family="${FONT}" font-size="26" font-weight="500" fill="#E5E7EB">${esc(raisedLabel)}</text>`;
}

function standardSvg(d: CardData): string {
  const lines = wrapTitle(d.title, 26, 2);
  const LINE_H = 66;
  const firstY = 420 - (lines.length - 1) * LINE_H;
  const tspans = lines.map((ln, i) => `<tspan x="64" y="${firstY + i * LINE_H}">${esc(ln)}</tspan>`).join("");
  return `
  <text x="64" y="88" font-family="${FONT}" font-size="30" font-weight="700" letter-spacing="3" fill="#FFFFFF">DYNOPAY</text>
  <text x="64" y="${firstY - 48}" font-family="${FONT}" font-size="22" font-weight="700" letter-spacing="5" fill="#C7D2FE">SECURE CHECKOUT</text>
  <text font-family="${FONT}" font-size="56" font-weight="800" fill="#FFFFFF">${tspans}</text>
  <text x="64" y="566" font-family="${FONT}" font-size="26" font-weight="600" fill="#E5E7EB">Bitcoin · Ethereum · USDT and more — no account needed</text>`;
}

function shopSvg(d: CardData, hasAvatar: boolean): string {
  const initial = (d.title || "?").trim().charAt(0).toUpperCase() || "?";
  const accent = hexClamp(d.accent) || "#818CF8";
  const monogram = hasAvatar
    ? ""
    : `<circle cx="134" cy="266" r="70" fill="${accent}"/>
       <text x="134" y="292" text-anchor="middle" font-family="${FONT}" font-size="64" font-weight="800" fill="#FFFFFF">${esc(initial)}</text>`;
  const verified = d.verified
    ? `<circle cx="244" cy="300" r="12" fill="#22C55E"/>
       <path d="M238 300 l4 4 l8 -9" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
       <text x="264" y="307" font-family="${FONT}" font-size="22" font-weight="700" fill="#D1FAE5">Verified merchant</text>`
    : "";
  const taglineY = d.verified ? 352 : 330;
  const tagline = d.subtitle
    ? `<text x="232" y="${taglineY}" font-family="${FONT}" font-size="26" font-weight="500" fill="#E5E7EB">${esc(oneLine(d.subtitle, 46))}</text>`
    : "";
  return `
  <text x="64" y="88" font-family="${FONT}" font-size="30" font-weight="700" letter-spacing="3" fill="#FFFFFF">DYNOPAY</text>
  ${monogram}
  <text x="232" y="222" font-family="${FONT}" font-size="22" font-weight="700" letter-spacing="5" fill="#C7D2FE">STOREFRONT</text>
  <text x="232" y="278" font-family="${FONT}" font-size="52" font-weight="800" fill="#FFFFFF">${esc(oneLine(d.title, 22))}</text>
  ${verified}
  ${tagline}
  <text x="64" y="566" font-family="${FONT}" font-size="28" font-weight="800" fill="#FFFFFF">Shop with crypto — pay in Bitcoin, Ethereum, USDT &amp; more</text>`;
}

function buildOverlaySvg(d: CardData, hasAvatar: boolean): Buffer {
  const inner = d.kind === "donation" ? donationSvg(d) : d.kind === "standard" ? standardSvg(d) : shopSvg(d, hasAvatar);
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  return Buffer.from(svg);
}

function demoCard(): CardData {
  return {
    kind: "donation",
    title: "Help rebuild the Riverside Community Library",
    subtitle: null,
    cover: DEMO_COVER,
    logo: null,
    accent: null,
    currency: "USD",
    goal: 25000,
    raised: 16240,
    percent: 65,
    hasGoal: true,
    verified: false,
  };
}

async function loadLink(data: string): Promise<CardData | null> {
  const item = (await getRedisItem("customer-" + data)) as Record<string, unknown> | null;
  if (!item || Object.keys(item).length === 0) return null;

  let merchantName: string | null = null;
  let merchantLogo: string | null = null;
  let accent: string | null = null;
  if (item.company_id) {
    try {
      const company = await companyModel.findByPk(item.company_id as number);
      if (company) {
        const cd = (company as { dataValues: Record<string, unknown> }).dataValues;
        merchantName = await resolvePublicCompanyName(cd);
        merchantLogo = cd.photo ? String(cd.photo) : null;
        accent = (cd.theme_accent_color as string) || null;
      }
    } catch {
      /* ignore */
    }
  }

  const currency = String(item.base_currency || "USD");

  if (item.link_type === "donation" && item.link_id) {
    const [parentRow] = (await sequelize.query(
      `SELECT title, goal_amount, campaign_image, base_currency
       FROM tbl_payment_link WHERE link_id = :id AND link_type = 'donation'`,
      { replacements: { id: item.link_id }, type: QueryTypes.SELECT }
    )) as Array<Record<string, unknown>>;
    if (!parentRow) return null;
    const agg = await getDonationAggregates(Number(item.link_id));
    const goal = parentRow.goal_amount != null ? Number(parentRow.goal_amount) : null;
    const hasGoal = !!(goal && goal > 0);
    return {
      kind: "donation",
      title: (parentRow.title as string) || "Support this campaign",
      subtitle: merchantName,
      cover: (parentRow.campaign_image as string) || null,
      logo: null,
      accent,
      currency: String(parentRow.base_currency || currency),
      goal,
      raised: agg.raised_amount,
      percent: hasGoal ? Math.min(100, Math.round((agg.raised_amount / (goal as number)) * 100)) : null,
      hasGoal,
      verified: false,
    };
  }

  // Standard payment link
  const amount = Number(item.base_amount || item.amount || 0) || null;
  const title = amount
    ? `Pay ${fmtMoney(amount, currency)}${merchantName ? ` to ${merchantName}` : ""}`
    : merchantName
      ? `Pay ${merchantName}`
      : "Complete your payment";
  return {
    kind: "standard",
    title,
    subtitle: merchantName,
    cover: null,
    logo: merchantLogo,
    accent,
    currency,
    goal: null,
    raised: 0,
    percent: null,
    hasGoal: false,
    verified: false,
  };
}

async function loadShop(handle: string): Promise<CardData | null> {
  const ownerRaw = await resolveStorefrontByHandle(handle);
  if (!ownerRaw) return null;
  const owner = ownerRaw as unknown as {
    handle?: string;
    name?: string;
    photo?: string | null;
    bio?: string | null;
    user_id?: number;
    company_id?: number | null;
    theme_accent_color?: string | null;
  };
  const userId = Number(owner.user_id) || null;
  let verified = false;
  try {
    verified = await isMerchantIdentityVerified(userId, owner.company_id ?? null);
  } catch {
    verified = false;
  }
  return {
    kind: "shop",
    title: owner.name || owner.handle || "Storefront",
    subtitle: owner.bio || null,
    cover: null,
    logo: owner.photo || null,
    accent: owner.theme_accent_color || null,
    currency: "USD",
    goal: null,
    raised: 0,
    percent: null,
    hasGoal: false,
    verified,
  };
}

export const getCampaignOgImage = async (req: express.Request, res: express.Response) => {
  try {
    const isDemo = String(req.query.demo || "") === "1";
    const shopHandle = String(req.query.shop || "").trim();
    const data = String(req.query.d || "").trim();

    let card: CardData | null = null;
    if (isDemo) card = demoCard();
    else if (shopHandle) card = await loadShop(shopHandle);
    else if (data) card = await loadLink(data);

    if (!card) return res.redirect(302, FALLBACK_OG);

    const base = await buildBase(card);
    const layers: sharp.OverlayOptions[] = [];
    let hasAvatar = false;
    if (card.kind === "shop" && card.logo) {
      const av = await circleAvatar(card.logo, 140);
      if (av) {
        layers.push({ input: av, top: 196, left: 64 });
        hasAvatar = true;
      }
    }
    layers.push({ input: buildOverlaySvg(card, hasAvatar), top: 0, left: 0 });

    const png = await sharp(base).composite(layers).png().toBuffer();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
    return res.status(200).end(png);
  } catch (e) {
    apiLogger.error("[getCampaignOgImage] error:", e);
    return res.redirect(302, FALLBACK_OG);
  }
};

export default getCampaignOgImage;
