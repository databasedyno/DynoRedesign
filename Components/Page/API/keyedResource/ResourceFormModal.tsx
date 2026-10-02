import { ReactNode, useEffect, useRef, useState } from "react";
import { Box, Stack, Typography, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import CustomButton from "@/Components/UI/Buttons";
import PanelCard from "@/Components/UI/PanelCard";
import PopupModal from "@/Components/UI/PopupModal";
import { isStepUpCancelled } from "@/Components/UI/StepUp/stepUpBus";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import useIsMobile from "@/hooks/useIsMobile";

interface UseResourceFormOptions<F, T> {
  open: boolean;
  mode: "create" | "edit";
  initial: T | null;
  defaults: () => F;
  fromItem: (item: T) => F;
  /** Resolve → modal closes; throw → modal stays open and the error is shown. */
  submit: (form: F) => Promise<void>;
  onClose: () => void;
  failedMsg: string;
}

/** Form state + submit lifecycle shared by the create/edit modals. */
export function useResourceForm<F, T>(opts: UseResourceFormOptions<F, T>) {
  const dispatch = useDispatch();
  const [form, setForm] = useState<F>(opts.defaults);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!opts.open) return;
    const { mode, initial, defaults, fromItem } = optsRef.current;
    setForm(mode === "edit" && initial ? fromItem(initial) : defaults());
    setServerError(null);
  }, [opts.open, opts.mode, opts.initial]);

  const setField = <K extends keyof F>(k: K, v: F[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setServerError(null);
    setSaving(true);
    try {
      await optsRef.current.submit(form);
      optsRef.current.onClose();
    } catch (err: any) {
      if (isStepUpCancelled(err)) return;
      const msg = err?.response?.data?.message || err?.message || optsRef.current.failedMsg;
      setServerError(msg);
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
    } finally {
      setSaving(false);
    }
  };

  return { form, setField, saving, serverError, handleSubmit };
}

interface ResourceFormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  intro: string;
  maxWidth?: number;
  error: string | null;
  errorTestId: string;
  cancelLabel: string;
  cancelTestId?: string;
  submitLabel: string;
  submitTestId: string;
  canSubmit: boolean;
  onSubmit: () => void;
  children: ReactNode;
}

const ResourceFormModal = ({
  open,
  onClose,
  title,
  intro,
  maxWidth = 540,
  error,
  errorTestId,
  cancelLabel,
  cancelTestId,
  submitLabel,
  submitTestId,
  canSubmit,
  onSubmit,
  children,
}: ResourceFormModalProps) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");

  return (
    <PopupModal
      open={open}
      showHeader={false}
      transparent
      handleClose={onClose}
      sx={{
        "& .MuiDialog-paper": {
          width: "100%",
          maxWidth: `${maxWidth}px`,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          p: 2,
        },
      }}
    >
      <PanelCard
        title={title}
        showHeaderBorder={false}
        bodyPadding={isMobile ? theme.spacing(2, 2, 2, 2) : theme.spacing(1.5, 3.5, 3.5, 3.5)}
        headerPadding={theme.spacing(3, 3.5, 0, 3.5)}
      >
        <Typography sx={{ fontSize: isMobile ? 13 : 14, color: theme.palette.text.secondary, mb: 2 }}>
          {intro}
        </Typography>

        <Stack spacing={2}>
          {children}

          {error && (
            <Box
              sx={{
                border: `1px solid ${theme.palette.error.main}`,
                borderRadius: "8px",
                p: 1.25,
                background:
                  theme.palette.mode === "dark" ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.06)",
              }}
              data-testid={errorTestId}
            >
              <Typography sx={{ fontSize: 13, color: theme.palette.error.main, wordBreak: "break-word" }}>
                {error}
              </Typography>
            </Box>
          )}
        </Stack>

        <Box sx={{ display: "flex", flexDirection: isMobile ? "column-reverse" : "row", gap: 1, mt: 3 }}>
          <CustomButton
            variant="outlined"
            size={isMobile ? "small" : "medium"}
            label={cancelLabel}
            onClick={onClose}
            data-testid={cancelTestId}
            sx={{ flex: 1 }}
          />
          <CustomButton
            variant="primary"
            size={isMobile ? "small" : "medium"}
            label={submitLabel}
            onClick={onSubmit}
            disabled={!canSubmit}
            data-testid={submitTestId}
            sx={{ flex: 1 }}
          />
        </Box>
      </PanelCard>
    </PopupModal>
  );
};

export default ResourceFormModal;
