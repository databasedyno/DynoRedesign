import React, { useMemo, useState } from "react";
import { Box, Button, Typography, useTheme, InputBase } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { BRAND_ACCENT } from "@/constants/theme";
import {
  ACCENT_PRESETS,
  GRADIENT_PRESETS,
  buildCoverBackground,
} from "@/constants/creatorTheme";
import type { CoverStyle, CreatorTheme } from "@/constants/creatorTheme";

// Re-exported so existing importers (CreatorPageSettings) keep working.
export { ACCENT_PRESETS, GRADIENT_PRESETS, buildCoverBackground };
export type { CoverStyle, CreatorTheme };

/**
 * Custom Creator Theme picker (Session 60).
 *
 * Lets creators choose:
 *   - accent color: preset swatch OR custom hex
 *   - cover style: solid | gradient | image | pattern
 *   - gradient preset (only when style=gradient)
 *
 * Emits changes via onChange. Parent owns the state (typically the
 * CreatorPageSettings form which persists everything on Save).
 */

interface Props {
  value: CreatorTheme;
  onChange: (next: CreatorTheme) => void;
  hasCoverImage?: boolean; // when true, "Image" cover style is meaningful
}

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

const CreatorThemePicker: React.FC<Props> = ({ value, onChange, hasCoverImage }) => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const border = theme.palette.divider;
  const isDark = theme.palette.mode === "dark";

  const styleLabel = (s: CoverStyle) =>
    t(`storefront.cover${s.charAt(0).toUpperCase()}${s.slice(1)}`, { defaultValue: s });

  const currentAccent = value.accentColor || BRAND_ACCENT;
  const currentStyle: CoverStyle = value.coverStyle || "solid";
  const currentGradient = value.coverGradient || "sunset";

  const [customHex, setCustomHex] = useState<string>(
    ACCENT_PRESETS.some((p) => p.hex.toUpperCase() === currentAccent.toUpperCase()) ? "" : currentAccent
  );

  const isCustomAccent = useMemo(
    () => !ACCENT_PRESETS.some((p) => p.hex.toUpperCase() === currentAccent.toUpperCase()),
    [currentAccent]
  );

  const setAccent = (hex: string) => {
    onChange({ ...value, accentColor: hex.toUpperCase() });
  };
  const setStyle = (s: CoverStyle) => {
    // If switching to gradient and none picked yet, seed with sunset
    const next: CreatorTheme = { ...value, coverStyle: s };
    if (s === "gradient" && !value.coverGradient) next.coverGradient = "sunset";
    onChange(next);
  };
  const setGradient = (g: string) => {
    onChange({ ...value, coverGradient: g });
  };

  const previewBg = buildCoverBackground({ ...value, coverStyle: currentStyle });

  // Contrast-guard: readable text ON a solid accent fill (light accents → ink).
  const readableOnAccent = useMemo(() => {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(currentAccent.trim());
    if (!m) return "#FFFFFF";
    const h = m[1];
    const L =
      (0.2126 * parseInt(h.slice(0, 2), 16) +
        0.7152 * parseInt(h.slice(2, 4), 16) +
        0.0722 * parseInt(h.slice(4, 6), 16)) / 255;
    return L > 0.6 ? "#0A0A0B" : "#FFFFFF";
  }, [currentAccent]);

  const sectionLabel = (
    icon: string,
    label: string
  ) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
      <Icon icon={icon} width={15} color={theme.palette.text.secondary} />
      <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
        {label}
      </Typography>
    </Box>
  );

  return (
    <Box data-testid="creator-theme-picker" sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* LIVE PREVIEW — mini mock of the public page hero */}
      <Box
        sx={{
          height: 112,
          borderRadius: "14px",
          border: `1px solid ${border}`,
          background: previewBg,
          position: "relative",
          overflow: "hidden",
          boxShadow: isDark ? "0 10px 30px rgba(0,0,0,0.35)" : "0 10px 30px rgba(67,56,202,0.10)",
        }}
        data-testid="theme-preview"
      >
        {/* Bottom scrim — same blend the real page hero uses */}
        <Box
          aria-hidden
          sx={{
            position: "absolute", inset: 0,
            background: `linear-gradient(to bottom, transparent 30%, ${isDark ? "rgba(10,10,20,0.65)" : "rgba(255,255,255,0.55)"} 100%)`,
          }}
        />
        {/* Mini avatar + identity skeleton — makes the preview read as "your page" */}
        <Box sx={{ position: "absolute", left: 14, bottom: 12, display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            sx={{
              width: 36, height: 36, borderRadius: "50%",
              p: "2px",
              background: `linear-gradient(135deg, ${currentAccent} 0%, #7C3AED 100%)`,
              boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
            }}
          >
            <Box sx={{ width: "100%", height: "100%", borderRadius: "50%", backgroundColor: theme.palette.background.paper, border: `2px solid ${theme.palette.background.paper}` }} />
          </Box>
          <Box>
            <Box sx={{ width: 74, height: 9, borderRadius: 99, backgroundColor: isDark ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.95)", boxShadow: "0 1px 6px rgba(0,0,0,0.25)" }} />
            <Box sx={{ width: 46, height: 7, borderRadius: 99, mt: 0.75, backgroundColor: isDark ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.7)", boxShadow: "0 1px 6px rgba(0,0,0,0.2)" }} />
          </Box>
        </Box>
        <Box
          sx={{
            position: "absolute", right: 12, bottom: 12,
            px: 1.25, py: 0.5, borderRadius: "999px",
            background: `linear-gradient(135deg, ${currentAccent} 0%, #7C3AED 100%)`,
            color: readableOnAccent,
            fontWeight: 700, fontSize: 12,
            boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
          }}
        >
          {t("storefront.accentButton", { defaultValue: "Accent button" })}
        </Box>
      </Box>

      {/* ACCENT COLOR */}
      <Box>
        {sectionLabel("mdi:palette-outline", t("storefront.accentColor", { defaultValue: "Accent color" }))}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {ACCENT_PRESETS.map((p) => {
            const active = currentAccent.toUpperCase() === p.hex.toUpperCase();
            return (
              <Box
                key={p.key}
                role="button"
                tabIndex={0}
                onClick={() => setAccent(p.hex)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setAccent(p.hex)}
                data-testid={`accent-swatch-${p.key}`}
                sx={{
                  width: 36, height: 36, borderRadius: "50%",
                  backgroundColor: p.hex,
                  cursor: "pointer",
                  border: active ? `3px solid ${theme.palette.text.primary}` : `2px solid ${border}`,
                  boxShadow: active ? `0 0 0 2px ${p.hex}55` : "none",
                  transition: "transform 120ms, box-shadow 120ms",
                  "&:hover": { transform: "scale(1.08)" },
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                title={p.label}
              >
                {active && <Icon icon="mdi:check" width={16} color="#0A0A0B" />}
              </Box>
            );
          })}

          {/* Custom hex input */}
          <Box
            sx={{
              display: "flex", alignItems: "center", gap: 0.5,
              px: 1, py: 0.5, borderRadius: "20px",
              border: `2px solid ${isCustomAccent ? theme.palette.text.primary : border}`,
              minWidth: 118, height: 36,
            }}
          >
            <Icon icon="mdi:pound" width={14} color={theme.palette.text.secondary} />
            <InputBase
              placeholder="A855F7"
              value={customHex.replace(/^#/, "").toUpperCase()}
              onChange={(e) => {
                const raw = "#" + e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                setCustomHex(raw);
                if (HEX_RE.test(raw)) setAccent(raw);
              }}
              sx={{ fontSize: 12, fontFamily: "ui-monospace, monospace", flex: 1, "& input": { p: 0 } }}
              inputProps={{ maxLength: 6, "aria-label": "Custom hex color", "data-testid": "accent-custom-hex" }}
            />
          </Box>
        </Box>
      </Box>

      {/* COVER STYLE */}
      <Box>
        {sectionLabel("mdi:image-frame", t("storefront.coverStyle", { defaultValue: "Cover style" }))}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 1 }}>
          {(["solid", "gradient", "image", "pattern"] as CoverStyle[]).map((s) => {
            const active = currentStyle === s;
            const disabled = s === "image" && !hasCoverImage;
            const previewSmall = buildCoverBackground({ accentColor: currentAccent, coverStyle: s, coverGradient: currentGradient });
            return (
              <Box
                key={s}
                role="button"
                tabIndex={disabled ? -1 : 0}
                onClick={() => !disabled && setStyle(s)}
                onKeyDown={(e) => !disabled && (e.key === "Enter" || e.key === " ") && setStyle(s)}
                data-testid={`cover-style-${s}`}
                sx={{
                  opacity: disabled ? 0.4 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                  border: active ? `2px solid ${theme.palette.text.primary}` : `1px solid ${border}`,
                  borderRadius: "10px",
                  overflow: "hidden",
                  transition: "transform 120ms",
                  "&:hover": disabled ? {} : { transform: "translateY(-2px)" },
                }}
                title={disabled ? t("storefront.uploadCoverFirst", { defaultValue: "Upload a cover image first" }) : ""}
              >
                <Box sx={{ height: 44, background: previewSmall }} />
                <Box sx={{ px: 1, py: 0.5, display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.palette.background.paper }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600 }}>{styleLabel(s)}</Typography>
                  {active && <Icon icon="mdi:check-circle" width={14} color={currentAccent} />}
                </Box>
              </Box>
            );
          })}
        </Box>
        {currentStyle === "image" && !hasCoverImage && (
          <Typography sx={{ mt: 0.5, fontSize: 11, color: theme.palette.warning.main }}>
            {t("storefront.uploadCoverHint", { defaultValue: 'Upload a cover image below to use "Image" style.' })}
          </Typography>
        )}
      </Box>

      {/* GRADIENT PRESETS — live cover thumbnails, only when style=gradient */}
      {currentStyle === "gradient" && (
        <Box>
          {sectionLabel("mdi:gradient-vertical", t("storefront.gradientPreset", { defaultValue: "Gradient preset" }))}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" }, gap: 1.25 }}>
            {GRADIENT_PRESETS.map((g) => {
              const active = currentGradient === g.key;
              return (
                <Box
                  key={g.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setGradient(g.key)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setGradient(g.key)}
                  data-testid={`gradient-preset-${g.key}`}
                  sx={{
                    cursor: "pointer",
                    border: active ? `2px solid ${currentAccent}` : `1px solid ${border}`,
                    borderRadius: "12px", overflow: "hidden",
                    boxShadow: active ? `0 0 0 3px ${currentAccent}33, 0 10px 24px rgba(0,0,0,0.18)` : "none",
                    transition: "transform 120ms, box-shadow 120ms, border-color 120ms",
                    "&:hover": { transform: "translateY(-2px)", boxShadow: `0 10px 24px ${isDark ? "rgba(0,0,0,0.4)" : "rgba(67,56,202,0.14)"}` },
                  }}
                >
                  {/* Live mini-cover: gradient + hero scrim + avatar dot straddling the edge */}
                  <Box sx={{ position: "relative", height: 58, background: `linear-gradient(135deg, ${g.stops})` }}>
                    <Box
                      aria-hidden
                      sx={{
                        position: "absolute", inset: 0,
                        background: `linear-gradient(to bottom, transparent 40%, ${isDark ? "rgba(10,10,20,0.55)" : "rgba(255,255,255,0.45)"} 100%)`,
                      }}
                    />
                    <Box
                      aria-hidden
                      sx={{
                        position: "absolute", left: "50%", bottom: -9, transform: "translateX(-50%)",
                        width: 22, height: 22, borderRadius: "50%",
                        backgroundColor: theme.palette.background.paper,
                        border: `2px solid ${isDark ? "rgba(255,255,255,0.85)" : "#FFFFFF"}`,
                        boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
                        zIndex: 1,
                      }}
                    />
                  </Box>
                  <Box sx={{ px: 1, pt: 1.25, pb: 0.75, backgroundColor: theme.palette.background.paper, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>{g.label}</Typography>
                    {active && <Icon icon="mdi:check-circle" width={13} color={currentAccent} />}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* RESET */}
      <Box>
        <Button
          size="small"
          variant="text"
          onClick={() => onChange({ accentColor: null, coverStyle: null, coverGradient: null })}
          startIcon={<Icon icon="mdi:refresh" width={14} />}
          data-testid="theme-reset"
          sx={{ textTransform: "none", fontSize: 12, color: theme.palette.text.secondary }}
        >
          {t("storefront.resetDefault", { defaultValue: "Reset to default" })}
        </Button>
      </Box>
    </Box>
  );
};

export default CreatorThemePicker;
