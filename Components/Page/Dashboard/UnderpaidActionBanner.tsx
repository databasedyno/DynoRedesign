import { Box, Typography, useTheme } from "@mui/material";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

/**
 * UnderpaidActionBanner — a slim amber "N underpaid — action needed" banner
 * shown at the top of the dashboard so staff catch shortfalls without opening
 * Transactions. Renders nothing when there are no underpaid payments.
 */
export const UnderpaidActionBanner = ({ count }: { count?: number }) => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const n = Number(count) || 0;
  if (n < 1) return null;
  const isDark = theme.palette.mode === "dark";
  const go = () => router.push("/transactions?status=underpaid");

  return (
    <Box
      role="button"
      tabIndex={0}
      data-testid="underpaid-action-banner"
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: { xs: 1.75, md: 2.25 },
        py: { xs: 1.25, md: 1.5 },
        borderRadius: "12px",
        cursor: "pointer",
        border: `1px solid ${isDark ? "rgba(249,115,22,0.35)" : "rgba(249,115,22,0.30)"}`,
        backgroundColor: isDark ? "rgba(249,115,22,0.10)" : "rgba(249,115,22,0.06)",
        transition: "background-color 160ms ease, border-color 160ms ease",
        "&:hover": {
          backgroundColor: isDark ? "rgba(249,115,22,0.16)" : "rgba(249,115,22,0.10)",
          borderColor: isDark ? "rgba(249,115,22,0.5)" : "rgba(249,115,22,0.45)",
        },
      }}
    >
      <WarningAmberRoundedIcon sx={{ fontSize: 20, color: isDark ? "#FB923C" : "#C2410C", flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          data-testid="underpaid-action-banner-title"
          sx={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: { xs: 13.5, md: 14 },
            color: isDark ? "#FDBA74" : "#9A3412",
            lineHeight: 1.3,
          }}
        >
          {t("underpaidBanner.title", { count: n, defaultValue: "{{count}} underpaid — action needed" })}
        </Typography>
        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: 12.5,
            color: theme.palette.text.secondary,
            lineHeight: 1.4,
            mt: 0.25,
          }}
        >
          {t("underpaidBanner.subtitle", { defaultValue: "Buyers paid less than due — review and chase the shortfall." })}
        </Typography>
      </Box>
      <ArrowForwardRoundedIcon sx={{ fontSize: 18, color: isDark ? "#FB923C" : "#C2410C", flexShrink: 0 }} />
    </Box>
  );
};

export default UnderpaidActionBanner;
