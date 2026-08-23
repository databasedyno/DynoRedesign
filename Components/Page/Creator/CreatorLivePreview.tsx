import React from "react";
import { Box, LinearProgress, Typography, useTheme } from "@mui/material";
import { alpha, darken } from "@mui/material/styles";
import { Icon } from "@iconify/react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { rootReducer } from "@/utils/types";
import type { CreatorFormState } from "./CreatorPageSettings";
import { prettyCreatorDomain } from "@/helpers/creatorUrl";
import { BRAND_ACCENT } from "@/constants/theme";
import { GRADIENT_STOPS } from "@/constants/creatorTheme";
import Logo from "@/assets/Icons/Logo";

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace';
// Aurora indigo — Landing v3 canonical accent (Session 82 migration).
// Only the DEFAULT accent; creators override it via the theme picker.
const DEFAULT_ACCENT = BRAND_ACCENT;
const INK = "#0A0A0B";

const SOCIAL_ICONS: Record<string, string> = {
  twitter: "mdi:twitter",
  instagram: "mdi:instagram",
  youtube: "mdi:youtube",
  tiktok: "mdi:music-note",
  website: "mdi:web",
};

const SW_STYLE_META: Record<string, { title: string; icon: string }> = {
  coffee: { title: "Buy me a coffee", icon: "mdi:coffee" },
  tip: { title: "Send a tip", icon: "mdi:hand-coin" },
  support: { title: "Support me", icon: "mdi:heart" },
};

interface Props {
  state: CreatorFormState;
}

/**
 * Non-interactive visual clone of the public /[handle] page — mirrors the
 * form values in `state` so a merchant sees exactly what they're publishing
 * before hitting Save. Kept intentionally close to CreatorProfile.tsx.
 */
const CreatorLivePreview: React.FC<Props> = ({ state }) => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const isDark = theme.palette.mode === "dark";
  const border = theme.palette.divider;
  const profile = useSelector((s: rootReducer) => (s as any).userReducer.profile) as any;

  // Prefer the in-form draft name (if the user is editing it live) over the
  // last-saved profile.name. Falls back to handle → "Your name" as before.
  const draftName = (state as any).name as string | undefined;
  const name = (draftName && draftName.trim()) || profile?.name || state.handle || "Your name";
  const handle = state.handle || "yourname";
  const bio = state.bio || null;
  const photo = profile?.photo && !String(profile.photo).includes("user_image.png") ? profile.photo : null;
  const cover = state.coverImage || null;
  const socials = Object.entries(state.socialLinks || {}).filter(([, v]) => Boolean(v));
  const initial = (name || handle || "?").charAt(0).toUpperCase();

  // ── Custom theme (mirror of CreatorProfile) so the preview renders exactly
  // what gets published. Defaults fall back to the DynoPay brand accent and a
  // solid cover (or "image" when a cover image is present).
  const accent = state.accentColor || DEFAULT_ACCENT;
  const coverStyleSel = state.coverStyle || (cover ? "image" : "solid");
  const coverGradientSel = state.coverGradient || "sunset";

  const coverBackground = (() => {
    if (coverStyleSel === "image" && cover) {
      return `url(${cover}) center/cover no-repeat`;
    }
    if (coverStyleSel === "gradient") {
      const stops = GRADIENT_STOPS[coverGradientSel];
      if (stops) return `linear-gradient(135deg, ${stops})`;
      if (/^#[0-9a-f]{6},#[0-9a-f]{6}$/i.test(coverGradientSel)) {
        const [a, b] = coverGradientSel.split(",");
        return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
      }
      return `linear-gradient(135deg, ${accent} 0%, #0A0A0B 100%)`;
    }
    if (coverStyleSel === "pattern") {
      return `${accent}18 radial-gradient(${accent}44 1px, transparent 1px) 0 0/16px 16px`;
    }
    // solid (or fallback)
    return `linear-gradient(135deg, ${accent}22 0%, ${accent}66 100%)`;
  })();

  const limeTint = isDark ? `${accent}1A` : `${accent}29`;
  const surface = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";

  // Support widget preview data
  const swEnabled = Boolean(state.swEnabled);
  const swMeta = SW_STYLE_META[state.swStyle || "coffee"] || SW_STYLE_META.coffee;
  const swTitle = (state.swLabel && state.swLabel.trim()) || swMeta.title;
  const swPresets = Array.isArray(state.swPresets) && state.swPresets.length ? state.swPresets : [3, 5, 10, 25];
  const swSym = (state.swCurrency || "USD") === "EUR" ? "€" : (state.swCurrency || "USD") === "GBP" ? "£" : "$";

  return (
    <Box
      data-testid="creator-live-preview"
      sx={{
        borderRadius: "20px",
        overflow: "hidden",
        border: `1px solid ${border}`,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      {/* Preview browser chrome */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 1,
          borderBottom: `1px solid ${border}`,
          backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
        }}
      >
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#FF5F57" }} />
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#FEBC2E" }} />
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#28C840" }} />
        </Box>
        <Typography sx={{ fontFamily: MONO, fontSize: 11.5, color: theme.palette.text.secondary, ml: 1 }}>
          {prettyCreatorDomain()}/{handle}
        </Typography>
      </Box>

      {/* Cover / hero */}
      <Box
        data-testid="creator-preview-cover"
        sx={{
          height: 104,
          background: coverBackground,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "relative",
        }}
      >
        {/* Scrim blends the cover bottom into the card background */}
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to bottom, ${alpha(theme.palette.background.paper, 0)} 40%, ${alpha(theme.palette.background.paper, 0.6)} 80%, ${theme.palette.background.paper} 100%)`,
          }}
        />
      </Box>

      {/* Avatar (overlaps cover) */}
      <Box sx={{ px: 3, pt: 0, pb: 3, mt: -5, textAlign: "center", position: "relative", zIndex: 1 }}>
        <Box
          data-testid="creator-preview-avatar"
          sx={{
            width: 80, height: 80, borderRadius: "50%", overflow: "hidden",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: `4px solid ${theme.palette.background.paper}`,
            background: photo
              ? theme.palette.background.paper
              : `linear-gradient(135deg, ${accent} 0%, ${darken(accent, 0.28)} 100%)`,
            boxShadow: photo
              ? `0 8px 24px ${alpha(accent, isDark ? 0.34 : 0.2)}`
              : `0 10px 30px ${alpha(accent, 0.4)}`,
            position: "relative", zIndex: 1,
          }}
        >
          {photo ? (
            <Box component="img" src={photo} alt={name} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: 32, lineHeight: 1, color: "#FFFFFF" }}>
              {initial}
            </Typography>
          )}
        </Box>

        <Typography fontWeight={800} fontSize={19} mt={1.25} color={theme.palette.text.primary} sx={{ letterSpacing: "-0.02em" }}>
          {name}
        </Typography>
        <Typography sx={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: accent, mt: 0.25 }}>
          @{handle}
        </Typography>

        {bio && (
          <Typography fontSize={13} lineHeight={1.55} color={theme.palette.text.secondary} mt={1} sx={{ maxWidth: 360, mx: "auto" }}>
            {bio}
          </Typography>
        )}

        {socials.length > 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
            {socials.map(([platform]) => (
              <Box
                key={platform}
                sx={{
                  width: 32, height: 32, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  border: `1px solid ${border}`,
                  color: theme.palette.text.primary,
                }}
              >
                <Icon icon={SOCIAL_ICONS[platform] || "mdi:link-variant"} width={16} />
              </Box>
            ))}
          </Box>
        )}

        {/* Support widget preview (when enabled) */}
        {swEnabled && (
          <Box
            data-testid="preview-support-widget"
            sx={{
              mt: 2.5, p: 1.75, borderRadius: "12px", border: `1px solid ${accent}`,
              backgroundColor: limeTint, textAlign: "left",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 26, height: 26, borderRadius: "8px", backgroundColor: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon icon={swMeta.icon} width={15} color={INK} />
              </Box>
              <Typography fontWeight={800} fontSize={14} color={theme.palette.text.primary} noWrap>
                {swTitle}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6, mt: 1.25 }}>
              {swPresets.slice(0, 5).map((p) => (
                <Box
                  key={p}
                  sx={{
                    px: 1, py: 0.5, borderRadius: "8px", border: `1px solid ${border}`,
                    backgroundColor: surface, fontFamily: MONO, fontSize: 12, fontWeight: 700, color: theme.palette.text.primary,
                  }}
                >
                  {swSym}{p}
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 1.25, py: 0.8, borderRadius: "8px", backgroundColor: accent, textAlign: "center" }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: INK }}>
                {swTitle}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Sample featured card (dimmed hint) — only when the support widget is off */}
        {!swEnabled && (
        <Box
          sx={{
            mt: 2.5, p: 1.75, borderRadius: "12px", border: `1px solid ${accent}`,
            backgroundColor: limeTint, textAlign: "left",
          }}
        >
          <Typography sx={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
            Support {name.split(" ")[0]}
          </Typography>
          <Typography fontWeight={700} fontSize={14} color={theme.palette.text.primary} mt={0.25}>
            Your first donation link will appear here
          </Typography>
          <Typography fontSize={11.5} color={theme.palette.text.secondary} mt={0.5}>
            Create a donation link and it will feature at the top of your page.
          </Typography>
          <LinearProgress
            variant="determinate"
            value={35}
            sx={{
              mt: 1.25, height: 6, borderRadius: 999,
              backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
              "& .MuiLinearProgress-bar": { backgroundColor: accent, borderRadius: 999 },
            }}
          />
          <Box sx={{ mt: 1.25, py: 0.8, borderRadius: "8px", backgroundColor: accent, textAlign: "center" }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: INK }}>Support this campaign</Typography>
          </Box>
        </Box>
        )}

        {/* Sample link */}
        <Box
          sx={{
            mt: 1, p: 1.25, borderRadius: "12px", border: `1px solid ${border}`,
            backgroundColor: surface, display: "flex", alignItems: "center", gap: 1, textAlign: "left",
          }}
        >
          <Box sx={{ width: 32, height: 32, borderRadius: "8px", backgroundColor: limeTint, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon icon="mdi:link-variant" width={16} color={isDark ? accent : INK} />
          </Box>
          <Box flex={1} minWidth={0}>
            <Typography fontSize={12.5} fontWeight={700} color={theme.palette.text.primary} noWrap>
              {t("storefront.samplePaymentLink", { defaultValue: "Your payment links appear here" })}
            </Typography>
            <Typography fontSize={11} color={theme.palette.text.secondary} noWrap>
              {t("storefront.sampleReusable", { defaultValue: "Reusable link · any amount" })}
            </Typography>
          </Box>
          <Icon icon="mdi:arrow-top-right" width={16} color={theme.palette.text.secondary} />
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, mt: 2, opacity: 0.65 }}>
          <Typography fontSize={10.5} color={theme.palette.text.secondary}>Powered by</Typography>
          <Logo width={11} height={14} />
          <Typography fontSize={10.5} fontWeight={700} color={theme.palette.text.primary}>Dynopay</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default CreatorLivePreview;
