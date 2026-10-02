import { ReactNode, useMemo, useState } from "react";
import { Box, CircularProgress, Stack, Typography, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import CustomButton from "@/Components/UI/Buttons";
import DeleteModel from "@/Components/UI/DeleteModel";
import { isStepUpCancelled } from "@/Components/UI/StepUp/stepUpBus";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import copyToClipboard from "@/helpers/copyToClipboard";
import useIsMobile from "@/hooks/useIsMobile";
import { brandFg } from "@/constants/theme";

type Severity = "success" | "error" | "info";

/** Selected brand, falling back to the only brand when the user has exactly one. */
export const useEffectiveCompanyId = (): number | null => {
  const { selectedCompanyId, companyList } = useCompanyStore();
  return useMemo(() => {
    if (selectedCompanyId) return selectedCompanyId;
    if (companyList.length === 1) return companyList[0].company_id;
    return null;
  }, [selectedCompanyId, companyList]);
};

interface UseKeyedResourceOptions {
  i18nPrefix: string;
  refetch: () => void;
}

/** Modal / delete / copy / mutation plumbing shared by the keyed-resource sections. */
export function useKeyedResource<T, ID extends string | number = number>({ i18nPrefix, refetch }: UseKeyedResourceOptions) {
  const dispatch = useDispatch();
  const { t } = useTranslation("apiScreen");
  const toast = (message: string, severity: Severity) =>
    dispatch({ type: TOAST_SHOW, payload: { message, severity } });

  const [modal, setModal] = useState<{ open: boolean; mode: "create" | "edit"; item: T | null }>({
    open: false,
    mode: "create",
    item: null,
  });
  const [removeId, setRemoveId] = useState<ID | null>(null);
  const [justCreated, setJustCreated] = useState<T | null>(null);

  const handleCopy = async (value: string, label = t(`${i18nPrefix}.copied`, { defaultValue: "Copied" })) => {
    if (!value) return;
    const ok = await copyToClipboard(value);
    if (ok) toast(t(`${i18nPrefix}.copiedToast`, { defaultValue: "{{label}} copied", label }), "info");
    else toast(t(`${i18nPrefix}.unableToCopy`, { defaultValue: "Unable to copy" }), "error");
  };

  const mutate = async (run: () => Promise<unknown>, msgs: { success: string; failed: string }) => {
    try {
      await run();
      toast(msgs.success, "success");
      refetch();
    } catch (err: any) {
      if (isStepUpCancelled(err)) return;
      toast(err?.response?.data?.message || msgs.failed, "error");
    }
  };

  const onSaved = (msg: string, created?: T) => {
    toast(msg, "success");
    if (created) setJustCreated(created);
    refetch();
  };

  return {
    toast,
    modal,
    openCreate: () => setModal({ open: true, mode: "create", item: null }),
    openEdit: (item: T) => setModal({ open: true, mode: "edit", item }),
    closeModal: () => setModal((m) => ({ ...m, open: false })),
    removeId,
    requestRemove: (id: ID) => setRemoveId(id),
    cancelRemove: () => setRemoveId(null),
    justCreated,
    dismissJustCreated: () => setJustCreated(null),
    handleCopy,
    mutate,
    onSaved,
  };
}

interface KeyedResourceSectionProps {
  prefix: string;
  sectionTestId: string;
  title: string;
  description: ReactNode;
  createLabel: { short: string; long: string };
  companyId: number | null;
  noCompanyText: string;
  loading: boolean;
  loadError: string | null;
  isEmpty: boolean;
  empty: { title: string; body?: string; icon?: string; ctaLabel?: string };
  onCreate: () => void;
  banner?: ReactNode;
  remove: { open: boolean; title: string; message: string; onClose: () => void; onConfirm: () => void };
  modal: ReactNode;
  children: ReactNode;
}

const KeyedResourceSection = ({
  prefix,
  sectionTestId,
  title,
  description,
  createLabel,
  companyId,
  noCompanyText,
  loading,
  loadError,
  isEmpty,
  empty,
  onCreate,
  banner,
  remove,
  modal,
  children,
}: KeyedResourceSectionProps) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const dashed = {
    textAlign: "center" as const,
    border: `1px dashed ${theme.palette.border.main}`,
    borderRadius: "12px",
  };

  const renderBody = () => {
    if (!companyId) {
      return (
        <Box sx={{ p: 3, ...dashed }} data-testid={`${prefix}-no-company`}>
          <Typography sx={{ fontSize: 14, color: theme.palette.text.secondary }}>{noCompanyText}</Typography>
        </Box>
      );
    }
    if (loading) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 4 }}>
          <CircularProgress size={22} sx={{ color: brandFg(theme.palette.mode === "dark") }} />
        </Box>
      );
    }
    if (loadError) {
      return (
        <Box
          sx={{ p: 2, border: `1px solid ${theme.palette.error.main}`, borderRadius: "10px" }}
          data-testid={`${prefix}-load-error`}
        >
          <Typography sx={{ fontSize: 13, color: theme.palette.error.main }}>{loadError}</Typography>
        </Box>
      );
    }
    if (isEmpty) {
      const rich = !!empty.body;
      return (
        <Box
          sx={{ p: rich ? 4 : 3, ...dashed, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25 }}
          data-testid={`${prefix}-empty`}
        >
          {empty.icon && (
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
              <Icon name={empty.icon} size={24} />
            </Box>
          )}
          <Typography
            sx={
              rich
                ? { fontSize: 16, fontWeight: 700, color: theme.palette.text.primary }
                : { fontSize: 14, color: theme.palette.text.secondary }
            }
          >
            {empty.title}
          </Typography>
          {empty.body && (
            <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, maxWidth: 340, lineHeight: 1.55 }}>
              {empty.body}
            </Typography>
          )}
          {empty.ctaLabel && (
            <Box sx={{ mt: 1 }}>
              <CustomButton
                label={empty.ctaLabel}
                variant="primary"
                size="small"
                startIcon={<Icon name="plus" size={15} />}
                onClick={onCreate}
                data-testid={`${prefix}-empty-cta`}
              />
            </Box>
          )}
        </Box>
      );
    }
    return (
      <Stack spacing={1.25} data-testid={`${prefix}-list`}>
        {children}
      </Stack>
    );
  };

  return (
    <Box
      data-testid={sectionTestId}
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
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: theme.palette.text.primary, fontFamily: "var(--font-sans)" }}>
            {title}
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: 14, color: theme.palette.text.secondary }}>{description}</Typography>
        </Box>
        <CustomButton
          data-testid={`${prefix}-create-btn`}
          label={isMobile ? createLabel.short : createLabel.long}
          variant="primary"
          size={isMobile ? "small" : "medium"}
          endIcon={<Icon name="plus" size={isMobile ? 16 : 18} />}
          onClick={onCreate}
          disabled={!companyId}
          sx={{ flexShrink: 0 }}
        />
      </Box>

      {banner}

      <Box sx={{ mt: 2 }}>{renderBody()}</Box>

      {modal}

      <DeleteModel
        open={remove.open}
        onClose={remove.onClose}
        onConfirm={remove.onConfirm}
        title={remove.title}
        message={remove.message}
      />
    </Box>
  );
};

export default KeyedResourceSection;
