import { brandFg } from "@/constants/theme";
/**
 * Publishable Keys Section — Phase 2C dashboard UI for Buy Button
 *
 * Renders a self-contained card at the bottom of the API Keys page:
 *   • List current publishable keys (pk_live_/pk_test_) for the selected company
 *   • Create new pk with allowed_domains, max_amount, allowed_currencies
 *   • Edit / Revoke (soft-delete) an existing pk
 *   • Copy full pk (browser-safe) + copy pre-filled <dynopay-buy-button> snippet
 *
 * Wires to backend routes (all mounted under /api):
 *   POST/GET/PATCH/DELETE /api/publishable-keys
 */

import { useCompanyStore } from "@/contexts/CompanyDataContext";
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { Icon } from "@/styles/uiKit";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import axiosBaseApi from "@/axiosConfig";
import CustomButton from "@/Components/UI/Buttons";
import DeleteModel from "@/Components/UI/DeleteModel";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import PanelCard from "@/Components/UI/PanelCard";
import PopupModal from "@/Components/UI/PopupModal";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import useIsMobile from "@/hooks/useIsMobile";
import usePublishableKeys from "@/hooks/usePublishableKeys";
import { rootReducer } from "@/utils/types";
import copyToClipboard from "@/helpers/copyToClipboard";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface PublishableKey {
  pub_key_id: number;
  publishable_key: string;
  key_prefix: string;
  key_masked: string;
  environment: "production" | "development";
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
  environment: "production" | "development";
  key_name: string;
  allowed_domains_input: string; // free-typed, comma/space/newline separated
  max_amount: string;
  allowed_currencies_input: string; // comma-separated codes, blank = all
}

const DEFAULT_FORM: FormState = {
  environment: "development",
  key_name: "",
  allowed_domains_input: "",
  max_amount: "2000",
  allowed_currencies_input: "",
};

const parseTokens = (raw: string): string[] =>
  raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

/* ------------------------------------------------------------------ */
/* Snippet card                                                        */
/* ------------------------------------------------------------------ */

const SnippetPre = ({ code, onCopy }: { code: string; onCopy: () => void }) => {
  const theme = useTheme();
  return (
    <Box sx={{ mt: 1 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 0.5,
        }}
      >
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
          }}
        >
          &lt;dynopay-buy-button&gt; snippet
        </Typography>
        <Box
          component="button"
          type="button"
          onClick={onCopy}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            border: `1px solid ${theme.palette.border.main}`,
            background: "transparent",
            color: theme.palette.text.secondary,
            borderRadius: "6px",
            px: 1,
            py: 0.4,
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "var(--font-sans)",
            "&:hover": { color: theme.palette.text.primary },
          }}
        >
          <Icon name="copy" size={14} />
          Copy
        </Box>
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          borderRadius: "8px",
          overflowX: "auto",
          background:
            theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#0b0b0b",
          color:
            theme.palette.mode === "dark" ? "#d6f7c2" : "#e6e6e6",
          fontSize: 12.5,
          lineHeight: 1.6,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          whiteSpace: "pre",
          border: `1px solid ${theme.palette.border.main}`,
        }}
      >
        {code}
      </Box>
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Publishable Key Card (list item)                                    */
/* ------------------------------------------------------------------ */

interface RowProps {
  pk: PublishableKey;
  onCopy: (v: string, label?: string) => void;
  onEdit: (pk: PublishableKey) => void;
  onRevoke: (pk: PublishableKey) => void;
  onToggleStatus: (pk: PublishableKey) => void;
  snippetBase: string;
}

const PublishableKeyRow = ({
  pk,
  onCopy,
  onEdit,
  onRevoke,
  onToggleStatus,
  snippetBase,
}: RowProps) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const [expanded, setExpanded] = useState(false);

  const envLabel = pk.environment === "production" ? "LIVE" : "TEST";
  const envColor =
    pk.environment === "production"
      ? theme.palette.success?.main || "#22C55E"
      : theme.palette.warning?.main || "#F59E0B";

  const statusColor =
    pk.status === "active"
      ? theme.palette.success?.main || "#22C55E"
      : pk.status === "inactive"
        ? theme.palette.text.secondary
        : theme.palette.error.main;

  // Merchants read this snippet and paste into their site (browser-safe pk).
  const snippet =
    `<!-- Load Dynopay embed SDK once per page -->\n` +
    `<script src="${snippetBase}/v1/embed.js"></script>\n\n` +
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

  return (
    <Box
      sx={{
        border: `1px solid ${theme.palette.border.main}`,
        borderRadius: "12px",
        background: theme.palette.background.paper,
        p: { xs: 1.5, sm: 2 },
        transition: "border-color 0.2s ease",
        "&:hover": { borderColor: theme.palette.primary.main },
      }}
    >
      {/* Top row: badge + name + status + actions */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, flexWrap: "wrap" }}>
          <Chip
            label={envLabel}
            size="small"
            sx={{
              height: 22,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              bgcolor: envColor,
              color: "#fff",
              "& .MuiChip-label": { px: 1 },
            }}
          />
          <Typography
            sx={{
              fontSize: { xs: 14, md: 15 },
              fontWeight: 600,
              color: theme.palette.text.primary,
              fontFamily: "var(--font-sans)",
            }}
          >
            {pk.key_name || (pk.environment === "production" ? "Live Buy Button" : "Test Buy Button")}
          </Typography>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: statusColor }}>
            {pk.status === "active" ? (
              <Icon name="circle-check" size={16} />
            ) : (
              <Icon name="ban" size={16} />
            )}
            <Typography sx={{ fontSize: 12, fontWeight: 600, textTransform: "capitalize", color: statusColor }}>
              {pk.status}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          <Tooltip title={pk.status === "active" ? "Disable" : "Enable"}>
            <span>
              <IconButton
                size="small"
                data-testid={`pk-toggle-${pk.pub_key_id}`}
                disabled={pk.status === "revoked"}
                onClick={() => onToggleStatus(pk)}
                sx={{ color: theme.palette.text.secondary }}
              >
                <Icon name="power" size={18} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Edit">
            <span>
              <IconButton
                size="small"
                data-testid={`pk-edit-${pk.pub_key_id}`}
                disabled={pk.status === "revoked"}
                onClick={() => onEdit(pk)}
                sx={{ color: theme.palette.text.secondary }}
              >
                <Icon name="pencil" size={18} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Revoke">
            <span>
              <IconButton
                size="small"
                data-testid={`pk-revoke-${pk.pub_key_id}`}
                disabled={pk.status === "revoked"}
                onClick={() => onRevoke(pk)}
                sx={{ color: theme.palette.error.main }}
              >
                <Icon name="trash-2" size={18} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* Key + copy */}
      <Box
        sx={{
          mt: 1.25,
          display: "flex",
          alignItems: "center",
          gap: 1,
          background:
            theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#F7F8FA",
          border: `1px solid ${theme.palette.border.main}`,
          borderRadius: "8px",
          px: 1.25,
          py: 0.75,
          minWidth: 0,
        }}
      >
        <Typography
          sx={{
            flex: 1,
            minWidth: 0,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: { xs: 12, md: 13 },
            color: theme.palette.text.primary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          data-testid={`pk-value-${pk.pub_key_id}`}
        >
          {pk.publishable_key}
        </Typography>
        <Tooltip title="Copy publishable key">
          <IconButton
            size="small"
            data-testid={`pk-copy-${pk.pub_key_id}`}
            onClick={() => onCopy(pk.publishable_key, "Publishable key")}
          >
            <Icon name="copy" size={16} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Meta */}
      <Box
        sx={{
          mt: 1,
          display: "flex",
          flexWrap: "wrap",
          gap: 0.75,
          alignItems: "center",
        }}
      >
        <Chip
          size="small"
          label={`Max ${pk.max_amount} ${pk.base_currency || "USD"}`}
          sx={{ height: 22, fontSize: 11 }}
        />
        <Chip
          size="small"
          label={`${pk.rate_limit_per_minute}/min`}
          sx={{ height: 22, fontSize: 11 }}
        />
        <Chip
          size="small"
          label={`${pk.usage_count} uses`}
          sx={{ height: 22, fontSize: 11 }}
        />
        {pk.allowed_currencies && pk.allowed_currencies.length > 0 ? (
          <Chip
            size="small"
            label={`${pk.allowed_currencies.length} currencies`}
            sx={{ height: 22, fontSize: 11 }}
          />
        ) : (
          <Chip
            size="small"
            label="All configured currencies"
            sx={{ height: 22, fontSize: 11 }}
          />
        )}
        <Chip
          size="small"
          label={`${pk.allowed_domains.length} domain${pk.allowed_domains.length === 1 ? "" : "s"}`}
          sx={{ height: 22, fontSize: 11 }}
        />
      </Box>

      {/* Expand / collapse details */}
      <Box sx={{ mt: 1 }}>
        <CustomButton
          data-testid={`pk-expand-${pk.pub_key_id}`}
          label={expanded ? "Hide details & snippet" : "Show details & snippet"}
          variant="secondary"
          size="small"
          endIcon={
            expanded ? (
              <Icon name="chevron-up" size={16} />
            ) : (
              <Icon name="chevron-down" size={16} />
            )
          }
          onClick={() => setExpanded((v) => !v)}
          sx={{ height: 28, fontSize: 12 }}
        />
      </Box>

      {expanded && (
        <Box sx={{ mt: 1.25 }}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: theme.palette.text.secondary,
              mb: 0.5,
            }}
          >
            Allowed domains
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
            {pk.allowed_domains.map((d) => (
              <Chip
                key={d}
                size="small"
                label={d}
                sx={{ height: 22, fontSize: 11 }}
              />
            ))}
          </Stack>

          {pk.allowed_currencies && pk.allowed_currencies.length > 0 && (
            <>
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  color: theme.palette.text.secondary,
                  mt: 1.25,
                  mb: 0.5,
                }}
              >
                Allowed currencies
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                {pk.allowed_currencies.map((c) => (
                  <Chip
                    key={c}
                    size="small"
                    label={c}
                    sx={{ height: 22, fontSize: 11 }}
                  />
                ))}
              </Stack>
            </>
          )}

          <SnippetPre
            code={snippet}
            onCopy={() => onCopy(snippet, "Buy Button snippet")}
          />

          <Typography
            sx={{
              mt: 1,
              fontSize: 12,
              color: theme.palette.text.secondary,
            }}
          >
            Change <code>amount</code> and (optionally) <code>currency</code> as needed. This publishable key only accepts requests coming from the domains listed above, and only for amounts ≤ {pk.max_amount} {pk.base_currency}.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Create/Edit modal                                                   */
/* ------------------------------------------------------------------ */

interface KeyFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  companyId: number | null;
  initialPk: PublishableKey | null;
  onClose: () => void;
  onSaved: (msg: string, createdKey?: PublishableKey) => void;
}

const KeyFormModal = ({
  open,
  mode,
  companyId,
  initialPk,
  onClose,
  onSaved,
}: KeyFormModalProps) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const dispatch = useDispatch();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Initialize form on modal open
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialPk) {
      setForm({
        environment: initialPk.environment,
        key_name: initialPk.key_name || "",
        allowed_domains_input: (initialPk.allowed_domains || []).join(", "),
        max_amount: String(initialPk.max_amount || 2000),
        allowed_currencies_input: (initialPk.allowed_currencies || []).join(", "),
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setServerError(null);
  }, [open, mode, initialPk]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const domains = useMemo(
    () => parseTokens(form.allowed_domains_input),
    [form.allowed_domains_input],
  );
  const currencies = useMemo(
    () => parseTokens(form.allowed_currencies_input).map((c) => c.toUpperCase()),
    [form.allowed_currencies_input],
  );

  const canSubmit =
    !!companyId &&
    domains.length > 0 &&
    Number(form.max_amount) >= 5 &&
    !saving;

  const handleSubmit = async () => {
    if (!companyId) return;
    setServerError(null);

    const body: Record<string, unknown> = {
      allowed_domains: domains,
      max_amount: Number(form.max_amount),
      allowed_currencies: currencies.length > 0 ? currencies : null,
      key_name: form.key_name.trim() || undefined,
    };

    setSaving(true);
    try {
      if (mode === "create") {
        body.company_id = companyId;
        body.environment = form.environment;
        const { data } = await axiosBaseApi.post("publishable-keys", body);
        onSaved(
          data?.message || "Publishable key created",
          data?.data as PublishableKey,
        );
      } else if (initialPk) {
        // Environment is immutable in edit (drop it from body)
        const { data } = await axiosBaseApi.patch(
          `publishable-keys/${initialPk.pub_key_id}`,
          body,
        );
        onSaved(data?.message || "Publishable key updated");
      }
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save publishable key";
      setServerError(msg);
      dispatch({
        type: TOAST_SHOW,
        payload: { message: msg, severity: "error" },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PopupModal
      open={open}
      showHeader={false}
      transparent
      handleClose={onClose}
      sx={{
        "& .MuiDialog-paper": {
          width: "100%",
          maxWidth: "540px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          p: 2,
        },
      }}
    >
      <PanelCard
        title={mode === "create" ? "Create publishable key" : "Edit publishable key"}
        showHeaderBorder={false}
        bodyPadding={
          isMobile
            ? theme.spacing(2, 2, 2, 2)
            : theme.spacing(1.5, 3.5, 3.5, 3.5)
        }
        headerPadding={theme.spacing(3, 3.5, 0, 3.5)}
      >
        <Typography
          sx={{
            fontSize: isMobile ? 13 : 14,
            color: theme.palette.text.secondary,
            mb: 2,
          }}
        >
          Publishable keys are safe to use in browser code. Every request from
          them is checked against the domains you list below.
        </Typography>

        <Stack spacing={2}>
          {mode === "create" && (
            <Box>
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: theme.palette.text.secondary,
                  mb: 0.5,
                }}
              >
                Environment
              </Typography>
              <Select
                fullWidth
                size="small"
                value={form.environment}
                onChange={(e) =>
                  setField(
                    "environment",
                    e.target.value as "production" | "development",
                  )
                }
                data-testid="pk-form-env"
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  borderRadius: "8px",
                }}
              >
                <MenuItem value="development">
                  Test — pk_test_… (recommended to try first)
                </MenuItem>
                <MenuItem value="production">Live — pk_live_…</MenuItem>
              </Select>
            </Box>
          )}

          <InputField
            fullWidth
            label="Key name (optional)"
            placeholder="e.g. Storefront checkout"
            value={form.key_name}
            onChange={(e: any) => setField("key_name", e.target.value)}
            data-testid="pk-form-name"
          />

          <InputField
            fullWidth
            label="Allowed domains *"
            placeholder="https://shop.com, *.shop.com"
            multiline
            minRows={2}
            value={form.allowed_domains_input}
            onChange={(e: any) =>
              setField("allowed_domains_input", e.target.value)
            }
            data-testid="pk-form-domains"
          />
          <Typography
            sx={{
              mt: -1,
              fontSize: 12,
              color: theme.palette.text.secondary,
            }}
          >
            Comma or space separated. Accepts full URLs (
            <code>https://shop.com</code>) or wildcard subdomains (
            <code>*.shop.com</code>). Requests from other origins are rejected.
          </Typography>
          {domains.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, mt: -1 }}>
              {domains.map((d) => (
                <Chip key={d} label={d} size="small" sx={{ height: 22, fontSize: 11 }} />
              ))}
            </Stack>
          )}

          <InputField
            fullWidth
            label="Max amount *"
            placeholder="2000"
            type="number"
            value={form.max_amount}
            onChange={(e: any) => setField("max_amount", e.target.value)}
            data-testid="pk-form-max"
          />
          <Typography sx={{ mt: -1, fontSize: 12, color: theme.palette.text.secondary }}>
            The largest single payment this key can create (in your base currency). Amount must be ≥ 5.
          </Typography>

          <InputField
            fullWidth
            label="Allowed currencies (optional)"
            placeholder="e.g. USDT-TRC20, USDC-ERC20 — leave empty to allow all configured wallets"
            value={form.allowed_currencies_input}
            onChange={(e: any) =>
              setField("allowed_currencies_input", e.target.value)
            }
            data-testid="pk-form-currencies"
          />
          {currencies.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, mt: -1 }}>
              {currencies.map((c) => (
                <Chip key={c} label={c} size="small" sx={{ height: 22, fontSize: 11 }} />
              ))}
            </Stack>
          )}

          {serverError && (
            <Box
              sx={{
                border: `1px solid ${theme.palette.error.main}`,
                borderRadius: "8px",
                p: 1.25,
                background:
                  theme.palette.mode === "dark"
                    ? "rgba(239,68,68,0.08)"
                    : "rgba(239,68,68,0.06)",
              }}
              data-testid="pk-form-error"
            >
              <Typography
                sx={{
                  fontSize: 13,
                  color: theme.palette.error.main,
                  wordBreak: "break-word",
                }}
              >
                {serverError}
              </Typography>
            </Box>
          )}
        </Stack>

        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column-reverse" : "row",
            gap: 1,
            mt: 3,
          }}
        >
          <CustomButton
            variant="outlined"
            size={isMobile ? "small" : "medium"}
            label="Cancel"
            onClick={onClose}
            data-testid="pk-form-cancel"
            sx={{ flex: 1 }}
          />
          <CustomButton
            variant="primary"
            size={isMobile ? "small" : "medium"}
            label={mode === "create" ? "Create key" : "Save changes"}
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="pk-form-submit"
            sx={{ flex: 1 }}
          />
        </Box>
      </PanelCard>
    </PopupModal>
  );
};

/* ------------------------------------------------------------------ */
/* "Just created" toast/panel — shows full key once with copy hint     */
/* ------------------------------------------------------------------ */

const JustCreatedBanner = ({
  pk,
  onDismiss,
  onCopy,
}: {
  pk: PublishableKey;
  onDismiss: () => void;
  onCopy: (v: string, label?: string) => void;
}) => {
  const theme = useTheme();
  return (
    <Box
      data-testid="pk-just-created-banner"
      sx={{
        mt: 1.5,
        border: `1px solid ${theme.palette.success?.main || "#22C55E"}`,
        background:
          theme.palette.mode === "dark"
            ? "rgba(34,197,94,0.08)"
            : "rgba(34,197,94,0.06)",
        borderRadius: "12px",
        p: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Icon
          name="circle-check"
          size={20}
          color={theme.palette.success?.main || "#22C55E"}
        />
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: theme.palette.text.primary }}>
          Publishable key created
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, mb: 1 }}>
        This key is safe to use in browser code. Copy it below — you can also
        re-copy it any time from the list.
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          background:
            theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "#fff",
          border: `1px solid ${theme.palette.border.main}`,
          borderRadius: "8px",
          px: 1.25,
          py: 0.75,
        }}
      >
        <Typography
          sx={{
            flex: 1,
            minWidth: 0,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: 13,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {pk.publishable_key}
        </Typography>
        <IconButton
          size="small"
          data-testid="pk-just-created-copy"
          onClick={() => onCopy(pk.publishable_key, "Publishable key")}
        >
          <Icon name="copy" size={16} />
        </IconButton>
      </Box>
      <Box sx={{ mt: 1.25, display: "flex", justifyContent: "flex-end" }}>
        <CustomButton
          variant="secondary"
          size="small"
          label="Dismiss"
          onClick={onDismiss}
          sx={{ height: 28, fontSize: 12 }}
        />
      </Box>
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Main section                                                        */
/* ------------------------------------------------------------------ */

const PublishableKeysSection = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const dispatch = useDispatch();

  const selectedCompanyId = useCompanyStore().selectedCompanyId;
  const companyList = useCompanyStore().companyList;

  // Fallback: if no company is selected yet but the user has exactly one, use it.
  const effectiveCompanyId = useMemo(() => {
    if (selectedCompanyId) return selectedCompanyId;
    if (companyList.length === 1) return companyList[0].company_id;
    return null;
  }, [selectedCompanyId, companyList]);

  // Publishable keys list — SWR-backed (shared with BuyButtonsSection + the
  // API embed card so the list is deduped/cached instead of re-fetched per
  // component). `loadKeys()` is kept as an alias for the SWR revalidate so all
  // the mutation handlers below keep working unchanged.
  const {
    keys,
    loading,
    error: pkError,
    refetch: loadKeys,
  } = usePublishableKeys<PublishableKey>(effectiveCompanyId, {
    enabled: !!effectiveCompanyId,
  });
  const loadError = pkError
    ? (pkError as any)?.response?.data?.message ||
      (pkError as any)?.message ||
      "Failed to load publishable keys"
    : null;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalKey, setModalKey] = useState<PublishableKey | null>(null);

  const [revokeId, setRevokeId] = useState<number | null>(null);

  const [justCreated, setJustCreated] = useState<PublishableKey | null>(null);

  const snippetBase = useMemo(() => {
    // Rendered inside merchant-facing copy-paste snippets — always canonical
    // Dynopay host. Never fall back to window.location.origin (that would
    // leak the preview/dev host into copy samples).
    const fromEnv = (process.env.NEXT_PUBLIC_BASE_URL as string) || "";
    if (fromEnv) return fromEnv.replace(/\/+$/, "");
    return "https://checkout.dynopay.com";
  }, []);

  const handleCopy = (value: string, label = "Copied") => {
    if (!value) return;
    try {
      copyToClipboard(value);
      dispatch({
        type: TOAST_SHOW,
        payload: { message: `${label} copied`, severity: "info" },
      });
    } catch {
      dispatch({
        type: TOAST_SHOW,
        payload: { message: "Unable to copy", severity: "error" },
      });
    }
  };

  const openCreate = () => {
    setModalMode("create");
    setModalKey(null);
    setModalOpen(true);
  };

  const openEdit = (pk: PublishableKey) => {
    setModalMode("edit");
    setModalKey(pk);
    setModalOpen(true);
  };

  const onSaved = (msg: string, createdKey?: PublishableKey) => {
    dispatch({
      type: TOAST_SHOW,
      payload: { message: msg, severity: "success" },
    });
    if (createdKey) setJustCreated(createdKey);
    loadKeys();
  };

  const handleToggleStatus = async (pk: PublishableKey) => {
    if (pk.status === "revoked") return;
    const next = pk.status === "active" ? "inactive" : "active";
    try {
      await axiosBaseApi.patch(`publishable-keys/${pk.pub_key_id}`, {
        status: next,
      });
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: `Publishable key ${next === "active" ? "enabled" : "disabled"}`,
          severity: "success",
        },
      });
      loadKeys();
    } catch (err: any) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:
            err?.response?.data?.message ||
            "Failed to update publishable key status",
          severity: "error",
        },
      });
    }
  };

  const confirmRevoke = async () => {
    if (!revokeId) return;
    try {
      await axiosBaseApi.delete(`publishable-keys/${revokeId}`);
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: "Publishable key revoked",
          severity: "success",
        },
      });
      loadKeys();
    } catch (err: any) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:
            err?.response?.data?.message || "Failed to revoke publishable key",
          severity: "error",
        },
      });
    } finally {
      setRevokeId(null);
    }
  };

  // Sort: active first, then inactive, then revoked; live before test within each.
  const sortedKeys = useMemo(() => {
    const statusRank: Record<string, number> = { active: 0, inactive: 1, revoked: 2 };
    const envRank: Record<string, number> = { production: 0, development: 1 };
    return [...keys].sort((a, b) => {
      const s = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
      if (s !== 0) return s;
      return (envRank[a.environment] ?? 9) - (envRank[b.environment] ?? 9);
    });
  }, [keys]);

  return (
    <Box
      data-testid="publishable-keys-section"
      sx={{
        border: `1px solid ${theme.palette.border.main}`,
        borderRadius: "12px",
        background: theme.palette.background.paper,
        p: { xs: 2, sm: 2.5 },
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          gap: 1,
        }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: 18,
              fontWeight: 700,
              color: theme.palette.text.primary,
              fontFamily: "var(--font-sans)",
            }}
          >
            Publishable keys · Buy Button
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: 14, color: theme.palette.text.secondary }}>
            Browser-safe keys for drop-in <code>&lt;dynopay-buy-button&gt;</code>.
            Each key is domain-locked and amount-capped. Requires an active
            secret key of the same environment.
          </Typography>
        </Box>
        <CustomButton
          data-testid="pk-create-btn"
          label={isMobile ? "Create" : "Create publishable key"}
          variant="primary"
          size={isMobile ? "small" : "medium"}
          endIcon={<Icon name="plus" size={isMobile ? 16 : 18} />}
          onClick={openCreate}
          disabled={!effectiveCompanyId}
          sx={{ flexShrink: 0 }}
        />
      </Box>

      {justCreated && (
        <JustCreatedBanner
          pk={justCreated}
          onDismiss={() => setJustCreated(null)}
          onCopy={handleCopy}
        />
      )}

      <Box sx={{ mt: 2 }}>
        {!effectiveCompanyId ? (
          <Box
            sx={{
              p: 3,
              textAlign: "center",
              border: `1px dashed ${theme.palette.border.main}`,
              borderRadius: "12px",
            }}
            data-testid="pk-no-company"
          >
            <Typography sx={{ fontSize: 14, color: theme.palette.text.secondary }}>
              Select a company to manage its publishable keys.
            </Typography>
          </Box>
        ) : loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 4,
            }}
          >
            <CircularProgress
              size={22}
              sx={{ color: brandFg(theme.palette.mode === "dark") }}
            />
          </Box>
        ) : loadError ? (
          <Box
            sx={{
              p: 2,
              border: `1px solid ${theme.palette.error.main}`,
              borderRadius: "10px",
            }}
            data-testid="pk-load-error"
          >
            <Typography sx={{ fontSize: 13, color: theme.palette.error.main }}>
              {loadError}
            </Typography>
          </Box>
        ) : sortedKeys.length === 0 ? (
          <Box
            sx={{
              p: 4,
              textAlign: "center",
              border: `1px dashed ${theme.palette.border.main}`,
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1.25,
            }}
            data-testid="pk-empty"
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.palette.action.hover,
                color: brandFg(theme.palette.mode === "dark"),
                mb: 0.5,
              }}
            >
              <Icon name="code-xml" size={24} />
            </Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: theme.palette.text.primary }}>
              No publishable keys yet
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, maxWidth: 340, lineHeight: 1.55 }}>
              Publishable keys let you embed a Buy Button or checkout on your own
              site. Create one to get your first embeddable snippet.
            </Typography>
            <Box sx={{ mt: 1 }}>
              <CustomButton
                label="Create publishable key"
                variant="primary"
                size="small"
                startIcon={<Icon name="plus" size={15} />}
                onClick={openCreate}
                data-testid="pk-empty-cta"
              />
            </Box>
          </Box>
        ) : (
          <Stack spacing={1.25} data-testid="pk-list">
            {sortedKeys.map((pk) => (
              <PublishableKeyRow
                key={pk.pub_key_id}
                pk={pk}
                onCopy={handleCopy}
                onEdit={openEdit}
                onRevoke={(row) => setRevokeId(row.pub_key_id)}
                onToggleStatus={handleToggleStatus}
                snippetBase={snippetBase}
              />
            ))}
          </Stack>
        )}
      </Box>

      <KeyFormModal
        open={modalOpen}
        mode={modalMode}
        companyId={effectiveCompanyId}
        initialPk={modalKey}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />

      <DeleteModel
        open={revokeId !== null}
        onClose={() => setRevokeId(null)}
        onConfirm={confirmRevoke}
        title="Revoke publishable key"
        message="Once revoked, this publishable key can no longer create checkout sessions. Any Buy Buttons on your site using this key will stop working. This action cannot be undone."
      />
    </Box>
  );
};

export default PublishableKeysSection;
