import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import BrandAvatar from "@/Components/UI/BrandAvatar";
import CustomButton from "@/Components/UI/Buttons";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { BRAND_ACCENT } from "@/constants/theme";
import { formatCurrency } from "@/utils/currencyFormat";
import { sanitizeBrandName } from "@/utils/brandName";
import { BrandRow } from "./useBrands";

/** One brand's snapshot: settled volume, payments, pending, needs-attention, last activity + Manage. */
const BrandCard: React.FC<{ brand: BrandRow; currency: string; onManage: () => void }> = ({ brand, currency, onManage }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const primary = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const surface = isDark ? CB_TOKENS.surface.dark : CB_TOKENS.surface.light;
  const warn = isDark ? CB_TOKENS.semantic.warning.dark : CB_TOKENS.semantic.warning.light;

  const relTime = (iso: string | null): string => {
    if (!iso) return t("brandsOverview.never", { defaultValue: "No activity yet" });
    const d = new Date(iso);
    if (isNaN(d.getTime())) return t("brandsOverview.never", { defaultValue: "No activity yet" });
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return t("brandsOverview.justNow", { defaultValue: "just now" });
    if (mins < 60) return t("brandsOverview.minAgo", { defaultValue: "{{n}}m ago", n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t("brandsOverview.hrAgo", { defaultValue: "{{n}}h ago", n: hrs });
    const days = Math.floor(hrs / 24);
    if (days < 7) return t("brandsOverview.dayAgo", { defaultValue: "{{n}}d ago", n: days });
    return format(d, "MMM d, yyyy");
  };

  const stats = [
    { k: "settled", label: t("brandsOverview.cardSettled", { defaultValue: "Settled" }), value: formatCurrency(brand.settled_amount, currency) },
    { k: "payments", label: t("brandsOverview.cardPayments", { defaultValue: "Payments" }), value: String(brand.payments_count) },
    { k: "pending", label: t("brandsOverview.cardPending", { defaultValue: "Pending" }), value: formatCurrency(brand.pending_amount, currency) },
    { k: "attention", label: t("brandsOverview.cardAttention", { defaultValue: "Needs attention" }), value: String(brand.attention_count), warn: brand.attention_count > 0 },
  ];
  const nativeDiffers = (brand.native_currency || "").toUpperCase() !== (currency || "").toUpperCase();

  return (
    <Box
      data-testid={`brand-card-${brand.company_id}`}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        border: `1px solid ${border}`,
        bgcolor: surface,
        transition: "border-color 150ms ease, transform 150ms ease",
        "&:hover": { borderColor: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <BrandAvatar name={brand.company_name} photo={brand.photo} size={40} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, color: primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={sanitizeBrandName(brand.company_name || "")}
          >
            {sanitizeBrandName(brand.company_name || "") || "—"}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25, flexWrap: "wrap" }}>
            {brand.is_member && (
              <Box
                data-testid={`brand-role-${brand.company_id}`}
                sx={{ px: "6px", py: "1px", borderRadius: "999px", fontFamily: "var(--font-sans)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: BRAND_ACCENT, border: `1px solid ${BRAND_ACCENT}` }}
              >
                {String(brand.member_role) === "admin"
                  ? t("brandsOverview.roleAdmin", { defaultValue: "Admin" })
                  : t("brandsOverview.roleMember", { defaultValue: "Member" })}
              </Box>
            )}
            {nativeDiffers && (
              <Typography data-testid={`brand-native-${brand.company_id}`} sx={{ fontFamily: "var(--font-sans)", fontSize: 11, color: muted }}>
                {t("brandsOverview.native", { defaultValue: "In {{currency}}", currency: (brand.native_currency || "").toUpperCase() })}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
        {stats.map((st) => (
          <Box key={st.k} data-testid={`brand-${st.k}-${brand.company_id}`}>
            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: muted, mb: 0.25 }}>{st.label}</Typography>
            <Typography sx={{ fontFamily: "var(--font-mono, var(--font-sans))", fontWeight: 700, fontSize: 16, color: st.warn ? warn : primary, wordBreak: "break-word" }}>
              {st.value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mt: "auto" }}>
        <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: muted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t("brandsOverview.lastActivity", { defaultValue: "Last activity" })}: {relTime(brand.last_paid_at)}
        </Typography>
        <CustomButton
          label={t("brandsOverview.manage", { defaultValue: "Manage" })}
          data-testid={`brand-manage-${brand.company_id}`}
          variant="secondary"
          size="small"
          onClick={onManage}
        />
      </Box>
    </Box>
  );
};

export default BrandCard;
