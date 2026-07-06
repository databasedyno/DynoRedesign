import { Box, Card, styled } from "@mui/material";

export const LoginWrapper = styled(Box)(({ theme }) => ({
  background: theme.palette.mode === "dark" ? "#0B0D17" : "#f4f6fa",
  width: "100%",
  height: "100dvh",
  minHeight: "100dvh",
  position: "relative",
  overflow: "auto",
}));

export const ContentWrapper = styled(Box)(() => ({
  position: "relative",
  zIndex: 20,
  width: "100%",
  maxWidth: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "60px 16px 40px 16px",
  minHeight: "100dvh",
  boxSizing: "border-box",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": {
    display: "none",
  },
}));

/* ── New Split Layout ──────────────────────────────────
 * Full-viewport two-column layout inspired by BlockBee. Design goals:
 *   - Desktop (lg+): brand panel on the LEFT filling half the viewport,
 *     form panel on the RIGHT filling the other half. Form is vertically
 *     centered so it never floats near the top of the page.
 *   - Tablet (md-lg): single form panel filling the ENTIRE viewport with
 *     the form vertically centered. Previously the login card floated as
 *     a small 520px box in the middle of a 768px viewport, which looked
 *     "small and near the top".
 *   - Mobile (< sm): full viewport, form vertically centered, edge padding.
 */

export const SplitLayoutWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "stretch",
  width: "100%",
  // Fill the whole viewport — no maxWidth so the panels grow to fit any
  // desktop/tablet size instead of being capped at 1100px.
  minHeight: "100dvh",
  margin: 0,
  background: theme.palette.mode === "dark" ? "#0B0D17" : "#fff",
  overflow: "hidden",

  [theme.breakpoints.down("lg")]: {
    flexDirection: "column",
    minHeight: "100dvh",
  },
}));

/** Page-level background wrapper */
export const AuthPageBackground = styled(Box)(({ theme }) => ({
  width: "100%",
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  // No inner padding — the SplitLayoutWrapper now fills the entire viewport
  // so the page background just needs to sit behind it.
  padding: 0,
  boxSizing: "border-box",
  background: theme.palette.mode === "dark" ? "#0B0D17" : "#fff",
}));

export const BrandPanel = styled(Box)(({ theme }) => ({
  // 50/50 split on desktop, filling the full viewport height.
  flex: "1 1 50%",
  maxWidth: "50%",
  minHeight: "100dvh",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "#6C5CE7",

  [theme.breakpoints.down("lg")]: {
    display: "none",
  },
}));

export const FormPanel = styled(Box)(({ theme }) => ({
  // Right half on desktop, full width on tablet/mobile. Always vertically
  // centers its child so the login form never floats near the top.
  flex: "1 1 50%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "100dvh",
  padding: "48px 56px",
  overflowY: "auto",
  overflowX: "hidden",
  background: theme.palette.mode === "dark" ? "#0B0D17" : "#fff",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },

  [theme.breakpoints.down("lg")]: {
    // Tablet: form fills the whole viewport (no brand panel), vertically
    // centered, with roomier padding so it doesn't look small.
    flex: "1 1 100%",
    maxWidth: "100%",
    padding: "40px 32px",
  },

  [theme.breakpoints.down("md")]: {
    padding: "32px 24px",
  },

  [theme.breakpoints.down("sm")]: {
    // Mobile: keep centered vertically but with tighter padding.
    padding: "24px 20px",
    alignItems: "center",
    justifyContent: "center",
  },
}));

/* ── Original components (kept for backwards compat) ─── */

export const AuthContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: "24px",
  overflow: "visible",
  position: "relative",
  zIndex: 1,
  padding: "0",
  width: "100%",
  maxWidth: "480px",

  [theme.breakpoints.down("sm")]: {
    gap: "20px",
    padding: "0",
    width: "100%",
  },
}));

export const CardWrapper = styled(Card)(({ theme }) => ({
  width: "100%",
  maxWidth: "480px",
  height: "fit-content",
  borderRadius: "12px",
  padding: "8px",
  background: theme.palette.mode === "dark" ? "#1A1D2E" : "rgba(0,0,0,0.015)",
  textAlign: "center",
  border: `1px solid ${theme.palette.mode === "dark" ? "#2A2D42" : "#E9ECF2"}`,
  boxShadow: "none",

  [theme.breakpoints.down("sm")]: {
    padding: "12px",
    width: "100%",
    borderRadius: "10px",
  },
}));

export const ImageCenter = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  cursor: "pointer",
}));
