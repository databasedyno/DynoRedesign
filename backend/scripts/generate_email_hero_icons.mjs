#!/usr/bin/env node
/**
 * Generates the per-action email hero icons -> public/email/hero/<name>.png
 * 144x144 PNG (rendered at 72px in the email = retina-crisp), transparent
 * outside a soft tinted circle, MUI "Outlined" glyph in the accent colour.
 *
 *   node scripts/generate_email_hero_icons.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "email", "hero");
const MUI_ICONS = join(HERE, "..", "..", "node_modules", "@mui", "icons-material");

// Mirrors utils/brandTokens.ts (indigo / green / amber / red)
const ACCENT = {
  indigo: { fg: "#4338CA", bg: "#EEF2FF" },
  green: { fg: "#05936A", bg: "#F0FDF4" },
  amber: { fg: "#B45309", bg: "#FFFBEB" },
  red: { fg: "#DC2626", bg: "#FEF2F2" },
};

// name -> [MUI icon module, accent]
const ICONS = {
  // outcomes
  "check": ["CheckCircleOutlineRounded", "green"],
  "hourglass": ["HourglassEmptyRounded", "amber"],
  "alert": ["WarningAmberRounded", "amber"],
  "danger": ["ErrorOutlineRounded", "red"],
  "expired": ["TimerOffOutlined", "amber"],
  "refund": ["ReplayRounded", "amber"],
  // account & security
  "lock": ["LockOutlined", "indigo"],
  "lock-red": ["LockOutlined", "red"],
  "lock-reset": ["LockResetOutlined", "indigo"],
  "shield": ["ShieldOutlined", "indigo"],
  "shield-alert": ["ShieldOutlined", "amber"],
  "mail": ["MailOutlineRounded", "indigo"],
  "person": ["PersonOutlineRounded", "indigo"],
  "device": ["DevicesOutlined", "indigo"],
  "rocket": ["RocketLaunchOutlined", "indigo"],
  "trophy": ["EmojiEventsOutlined", "green"],
  // brand / team
  "store": ["StorefrontOutlined", "indigo"],
  "trash": ["DeleteOutlineRounded", "red"],
  "team": ["GroupOutlined", "indigo"],
  // wallet & money
  "wallet": ["AccountBalanceWalletOutlined", "indigo"],
  "wallet-green": ["AccountBalanceWalletOutlined", "green"],
  "wallet-red": ["AccountBalanceWalletOutlined", "red"],
  "payout": ["PaymentsOutlined", "indigo"],
  "swap": ["SwapHorizRounded", "green"],
  // developer
  "key": ["VpnKeyOutlined", "indigo"],
  "key-off": ["KeyOffOutlined", "red"],
  "link": ["LinkRounded", "indigo"],
  "webhook": ["NotificationsActiveOutlined", "amber"],
  // growth & reporting
  "gift": ["CardGiftcardOutlined", "indigo"],
  "chart": ["InsightsRounded", "indigo"],
  "campaign": ["CampaignOutlined", "indigo"],
  // identity
  "id-card": ["BadgeOutlined", "indigo"],
  "id-card-green": ["VerifiedUserOutlined", "green"],
  "id-card-red": ["BadgeOutlined", "red"],
  // orders
  "receipt": ["ReceiptLongOutlined", "indigo"],
  "bag": ["ShoppingBagOutlined", "green"],
  "truck": ["LocalShippingOutlined", "indigo"],
  "download": ["DownloadRounded", "indigo"],
};

const pathOf = (icon) => {
  const src = readFileSync(join(MUI_ICONS, `${icon}.js`), "utf8");
  const paths = [...src.matchAll(/d: "([^"]+)"/g)].map((m) => m[1]);
  if (!paths.length) throw new Error(`no path data in ${icon}`);
  return paths;
};

const svgFor = (icon, accent) => {
  const { fg, bg } = ACCENT[accent];
  const glyph = pathOf(icon).map((d) => `<path d="${d}" fill="${fg}"/>`).join("");
  // 144 canvas, 24-unit glyph scaled x3 (=72px) and centred
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <circle cx="72" cy="72" r="70" fill="${bg}"/>
  <circle cx="72" cy="72" r="69.5" fill="none" stroke="${fg}" stroke-opacity="0.12"/>
  <g transform="translate(36 36) scale(3)">${glyph}</g>
</svg>`;
};

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [name, [icon, accent]] of Object.entries(ICONS)) {
  const png = await sharp(Buffer.from(svgFor(icon, accent))).png({ compressionLevel: 9, palette: true }).toBuffer();
  writeFileSync(join(OUT, `${name}.png`), png);
  total += png.length;
  console.log(`${name}.png  ${(png.length / 1024).toFixed(1)} KB`);
}
console.log(`\n${Object.keys(ICONS).length} icons, ${(total / 1024).toFixed(0)} KB total -> ${OUT}`);
