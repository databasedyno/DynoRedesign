import React, { useEffect, useMemo, useState } from "react";
import { Box, MenuItem, TextField, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { Icon, MONO } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { PaymentLinkAction, PAYLINK_FETCH } from "@/Redux/Actions/PaymentLinkAction";
import { toShortPayLink } from "@/helpers/payLinkUrl";
import { trackOnboarding } from "@/utils/trackOnboarding";
import WalletManagerModal from "@/Components/UI/WalletManagerModal";
import { useWalletStore } from "@/contexts/WalletDataContext";
import CheckoutPreview, { formatPreviewAmount } from "./CheckoutPreview";
import { StepFooter, StepHeader } from "./StepChrome";
import type { SetupProgress } from "./useSetupProgress";

export type CreatedLink = { url: string; amount: string; currency: string; description: string };

const FIAT_OPTIONS = ["USD", "EUR", "GBP", "CAD", "AUD", "NGN"] as const;
/** A2: the first-link draft survives the wallet OTP round-trip (and a reload). */
const DRAFT_KEY = "dyno_gs_link_draft";
const readDraft = (): { amount?: string; currency?: string; description?: string } => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) || "{}");
  } catch {
    return {};
  }
};
/** Side-by-side form + preview only when the content column is wide enough (sidebar + rail eat ~600px). */
const WIDE = "@media (min-width: 1400px)";

interface Props {
  progress: SetupProgress;
  onBack: () => void;
  onCreated: (link: CreatedLink) => void;
  onUseExisting: () => void;
  onGoPayouts: () => void;
}

export const linkFromRecord = (rec: any): CreatedLink | null => {
  if (!rec?.payment_link) return null;
  return {
    url: toShortPayLink(rec.payment_link),
    amount: String(rec.amount ?? rec.base_amount ?? ""),
    currency: String(rec.currency ?? rec.base_currency ?? "USD"),
    description: String(rec.description ?? rec.title ?? ""),
  };
};

/** Step 3 — First payment link: two panes (form + live checkout preview, collapsible on phone). */
const StepFirstLink: React.FC<Props> = ({ progress, onBack, onCreated, onUseExisting, onGoPayouts }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const dispatch = useDispatch();
  const { account, companyId, hasWallet, configuredWallets, newestLink } = progress;
  const walletState = useWalletStore();

  const draft = useMemo(readDraft, []);
  const [amount, setAmount] = useState(draft.amount || "");
  const [currency, setCurrency] = useState(draft.currency || "USD");
  const [description, setDescription] = useState(draft.description || "");
  const [errors, setErrors] = useState<{ amount?: string; description?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(!newestLink);
  const [previewOpen, setPreviewOpen] = useState(false);
  // A2: no wallet yet → the merchant still designs the link here; the wallet
  // manager opens inline and the link is created the moment a wallet is saved.
  const [walletOpen, setWalletOpen] = useState(false);
  const [createAfterWallet, setCreateAfterWallet] = useState(false);
  // Collapsed by default only on phones; tablets/laptops get the preview open.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 600) setPreviewOpen(true);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ amount, currency, description }));
  }, [amount, currency, description]);

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;

  const coins = useMemo(
    () => Array.from(new Set(configuredWallets.map((w: any) => String(w.wallet_type || "")).filter(Boolean))),
    [configuredWallets],
  );
  const existing = useMemo(() => linkFromRecord(newestLink), [newestLink]);

  const validate = () => {
    const next: typeof errors = {};
    const n = parseFloat(amount);
    if (!amount || !isFinite(n) || n <= 0) next.amount = t("gs.errAmount", { defaultValue: "Enter an amount greater than 0" });
    if (!description.trim()) next.description = t("gs.errDescription", { defaultValue: "Add a short description" });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCreate = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        amount: parseFloat(amount),
        currency,
        description: description.trim(),
        name: "",
        expire: "No",
        fee_payer: "company",
        accepted_currencies: [],
        redirect_url: "",
        webhook_url: "",
        callback_url: "",
        apply_tax: false,
        tax_inclusive: false,
        company_id: companyId,
      };
      const res = await axiosBaseApi.post("/pay/createPaymentLink", payload);
      const data = res?.data?.data;
      if (data?.payment_link) {
        dispatch(PaymentLinkAction(PAYLINK_FETCH, { company_id: companyId }));
        trackOnboarding({ event_type: "step_completed", step_key: "link", metadata: { surface: "wizard" } });
        if (typeof window !== "undefined") window.sessionStorage.removeItem(DRAFT_KEY);
        onCreated({ url: toShortPayLink(data.payment_link), amount, currency, description: description.trim() });
      } else {
        setErrors({ form: res?.data?.message || t("gs.errLinkGeneric", { defaultValue: "Couldn't create the link — please try again." }) });
      }
    } catch (e: any) {
      setErrors({ form: e?.response?.data?.message || t("gs.errLinkGeneric", { defaultValue: "Couldn't create the link — please try again." }) });
    } finally {
      setSubmitting(false);
    }
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

  // Wallet just saved from inside this step → create the drafted link right away.
  const handleWalletSaved = () => {
    trackOnboarding({ event_type: "step_completed", step_key: "wallet", metadata: { surface: "wizard_link_step" } });
    walletState.refetchWallets();
    setWalletOpen(false);
    setCreateAfterWallet(true);
  };
  useEffect(() => {
    if (createAfterWallet && hasWallet && !submitting) {
      setCreateAfterWallet(false);
      void handleCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createAfterWallet, hasWallet]);

  const handleNeedWallet = () => {
    if (!validate()) return;
    trackOnboarding({ event_type: "step_clicked", step_key: "wallet", metadata: { surface: "wizard_link_step" } });
    setWalletOpen(true);
  };

  const preview = (
    <CheckoutPreview
      brandName={String(account?.company_name || "")}
      logoUrl={account?.photo}
      description={description}
      amount={amount}
      currency={currency}
      coins={coins}
    />
  );

  return (
    <Box data-testid="gs-step-link" data-gated={hasWallet ? "false" : "true"}>
      <StepHeader
        eyebrow={t("gs.stepOf", { n: 4, total: 5, defaultValue: "Step {{n}} of {{total}}" })}
        title={t("gs.linkTitle", { defaultValue: "Create your first payment link" })}
        subtitle={t("gs.linkSubtitle", { defaultValue: "Set an amount and say what it's for. The preview shows exactly what your customer will see." })}
      />

      {!hasWallet && showForm && (
        <Box data-testid="gs-link-wallet-note" sx={{ mb: 3, display: "flex", gap: 1.25, alignItems: "flex-start", p: 1.5, borderRadius: "12px", border: `1px solid ${border}`, backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(10,10,15,0.015)" }}>
          <Box sx={{ color: indigo, display: "flex", mt: "1px" }}><Icon name="wallet" size={18} /></Box>
          <Box sx={{ flex: 1, minWidth: 0, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: muted }}>
            {t("gs.linkNoWalletNote", { defaultValue: "Design your link now — it goes live the moment you add the payout address the money should land in. We'll ask for it when you hit Create." })}{" "}
            <Box component="button" type="button" data-testid="gs-link-go-payouts" onClick={onGoPayouts} sx={{ border: 0, p: 0, background: "transparent", cursor: "pointer", font: "inherit", fontWeight: 700, color: indigo }}>
              {t("gs.addWalletFirst", { defaultValue: "Add the payout address first" })}
            </Box>
          </Box>
        </Box>
      )}

      {existing && (
        <Box data-testid="gs-existing-link" sx={{ mb: 3, p: 2, borderRadius: "14px", border: `1px solid ${indigo}`, backgroundColor: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { sm: "center" }, gap: 1.5 }}>
          <Box sx={{ color: indigo, display: "flex" }}><Icon name="link" size={20} /></Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink }}>
              {t("gs.existingLinkTitle", { defaultValue: "You already have a payment link" })}
            </Box>
            <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: muted, mt: 0.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {[existing.description, formatPreviewAmount(existing.amount, existing.currency)].filter(Boolean).join(" · ")}
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
            <Box component="button" type="button" data-testid="gs-use-existing" onClick={onUseExisting} sx={{ minHeight: 38, px: 1.75, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "#FFFFFF", backgroundColor: indigo }}>
              {t("gs.useThisLink", { defaultValue: "Use this link" })}
            </Box>
            {!showForm && (
              <Box component="button" type="button" data-testid="gs-create-new-instead" onClick={() => setShowForm(true)} sx={{ minHeight: 38, px: 1.5, borderRadius: 999, border: `1px solid ${border}`, cursor: "pointer", background: "transparent", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: ink }}>
                {t("gs.createNewInstead", { defaultValue: "Create a new one" })}
              </Box>
            )}
          </Box>
        </Box>
      )}

      {showForm && (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: { xs: 2.5, md: 4 }, alignItems: "start", [WIDE]: { gridTemplateColumns: "minmax(0, 1fr) 320px" } }}>
          <Box sx={{ display: "grid", gap: 2 }}>
            <Box>
              <Box sx={labelSx}>{t("gs.amount", { defaultValue: "Amount" })}</Box>
              <Box sx={{ display: "flex", gap: 1.25 }}>
                <TextField
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); if (errors.amount) setErrors({ ...errors, amount: undefined }); }}
                  placeholder="0.00"
                  inputMode="decimal"
                  error={!!errors.amount}
                  helperText={errors.amount || ""}
                  fullWidth
                  sx={fieldSx}
                  inputProps={{ "data-testid": "gs-link-amount", style: { fontFamily: MONO } }}
                />
                <TextField select value={currency} onChange={(e) => setCurrency(e.target.value)} sx={{ ...fieldSx, width: 120, flexShrink: 0 }} inputProps={{ "data-testid": "gs-link-currency" }} SelectProps={{ MenuProps: { PaperProps: { sx: { borderRadius: "12px" } } } }}>
                  {FIAT_OPTIONS.map((c) => (
                    <MenuItem key={c} value={c} sx={{ fontFamily: "var(--font-sans)" }}>{c}</MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>
            <Box>
              <Box sx={labelSx}>{t("gs.description", { defaultValue: "What is it for?" })}</Box>
              <TextField
                value={description}
                onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors({ ...errors, description: undefined }); }}
                placeholder={t("gs.descriptionPlaceholder", { defaultValue: "e.g. Logo design — final payment" })}
                error={!!errors.description}
                helperText={errors.description || ""}
                fullWidth
                sx={fieldSx}
                inputProps={{ "data-testid": "gs-link-description", maxLength: 120 }}
              />
            </Box>

            {/* Narrow content (phone, tablet, laptop with sidebar): collapsible preview */}
            <Box sx={{ display: "block", [WIDE]: { display: "none" } }}>
              <Box
                component="button"
                type="button"
                data-testid="gs-preview-toggle"
                aria-expanded={previewOpen}
                onClick={() => setPreviewOpen((v) => !v)}
                sx={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 44, px: 1.5, borderRadius: "12px", border: `1px solid ${border}`, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: ink }}
              >
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                  <Icon name="smartphone" size={16} />
                  {previewOpen ? t("gs.hidePreview", { defaultValue: "Hide preview" }) : t("gs.showPreview", { defaultValue: "Show customer preview" })}
                </Box>
                <Icon name={previewOpen ? "chevron-up" : "chevron-down"} size={16} />
              </Box>
              {previewOpen && <Box sx={{ mt: 2 }}>{preview}</Box>}
            </Box>

            {errors.form && (
              <Box role="alert" data-testid="gs-link-error" sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: theme.palette.error.main }}>
                {errors.form}
              </Box>
            )}
          </Box>

          <Box sx={{ display: "none", position: "sticky", top: 16, [WIDE]: { display: "block" } }}>{preview}</Box>
        </Box>
      )}

      <StepFooter
        onBack={onBack}
        primaryLabel={showForm
          ? submitting
            ? t("gs.creating", { defaultValue: "Creating…" })
            : hasWallet
              ? t("gs.createLink", { defaultValue: "Create link" })
              : t("gs.addWalletAndCreate", { defaultValue: "Add payout address & create" })
          : t("gs.continue", { defaultValue: "Continue" })}
        onPrimary={showForm ? (hasWallet ? handleCreate : handleNeedWallet) : onUseExisting}
        primaryLoading={submitting}
        primaryDisabled={submitting}
        primaryTestId={showForm ? "gs-link-create" : "gs-link-continue"}
      />

      <WalletManagerModal open={walletOpen} companyId={companyId ?? null} onClose={() => setWalletOpen(false)} onSaved={handleWalletSaved} />
    </Box>
  );
};

export default StepFirstLink;
