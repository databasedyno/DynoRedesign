/**
 * Buy Buttons Section — pre-created checkout objects (fixed OR customer-priced).
 * The `<dynopay-buy-button button-id="btn_…">` snippet asks the SERVER for the amount,
 * so a shopper cannot tamper with the price in the merchant's HTML.
 * Wires to POST/GET/PATCH/DELETE /api/buy-buttons. Shared chrome lives in ./keyedResource.
 */

import { Box, Typography, useTheme } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import axiosBaseApi from "@/axiosConfig";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import useBuyButtons from "@/hooks/useBuyButtons";
import usePublishableKeys from "@/hooks/usePublishableKeys";
import KeyedResourceSection, { useEffectiveCompanyId, useKeyedResource } from "./keyedResource/KeyedResourceSection";
import ResourceFormModal, { useResourceForm } from "./keyedResource/ResourceFormModal";
import ResourceRow from "./keyedResource/ResourceRow";
import {
  FieldHint,
  LabeledSelect,
  MONO_FONT,
  RowActionButton,
  SNIPPET_BASE,
  SectionLabel,
  SnippetPre,
  TokenChips,
  describeLoadError,
  upperTokens,
} from "./keyedResource/primitives";

type PriceType = "fixed" | "customer";

interface BuyButton {
  button_id: string;
  company_id: number;
  name: string;
  label: string;
  price_type: PriceType;
  amount: number | null;
  min_amount: number | null;
  max_amount: number | null;
  base_currency: string;
  allowed_currencies: string[] | null;
  description: string | null;
  success_url: string | null;
  metadata: Record<string, unknown> | null;
  status: "active" | "archived";
  usage_count: number;
  last_used_at: string | null;
  createdAt?: string;
}

interface PublishableKeyRef {
  publishable_key: string;
  environment: "production" | "development";
  status: "active" | "inactive" | "revoked";
}

interface FormState {
  name: string;
  label: string;
  price_type: PriceType;
  amount: string;
  min_amount: string;
  max_amount: string;
  allowed_currencies_input: string;
  description: string;
  success_url: string;
  metadata_input: string;
}

const DEFAULT_FORM: FormState = {
  name: "",
  label: "",
  price_type: "fixed",
  amount: "25",
  min_amount: "10",
  max_amount: "500",
  allowed_currencies_input: "",
  description: "",
  success_url: "",
  metadata_input: "",
};

const parseMetadata = (raw: string): Record<string, unknown> | null => {
  if (!raw.trim()) return null;
  try {
    const p = JSON.parse(raw);
    return p && typeof p === "object" && !Array.isArray(p) ? p : null;
  } catch {
    return null;
  }
};

const buildSnippet = (btn: BuyButton, pk: string) =>
  `<!-- Dynopay embed SDK — load once per page -->\n` +
  `<script src="${SNIPPET_BASE}/v1/embed.js"></script>\n\n` +
  `<!-- Paste the button anywhere on your page -->\n` +
  `<dynopay-buy-button\n` +
  `  publishable-key="${pk}"\n` +
  `  button-id="${btn.button_id}"\n` +
  (btn.price_type === "fixed" ? "" : `  amount="50"\n`) +
  (btn.allowed_currencies && btn.allowed_currencies.length === 1
    ? `  currency="${btn.allowed_currencies[0]}"\n`
    : "") +
  `  mode="modal"\n` +
  `  theme="dark"\n` +
  `></dynopay-buy-button>`;

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

interface RowProps {
  btn: BuyButton;
  pkLive: string | null;
  pkTest: string | null;
  onCopy: (v: string, label?: string) => void;
  onEdit: (btn: BuyButton) => void;
  onArchive: (btn: BuyButton) => void;
  onReactivate: (btn: BuyButton) => void;
}

const BuyButtonRow = ({ btn, pkLive, pkTest, onCopy, onEdit, onArchive, onReactivate }: RowProps) => {
  const theme = useTheme();
  const { t } = useTranslation("apiScreen");
  const id = btn.button_id;
  const active = btn.status === "active";
  const fixed = btn.price_type === "fixed";
  const statusColor = active ? theme.palette.success?.main || "#22C55E" : theme.palette.text.secondary;
  const snippet = buildSnippet(btn, pkLive || pkTest || "pk_live_your_key");
  const currencyCount = btn.allowed_currencies?.length || 0;
  const metaCount = btn.metadata ? Object.keys(btn.metadata).length : 0;

  const priceLabel = fixed
    ? `${btn.amount ?? 0} ${btn.base_currency}`
    : `${btn.min_amount ?? 5}-${btn.max_amount ?? "∞"} ${btn.base_currency} (${t("buyButtons.customerChooses", { defaultValue: "customer chooses" })})`;

  const meta = [
    priceLabel,
    `${btn.usage_count} ${t("buyButtons.uses", { defaultValue: "uses" })}`,
    currencyCount > 0
      ? `${currencyCount} ${t("buyButtons.currencies", { defaultValue: "currencies" })}`
      : t("buyButtons.allConfigured", { defaultValue: "All configured" }),
  ];
  if (metaCount > 0) meta.push(`${metaCount} ${t("buyButtons.metadata", { defaultValue: "metadata" })}`);

  return (
    <ResourceRow
      dimmed={!active}
      badge={{
        label: fixed
          ? t("buyButtons.badgeFixed", { defaultValue: "FIXED" })
          : t("buyButtons.badgeCustomer", { defaultValue: "CUSTOMER" }),
        bgcolor: fixed ? theme.palette.primary.main : theme.palette.warning?.main || "#F59E0B",
        color: fixed ? theme.palette.primary.contrastText || "#000" : "#fff",
      }}
      title={btn.name}
      status={{
        label: active
          ? t("buyButtons.statusActive", { defaultValue: "active" })
          : t("buyButtons.statusArchived", { defaultValue: "archived" }),
        color: statusColor,
        active,
      }}
      actions={
        <>
          <RowActionButton title={t("buyButtons.edit", { defaultValue: "Edit" })} testId={`bb-edit-${id}`} icon="pencil" disabled={!active} onClick={() => onEdit(btn)} />
          {active ? (
            <RowActionButton
              title={t("buyButtons.archive", { defaultValue: "Archive" })}
              testId={`bb-archive-${id}`}
              icon="trash-2"
              color={theme.palette.error.main}
              onClick={() => onArchive(btn)}
            />
          ) : (
            <RowActionButton
              title={t("buyButtons.reactivate", { defaultValue: "Reactivate" })}
              testId={`bb-reactivate-${id}`}
              icon="circle-check"
              onClick={() => onReactivate(btn)}
            />
          )}
        </>
      }
      value={{
        text: btn.button_id,
        testId: `bb-id-${id}`,
        action: (
          <RowActionButton
            title={t("buyButtons.copyButtonId", { defaultValue: "Copy button id" })}
            testId={`bb-copy-${id}`}
            icon="copy"
            onClick={() => onCopy(btn.button_id, t("buyButtons.buttonIdLabel", { defaultValue: "Button ID" }))}
          />
        ),
      }}
      meta={meta}
      expand={{
        testId: `bb-expand-${id}`,
        show: t("buyButtons.showSnippet", { defaultValue: "Show snippet" }),
        hide: t("buyButtons.hideSnippet", { defaultValue: "Hide snippet" }),
      }}
    >
      {btn.description && (
        <Box sx={{ mb: 1.25 }}>
          <SectionLabel>{t("buyButtons.description", { defaultValue: "Description" })}</SectionLabel>
          <Typography sx={{ fontSize: 13, color: theme.palette.text.primary }}>{btn.description}</Typography>
        </Box>
      )}

      {btn.success_url && (
        <Box sx={{ mb: 1.25 }}>
          <SectionLabel>{t("buyButtons.successUrl", { defaultValue: "Success URL" })}</SectionLabel>
          <Typography sx={{ fontSize: 13, fontFamily: MONO_FONT, color: theme.palette.text.primary, wordBreak: "break-all" }}>
            {btn.success_url}
          </Typography>
        </Box>
      )}

      {currencyCount > 0 && (
        <Box sx={{ mb: 1.25 }}>
          <SectionLabel>{t("buyButtons.allowedCurrencies", { defaultValue: "Allowed currencies" })}</SectionLabel>
          <TokenChips tokens={btn.allowed_currencies as string[]} />
        </Box>
      )}

      {!pkLive && !pkTest && (
        <Box
          sx={{
            mb: 1.25,
            p: 1.25,
            border: `1px solid ${theme.palette.warning?.main || "#F59E0B"}`,
            borderRadius: "8px",
            background: "rgba(245,158,11,0.08)",
          }}
        >
          <Typography sx={{ fontSize: 12, color: theme.palette.text.primary }}>
            {t("buyButtons.noPkWarnPre", {
              defaultValue: "Create a publishable key first (above) so this snippet has one to reference. The placeholder",
            })}{" "}
            <code>pk_live_your_key</code> {t("buyButtons.noPkWarnPost", { defaultValue: "is not usable." })}
          </Typography>
        </Box>
      )}

      <SnippetPre
        code={snippet}
        onCopy={() => onCopy(snippet, t("buyButtons.snippetCopyLabel", { defaultValue: "Buy Button snippet" }))}
        suffixLabel={t("buyButtons.snippet", { defaultValue: "snippet" })}
        copyLabel={t("buyButtons.copy", { defaultValue: "Copy" })}
      />
    </ResourceRow>
  );
};

/* ------------------------------------------------------------------ */
/* Create / edit modal                                                 */
/* ------------------------------------------------------------------ */

interface FormModalProps {
  open: boolean;
  mode: "create" | "edit";
  companyId: number | null;
  initial: BuyButton | null;
  onClose: () => void;
  onSaved: (msg: string, createdBtn?: BuyButton) => void;
}

const FormModal = ({ open, mode, companyId, initial, onClose, onSaved }: FormModalProps) => {
  const { t } = useTranslation("apiScreen");
  const defaultLabel = t("buyButtons.defaultLabel", { defaultValue: "Pay with crypto" });

  const { form, setField, saving, serverError, handleSubmit } = useResourceForm<FormState, BuyButton>({
    open,
    mode,
    initial,
    onClose,
    defaults: () => ({ ...DEFAULT_FORM, label: defaultLabel }),
    fromItem: (b) => ({
      name: b.name || "",
      label: b.label || defaultLabel,
      price_type: b.price_type,
      amount: b.amount != null ? String(b.amount) : "25",
      min_amount: b.min_amount != null ? String(b.min_amount) : "10",
      max_amount: b.max_amount != null ? String(b.max_amount) : "500",
      allowed_currencies_input: (b.allowed_currencies || []).join(", "),
      description: b.description || "",
      success_url: b.success_url || "",
      metadata_input: b.metadata ? JSON.stringify(b.metadata, null, 2) : "",
    }),
    failedMsg: t("buyButtons.saveFailed", { defaultValue: "Failed to save buy button" }),
    submit: async (f) => {
      if (!companyId) return;
      const allowed = upperTokens(f.allowed_currencies_input);
      const body: Record<string, unknown> = {
        name: f.name.trim(),
        label: f.label.trim() || defaultLabel,
        price_type: f.price_type,
        allowed_currencies: allowed.length > 0 ? allowed : null,
        description: f.description.trim() || null,
        success_url: f.success_url.trim() || null,
        metadata: parseMetadata(f.metadata_input),
      };
      if (f.price_type === "fixed") {
        body.amount = Number(f.amount);
      } else {
        body.min_amount = Number(f.min_amount);
        if (f.max_amount !== "") body.max_amount = Number(f.max_amount);
      }

      if (mode === "create") {
        body.company_id = companyId;
        const { data } = await axiosBaseApi.post("buy-buttons", body);
        onSaved(data?.message || t("buyButtons.createdMsg", { defaultValue: "Buy button created" }), data?.data as BuyButton);
      } else if (initial) {
        // price_type is immutable — drop it and the fields of the other price type
        delete body.price_type;
        if (initial.price_type === "fixed") {
          delete body.min_amount;
          delete body.max_amount;
        } else {
          delete body.amount;
        }
        const { data } = await axiosBaseApi.patch(`buy-buttons/${initial.button_id}`, body);
        onSaved(data?.message || t("buyButtons.updatedMsg", { defaultValue: "Buy button updated" }));
      }
    },
  });

  const currencies = useMemo(() => upperTokens(form.allowed_currencies_input), [form.allowed_currencies_input]);
  const metadataInvalid = !!form.metadata_input.trim() && !parseMetadata(form.metadata_input);
  const fixed = form.price_type === "fixed";

  const canSubmit =
    !!companyId &&
    !!form.name.trim() &&
    !metadataInvalid &&
    !saving &&
    (fixed
      ? Number(form.amount) >= 5
      : Number(form.min_amount) >= 5 && (form.max_amount === "" || Number(form.max_amount) > Number(form.min_amount)));

  return (
    <ResourceFormModal
      open={open}
      onClose={onClose}
      maxWidth={620}
      title={
        mode === "create"
          ? t("buyButtons.createTitle", { defaultValue: "Create buy button" })
          : t("buyButtons.editTitle", { defaultValue: "Edit buy button" })
      }
      intro={t("buyButtons.modalIntro", {
        defaultValue:
          "A buy button is a pre-created checkout object. Because the amount and currencies live server-side, shoppers can’t tamper with the price in your page’s HTML.",
      })}
      error={serverError}
      errorTestId="bb-form-error"
      cancelLabel={t("buyButtons.cancel", { defaultValue: "Cancel" })}
      cancelTestId="bb-form-cancel"
      submitLabel={
        mode === "create"
          ? t("buyButtons.createSubmit", { defaultValue: "Create button" })
          : t("buyButtons.saveChanges", { defaultValue: "Save changes" })
      }
      submitTestId="bb-form-submit"
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
    >
      <InputField
        fullWidth
        label={t("buyButtons.internalName", { defaultValue: "Internal name *" })}
        placeholder={t("buyButtons.internalNamePlaceholder", { defaultValue: "e.g. T-shirt (Large)" })}
        value={form.name}
        onChange={(e: any) => setField("name", e.target.value)}
        data-testid="bb-form-name"
      />

      <InputField
        fullWidth
        label={t("buyButtons.buttonLabel", { defaultValue: "Button label" })}
        placeholder={defaultLabel}
        value={form.label}
        onChange={(e: any) => setField("label", e.target.value)}
        data-testid="bb-form-label"
      />

      {mode === "create" && (
        <LabeledSelect
          label={t("buyButtons.priceType", { defaultValue: "Price type" })}
          value={form.price_type}
          onChange={(v) => setField("price_type", v as PriceType)}
          testId="bb-form-price-type"
          options={[
            { value: "fixed", label: t("buyButtons.priceFixed", { defaultValue: "Fixed price — you set the amount" }) },
            { value: "customer", label: t("buyButtons.priceCustomer", { defaultValue: "Customer chooses (e.g. donation)" }) },
          ]}
        />
      )}

      {fixed ? (
        <>
          <InputField
            fullWidth
            label={t("buyButtons.amount", { defaultValue: "Amount *" })}
            placeholder="25"
            type="number"
            value={form.amount}
            onChange={(e: any) => setField("amount", e.target.value)}
            data-testid="bb-form-amount"
          />
          <FieldHint>
            {t("buyButtons.amountHint", { defaultValue: "Amount must be ≥ 5 (base currency of your active secret key)." })}
          </FieldHint>
        </>
      ) : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <InputField
              fullWidth
              label={t("buyButtons.minAmount", { defaultValue: "Min amount *" })}
              placeholder="10"
              type="number"
              value={form.min_amount}
              onChange={(e: any) => setField("min_amount", e.target.value)}
              data-testid="bb-form-min"
            />
            <InputField
              fullWidth
              label={t("buyButtons.maxAmount", { defaultValue: "Max amount" })}
              placeholder="500"
              type="number"
              value={form.max_amount}
              onChange={(e: any) => setField("max_amount", e.target.value)}
              data-testid="bb-form-max"
            />
          </Box>
          <FieldHint>
            {t("buyButtons.rangeHint", { defaultValue: "Shopper picks any amount in this range at checkout. Min must be ≥ 5." })}
          </FieldHint>
        </>
      )}

      <InputField
        fullWidth
        label={t("buyButtons.allowedCurrenciesLabel", { defaultValue: "Allowed currencies (optional)" })}
        placeholder={t("buyButtons.allowedCurrenciesPlaceholder", {
          defaultValue: "e.g. USDT-TRC20, USDC-ERC20 — leave empty to allow all configured",
        })}
        value={form.allowed_currencies_input}
        onChange={(e: any) => setField("allowed_currencies_input", e.target.value)}
        data-testid="bb-form-currencies"
      />
      {currencies.length > 0 && <TokenChips tokens={currencies} mt={-1} />}

      <InputField
        fullWidth
        label={t("buyButtons.descriptionOptional", { defaultValue: "Description (optional)" })}
        placeholder={t("buyButtons.descriptionPlaceholder", { defaultValue: "Shown to shoppers on the checkout page" })}
        multiline
        minRows={2}
        value={form.description}
        onChange={(e: any) => setField("description", e.target.value)}
        data-testid="bb-form-description"
      />

      <InputField
        fullWidth
        label={t("buyButtons.successUrlOptional", { defaultValue: "Success URL (optional)" })}
        placeholder={t("buyButtons.successUrlPlaceholder", {
          defaultValue: "https://shop.com/thanks — where to send the shopper after payment",
        })}
        value={form.success_url}
        onChange={(e: any) => setField("success_url", e.target.value)}
        data-testid="bb-form-success-url"
      />

      <InputField
        fullWidth
        label={t("buyButtons.metadataLabel", { defaultValue: "Metadata JSON (optional)" })}
        placeholder='{"sku":"TSHIRT-L-BLK","campaign":"summer24"}'
        multiline
        minRows={3}
        value={form.metadata_input}
        onChange={(e: any) => setField("metadata_input", e.target.value)}
        data-testid="bb-form-metadata"
      />
      {metadataInvalid ? (
        <FieldHint error>
          {t("buyButtons.metadataInvalidPre", { defaultValue: "Metadata must be a valid JSON object (e.g." })} <code>{"{}"}</code>
          {t("buyButtons.metadataInvalidPost", { defaultValue: ")." })}
        </FieldHint>
      ) : (
        <FieldHint>
          {t("buyButtons.metadataHint", {
            defaultValue: "Attached to every session created from this button — useful for reconciling webhooks server-side.",
          })}
        </FieldHint>
      )}
    </ResourceFormModal>
  );
};

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

const STATUS_RANK: Record<string, number> = { active: 0, archived: 1 };

const findActivePk = (keys: PublishableKeyRef[], env: PublishableKeyRef["environment"]) =>
  keys.find((p) => p.status === "active" && p.environment === env)?.publishable_key || null;

const BuyButtonsSection = () => {
  const { t } = useTranslation("apiScreen");
  const companyId = useEffectiveCompanyId();

  const buttonsQuery = useBuyButtons<BuyButton>(companyId, { enabled: !!companyId });
  const pksQuery = usePublishableKeys<PublishableKeyRef>(companyId, { enabled: !!companyId });
  const refetch = () => {
    buttonsQuery.refetch();
    pksQuery.refetch();
  };

  const kr = useKeyedResource<BuyButton, string>({ i18nPrefix: "buyButtons", refetch });

  const loadFailed = t("buyButtons.loadFailed", { defaultValue: "Failed to load buy buttons" });
  const loadError = describeLoadError(buttonsQuery.error, loadFailed) || describeLoadError(pksQuery.error, loadFailed);

  const pkLive = useMemo(() => findActivePk(pksQuery.keys, "production"), [pksQuery.keys]);
  const pkTest = useMemo(() => findActivePk(pksQuery.keys, "development"), [pksQuery.keys]);

  const sortedButtons = useMemo(
    () =>
      [...buttonsQuery.buttons].sort((a, b) => {
        const s = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
        if (s !== 0) return s;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }),
    [buttonsQuery.buttons],
  );

  const confirmArchive = async () => {
    const id = kr.removeId;
    if (id === null) return;
    try {
      await kr.mutate(() => axiosBaseApi.delete(`buy-buttons/${id}`), {
        success: t("buyButtons.archivedToast", { defaultValue: "Buy button archived" }),
        failed: t("buyButtons.archiveFailed", { defaultValue: "Failed to archive buy button" }),
      });
    } finally {
      kr.cancelRemove();
    }
  };

  const reactivate = (btn: BuyButton) =>
    kr.mutate(() => axiosBaseApi.patch(`buy-buttons/${btn.button_id}`, { status: "active" }), {
      success: t("buyButtons.reactivatedToast", { defaultValue: "Buy button reactivated" }),
      failed: t("buyButtons.reactivateFailed", { defaultValue: "Failed to reactivate buy button" }),
    });

  return (
    <KeyedResourceSection
      prefix="bb"
      sectionTestId="buy-buttons-section"
      title={t("buyButtons.title", { defaultValue: "Buy buttons" })}
      description={
        <>
          {t("buyButtons.sectionDescPre", { defaultValue: "Pre-created checkout objects. The" })} <code>button-id</code>{" "}
          {t("buyButtons.sectionDescPost", {
            defaultValue:
              "path is the canonical Stripe-style flow — because the amount lives server-side, shoppers can’t tamper with the price in your HTML.",
          })}
        </>
      }
      createLabel={{
        short: t("buyButtons.create", { defaultValue: "Create" }),
        long: t("buyButtons.createBuyButton", { defaultValue: "Create buy button" }),
      }}
      companyId={companyId}
      noCompanyText={t("buyButtons.selectCompany", { defaultValue: "Select a brand to manage its buy buttons." })}
      loading={buttonsQuery.loading || pksQuery.loading}
      loadError={loadError}
      isEmpty={sortedButtons.length === 0}
      empty={{
        title: t("buyButtons.empty", {
          defaultValue: "No buy buttons yet. Create one to embed a tamper-proof checkout on your site.",
        }),
      }}
      onCreate={kr.openCreate}
      remove={{
        open: kr.removeId !== null,
        onClose: kr.cancelRemove,
        onConfirm: confirmArchive,
        title: t("buyButtons.deleteTitle", { defaultValue: "Archive buy button" }),
        message: t("buyButtons.deleteMessage", {
          defaultValue:
            "Once archived, this buy button can no longer create checkout sessions. Any pages on your site using it will stop working until you reactivate it (or replace the button-id with a new one).",
        }),
      }}
      modal={
        <FormModal
          open={kr.modal.open}
          mode={kr.modal.mode}
          companyId={companyId}
          initial={kr.modal.item}
          onClose={kr.closeModal}
          onSaved={kr.onSaved}
        />
      }
    >
      {sortedButtons.map((btn) => (
        <BuyButtonRow
          key={btn.button_id}
          btn={btn}
          pkLive={pkLive}
          pkTest={pkTest}
          onCopy={kr.handleCopy}
          onEdit={kr.openEdit}
          onArchive={(b) => kr.requestRemove(b.button_id)}
          onReactivate={reactivate}
        />
      ))}
    </KeyedResourceSection>
  );
};

export default BuyButtonsSection;
