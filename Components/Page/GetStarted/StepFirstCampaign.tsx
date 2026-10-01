import React, { useEffect, useMemo, useState } from "react";
import { Box, MenuItem, TextField, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { Icon, MONO } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { PaymentLinkAction, PAYLINK_FETCH } from "@/Redux/Actions/PaymentLinkAction";
import { toShortPayLink } from "@/helpers/payLinkUrl";
import { trackOnboarding } from "@/utils/trackOnboarding";
import WalletManagerModal from "@/Components/UI/WalletManagerModal";
import { useWalletStore } from "@/contexts/WalletDataContext";
import { formatPreviewAmount } from "./CheckoutPreview";
import CampaignThermometer from "./CampaignThermometer";
import { StepFooter, StepHeader } from "./StepChrome";
import type { CreatedLink } from "./StepFirstLink";
import type { SetupProgress } from "./useSetupProgress";

const FIAT_OPTIONS = ["USD", "EUR", "GBP", "CAD", "AUD", "NGN"] as const;
const DRAFT_KEY = "dyno_gs_campaign_draft";

const readDraft = (): { title?: string; goal?: string; currency?: string; story?: string; presets?: string[] } => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) || "{}");
  } catch {
    return {};
  }
};

/** Build a share-ready CreatedLink from an existing donation payment-link row. */
export const campaignFromRecord = (rec: any): CreatedLink | null => {
  if (!rec?.payment_link) return null;
  const goal = rec?.donation?.goal_amount ?? rec?.goal_amount ?? null;
  return {
    url: toShortPayLink(rec.payment_link),
    amount: goal != null ? String(goal) : "",
    currency: String(rec.currency ?? rec.base_currency ?? "USD"),
    description: String(rec.title ?? rec.description ?? ""),
  };
};

interface Props {
  progress: SetupProgress;
  onBack: () => void;
  onCreated: (link: CreatedLink) => void;
  onUseExisting: () => void;
  onGoPayouts: () => void;
}

/**
 * Fundraiser track — Step 4: launch your first campaign. A minimal donation
 * link (title · goal · suggested amounts · optional story) created inline so a
 * fundraiser never has to leave the guided setup. The full builder (rewards,
 * cover image, end date) stays one click away for later.
 */
const StepFirstCampaign: React.FC<Props> = ({ progress, onBack, onCreated, onUseExisting, onGoPayouts }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const dispatch = useDispatch();
  const { account, companyId, hasWallet, hasCampaign, newestCampaign } = progress;
  const walletState = useWalletStore();

  const draft = useMemo(readDraft, []);
  const brandCurrency = String((account as any)?.display_currency || "USD").toUpperCase();
  const defaultCurrency = (FIAT_OPTIONS as readonly string[]).includes(brandCurrency) ? brandCurrency : "USD";

  const [title, setTitle] = useState(draft.title || "");
  const [goal, setGoal] = useState(draft.goal || "");
  const [currency, setCurrency] = useState(draft.currency || defaultCurrency);
  const [presets, setPresets] = useState<string[]>(draft.presets || ["25", "50", "100"]);
  const [story, setStory] = useState(draft.story || "");
  const [errors, setErrors] = useState<{ title?: string; goal?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(!newestCampaign);
  const [walletOpen, setWalletOpen] = useState(false);
  const [createAfterWallet, setCreateAfterWallet] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ title, goal, currency, story, presets }));
  }, [title, goal, currency, story, presets]);

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;

  const existing = useMemo(() => campaignFromRecord(newestCampaign), [newestCampaign]);

  const validate = () => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = t("gs.errCampaignTitle", { defaultValue: "Give your campaign a title" });
    if (goal) {
      const n = parseFloat(goal);
      if (!isFinite(n) || n <= 0) next.goal = t("gs.errCampaignGoal", { defaultValue: "Enter a valid goal amount" });
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCreate = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    try {
      const presetAmounts = presets
        .map((p) => parseFloat(p))
        .filter((n) => isFinite(n) && n > 0);
      const payload = {
        link_type: "donation",
        title: title.trim(),
        description: null,
        currency,
        goal_amount: goal ? parseFloat(goal) : null,
        min_amount: 1,
        preset_amounts: presetAmounts,
        allow_custom_amount: true,
        show_progress: true,
        show_supporters: true,
        auto_close_at_goal: false,
        donation_story_md: story.trim() || null,
        donation_gallery: [],
        donation_ends_at: null,
        expire: "No",
        fee_payer: "company",
        accepted_currencies: [],
        company_id: companyId,
      };
      const res = await axiosBaseApi.post("/pay/createPaymentLink", payload);
      const data = res?.data?.data;
      if (data?.payment_link) {
        dispatch(PaymentLinkAction(PAYLINK_FETCH, { company_id: companyId }));
        trackOnboarding({ event_type: "step_completed", step_key: "link", metadata: { surface: "wizard", track: "fundraisers" } });
        if (typeof window !== "undefined") window.sessionStorage.removeItem(DRAFT_KEY);
        onCreated({ url: toShortPayLink(data.payment_link), amount: goal, currency, description: title.trim() });
      } else {
        setErrors({ form: res?.data?.message || t("gs.errCampaignGeneric", { defaultValue: "Couldn't create the campaign — please try again." }) });
      }
    } catch (e: any) {
      setErrors({ form: e?.response?.data?.message || t("gs.errCampaignGeneric", { defaultValue: "Couldn't create the campaign — please try again." }) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWalletSaved = () => {
    trackOnboarding({ event_type: "step_completed", step_key: "wallet", metadata: { surface: "wizard_campaign_step" } });
    walletState.refetchWallets();
    setWalletOpen(false);
    setCreateAfterWallet(true);
  };
  useEffect(() => {
    if (createAfterWallet && hasWallet && !submitting) {
      setCreateAfterWallet(false);
      void handleCreate();
    }
  }, [createAfterWallet, hasWallet]);

  const handleNeedWallet = () => {
    if (!validate()) return;
    trackOnboarding({ event_type: "step_clicked", step_key: "wallet", metadata: { surface: "wizard_campaign_step" } });
    setWalletOpen(true);
  };

  const labelSx = { fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: ink, mb: 0.5, ml: 0.25 };
  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "10px",
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      minHeight: 44,
      "& fieldset": { borderColor: theme.palette.divider },
      "&.Mui-focused fieldset": { borderColor: theme.palette.primary.main },
    },
    "& .MuiFormHelperText-root": { fontFamily: "var(--font-sans)", fontSize: 12, ml: "4px" },
  };

  const setPreset = (i: number, v: string) =>
    setPresets((prev) => prev.map((p, idx) => (idx === i ? v.replace(/[^0-9.]/g, "") : p)));

  return (
    <Box data-testid="gs-step-campaign" data-gated={hasWallet ? "false" : "true"}>
      <StepHeader
        eyebrow={t("gs.stepOf", { n: 4, total: 5, defaultValue: "Step {{n}} of {{total}}" })}
        title={t("gs.campaignTitle", { defaultValue: "Launch your first campaign" })}
        subtitle={t("gs.campaignSubtitle", { defaultValue: "A title, an optional goal and a few suggested amounts is all it takes. You can add a cover image, rewards or an end date later." })}
      />

      {!hasWallet && showForm && (
        <Box data-testid="gs-campaign-wallet-note" sx={{ mb: 3, display: "flex", gap: 1.25, alignItems: "flex-start", p: 1.5, borderRadius: "12px", border: `1px solid ${border}`, backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(10,10,15,0.015)" }}>
          <Box sx={{ color: indigo, display: "flex", mt: "1px" }}><Icon name="wallet" size={18} /></Box>
          <Box sx={{ flex: 1, minWidth: 0, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: muted }}>
            {t("gs.campaignNoWalletNote", { defaultValue: "Design your campaign now — it goes live the moment you add the payout address contributions should land in. We'll ask for it when you hit Create." })}{" "}
            <Box component="button" type="button" data-testid="gs-campaign-go-payouts" onClick={onGoPayouts} sx={{ border: 0, p: 0, background: "transparent", cursor: "pointer", font: "inherit", fontWeight: 700, color: indigo }}>
              {t("gs.addWalletFirst", { defaultValue: "Add the payout address first" })}
            </Box>
          </Box>
        </Box>
      )}

      {existing && (
        <Box data-testid="gs-existing-campaign" sx={{ mb: 3, p: 2, borderRadius: "14px", border: `1px solid ${indigo}`, backgroundColor: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { sm: "center" }, gap: 1.5 }}>
          <Box sx={{ color: indigo, display: "flex" }}><Icon name="hand-heart" size={20} /></Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink }}>
              {t("gs.existingCampaignTitle", { defaultValue: "You already have a campaign" })}
            </Box>
            <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: muted, mt: 0.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {[existing.description, existing.amount ? t("gs.campaignGoalLabel", { amount: formatPreviewAmount(existing.amount, existing.currency), defaultValue: "Goal {{amount}}" }) : ""].filter(Boolean).join(" · ")}
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
            <Box component="button" type="button" data-testid="gs-use-existing-campaign" onClick={onUseExisting} sx={{ minHeight: 38, px: 1.75, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "#FFFFFF", backgroundColor: indigo }}>
              {t("gs.useThisCampaign", { defaultValue: "Use this campaign" })}
            </Box>
            {!showForm && (
              <Box component="button" type="button" data-testid="gs-create-new-campaign" onClick={() => setShowForm(true)} sx={{ minHeight: 38, px: 1.5, borderRadius: 999, border: `1px solid ${border}`, cursor: "pointer", background: "transparent", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: ink }}>
                {t("gs.createNewCampaign", { defaultValue: "Create a new one" })}
              </Box>
            )}
          </Box>
        </Box>
      )}

      {showForm && (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box>
            <Box sx={labelSx}>{t("gs.campaignTitleLabel", { defaultValue: "Campaign title" })}</Box>
            <TextField
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors({ ...errors, title: undefined }); }}
              placeholder={t("gs.campaignTitlePlaceholder", { defaultValue: "e.g. Help us ship the open-source release" })}
              error={!!errors.title}
              helperText={errors.title || ""}
              fullWidth
              sx={fieldSx}
              inputProps={{ "data-testid": "gs-campaign-title", maxLength: 120 }}
            />
          </Box>

          <Box>
            <Box sx={labelSx}>{t("gs.campaignGoalLabelField", { defaultValue: "Goal (optional)" })}</Box>
            <Box sx={{ display: "flex", gap: 1.25 }}>
              <TextField
                value={goal}
                onChange={(e) => { setGoal(e.target.value.replace(/[^0-9.]/g, "")); if (errors.goal) setErrors({ ...errors, goal: undefined }); }}
                placeholder="5000"
                inputMode="decimal"
                error={!!errors.goal}
                helperText={errors.goal || ""}
                fullWidth
                sx={fieldSx}
                inputProps={{ "data-testid": "gs-campaign-goal", style: { fontFamily: MONO } }}
              />
              <TextField select value={currency} onChange={(e) => setCurrency(e.target.value)} sx={{ ...fieldSx, width: 120, flexShrink: 0 }} inputProps={{ "data-testid": "gs-campaign-currency" }} SelectProps={{ MenuProps: { PaperProps: { sx: { borderRadius: "12px" } } } }}>
                {FIAT_OPTIONS.map((c) => (
                  <MenuItem key={c} value={c} sx={{ fontFamily: "var(--font-sans)" }}>{c}</MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>

          <Box>
            <Box sx={labelSx}>{t("gs.campaignPresets", { defaultValue: "Suggested amounts" })}</Box>
            <Box sx={{ display: "flex", gap: 1.25 }}>
              {[0, 1, 2].map((i) => (
                <TextField
                  key={i}
                  value={presets[i] ?? ""}
                  onChange={(e) => setPreset(i, e.target.value)}
                  placeholder={["25", "50", "100"][i]}
                  inputMode="decimal"
                  fullWidth
                  sx={fieldSx}
                  inputProps={{ "data-testid": `gs-campaign-preset-${i + 1}`, style: { fontFamily: MONO } }}
                />
              ))}
            </Box>
          </Box>

          <CampaignThermometer
            goalAmount={(() => { const n = parseFloat(goal); return isFinite(n) && n > 0 ? n : 0; })()}
            currency={currency}
            presets={presets.map((p) => parseFloat(p)).filter((n) => isFinite(n) && n > 0)}
          />

          <Box>
            <Box sx={labelSx}>{t("gs.campaignStory", { defaultValue: "Tell your story (optional)" })}</Box>
            <TextField
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder={t("gs.campaignStoryPlaceholder", { defaultValue: "Why does this matter? A few sentences help supporters give." })}
              multiline
              minRows={3}
              fullWidth
              sx={fieldSx}
              inputProps={{ "data-testid": "gs-campaign-story", maxLength: 2000 }}
            />
          </Box>

          <Box
            component="button"
            type="button"
            data-testid="gs-campaign-open-builder"
            onClick={() => router.push("/create-pay-link?type=donation")}
            sx={{ alignSelf: "flex-start", border: 0, p: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: indigo, display: "inline-flex", alignItems: "center", gap: 0.5 }}
          >
            {t("gs.campaignOpenBuilder", { defaultValue: "Need rewards, an end date or a cover image? Open the full builder" })}
            <Icon name="arrow-right" size={14} />
          </Box>

          {errors.form && (
            <Box role="alert" data-testid="gs-campaign-error" sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: theme.palette.error.main }}>
              {errors.form}
            </Box>
          )}
        </Box>
      )}

      <StepFooter
        onBack={onBack}
        primaryLabel={showForm
          ? submitting
            ? t("gs.creatingCampaign", { defaultValue: "Creating…" })
            : hasWallet
              ? t("gs.createCampaign", { defaultValue: "Create campaign" })
              : t("gs.addWalletAndCreateCampaign", { defaultValue: "Add payout address & create" })
          : t("gs.continue", { defaultValue: "Continue" })}
        onPrimary={showForm ? (hasWallet ? handleCreate : handleNeedWallet) : onUseExisting}
        primaryLoading={submitting}
        primaryDisabled={submitting}
        primaryTestId={showForm ? "gs-campaign-create" : "gs-campaign-continue"}
      />

      <WalletManagerModal open={walletOpen} companyId={companyId ?? null} onClose={() => setWalletOpen(false)} onSaved={handleWalletSaved} />
    </Box>
  );
};

export default StepFirstCampaign;
