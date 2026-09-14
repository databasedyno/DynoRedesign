import React from "react";
import { Box, SxProps, Theme, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useImageDrop, DropRejectReason } from "@/hooks/useImageDrop";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
  /** Corner radius of the drag-active overlay (match the wrapped surface). */
  radius?: number | string;
  testId?: string;
  sx?: SxProps<Theme>;
  children: React.ReactNode;
}

/**
 * Wraps ANY existing upload surface (button row, avatar, preview card) and
 * makes it a drop target. Shows a solid overlay while a file is dragged over
 * and toasts a clear reason when the drop cannot be used (e.g. an image dragged
 * from another website, which browsers hand over as a link — not a file).
 */
const ImageDropTarget: React.FC<Props> = ({ onFile, disabled, radius = 12, testId, sx, children }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation("common");
  const isDark = theme.palette.mode === "dark";

  const onReject = (reason: DropRejectReason) => {
    if (reason === "disabled") return;
    dispatch({
      type: TOAST_SHOW,
      payload: {
        severity: "error",
        message:
          reason === "not-a-file"
            ? t("dropZone.notFile", {
                defaultValue: "Drop an image file from your computer — images dragged from other websites arrive as links and can't be uploaded.",
              })
            : t("dropZone.notImage", { defaultValue: "Only image files can be dropped here (JPG, PNG, GIF, WebP or SVG)." }),
      },
    });
  };

  const { active, bind } = useImageDrop({ onFile, onReject, disabled });

  return (
    <Box
      {...bind}
      data-testid={testId}
      data-drag-active={active ? "true" : "false"}
      sx={[{ position: "relative", minWidth: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    >
      {children}
      {active && (
        <Box
          aria-hidden
          data-testid={testId ? `${testId}-overlay` : undefined}
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            borderRadius: radius,
            border: `2px dashed ${theme.palette.primary.main}`,
            backgroundColor: isDark ? "rgba(99,102,241,0.14)" : "rgba(67,56,202,0.08)",
            backdropFilter: "blur(2px)",
            pointerEvents: "none",
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
            fontWeight: 700,
            color: theme.palette.primary.main,
            animation: "dpDropIn 140ms ease-out",
            "@keyframes dpDropIn": { from: { opacity: 0, transform: "scale(0.985)" }, to: { opacity: 1, transform: "none" } },
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        >
          <Icon icon="mdi:cloud-upload-outline" width={20} />
          {t("dropZone.drop", { defaultValue: "Drop image to upload" })}
        </Box>
      )}
    </Box>
  );
};

export default ImageDropTarget;
