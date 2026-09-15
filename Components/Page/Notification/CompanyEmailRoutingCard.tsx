import React, { useState } from "react";
import { Box, Collapse, Divider, InputBase, Typography, useTheme } from "@mui/material";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import { useTranslation } from "react-i18next";
import CustomSwitch from "@/Components/UI/CustomSwitch";
import PanelCard from "@/Components/UI/PanelCard";
import useIsMobile from "@/hooks/useIsMobile";
import {
  CompanyRouting,
  NotificationCategoryKey,
  isValidEmail,
} from "@/hooks/useNotificationPreferences";

interface Props {
  routing: CompanyRouting;
  onEmailChange: (value: string) => void;
  onFanoutChange: (value: boolean) => void;
  onCategoryChange: (key: NotificationCategoryKey, value: boolean) => void;
}

const CATEGORIES: { key: NotificationCategoryKey; title: string; desc: string }[] = [
  { key: "payments", title: "Payments", desc: "Payment received, confirming, partial or failed alerts" },
  { key: "payouts", title: "Payouts & settlements", desc: "Auto-conversion payouts, settlements and refunds" },
  { key: "orders", title: "Orders & invoices", desc: "Order receipts, downloads and invoice emails" },
  { key: "config", title: "Account & config", desc: "Webhook, API key, payout address and profile changes" },
  { key: "digests", title: "Digests & summaries", desc: "Weekly summaries and payout digests" },
  { key: "confirming", title: "Confirmation progress", desc: "One email per block confirmation (“1 of 3…”). Off by default — you always get Pending and Settled." },
];

const Row: React.FC<{
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId: string;
  showDivider?: boolean;
}> = ({ title, description, checked, onChange, testId, showDivider = true }) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ flex: 1, pr: 2 }}>
          <Typography
            sx={{
              fontSize: { xs: "13px", md: "15px" },
              fontWeight: 700,
              fontFamily: "var(--font-sans)",
              color: theme.palette.text.primary,
              mb: isMobile ? "9px" : 1,
              lineHeight: 1.2,
            }}
          >
            {title}
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: "13px", md: "15px" },
              fontFamily: "var(--font-sans)",
              color: theme.palette.text.secondary,
              lineHeight: 1.2,
            }}
          >
            {description}
          </Typography>
        </Box>
        <CustomSwitch
          data-testid={testId}
          checked={checked}
          onChange={(_e, v) => onChange(v)}
          sx={{
            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
              backgroundColor: theme.palette.primary.main,
            },
          }}
        />
      </Box>
      {showDivider && <Divider sx={{ borderColor: theme.palette.border.main, my: 0 }} />}
    </>
  );
};

const CompanyEmailRoutingCard: React.FC<Props> = ({
  routing,
  onEmailChange,
  onFanoutChange,
  onCategoryChange,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("notifications");
  const [showCategories, setShowCategories] = useState(false);
  const emailInvalid = routing.notificationEmail.trim() !== "" && !isValidEmail(routing.notificationEmail);

  return (
    <PanelCard
      headerSx={{ fontSize: { xs: "15px", md: "20px" } }}
      subTitleSx={{ fontSize: { xs: "13px", md: "15px" }, color: theme.palette.text.primary }}
      title={t("companyRoutingTitle", { defaultValue: "Brand email routing" })}
      subTitle={t("companyRoutingSubtitle", {
        defaultValue:
          "Where your business emails (payments, payouts, orders) are delivered — separate from your personal account security emails.",
      })}
      showHeaderBorder={false}
      headerPadding={isMobile ? theme.spacing(2, 2, 0, 2) : theme.spacing(2.5, 2.5, 0, 2.5)}
      bodyPadding={isMobile ? theme.spacing(0, 2, 2, 2) : theme.spacing(0, 2.5, 2.5, 2.5)}
      sx={{ height: "100%" }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: isMobile ? "14px" : 2.5, pt: { xs: 2.5, md: 3 } }}>
        {/* Company notification email */}
        <Box>
          <Typography
            sx={{
              fontSize: { xs: "13px", md: "15px" },
              fontWeight: 700,
              fontFamily: "var(--font-sans)",
              color: theme.palette.text.primary,
              mb: 1,
            }}
          >
            {t("companyEmailLabel", { defaultValue: "Brand notification email" })}
          </Typography>
          <InputBase
            data-testid="company-notification-email-input"
            fullWidth
            type="email"
            value={routing.notificationEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder={t("companyEmailPlaceholder", { defaultValue: "billing@yourcompany.com" })}
            sx={{
              px: 1.5,
              py: 1.25,
              borderRadius: "10px",
              border: `1px solid ${emailInvalid ? theme.palette.error.main : theme.palette.border.main}`,
              backgroundColor: theme.palette.background.paper,
              fontSize: "14px",
              fontFamily: "var(--font-sans)",
              color: theme.palette.text.primary,
              "&.Mui-focused": { borderColor: theme.palette.primary.main },
            }}
          />
          <Typography
            data-testid="company-notification-email-helper"
            sx={{
              fontSize: "12.5px",
              color: emailInvalid ? theme.palette.error.main : theme.palette.text.secondary,
              mt: 0.75,
              fontFamily: "var(--font-sans)",
              lineHeight: 1.4,
            }}
          >
            {emailInvalid
              ? t("companyEmailInvalid", { defaultValue: "Enter a valid email address, or leave blank." })
              : t("companyEmailHelper", {
                  defaultValue: "Leave blank to use your account email. This does not change your login email.",
                })}
          </Typography>
        </Box>

        <Divider sx={{ borderColor: theme.palette.border.main }} />

        {/* Team fan-out */}
        <Row
          testId="company-team-fanout-switch"
          title={t("teamFanoutTitle", { defaultValue: "Also notify team members" })}
          description={t("teamFanoutDescription", {
            defaultValue: "Copy team members based on their role and permissions.",
          })}
          checked={routing.teamFanout}
          onChange={onFanoutChange}
        />

        {/* Per-category master switches — collapsed by default to keep the
            panel calm; power users expand to fine-tune. */}
        <Box>
          <Box
            data-testid="company-categories-toggle"
            onClick={() => setShowCategories((v) => !v)}
            role="button"
            aria-expanded={showCategories}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              py: 0.5,
              userSelect: "none",
            }}
          >
            <Box>
              <Typography
                sx={{
                  fontSize: { xs: "13px", md: "15px" },
                  fontWeight: 700,
                  fontFamily: "var(--font-sans)",
                  color: theme.palette.text.primary,
                  lineHeight: 1.2,
                }}
              >
                {t("categoriesLabel", { defaultValue: "Email categories" })}
              </Typography>
              <Typography
                sx={{
                  fontSize: "12.5px",
                  color: theme.palette.text.secondary,
                  fontFamily: "var(--font-sans)",
                  mt: 0.5,
                }}
              >
                {t("categoriesHelper", { defaultValue: "Choose which kinds of brand emails are sent. All on by default except Confirmation progress. Security and payout-exception emails are always sent." })}
              </Typography>
            </Box>
            <ExpandMoreRounded
              sx={{
                color: theme.palette.text.secondary,
                transform: showCategories ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
                flexShrink: 0,
              }}
            />
          </Box>
          <Collapse in={showCategories} timeout="auto" unmountOnExit>
            <Box sx={{ display: "flex", flexDirection: "column", gap: isMobile ? "10px" : 2, pt: 2 }}>
              {CATEGORIES.map((c, i) => (
                <Row
                  key={c.key}
                  testId={`company-category-${c.key}-switch`}
                  title={t(`category_${c.key}_title`, { defaultValue: c.title })}
                  description={t(`category_${c.key}_desc`, { defaultValue: c.desc })}
                  checked={routing.categories[c.key]}
                  onChange={(v) => onCategoryChange(c.key, v)}
                  showDivider={i < CATEGORIES.length - 1}
                />
              ))}
            </Box>
          </Collapse>
        </Box>
      </Box>
    </PanelCard>
  );
};

export default CompanyEmailRoutingCard;
