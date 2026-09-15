import React, { useMemo, useState } from "react";
import { Box, Button, Skeleton, Tooltip, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { CB_TOKENS, PillButton } from "@/Components/Page/Dashboard/coinbase/styled";
import { useApiSWR } from "@/hooks/useApiSWR";
import { useSelectedCompanyId } from "@/contexts/CompanyDataContext";
import { API_ENDPOINTS } from "@/api/endpoints";
import { buildCreatorUrl } from "@/helpers/creatorUrl";
import { copyToClipboard } from "@/helpers/copyToClipboard";
import { formatWithSeparators } from "@/utils/currencyFormat";
import CreatorLivePreview from "@/Components/Page/Creator/CreatorLivePreview";
import type { CreatorFormState } from "@/Components/Page/Creator/CreatorPageSettings";
import type { StorefrontProfile } from "@/hooks/useStorefrontProfile";

export type FunnelPeriod = "7d" | "30d" | "90d";
const PERIODS: Array<{ id: FunnelPeriod; label: string }> = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
];

export interface CreatorFunnel {
  period: FunnelPeriod;
  days: number;
  has_handle: boolean;
  published: boolean;
  views: number;
  checkouts: number;
  paid: number;
  paid_usd: number;
  tips: { started: number; paid: number };
  orders: { started: number; paid: number };
}

export const useCreatorFunnel = (period: FunnelPeriod, enabled: boolean) => {
  const companyId = useSelectedCompanyId();
  return useApiSWR<CreatorFunnel>([API_ENDPOINTS.creator.funnel(period), companyId], {
    unwrap: true,
    enabled,
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
};

const pct = (num: number, den: number) => (den > 0 && num <= den ? `${((num / den) * 100).toFixed(num / den >= 0.1 ? 0 : 1)}%` : "—");

const FunnelStep: React.FC<{ testId: string; icon: string; label: string; value: number | undefined; sub?: string; loading: boolean }> = ({ testId, icon, label, value, sub, loading }) => {
  const theme = useTheme();
  return (
    <Box data-testid={testId} sx={{ display: "flex", flexDirection: "column", gap: 0.35, minWidth: 96 }}>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, color: theme.palette.text.secondary }}>
        <Icon name={icon} size={13} />
        <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>{label}</Typography>
      </Box>
      {loading && value === undefined ? (
        <Skeleton width={56} height={30} />
      ) : (
        <Typography data-testid={`${testId}-value`} sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: { xs: 20, sm: 24 }, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", color: theme.palette.text.primary }}>
          {(value ?? 0).toLocaleString()}
        </Typography>
      )}
      {sub && <Typography sx={{ fontFamily: MONO, fontSize: 11.5, color: theme.palette.text.secondary, whiteSpace: "nowrap" }}>{sub}</Typography>}
    </Box>
  );
};

const Arrow: React.FC<{ label: string }> = ({ label }) => {
  const theme = useTheme();
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.25, px: { xs: 0.5, sm: 1.25 }, color: theme.palette.text.secondary, alignSelf: "center" }}>
      <Icon name="arrow-right" size={16} />
      <Typography sx={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</Typography>
    </Box>
  );
};

/** Live-preview thumbnail: the real preview, scaled and clipped. */
const PreviewThumb: React.FC<{ state: CreatorFormState }> = ({ state }) => {
  const theme = useTheme();
  const scale = 0.34;
  return (
    <Box
      data-testid="your-page-thumb"
      aria-hidden
      sx={{ width: 124, height: 156, flexShrink: 0, borderRadius: "12px", overflow: "hidden", border: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.default, position: "relative", pointerEvents: "none", display: { xs: "none", sm: "block" } }}
    >
      <Box sx={{ width: 360, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
        <CreatorLivePreview state={state} />
      </Box>
    </Box>
  );
};

interface Props {
  storefront: StorefrontProfile | null | undefined;
  formState: CreatorFormState;
  mounted: boolean;
  onEdit: () => void;
  onToast?: (message: string) => void;
}

/**
 * Wave 3b — "Your page" header: publish state + public URL, live-preview
 * thumbnail, views → checkouts → paid funnel for the range, one primary action.
 */
const PageFunnelHeader: React.FC<Props> = ({ storefront, formState, mounted, onEdit, onToast }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  const [period, setPeriod] = useState<FunnelPeriod>("30d");
  const hasHandle = mounted && Boolean(storefront?.handle);
  const published = hasHandle && Boolean(storefront?.creator_page_enabled);
  const publicUrl = hasHandle ? buildCreatorUrl(storefront?.handle as string) : "";
  const { data, isLoading } = useCreatorFunnel(period, hasHandle);
  const [copied, setCopied] = useState(false);

  const tone = useMemo(() => {
    if (!hasHandle) return { dot: theme.palette.text.disabled, label: t("storefront.funnel.unclaimed", { defaultValue: "Not claimed" }) };
    if (published) return { dot: isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light, label: t("storefront.funnel.live", { defaultValue: "Live" }) };
    return { dot: isDark ? CB_TOKENS.semantic.warning.dark : CB_TOKENS.semantic.warning.light, label: t("storefront.funnel.draft", { defaultValue: "Draft" }) };
  }, [hasHandle, published, isDark, theme, t]);

  const copy = async () => {
    const ok = await copyToClipboard(publicUrl);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1600);
    onToast?.(ok ? String(t("copiedToClipboard")) : String(t("copyFailed")));
  };

  const views = data?.views;
  const checkouts = data?.checkouts;
  const paid = data?.paid;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

  return (
    <Box
      data-testid="your-page-header"
      data-state={!hasHandle ? "unclaimed" : published ? "live" : "draft"}
      sx={{ mb: 3, p: { xs: 2, sm: 2.5 }, borderRadius: "16px", border: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.paper, display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
        {mounted && <PreviewThumb state={formState} />}
        <Box sx={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 0.75 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Box data-testid="your-page-state" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, px: 1.1, py: 0.35, borderRadius: 999, border: `1px solid ${theme.palette.divider}`, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: theme.palette.text.primary }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: tone.dot, boxShadow: published ? `0 0 0 4px ${tone.dot}33` : "none" }} />
              {tone.label}
            </Box>
            {hasHandle && (
              <>
                <Typography data-testid="your-page-url" sx={{ fontFamily: MONO, fontSize: 12.5, color: theme.palette.text.secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                  {publicUrl.replace(/^https?:\/\//, "")}
                </Typography>
                <Tooltip title={t("storefront.funnel.copyUrl", { defaultValue: "Copy link" })} arrow>
                  <Box component="button" type="button" data-testid="your-page-copy" onClick={copy} aria-label={t("storefront.funnel.copyUrl", { defaultValue: "Copy link" }) as string} sx={{ all: "unset", cursor: "pointer", display: "inline-flex", p: 0.5, borderRadius: "8px", color: copied ? tone.dot : theme.palette.text.secondary, "&:hover": { backgroundColor: theme.palette.action.hover } }}>
                    <Icon name={copied ? "check" : "copy"} size={14} />
                  </Box>
                </Tooltip>
                {published && (
                  <Tooltip title={t("storefront.viewMyPage", { defaultValue: "View my page" })} arrow>
                    <Box component="a" href={publicUrl} target="_blank" rel="noopener" data-testid="your-page-open" aria-label={t("storefront.viewMyPage", { defaultValue: "View my page" }) as string} sx={{ display: "inline-flex", p: 0.5, borderRadius: "8px", color: theme.palette.text.secondary, "&:hover": { backgroundColor: theme.palette.action.hover } }}>
                      <Icon name="external-link" size={14} />
                    </Box>
                  </Tooltip>
                )}
              </>
            )}
          </Box>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: { xs: 18, sm: 20 }, fontWeight: 800, letterSpacing: "-0.01em", color: theme.palette.text.primary }}>
            {!hasHandle
              ? t("storefront.funnel.claimTitle", { defaultValue: "Claim your handle to publish your page" })
              : published
                ? t("storefront.funnel.liveTitle", { defaultValue: "Your page is live" })
                : t("storefront.funnel.draftTitle", { defaultValue: "Your page is a draft" })}
          </Typography>
          <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, maxWidth: 560 }}>
            {!hasHandle
              ? t("storefront.funnel.claimHint", { defaultValue: "Pick a handle below — tips, products and payment links will live behind one link." })
              : published
                ? t("storefront.funnel.liveHint", { defaultValue: "Changes you save appear on your public page instantly." })
                : t("storefront.funnel.draftHint", { defaultValue: "Only you can see it. Turn on the publish toggle in the editor to go live." })}
          </Typography>
          {hasHandle && !formState.swEnabled && mounted && (
            <Typography component="button" type="button" data-testid="your-page-tips-nudge" onClick={() => window.dispatchEvent(new CustomEvent("dynopay:open-tip-setup"))} sx={{ all: "unset", cursor: "pointer", alignSelf: "flex-start", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: indigo, "&:hover": { textDecoration: "underline" } }}>
              {t("storefront.funnel.tipsNudge", { defaultValue: "Tips are off — set up your tip box →" })}
            </Typography>
          )}
        </Box>
        <Button
          data-testid="your-page-edit-btn"
          disableElevation
          variant="contained"
          onClick={onEdit}
          startIcon={<Icon name="pencil" size={15} />}
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" }, px: 2.25, height: 40, borderRadius: 999, textTransform: "none", fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", backgroundColor: indigo, color: "#fff", "&:hover": { backgroundColor: indigo, filter: "brightness(0.95)" } }}
        >
          {!hasHandle ? t("storefront.funnel.claimCta", { defaultValue: "Claim handle" }) : t("storefront.funnel.editPage", { defaultValue: "Edit page" })}
        </Button>
      </Box>

      {hasHandle && (
        <Box data-testid="your-page-funnel" sx={{ pt: 2, borderTop: `1px solid ${theme.palette.divider}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: { xs: 0.5, sm: 1 }, flexWrap: "wrap" }}>
            <FunnelStep testId="your-page-funnel-views" icon="lucide:eye" label={t("storefront.funnel.views", { defaultValue: "Views" })} value={views} loading={isLoading} />
            <Arrow label={pct(checkouts ?? 0, views ?? 0)} />
            <FunnelStep
              testId="your-page-funnel-checkouts"
              icon="lucide:shopping-cart"
              label={t("storefront.funnel.checkouts", { defaultValue: "Checkouts" })}
              value={checkouts}
              loading={isLoading}
              sub={data ? t("storefront.funnel.split", { tips: data.tips.started, orders: data.orders.started, defaultValue: "{{tips}} tips · {{orders}} orders" }) : undefined}
            />
            <Arrow label={pct(paid ?? 0, checkouts ?? 0)} />
            <FunnelStep
              testId="your-page-funnel-paid"
              icon="lucide:circle-check"
              label={t("storefront.funnel.paid", { defaultValue: "Paid" })}
              value={paid}
              loading={isLoading}
              sub={data ? `$${formatWithSeparators(data.paid_usd, "USD", 2)}` : undefined}
            />
          </Box>
          <Box data-testid="your-page-range" role="tablist" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, p: 0.5, borderRadius: 999, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.05)", alignSelf: "center" }}>
            {PERIODS.map((p) => (
              <PillButton key={p.id} active={period === p.id} role="tab" aria-selected={period === p.id} data-testid={`your-page-range-${p.id}`} onClick={() => setPeriod(p.id)}>
                {p.label}
              </PillButton>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default PageFunnelHeader;
