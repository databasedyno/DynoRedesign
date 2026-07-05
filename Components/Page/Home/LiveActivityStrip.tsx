import React, { useEffect, useMemo, useState, memo } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import USDT from "@/assets/Icons/coins/USDT";
import USDC from "@/assets/Icons/coins/USDC";
import BTC from "@/assets/Icons/coins/BTC";
import ETH from "@/assets/Icons/coins/ETH";
import SOL from "@/assets/Icons/coins/SOL";
import XRP from "@/assets/Icons/coins/XRP";
import RLUSD from "@/assets/Icons/coins/RLUSD";
import useIsMobile from "@/hooks/useIsMobile";

/**
 * LiveActivityStrip — an anonymized "recent settlements" ticker under the hero.
 *
 * ⚠️ Data source: CURATED FAKE (approved by product 2026-07-05). Everything below
 * is deterministic client-side content. It never hits the API and never touches
 * the DB. When we're ready to flip this to the real prod feed, replace `SEED`
 * with a `fetch('/api/public/activity-feed')` and keep the same shape.
 *
 * Design goal: signal "this thing is actively processing payments right now"
 * without exposing any merchant identity or specific tx hash.
 */

interface Event {
  country: string; // ISO-3166 alpha-2 for the flag emoji
  amount: number;
  currency: string; // USDT / USDC / BTC / ETH / ...
  chain?: string;   // for the small "on TRC20" caption
  agoSec: number;   // seconds since the event
}

const COIN_ICON: Record<string, React.FC<{ width?: string | number; height?: string | number }>> = {
  USDT, USDC, BTC, ETH, SOL, XRP, RLUSD,
};

// Country-flag emoji from ISO code
const flagOf = (iso: string): string => {
  if (!iso || iso.length !== 2) return "🌐";
  const base = 0x1f1e6;
  const [a, b] = iso.toUpperCase().split("");
  return String.fromCodePoint(base + (a.charCodeAt(0) - 65), base + (b.charCodeAt(0) - 65));
};

const ago = (sec: number): string => {
  if (sec < 60) return `${Math.max(1, Math.round(sec))}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
};

// Curated pool — geographically diverse, realistic amounts, common chains.
// Base "agoSec" values below are treated as offsets from page load, so the
// stream feels alive across reloads. Anything under 60 s gets a pulsing dot.
const SEED: Event[] = [
  { country: "BR", amount: 84,    currency: "USDT", chain: "TRC20",   agoSec: 40   },
  { country: "DE", amount: 250,   currency: "USDC", chain: "ERC20",   agoSec: 130  },
  { country: "NG", amount: 12.5,  currency: "USDT", chain: "TRC20",   agoSec: 220  },
  { country: "IN", amount: 199,   currency: "USDT", chain: "POLYGON", agoSec: 305  },
  { country: "PT", amount: 42.00, currency: "USDC", chain: "ERC20",   agoSec: 405  },
  { country: "VN", amount: 60,    currency: "USDT", chain: "TRC20",   agoSec: 510  },
  { country: "US", amount: 1250,  currency: "USDC", chain: "ERC20",   agoSec: 620  },
  { country: "GB", amount: 0.0031,currency: "BTC",  chain: "Bitcoin", agoSec: 745  },
  { country: "TR", amount: 0.024, currency: "ETH",  chain: "Ethereum",agoSec: 860  },
  { country: "MX", amount: 320,   currency: "USDT", chain: "TRC20",   agoSec: 990  },
  { country: "AR", amount: 75,    currency: "USDC", chain: "POLYGON", agoSec: 1120 },
  { country: "KE", amount: 18,    currency: "USDT", chain: "TRC20",   agoSec: 1290 },
  { country: "PH", amount: 145,   currency: "USDT", chain: "TRC20",   agoSec: 1460 },
  { country: "ID", amount: 68,    currency: "USDC", chain: "POLYGON", agoSec: 1640 },
  { country: "PL", amount: 500,   currency: "RLUSD",chain: "XRPL",    agoSec: 1830 },
  { country: "ZA", amount: 92,    currency: "USDT", chain: "ERC20",   agoSec: 2020 },
];

const formatAmount = (n: number, currency: string): string => {
  if (["BTC", "ETH", "SOL"].includes(currency)) {
    // Show more precision for volatile / high-unit-value coins
    return n < 1 ? n.toFixed(4).replace(/0+$/, "") : n.toString();
  }
  return n.toLocaleString("en-US", {
    minimumFractionDigits: n < 10 ? 2 : 0,
    maximumFractionDigits: 2,
  });
};

const Pill: React.FC<{ ev: Event; isDark: boolean }> = ({ ev, isDark }) => {
  const Icon = COIN_ICON[ev.currency];
  const isFresh = ev.agoSec < 90;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1.2,
        px: { xs: 1.6, sm: 2 },
        py: 0.9,
        borderRadius: "999px",
        flexShrink: 0,
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.7)",
        backdropFilter: "saturate(140%) blur(6px)",
        WebkitBackdropFilter: "saturate(140%) blur(6px)",
        boxShadow: isDark
          ? "0 4px 14px rgba(0,0,0,0.25)"
          : "0 4px 14px rgba(0,4,255,0.05)",
      }}
    >
      {/* Live pulse dot only for fresh events */}
      {isFresh && (
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: "#22C55E",
            flexShrink: 0,
            boxShadow: "0 0 0 rgba(34,197,94, 0.6)",
            animation: "dyno-live-pulse 1.8s infinite",
            "@keyframes dyno-live-pulse": {
              "0%":   { boxShadow: "0 0 0 0 rgba(34,197,94, 0.55)" },
              "70%":  { boxShadow: "0 0 0 10px rgba(34,197,94, 0)" },
              "100%": { boxShadow: "0 0 0 0 rgba(34,197,94, 0)" },
            },
          }}
        />
      )}
      <Typography component="span" sx={{ fontSize: { xs: 18, sm: 20 }, lineHeight: 1 }}>
        {flagOf(ev.country)}
      </Typography>
      <Typography
        component="span"
        sx={{
          fontFamily: "UrbanistMedium",
          fontSize: { xs: 12.5, sm: 13 },
          color: (theme) => theme.palette.text.secondary,
          whiteSpace: "nowrap",
        }}
      >
        Merchant accepted
      </Typography>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
        {Icon ? (
          <Box sx={{ width: 16, height: 16, display: "flex", alignItems: "center" }}>
            <Icon width={16} height={16} />
          </Box>
        ) : null}
        <Typography
          component="span"
          sx={{
            fontFamily: "UrbanistBold",
            fontSize: { xs: 13, sm: 14 },
            color: (theme) => theme.palette.text.primary,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {formatAmount(ev.amount, ev.currency)} {ev.currency}
        </Typography>
      </Box>
      <Typography
        component="span"
        sx={{
          fontFamily: "UrbanistRegular",
          fontSize: { xs: 11.5, sm: 12 },
          color: (theme) => theme.palette.text.disabled,
          whiteSpace: "nowrap",
          ml: 0.2,
        }}
      >
        · {ago(ev.agoSec)}
      </Typography>
    </Box>
  );
};

const LiveActivityStrip: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isMobile = useIsMobile("md");

  // SSR-safety: don't compute any time-dependent or random values until after
  // client mount. Server renders a stable baseline; client hydrates cleanly and
  // then starts ticking. Prevents "Text content did not match" hydration errors.
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [jitter, setJitter] = useState(0);

  useEffect(() => {
    setMounted(true);
    setJitter(Math.floor(Math.random() * 25)); // 0-24s, client only
    const id1 = setInterval(() => setTick((t) => t + 1), 1000);
    const id2 = setInterval(() => setRotation((r) => (r + 1) % SEED.length), 5000);
    return () => {
      clearInterval(id1);
      clearInterval(id2);
    };
  }, []);

  const events = useMemo(() => {
    // Rotate the seed by `rotation`, then age everyone by tick+jitter.
    const rotated = [...SEED.slice(rotation), ...SEED.slice(0, rotation)];
    return rotated.map((e, i) => ({
      ...e,
      // Fresh event gets increasingly fresh look between rotations
      agoSec: Math.max(3, e.agoSec + tick + jitter - (i === 0 ? e.agoSec - 5 : 0)),
    }));
  }, [rotation, tick, jitter]);

  // Loop the visible slice for a seamless marquee
  const marqueeItems = useMemo(() => [...events, ...events], [events]);

  const totalToday = useMemo(() => {
    // Curated headline number, drifts up over the session for liveness.
    const base = 128_450;
    return (base + tick * 3 + rotation * 17).toLocaleString("en-US");
  }, [tick, rotation]);

  return (
    <Box
      sx={{
        width: "100%",
        py: { xs: 3, md: 4 },
        px: { xs: 2, md: 4 },
        maxWidth: 1200,
        mx: "auto",
      }}
      aria-label="Live merchant activity"
    >
      {/* Headline row — small "live" indicator + today's volume */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1.5,
          mb: { xs: 1.5, md: 2 },
          flexWrap: "wrap",
        }}
      >
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.8,
            px: 1.2,
            py: 0.35,
            borderRadius: "999px",
            border: `1px solid ${isDark ? "rgba(34,197,94,0.35)" : "rgba(34,197,94,0.28)"}`,
            bgcolor: isDark ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.06)",
          }}
        >
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: "#22C55E",
              animation: "dyno-live-dot 1.6s infinite",
              "@keyframes dyno-live-dot": {
                "0%":   { opacity: 1 },
                "50%":  { opacity: 0.35 },
                "100%": { opacity: 1 },
              },
            }}
          />
          <Typography
            sx={{
              fontFamily: "UrbanistBold",
              fontSize: 11.5,
              letterSpacing: "0.6px",
              color: isDark ? "#4ADE80" : "#16A34A",
              textTransform: "uppercase",
            }}
          >
            Live
          </Typography>
        </Box>
        <Typography
          sx={{
            fontFamily: "UrbanistMedium",
            fontSize: { xs: 13, md: 14 },
            color: theme.palette.text.secondary,
            textAlign: "center",
          }}
        >
          <Box
            component="span"
            sx={{
              fontFamily: "UrbanistBold",
              color: theme.palette.text.primary,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${totalToday}
          </Box>{" "}
          processed in the last 24h ·{" "}
          <Box
            component="span"
            sx={{
              fontFamily: "UrbanistBold",
              color: theme.palette.text.primary,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            1,247
          </Box>{" "}
          payments settled this week
        </Typography>
      </Box>

      {/* Marquee strip */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          overflow: "hidden",
          // Edge fade so pills scroll softly in/out
          "&::before, &::after": {
            content: '""',
            position: "absolute",
            top: 0,
            bottom: 0,
            width: { xs: "24px", md: "72px" },
            zIndex: 2,
            pointerEvents: "none",
          },
          "&::before": {
            left: 0,
            background: isDark
              ? "linear-gradient(90deg, rgba(15,16,30,1), rgba(15,16,30,0))"
              : `linear-gradient(90deg, ${theme.palette.background.default}, transparent)`,
          },
          "&::after": {
            right: 0,
            background: isDark
              ? "linear-gradient(-90deg, rgba(15,16,30,1), rgba(15,16,30,0))"
              : `linear-gradient(-90deg, ${theme.palette.background.default}, transparent)`,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: 1.5,
            width: "max-content",
            animation: `dyno-activity-scroll ${isMobile ? 45 : 55}s linear infinite`,
            willChange: "transform",
            "@keyframes dyno-activity-scroll": {
              "0%":   { transform: "translateX(0)" },
              "100%": { transform: "translateX(-50%)" },
            },
            "&:hover": { animationPlayState: "paused" },
          }}
        >
          {marqueeItems.map((ev, i) => (
            <Pill key={`${ev.country}-${ev.amount}-${i}`} ev={ev} isDark={isDark} />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(LiveActivityStrip);
