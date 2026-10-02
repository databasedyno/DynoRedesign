/**
 * Publishable Keys Section — browser-safe pk_live_/pk_test_ keys for <dynopay-buy-button>.
 * Wires to POST/GET/PATCH/DELETE /api/publishable-keys. Shared chrome lives in ./keyedResource.
 */

import { Box, Typography, useTheme } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";

import axiosBaseApi from "@/axiosConfig";
import CustomButton from "@/Components/UI/Buttons";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CopyInline from "@/Components/UX/CopyInline";
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
  parseTokens,
  upperTokens,
} from "./keyedResource/primitives";

type Environment = "production" | "development";

interface PublishableKey {
  pub_key_id: number;
  publishable_key: string;
  key_prefix: string;
  key_masked: string;
  environment: Environment;
  status: "active" | "inactive" | "revoked";
  allowed_domains: string[];
  max_amount: number;
  allowed_currencies: string[] | null;
  base_currency: string;
  rate_limit_per_minute: number;
  usage_count: number;
  last_used_at: string | null;
  key_name: string | null;
  createdAt?: string | null;
}

interface FormState {
  environment: Environment;
  key_name: string;
  allowed_domains_input: string;
  max_amount: string;
  allowed_currencies_input: string;
}

const DEFAULT_FORM: FormState = {
  environment: "development",
  key_name: "",
  allowed_domains_input: "",
  max_amount: "2000",
  allowed_currencies_input: "",
};

const buildSnippet = (pk: PublishableKey) =>
  `<!-- Load Dynopay embed SDK once per page -->\n` +
  `<script src="${SNIPPET_BASE}/v1/embed.js"></script>\n\n` +
  `<!-- Paste the button anywhere on your page -->\n` +
  `<dynopay-buy-button\n` +
  `  publishable-key="${pk.publishable_key}"\n` +
  `  amount="50"\n` +
  (pk.allowed_currencies && pk.allowed_currencies.length === 1
    ? `  currency="${pk.allowed_currencies[0]}"\n`
    : "") +
  `  label="Pay with crypto"\n` +
  `  mode="modal"\n` +
  `  theme="dark"\n` +
  `></dynopay-buy-button>`;

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

interface RowProps {
  pk: PublishableKey;
  onCopy: (v: string, label?: string) => void;
  onEdit: (pk: PublishableKey) => void;
  onRevoke: (pk: PublishableKey) => void;
  onToggleStatus: (pk: PublishableKey) => void;
}

const PublishableKeyRow = ({ pk, onCopy, onEdit, onRevoke, onToggleStatus }: RowProps) => {
  const theme = useTheme();
  const { t } = useTranslation("apiScreen");
  const id = pk.pub_key_id;
  const isLive = pk.environment === "production";
  const revoked = pk.status === "revoked";
  const success = theme.palette.success?.main || "#22C55E";
  const envColor = isLive ? success : theme.palette.warning?.main || "#F59E0B";
  const statusColor =
    pk.status === "active" ? success : pk.status === "inactive" ? theme.palette.text.secondary : theme.palette.error.main;
  const snippet = buildSnippet(pk);
  const toggleLabel = pk.status === "active" ? t("pk.disable", { defaultValue: "Disable" }) : t("pk.enable", { defaultValue: "Enable" });
  const currencyCount = pk.allowed_currencies?.length || 0;

  return (
    <ResourceRow
      badge={{ label: isLive ? "LIVE" : "TEST", bgcolor: envColor, color: "#fff" }}
      title={
        pk.key_name ||
        (isLive
          ? t("pk.liveBuyButton", { defaultValue: "Live Buy Button" })
          : t("pk.testBuyButton", { defaultValue: "Test Buy Button" }))
      }
      status={{ label: pk.status, color: statusColor, active: pk.status === "active" }}
      actions={
        <>
          <RowActionButton title={toggleLabel} testId={`pk-toggle-${id}`} icon="power" disabled={revoked} onClick={() => onToggleStatus(pk)} />
          <RowActionButton title={t("pk.edit", { defaultValue: "Edit" })} testId={`pk-edit-${id}`} icon="pencil" disabled={revoked} onClick={() => onEdit(pk)} />
          <RowActionButton
            title={t("pk.revoke", { defaultValue: "Revoke" })}
            testId={`pk-revoke-${id}`}
            icon="trash-2"
            disabled={revoked}
            color={theme.palette.error.main}
            onClick={() => onRevoke(pk)}
          />
        </>
      }
      value={{
        text: pk.publishable_key,
        testId: `pk-value-${id}`,
        action: (
          <CopyInline
            value={pk.publishable_key}
            size={16}
            testId={`pk-copy-${id}`}
            copyLabel={t("pk.copyKey", { defaultValue: "Copy publishable key" })}
          />
        ),
      }}
      meta={[
        t("pk.chipMax", { defaultValue: "Max {{amount}} {{currency}}", amount: pk.max_amount, currency: pk.base_currency || "USD" }),
        t("pk.chipRate", { defaultValue: "{{rate}}/min", rate: pk.rate_limit_per_minute }),
        t("pk.chipUses", { defaultValue: "{{count}} uses", count: pk.usage_count }),
        currencyCount > 0
          ? t("pk.chipCurrencies", { defaultValue: "{{count}} currencies", count: currencyCount })
          : t("pk.chipAllCurrencies", { defaultValue: "All configured currencies" }),
        t("pk.chipDomains", { defaultValue: "{{count}} domain(s)", count: pk.allowed_domains.length }),
      ]}
      expand={{
        testId: `pk-expand-${id}`,
        show: t("pk.showDetails", { defaultValue: "Show details & snippet" }),
        hide: t("pk.hideDetails", { defaultValue: "Hide details & snippet" }),
      }}
    >
      <SectionLabel>{t("pk.allowedDomains", { defaultValue: "Allowed domains" })}</SectionLabel>
      <TokenChips tokens={pk.allowed_domains} />

      {currencyCount > 0 && (
        <>
          <SectionLabel mt={1.25}>{t("pk.allowedCurrencies", { defaultValue: "Allowed currencies" })}</SectionLabel>
          <TokenChips tokens={pk.allowed_currencies as string[]} />
        </>
      )}

      <SnippetPre
        code={snippet}
        onCopy={() => onCopy(snippet, t("pk.buyButtonSnippetLabel", { defaultValue: "Buy Button snippet" }))}
        suffixLabel={t("pk.snippetSuffix", { defaultValue: "snippet" })}
        copyLabel={t("pk.copy", { defaultValue: "Copy" })}
      />

      <Typography sx={{ mt: 1, fontSize: 12, color: theme.palette.text.secondary }}>
        {t("pk.rowDescription", {
          defaultValue:
            "Change amount and (optionally) currency as needed. This publishable key only accepts requests coming from the domains listed above, and only for amounts ≤ {{max}} {{currency}}.",
          max: pk.max_amount,
          currency: pk.base_currency,
        })}
      </Typography>
    </ResourceRow>
  );
};

/* ------------------------------------------------------------------ */
/* Create / edit modal                                                 */
/* ------------------------------------------------------------------ */

interface KeyFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  companyId: number | null;
  initialPk: PublishableKey | null;
  onClose: () => void;
  onSaved: (msg: string, createdKey?: PublishableKey) => void;
}

const KeyFormModal = ({ open, mode, companyId, initialPk, onClose, onSaved }: KeyFormModalProps) => {
  const { t } = useTranslation("apiScreen");

  const { form, setField, saving, serverError, handleSubmit } = useResourceForm<FormState, PublishableKey>({
    open,
    mode,
    initial: initialPk,
    onClose,
    defaults: () => DEFAULT_FORM,
    fromItem: (pk) => ({
      environment: pk.environment,
      key_name: pk.key_name || "",
      allowed_domains_input: (pk.allowed_domains || []).join(", "),
      max_amount: String(pk.max_amount || 2000),
      allowed_currencies_input: (pk.allowed_currencies || []).join(", "),
    }),
    failedMsg: t("pk.saveFailedMsg", { defaultValue: "Failed to save publishable key" }),
    submit: async (f) => {
      if (!companyId) return;
      const allowed = upperTokens(f.allowed_currencies_input);
      const body: Record<string, unknown> = {
        allowed_domains: parseTokens(f.allowed_domains_input),
        max_amount: Number(f.max_amount),
        allowed_currencies: allowed.length > 0 ? allowed : null,
        key_name: f.key_name.trim() || undefined,
      };
      if (mode === "create") {
        body.company_id = companyId;
        body.environment = f.environment;
        const { data } = await axiosBaseApi.post("publishable-keys", body);
        onSaved(data?.message || t("pk.createdMsg", { defaultValue: "Publishable key created" }), data?.data as PublishableKey);
      } else if (initialPk) {
        const { data } = await axiosBaseApi.patch(`publishable-keys/${initialPk.pub_key_id}`, body);
        onSaved(data?.message || t("pk.updatedMsg", { defaultValue: "Publishable key updated" }));
      }
    },
  });

  const domains = useMemo(() => parseTokens(form.allowed_domains_input), [form.allowed_domains_input]);
  const currencies = useMemo(() => upperTokens(form.allowed_currencies_input), [form.allowed_currencies_input]);
  const canSubmit = !!companyId && domains.length > 0 && Number(form.max_amount) >= 5 && !saving;

  return (
    <ResourceFormModal
      open={open}
      onClose={onClose}
      title={
        mode === "create"
          ? t("pk.createTitle", { defaultValue: "Create publishable key" })
          : t("pk.editTitle", { defaultValue: "Edit publishable key" })
      }
      intro={t("pk.formIntro", {
        defaultValue:
          "Publishable keys are safe to use in browser code. Every request from them is checked against the domains you list below.",
      })}
      error={serverError}
      errorTestId="pk-form-error"
      cancelLabel={t("pk.cancel", { defaultValue: "Cancel" })}
      cancelTestId="pk-form-cancel"
      submitLabel={
        mode === "create"
          ? t("pk.createKey", { defaultValue: "Create key" })
          : t("pk.saveChanges", { defaultValue: "Save changes" })
      }
      submitTestId="pk-form-submit"
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
    >
      {mode === "create" && (
        <LabeledSelect
          label={t("pk.environment", { defaultValue: "Environment" })}
          value={form.environment}
          onChange={(v) => setField("environment", v as Environment)}
          testId="pk-form-env"
          options={[
            { value: "development", label: t("pk.envTest", { defaultValue: "Test — pk_test_… (recommended to try first)" }) },
            { value: "production", label: t("pk.envLive", { defaultValue: "Live — pk_live_…" }) },
          ]}
        />
      )}

      <InputField
        fullWidth
        label={t("pk.keyNameLabel", { defaultValue: "Key name (optional)" })}
        placeholder={t("pk.keyNamePlaceholder", { defaultValue: "e.g. Storefront checkout" })}
        value={form.key_name}
        onChange={(e: any) => setField("key_name", e.target.value)}
        data-testid="pk-form-name"
      />

      <InputField
        fullWidth
        label={t("pk.allowedDomainsLabel", { defaultValue: "Allowed domains *" })}
        placeholder="https://shop.com, *.shop.com"
        multiline
        minRows={2}
        value={form.allowed_domains_input}
        onChange={(e: any) => setField("allowed_domains_input", e.target.value)}
        data-testid="pk-form-domains"
      />
      <FieldHint>
        {t("pk.domainsHelp", {
          defaultValue:
            "Comma or space separated. Accepts full URLs (https://shop.com) or wildcard subdomains (*.shop.com). Requests from other origins are rejected.",
        })}
      </FieldHint>
      {domains.length > 0 && <TokenChips tokens={domains} mt={-1} />}

      <InputField
        fullWidth
        label={t("pk.maxAmountLabel", { defaultValue: "Max amount *" })}
        placeholder="2000"
        type="number"
        value={form.max_amount}
        onChange={(e: any) => setField("max_amount", e.target.value)}
        data-testid="pk-form-max"
      />
      <FieldHint>
        {t("pk.maxAmountHelp", {
          defaultValue: "The largest single payment this key can create (in your base currency). Amount must be ≥ 5.",
        })}
      </FieldHint>

      <InputField
        fullWidth
        label={t("pk.allowedCurrenciesLabel", { defaultValue: "Allowed currencies (optional)" })}
        placeholder={t("pk.allowedCurrenciesPlaceholder", {
          defaultValue: "e.g. USDT-TRC20, USDC-ERC20 — leave empty to allow all configured wallets",
        })}
        value={form.allowed_currencies_input}
        onChange={(e: any) => setField("allowed_currencies_input", e.target.value)}
        data-testid="pk-form-currencies"
      />
      {currencies.length > 0 && <TokenChips tokens={currencies} mt={-1} />}
    </ResourceFormModal>
  );
};

/* ------------------------------------------------------------------ */
/* "Just created" banner — shows the full key once                     */
/* ------------------------------------------------------------------ */

const JustCreatedBanner = ({ pk, onDismiss }: { pk: PublishableKey; onDismiss: () => void }) => {
  const theme = useTheme();
  const { t } = useTranslation("apiScreen");
  const success = theme.palette.success?.main || "#22C55E";
  return (
    <Box
      data-testid="pk-just-created-banner"
      sx={{
        mt: 1.5,
        border: `1px solid ${success}`,
        background: theme.palette.mode === "dark" ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.06)",
        borderRadius: "12px",
        p: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Icon name="circle-check" size={20} color={success} />
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: theme.palette.text.primary }}>
          {t("pk.createdBannerTitle", { defaultValue: "Publishable key created" })}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, mb: 1 }}>
        {t("pk.createdBannerBody", {
          defaultValue: "This key is safe to use in browser code. Copy it below — you can also re-copy it any time from the list.",
        })}
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "#fff",
          border: `1px solid ${theme.palette.border.main}`,
          borderRadius: "8px",
          px: 1.25,
          py: 0.75,
        }}
      >
        <Typography
          sx={{ flex: 1, minWidth: 0, fontFamily: MONO_FONT, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {pk.publishable_key}
        </Typography>
        <CopyInline
          value={pk.publishable_key}
          size={16}
          testId="pk-just-created-copy"
          copyLabel={t("pk.copyKey", { defaultValue: "Copy publishable key" })}
        />
      </Box>
      <Box sx={{ mt: 1.25, display: "flex", justifyContent: "flex-end" }}>
        <CustomButton
          variant="secondary"
          size="small"
          label={t("pk.dismiss", { defaultValue: "Dismiss" })}
          onClick={onDismiss}
          sx={{ height: 28, fontSize: 12 }}
        />
      </Box>
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

const STATUS_RANK: Record<string, number> = { active: 0, inactive: 1, revoked: 2 };
const ENV_RANK: Record<string, number> = { production: 0, development: 1 };

const PublishableKeysSection = () => {
  const { t } = useTranslation("apiScreen");
  const companyId = useEffectiveCompanyId();
  const { keys, loading, error, refetch } = usePublishableKeys<PublishableKey>(companyId, { enabled: !!companyId });
  const kr = useKeyedResource<PublishableKey, number>({ i18nPrefix: "pk", refetch });

  const sortedKeys = useMemo(
    () =>
      [...keys].sort((a, b) => {
        const s = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
        return s !== 0 ? s : (ENV_RANK[a.environment] ?? 9) - (ENV_RANK[b.environment] ?? 9);
      }),
    [keys],
  );

  const toggleStatus = (pk: PublishableKey) => {
    if (pk.status === "revoked") return;
    const next = pk.status === "active" ? "inactive" : "active";
    kr.mutate(() => axiosBaseApi.patch(`publishable-keys/${pk.pub_key_id}`, { status: next }), {
      success:
        next === "active"
          ? t("pk.enabledToast", { defaultValue: "Publishable key enabled" })
          : t("pk.disabledToast", { defaultValue: "Publishable key disabled" }),
      failed: t("pk.statusUpdateFailed", { defaultValue: "Failed to update publishable key status" }),
    });
  };

  const confirmRevoke = async () => {
    const id = kr.removeId;
    if (id === null) return;
    try {
      await kr.mutate(() => axiosBaseApi.delete(`publishable-keys/${id}`), {
        success: t("pk.revokedToast", { defaultValue: "Publishable key revoked" }),
        failed: t("pk.revokeFailed", { defaultValue: "Failed to revoke publishable key" }),
      });
    } finally {
      kr.cancelRemove();
    }
  };

  return (
    <KeyedResourceSection
      prefix="pk"
      sectionTestId="publishable-keys-section"
      title={t("pk.sectionTitle", { defaultValue: "Publishable keys · Buy Button" })}
      description={t("pk.sectionDescription", {
        defaultValue:
          "Browser-safe keys for drop-in <dynopay-buy-button>. Each key is domain-locked and amount-capped. Requires an active secret key of the same environment.",
      })}
      createLabel={{
        short: t("pk.createShort", { defaultValue: "Create" }),
        long: t("pk.createLong", { defaultValue: "Create publishable key" }),
      }}
      companyId={companyId}
      noCompanyText={t("pk.selectCompany", { defaultValue: "Select a brand to manage its publishable keys." })}
      loading={loading}
      loadError={describeLoadError(error, t("pk.loadFailed", { defaultValue: "Failed to load publishable keys" }))}
      isEmpty={sortedKeys.length === 0}
      empty={{
        icon: "code-xml",
        title: t("pk.emptyTitle", { defaultValue: "No publishable keys yet" }),
        body: t("pk.emptyBody", {
          defaultValue:
            "Publishable keys let you embed a Buy Button or checkout on your own site. Create one to get your first embeddable snippet.",
        }),
        ctaLabel: t("pk.createLong", { defaultValue: "Create publishable key" }),
      }}
      onCreate={kr.openCreate}
      banner={kr.justCreated && <JustCreatedBanner pk={kr.justCreated} onDismiss={kr.dismissJustCreated} />}
      remove={{
        open: kr.removeId !== null,
        onClose: kr.cancelRemove,
        onConfirm: confirmRevoke,
        title: t("pk.revokeModalTitle", { defaultValue: "Revoke publishable key" }),
        message: t("pk.revokeModalMessage", {
          defaultValue:
            "Once revoked, this publishable key can no longer create checkout sessions. Any Buy Buttons on your site using this key will stop working. This action cannot be undone.",
        }),
      }}
      modal={
        <KeyFormModal
          open={kr.modal.open}
          mode={kr.modal.mode}
          companyId={companyId}
          initialPk={kr.modal.item}
          onClose={kr.closeModal}
          onSaved={kr.onSaved}
        />
      }
    >
      {sortedKeys.map((pk) => (
        <PublishableKeyRow
          key={pk.pub_key_id}
          pk={pk}
          onCopy={kr.handleCopy}
          onEdit={kr.openEdit}
          onRevoke={(row) => kr.requestRemove(row.pub_key_id)}
          onToggleStatus={toggleStatus}
        />
      ))}
    </KeyedResourceSection>
  );
};

export default PublishableKeysSection;
