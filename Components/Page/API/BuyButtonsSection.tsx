/**
 * Buy Buttons Section — Phase 2D dashboard UI
 *
 * Renders a self-contained card just below the Publishable Keys card:
 *   • List pre-created buy button objects (fixed OR customer-priced)
 *   • Create a new button with amount / label / currencies / metadata / etc.
 *   • Edit / Archive an existing button
 *   • Copy the `<dynopay-buy-button button-id="btn_…" publishable-key="pk_…">`
 *     snippet (a running SDK requests amount from the SERVER via button_id so
 *     a shopper cannot tamper with the price in the merchant's HTML).
 *
 * Wires to backend routes (all mounted under /api):
 *   POST/GET/PATCH/DELETE /api/buy-buttons
 */

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
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import axiosBaseApi from "@/axiosConfig";
import CustomButton from "@/Components/UI/Buttons";
import DeleteModel from "@/Components/UI/DeleteModel";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import PanelCard from "@/Components/UI/PanelCard";
import PopupModal from "@/Components/UI/PopupModal";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import useIsMobile from "@/hooks/useIsMobile";
import { rootReducer } from "@/utils/types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface BuyButton {
  button_id: string;
  company_id: number;
  name: string;
  label: string;
  price_type: "fixed" | "customer";
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
  price_type: "fixed" | "customer";
  amount: string;
  min_amount: string;
  max_amount: string;
  allowed_currencies_input: string;
  description: string;
  success_url: string;
  metadata_input: string; // JSON textarea
}

const DEFAULT_FORM: FormState = {
  name: "",
  label: "Pay with crypto",
  price_type: "fixed",
  amount: "25",
  min_amount: "10",
  max_amount: "500",
  allowed_currencies_input: "",
  description: "",
  success_url: "",
  metadata_input: "",
};

const parseTokens = (raw: string): string[] =>
  raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

/* ------------------------------------------------------------------ */
/* Snippet block                                                       */
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
/* Row                                                                 */
/* ------------------------------------------------------------------ */

interface RowProps {
  btn: BuyButton;
  pkLive: string | null;
  pkTest: string | null;
  snippetBase: string;
  onCopy: (v: string, label?: string) => void;
  onEdit: (btn: BuyButton) => void;
  onArchive: (btn: BuyButton) => void;
  onReactivate: (btn: BuyButton) => void;
}

const BuyButtonRow = ({
  btn,
  pkLive,
  pkTest,
  snippetBase,
  onCopy,
  onEdit,
  onArchive,
  onReactivate,
}: RowProps) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    btn.status === "active"
      ? theme.palette.success?.main || "#22C55E"
      : theme.palette.text.secondary;

  const priceLabel =
    btn.price_type === "fixed"
      ? `${btn.amount ?? 0} ${btn.base_currency}`
      : `${btn.min_amount ?? 5}-${btn.max_amount ?? "∞"} ${btn.base_currency} (customer chooses)`;

  const pk = pkLive || pkTest || "pk_live_your_key";
  const snippet =
    `<!-- Dynopay embed SDK — load once per page -->\n` +
    `<script src="${snippetBase}/v1/embed.js"></script>\n\n` +
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

  return (
    <Box
      sx={{
        border: `1px solid ${theme.palette.border.main}`,
        borderRadius: "12px",
        background: theme.palette.background.paper,
        p: { xs: 1.5, sm: 2 },
        opacity: btn.status === "archived" ? 0.75 : 1,
        transition: "border-color 0.2s ease",
        "&:hover": { borderColor: theme.palette.primary.main },
      }}
    >
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
            label={btn.price_type === "fixed" ? "FIXED" : "CUSTOMER"}
            size="small"
            sx={{
              height: 22,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              bgcolor: btn.price_type === "fixed"
                ? theme.palette.primary.main
                : theme.palette.warning?.main || "#F59E0B",
              color: btn.price_type === "fixed" ? theme.palette.primary.contrastText || "#000" : "#fff",
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
            {btn.name}
          </Typography>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: statusColor }}>
            {btn.status === "active" ? (
              <Icon name="circle-check" size={16} />
            ) : (
              <Icon name="ban" size={16} />
            )}
            <Typography sx={{ fontSize: 12, fontWeight: 600, textTransform: "capitalize", color: statusColor }}>
              {btn.status}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          <Tooltip title="Edit">
            <span>
              <IconButton
                size="small"
                data-testid={`bb-edit-${btn.button_id}`}
                disabled={btn.status === "archived"}
                onClick={() => onEdit(btn)}
                sx={{ color: theme.palette.text.secondary }}
              >
                <Icon name="pencil" size={18} />
              </IconButton>
            </span>
          </Tooltip>
          {btn.status === "active" ? (
            <Tooltip title="Archive">
              <span>
                <IconButton
                  size="small"
                  data-testid={`bb-archive-${btn.button_id}`}
                  onClick={() => onArchive(btn)}
                  sx={{ color: theme.palette.error.main }}
                >
                  <Icon name="trash-2" size={18} />
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Tooltip title="Reactivate">
              <span>
                <IconButton
                  size="small"
                  data-testid={`bb-reactivate-${btn.button_id}`}
                  onClick={() => onReactivate(btn)}
                  sx={{ color: theme.palette.text.secondary }}
                >
                  <Icon name="circle-check" size={18} />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Button id + copy */}
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
          data-testid={`bb-id-${btn.button_id}`}
        >
          {btn.button_id}
        </Typography>
        <Tooltip title="Copy button id">
          <IconButton
            size="small"
            data-testid={`bb-copy-${btn.button_id}`}
            onClick={() => onCopy(btn.button_id, "Button ID")}
          >
            <Icon name="copy" size={16} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Meta chips */}
      <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
        <Chip size="small" label={priceLabel} sx={{ height: 22, fontSize: 11 }} />
        <Chip size="small" label={`${btn.usage_count} uses`} sx={{ height: 22, fontSize: 11 }} />
        <Chip
          size="small"
          label={
            btn.allowed_currencies && btn.allowed_currencies.length > 0
              ? `${btn.allowed_currencies.length} currencies`
              : "All configured"
          }
          sx={{ height: 22, fontSize: 11 }}
        />
        {btn.metadata && Object.keys(btn.metadata).length > 0 && (
          <Chip size="small" label={`${Object.keys(btn.metadata).length} metadata`} sx={{ height: 22, fontSize: 11 }} />
        )}
      </Box>

      {/* Expand */}
      <Box sx={{ mt: 1 }}>
        <CustomButton
          data-testid={`bb-expand-${btn.button_id}`}
          label={expanded ? "Hide snippet" : "Show snippet"}
          variant="secondary"
          size="small"
          endIcon={expanded ? <Icon name="chevron-up" size={16} /> : <Icon name="chevron-down" size={16} />}
          onClick={() => setExpanded((v) => !v)}
          sx={{ height: 28, fontSize: 12 }}
        />
      </Box>

      {expanded && (
        <Box sx={{ mt: 1.25 }}>
          {btn.description && (
            <Box sx={{ mb: 1.25 }}>
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
                Description
              </Typography>
              <Typography sx={{ fontSize: 13, color: theme.palette.text.primary }}>
                {btn.description}
              </Typography>
            </Box>
          )}

          {btn.success_url && (
            <Box sx={{ mb: 1.25 }}>
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
                Success URL
              </Typography>
              <Typography sx={{ fontSize: 13, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", color: theme.palette.text.primary, wordBreak: "break-all" }}>
                {btn.success_url}
              </Typography>
            </Box>
          )}

          {btn.allowed_currencies && btn.allowed_currencies.length > 0 && (
            <Box sx={{ mb: 1.25 }}>
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
                Allowed currencies
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                {btn.allowed_currencies.map((c) => (
                  <Chip key={c} size="small" label={c} sx={{ height: 22, fontSize: 11 }} />
                ))}
              </Stack>
            </Box>
          )}

          {!pkLive && !pkTest && (
            <Box
              sx={{
                mb: 1.25,
                p: 1.25,
                border: `1px solid ${theme.palette.warning?.main || "#F59E0B"}`,
                borderRadius: "8px",
                background:
                  theme.palette.mode === "dark"
                    ? "rgba(245,158,11,0.08)"
                    : "rgba(245,158,11,0.08)",
              }}
            >
              <Typography sx={{ fontSize: 12, color: theme.palette.text.primary }}>
                Create a publishable key first (above) so this snippet has one to reference. The placeholder <code>pk_live_your_key</code> is not usable.
              </Typography>
            </Box>
          )}

          <SnippetPre
            code={snippet}
            onCopy={() => onCopy(snippet, "Buy Button snippet")}
          />
        </Box>
      )}
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Create/Edit modal                                                   */
/* ------------------------------------------------------------------ */

interface FormModalProps {
  open: boolean;
  mode: "create" | "edit";
  companyId: number | null;
  initial: BuyButton | null;
  onClose: () => void;
  onSaved: (msg: string, createdBtn?: BuyButton) => void;
}

const FormModal = ({
  open,
  mode,
  companyId,
  initial,
  onClose,
  onSaved,
}: FormModalProps) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const dispatch = useDispatch();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setForm({
        name: initial.name || "",
        label: initial.label || "Pay with crypto",
        price_type: initial.price_type,
        amount: initial.amount != null ? String(initial.amount) : "25",
        min_amount: initial.min_amount != null ? String(initial.min_amount) : "10",
        max_amount: initial.max_amount != null ? String(initial.max_amount) : "500",
        allowed_currencies_input: (initial.allowed_currencies || []).join(", "),
        description: initial.description || "",
        success_url: initial.success_url || "",
        metadata_input: initial.metadata
          ? JSON.stringify(initial.metadata, null, 2)
          : "",
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setServerError(null);
  }, [open, mode, initial]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const currencies = useMemo(
    () => parseTokens(form.allowed_currencies_input).map((c) => c.toUpperCase()),
    [form.allowed_currencies_input],
  );

  const metadataObj = useMemo(() => {
    if (!form.metadata_input.trim()) return null;
    try {
      const p = JSON.parse(form.metadata_input);
      if (p && typeof p === "object" && !Array.isArray(p)) return p;
      return null;
    } catch {
      return null;
    }
  }, [form.metadata_input]);
  const metadataInvalid = !!form.metadata_input.trim() && !metadataObj;

  const canSubmit =
    !!companyId &&
    !!form.name.trim() &&
    !metadataInvalid &&
    !saving &&
    (form.price_type === "fixed"
      ? Number(form.amount) >= 5
      : Number(form.min_amount) >= 5 &&
        (form.max_amount === "" || Number(form.max_amount) > Number(form.min_amount)));

  const handleSubmit = async () => {
    if (!companyId) return;
    setServerError(null);

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      label: form.label.trim() || "Pay with crypto",
      price_type: form.price_type,
      allowed_currencies: currencies.length > 0 ? currencies : null,
      description: form.description.trim() || null,
      success_url: form.success_url.trim() || null,
      metadata: metadataObj,
    };
    if (form.price_type === "fixed") {
      body.amount = Number(form.amount);
    } else {
      body.min_amount = Number(form.min_amount);
      if (form.max_amount !== "") body.max_amount = Number(form.max_amount);
    }

    setSaving(true);
    try {
      if (mode === "create") {
        body.company_id = companyId;
        const { data } = await axiosBaseApi.post("buy-buttons", body);
        onSaved(data?.message || "Buy button created", data?.data as BuyButton);
      } else if (initial) {
        // price_type is immutable — drop it
        delete body.price_type;
        // Also drop the field that doesn't apply to this price type
        if (initial.price_type === "fixed") {
          delete body.min_amount;
          delete body.max_amount;
        } else {
          delete body.amount;
        }
        const { data } = await axiosBaseApi.patch(
          `buy-buttons/${initial.button_id}`,
          body,
        );
        onSaved(data?.message || "Buy button updated");
      }
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save buy button";
      setServerError(msg);
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
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
          maxWidth: "620px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          p: 2,
        },
      }}
    >
      <PanelCard
        title={mode === "create" ? "Create buy button" : "Edit buy button"}
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
          A buy button is a pre-created checkout object. Because the amount and
          currencies live server-side, shoppers can&apos;t tamper with the price
          in your page&apos;s HTML.
        </Typography>

        <Stack spacing={2}>
          <InputField
            fullWidth
            label="Internal name *"
            placeholder="e.g. T-shirt (Large)"
            value={form.name}
            onChange={(e: any) => setField("name", e.target.value)}
          />

          <InputField
            fullWidth
            label="Button label"
            placeholder="Pay with crypto"
            value={form.label}
            onChange={(e: any) => setField("label", e.target.value)}
          />

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
                Price type
              </Typography>
              <Select
                fullWidth
                size="small"
                value={form.price_type}
                onChange={(e) =>
                  setField(
                    "price_type",
                    e.target.value as "fixed" | "customer",
                  )
                }
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  borderRadius: "8px",
                }}
              >
                <MenuItem value="fixed">Fixed price — you set the amount</MenuItem>
                <MenuItem value="customer">Customer chooses (e.g. donation)</MenuItem>
              </Select>
            </Box>
          )}

          {form.price_type === "fixed" ? (
            <>
              <InputField
                fullWidth
                label="Amount *"
                placeholder="25"
                type="number"
                value={form.amount}
                onChange={(e: any) => setField("amount", e.target.value)}
              />
              <Typography sx={{ mt: -1, fontSize: 12, color: theme.palette.text.secondary }}>
                Amount must be ≥ 5 (base currency of your active secret key).
              </Typography>
            </>
          ) : (
            <>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                <InputField
                  fullWidth
                  label="Min amount *"
                  placeholder="10"
                  type="number"
                  value={form.min_amount}
                  onChange={(e: any) => setField("min_amount", e.target.value)}
                />
                <InputField
                  fullWidth
                  label="Max amount"
                  placeholder="500"
                  type="number"
                  value={form.max_amount}
                  onChange={(e: any) => setField("max_amount", e.target.value)}
                />
              </Box>
              <Typography sx={{ mt: -1, fontSize: 12, color: theme.palette.text.secondary }}>
                Shopper picks any amount in this range at checkout. Min must be ≥ 5.
              </Typography>
            </>
          )}

          <InputField
            fullWidth
            label="Allowed currencies (optional)"
            placeholder="e.g. USDT-TRC20, USDC-ERC20 — leave empty to allow all configured"
            value={form.allowed_currencies_input}
            onChange={(e: any) =>
              setField("allowed_currencies_input", e.target.value)
            }
          />
          {currencies.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, mt: -1 }}>
              {currencies.map((c) => (
                <Chip key={c} label={c} size="small" sx={{ height: 22, fontSize: 11 }} />
              ))}
            </Stack>
          )}

          <InputField
            fullWidth
            label="Description (optional)"
            placeholder="Shown to shoppers on the checkout page"
            multiline
            minRows={2}
            value={form.description}
            onChange={(e: any) => setField("description", e.target.value)}
          />

          <InputField
            fullWidth
            label="Success URL (optional)"
            placeholder="https://shop.com/thanks — where to send the shopper after payment"
            value={form.success_url}
            onChange={(e: any) => setField("success_url", e.target.value)}
          />

          <InputField
            fullWidth
            label="Metadata JSON (optional)"
            placeholder='{"sku":"TSHIRT-L-BLK","campaign":"summer24"}'
            multiline
            minRows={3}
            value={form.metadata_input}
            onChange={(e: any) => setField("metadata_input", e.target.value)}
          />
          {metadataInvalid && (
            <Typography sx={{ mt: -1, fontSize: 12, color: theme.palette.error.main }}>
              Metadata must be a valid JSON object (e.g. <code>{"{}"}</code>).
            </Typography>
          )}
          {!metadataInvalid && (
            <Typography sx={{ mt: -1, fontSize: 12, color: theme.palette.text.secondary }}>
              Attached to every session created from this button — useful for reconciling webhooks server-side.
            </Typography>
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
              data-testid="bb-form-error"
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
            sx={{ flex: 1 }}
          />
          <CustomButton
            variant="primary"
            size={isMobile ? "small" : "medium"}
            label={mode === "create" ? "Create button" : "Save changes"}
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="bb-form-submit"
            sx={{ flex: 1 }}
          />
        </Box>
      </PanelCard>
    </PopupModal>
  );
};

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

const BuyButtonsSection = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const dispatch = useDispatch();

  const selectedCompanyId = useSelector(
    (state: rootReducer) =>
      (state as any).companyReducer?.selectedCompanyId as number | undefined,
  );
  const companyList = useSelector(
    (state: rootReducer) =>
      ((state as any).companyReducer?.companyList as
        | Array<{ company_id: number }>
        | undefined) || [],
  );

  const effectiveCompanyId = useMemo(() => {
    if (selectedCompanyId) return selectedCompanyId;
    if (companyList.length === 1) return companyList[0].company_id;
    return null;
  }, [selectedCompanyId, companyList]);

  const [buttons, setButtons] = useState<BuyButton[]>([]);
  const [pks, setPks] = useState<PublishableKeyRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalBtn, setModalBtn] = useState<BuyButton | null>(null);

  const [archiveId, setArchiveId] = useState<string | null>(null);

  const snippetBase = useMemo(() => {
    const fromEnv = (process.env.NEXT_PUBLIC_BASE_URL as string) || "";
    if (fromEnv) return fromEnv.replace(/\/+$/, "");
    if (typeof window !== "undefined") return window.location.origin;
    return "https://checkout.dynopay.com";
  }, []);

  const load = useCallback(async () => {
    if (!effectiveCompanyId) {
      setButtons([]);
      setPks([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [btnResp, pkResp] = await Promise.all([
        axiosBaseApi.get(`buy-buttons?company_id=${effectiveCompanyId}`),
        axiosBaseApi.get(`publishable-keys?company_id=${effectiveCompanyId}`),
      ]);
      setButtons(btnResp?.data?.data?.buttons || []);
      setPks(pkResp?.data?.data?.keys || []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load buy buttons";
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  const pkLive = useMemo(() => {
    const row = pks.find(
      (p) => p.status === "active" && p.environment === "production",
    );
    return row?.publishable_key || null;
  }, [pks]);
  const pkTest = useMemo(() => {
    const row = pks.find(
      (p) => p.status === "active" && p.environment === "development",
    );
    return row?.publishable_key || null;
  }, [pks]);

  const handleCopy = (value: string, label = "Copied") => {
    if (!value) return;
    try {
      navigator.clipboard.writeText(value);
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
    setModalBtn(null);
    setModalOpen(true);
  };

  const openEdit = (btn: BuyButton) => {
    setModalMode("edit");
    setModalBtn(btn);
    setModalOpen(true);
  };

  const onSaved = (msg: string) => {
    dispatch({
      type: TOAST_SHOW,
      payload: { message: msg, severity: "success" },
    });
    load();
  };

  const confirmArchive = async () => {
    if (!archiveId) return;
    try {
      await axiosBaseApi.delete(`buy-buttons/${archiveId}`);
      dispatch({
        type: TOAST_SHOW,
        payload: { message: "Buy button archived", severity: "success" },
      });
      load();
    } catch (err: any) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:
            err?.response?.data?.message ||
            "Failed to archive buy button",
          severity: "error",
        },
      });
    } finally {
      setArchiveId(null);
    }
  };

  const reactivate = async (btn: BuyButton) => {
    try {
      await axiosBaseApi.patch(`buy-buttons/${btn.button_id}`, {
        status: "active",
      });
      dispatch({
        type: TOAST_SHOW,
        payload: { message: "Buy button reactivated", severity: "success" },
      });
      load();
    } catch (err: any) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:
            err?.response?.data?.message ||
            "Failed to reactivate buy button",
          severity: "error",
        },
      });
    }
  };

  const sortedButtons = useMemo(() => {
    const rank: Record<string, number> = { active: 0, archived: 1 };
    return [...buttons].sort((a, b) => {
      const s = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (s !== 0) return s;
      // then newest first
      return (
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
      );
    });
  }, [buttons]);

  return (
    <Box
      data-testid="buy-buttons-section"
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
            Buy buttons
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: 14, color: theme.palette.text.secondary }}>
            Pre-created checkout objects. The <code>button-id</code> path is the
            canonical Stripe-style flow — because the amount lives server-side,
            shoppers can&apos;t tamper with the price in your HTML.
          </Typography>
        </Box>
        <CustomButton
          data-testid="bb-create-btn"
          label={isMobile ? "Create" : "Create buy button"}
          variant="primary"
          size={isMobile ? "small" : "medium"}
          endIcon={<Icon name="plus" size={isMobile ? 16 : 18} />}
          onClick={openCreate}
          disabled={!effectiveCompanyId}
          sx={{ flexShrink: 0 }}
        />
      </Box>

      <Box sx={{ mt: 2 }}>
        {!effectiveCompanyId ? (
          <Box
            sx={{
              p: 3,
              textAlign: "center",
              border: `1px dashed ${theme.palette.border.main}`,
              borderRadius: "12px",
            }}
            data-testid="bb-no-company"
          >
            <Typography sx={{ fontSize: 14, color: theme.palette.text.secondary }}>
              Select a company to manage its buy buttons.
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
              sx={{ color: theme.palette.primary.main }}
            />
          </Box>
        ) : loadError ? (
          <Box
            sx={{
              p: 2,
              border: `1px solid ${theme.palette.error.main}`,
              borderRadius: "10px",
            }}
            data-testid="bb-load-error"
          >
            <Typography sx={{ fontSize: 13, color: theme.palette.error.main }}>
              {loadError}
            </Typography>
          </Box>
        ) : sortedButtons.length === 0 ? (
          <Box
            sx={{
              p: 3,
              textAlign: "center",
              border: `1px dashed ${theme.palette.border.main}`,
              borderRadius: "12px",
            }}
            data-testid="bb-empty"
          >
            <Typography sx={{ fontSize: 14, color: theme.palette.text.secondary }}>
              No buy buttons yet. Create one to embed a tamper-proof checkout on your site.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.25} data-testid="bb-list">
            {sortedButtons.map((btn) => (
              <BuyButtonRow
                key={btn.button_id}
                btn={btn}
                pkLive={pkLive}
                pkTest={pkTest}
                snippetBase={snippetBase}
                onCopy={handleCopy}
                onEdit={openEdit}
                onArchive={(b) => setArchiveId(b.button_id)}
                onReactivate={(b) => reactivate(b)}
              />
            ))}
          </Stack>
        )}
      </Box>

      <FormModal
        open={modalOpen}
        mode={modalMode}
        companyId={effectiveCompanyId}
        initial={modalBtn}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />

      <DeleteModel
        open={archiveId !== null}
        onClose={() => setArchiveId(null)}
        onConfirm={confirmArchive}
        title="Archive buy button"
        message="Once archived, this buy button can no longer create checkout sessions. Any pages on your site using it will stop working until you reactivate it (or replace the button-id with a new one)."
      />
    </Box>
  );
};

export default BuyButtonsSection;
